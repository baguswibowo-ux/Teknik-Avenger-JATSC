/* =======================================================================
   DATABASE UNIT DARI SERVER

   Peralatan dan sparepart dulu hidup di localStorage: tiap peramban memegang
   salinannya sendiri, dan suntingan seseorang tidak pernah terlihat oleh
   siapa pun. Saat tersambung, yang berlaku sekarang isi server.

   Unit yang belum punya catatan tampil KOSONG, bukan diisi daftar contoh —
   aturan yang sama dengan logbook di layar unit. Daftar contoh yang menyamar
   jadi data nyata jauh lebih merugikan daripada daftar yang jujur kosong.
   ======================================================================= */

const LOGO = {};          // kode unit -> { berkas, jam }

async function unitdbMuat(){
  if(!SRV.aktif) return;
  try{
    const r = await srvFetch('/unitdb', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok || !j) return;

    Object.keys(PERALATAN).forEach(k=>delete PERALATAN[k]);
    Object.assign(PERALATAN, j.peralatan || {});

    // Sparepart disimpan server berkunci unit; layar ini memakainya sebagai
    // satu larik datar berkolom unit. Kode unitnya dikembalikan di sini.
    const datar = [];
    Object.entries(j.sparepart || {}).forEach(([unit, baris])=>
      (Array.isArray(baris) ? baris : []).forEach(b=>datar.push({ ...b, unit })));
    PART.splice(0, PART.length, ...datar);

    Object.keys(LOGO).forEach(k=>delete LOGO[k]);
    Object.assign(LOGO, j.logo || {});
  }catch(e){
    console.warn('Database unit tidak terbaca dari server:', e && e.message || e);
  }
}

/**
 * Simpan satu modul satu unit.
 *
 * Yang dikirim seluruh daftar unit itu, bukan barisnya saja — server
 * membandingkan id untuk mengetahui ada yang dihapus atau tidak, dan itu
 * satu-satunya cara ia bisa memisahkan "menghapus" dari "menyimpan daftar
 * yang kebetulan lebih pendek".
 *
 * Kalau server menolak, isi di layar sudah terlanjur berubah. Karena itu
 * dibaca ulang dari server: menyisakan perubahan yang tidak tersimpan di
 * layar akan membuat orang mengira pekerjaannya sudah aman.
 */
async function dbSimpanUnit(jenis, unit){
  const modul = jenis === 'peralatan' ? 'peralatan' : 'sparepart';
  const isi = modul === 'peralatan'
    ? (PERALATAN[unit] || [])
    : PART.filter(p=>p.unit === unit).map(({ unit:_buang, ...sisa })=>sisa);
  try{
    const r = await srvFetch(`/unitdb/${modul}/${encodeURIComponent(unit)}`, {
      method:'PUT', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ [modul]: isi })
    }, 15000);
    const j = await r.json().catch(()=>null);
    if(!r.ok){
      pesan((j && j.error) || T('Gagal menyimpan ke server.','Could not save to the server.'));
      await unitdbMuat();
      return false;
    }
    return true;
  }catch(e){
    pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
    await unitdbMuat();
    return false;
  }
}

