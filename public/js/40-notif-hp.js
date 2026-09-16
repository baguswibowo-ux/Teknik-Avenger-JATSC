/* =======================================================================
   NOTIFIKASI HP — pasang Avengers di layar utama & terima notifikasi

   Pengganti Telegram bagi yang tidak memakainya. Server E-Logbook yang
   mengirim (webpush.js + pushStatus/pushLangganan/pushCoba), sw.js yang
   menampilkan notifikasinya di HP. Yang di sini hanya sisi orangnya:

     · spanduk bawah sesudah masuk — tawaran PASANG (Android), PETUNJUK pasang
       (iPhone di Safari), atau AKTIFKAN NOTIFIKASI; satu saja, "Nanti" menunda
       tiga hari;
     · bagian "Notifikasi HP" di Profil — keadaan HP ini, tombol aktifkan, dan
       tombol kirim notifikasi percobaan.

   KEADAANNYA MILIK PERANGKAT, BUKAN AKUN. Izin notifikasi dan langganannya
   melekat di peramban HP ini. Akun yang sama di tiga HP = tiga langganan.
   HP yang dipakai bergantian: langganannya pindah ke akun yang terakhir masuk
   (hpSelaraskan tiap kali masuk), jadi satu HP tidak menerima kabar dua orang.

   IPHONE hanya bisa menerima notifikasi dari Avengers yang sudah dipasang ke
   Layar Utama (iOS 16.4+) dan dibuka dari ikonnya. Di Safari biasa PushManager
   memang tidak ada — karena itu yang ditawarkan di sana petunjuk memasang,
   bukan tombol yang tidak akan berfungsi.
   ======================================================================= */

const HP = {
  dukung: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  reg: null,                 // pendaftaran service worker
  tawaranPasang: null,       // event beforeinstallprompt yang ditahan (Chrome/Android)
  info: { aktif:false },     // jawaban pushStatus
  berlangganan: false,       // HP ini punya langganan dengan kunci server yang berlaku
  sibuk: false
};

const HP_TUNDA = 'avenger.hp.tunda';

const hpIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hpSeluler = () => hpIos() || /android|mobile/i.test(navigator.userAgent);
const hpTerpasang = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
  || navigator.standalone === true;

function hpLabelPerangkat(){
  const ua = navigator.userAgent;
  if(/iphone/i.test(ua)) return 'iPhone';
  if(hpIos()) return 'iPad';
  if(/android/i.test(ua)) return 'Android';
  if(/windows/i.test(ua)) return 'Windows';
  if(/mac os/i.test(ua)) return 'Mac';
  return T('Peramban','Browser');
}

const hpKeB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function hpDariB64u(s){
  const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

/* ---------- service worker & tawaran pasang ---------- */

async function hpDaftarSw(){
  if(!('serviceWorker' in navigator)) return null;
  if(HP.reg) return HP.reg;
  try{ HP.reg = await navigator.serviceWorker.register('/sw.js', { scope:'/' }); }
  catch(e){ console.warn('Service worker notifikasi gagal dipasang:', e && e.message || e); }
  return HP.reg;
}

window.addEventListener('beforeinstallprompt', e=>{
  // Ditahan supaya yang menawarkan spanduk kita sendiri, dengan kata-kata kita,
  // dan hanya sesudah orangnya masuk.
  e.preventDefault();
  HP.tawaranPasang = e;
  hpGambar();
});
window.addEventListener('appinstalled', ()=>{
  HP.tawaranPasang = null;
  pesan(T('Avengers terpasang. Buka dari ikonnya di layar utama.',
          'Avengers is installed. Open it from its home-screen icon.'));
  hpGambar();
});

async function hpPasang(){
  const t = HP.tawaranPasang;
  if(!t) return;
  HP.tawaranPasang = null;
  try{ t.prompt(); await t.userChoice; }catch(e){ /* dibatalkan */ }
  hpGambar();
}

/* ---------- langganan ---------- */

async function hpMuatStatus(){
  if(!SRV.sesi) { HP.info = { aktif:false }; return; }
  try{ HP.info = await srvApi('pushStatus') || { aktif:false }; }
  catch(e){ HP.info = { aktif:false }; }
}

/** Langganan HP ini, atau null. Yang dibuat dengan kunci server lain (server
    berganti kunci) dicabut di sini supaya bisa dibuat ulang. */
async function hpLanggananKini(){
  if(!HP.dukung || !HP.info.kunciPublik) return null;
  const reg = HP.reg || await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(sub){
    const kunci = sub.options && sub.options.applicationServerKey;
    if(!kunci || hpKeB64u(kunci) !== HP.info.kunciPublik){
      try{ await sub.unsubscribe(); }catch(e){ /* biar */ }
      sub = null;
    }
  }
  return sub;
}

/** Pastikan HP ini berlangganan dan tercatat atas nama akun yang masuk. */
async function hpLangganKeServer(){
  const reg = HP.reg || await navigator.serviceWorker.ready;
  let sub = await hpLanggananKini();
  if(!sub){
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: hpDariB64u(HP.info.kunciPublik)
    });
  }
  HP.info = await srvApi('pushLangganan', sub.toJSON(), hpLabelPerangkat()) || HP.info;
  HP.berlangganan = true;
}

