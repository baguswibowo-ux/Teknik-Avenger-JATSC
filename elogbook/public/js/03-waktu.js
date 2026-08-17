/* E-Logbook · js/03-waktu.js — Jam server sebagai satu-satunya acuan waktu
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== WAKTU — SELALU UTC, SELALU DARI SERVER ==============
   Memakai getUTC* saja hanya membuang selisih zona waktu; kalau jam laptop
   teknisi sendiri meleset, catatannya ikut meleset. Karena itu jam server
   dipakai sebagai acuan: setiap jawaban HTTP membawa header Date, selisihnya
   terhadap jam lokal disimpan, lalu seluruh waktu di aplikasi dihitung dari
   situ. Hasilnya sama di mana pun aplikasi dibuka, apa pun setelan jam PC-nya. */

let selisihWaktuServer = 0;      // milidetik: jam server dikurangi jam PC
let waktuServerDiketahui = false;

function catatWaktuServer(res){
  const header = res && res.headers && res.headers.get('Date');
  if(!header) return;
  const t = Date.parse(header);
  if(isNaN(t)) return;
  selisihWaktuServer = t - Date.now();
  waktuServerDiketahui = true;
}

/** Waktu sekarang menurut server. Pakai ini, jangan new Date(). */
function sekarang(){ return new Date(Date.now() + selisihWaktuServer); }

/** Tanggal hari ini menurut server, format YYYY-MM-DD untuk <input type="date">. */
const tanggalHariIni = () => sekarang().toISOString().slice(0,10);
/** Jam sekarang menurut server, format HH:MM untuk <input type="time">. */
const jamSekarang = () => sekarang().toISOString().slice(11,16);



const tanggalPanjang = d => `${T('hari')[d.getUTCDay()]} / ${d.getUTCDate()} ${T('bulan')[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

function tickClock(){
  const now = sekarang();
  const hh = String(now.getUTCHours()).padStart(2,'0');
  const mm = String(now.getUTCMinutes()).padStart(2,'0');
  const ss = String(now.getUTCSeconds()).padStart(2,'0');
  document.getElementById('clockTime').textContent = `${hh}:${mm}:${ss}`;

  // Kalau jam PC meleset jauh, beri tahu — supaya ketahuan sebelum jadi
  // pertanyaan di kemudian hari kenapa jam di layar beda dengan jam dinding.
  const meleset = Math.abs(selisihWaktuServer) >= 120000;
  document.getElementById('clockDate').textContent =
    `${tanggalPanjang(now)} UTC${meleset ? ' · ' + T('jamServer') : ''}`;
  document.getElementById('clockDate').title = waktuServerDiketahui
    ? (meleset
        ? `Jam komputer ini meleset ${Math.round(selisihWaktuServer/60000)} menit dari server. Yang dipakai aplikasi adalah jam server.`
        : T('jamDariServer'))
    : T('jamBelumSelaras');
}
setInterval(tickClock,1000); tickClock();