/** Terjemahkan jawaban server ke bentuk yang dipakai layar ini. */
function srvPasang(unitSaya, paket, unitSemua){
  // Disetel ulang tiap data datang: halaman yang dibiarkan terbuka semalaman
  // akan mengukur umur trouble dari kemarin kalau tidak.
  HARI_INI = new Date(new Date().toDateString());

  /* Daftar unit disusun dari jawaban E-Logbook, bukan dari salinan di halaman
     ini — satu daftar unit, satu tempat ia ditulis.

     `unitSemua` berisi SELURUH unit, bukan cuma yang dipegang akun ini. Itu
     yang membedakannya dari `unitSaya` dan itu sebabnya ia perlu ada: unit yang
     tidak boleh dibuka pun tetap tampil (bergembok) di cincin beranda, dan dulu
     nama yang dipakainya diambil dari salinan lokal. Akibatnya satu unit punya
     dua nama tergantung siapa yang membuka — administrator melihat nama dari
     server, teknisi melihat nama dari halaman.

     E-Logbook lama belum menjawab `unitSemua`. Yang jatuh ke `unitSaya` dalam
     keadaan itu bukan nama yang salah, melainkan unit bergembok yang belum
     muncul sampai E-Logbook ikut dideploy — sengaja begitu: kurang lengkap
     lebih baik daripada keliru. */
  const dasar = (Array.isArray(unitSemua) && unitSemua.length) ? unitSemua : unitSaya;
  UNIT = dasar.map(s=>({
    kode:   s.kode,
    nama:   s.nama || s.kode,
    alat:   s.peralatan || '—',
    // Ilustrasinya milik dashboard ini; E-Logbook tidak punya kolomnya.
    adegan: ADEGAN_UNIT[s.kode] || 'server',
    /* Selalu KODE_DINAS, TIDAK PERNAH s.dinas. Keduanya bernama sama dan
       artinya berbeda: `dinas` di daftar unit E-Logbook adalah pilihan shift
       untuk lembar logbooknya, sedangkan yang dipakai modul Jadwal Dinas di
       sini kode bergedung PSJ/PSN/MJ/MN. Dulu ditimpa begitu saja, dan yang
       terbaca di layar jadi "Kode yang bisa diisi: Pagi · Siang · Malam · PS"
       tepat di atas kalimat yang menerangkan arti huruf J dan N. */
    dinas:  KODE_DINAS
  }));

  // Penanda formulir per unit (adaDsTest, adaDailyCheck, adaMonitoring)
  // dipakai apa adanya dari daftar unit E-Logbook — dashboard ini tidak
  // menyimpan daftar tandingan yang bisa berselisih dengan aslinya.
  UNIT_FORM = Object.fromEntries(unitSaya.map(u=>[u.kode, u]));

  const STATUS = new Set(['Open','Proses','Closed']);
  TROUBLE = [];
  LOGBOOK = {};
  BUKTI   = {};
  TTD_TERLAMBAT = [];
  // Ambang "sudah lewat jamnya" — apa pun yang bertanggal sebelum HARI INI
  // (UTC) dan salah satu tanda tangannya kosong dianggap terlambat. Dibaca
  // sekali di awal supaya seluruh unit dibandingkan ke titik yang sama.
  const CUTOFF = isoHariIni();
  Object.entries(paket).forEach(([kode, d])=>{
    /* Lembar-lembar yang dipakai kegiatan berkala bersumber E-Logbook — lihat
       blok KEGIATAN YANG TANDANYA DATANG DARI E-LOGBOOK. Tanggalnya saja yang
       diambil; isi lembarnya tetap tinggal di sana. Nama teknisinya bisa
       berisi beberapa nama yang digabung koma, dan itu dibiarkan apa adanya:
       yang mengerjakan satu lembar memang sering lebih dari satu orang.

       Diambil untuk SELURUH sumber yang terdaftar, bukan cuma yang kebetulan
       sedang dipakai satu unit: menambah sumber baru di registri tidak boleh
       menuntut baris di sini ikut disunting. */
    Object.entries(BERKALA_SUMBER).forEach(([sumber, f])=>{
      if(!f.paket) return;
      BUKTI[sumber] = BUKTI[sumber] || {};
      BUKTI[sumber][kode] = (d[f.paket] || []).filter(x=>!f.saring || f.saring(x)).map(x=>{
        const tgl = f.tgl(x) || '';
        return { tgl, rinci: f.rinci(x) || '', nama: f.nama(x) || '—',
                 oleh: x.DiinputOleh || '—',
                 jam:  x.DibuatPada || (tgl ? tgl + 'T00:00:00' : '') };
      }).filter(x=>x.tgl);
    });

    // Isu yang sudah ditutup bukan lagi trouble — papan ini tentang yang
    // masih menggantung.
    (d.issues || []).forEach(i=>{
      const status = STATUS.has(i.Status) ? i.Status : 'Open';
      if(status === 'Closed') return;
      TROUBLE.push({
        unit: kode,
        alat: '',                       // isu di server belum menunjuk peralatan tertentu
        jenis: i.Jenis || '—',
        ket:   i.Keterangan || '—',
        lokasi:i.Lokasi || '—',
        status,
        tgl:   isoTgl(i.TanggalReport) || isoTgl(i.DibuatPada) || isoHariIni(),
        pic:   i.DilaporkanOleh || i.DiinputOleh || '—'
      });
    });
    LOGBOOK[kode] = (d.entries || []).slice(0, 6).map(e=>{
      // Nama teknisi bisa lebih dari satu (rombongan dinas). Kalau daftarnya
      // dikirim, dipakai; kalau tidak, jatuh ke satu nama TeknisiNama.
      const namaTek = Array.isArray(e.TeknisiNamaListJSON) && e.TeknisiNamaListJSON.length
        ? e.TeknisiNamaListJSON.join(', ')
        : (e.TeknisiNama || '');
      return {
        tgl:     isoTgl(e.Tanggal) || isoTgl(e.DibuatPada) || isoHariIni(),
        jam:     e.Jam || '—',
        selesai: e.JamSelesai || '',
        frek:    e.Frek || '',
        dinas:   e.Dinas || '—',
        uraian:  e.Uraian || '—',
        teknisi: namaTek || e.DiinputOleh || '—',
        pj:      e.PJNama || '—'
      };
    });

    /* Formulir yang jamnya sudah lewat namun TTD-nya belum dibubuhkan. Enam
       jenis lembar diperiksa dengan aturan yang sama: yang bertanggal sebelum
       hari ini dan salah satu petak TTD-nya kosong. Nama sisi yang belum
       ditandatangani ikut disebutkan supaya notif bisa mengarahkan tepat ke
       petaknya. */
    const cek = (jenis, judul, arr, ambilTgl, sisi)=>{
      (arr || []).forEach(r=>{
        const tgl = ambilTgl(r);
        if(!tgl || tgl >= CUTOFF) return;
        const belum = sisi.filter(s=>!s.ttd(r));
        if(!belum.length) return;
        TTD_TERLAMBAT.push({
          jenis, judul, unit: kode, id: r.ID || r.Id || '',
          tgl, dinas: r.Dinas || '',
          belum: belum.map(s=>({ peran: s.peran, nama: s.nama(r) || '' }))
        });
      });
    };
    const tglTanggal = r => isoTgl(r.Tanggal);
    const tglLapor   = r => isoTgl(r.TanggalLapor) || isoTgl(r.Tanggal);
    cek('logbook',    'Logbook Fasilitas',    d.entries,    tglTanggal, [
      { peran:'Teknisi Onduty', nama:r=>r.TeknisiNama, ttd:r=>r.TeknisiTTD },
      { peran:'Manager Teknik', nama:r=>r.PJNama,      ttd:r=>r.PJTTD }
    ]);
    cek('dailycheck', 'Daily Check',          d.dcHistory,  tglTanggal, [
      { peran:'Teknisi Onduty', nama:r=>r.TeknisiNama, ttd:r=>r.TeknisiTTD },
      { peran:'Manager Teknik', nama:r=>r.ManagerNama, ttd:r=>r.ManagerTTD }
    ]);
    cek('monitoring', 'Monitoring Frekuensi', d.monitoring, tglTanggal, [
      { peran:'Teknisi Onduty', nama:r=>r.PersonilTeknik, ttd:r=>r.TeknisiTTD },
      { peran:'Personil Operasi', nama:r=>r.PersonilOps,  ttd:r=>r.PersonilOpsTTD }
    ]);
    cek('dstest',     'DS Test',              d.dstest,     tglTanggal, [
      { peran:'Teknisi Onduty', nama:r=>r.TeknisiNama, ttd:r=>r.TeknisiTTD },
      { peran:'Manager Teknik', nama:r=>r.ManagerNama, ttd:r=>r.ManagerTTD }
    ]);
    cek('berkala',    'Kegiatan Berkala',     d.berkala,    tglTanggal, [
      { peran:'Teknisi Onduty', nama:r=>r.TeknisiNama, ttd:r=>r.TeknisiTTD },
      { peran:'Manager Teknik', nama:r=>r.ManagerNama, ttd:r=>r.ManagerTTD }
    ]);
    cek('ltk',        'LTK',                  d.ltk,        tglLapor,   [
      { peran:'Teknisi Onduty', nama:r=>r.TeknisiNama, ttd:r=>r.TeknisiTTD },
      { peran:'Manager Teknik', nama:r=>r.ManagerNama, ttd:r=>r.ManagerTTD }
    ]);
  });

  // Yang paling lama menggantung ditaruh di atas — bukan yang terbaru.
  TTD_TERLAMBAT.sort((a,b)=>a.tgl < b.tgl ? -1 : (a.tgl > b.tgl ? 1 : 0));

  const kodeBoleh = unitSaya.map(u=>u.kode);
  akun = {
    user:  SRV.sesi.username,
    nama:  SRV.sesi.nama || SRV.sesi.username,
    // peran dipakai untuk ditampilkan, role untuk diperiksa. Dipisah karena
    // sebutan di layar boleh berganti kapan saja, kode peran tidak.
    role:    SRV.sesi.role,
    peran:   PERAN_SERVER[SRV.sesi.role]    || SRV.sesi.role || 'Pengguna',
    peranEn: PERAN_SERVER_EN[SRV.sesi.role] || SRV.sesi.role || 'User',
    unit:  UNIT.every(u=>kodeBoleh.includes(u.kode)) ? 'semua' : kodeBoleh
  };

  SRV.aktif = true;
  SRV.unit  = kodeBoleh;
  SRV.jam   = new Date();
}


