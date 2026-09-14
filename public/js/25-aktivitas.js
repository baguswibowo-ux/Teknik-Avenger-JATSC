/* =======================================================================
   AKTIVITAS — siapa mengubah apa, dan kapan

   Pertanyaan yang paling sering datang sesudah sebuah data berubah bukan "apa
   yang berubah" melainkan "ini siapa yang mengisi". Sampai sekarang jawabannya
   tersebar dan setengah-setengah: jadwal dinas menyimpan siapa yang terakhir
   menyimpannya, kegiatan berkala menyimpan siapa yang menandai selesai, dan
   sisanya tidak menyimpan apa pun.

   TIGA SUMBER, DAN KETIGANYA MEMANG BEDA
     dashboard — jadwal dinas, kegiatan berkala, personel, hak, galeri,
                 peralatan, sparepart, ISR. Ditulis server.js dengan identitas
                 dari sesi E-Logbook yang sungguhan, jadi berlaku untuk semua
                 orang dan tidak bisa dikarang dari peramban.
     elogbook  — dokumen E-Logbook yang DIUBAH atau DIHAPUS (logbook, daily
                 check, LTK, isu, …) dan pengelolaan akun (peran, unit, aktif,
                 hapus). Dokumen baru tidak dicatat — itu input harian.
                 Dicatat E-Logbook di tabelnya sendiri, diteruskan /aktivitas.
                 Kolom `sumber` membedakan keduanya.
     lokal     — suntingan yang cuma hidup di localStorage peramban ini (lihat
                 SUNTINGAN DATABASE UNIT). Ditandai terang-terangan di tabelnya
                 supaya tidak disangka berlaku bersama.

   Yang dicatat cuma perbuatannya — modul, unit, dan sepotong keterangan
   (nama baris yang berubah, judul dokumen, peran lama → baru) — bukan isi
   datanya. Log yang menyalin isinya akan jadi salinan kedua dari data yang
   dicatatnya, dan salinan kedua selalu jadi yang tertinggal.
   ======================================================================= */

const AKTIVITAS_KUNCI = 'avenger.aktivitas';
const AKTIVITAS_LOKAL_BATAS = 200;
const AKTIVITAS_AMBIL = 1000;

/* Modul yang dicatat server. Untuk yang ini, peramban tidak ikut mencatat saat
   tersambung — kalau ikut, satu perbuatan muncul dua kali dengan jam yang
   berbeda tipis. */
const AKT_SERVER = new Set(['dinas','berkala','personel','hak','galeri',
                            'peralatan','sparepart','logo']);

const AKT_MODUL_NAMA = {
  dinas:      ['Jadwal dinas','Duty roster'],
  berkala:    ['Kegiatan berkala','Recurring jobs'],
  personel:   ['Personel','Personnel'],
  hak:        ['Hak modul','Module rights'],
  'hak-akun': ['Hak akun','Account rights'],
  galeri:     ['Galeri foto','Photo gallery'],
  peralatan:  ['Peralatan','Equipment'],
  sparepart:  ['Sparepart','Spare parts'],
  isr:        ['ISR','Radio licences'],
  notam:      ['NOTAM','NOTAM'],
  sejarah:    ['Riwayat alat','Equipment history'],
  dokumen:    ['Dokumen','Documents'],
  logo:       ['Logo unit','Unit logo'],
  cetak:      ['Permintaan cetak','Print requests'],
  // E-Logbook
  logbook:      ['Logbook','Logbook'],
  dailycheck:   ['Daily Check','Daily Check'],
  monitoring:   ['Monitoring','Monitoring'],
  dstest:       ['DS Test / Preventive','DS Test / Preventive'],
  pemeliharaan: ['Pemeliharaan Berkala','Periodic Maintenance'],
  ltk:          ['LTK','Damage report'],
  bapb:         ['BAPB','BAPB'],
  isu:          ['Isu','Issues'],
  akun:         ['Akun','Accounts']
};
const aktModulNama = (m) => AKT_MODUL_NAMA[m] ? T(...AKT_MODUL_NAMA[m]) : (m || '—');

