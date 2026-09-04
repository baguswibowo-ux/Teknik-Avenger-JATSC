/* =======================================================================
   KELOLA AKUN — akun E-Logbook diurus dari depan

   Kenapa di sini, bukan di E-Logbook: akunnya satu, tapi pintunya dua. Selama
   pengelolaannya tinggal di dalam E-Logbook, setiap penambahan atau pergantian
   peran menuntut administrator berpindah aplikasi lebih dulu. Ditaruh di depan,
   satu tempat saja yang perlu dibuka.

   Yang TIDAK dilakukan layar ini, dan itu disengaja: tidak menyimpan akun
   sendiri, tidak menyentuh basis data E-Logbook, tidak menyunting satu pun
   berkasnya. Semuanya lewat fungsi administrator yang memang sudah ada di
   API-nya — listUsers, addUser, setUserNama, setUserRole, setUserUnit,
   setUserAktif, setUserPassword, deleteUser — dipanggil ke /api/* pada asal
   yang sama, persis seperti data lainnya. Kalau layar ini dibuang besok, tidak
   ada satu pun jejaknya yang tertinggal di sana.

   Penjagaannya juga tetap milik server. Tab ini disembunyikan dari yang bukan
   administrator, tapi itu cuma kenyamanan: E-Logbook menolak seluruh fungsi di
   atas dengan 403 untuk peran lain, dan menyembunyikan tombol tidak pernah
   menghalangi siapa pun memanggil API-nya langsung.

   Aturan yang ditegakkan server dan sengaja ditiru di sini supaya salahnya
   ketahuan sebelum permintaannya berangkat: teknisi harus punya minimal satu
   unit, password minimal 6 karakter, administrator aktif terakhir tidak boleh
   diturunkan atau dinonaktifkan, akun sendiri tidak bisa diturunkan sendiri,
   dan hanya akun nonaktif yang boleh dihapus.
   ======================================================================= */

let USERS = [];          // daftar akun terakhir dari server
let USERS_JAM = null;    // kapan daftar itu diambil
let akunDibuka = null;   // salinan akun yang sedang terbuka di kartu; null = tambah baru

/* Overlay hak lanjut per akun. Peta {username: {unitKhusus, bolehTtd,
   bolehModul}} — kosong berarti akun itu mengikuti aturan perannya
   apa adanya. Diambil dari /hak-akun (admin/super-admin saja). */
let HAK_AKUN = {};

const HAK_LANJUT_JENIS_TTD = [
  ['sparepart', 'Daftar Sparepart', 'Spare Parts List'],
  ['dinas',     'Jadwal Dinas Bulanan', 'Monthly Duty Roster'],
  ['peralatan', 'Sejarah Peralatan', 'Equipment History']
];

/** Layar ini milik administrator, apa pun sumber datanya.
    Super-admin (penanda orthogonal terhadap peran) juga boleh membukanya —
    tanpa itu, akun bertanda super-admin yang bukan admin biasa tidak punya
    jalan mengelola akun sama sekali. */
const bolehKelolaAkun = () => !!akun && (akun.role === 'admin' || akun.superadmin === true);
const akuSuperadmin  = () => !!akun && akun.superadmin === true;

/** Boleh menyunting panel "Siapa Boleh Mengisi Apa" (peran + Ditunjuk).
 *  Admin unit ikut — ia boleh menunjuk orang di unitnya sendiri. Tapi apa yang
 *  bisa disentuhnya di layar tetap dibatasi (kolom peran dimatikan, baris TTD
 *  dimatikan), dan server melakukan validasi ulang. */
const bolehAturHak = () => !!akun && (akun.role === 'admin' || akun.role === 'adminunit' || akun.superadmin === true);

const SEMUA_UNIT_PERAN = ['admin', 'pejabat', 'pic-dinas', 'pic-sparepart', 'pic-isr'];
const samaIsi = (a, b) => a.length === b.length && a.every(k => b.includes(k));

/** Cakupan unit orang yang sedang membuka layar.
 *  - `null` = tidak dibatasi (admin, superadmin, atau akun bertanda 'semua').
 *  - Array kode unit = dibatasi ke unit itu saja — dipakai kalau nantinya
 *    admin unit boleh mengatur "Ditunjuk khusus": daftar calon dan pil unit
 *    di panel itu ikut dipotong ke unitnya sendiri, tidak membocorkan nama
 *    dari unit lain.
 *
 *  Ditaruh di satu tempat supaya kalau aturannya berubah, cukup di sini.
 *  Untuk admin biasa hasilnya `null`, jadi tidak ada perubahan perilaku sama
 *  sekali sampai admin unit benar-benar diberi jalan masuk. */
function unitLingkupSaya(){
  if(!akun) return [];
  if(akun.role === 'admin' || akun.superadmin === true) return null;
  if(akun.unit === 'semua') return null;
  return Array.isArray(akun.unit) ? akun.unit.slice() : [];
}

/** Panggil fungsi administrator di E-Logbook. Dulu ada dua sumber di sini —
    server, atau daftar akun tiruan di peramban untuk data contoh — dan tabel
    Kelola Akun sengaja tidak tahu sedang bicara dengan yang mana. Tiruannya
    sudah dibuang: satu-satunya gudang akun adalah E-Logbook. */
const adminApi = (fn, ...args) => srvApi(fn, ...args);

/**
 * Siapa boleh membuka log aktivitas.
 *
 * Dulu cukup sudah masuk. Isinya nama orang beserta jam ia bekerja, dan itu
 * bukan sesuatu yang perlu terbuka untuk seluruh akun teknisi. Sekarang
 * administrator — ditambah admin unit, yang hanya melihat unitnya sendiri;
 * penyaringannya dikerjakan server, bukan di sini.
 *
 * Ini penjagaan tampilan, bukan penjagaan yang sesungguhnya: /aktivitas di
 * server menolak sendiri siapa pun yang tidak berhak, tanpa bergantung pada
 * tab ini tersembunyi atau tidak.
 */
const bolehAktivitas = () => !!akun && (akun.role === 'admin' || akun.role === 'adminunit');

function pasangTabAkun(){
  // Tab "Kelola Akun" muncul untuk siapa saja yang boleh mengatur hak — admin
  // biasa lihat semuanya, admin unit lihat panel Hak saja.
  const bolehTab = bolehAturHak();
  el('relAkun').hidden = !bolehTab;

  const bolehAkt = bolehAktivitas();
  el('relAktivitas').hidden = !bolehAkt;
  if(!bolehAkt && el('l-aktivitas').classList.contains('aktif')) pindahLayar('beranda');
  // Yang sedang membuka layar ini lalu kehilangan haknya — keluar, misalnya —
  // tidak boleh ditinggal menatap tabel yang tak berlaku lagi.
  if(!bolehTab && el('l-akun').classList.contains('aktif')) pindahLayar('beranda');

  // Bagian pengelolaan akun (statistik + daftar akun) hanya untuk administrator.
  // Admin unit tetap boleh membuka layar, tapi hanya panel Hak yang tampil.
  const bagian = el('bagianAkun');
  if(bagian) bagian.hidden = !bolehKelolaAkun();

  // Panel aktivasi ringkas justru kebalikannya: hanya untuk admin unit — yang
  // boleh mengatur hak tetapi tidak mengelola akun penuh. Administrator sudah
  // punya kolom Status di kartu Ubah, jadi tidak perlu panel kedua.
  const bagAkt = el('bagianAktivasiUnit');
  if(bagAkt) bagAkt.hidden = !(bolehAturHak() && !bolehKelolaAkun());

  // PIC dokumen: rel navigasi dipangkas ke yang relevan. Beranda & Database Unit
  // selalu ada. pic-dinas/pic-sparepart menyimpan Kotak Masuk (menerima hasil
  // cetak jenis dokumennya); pic-dinas juga menyimpan Dinas Hari Ini. Selebihnya
  // (Trouble Semua Unit, dan Dinas Hari Ini untuk PIC non-dinas) disembunyikan.
  const picModul = (typeof modulPicAkun === 'function') ? modulPicAkun() : null;
  const setRel = (layar, tampil) => {
    const b = document.querySelector(`#rel button[data-layar="${layar}"]`);
    if(b) b.hidden = !tampil;
  };
  setRel('trouble', !picModul);
  setRel('dinas',   !picModul || picModul === 'dinas');
  setRel('kotak',   !picModul || picModul === 'dinas' || picModul === 'sparepart');
  // Kalau layar yang sedang terbuka baru saja disembunyikan untuk PIC, mundur
  // ke beranda supaya ia tidak menatap layar yang tombolnya sudah hilang.
  if(picModul){
    const aktif = document.querySelector('.layar.aktif');
    const layarAktif = aktif ? aktif.id.replace(/^l-/, '') : '';
    const bolehLayar = new Set(['beranda', 'unit', 'akun', 'aktivitas',
      ...(picModul === 'dinas' ? ['dinas'] : []),
      ...((picModul === 'dinas' || picModul === 'sparepart') ? ['kotak'] : [])]);
    if(layarAktif && !bolehLayar.has(layarAktif)) pindahLayar('beranda');
  }
}

/** Dijaga supaya dua panggilan yang tumpang tindih tidak jadi dua perjalanan
    ke server. Yang kedua ikut menunggu yang pertama; hasilnya sama. */
let muatUsersJalan = null;
/** Pesan gagal terakhir — biar panel Ditunjuk bisa memberi alasan spesifik
    daripada "belum ada akun aktif" yang menyesatkan. */
let muatUsersGalat = '';

