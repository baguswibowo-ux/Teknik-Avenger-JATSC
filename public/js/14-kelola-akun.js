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

/** Layar ini milik administrator, apa pun sumber datanya. */
const bolehKelolaAkun = () => !!akun && akun.role === 'admin';

const SEMUA_UNIT_PERAN = ['admin', 'pejabat'];
const samaIsi = (a, b) => a.length === b.length && a.every(k => b.includes(k));

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
  const boleh = bolehKelolaAkun();
  el('relAkun').hidden = !boleh;

  const bolehAkt = bolehAktivitas();
  el('relAktivitas').hidden = !bolehAkt;
  if(!bolehAkt && el('l-aktivitas').classList.contains('aktif')) pindahLayar('beranda');
  // Yang sedang membuka layar ini lalu kehilangan haknya — keluar, misalnya —
  // tidak boleh ditinggal menatap tabel yang tak berlaku lagi.
  if(!boleh && el('l-akun').classList.contains('aktif')) pindahLayar('beranda');
}

async function muatUsers(){
  USERS = (await adminApi('listUsers')) || [];
  USERS_JAM = new Date();
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
  if(!bolehKelolaAkun()) return;

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

function gambarHak(){
  el('ketPetugas').textContent = JDW.bisaTulis
    ? T('berlaku untuk seluruh dashboard ini','applies across this whole dashboard')
    : T('penyimpanan tidak permanen di lingkungan ini','storage is not permanent in this environment');
  el('btnSimpanPetugas').disabled = !JDW.bisaTulis;

  el('tblHak').innerHTML = `<thead><tr><th>${T('Modul','Module')}</th>${
    HAK_PERAN.map(p=>`<th style="text-align:center">${esc(peranTampil(p))}</th>`).join('')}
    <th style="text-align:right">${T('Ditunjuk','Named')}</th></tr></thead><tbody>${
    HAK_MODUL.map(m=>{
      const h = HAK[m];
      return `<tr>
        <td><b>${esc(T(HAK_NAMA[m][0], HAK_NAMA[m][1]))}</b></td>
        ${HAK_PERAN.map(p=>{
          const admin = p === 'admin';
          return `<td style="text-align:center">
            <input type="checkbox" data-hak-modul="${m}" data-hak-peran="${p}"
              ${admin || h.peran.includes(p) ? ' checked' : ''}${admin ? ' disabled' : ''}
              title="${admin ? T('Administrator selalu boleh','Administrators always may') : ''}"></td>`;
        }).join('')}
        <td style="text-align:right"><button class="btn garis kecil" data-hak-petugas="${m}">${
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
      gambarPetugasDinas();
    });
  });

  gambarPetugasDinas();
}

function gambarPetugasDinas(){
  const bungkus = el('bungkusPetugas');
  if(!hakModulDibuka){ bungkus.hidden = true; return; }
  bungkus.hidden = false;

  const m = hakModulDibuka;
  const calon = USERS.filter(u=>u.aktif && u.role !== 'admin');
  el('ketPetugasPilih').textContent = T(
    `Ditunjuk khusus untuk ${HAK_NAMA[m][0]} — di luar peran yang sudah dicentang di atas`,
    `Named for ${HAK_NAMA[m][1]} — beyond the roles already ticked above`);

  el('daftarPetugas').innerHTML = calon.length
    ? calon.map(u=>{
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
      }).join('')
    : `<span style="color:var(--muted);font-size:12px">${
        T('Belum ada akun aktif selain administrator.','No active accounts other than administrators yet.')}</span>`;

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
}

