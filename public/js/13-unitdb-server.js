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
  if(!SRV.aktif){ dbSimpan(); return true; }
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
function srvPasang(unitSaya, paket){
  // Data nyata harus diukur dari hari yang nyata pula; tanggal patokan data
  // contoh akan membuat umur trouble meleset berbulan-bulan.
  HARI_INI = new Date(new Date().toDateString());

  // Daftar unit contoh dipertahankan sebagai kerangka — di dalamnya ada
  // ilustrasi tiap unit, dan unit yang TIDAK boleh dibuka akun ini pun tetap
  // perlu terlihat (bergembok), persis seperti di aplikasinya.
  const peta = Object.fromEntries(unitSaya.map(u=>[u.kode, u]));
  UNIT = CONTOH.UNIT.map(u=>{
    const s = peta[u.kode];
    return s ? { ...u, nama:s.nama || u.nama, alat:s.peralatan || u.alat,
                 dinas:(Array.isArray(s.dinas) && s.dinas.length) ? s.dinas : u.dinas } : u;
  });
  // Unit baru di server yang belum dikenal berkas ini tetap ikut tampil.
  unitSaya.filter(s=>!CONTOH.UNIT.some(u=>u.kode === s.kode)).forEach(s=>UNIT.push({
    kode:s.kode, nama:s.nama || s.kode, alat:s.peralatan || '—',
    adegan: ADEGAN_UNIT[s.kode] || 'server',
    dinas:(Array.isArray(s.dinas) && s.dinas.length) ? s.dinas : KODE_DINAS
  }));

  // Penanda formulir per unit (adaDsTest, adaDailyCheck, adaMonitoring)
  // dipakai apa adanya dari daftar unit E-Logbook — dashboard ini tidak
  // menyimpan daftar tandingan yang bisa berselisih dengan aslinya.
  UNIT_FORM = Object.fromEntries(unitSaya.map(u=>[u.kode, u]));

  const STATUS = new Set(['Open','Proses','Closed']);
  TROUBLE = [];
  LOGBOOK = {};
  BUKTI   = {};
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
    LOGBOOK[kode] = (d.entries || []).slice(0, 6).map(e=>({
      tgl:     isoTgl(e.Tanggal) || isoTgl(e.DibuatPada) || isoHariIni(),
      jam:     e.Jam || '—',
      selesai: e.JamSelesai || '',
      frek:    e.Frek || '',
      dinas:   e.Dinas || '—',
      uraian:  e.Uraian || '—',
      pj:      e.PJNama || e.TeknisiNama || e.DiinputOleh || '—'
    }));
  });

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

/** Kembali ke data contoh — dipakai saat masuk lewat akun contoh. */
function pakaiContoh(){
  UNIT = CONTOH.UNIT; TROUBLE = CONTOH.TROUBLE; LOGBOOK = CONTOH.LOGBOOK;
  // Tanpa server tidak ada lembar apa pun untuk dibaca; kegiatan yang
  // bersumber E-Logbook jatuh kembali ke tanda manual dengan sendirinya.
  // Penanda formulir ikut dikosongkan, jadi tombol tautannya juga hilang.
  BUKTI = {}; UNIT_FORM = {};
  // Dokumen yang datang dari server ikut dilepas: tautannya menuju endpoint
  // yang sudah tidak dipakai, dan daftar yang tidak bisa dibuka lebih buruk
  // daripada daftar kosong. Yang lokal tidak ada di sini — belum ada.
  Object.keys(BERKAS).forEach(k=>delete BERKAS[k]);
  HARI_INI = new Date('2026-08-14T00:00:00');
  SRV.aktif = false; SRV.unit = []; SRV.jam = null;
}

/** Catatan penanda di layar unit, hanya saat datanya nyata. */
const catatanContoh = (teks, en) => SRV.aktif
  ? `<div class="catatan"><b>${T('Masih data contoh.','Still sample data.')}</b> ${T(teks, en)}</div>` : '';