async function muatUsers(){
  if(muatUsersJalan) return muatUsersJalan;
  muatUsersJalan = (async ()=>{
    // listUsers dijaga di sisi E-Logbook: admin dapat semua, admin unit dapat
    // baris yang jatuh di unitnya (pejabat/admin ikut supaya labelnya benar).
    // Peran lain dijawab 403 — jangan menyanggah, kosongkan saja daftarnya.
    try{
      const hasil = await adminApi('listUsers');
      USERS = Array.isArray(hasil) ? hasil : [];
      muatUsersGalat = '';
    }catch(e){
      USERS = [];
      muatUsersGalat = e && e.message || String(e);
      console.warn('[akun] tidak bisa memuat daftar akun:', muatUsersGalat);
    }
    USERS_JAM = USERS.length ? new Date() : null;
    await muatHakAkun();
  })();
  try{ await muatUsersJalan; } finally { muatUsersJalan = null; }
}

/** Ambil overlay hak lanjut. Non-admin dijawab 403 — jangan menyanggah,
    peta dikosongkan saja. */
async function muatHakAkun(){
  try{
    const jawab = await fetch('/hak-akun', { credentials:'include' });
    if(!jawab.ok){ HAK_AKUN = {}; return; }
    const j = await jawab.json();
    HAK_AKUN = (j && j.hakAkun && typeof j.hakAkun === 'object') ? j.hakAkun : {};
  }catch(e){
    console.warn('[akun] gagal memuat hak lanjut:', e && e.message || e);
    HAK_AKUN = {};
  }
}

/* ---------- Saringan daftar akun ----------

   Administrator dan pejabat tidak pernah punya daftar unit: perannya sudah
   memberi seluruh unit sekaligus. Karena itu menyaring "siapa saja orang
   Radtel" hanya masuk akal untuk akun teknisi, dan akun semua-unit dikumpulkan
   di pilihannya sendiri — bukan diulang di setiap unit.

   Keadaannya dibaca langsung dari elemennya, tidak disimpan di variabel
   terpisah: satu sumber kebenaran, dan tidak ada yang bisa meleset dari apa
   yang sedang terlihat di layar. */
const SARING_SEMUA_UNIT = '*';    // akun yang memegang seluruh unit
const SARING_TANPA_UNIT = '-';    // akun yang belum diberi unit apa pun

const punyaSemuaUnit = (u) => SEMUA_UNIT_PERAN.includes(u.role);

function akunLolosSaring(u){
  const unit  = el('fUnitAkun').value;
  const peran = el('fPeranAkun').value;
  const kata  = el('fCariAkun').value.trim().toLowerCase();

  if(peran && u.role !== peran) return false;
  if(kata && !`${u.username} ${u.nama || ''}`.toLowerCase().includes(kata)) return false;
  if(!unit) return true;
  if(unit === SARING_SEMUA_UNIT) return punyaSemuaUnit(u);
  if(unit === SARING_TANPA_UNIT) return !punyaSemuaUnit(u) && !(u.unit || []).length;
  return !punyaSemuaUnit(u) && (u.unit || []).includes(unit);
}

/** Isi kedua pemilih dan petak sebaran. Nilai yang sedang dipilih dipertahankan
    kalau pilihannya masih ada — daftar akun dimuat ulang cukup sering, dan
    saringan yang terlepas sendiri setiap kali hanya menjengkelkan. */
function gambarSaringAkun(){
  const isiPemilih = (id, pilihan) => {
    const s = el(id);
    const lama = s.value;
    s.innerHTML = pilihan.map(([nilai, teks]) =>
      `<option value="${esc(nilai)}">${esc(teks)}</option>`).join('');
    if([...s.options].some(o=>o.value === lama)) s.value = lama;
  };

  isiPemilih('fUnitAkun', [
    ['', T('Semua akun','All accounts')],
    ...UNIT.map(u=>[u.kode, u.nama]),
    [SARING_SEMUA_UNIT, T('Akun semua unit','All-unit accounts')],
    [SARING_TANPA_UNIT, T('Belum punya unit','No unit yet')]
  ]);
  isiPemilih('fPeranAkun', [
    ['', T('Semua','All')],
    ...PERAN_URUT.map(p=>[p, peranTampil(p)])
  ]);

  const dipilih = el('fUnitAkun').value;
  const petak = UNIT.map(u=>{
    const n = USERS.filter(x=>!punyaSemuaUnit(x) && (x.unit || []).includes(u.kode)).length;
    return [u.kode, n, u.nama, ''];
  });
  petak.push([SARING_SEMUA_UNIT, USERS.filter(punyaSemuaUnit).length,
    T('semua unit','all units'), '']);
  const buntu = USERS.filter(x=>!punyaSemuaUnit(x) && !(x.unit || []).length).length;
  if(buntu) petak.push([SARING_TANPA_UNIT, buntu, T('tanpa unit','no unit'), 'awas']);

  el('ringkasUnitAkun').innerHTML = petak.map(([kode, n, nama, rupa])=>
    `<button data-saring-unit="${esc(kode)}" class="${rupa}${
      kode === dipilih ? ' terpilih' : ''}"><b>${n}</b>${esc(nama)}</button>`).join('');
}

