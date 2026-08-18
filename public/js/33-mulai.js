/* =======================================================================
   MULAI
   ======================================================================= */
function gambarSemua(){
  el('avAkun').textContent = inisial(akun.nama);
  el('nmAkun').textContent = akun.nama;
  el('prAkun').textContent = peranAkun();
  el('ketBeranda').textContent = akun.unit === 'semua'
    ? T('Semua unit terbuka untuk akun ini.','Every unit is open to this account.')
    : T('Kartu bergembok = di luar wewenang akun ini.','A padlocked card is outside this account’s authority.');
  gambarCincin(); gambarUbin(); gambarTrouble(); gambarDinas();
  gambarPerhatian(); gambarLonceng(); gambarPersonel();
  gambarPilihUnit(); gambarUnit();
  // Log aktivitas ikut digambar ulang dari yang sudah ada di memori — tidak
  // diambil ulang ke server di sini, karena gambarSemua() juga dipanggil saat
  // bahasanya berganti, dan mengganti bahasa bukan alasan untuk satu perjalanan
  // ke server.
  gambarAktivitas();
  pasangTabAkun(); gambarAkun();
  el('modulBaris').innerHTML = MODUL.map(m=>`<div class="modul ${m.jalan?'jalan':''}">
    <div class="st">${esc(T(m.st, m.stEn))}</div><h4>${esc(T(m.nama, m.namaEn))}</h4>
    <p>${esc(T(m.ket, m.ketEn))}</p></div>`).join('');
}

/* Dulu baris ini menempel di ekor bagian KELOLA AKUN. Dalam satu berkas utuh
   itu tidak masalah — deklarasi fungsinya ter-hoist. Setelah dipecah, hoisting
   berhenti di batas berkas, dan 15-tautan-elogbook.js baru dimuat sesudahnya.
   Tempatnya memang di sini: ini memang kode yang menyalakan, bukan milik
   pengelolaan akun. */
muatTautanElogbook();
