/* =======================================================================
   PERHATIAN DAN LONCENG — dua wajah dari satu hitungan

   Beranda menampilkan yang perlu diketahui BERSAMA; lonceng menampilkan yang
   perlu dikerjakan ANDA. Keduanya dihitung dari sumber yang sama supaya tidak
   pernah saling bertentangan — beranda berkata dua sertifikat hampir habis
   sementara loncengnya diam adalah cara tercepat membuat orang berhenti
   mempercayai keduanya.

   Yang membedakan cuma saringannya:
     beranda — seluruh unit yang boleh dibuka akun ini
     lonceng — sertifikat MILIK akun ini, dan kegiatan berkala di unit tempat
               akun ini tercantum di jadwal dinas HARI INI
   Saringan kedua itu yang diminta: teknisi yang berdinas hari ini diingatkan
   mengerjakan pekerjaan mingguannya, dan yang sedang libur tidak diganggu.
   ======================================================================= */

/**
 * Unit tempat akun ini tercantum berdinas hari ini.
 *
 * Dibaca lewat dinasUnit(), bukan langsung dari JDW.jadwal, supaya jawabannya
 * selalu sama dengan yang tertulis di layar Dinas Hari Ini — termasuk saat
 * jadwalnya belum diisi dan yang tampil masih data contoh. Lonceng yang diam
 * sementara layar di sebelahnya menyebut nama orangnya hanya membuat orang
 * berhenti mempercayai keduanya.
 */
/**
 * Nama di jadwal ini merujuk akun yang sedang masuk?
 *
 * Nama di jadwal diketik tangan dan jarang sama persis dengan nama akun.
 * Dicocokkan longgar dua arah — kalau harus sama persis, hampir tidak ada yang
 * pernah kena peringatannya. Dipakai bersama oleh lonceng dan Kotak Masuk:
 * dua aturan pencocokan yang berbeda akan membuat keduanya berselisih tentang
 * pekerjaan yang sama.
 */
function namaSaya(n){
  if(!akun) return false;
  const x = String(n || '').toLowerCase().trim();
  if(!x) return false;
  const nama = String(akun.nama || '').toLowerCase();
  const user = String(akun.user || '').toLowerCase();
  return x === nama || x === user || (x.length > 3 && (nama.includes(x) || x.includes(nama)));
}

function unitDinasSaya(){
  if(!akun) return [];
  return UNIT.map(u=>u.kode)
    .filter(kode=>dinasUnit(kode).some(s=>s.o.some(o=>namaSaya(o.n))));
}

/**
 * Rombongan tempat akun ini berdinas hari ini di satu unit — 'PS', 'M', atau
 * keduanya kalau namanya kebetulan tertulis di dua petak.
 *
 * Kosong punya dua sebab yang tidak dibedakan di sini: orangnya memang tidak
 * berdinas, atau kode dinasnya tidak dikenal SHIFT. Yang memanggil menangani
 * keduanya sama — tidak menyaring — karena lonceng yang diam gara-gara kode
 * asing di lembar jadwal jauh lebih buruk daripada lonceng yang salah alamat.
 */
function rombonganSaya(unit){
  const punya = new Set();
  dinasUnit(unit).forEach(s=>{
    if(!s.o.some(o=>namaSaya(o.n))) return;
    const g = rombonganShift(s.k);
    if(g) punya.add(g);
  });
  return punya;
}

