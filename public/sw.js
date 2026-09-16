/* =======================================================================
   SERVICE WORKER AVENGERS — hanya untuk notifikasi HP

   Tugasnya dua: menampilkan notifikasi yang dikirim server (webpush.js), dan
   membuka halaman yang tepat saat notifikasinya diketuk.

   SENGAJA TIDAK MENYIMPAN APA PUN (tidak ada handler 'fetch'). Halaman ini
   disajikan dari PC kantor lewat tunnel yang sempit, dan cache offline yang
   salah urus berarti orang melihat jadwal atau tanda tangan yang basi tanpa
   tahu. Semua permintaan tetap berjalan seperti tanpa service worker.

   Disajikan server.js di /sw.js dengan no-cache, cakupan '/': satu service
   worker untuk dashboard dan E-Logbook di /logbook/.
   ======================================================================= */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (err) { d = { isi: e.data ? e.data.text() : '' }; }
  const opsi = {
    body: d.isi || '',
    icon: '/images/pwa/ikon-192.png',
    badge: '/images/pwa/lencana-96.png',
    data: { url: d.url || '/' },
    // Getar ikut setelan HP; pola ini hanya dipakai kalau HP mengizinkan.
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    lang: 'id',
    // Notifikasi "perlu TTD" tidak hilang sendiri sampai diketuk atau diusap.
    requireInteraction: !!d.tetap
  };
  // tag menyatukan kabar tentang dokumen yang sama; renotify membuatnya tetap
  // berbunyi walau menggantikan yang lama.
  if (d.tag) { opsi.tag = d.tag; opsi.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.judul || 'Avengers', opsi));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tuju = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  if (tuju.origin !== self.location.origin) return;
  e.waitUntil((async () => {
    const jendela = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Avengers yang sudah terbuka dipakai ulang — tidak menumpuk jendela baru
    // tiap kali notifikasi diketuk.
    for (const c of jendela) {
      if (new URL(c.url).origin !== tuju.origin) continue;
      try {
        await c.focus();
        if (c.url !== tuju.href && 'navigate' in c) await c.navigate(tuju.href);
        return;
      } catch (err) {
        // Jendela yang belum dikendalikan service worker ini tidak bisa
        // diarahkan — jatuh ke membuka jendela baru di bawah.
      }
    }
    await self.clients.openWindow(tuju.href);
  })());
});