const AKT_AKSI_NAMA = {
  tambah:            ['ditambahkan','added'],
  ubah:              ['diubah','changed'],
  'ubah-unit':       ['diubah','changed'],
  hapus:             ['dihapus','deleted'],
  simpan:            ['disimpan','saved'],
  kosongkan:         ['dikosongkan','emptied'],
  atur:              ['daftarnya diatur','list set up'],
  selesai:           ['ditandai selesai','marked done'],
  'batal-selesai':   ['tanda selesainya dibatalkan','done mark undone'],
  unggah:            ['diunggah','uploaded'],
  ganti:             ['diganti','replaced'],
  kembalikan:        ['dikembalikan ke bawaan','reset to defaults'],
  reset:             ['dikembalikan ke bawaan','reset to defaults'],
  rename:            ['username diganti','username changed'],
  tulis:             ['ditulis','written'],
  tautan:            ['tautan ditambahkan','link added'],
  lihat:             ['dibuka','opened'],
  baris:             ['baris nama alat diganti','equipment line replaced'],
  'baris-kosong':    ['baris nama alat dikosongkan','equipment line cleared'],
  'hapus-berkas':    ['berkasnya dihapus','file deleted'],
  'kirim-permintaan':['permintaan dikirim','request sent'],
  'setujui-permintaan':['permintaan disetujui','request approved'],
  'setujui-deputy':  ['disetujui deputy','approved by deputy'],
  'teruskan-deputy': ['diteruskan ke deputy','forwarded to deputy'],
  // E-Logbook
  tutup:             ['ditutup','closed'],
  'rute-ttd':        ['tujuan TTD-nya diubah','signing route changed'],
  'lampiran-tambah': ['lampiran ditambahkan','attachment added'],
  'lampiran-hapus':  ['lampiran dihapus','attachment removed'],
  'lampiran-ubah':   ['lampirannya diubah','attachments changed'],
  peran:             ['perannya diubah','role changed'],
  unit:              ['unitnya diubah','units changed'],
  nama:              ['namanya diubah','renamed'],
  username:          ['username-nya diubah','username changed'],
  sandi:             ['kata sandinya diganti','password reset'],
  aktifkan:          ['diaktifkan','activated'],
  nonaktifkan:       ['dinonaktifkan','deactivated']
};
const aktAksiNama = (a) => AKT_AKSI_NAMA[a] ? T(...AKT_AKSI_NAMA[a]) : (a || '—');

/* Aksi yang membuang sesuatu — diberi warna supaya terlihat sekilas di antara
   puluhan baris "ditambahkan". */
const AKT_AKSI_BUANG = new Set(['hapus','kosongkan','nonaktifkan','lampiran-hapus','hapus-berkas','baris-kosong']);

const AKT = {
  server: [],
  lokal:  [],
  dimuat: false,      // catatan lama sudah dibaca dari localStorage?
  saring: { modul:'', orang:'', dari:'', sampai:'', cari:'' },
  kabar:  '',         // sebab kalau log server tidak bisa diambil
  kabarElog: ''       // sebab kalau log E-Logbook tidak ikut terambil
};

function aktLokalMuat(){
  try{
    const s = JSON.parse(localStorage.getItem(AKTIVITAS_KUNCI) || 'null');
    return Array.isArray(s) ? s : [];
  }catch(e){ return []; }
}
function aktLokalSimpan(){
  try{ localStorage.setItem(AKTIVITAS_KUNCI, JSON.stringify(AKT.lokal.slice(0, AKTIVITAS_LOKAL_BATAS))); }
  catch(e){ console.warn('Log aktivitas tidak bisa disimpan di peramban:', e && e.message || e); }
}

/**
 * Catat satu perbuatan.
 *
 * Dipanggil di tempat perbuatannya terjadi, bukan dikumpulkan belakangan:
 * yang menyimpan tahu persis apa yang barusan ia simpan, dan penebak yang
 * membaca datanya sesudah itu tidak akan pernah tahu.
 */