el('btnTutupPetugas').addEventListener('click', ()=>{ hakModulDibuka = null; gambarPetugasDinas(); });

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
  el('aUnit').classList.toggle('mati', semua);
  el('aUnitKet').textContent = semua
    ? T('Administrator dan pejabat otomatis memegang seluruh unit — tidak perlu dipilih.',
        'Administrators and officers hold every unit automatically — nothing to pick here.')
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

  el('judulKartuAkun').textContent = baru ? T('Tambah akun','Add account') : T('Ubah akun','Edit account');
  el('ketKartuAkun').textContent   = baru
    ? T('akun baru di E-Logbook','new account in E-Logbook') : u.username;
  el('btnSimpanAkun').textContent  = baru ? T('Buat akun','Create account') : T('Simpan perubahan','Save changes');

  const kotakHapus = (!baru && !diri) ? `
    <div class="bahaya">
      <div class="jdl">${T('Hapus akun','Delete account')}</div>
      <p>${u.aktif
        ? T('Hanya akun yang sudah nonaktif yang boleh dihapus. Nonaktifkan dulu lewat kolom Status di atas, simpan, lalu buka kartu ini lagi.',
            'Only a deactivated account may be deleted. Set Status above to deactivated, save, then open this card again.')
        : T('Tidak bisa dibatalkan. Catatan logbook yang pernah diinput akun ini tetap tinggal di E-Logbook — yang hilang hanya akunnya. Ketik ulang usernamenya untuk membuka tombol.',
            'This cannot be undone. The logbook entries this account once made stay in E-Logbook — only the account itself goes. Type the username again to unlock the button.')}</p>
      ${u.aktif ? '' : `<input id="aHapusKetik" autocomplete="off" spellcheck="false" placeholder="${
        T('ketik','type')}: ${esc(u.username)}">
      <button class="btn bahaya-tombol" id="btnHapusAkun" disabled>${
        T('Hapus akun ini','Delete this account')}</button>`}
    </div>` : '';

  el('badanKartuAkun').innerHTML = `
    <div class="isian"><label for="aUser">Username</label>
      <input id="aUser" autocomplete="off" spellcheck="false"
        value="${baru ? '' : esc(u.username)}"
        ${diri ? 'disabled' : ''}
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
        <option value="pic">${T('PIC Unit — menyunting database unitnya, tidak menghapus',
          'Unit PIC — edits their own unit database, cannot delete')}</option>
        <option value="adminunit">${T('Admin Unit — menyunting DAN menghapus, serta membaca log aktivitas, di unitnya saja',
          'Unit Admin — edits AND deletes, and reads the activity log, in their own unit only')}</option>
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

    ${kotakHapus}`;

  el('aRole').value = role;
  if(!baru) el('aAktif').value = u.aktif ? '1' : '0';
  el('aRole').addEventListener('change', segarkanUnitKartu);
  segarkanUnitKartu();

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

  // Administrator dan pejabat memegang seluruh unit tanpa satu pun baris di
  // tabel unitnya — daftar yang terbaca untuk mereka dihitung server, bukan
  // disimpan. Begitu perannya turun jadi teknisi, hitungan itu tidak berlaku
  // lagi dan yang tersisa bisa jadi cuma satu unit warisan. Karena itu unitnya
  // selalu dikirim ulang saat turun peran, sekalipun kelihatannya tidak berubah.
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
  if(!semua && (asalSemua || !samaIsi(unit, asal.unit || [])))
                                                     kerja.push(['setUserUnit', [kunci, unit]]);
  if(nama !== (asal.nama || ''))                     kerja.push(['setUserNama', [kunci, nama]]);
  if(aktif !== !!asal.aktif)                         kerja.push(['setUserAktif', [kunci, aktif]]);
  if(pass)                                           kerja.push(['setUserPassword', [kunci, pass]]);

  if(!kerja.length){ pesan(T('Tidak ada yang diubah.','Nothing was changed.')); return; }

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
    setUserPassword: T('password','password')
  };
  const sebut = (daftar) => daftar.map(([fn]) => NAMA_LANGKAH[fn] || fn).join(', ');

  for(let i = 0; i < kerja.length; i++){
    const [fn, args] = kerja[i];
    try{
      await adminApi(fn, ...args);
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
  pesan(T(kerja.length + ' perubahan tersimpan untuk ' + asal.username + '.',
          kerja.length + ' change(s) saved for ' + asal.username + '.'));
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
  if(e.key === 'Escape' && el('lapisAkun').classList.contains('buka')) tutupKartuAkun();
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

