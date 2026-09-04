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

  /* Izin Stasiun Radio yang mendekati/lewat masa habisnya. ISR tidak dimiliki
     satu orang seperti sertifikat, jadi disaring seperti pekerjaan berkala:
     dibunyikan ke yang berdinas hari ini di unit itu — yang libur tidak
     diganggu, dan yang di depan alatnya diingatkan. Beranda tetap menampilkan
     seluruh unit yang boleh dibuka akun ini, jadi yang di luar dinas tidak
     kehilangan gambaran keseluruhannya. */
  if(typeof ISR === 'object' && ISR && typeof isrSisa === 'function'){
    unitDinasSaya().forEach(unit=>{
      (ISR[unit] || []).forEach(row=>{
        const sisa = isrSisa(row);
        if(sisa == null || sisa > ISR_AWAS) return;
        keluar.push({
          rupa: sisa < 0 ? 'bahaya' : 'awas',
          judul: sisa < 0
            ? T(`ISR ${row.nama} sudah habis`, `Radio licence ${row.nama} has lapsed`)
            : T(`ISR ${row.nama} tinggal ${sisa} hari`, `Radio licence ${row.nama} has ${sisa} days left`),
          rinci: `${row.nomor ? row.nomor + ' · ' : ''}${namaUnit(unit)}${
            row.habis ? ' · ' + T('berlaku sampai','valid until') + ' ' + tglRingkas(row.habis) : ''}`,
          layar: 'unit', unit, sub: 'isr',
          urut: sisa + 50   // di antara pekerjaan hari ini dan sertifikat jauh
        });
      });
    });
  }

  /* Tanda tangan yang belum dibubuhkan padahal jamnya sudah lewat. Disaring ke
     unit yang boleh dibuka akun ini — kalau tidak boleh masuk ke unitnya,
     mengingatkan bahwa lembarnya menggantung cuma menimbulkan pertanyaan yang
     tidak bisa dijawab dari sini. */
  (typeof TTD_TERLAMBAT === 'object' && TTD_TERLAMBAT ? TTD_TERLAMBAT : []).forEach(t=>{
    if(!bolehBuka(t.unit)) return;
    const sisiTeks = t.belum.map(s=>s.peran).join(' & ');
    const namaTeks = t.belum
      .filter(s=>s.nama).map(s=>`${s.peran}: ${s.nama}`).join(' · ');
    keluar.push({
      rupa: 'bahaya',
      judul: T(`${t.judul} ${t.tgl} belum di-TTD ${sisiTeks}`,
                `${t.judul} ${t.tgl} unsigned by ${sisiTeks}`),
      rinci: `${namaUnit(t.unit)}${t.dinas ? ' · ' + T('dinas','shift') + ' ' + t.dinas : ''}${namaTeks ? ' · ' + namaTeks : ''}`,
      // Diarahkan ke unitnya — layar unit sudah membawa daftar formulir tempat
      // TTD-nya bisa dibubuhkan. Belum langsung membuka formulirnya (perlu
      // parameter tambahan di router unit), tapi cukup untuk mengarahkan mata.
      layar: 'unit', unit: t.unit, sub: 'berkala',
      urut: -200        // TTD terlambat lebih mendesak daripada berkala hari ini
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