function aktCatat(modul, aksi, unit, rincian){
  if(AKT_SERVER.has(modul)) return;   // server sudah mencatatnya
  // Catatan lama dibaca dulu. Tanpa ini, penyuntingan pertama sebelum layar
  // Aktivitas pernah dibuka akan menimpa seluruh riwayat dengan satu baris.
  if(!AKT.dimuat){ AKT.lokal = aktLokalMuat(); AKT.dimuat = true; }
  AKT.lokal.unshift({
    jam: new Date().toISOString(),
    oleh: akun ? akun.user : '—',
    nama: akun ? (akun.nama || akun.user) : '—',
    peran: akun ? akun.peran : '',
    modul, aksi, unit: unit || '',
    rincian: String(rincian || '').slice(0, 200),
    lokal: true
  });
  AKT.lokal = AKT.lokal.slice(0, AKTIVITAS_LOKAL_BATAS);
  aktLokalSimpan();
}

async function aktMuat(){
  AKT.lokal = aktLokalMuat();
  AKT.dimuat = true;
  AKT.kabar = '';
  AKT.kabarElog = '';
  try{
    const r = await srvFetch('/aktivitas?batas=' + AKTIVITAS_AMBIL, {}, 15000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    AKT.server = (j && Array.isArray(j.aktivitas)) ? j.aktivitas : [];
    AKT.kabarElog = (j && j.galatElogbook) || '';
  }catch(e){
    AKT.server = [];
    AKT.kabar = e && e.message || String(e);
  }
}

/** Kedua sumber digabung dan diurut dari yang terbaru. Entri LOKAL disaring
 *  di sini juga: server sudah memagari entri server untuk admin unit, tapi
 *  Peralatan/Sparepart yang tersimpan di localStorage tidak pernah lewat
 *  server. Tanpa saringan ini, ubin "Tercatat" bocor jumlah aktivitas unit
 *  lain, dan pencari orang bisa menemukannya. */
function aktSemua(){
  const lingkup = aktLingkupUnit();
  const lokal = lingkup === null ? AKT.lokal : AKT.lokal.filter(a => {
    const u = String((a && a.unit) || '').toLowerCase();
    if(!u) return false;
    const kode = u.split(',').map(s => s.trim()).filter(Boolean);
    return kode.some(k => lingkup.includes(k));
  });
  return [...AKT.server, ...lokal]
    .sort((a,b)=>String(b.jam || '').localeCompare(String(a.jam || '')));
}

/** Cakupan unit orang yang sedang melihat log. `null` = tidak dibatasi
 *  (admin biasa/superadmin/pejabat). Array kode = admin unit — hanya entri
 *  yang unitnya jatuh di sini yang boleh tampil. Dipakai untuk memagari entri
 *  LOKAL (Peralatan/Sparepart yang tersimpan di localStorage peramban ini)
 *  yang tidak lewat saringan server. Untuk entri server, saringan yang sama
 *  sudah dijalankan di /aktivitas — di sini cuma jaring pengaman. */
function aktLingkupUnit(){
  if(!akun) return [];
  if(akun.role === 'admin' || akun.superadmin === true) return null;
  if(akun.unit === 'semua') return null;
  return Array.isArray(akun.unit) ? akun.unit.map(k => String(k || '').toLowerCase()) : [];
}

/** Untuk entri Hak modul yang tidak menyimpan kolom `unit` (format lama,
 *  sebelum server menulis CSV kode unit): tentukan apakah entri ini berkait
 *  dengan salah satu unit di `lingkup` dengan cara silang — daftar petugas
 *  saat ini pada modul yang disebut, dicocokkan ke daftar akun (USERS) yang
 *  memberi tahu masing-masing orang unitnya di mana.
 *
 *  Pejabat & administrator dianggap cocok untuk unit mana pun (perannya
 *  memang lintas unit); jadi kalau salah satu ditunjuk, entri ini pun
 *  berlaku untuk admin unit mana pun. */
function aktHakBerkaitDenganUnit(a, lingkup){
  if(!a || a.modul !== 'hak') return false;
  if(typeof HAK !== 'object' || !HAK) return false;
  if(!Array.isArray(USERS) || !USERS.length) return false;
  const teks = String(a.rincian || '');
  const disebut = [];
  for(const m of Object.keys(HAK)){
    if(new RegExp('(^|[^a-z-])' + m.replace('-','\\-') + '\\s*[:(]').test(teks)
       && !disebut.includes(m)) disebut.push(m);
  }
  if(!disebut.length) return false;
  const peta = new Map();
  for(const u of USERS) peta.set(String(u.username || '').toLowerCase(), u);
  return disebut.some(m => {
    const petugas = (HAK[m] && HAK[m].petugas) || [];
    return petugas.some(nama => {
      const u = peta.get(String(nama).toLowerCase());
      if(!u) return false;
      const peran = String(u.role || '').toLowerCase();
      if(peran === 'admin' || peran === 'pejabat') return true;
      return (u.unit || []).some(k => lingkup.includes(String(k).toLowerCase()));
    });
  });
}

/** Tanggal lokal YYYY-MM-DD sebuah jam ISO — pembanding saringan Dari/Sampai,
 *  yang diisi orang dalam tanggal lokalnya, bukan UTC. */
function aktTanggalLokal(iso){
  const t = new Date(iso);
  if(isNaN(t)) return '';
  const d2 = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${d2(t.getMonth()+1)}-${d2(t.getDate())}`;
}

function aktLolosSaring(a){
  const { modul, orang, dari, sampai, cari } = AKT.saring;
  if(modul && a.modul !== modul) return false;
  if(orang && String(a.oleh || '').toLowerCase() !== orang.toLowerCase()) return false;
  if(dari || sampai){
    const tgl = aktTanggalLokal(a.jam);
    if(dari && (!tgl || tgl < dari)) return false;
    if(sampai && (!tgl || tgl > sampai)) return false;
  }
  // Pagar unit: admin unit tidak boleh melihat entri unit lain.
  const lingkup = aktLingkupUnit();
  if(lingkup !== null){
    const u = String(a.unit || '').toLowerCase();
    if(u){
      // Nilai `unit` boleh CSV (mis. entri Hak modul yang menyentuh dua unit).
      const kode = u.split(',').map(s => s.trim()).filter(Boolean);
      if(!kode.some(k => lingkup.includes(k))) return false;
    } else {
      // Entri tanpa unit: satu-satunya jalan lolos adalah kalau ia entri Hak
      // modul yang, dilihat dari daftar petugas saat ini, memang berkait
      // dengan unit saya. Ini menampung entri lama yang belum sempat menulis
      // `unit` — supaya "8 orang" tetap terlihat di layar unit yang
      // orang-orangnya memang di sana.
      if(!aktHakBerkaitDenganUnit(a, lingkup)) return false;
    }
  }
  if(cari){
    const isi = [a.nama, a.oleh, a.rincian, aktModulNama(a.modul), aktAksiNama(a.aksi),
      a.unit ? namaUnit(a.unit) : '', a.sumber === 'elogbook' ? 'e-logbook' : '']
      .filter(Boolean).join(' ').toLowerCase();
    if(!isi.includes(cari.toLowerCase())) return false;
  }
  return true;
}

/** Jam yang terbaca manusia: "3 menit lalu" untuk yang baru, tanggal untuk
    yang sudah lewat sehari. Yang baru terjadi memang itu yang dicari. Jam
    lengkapnya ada di tooltip. */
function aktJam(iso){
  const t = new Date(iso);
  if(isNaN(t)) return '—';
  const detik = Math.round((Date.now() - t) / 1000);
  if(detik < 60)    return T('baru saja','just now');
  if(detik < 3600)  return T(`${Math.round(detik/60)} menit lalu`, `${Math.round(detik/60)} min ago`);
  if(detik < 86400) return T(`${Math.round(detik/3600)} jam lalu`, `${Math.round(detik/3600)} h ago`);
  return t.toLocaleString(LOKAL(), { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function aktJamLengkap(iso){
  const t = new Date(iso);
  return isNaN(t) ? '' : t.toLocaleString(LOKAL(), { dateStyle:'full', timeStyle:'medium' });
}

/** Rincian yang aman untuk HTML, dengan panah "lama → baru" dan tanda
 *  tambah/hapus daftar ditebalkan supaya arah perubahannya terbaca sekilas. */
function aktRincianHtml(teks){
  return esc(teks)
    .replace(/ → /g, ' <b style="color:var(--text)">→</b> ')
    .replace(/(^|· )\+ /g, '$1<b style="color:var(--text)">+</b> ')
    .replace(/(^|· )− /g, '$1<b style="color:var(--fail)">−</b> ');
}

/** Untuk entri Hak modul, tempel daftar nama petugas dari HAK yang sekarang —
 *  supaya log LAMA yang cuma "+8 ditunjuk" tetap bisa dibaca "8 itu siapa".
 *  Untuk entri baru, format servernya sudah sebut nama, jadi ini cuma penegasan
 *  bahwa yang tercatat sekarang memang segitu. */
function aktHakNama(a){
  if(!a || a.modul !== 'hak') return '';
  if(typeof HAK !== 'object' || !HAK) return '';
  const teks = String(a.rincian || '');
  // Cari kode modul yang disebut di rincian (dinas, berkala, dst.), pertahankan
  // urutannya. Tanpa duplikat.
  const disebut = [];
  for(const m of Object.keys(HAK)){
    if(new RegExp('(^|[^a-z-])' + m.replace('-','\\-') + '\\s*[:(]').test(teks)
       && !disebut.includes(m)) disebut.push(m);
  }
  // Cuma modul yang sekarang memang punya orang di daftar Ditunjuk yang
  // ditampilkan — daftar panjang berisi "tidak ada yang ditunjuk" cuma bising
  // dan tidak menjawab pertanyaannya.
  const berisi = disebut.filter(m => ((HAK[m] && HAK[m].petugas) || []).length);
  if(!berisi.length) return '';
  const baris = berisi.map(m=>{
    const p = HAK[m].petugas;
    return `<b>${esc(m)}</b> · ${p.length} ${T('orang','people')}: ${p.map(u=>esc(u)).join(', ')}`;
  }).join('<br>');
  return `<div style="margin-top:6px;padding:7px 10px;background:var(--panel-2);
    border:1px solid var(--line);border-radius:6px;font-size:11.5px;line-height:1.55">
    <div style="color:var(--muted);font-size:10.5px;margin-bottom:4px">${
      T('Ditunjuk sekarang','Currently named')}</div>${baris}</div>`;
}

/** Pilihan saringan Orang: semua akun yang pernah tercatat, urut nama. */
function aktIsiOrang(semua){
  const peta = new Map();
  for(const a of semua){
    const u = String(a.oleh || '');
    if(!u || u === '—' || peta.has(u.toLowerCase())) continue;
    peta.set(u.toLowerCase(), { user:u, nama: a.nama || u });
  }
  const orang = [...peta.values()].sort((x,y)=>String(x.nama).localeCompare(String(y.nama)));
  // Orang yang sedang disaring tetap ada di pilihan walau barisnya sudah
  // tergeser keluar — kalau tidak, saringannya diam-diam lepas.
  if(AKT.saring.orang && !peta.has(AKT.saring.orang.toLowerCase())){
    orang.unshift({ user: AKT.saring.orang, nama: AKT.saring.orang });
  }
  el('fOrangAktivitas').innerHTML = `<option value="">${T('Semua orang','Everyone')}</option>` +
    orang.map(o=>`<option value="${esc(o.user)}"${
      o.user.toLowerCase() === AKT.saring.orang.toLowerCase() ? ' selected' : ''}>${
      esc(o.nama)}${o.nama !== o.user ? ' — ' + esc(o.user) : ''}</option>`).join('');
}

function gambarAktivitas(){
  const tabel = el('tblAktivitas'); if(!tabel || !akun) return;

  const semua = aktSemua();
  const hariIni = new Date(); hariIni.setHours(0,0,0,0);
  const jumlahHariIni = semua.filter(a=>new Date(a.jam) >= hariIni).length;
  const orang = new Set(semua.map(a=>a.oleh).filter(x=>x && x !== '—')).size;
  const saya = semua.filter(a=>akun && a.oleh === akun.user).length;

  // Kalau saringan unit aktif (admin unit), tampilkan cakupannya di ket —
  // supaya kelihatan langsung dari layar apakah pagar-nya benar-benar hidup,
  // dan apa saja unit yang lolos.
  const lingkupUnit = aktLingkupUnit();
  const namaLingkup = lingkupUnit === null ? ''
    : lingkupUnit.map(k => namaUnit(k) || k).join(', ') || T('belum ada unit','no unit yet');
  el('ketAktivitas').textContent = lingkupUnit === null
    ? T('Dashboard dan E-Logbook, untuk seluruh pemakai — ditambah suntingan yang hanya hidup di peramban ini.',
        'Dashboard and E-Logbook, for every user — plus edits that live only in this browser.')
    : T(`Hanya unit Anda: ${namaLingkup}. Aktivitas unit lain tidak ditampilkan di layar ini.`,
        `Only your unit: ${namaLingkup}. Other units' activities are not shown here.`);

  el('ubinAktivitas').innerHTML =
    ubin('biru', T('Tercatat','Recorded'), semua.length,
      lingkupUnit === null ? T('perbuatan yang tersimpan','actions kept')
                           : T(`di unit ${namaLingkup}`, `in unit ${namaLingkup}`)) +
    ubin(jumlahHariIni ? 'kuning' : 'hijau', T('Hari Ini','Today'), jumlahHariIni,
      T('sejak tengah malam','since midnight')) +
    ubin('biru', T('Orang','People'), orang,
      T('akun yang pernah mengubah','accounts that have made changes')) +
    ubin('biru', T('Oleh Anda','By You'), saya,
      T('atas nama akun ini','under this account'));

  const fModul = el('fModulAktivitas');
  const ada = [...new Set(semua.map(a=>a.modul).filter(Boolean))]
    .sort((x,y)=>aktModulNama(x).localeCompare(aktModulNama(y)));
  fModul.innerHTML = `<option value="">${T('Semua modul','All modules')}</option>` +
    ada.map(m=>`<option value="${esc(m)}"${m===AKT.saring.modul?' selected':''}>${
      esc(aktModulNama(m))}</option>`).join('');
  aktIsiOrang(semua);

  const tampil = semua.filter(aktLolosSaring);
  el('ketAktivitasJam').textContent = tampil.length === semua.length
    ? T(`${semua.length} catatan`, `${semua.length} entries`)
    : T(`${tampil.length} dari ${semua.length} catatan`, `${tampil.length} of ${semua.length} entries`);

  tabel.innerHTML = `<thead><tr>
      <th>${T('Waktu','Time')}</th><th>${T('Siapa','Who')}</th>
      <th>${T('Modul','Module')}</th><th>${T('Yang dikerjakan','What was done')}</th>
      <th>Unit</th></tr></thead><tbody>${
    tampil.length ? tampil.map(a=>`<tr>
      <td title="${esc(aktJamLengkap(a.jam))}"><span class="mono" style="font-size:11px">${esc(aktJam(a.jam))}</span>
        ${a.lokal ? `<br><span class="cip" style="font-size:9px">${
          T('peramban ini','this browser')}</span>` : ''}</td>
      <td>${a.oleh && a.oleh !== '—'
        ? `<a href="#" class="akt-orang" data-orang="${esc(a.oleh)}" title="${
            esc(T('Tampilkan riwayat orang ini saja','Show only this person\'s history'))}"
            style="color:inherit;text-decoration:none"><b>${esc(a.nama || a.oleh)}</b></a>
           <br><span class="mono" style="color:var(--muted);font-size:10.5px">${esc(a.oleh)}</span>`
        : `<b>${esc(a.nama || '—')}</b>`}</td>
      <td>${esc(aktModulNama(a.modul))}${a.sumber === 'elogbook'
        ? `<br><span class="cip" style="font-size:9px">E-Logbook</span>` : ''}</td>
      <td><span${AKT_AKSI_BUANG.has(a.aksi) ? ' style="color:var(--fail);font-weight:600"' : ''}>${
          esc(aktAksiNama(a.aksi))}</span>${a.rincian
        ? ` — <span style="color:var(--muted)">${aktRincianHtml(a.rincian)}</span>` : ''}${
          aktHakNama(a)}</td>
      <td>${a.unit
        ? String(a.unit).split(',').map(k=>k.trim()).filter(Boolean).map(k=>esc(namaUnit(k))).join(', ')
        : '<span class="mono" style="color:var(--muted)">—</span>'}</td>
    </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">${
        semua.length
          ? T('Tidak ada yang cocok dengan saringan itu.','Nothing matches that filter.')
          : T('Belum ada yang tercatat. Log ini mulai terisi begitu ada yang disimpan.',
              'Nothing recorded yet. This log starts filling as soon as something is saved.')
      }</td></tr>`}</tbody>`;

  el('catatanAktivitas').innerHTML = `<div class="catatan">
    <b>${T('Dari mana catatan ini.','Where these records come from.')}</b>
    ${T('Jadwal dinas, kegiatan berkala, personel, hak, galeri, peralatan, sparepart, dan ISR dicatat '
      + 'server dashboard. Dokumen E-Logbook — logbook, daily check, LTK, isu, dan lainnya — yang '
      + 'diubah atau dihapus, serta perubahan akun (peran, unit, aktif, hapus), dicatat E-Logbook '
      + 'dan barisnya bertanda <b>E-Logbook</b>. Semuanya memakai identitas sesi Anda yang sungguhan. '
      + 'Yang dicatat cuma perbuatannya: judul dokumen, nama baris yang berubah, peran lama → baru — '
      + 'bukan isi datanya, dan nomor lisensi atau kata sandi tidak pernah ikut masuk ke sini. '
      + 'Klik nama seseorang untuk melihat riwayatnya saja.',
        'The duty roster, recurring jobs, personnel, rights, gallery, equipment, spare parts, and ISR are '
      + 'recorded by the dashboard server. E-Logbook documents — logbook, daily check, damage reports, '
      + 'issues and more: added, changed, deleted — and account changes (role, units, active, deleted) '
      + 'are recorded by E-Logbook, tagged <b>E-Logbook</b>. All use your real session identity. Only '
      + 'the action is recorded: document title, the rows that changed, old role → new — never the data '
      + 'itself, and licence numbers or passwords never end up in here. Click a name to see only their history.')}
    ${AKT.kabar ? `<br><span style="color:var(--fail)">${T('Log server tidak bisa diambil: ',
      'The server log could not be fetched: ')}${esc(AKT.kabar)}</span>` : ''}
    ${AKT.kabarElog ? `<br><span style="color:var(--fail)">${T('Log E-Logbook tidak ikut terambil: ',
      'The E-Logbook log could not be fetched: ')}${esc(AKT.kabarElog)}</span>` : ''}</div>`;
}

/** Ambil ulang lalu gambar. Dipanggil tiap kali layarnya dibuka — log yang
    ditampilkan basi tidak ada gunanya untuk pertanyaan "barusan siapa". */
async function aktSegarkan(){
  await aktMuat();
  gambarAktivitas();
}

el('btnSegarAktivitas').addEventListener('click', ()=>aktSegarkan());
[['fModulAktivitas','modul','change'], ['fOrangAktivitas','orang','change'],
 ['fDariAktivitas','dari','change'], ['fSampaiAktivitas','sampai','change'],
 ['fCariAktivitas','cari','input']].forEach(([id, kunci, peristiwa])=>{
  el(id).addEventListener(peristiwa, (ev)=>{
    AKT.saring[kunci] = ev.target.value.trim();
    gambarAktivitas();
  });
});
// Klik nama → riwayat orang itu saja. Satu pendengar di tabel, bukan satu per
// baris: tabelnya digambar ulang tiap kali saringan berubah.
el('tblAktivitas').addEventListener('click', (ev)=>{
  const a = ev.target.closest && ev.target.closest('.akt-orang');
  if(!a) return;
  ev.preventDefault();
  AKT.saring.orang = a.dataset.orang || '';
  gambarAktivitas();
});