function gambarAkun(){
  // Admin unit boleh membuka layar untuk panel Hak, tapi tidak melewati
  // bagian pengelolaan akun. gambarHak() dipanggil terpisah supaya tetap
  // hidup untuknya.
  if(!bolehAturHak()) return;
  if(!bolehKelolaAkun()){
    gambarHak();
    gambarAktivasiUnit();
    // Admin unit tidak menerima awal.users, jadi USERS-nya kosong sampai kita
    // memintanya sendiri. Diambil satu kali di sini — kalau berhasil, tabel
    // Hak dan panel aktivasi digambar ulang supaya keduanya berisi.
    if(!USERS.length){
      muatUsers().then(()=>{ if(USERS.length){ gambarHak(); gambarAktivasiUnit(); } }).catch(()=>{});
    }
    return;
  }

  el('ketAkunSumber').textContent =
    T('Akun E-Logbook, diurus dari sini.','E-Logbook accounts, managed from here.');
  el('catatanAkun').innerHTML =
    T(`<b>Yang disentuh dan yang tidak.</b> Layar ini tidak menyimpan akun sendiri dan tidak
         membuka basis data E-Logbook. Yang dipakai hanya fungsi administrator yang memang sudah
         ada di API-nya, dipanggil lewat penerusan yang sama dengan data lainnya — jadi tidak ada
         satu berkas pun di E-Logbook yang berubah karena layar ini.
         Sandi tidak pernah bisa dibaca dari sini, hanya diganti.
         Menonaktifkan akun memutus sesinya tanpa menghilangkan apa pun; catatan logbook yang
         pernah ia input tetap tinggal, bahkan setelah akunnya dihapus.`,
        `<b>What this screen touches, and what it does not.</b> It keeps no accounts of its own and
         never opens the E-Logbook database. All it uses are the administrator functions already
         present in that API, called through the same forwarding as every other piece of data — so
         not one file in E-Logbook changes because of this screen.
         Passwords can never be read from here, only replaced.
         Deactivating an account ends its session without removing anything; the logbook entries it
         once made stay put, even after the account itself is deleted.`);

  const total = USERS.length;
  const hidup = USERS.filter(u=>u.aktif).length;
  const admin = USERS.filter(u=>u.role === 'admin' && u.aktif).length;
  const buntu = USERS.filter(u=>u.aktif && !SEMUA_UNIT_PERAN.includes(u.role) && !(u.unit||[]).length).length;

  el('ubinAkun').innerHTML = [
    [T('Akun terdaftar','Accounts Registered'), total, T('seluruh peran','all roles'), 'biru'],
    [T('Aktif','Active'), hidup, T('boleh masuk','may sign in'), 'hijau'],
    [T('Nonaktif','Deactivated'), total - hidup,
      (total - hidup) ? T('sesinya terputus','sessions ended') : T('tidak ada','none'),
      (total - hidup) ? 'kuning' : ''],
    // Administrator terakhir ditandai merah bukan karena salah, melainkan
    // karena satu kesalahan kecil pada akun itu mengunci semua orang di luar.
    [T('Administrator aktif','Active Administrators'), admin,
      admin <= 1 ? T('tinggal satu — hati-hati','only one left — take care')
                 : T('boleh mengelola akun','may manage accounts'),
      admin <= 1 ? 'merah' : '']
  ].map(([l,n,s,w])=>`<div class="ubin ${w}"><div class="label">${l}</div>
    <div class="angka">${n}</div><div class="sub">${esc(s)}</div></div>`).join('');

  el('ketAkunJam').textContent = USERS_JAM
    ? T('diambil pukul ','fetched at ') + USERS_JAM.toLocaleTimeString(LOKAL(),{hour:'2-digit',minute:'2-digit'}) : '';

  gambarSaringAkun();
  const tampil = USERS.filter(akunLolosSaring);

  const saya = String(akun.user || '').toLowerCase();
  el('tblAkun').innerHTML =
    `<thead><tr><th>Username</th><th>${T('Nama','Name')}</th><th>${T('Peran','Role')}</th>
      <th>${T('Unit logbook','Logbook units')}</th>
      <th>Status</th><th></th></tr></thead><tbody>` +
    (tampil.length ? '' : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px">${
      T('Tidak ada akun yang cocok dengan saringan ini.','No account matches this filter.')}</td></tr>`) +
    tampil.map(u=>{
      const semua = SEMUA_UNIT_PERAN.includes(u.role);
      const unit = semua
        ? `<span class="pil">${T('seluruh unit','all units')}</span>`
        : (u.unit || []).length
          ? u.unit.map(k=>`<span class="pil">${esc(namaUnit(k))}</span>`).join('')
          : `<span class="pil awas">${T('belum ada unit','no unit yet')}</span>`;
      return `<tr class="${u.aktif ? '' : 'akun-mati'}">
        <td class="mono">${esc(u.username)}${u.username.toLowerCase() === saya
          ? ` <span class="pil">${T('Anda','You')}</span>` : ''}</td>
        <td>${esc(u.nama || '—')}</td>
        <td><span class="pil ${esc(u.role)}">${esc(peranTampil(u.role))}</span></td>
        <td><div class="unit-pil">${unit}</div></td>
        <td><span class="pil ${u.aktif ? 'aktif-ya' : 'aktif-tidak'}">${
          u.aktif ? T('Aktif','Active') : T('Nonaktif','Deactivated')}</span></td>
        <td style="text-align:right"><button class="btn garis kecil" data-ubah="${esc(u.username)}">${
          T('Ubah','Edit')}</button></td>
      </tr>`;
    }).join('') + '</tbody>';

  gambarHak();

  el('awasAkun').innerHTML = buntu
    ? `<div class="catatan" style="border-left-color:var(--fail)"><b>${buntu} ${
       T('akun teknisi aktif belum punya unit.','active technician accounts have no unit.')}</b>
       ${T('Akun itu bisa masuk, tapi tidak menemukan satu pun logbook yang boleh dibukanya. Beri unitnya '
           + 'lewat tombol Ubah, atau nonaktifkan akunnya kalau memang belum dipakai.',
           'Those accounts can sign in, but will not find a single logbook they are allowed to open. '
           + 'Give them a unit through the Edit button, or deactivate them if they are not in use yet.')}</div>`
    : '';
}

/* ---------- Aktivasi akun untuk admin unit ----------

   Panel sempit yang sengaja terpisah dari Daftar Akun penuh: admin unit tidak
   menambah, menghapus, atau mengganti peran/unit. Yang boleh disentuhnya cuma
   status aktif akun teknisi yang jatuh di unitnya sendiri — pintu masuk untuk
   meloloskan pendaftar baru tanpa menunggu admin utama. Servernya memagari
   ulang lewat pastikanAdminUnitBolehAktif, jadi ini penjagaan tampilan saja. */
function admUnitBolehAktivasi(){
  return !!akun && akun.role === 'adminunit' && !akun.superadmin;
}

function gambarAktivasiUnit(){
  if(!admUnitBolehAktivasi()) return;
  const tbl = el('tblAktivasiUnit');
  if(!tbl) return;

  const lingkup = unitLingkupSaya();                 // array kode unit (admin unit tak pernah null di sini)
  const scope = Array.isArray(lingkup) ? lingkup : [];

  el('ketAktivasiUnit').textContent = USERS_JAM
    ? T('diambil pukul ','fetched at ') + USERS_JAM.toLocaleTimeString(LOKAL(),{hour:'2-digit',minute:'2-digit'}) : '';
  el('catatanAktivasiUnit').innerHTML = T(
    '<b>Meloloskan pendaftar baru.</b> Akun teknisi yang dibuat lewat pendaftaran lahir nonaktif — '
      + 'aktifkan di sini kalau memang orang unit Anda. Yang tampil hanya akun teknisi di unit yang '
      + 'Anda pegang; peran, unit, dan penghapusan tetap urusan administrator utama.',
    '<b>Letting new sign-ups through.</b> Technician accounts created via self-registration start '
      + 'deactivated — activate one here if the person is really from your unit. Only technician '
      + 'accounts in the units you hold appear; roles, units, and deletion remain the main '
      + 'administrator’s job.');

  // Teknisi yang SELURUH unitnya jatuh di dalam unit saya. Akun lintas-unit yang
  // bocor keluar cakupan tidak muncul — server pun menolaknya.
  const dalam = (u) => u.role === 'teknisi'
    && (u.unit || []).length > 0
    && (u.unit || []).every(k => scope.includes(k));
  // Nonaktif di atas: yang menunggu diaktifkan adalah alasan panel ini ada.
  const baris = USERS.filter(dalam).sort((a,b)=>
    (a.aktif === b.aktif)
      ? a.username.localeCompare(b.username)
      : (a.aktif ? 1 : -1));

  tbl.innerHTML =
    `<thead><tr><th>Username</th><th>${T('Nama','Name')}</th>
      <th>${T('Unit logbook','Logbook units')}</th><th>Status</th><th></th></tr></thead><tbody>` +
    (baris.length ? '' : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:22px">${
      USERS.length
        ? T('Belum ada akun teknisi di unit Anda.','No technician accounts in your unit yet.')
        : (muatUsersGalat
            ? T('Tidak bisa memuat daftar akun: ','Could not load accounts: ') + esc(muatUsersGalat)
            : T('Memuat daftar akun…','Loading accounts…'))}</td></tr>`) +
    baris.map(u=>{
      const unit = (u.unit || []).map(k=>`<span class="pil">${esc(namaUnit(k))}</span>`).join('');
      const ke = u.aktif ? 0 : 1;
      const label = u.aktif ? T('Nonaktifkan','Deactivate') : T('Aktifkan','Activate');
      const kelas = u.aktif ? 'btn garis kecil' : 'btn kecil';
      return `<tr class="${u.aktif ? '' : 'akun-mati'}">
        <td class="mono">${esc(u.username)}</td>
        <td>${esc(u.nama || '—')}</td>
        <td><div class="unit-pil">${unit}</div></td>
        <td><span class="pil ${u.aktif ? 'aktif-ya' : 'aktif-tidak'}">${
          u.aktif ? T('Aktif','Active') : T('Nonaktif','Deactivated')}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn garis kecil" data-ubah-unit="${esc(u.username)}">${T('Ubah','Edit')}</button>
          <button class="${kelas}" data-aktif-toggle="${esc(u.username)}"
          data-aktif-ke="${ke}">${label}</button></td>
      </tr>`;
    }).join('') + '</tbody>';
}

async function ubahAktifUnit(username, aktif, btn){
  if(btn) btn.disabled = true;
  try{
    await adminApi('setUserAktif', username, aktif);
    pesan(aktif
      ? T('Akun ' + username + ' diaktifkan.', 'Account ' + username + ' activated.')
      : T('Akun ' + username + ' dinonaktifkan.', 'Account ' + username + ' deactivated.'));
    await muatUsers();
    gambarAktivasiUnit();
    gambarHak();       // daftar Ditunjuk ikut berubah: akun nonaktif tidak muncul di sana
  }catch(e){
    pesan(T('Gagal mengubah status akun: ','Could not change the account status: ') + (e && e.message || e));
    if(btn) btn.disabled = false;
  }
}

/* Kartu ubah ringkas admin unit: nama, username, password satu teknisi. Salinan
   akun disimpan (bukan rujukan) supaya nilai asalnya bisa dibandingkan dengan
   isian saat Simpan — hanya yang berubah yang dikirim. */
let unitAkunDibuka = null;

function bukaUnitAkun(u){
  if(!u) return;
  unitAkunDibuka = { ...u };
  el('judulUnitAkun').textContent = T('Ubah teknisi unit','Edit unit technician');
  el('ketUnitAkun').textContent = u.username;
  el('uaUser').value = u.username;
  el('uaNama').value = u.nama || '';
  el('uaPass').value = '';
  el('lapisUnitAkun').classList.add('buka');
  el('uaNama').focus();
}

function tutupUnitAkun(){
  el('lapisUnitAkun').classList.remove('buka');
  unitAkunDibuka = null;
}

/* Kirim hanya yang berubah, satu panggilan per perubahan, berhenti pada
   kegagalan pertama. Rename PALING DULU — sama alasannya dengan simpanUbahan:
   langkah setelahnya merujuk akun lewat username yang berlaku saat itu, jadi
   kalau username diganti belakangan, nama/password sempat dikirim ke username
   yang keburu tidak ada. */
async function simpanUnitAkun(){
  const asal = unitAkunDibuka;
  if(!asal) return;
  const usernameBaru = el('uaUser').value.trim().toLowerCase();
  const nama = el('uaNama').value.trim();
  const pass = el('uaPass').value;

  try{
    if(!nama) throw new Error(T('Nama tampilan tidak boleh kosong.','Display name cannot be empty.'));
    if(pass && pass.length < 6) throw new Error(T('Password minimal 6 karakter.','Password must be at least 6 characters.'));
    const ganti = usernameBaru && usernameBaru !== asal.username.toLowerCase();
    if(ganti && !/^[a-z0-9._-]{3,32}$/.test(usernameBaru)){
      throw new Error(T('Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.',
                        'Username 3–32 characters: lowercase letters, digits, dots, underscores, or hyphens.'));
    }

    const kerja = [];
    if(ganti)                          kerja.push(['setUserUsername', [asal.username, usernameBaru]]);
    const kunci = ganti ? usernameBaru : asal.username;
    if(nama !== (asal.nama || ''))     kerja.push(['setUserNama', [kunci, nama]]);
    if(pass)                           kerja.push(['setUserPassword', [kunci, pass]]);

    if(!kerja.length){ pesan(T('Tidak ada yang diubah.','Nothing was changed.')); return; }

    const b = el('btnSimpanUnitAkun');
    b.disabled = true;
    try{
      for(const [fn, args] of kerja) await adminApi(fn, ...args);
      pesan(T('Perubahan tersimpan.','Changes saved.'));
      tutupUnitAkun();
      await muatUsers();
      gambarAktivasiUnit();
      gambarHak();
    }finally{
      b.disabled = false;
    }
  }catch(e){
    pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
  }
}

/* ---------- Hak tiga modul: jadwal dinas, kegiatan berkala, data personel ----

   Bentuknya matriks: baris modul, kolom peran. Administrator dicentang mati —
   terlihat, tapi tidak bisa dilepas. Kalau bisa, satu centang yang salah cukup
   untuk mengunci orang yang seharusnya membetulkannya.

   Akun nonaktif tidak ikut di daftar penunjukan: menunjuk orang yang tidak bisa
   masuk tidak berarti apa-apa. Administrator juga tidak — mereka sudah boleh
   lewat perannya, dan mencentangnya memberi kesan hak itu bisa dicabut dari
   sana, padahal tidak. */

