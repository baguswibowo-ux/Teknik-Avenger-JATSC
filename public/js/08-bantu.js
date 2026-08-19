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
const infoUnit = (k) => UNIT.find(u=>u.kode===k) || {};
const namaUnit = (k) => infoUnit(k).nama || k;
const inisial  = (n) => n.split(/[\s.]+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const BULAN = {
  id:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
  en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
};
const tglRingkas  = (iso) => { const d=new Date(iso+'T00:00:00');
  return d.getDate()+' '+BULAN[BHS][d.getMonth()]+' '+d.getFullYear(); };