/** Dipanggil tombol. Izin diminta PALING DULU, sebelum menunggu apa pun:
    Safari hanya mau menampilkan pertanyaan izin selama masih di dalam
    ketukan orangnya. */
async function hpAktifkan(){
  if(HP.sibuk) return;
  if(!HP.dukung){ hpGambar(); return; }
  let izin;
  try{ izin = await Notification.requestPermission(); }catch(e){ izin = Notification.permission; }
  if(izin !== 'granted'){
    pesan(izin === 'denied'
      ? T('Notifikasi diblokir di HP ini. Buka setelan situs atau aplikasi Avengers, izinkan Notifikasi, lalu coba lagi.',
          'Notifications are blocked on this phone. Open the site or Avengers app settings, allow Notifications, then try again.')
      : T('Izin notifikasi belum diberikan.', 'Notification permission was not granted.'));
    hpGambar();
    return;
  }
  HP.sibuk = true; hpGambar();
  try{
    await hpDaftarSw();
    if(!HP.info.aktif) await hpMuatStatus();
    if(!HP.info.aktif) throw new Error(T('notifikasi HP belum dinyalakan di server','phone notifications are not enabled on the server'));
    await hpLangganKeServer();
    pesan(T('Notifikasi aktif di HP ini. Coba tekan "Kirim notifikasi percobaan" di Profil.',
            'Notifications are on for this phone. Try "Send a test notification" in your profile.'));
  }catch(e){
    pesan(T('Notifikasi gagal diaktifkan: ','Could not turn on notifications: ') + (e && e.message || e));
  }finally{
    HP.sibuk = false; hpGambar();
  }
}

async function hpCoba(){
  if(HP.sibuk) return;
  HP.sibuk = true; hpGambar();
  try{
    const h = await srvApi('pushCoba') || { terkirim:0 };
    pesan(h.terkirim
      ? T(`Notifikasi percobaan dikirim ke ${h.terkirim} perangkat. Kalau belum muncul dalam semenit, periksa setelan notifikasi HP.`,
          `Test notification sent to ${h.terkirim} device(s). If nothing shows within a minute, check the phone's notification settings.`)
      : T('Belum ada HP yang menerima. Tekan "Aktifkan notifikasi" dulu.',
          'No phone received it. Press "Turn on notifications" first.'));
  }catch(e){
    pesan(e && e.message || String(e));
  }finally{
    HP.sibuk = false; hpGambar();
  }
}

/** Sesudah masuk: pasang service worker, baca status, dan — kalau HP ini sudah
    pernah mengizinkan — perbarui langganannya atas nama akun yang masuk
    sekarang. Tidak pernah memunculkan pertanyaan izin sendiri. */
async function hpSelaraskan(){
  await hpDaftarSw();
  await hpMuatStatus();
  HP.berlangganan = false;
  if(HP.dukung && HP.info.aktif && Notification.permission === 'granted'){
    try{ await hpLangganKeServer(); }
    catch(e){ console.warn('Langganan notifikasi HP gagal diperbarui:', e && e.message || e); }
  }
  hpGambar();
}

/* ---------- tampilan ---------- */

function hpDitunda(){
  try{ return Number(localStorage.getItem(HP_TUNDA) || 0) > Date.now(); }catch(e){ return false; }
}
function hpTunda(){
  try{ localStorage.setItem(HP_TUNDA, String(Date.now() + 3 * 86400000)); }catch(e){ /* diabaikan */ }
  hpGambar();
}

/** Satu tawaran untuk spanduk, atau null. Urutannya: pasang dulu (notifikasi
    iPhone memang butuh terpasang), baru izin notifikasi. */
function hpTawaran(){
  if(!SRV.sesi || !hpSeluler() || hpDitunda() || !el('app').classList.contains('tampil')) return null;
  if(HP.tawaranPasang && !hpTerpasang()){
    return { judul:T('Pasang Avengers di HP ini?','Install Avengers on this phone?'),
             isi:T('Buka langsung dari layar utama dan terima notifikasi.','Open it from your home screen and get notifications.'),
             ya:T('Pasang','Install'), aksi:hpPasang };
  }
  if(hpIos() && !hpTerpasang()){
    return { judul:T('Pasang Avengers di iPhone ini','Install Avengers on this iPhone'),
             isi:T('Di Safari: ketuk Bagikan, pilih "Tambahkan ke Layar Utama", lalu buka Avengers dari ikonnya untuk mengaktifkan notifikasi.',
                   'In Safari: tap Share, choose "Add to Home Screen", then open Avengers from its icon to turn on notifications.'),
             ya:null };
  }
  if(HP.dukung && HP.info.aktif && Notification.permission === 'default'){
    return { judul:T('Aktifkan notifikasi di HP ini?','Turn on notifications on this phone?'),
             isi:T('Dokumen yang perlu TTD, pengingat dinas, dan kegiatan berkala langsung dikabari.',
                   'Documents awaiting your signature, shift reminders and periodic tasks arrive right away.'),
             ya:T('Aktifkan','Turn on'), aksi:hpAktifkan };
  }
  return null;
}