/** Modul yang daftar penunjukan per orangnya sedang terbuka; null = tertutup. */
let hakModulDibuka = null;
/** Saringan unit di panel penunjukan. '' = semua, '*' = semua-unit,
    '-' = tanpa unit, selain itu = kode unit. Dilepas setiap ganti modul supaya
    tidak nyisa dari modul sebelumnya. */
let saringUnitPetugas = '';

function gambarHak(){
  // Admin unit boleh melihat & sedikit menyentuh. Hal-hal yang berkaitan
  // dengan pejabat/administrator dimatikan seluruhnya:
  //   - Kolom peran (admin/adminunit/teknisi) hanya dibaca — admin unit tidak
  //     boleh memutuskan peran mana yang boleh apa; itu wewenang admin utama.
  //   - Baris TTD (dinas-ttd/sparepart-ttd/sejarah-ttd) sepenuhnya diblokir
  //     karena yang bisa dipilih adalah pejabat, dan admin unit tidak boleh
  //     mencentang pejabat.
  //   - Baris peralatan (bawaan admin-only) juga tidak untuk mereka.
  // Kolom peran mati untuk semua orang juga di baris TTD (perilaku lama).
  const adminUnit = !!akun && akun.role === 'adminunit' && !akun.superadmin;
  const modulTerlarangUntukAdminUnit = (m) => m.endsWith('-ttd') || m === 'peralatan';

  el('ketPetugas').textContent = JDW.bisaTulis
    ? T('berlaku untuk seluruh dashboard ini','applies across this whole dashboard')
    : T('penyimpanan tidak permanen di lingkungan ini','storage is not permanent in this environment');
  el('btnSimpanPetugas').disabled = !JDW.bisaTulis;

  el('tblHak').innerHTML = `<thead><tr><th>${T('Modul','Module')}</th>${
    HAK_PERAN.map(p=>`<th style="text-align:center">${esc(peranTampil(p))}</th>`).join('')}
    <th style="text-align:right">${T('Ditunjuk','Named')}</th></tr></thead><tbody>${
    HAK_MODUL.map(m=>{
      const h = HAK[m];
      // Modul TTD (dinas-ttd, sparepart-ttd, sejarah-ttd) tidak dikendalikan
      // lewat peran — peran view-only "pejabat" tidak lolos ke kolom peran,
      // jadi seluruh centang peran-nya disabled. Daftar penandatangan diatur
      // lewat kolom Ditunjuk.
      const hanyaDitunjuk = m.endsWith('-ttd');
      const barisMati = adminUnit && modulTerlarangUntukAdminUnit(m);
      return `<tr${barisMati ? ' style="opacity:.5"' : ''}>
        <td><b>${esc(T(HAK_NAMA[m][0], HAK_NAMA[m][1]))}</b>${
          hanyaDitunjuk ? `<div style="font-size:10.5px;color:var(--muted);margin-top:2px">${
            T('Diatur lewat kolom Ditunjuk (pilih pejabat)','Set via the Named column (pick officers)')
          }</div>` : ''}${
          barisMati && !hanyaDitunjuk ? `<div style="font-size:10.5px;color:var(--muted);margin-top:2px">${
            T('Diatur oleh administrator','Set by the administrator')
          }</div>` : ''}</td>
        ${HAK_PERAN.map(p=>{
          const admin = p === 'admin';
          // Admin unit tidak boleh menyentuh kolom peran sama sekali — perannya
          // ditentukan administrator, bukan dari sini.
          const nonAktif = hanyaDitunjuk || admin || adminUnit;
          return `<td style="text-align:center">
            <input type="checkbox" data-hak-modul="${m}" data-hak-peran="${p}"
              ${(!hanyaDitunjuk && (admin || h.peran.includes(p))) ? ' checked' : ''}${nonAktif ? ' disabled' : ''}
              title="${admin ? T('Administrator selalu boleh','Administrators always may')
                : hanyaDitunjuk ? T('Tidak berlaku untuk modul ini','Not applicable to this module')
                : adminUnit ? T('Diatur oleh administrator','Set by the administrator') : ''}"></td>`;
        }).join('')}
        <td style="text-align:right"><button class="btn garis kecil" data-hak-petugas="${m}"${
          barisMati ? ' disabled title="' + esc(T(
            'Admin unit tidak dapat menunjuk pejabat / mengubah daftar peralatan.',
            'Unit admins cannot name officers or edit the equipment list.'
          )) + '"' : ''}>${
          h.petugas.length
            ? `${h.petugas.length} ${T('orang','people')}`
            : T('atur','set')}</button></td></tr>`;
    }).join('')}</tbody>`;

  el('tblHak').querySelectorAll('[data-hak-peran]').forEach(c=>{
    c.addEventListener('change', ()=>{
      const h = HAK[c.dataset.hakModul];
      const p = c.dataset.hakPeran;
      h.peran = c.checked ? [...new Set([...h.peran, p])] : h.peran.filter(x=>x !== p);
    });
  });
  el('tblHak').querySelectorAll('[data-hak-petugas]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const m = b.dataset.hakPetugas;
      hakModulDibuka = hakModulDibuka === m ? null : m;
      saringUnitPetugas = '';   // ganti modul = mulai lagi tanpa saringan
      gambarPetugasDinas();
    });
  });

  gambarPetugasDinas();
}