/** Pemberitahuan pribadi untuk akun yang sedang masuk. */
function notifSaya(){
  const keluar = [];
  if(!akun) return keluar;

  const user = String(akun.user || '').toLowerCase();
  PSN.daftar
    .filter(p=>String(p.username || '').toLowerCase() === user && user)
    .forEach(p=>(p.sertifikat || []).forEach(s=>{
      const sisa = sertSisa(s);
      if(sisa == null || sisa > SERT_AWAS) return;
      keluar.push({
        rupa: sisa < 0 ? 'bahaya' : 'awas',
        judul: sisa < 0
          ? T(`${sertJenisNama(s.jenis)} Anda sudah habis`, `Your ${sertJenisNama(s.jenis).toLowerCase()} has lapsed`)
          : T(`${sertJenisNama(s.jenis)} Anda tinggal ${sisa} hari`,
              `Your ${sertJenisNama(s.jenis).toLowerCase()} has ${sisa} days left`),
        rinci: `${s.nama || s.nomor || '—'}${s.rating ? ' · ' + s.rating : ''} · ${T('berlaku sampai','valid until')} ${tglRingkas(s.berlaku)}`,
        // Sertifikat sekarang tinggal di dalam unit orangnya. Yang tidak punya
        // unit tetap diberitahu — cuma tidak ada tempat untuk dituju.
        layar: 'unit', unit: p.unit || '', sub: 'personel',
        urut: sisa
      });
    }));

  unitDinasSaya().forEach(unit=>{
    const punya = rombonganSaya(unit);
    bklJatuhTempo(unit).forEach(({ k, sisa })=>{
      if(sisa > 1) return;      // yang masih jauh bukan urusan dinas hari ini
      // Pekerjaan yang menyebut rombongan hanya dibunyikan ke rombongan itu.
      // Yang tidak menyebut apa-apa tetap dibunyikan ke semua yang berdinas —
      // itu perilaku sejak awal, dan seluruh kegiatan lama ada di keadaan itu.
      const shift = bklShift(k);
      if(shift && punya.size && !punya.has(shift)) return;
      keluar.push({
        rupa: sisa < 0 ? 'bahaya' : 'awas',
        judul: sisa < 0
          ? T(`Pekerjaan ${bklJenisNama(k.jenis).toLowerCase()} lewat ${-sisa} hari`,
              `${bklJenisNama(k.jenis)} job ${-sisa} days overdue`)
          : T(`Pekerjaan ${bklJenisNama(k.jenis).toLowerCase()} jatuh tempo${sisa === 0 ? ' hari ini' : ' besok'}`,
              `${bklJenisNama(k.jenis)} job due ${sisa === 0 ? 'today' : 'tomorrow'}`),
        rinci: `${k.nama} · ${namaUnit(unit)}${shift ? ' · ' + bklShiftNama(shift) : ''} · ${
          T('Anda berdinas hari ini di unit ini', 'you are on duty in this unit today')}`,
        layar: 'unit', unit, sub: 'berkala',
        urut: sisa - 100      // pekerjaan hari ini didahulukan daripada sertifikat
      });
    });
  });

  return keluar.sort((a,b)=>a.urut - b.urut);
}

function gambarLonceng(){
  const tombol = el('tombolLonceng'); if(!tombol) return;
  const daftar = notifSaya();
  const angka = el('loncengAngka');
  angka.textContent = daftar.length;
  angka.hidden = !daftar.length;
  tombol.classList.toggle('ada', daftar.length > 0);
  tombol.title = daftar.length
    ? T(`${daftar.length} hal untuk Anda`, `${daftar.length} things for you`)
    : T('Tidak ada pemberitahuan','No notifications');

  el('isiLonceng').innerHTML = daftar.length
    ? daftar.map((n,i)=>`<button class="lonceng-butir ${n.rupa}" data-notif="${i}">
        <span class="jd">${esc(n.judul)}</span>
        <span class="rn">${esc(n.rinci)}</span></button>`).join('')
    : `<div class="lonceng-kosong">${
        T('Tidak ada yang perlu Anda kerjakan hari ini. Sertifikat Anda masih berlaku, dan tidak ada '
        + 'pekerjaan berkala yang jatuh tempo di unit tempat Anda berdinas.',
          'Nothing for you today. Your certificates are current, and no recurring job is due in the unit '
        + 'you are on duty in.')}</div>`;

  el('isiLonceng').querySelectorAll('[data-notif]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const n = daftar[Number(b.dataset.notif)];
      loncengTutup();
      if(n.layar === 'unit'){
        if(!n.unit){
          pesan(T('Baris personel ini belum ditetapkan unitnya, jadi tidak ada unit yang bisa dibuka. '
                + 'Mintalah administrator menetapkannya.',
                  'This personnel row has no unit set, so there is no unit to open. Ask an administrator '
                + 'to set one.'));
          return;
        }
        if(!bolehBuka(n.unit)){
          pesan(T(`Akun Anda tidak berhak membuka unit ${namaUnit(n.unit)}.`,
                  `Your account may not open the ${namaUnit(n.unit)} unit.`));
          return;
        }
        bukaUnit(n.unit); subtabAktif = n.sub || 'berkala'; gambarUnit();
      }
      else pindahLayar(n.layar);
    });
  });

  /* Kotak Masuk digambar dari sini, bukan ditambahkan ke enam tempat yang
     memanggil gambarLonceng(). Keduanya diturunkan dari data yang sama persis —
     kegiatan berkala, jadwal dinas, catatan selesai — jadi tidak ada keadaan di
     mana yang satu perlu digambar ulang dan yang lain tidak. Dipisah, cepat
     atau lambat ada satu tempat yang lupa memanggil salah satunya. */
  gambarKotakMasuk();
}

