/* =======================================================================
   BANTU
   ======================================================================= */
/* Tanggal acuan umur trouble. Dulu dipatok pada satu hari di Agustus 2026
   supaya umur trouble karangan selalu terbaca masuk akal. Data karangannya
   sudah tidak ada, jadi patokannya kembali ke hari yang sebenarnya —
   srvPasang() tetap menyetelnya ulang tiap kali data server datang, karena
   halaman yang dibiarkan terbuka semalaman akan mengukur dari kemarin. */
let HARI_INI = new Date(new Date().toDateString());
const el  = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const umurHari = (iso) => Math.max(0, Math.round((HARI_INI - new Date(iso+'T00:00:00'))/86400000));

/* Umur trouble sampai ke jam dan menit. Tgl Report isu ditulis dalam UTC tanpa
   penanda zona ("2026-08-05T09:37") — Jam Report di E-Logbook memang UTC —
   jadi dibaca sebagai UTC, bukan waktu lokal peramban. DibuatPada dari server
   sudah ber-"Z". Tanggal saja (tanpa jam) dihitung dari tengah malam UTC.
   Diukur dari jam sekarang saat digambar, bukan dari HARI_INI, supaya menitnya
   benar; segarkanUmurTrouble() memutakhirkannya tiap menit. */
const waktuMs = (iso) => {
  const s = String(iso || '').trim();
  if(!s) return NaN;
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z'
          : (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s) ? s : s + 'Z');
  return new Date(t).getTime();
};
const umurMenit = (iso) => { const ms = waktuMs(iso); return isNaN(ms) ? 0 : Math.max(0, Math.floor((Date.now() - ms)/60000)); };
/** "32 hari 10 jam 5 menit"; bentuk pendek "32 hr 10 jam 5 mnt" untuk kolom tabel.
    Nol di depan tidak ditulis (baru 3 jam → "3 jam 12 menit"), menit selalu ada. */
const umurTeks = (iso, pendek) => {
  const m = umurMenit(iso);
  const hr = Math.floor(m/1440), jam = Math.floor((m%1440)/60), mnt = m%60;
  const kata = pendek
    ? { hr:T('hr','d'),   jam:T('jam','h'), mnt:T('mnt','m') }
    : { hr:T('hari','days'), jam:T('jam','hours'), mnt:T('menit','min') };
  const bagian = [];
  if(hr) bagian.push(hr + ' ' + kata.hr);
  if(hr || jam) bagian.push(jam + ' ' + kata.jam);
  bagian.push(mnt + ' ' + kata.mnt);
  return bagian.join(' ');
};
/** Setiap elemen ber-data-umur ditulis ulang dari jam sekarang — dipanggil tiap
    menit, tanpa menggambar ulang tabel atau pita (animasinya tidak tersentak). */
function segarkanUmurTrouble(){
  document.querySelectorAll('[data-umur]').forEach(e=>{
    e.textContent = umurTeks(e.dataset.umur, e.dataset.pendek === '1');
  });
}
/** "5 Agu 2026 · 09:37 UTC" — jamnya dilewati kalau memang tidak tercatat. */
const waktuRingkas = (iso) => {
  const s = String(iso || '');
  const jam = s.length >= 16 && s[10] === 'T' ? s.slice(11,16) : '';
  return tglRingkas(s.slice(0,10)) + (jam ? ' · ' + jam + ' UTC' : '');
};
const infoUnit = (k) => UNIT.find(u=>u.kode===k) || {};
const namaUnit = (k) => infoUnit(k).nama || k;
const inisial  = (n) => n.split(/[\s.]+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const BULAN = {
  id:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
  en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
};
/* Tanggal kosong dijawab '—', bukan 'NaN undefined NaN'. Sebelum ada impor
   sparepart, tiap kolom tanggal selalu terisi — kartu Tambah/Ubah mengisinya
   dengan hari ini kalau dikosongkan — jadi jalur ini tidak pernah terlewati.
   Lembar Excel gudang punya sel tanggal yang memang kosong, dan mengarangnya
   jadi hari ini akan menuliskan pemakaian yang tidak pernah terjadi. */
const tglRingkas  = (iso) => { const d=new Date(iso+'T00:00:00');
  if(isNaN(d)) return '—';
  return d.getDate()+' '+BULAN[BHS][d.getMonth()]+' '+d.getFullYear(); };