function gambarPetugasDinas(){
  const bungkus = el('bungkusPetugas');
  if(!hakModulDibuka){ bungkus.hidden = true; return; }
  bungkus.hidden = false;

  // USERS kosong bisa berarti tiga hal berbeda: belum ditarik, ditarik tapi
  // masih berjalan, atau gagal (mis. 403 karena server belum di-restart).
  // Tanpa membedakannya, pesan "belum ada akun aktif" menyesatkan admin unit
  // yang tahu benar unitnya berisi. Kalau kosong, tarik sendiri sekali —
  // gambarPetugasDinas dipanggil ulang begitu jawabannya datang.
  if(!USERS.length && bolehAturHak() && !muatUsersJalan && !muatUsersGalat){
    muatUsers().then(()=>{ if(hakModulDibuka) gambarPetugasDinas(); }).catch(()=>{});
  }

  const m = hakModulDibuka;
  // Modul TTD (dinas-ttd, sparepart-ttd, sejarah-ttd) hanya bisa diteken oleh
  // pejabat (yang punya TTD tersimpan di E-Logbook). Modul lain tetap terbuka
  // ke non-admin lain, di luar peran yang sudah dicentang. Perbedaannya kecil
  // tapi bermakna: kalau seluruh non-admin ikut, admin bisa keliru menunjuk
  // teknisi sebagai penanda-tangan padahal alurnya menuntut pejabat.
  const modulTtd = m.endsWith('-ttd');
  const lingkup = unitLingkupSaya();
  // Admin unit tidak boleh menunjuk pejabat: menandai pejabat sebagai
  // penanda-tangan atau pengisi adalah wewenang administrator, dan pejabat
  // memang bukan ranah admin unit. Kalau nama pejabat sudah pernah masuk
  // daftar (dari admin sebelumnya), server tetap menyimpannya — admin unit
  // hanya tidak bisa mengubahnya dari sini.
  const bukanAdminUtama = !!akun && akun.role === 'adminunit' && !akun.superadmin;
  // Pejabat memegang seluruh unit, jadi tetap lolos untuk admin unit apa pun.
  // Untuk lainnya, minimal satu unit orang itu harus jatuh di cakupan saya.
  const dalamLingkup = (u) => {
    if(lingkup === null) return true;
    if(bukanAdminUtama && u.role === 'pejabat') return false;
    if(punyaSemuaUnit(u)) return true;
    const uu = u.unit || [];
    return lingkup.some(k => uu.includes(k));
  };
  const calon = USERS.filter(u=>u.aktif && (modulTtd
    ? u.role === 'pejabat'
    : u.role !== 'admin') && dalamLingkup(u));
  el('ketPetugasPilih').textContent = modulTtd
    ? T(`Pejabat yang berhak menandatangani ${HAK_NAMA[m][0]}. Kosongkan semua = seluruh pejabat unit boleh (perilaku lama).`,
        `Officers authorised to sign ${HAK_NAMA[m][1]}. Leave all empty = any unit officer may (legacy behaviour).`)
    : T(`Ditunjuk khusus untuk ${HAK_NAMA[m][0]} — di luar peran yang sudah dicentang di atas`,
        `Named for ${HAK_NAMA[m][1]} — beyond the roles already ticked above`);

  /* Saringan unit — meniru pola di tabel Kelola Akun. Yang punya semua unit
     (admin/pejabat) dipisah ke bucket sendiri; kalau tidak, akun pejabat akan
     tampak di setiap unit dan angkanya menyesatkan. Pil yang jumlahnya 0
     tidak ditampilkan supaya baris ini tidak sesak dengan unit tanpa orang. */
  const ringkas = el('ringkasUnitPetugas');
  if(calon.length){
    ringkas.hidden = false;
    // Kalau saya admin unit, unit di luar cakupan tidak boleh muncul sebagai
    // pil — bukan sekadar nol, tapi memang tidak ada dari kacamata saya.
    const unitTampil = lingkup === null ? UNIT : UNIT.filter(u => lingkup.includes(u.kode));
    const petak = unitTampil
      .map(u=>[u.kode, calon.filter(x=>!punyaSemuaUnit(x) && (x.unit || []).includes(u.kode)).length, u.nama, ''])
      .filter(([,n])=>n > 0);
    const nSemua = calon.filter(punyaSemuaUnit).length;
    if(nSemua) petak.push([SARING_SEMUA_UNIT, nSemua, T('semua unit','all units'), '']);
    const nBuntu = calon.filter(x=>!punyaSemuaUnit(x) && !(x.unit || []).length).length;
    if(nBuntu) petak.push([SARING_TANPA_UNIT, nBuntu, T('tanpa unit','no unit'), 'awas']);

    // Kalau saringan yang aktif tidak ada di daftar (misal unitnya kosong
    // setelah calon berubah), lepas — jangan ditinggal menampilkan kosongan.
    if(saringUnitPetugas && !petak.some(([k])=>k === saringUnitPetugas)) saringUnitPetugas = '';

    ringkas.innerHTML = petak.map(([kode, n, nama, rupa])=>
      `<button data-saring-unit-petugas="${esc(kode)}" class="${rupa}${
        kode === saringUnitPetugas ? ' terpilih' : ''}"><b>${n}</b>${esc(nama)}</button>`).join('');
  } else {
    ringkas.hidden = true;
    ringkas.innerHTML = '';
  }

  const cocokUnit = (u)=>{
    if(!saringUnitPetugas) return true;
    if(saringUnitPetugas === SARING_SEMUA_UNIT) return punyaSemuaUnit(u);
    if(saringUnitPetugas === SARING_TANPA_UNIT) return !punyaSemuaUnit(u) && !(u.unit || []).length;
    return !punyaSemuaUnit(u) && (u.unit || []).includes(saringUnitPetugas);
  };
  const tampil = calon.filter(cocokUnit);

  const pesanKosong = () => {
    if(tampil.length) return '';
    if(calon.length) return T('Tidak ada akun di unit ini.','No accounts in this unit.');
    if(muatUsersJalan) return T('Memuat daftar akun…','Loading accounts…');
    if(!USERS.length && muatUsersGalat){
      return T('Tidak bisa memuat daftar akun: ','Could not load accounts: ') + esc(muatUsersGalat);
    }
    return T('Belum ada akun aktif selain administrator.','No active accounts other than administrators yet.');
  };
  /* Petugas hantu — nama yang masih tercantol di HAK[m].petugas tapi tidak
     muncul di daftar aktif: akunnya sudah dinonaktifkan, perannya berubah
     (mis. jadi admin), atau akunnya dihapus. Tanpa ditampilkan, tombolnya
     tetap menghitung "N orang" padahal admin tidak bisa melihat siapa mereka
     untuk melepas. Hanya digambar saat saringan unit kosong dan daftar akun
     sudah termuat — kalau USERS belum datang, hampir semua nama akan tampak
     "hantu" secara semu. */
  const cariUser = (nm) => USERS.find(u => u.username.toLowerCase() === nm);
  const usersSiap = USERS.length > 0 && !muatUsersJalan;
  const namaTampilSet = new Set(tampil.map(u => u.username.toLowerCase()));
  let hantu = [];
  if(!saringUnitPetugas && usersSiap){
    hantu = (HAK[m].petugas || []).filter(nm => !namaTampilSet.has(nm));
    // Admin unit tidak boleh menyunting petugas di luar lingkupnya. Kalau nama
    // hantu tidak dikenal (akun dihapus) atau di luar lingkup, sembunyikan —
    // yang berhak membersihkannya administrator utama.
    if(bukanAdminUtama){
      hantu = hantu.filter(nm => { const u = cariUser(nm); return u && dalamLingkup(u); });
    }
  }
  const bagianTampil = tampil.map(u=>{
    const nama = u.username.toLowerCase();
    // Yang sudah boleh lewat perannya tetap ditampilkan, tapi redup dan
    // mati: mencentangnya tidak menambah apa pun, dan melepasnya tidak
    // mencabut apa pun — dua-duanya hanya menyesatkan.
    const lewatPeran = HAK[m].peran.includes(u.role);
    const dicentang = lewatPeran || HAK[m].petugas.includes(nama);
    return `<label${lewatPeran ? ' style="opacity:.55"' : ''}>
      <input type="checkbox" value="${esc(nama)}"${dicentang?' checked':''}${lewatPeran?' disabled':''}>
      ${esc(u.nama || u.username)} <span class="mono" style="color:var(--muted);font-size:11px">${
        esc(u.username)}${lewatPeran ? ' · ' + esc(T('lewat peran','via role')) : ''}</span></label>`;
  }).join('');
  const bagianHantu = hantu.map(nm=>{
    const u = cariUser(nm);
    const nama = u ? (u.nama || u.username) : nm;
    const status = u
      ? (u.aktif ? T('peran/unit tidak cocok lagi','role/unit no longer matches')
                 : T('akun nonaktif','account inactive'))
      : T('akun tidak dikenal','account not found');
    return `<label style="opacity:.7" title="${esc(T(
      'Masih tercantol di daftar tapi tak muncul di saringan aktif — lepas centang untuk membersihkan.',
      'Still on the list but does not fit the active filter — untick to clean up.'))}">
      <input type="checkbox" value="${esc(nm)}" checked>
      ${esc(nama)} <span class="mono" style="color:var(--muted);font-size:11px">${
        esc(nm)} · ${esc(status)}</span></label>`;
  }).join('');
  el('daftarPetugas').innerHTML = (bagianTampil + bagianHantu)
    || `<span style="color:var(--muted);font-size:12px">${pesanKosong()}</span>`;

  el('daftarPetugas').querySelectorAll('input[type=checkbox]').forEach(c=>{
    c.addEventListener('change', ()=>{
      const h = HAK[m];
      h.petugas = c.checked
        ? [...new Set([...h.petugas, c.value])]
        : h.petugas.filter(x=>x !== c.value);
      // Angka di tombolnya ikut berubah tanpa menunggu disimpan — kalau tidak,
      // tidak ada tanda sama sekali bahwa centangnya tercatat.
      const tombol = el('tblHak').querySelector(`[data-hak-petugas="${m}"]`);
      if(tombol) tombol.textContent = h.petugas.length
        ? `${h.petugas.length} ${T('orang','people')}` : T('atur','set');
    });
  });

  // Klik pil unit untuk menyaring; klik lagi pil yang sedang aktif untuk
  // melepasnya — tanpa itu, tidak ada jalan pulang ke "semua unit".
  ringkas.querySelectorAll('button[data-saring-unit-petugas]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const k = b.dataset.saringUnitPetugas;
      saringUnitPetugas = saringUnitPetugas === k ? '' : k;
      gambarPetugasDinas();
    });
  });
}

el('btnTutupPetugas').addEventListener('click', ()=>{
  hakModulDibuka = null;
  saringUnitPetugas = '';
  gambarPetugasDinas();
});

el('btnSimpanPetugas').addEventListener('click', async ()=>{
  const b = el('btnSimpanPetugas');
  b.disabled = true;
  try{
    await hakSimpan();
    gambarHak();
    // Tombol sunting di jadwal dinas dan kegiatan berkala ikut berubah kalau
    // yang barusan disunting adalah peran akun ini sendiri.
    if(unitDibuka) gambarUnit();
    pesan(T('Hak modul tersimpan.','Module permissions saved.'));
  }catch(e){
    pesan(T('Gagal menyimpan hak: ','Could not save the permissions: ') + (e && e.message || e));
  }finally{
    b.disabled = false;
  }
});

/* ---------- Kartu ubah / tambah ---------- */

const unitTercentang = () =>
  [...el('aUnit').querySelectorAll('input:checked')].map(c=>c.value);

function segarkanUnitKartu(){
  const semua = SEMUA_UNIT_PERAN.includes(el('aRole').value);
  // Administrator dan pejabat memegang seluruh unit lewat perannya, jadi kotak
  // ini bukan pagar akses buat mereka — melainkan tanda "tampilkan nama saya
  // sebagai teknisi di unit ini" pada isian nama teknisi di formulir. Kotak
  // tetap boleh diklik supaya opt-in itu bisa diatur dari sini.
  el('aUnit').classList.toggle('mati', false);
  el('aUnitKet').textContent = semua
    ? T('Administrator dan pejabat sudah otomatis membuka seluruh unit lewat perannya. Centang di sini hanya berarti “tampilkan nama saya sebagai saran teknisi di unit ini” — dipakai pada isian nama teknisi di formulir. Kosong berarti tidak tampil sebagai saran di unit mana pun; akses tetap penuh.',
        'Administrators and officers already hold every unit through their role. Ticks here only mean “show my name as a technician suggestion in this unit” — used on the technician-name field in forms. Empty means no suggestions anywhere; access stays full.')
    : T('Teknisi harus punya minimal satu unit. Tanpa itu akunnya bisa masuk tapi tidak bisa membuka apa pun.',
        'A technician must hold at least one unit. Without one the account can sign in but cannot open anything.');
}