function hpGambarSpanduk(){
  const wadah = el('hpSpanduk');
  if(!wadah) return;
  const t = hpTawaran();
  wadah.hidden = !t;
  if(!t) return;
  el('hpSpandukJudul').textContent = t.judul;
  el('hpSpandukIsi').textContent = t.isi;
  const ya = el('hpSpandukYa');
  ya.hidden = !t.ya;
  ya.textContent = t.ya || '';
  ya.disabled = HP.sibuk;
  ya.onclick = t.aksi || null;
  el('hpSpandukNanti').textContent = t.ya ? T('Nanti','Later') : T('Oke','OK');
}

function hpGambarProfil(){
  const panel = el('profilHp');
  if(!panel) return;
  panel.hidden = !SRV.sesi || !HP.info.aktif;
  if(panel.hidden) return;
  const status = el('profilHpStatus'), aksi = el('profilHpAksi');
  const lencana = (on, teks) => `<span class="tg-lencana ${on ? 'on' : 'off'}">${esc(teks)}</span> `;
  const jumlah = HP.info.perangkat || 0;
  const catatanJumlah = jumlah
    ? esc(T(`${jumlah} perangkat menerima notifikasi akun ini.`, `${jumlah} device(s) receive this account's notifications.`))
    : '';
  let tombol = '';

  if(!HP.dukung){
    status.innerHTML = lencana(false, T('Belum bisa di sini','Not available here'))
      + esc(hpIos() && !hpTerpasang()
        ? T('Di iPhone, pasang dulu: Safari → Bagikan → Tambahkan ke Layar Utama (iOS 16.4 ke atas), lalu buka Avengers dari ikonnya.',
            'On iPhone, install first: Safari → Share → Add to Home Screen (iOS 16.4+), then open Avengers from its icon.')
        : T('Peramban ini tidak mendukung notifikasi. Pakai Chrome di Android atau Safari di iPhone.',
            'This browser does not support notifications. Use Chrome on Android or Safari on iPhone.'));
  }else if(Notification.permission === 'denied'){
    status.innerHTML = lencana(false, T('Diblokir','Blocked'))
      + esc(T('Notifikasi untuk Avengers diblokir di HP ini. Izinkan lewat setelan situs/aplikasi, lalu tekan Aktifkan.',
              'Notifications for Avengers are blocked on this phone. Allow them in the site/app settings, then press Turn on.'));
    tombol = `<button class="btn" id="btnHpAktif">${esc(T('Aktifkan notifikasi','Turn on notifications'))}</button>`;
  }else if(HP.berlangganan && Notification.permission === 'granted'){
    status.innerHTML = lencana(true, T('Aktif di HP ini','On for this phone')) + catatanJumlah;
    tombol = `<button class="btn garis" id="btnHpCoba">${esc(T('Kirim notifikasi percobaan','Send a test notification'))}</button>`;
  }else{
    status.innerHTML = lencana(false, T('Belum aktif di HP ini','Off for this phone')) + catatanJumlah;
    tombol = `<button class="btn" id="btnHpAktif">${esc(T('Aktifkan notifikasi','Turn on notifications'))}</button>`;
  }
  if(HP.tawaranPasang && !hpTerpasang()){
    tombol += `<button class="btn garis" id="btnHpPasang">${esc(T('Pasang Avengers di HP ini','Install Avengers on this phone'))}</button>`;
  }
  if(HP.sibuk) tombol = `<span class="bantu">${esc(T('Sebentar…','One moment…'))}</span>`;
  aksi.innerHTML = tombol;
  const b1 = el('btnHpAktif'), b2 = el('btnHpCoba'), b3 = el('btnHpPasang');
  if(b1) b1.addEventListener('click', hpAktifkan);
  if(b2) b2.addEventListener('click', hpCoba);
  if(b3) b3.addEventListener('click', hpPasang);
}

function hpGambar(){
  hpGambarSpanduk();
  hpGambarProfil();
}

/** Profil dibuka: status dibaca ulang, supaya jumlah perangkat terkini. */
async function hpSegarkanProfil(){
  await hpMuatStatus();
  if(HP.dukung && HP.info.aktif && Notification.permission === 'granted'){
    try{ HP.berlangganan = !!(await hpLanggananKini()); }catch(e){ HP.berlangganan = false; }
  }
  hpGambar();
}

/* ---------- pemasangan ---------- */

el('hpSpandukNanti').addEventListener('click', hpTunda);
// Didaftarkan sedini mungkin: Chrome baru menawarkan pemasangan sesudah
// service worker-nya ada.
window.addEventListener('load', ()=>{ hpDaftarSw(); });