function isiKartuAkun(u){
  const baru = !u;
  // Disalin, bukan dipakai langsung: nilai asli ini yang nanti dibandingkan
  // dengan isi kolom untuk menentukan apa saja yang benar-benar perlu dikirim.
  akunDibuka = u ? { ...u, unit: [...(u.unit || [])] } : null;

  const diri = !baru && u.username.toLowerCase() === String(akun.user || '').toLowerCase();
  const role = baru ? 'teknisi' : u.role;

  // Akun super-admin hanya boleh disunting sesama super-admin. Admin biasa
  // yang membuka kartu ini melihat isian dalam keadaan terkunci — server
  // menolak permintaannya lewat pastikanBolehUbahTarget, tapi mengunci di
  // sini menghindari kejutan (klik Simpan → 403).
  const targetSuperadmin = !baru && !!u.superadmin;
  const kunciSuperadmin = targetSuperadmin && !akuSuperadmin();

  el('judulKartuAkun').textContent = baru ? T('Tambah akun','Add account') : T('Ubah akun','Edit account');
  el('ketKartuAkun').textContent   = baru
    ? T('akun baru di E-Logbook','new account in E-Logbook') : u.username;
  el('btnSimpanAkun').textContent  = baru ? T('Buat akun','Create account') : T('Simpan perubahan','Save changes');
  el('btnSimpanAkun').disabled     = kunciSuperadmin;

  // Super-admin (penanda orthogonal terhadap peran) boleh hapus langsung —
  // tanpa jalur "nonaktifkan dulu". Untuk peran admin biasa, dua langkah tetap
  // berlaku sebagai jaring pengaman. Kalau target-nya masih aktif tapi yang
  // membuka super-admin, tombol tetap tampil dengan peringatan tegas.
  const bolehLangsung = akuSuperadmin();
  // Guard `!!u` — kartu tambah-baru memanggil dengan u=null; nilai ini
  // toh cuma dipakai oleh kotakHapus yang di-skip saat baru.
  const perluDuaLangkah = !!u && u.aktif && !bolehLangsung;
  const kotakHapus = (!baru && !diri && !kunciSuperadmin) ? `
    <div class="bahaya">
      <div class="jdl">${T('Hapus akun','Delete account')}${
        bolehLangsung && u.aktif ? ` <span class="pil" style="background:var(--fail);color:#fff">${
          T('Super Admin','Super Admin')}</span>` : ''}</div>
      <p>${perluDuaLangkah
        ? T('Hanya akun yang sudah nonaktif yang boleh dihapus. Nonaktifkan dulu lewat kolom Status di atas, simpan, lalu buka kartu ini lagi.',
            'Only a deactivated account may be deleted. Set Status above to deactivated, save, then open this card again.')
        : (bolehLangsung && u.aktif
          ? T('Sebagai super-admin Anda boleh langsung menghapus akun yang masih aktif — sesinya diputus dan datanya hilang seketika. Tidak bisa dibatalkan. Catatan logbook yang pernah diinput akun ini tetap tinggal di E-Logbook. Ketik ulang usernamenya untuk membuka tombol.',
              'As super-admin you may delete an active account outright — its session ends and its data goes at once. This cannot be undone. The logbook entries this account once made stay in E-Logbook. Type the username again to unlock the button.')
          : T('Tidak bisa dibatalkan. Catatan logbook yang pernah diinput akun ini tetap tinggal di E-Logbook — yang hilang hanya akunnya. Ketik ulang usernamenya untuk membuka tombol.',
              'This cannot be undone. The logbook entries this account once made stay in E-Logbook — only the account itself goes. Type the username again to unlock the button.'))}</p>
      ${perluDuaLangkah ? '' : `<input id="aHapusKetik" autocomplete="off" spellcheck="false" placeholder="${
        T('ketik','type')}: ${esc(u.username)}">
      <button class="btn bahaya-tombol" id="btnHapusAkun" disabled>${
        T('Hapus akun ini','Delete this account')}</button>`}
    </div>` : '';

  const bannerKunci = kunciSuperadmin ? `
    <div class="bahaya" style="margin-bottom:14px">
      <div class="jdl">${T('Akun Super-Admin — terkunci','Super-admin account — locked')}</div>
      <p>${T('Akun super-admin hanya boleh disunting oleh sesama super-admin. Isian di bawah dibiarkan hanya untuk dibaca; tombol Simpan dan seluruh tombol aksi tidak aktif.',
             'Super-admin accounts may only be edited by another super-admin. The fields below are read-only; the Save button and all action buttons are disabled.')}</p>
    </div>` : '';

  el('badanKartuAkun').innerHTML = bannerKunci + `
    <div class="isian"><label for="aUser">Username</label>
      <input id="aUser" autocomplete="off" spellcheck="false"
        value="${baru ? '' : esc(u.username)}"
        ${diri || kunciSuperadmin ? 'disabled' : ''}
        placeholder="${T('mis. budi.santoso','e.g. budi.santoso')}">
      <div class="bantu">${diri
        ? T('Ini akun Anda sendiri. Username tidak bisa diganti dari akun sendiri — minta admin '
            + 'lain kalau memang perlu.',
            'This is your own account. Its username cannot be changed from itself — ask another '
            + 'admin if it must be renamed.')
        : baru
          ? T('3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.',
              '3–32 characters: lowercase letters, digits, dots, underscores, or hyphens.')
          : T('3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip. '
              + 'Kalau diganti, sesi akun ini tetap hidup (yang berpindah cuma namanya), tetapi '
              + 'hak petugas modul yang mungkin ditetapkan lewat username lama harus diperiksa '
              + 'ulang.',
              '3–32 characters: lowercase letters, digits, dots, underscores, or hyphens. '
              + 'If it changes, the account’s session stays alive (only its name moves), but any '
              + 'module-petugas rights that referenced the old username should be reviewed.')}</div></div>

    <div class="isian"><label for="aNama">${T('Nama tampilan','Display name')}</label>
      <input id="aNama" autocomplete="off" value="${baru ? '' : esc(u.nama || '')}"
        placeholder="${T('nama yang muncul di logbook','the name that appears in the logbook')}">
      <div class="bantu">${T('Nama inilah yang dicocokkan E-Logbook saat menunjuk penerima tanda '
        + 'tangan susulan — mengganti sebutan jabatan cukup di sini, tanpa akun baru.',
        'This is the name E-Logbook matches when naming who must counter-sign — changing a job title '
        + 'is done here, without creating a new account.')}</div></div>

    <div class="isian"><label for="aRole">${T('Peran','Role')}</label>
      <select id="aRole"${diri ? ' disabled' : ''}>
        <option value="teknisi">${T('Teknisi — menyunting database unitnya, tidak menghapus',
          'Technician — edits their own unit database, cannot delete')}</option>
        <option value="adminunit">${T('Admin Unit — menyunting DAN menghapus, serta membaca log aktivitas, di unitnya saja',
          'Unit Admin — edits AND deletes, and reads the activity log, in their own unit only')}</option>
        <option value="pic-dinas">${T('PIC Jadwal Dinas — hanya Jadwal Dinas semua unit; edit & cetak, tidak menghapus',
          'Duty Roster PIC — Duty Roster only, all units; edit & print, cannot delete')}</option>
        <option value="pic-sparepart">${T('PIC Sparepart — hanya Sparepart semua unit; edit & cetak, tidak menghapus',
          'Spare Parts PIC — Spare Parts only, all units; edit & print, cannot delete')}</option>
        <option value="pic-isr">${T('PIC ISR — hanya ISR semua unit; edit, tidak menghapus',
          'ISR PIC — ISR only, all units; edit, cannot delete')}</option>
        <option value="pejabat">${T('Pejabat — melihat seluruh unit, hanya membubuhkan tanda tangan',
          'Officer — sees every unit, may only sign')}</option>
        <option value="admin">${T('Administrator — kendali penuh, termasuk mengelola akun',
          'Administrator — full control, including account management')}</option>
      </select>
      ${diri ? `<div class="bantu">${T('Ini akun Anda sendiri. Perannya tidak bisa diturunkan sendiri — '
        + 'kalau tidak, administrator terakhir bisa mengunci dirinya di luar.',
        'This is your own account. Its role cannot be lowered by itself — otherwise the last '
        + 'administrator could lock themselves out.')}</div>` : ''}</div>

    <div class="isian"><label>${T('Unit logbook','Logbook units')}</label>
      <div class="kotak-unit" id="aUnit">${UNIT.map(x=>
        `<label><input type="checkbox" value="${esc(x.kode)}"${
          (!baru && (u.unit || []).includes(x.kode)) ? ' checked' : ''}>${esc(x.nama)}</label>`).join('')}</div>
      <div class="bantu" id="aUnitKet"></div></div>

    <div class="isian"><label for="aAktif">Status</label>
      <select id="aAktif"${(baru || diri) ? ' disabled' : ''}>
        <option value="1">${T('Aktif — boleh masuk','Active — may sign in')}</option>
        <option value="0">${T('Nonaktif — sesinya terputus, tidak bisa masuk',
          'Deactivated — session ends, cannot sign in')}</option>
      </select>
      <div class="bantu">${diri ? T('Akun sendiri tidak bisa dinonaktifkan.','Your own account cannot be deactivated.')
        : baru ? T('Akun baru langsung aktif.','A new account is active immediately.')
        : T('Menonaktifkan tidak menghapus apa pun — catatan yang pernah diinput akun ini tetap ada.',
            'Deactivating removes nothing — the entries this account made stay where they are.')}</div></div>

    <div class="isian"><label for="aPass">${baru ? T('Password awal','Initial password')
                                                 : T('Ganti password','Change password')}</label>
      <input type="password" id="aPass" autocomplete="new-password"
        placeholder="${baru ? T('minimal 6 karakter','at least 6 characters')
                            : T('kosongkan bila tidak diganti','leave empty to keep it')}">
      <div class="bantu">${
        T('Password lama tidak bisa dilihat dari mana pun, termasuk dari sini — yang tersimpan di '
          + 'E-Logbook hanya sidik acaknya.',
          'The old password cannot be read from anywhere, this screen included — E-Logbook stores '
          + 'only its hash.')}</div></div>

    ${kotakLanjut(baru, u)}
    ${kotakHapus}`;

  el('aRole').value = role;
  if(!baru) el('aAktif').value = u.aktif ? '1' : '0';
  el('aRole').addEventListener('change', segarkanUnitKartu);
  segarkanUnitKartu();

  /* Kunci super-admin: matikan semua isian, dropdown, dan tombol aksi di
     kartu — pengecualian tombol Batal (di kepala kartu, di luar badan). */
  if(kunciSuperadmin){
    el('badanKartuAkun').querySelectorAll('input, select, textarea, button')
      .forEach(x => { x.disabled = true; });
  }

  // Tombol hapus baru hidup setelah usernamenya diketik ulang persis. Kotak
  // centang atau satu klik "yakin?" terlalu mudah ditekan tanpa dibaca.
  const ketik = el('aHapusKetik');
  if(ketik){
    ketik.addEventListener('input', ()=>{
      el('btnHapusAkun').disabled = ketik.value.trim().toLowerCase() !== u.username.toLowerCase();
    });
    el('btnHapusAkun').addEventListener('click', ()=>hapusAkun(u.username));
  }
}

/* Kotak "Wewenang Detail" — overlay hak lanjut per akun. Hanya muncul
   untuk akun yang sudah ada (bukan tambah baru): sebelum akunnya
   tersimpan tidak ada tempat untuk menempelkan overlay-nya. */
function kotakLanjut(baru, u){
  if(baru) return '';
  const hak = HAK_AKUN[u.username.toLowerCase()] || {};
  const unitKhusus = Array.isArray(hak.unitKhusus) ? hak.unitKhusus : [];
  const bolehTtd   = Array.isArray(hak.bolehTtd)   ? hak.bolehTtd   : [];
  return `
    <div class="isian" style="padding-top:10px;border-top:1px dashed var(--garis)">
      <label>${T('Wewenang Detail (opsional)','Detailed Permissions (optional)')}</label>
      <div class="bantu">${T(
        'Menyempurnakan peran, bukan menggantikannya. Biarkan kosong = akun ini ikut aturan perannya seperti biasa. Berguna untuk mempersempit akses satu-dua akun tertentu tanpa membuat peran baru.',
        `Refines the role, does not replace it. Leave empty = the account follows its role's normal rules. Useful for narrowing one or two specific accounts without inventing a new role.`)}</div>
    </div>
    <div class="isian">
      <label>${T('Unit yang boleh dilihat (khusus akun ini)',
                  'Units this account may see (override)')}</label>
      <div class="kotak-unit" id="aUnitKhusus">${UNIT.map(x=>
        `<label><input type="checkbox" value="${esc(x.kode)}"${
          unitKhusus.includes(x.kode) ? ' checked' : ''}>${esc(x.nama)}</label>`).join('')}</div>
      <div class="bantu">${T(
        'Kosong = pakai unit dari peran (untuk pejabat/admin = semua unit; untuk teknisi = unit yang dipilih di atas). Beri centang di sini kalau akun ini hanya boleh melihat subset tertentu.',
        'Empty = use the units from the role (officers/admin see all; technicians see the units chosen above). Tick here only if this account should be limited to a specific subset.')}</div>
    </div>
    <div class="isian">
      <label>${T('Boleh menandatangani dokumen jenis','May sign document types')}</label>
      <div class="kotak-unit" id="aBolehTtd">${HAK_LANJUT_JENIS_TTD.map(([kode, id, en])=>
        `<label><input type="checkbox" value="${esc(kode)}"${
          bolehTtd.includes(kode) ? ' checked' : ''}>${esc(T(id, en))}</label>`).join('')}</div>
      <div class="bantu">${T(
        'Hanya berlaku untuk peran pejabat. Kosong = boleh menandatangani seluruh jenis (bawaan). Beri centang untuk membatasi akun pejabat ini ke jenis tertentu — mis. hanya Sparepart untuk officer Sparepart, hanya Jadwal Dinas untuk Manajer Teknik, hanya Sejarah Peralatan untuk officer Peralatan.',
        'Applies to the officer role. Empty = may sign every document type (default). Tick to restrict this officer account to specific types — e.g. only Spare Parts for a Spare-Parts officer, only Duty Roster for the Technical Manager, only Equipment History for an Equipment officer.')}</div>
    </div>`;
}

function bukaKartuAkun(u){
  isiKartuAkun(u);
  el('lapisAkun').classList.add('buka');
  (el('aUser') || el('aNama')).focus();
}

function tutupKartuAkun(){
  el('lapisAkun').classList.remove('buka');
  akunDibuka = null;
}

async function buatAkunBaru(){
  const username = el('aUser').value.trim().toLowerCase();
  const nama     = el('aNama').value.trim();
  const role     = el('aRole').value;
  const password = el('aPass').value;
  const unit     = unitTercentang();

  if(!/^[a-z0-9._-]{3,32}$/.test(username)){
    throw new Error('Username 3–32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip.');
  }
  if(!nama) throw new Error('Nama tampilan belum diisi.');
  if(password.length < 6) throw new Error('Password minimal 6 karakter.');
  if(!SEMUA_UNIT_PERAN.includes(role) && !unit.length){
    throw new Error('Pilih minimal satu unit logbook untuk akun teknisi.');
  }

  await adminApi('addUser', { username, password, nama, role, unit });
  pesan(T('Akun ' + username + ' dibuat.', 'Account ' + username + ' created.'));
}

/**
 * Kirim hanya yang benar-benar berubah, satu panggilan per perubahan.
 *
 * Urutannya disengaja. Peran lebih dulu, karena syarat unit di server
 * ditentukan oleh peran yang berlaku saat itu; unit menyusul; password paling
 * akhir, supaya kalau ada langkah yang gagal di tengah, yang belum sempat
 * terkirim adalah yang paling tidak menyusahkan untuk diulang.
 */
async function simpanUbahan(asal){
  const usernameBaru = el('aUser').value.trim().toLowerCase();
  const nama  = el('aNama').value.trim();
  const role  = el('aRole').value;
  const aktif = el('aAktif').value === '1';
  const pass  = el('aPass').value;
  const unit  = unitTercentang();
  const semua = SEMUA_UNIT_PERAN.includes(role);

  if(!nama) throw new Error('Nama tampilan tidak boleh kosong.');
  if(pass && pass.length < 6) throw new Error('Password minimal 6 karakter.');
  if(!semua && !unit.length) throw new Error('Akun teknisi harus punya minimal satu unit logbook.');
  const gantiUsername = usernameBaru && usernameBaru !== asal.username.toLowerCase();
  if(gantiUsername && !/^[a-z0-9._-]{3,32}$/.test(usernameBaru)){
    throw new Error('Username 3–32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip.');
  }

  // Baris user_unit dulu cuma dipakai untuk peran non-semua-unit (pagar akses).
  // Sekarang admin dan pejabat memakai baris yang sama sebagai opt-in "muncul
  // sebagai saran teknisi di unit ini" — akses mereka tetap penuh lewat peran,
  // yang berubah hanya isian nama teknisi di formulir. Karena itu setUserUnit
  // ikut dikirim untuk semua peran begitu daftar centangnya berbeda.
  const asalSemua = SEMUA_UNIT_PERAN.includes(asal.role);

  /* Rename dijalankan PALING DULU — server-side setUsername mengubah kolom
     dibuat_oleh/ttd_oleh di seluruh catatan sekaligus, dan seluruh langkah lain
     merujuk akun lewat username yang berlaku SAAT permintaan berangkat. Kalau
     rename ditaruh di belakang, langkah-langkah sebelumnya menaruh perubahan
     memakai username lama, lalu rename memutus rujukan itu di sisi klien. */
  const kerja = [];
  if(gantiUsername)                                  kerja.push(['setUserUsername', [asal.username, usernameBaru]]);
  const kunci = gantiUsername ? usernameBaru : asal.username;
  if(role !== asal.role)                             kerja.push(['setUserRole', [kunci, role]]);
  if(!samaIsi(unit, asal.unit || []))                kerja.push(['setUserUnit', [kunci, unit]]);
  if(nama !== (asal.nama || ''))                     kerja.push(['setUserNama', [kunci, nama]]);
  if(aktif !== !!asal.aktif)                         kerja.push(['setUserAktif', [kunci, aktif]]);
  if(pass)                                           kerja.push(['setUserPassword', [kunci, pass]]);

  /* Hak lanjut (unit khusus, boleh TTD jenis) — disimpan LANGSUNG ke
     endpoint dashboard, tidak lewat adminApi (yang bicara ke E-Logbook).
     Gagal di sini bukan gagal menyimpan perubahan utama, jadi diperlakukan
     terpisah dari antrean kerja E-Logbook.

     Bandingkan dengan overlay yang sedang tersimpan supaya pesan "Tidak ada
     yang diubah" tidak menelan perubahan-hanya-checkbox (dulu terjadi:
     pemeriksaan itu jalan sebelum kirimLanjut ditambahkan, jadi centang
     bolehTtd yang berdiri sendiri tidak pernah terkirim). */
  const unitKhusus = [...el('aUnitKhusus').querySelectorAll('input:checked')].map(c=>c.value);
  const bolehTtd = [...el('aBolehTtd').querySelectorAll('input:checked')].map(c=>c.value);
  const usernameLanjut = gantiUsername ? usernameBaru : asal.username;
  const hakSebelum = HAK_AKUN[asal.username.toLowerCase()] || {};
  const unitKhususSebelum = Array.isArray(hakSebelum.unitKhusus) ? hakSebelum.unitKhusus : [];
  const bolehTtdSebelum   = Array.isArray(hakSebelum.bolehTtd)   ? hakSebelum.bolehTtd   : [];
  const hakLanjutBerubah = gantiUsername
    || !samaIsi(unitKhusus, unitKhususSebelum)
    || !samaIsi(bolehTtd, bolehTtdSebelum);

  if(!kerja.length && !hakLanjutBerubah){
    pesan(T('Tidak ada yang diubah.','Nothing was changed.')); return;
  }

  /* Antrean ini berhenti pada kegagalan pertama, dan memang harus begitu —
     langkah berikutnya berangkat dari keadaan yang gagal dibuat langkah
     sebelumnya. Yang tidak boleh adalah berhentinya diam-diam.

     Pernah terjadi persis begitu: setUserRole menolak peran yang belum dikenal
     E-Logbook, antreannya putus di situ, dan setUserUnit yang menyusul tidak
     pernah berjalan. Yang terbaca di layar cuma "Role tidak dikenal." — tidak
     ada yang mengatakan bahwa unitnya ikut tidak tersimpan, jadi selama
     berhari-hari orangnya mengira unitnya sudah pindah padahal belum. */
  const NAMA_LANGKAH = {
    setUserUsername: T('username','username'),
    setUserRole:     T('peran','role'),
    setUserUnit:     T('unit','unit'),
    setUserNama:     T('nama','name'),
    setUserAktif:    T('status aktif','active status'),
    setUserPassword: T('password','password'),
    hakLanjut:       T('wewenang detail','detailed permissions')
  };
  const sebut = (daftar) => daftar.map(([fn]) => NAMA_LANGKAH[fn] || fn).join(', ');

  const kirimLanjut = async ()=>{
    const jawab = await fetch(`/hak-akun/${encodeURIComponent(usernameLanjut)}`, {
      method:'PUT', credentials:'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitKhusus, bolehTtd, bolehModul:{} })
    });
    if(!jawab.ok){
      const j = await jawab.json().catch(()=>({}));
      throw new Error(j.error || `HTTP ${jawab.status}`);
    }
  };
  if(hakLanjutBerubah) kerja.push(['hakLanjut', kirimLanjut]);

  for(let i = 0; i < kerja.length; i++){
    const [fn, args] = kerja[i];
    try{
      if(fn === 'hakLanjut') await args();
      else await adminApi(fn, ...args);
    }catch(e){
      const gagal = NAMA_LANGKAH[fn] || fn;
      const tersimpan = kerja.slice(0, i);
      const belum = kerja.slice(i + 1);
      const potong = [
        T('Gagal menyimpan ' + gagal + ': ', 'Could not save the ' + gagal + ': ') + (e && e.message || e),
        tersimpan.length
          ? T('Yang sudah tersimpan: ' + sebut(tersimpan) + '.',
              'Already saved: ' + sebut(tersimpan) + '.')
          : T('Belum ada satu pun perubahan yang tersimpan.','Nothing has been saved yet.'),
        belum.length
          ? T('Yang BELUM tersimpan dan perlu diulang: ' + sebut(belum) + '.',
              'NOT saved and needs retrying: ' + sebut(belum) + '.')
          : ''
      ].filter(Boolean).join(' ');
      throw new Error(potong);
    }
  }
  // Setelah rename E-Logbook berhasil, pindahkan hak dashboard (daftar Ditunjuk
  // + overlay) dari username lama ke baru. Sengaja DI LUAR antrean yang fatal:
  // rename-nya sudah tersimpan, dan kalaupun pemindahan ini gagal, yang nyangkut
  // tetap bisa dibersihkan tangan di layar Hak Akses (tampil sebagai "hantu").
  // Jadi kegagalannya tidak boleh membuat rename yang sukses tampak gagal.
  if(gantiUsername){
    try{ await hakRenameKirim(asal.username, usernameBaru); }
    catch(e){ console.warn('Pindah hak setelah rename gagal (bisa dibersihkan manual di Hak Akses):', e); }
  }

  pesan(T(kerja.length + ' perubahan tersimpan untuk ' + asal.username + '.',
          kerja.length + ' change(s) saved for ' + asal.username + '.'));
}

/** Pindahkan hak dashboard dari username lama ke baru (server yang mengerjakan).
    Lihat POST /hak/rename di server.js. */
async function hakRenameKirim(lama, baru){
  const jawab = await fetch('/hak/rename', {
    method:'POST', credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ lama, baru })
  });
  if(!jawab.ok){
    const j = await jawab.json().catch(()=>({}));
    throw new Error(j.error || `HTTP ${jawab.status}`);
  }
}

async function simpanAkun(){
  const btn = el('btnSimpanAkun');
  const teksAsli = btn.textContent;
  btn.disabled = true;
  btn.textContent = T('Menyimpan...','Saving...');
  try{
    if(akunDibuka) await simpanUbahan(akunDibuka);
    else           await buatAkunBaru();
    await muatUsers();
    gambarAkun();
    tutupKartuAkun();
  }catch(e){
    // Kartunya sengaja dibiarkan terbuka: isian yang sudah diketik tidak boleh
    // hilang hanya karena satu syarat belum terpenuhi.
    console.error('Gagal menyimpan akun:', e);
    pesan(T('Gagal: ','Failed: ') + (e && e.message || e));
  }finally{
    btn.disabled = false;
    btn.textContent = teksAsli;
  }
}

async function hapusAkun(username){
  const btn = el('btnHapusAkun');
  btn.disabled = true;
  btn.textContent = T('Menghapus...','Deleting...');
  try{
    await adminApi('deleteUser', username);
    await muatUsers();
    gambarAkun();
    tutupKartuAkun();
    pesan(T('Akun ' + username + ' dihapus. Catatan logbooknya tetap ada.',
      'Account ' + username + ' deleted. Its logbook entries remain.'));
  }catch(e){
    console.error('Gagal menghapus akun:', e);
    pesan(T('Gagal menghapus: ','Delete failed: ') + (e && e.message || e));
    btn.disabled = false;
    btn.textContent = T('Hapus akun ini','Delete this account');
  }
}

el('tblAkun').addEventListener('click', e=>{
  const b = e.target.closest('button[data-ubah]'); if(!b) return;
  const u = USERS.find(x=>x.username === b.dataset.ubah);
  if(u) bukaKartuAkun(u);
});
el('btnTambahAkun').addEventListener('click', ()=>bukaKartuAkun(null));

// Panel aktivasi admin unit: tombol Ubah (nama/username/password) dan tombol
// aktif/nonaktif per baris.
el('tblAktivasiUnit').addEventListener('click', e=>{
  const ubah = e.target.closest('button[data-ubah-unit]');
  if(ubah){
    const u = USERS.find(x=>x.username === ubah.dataset.ubahUnit);
    if(u) bukaUnitAkun(u);
    return;
  }
  const b = e.target.closest('button[data-aktif-toggle]'); if(!b) return;
  ubahAktifUnit(b.dataset.aktifToggle, b.dataset.aktifKe === '1', b);
});
el('btnBatalUnitAkun').addEventListener('click', tutupUnitAkun);
el('btnSimpanUnitAkun').addEventListener('click', simpanUnitAkun);
el('lapisUnitAkun').addEventListener('click', e=>{ if(e.target === el('lapisUnitAkun')) tutupUnitAkun(); });
el('btnSegarAktivasiUnit').addEventListener('click', async ()=>{
  const b = el('btnSegarAktivasiUnit');
  b.disabled = true;
  try{ await muatUsers(); gambarAktivasiUnit(); pesan(T('Daftar akun dimuat ulang.','Account list reloaded.')); }
  catch(e){ pesan(T('Gagal memuat daftar akun: ','Could not load the account list: ') + (e && e.message || e)); }
  finally{ b.disabled = false; }
});

/* Saringan: tiap perubahan langsung menggambar ulang tabelnya. Tidak ada tombol
   "terapkan" — daftarnya di layar yang sama, jadi hasilnya harus terlihat
   seketika. */
['fUnitAkun','fPeranAkun'].forEach(id=>el(id).addEventListener('change', gambarAkun));
el('fCariAkun').addEventListener('input', gambarAkun);
el('btnResetSaringAkun').addEventListener('click', ()=>{
  el('fUnitAkun').value = ''; el('fPeranAkun').value = ''; el('fCariAkun').value = '';
  gambarAkun();
});
// Klik petak yang sedang terpilih untuk melepas saringannya — tanpa ini,
// satu-satunya jalan kembali adalah tombol Tampilkan semua.
el('ringkasUnitAkun').addEventListener('click', e=>{
  const b = e.target.closest('button[data-saring-unit]'); if(!b) return;
  const s = el('fUnitAkun');
  s.value = s.value === b.dataset.saringUnit ? '' : b.dataset.saringUnit;
  gambarAkun();
});
el('btnSegarAkun').addEventListener('click', async ()=>{
  const b = el('btnSegarAkun');
  b.disabled = true;
  try{ await muatUsers(); gambarAkun(); pesan(T('Daftar akun dimuat ulang.','Account list reloaded.')); }
  catch(e){ pesan(T('Gagal memuat daftar akun: ','Could not load the account list: ') + (e && e.message || e)); }
  finally{ b.disabled = false; }
});
el('btnBatalAkun').addEventListener('click', tutupKartuAkun);
el('btnSimpanAkun').addEventListener('click', simpanAkun);
el('lapisAkun').addEventListener('click', e=>{ if(e.target === el('lapisAkun')) tutupKartuAkun(); });
document.addEventListener('keydown', e=>{
  if(e.key !== 'Escape') return;
  if(el('lapisAkun').classList.contains('buka')) tutupKartuAkun();
  if(el('lapisUnitAkun').classList.contains('buka')) tutupUnitAkun();
});

terapkanBahasa();     // teks statis dashboard mengikuti bahasa yang tersimpan
kmMulai();      // konsol masuk: jam, panggung 3D, tombol pembuka kartu
// Lalu tanya server: ada, dan sesinya masih hidup? Jawabannya menentukan apakah
// sesi sebelum halaman disegarkan boleh dibuka kembali, jadi pemulihannya
// menunggu — bukan berlomba dengannya.
srvPeriksa().then(pulihkanSesi);

// Daftar galeri ditarik sejak layar masuk, jauh sebelum tab Galeri dibuka.
// Gambar ulang kalau ternyata sudah keburu ada unit terbuka.
muatGaleri().then(()=>{ if(unitDibuka) gambarUnit(); });

