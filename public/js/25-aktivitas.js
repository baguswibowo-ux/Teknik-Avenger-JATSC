/* =======================================================================
   AKTIVITAS — siapa mengubah apa, dan kapan

   Pertanyaan yang paling sering datang sesudah sebuah data berubah bukan "apa
   yang berubah" melainkan "ini siapa yang mengisi". Sampai sekarang jawabannya
   tersebar dan setengah-setengah: jadwal dinas menyimpan siapa yang terakhir
   menyimpannya, kegiatan berkala menyimpan siapa yang menandai selesai, dan
   sisanya tidak menyimpan apa pun.

   DUA SUMBER, DAN KEDUANYA MEMANG BEDA
     server  — jadwal dinas, kegiatan berkala, personel, hak, galeri. Ditulis
               server.js dengan identitas dari sesi E-Logbook yang sungguhan,
               jadi berlaku untuk semua orang dan tidak bisa dikarang dari
               peramban.
     lokal   — peralatan dan sparepart. Keduanya memang cuma hidup di
               localStorage peramban ini (lihat SUNTINGAN DATABASE UNIT), jadi
               catatannya pun tidak mungkin lebih jauh dari itu. Ditandai
               terang-terangan di tabelnya supaya tidak disangka berlaku
               bersama.

   Yang dicatat cuma perbuatannya — modul, unit, dan sepotong keterangan —
   bukan isi datanya. Log yang menyalin isinya akan jadi salinan kedua dari
   data yang dicatatnya, dan salinan kedua selalu jadi yang tertinggal.
   ======================================================================= */

const AKTIVITAS_KUNCI = 'avenger.aktivitas';
const AKTIVITAS_LOKAL_BATAS = 200;

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
  galeri:     ['Galeri foto','Photo gallery'],
  peralatan:  ['Peralatan','Equipment'],
  sparepart:  ['Sparepart','Spare parts'],
  dokumen:    ['Dokumen','Documents'],
  logo:       ['Logo unit','Unit logo']
};
const aktModulNama = (m) => AKT_MODUL_NAMA[m] ? T(...AKT_MODUL_NAMA[m]) : (m || '—');

const AKT_AKSI_NAMA = {
  tambah:          ['ditambahkan','added'],
  ubah:            ['diubah','changed'],
  hapus:           ['dihapus','deleted'],
  simpan:          ['disimpan','saved'],
  kosongkan:       ['dikosongkan','emptied'],
  atur:            ['daftarnya diatur','list set up'],
  selesai:         ['ditandai selesai','marked done'],
  'batal-selesai': ['tanda selesainya dibatalkan','done mark undone'],
  unggah:          ['diunggah','uploaded'],
  ganti:           ['diganti','replaced'],
  kembalikan:      ['dikembalikan ke bawaan','reset to defaults']
};
const aktAksiNama = (a) => AKT_AKSI_NAMA[a] ? T(...AKT_AKSI_NAMA[a]) : (a || '—');

const AKT = {
  server: [],
  lokal:  [],
  dimuat: false,      // catatan lama sudah dibaca dari localStorage?
  saring: { modul:'', cari:'' },
  kabar:  ''          // sebab kalau log server tidak bisa diambil
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
  try{
    const r = await srvFetch('/aktivitas?batas=200', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    AKT.server = (j && Array.isArray(j.aktivitas)) ? j.aktivitas : [];
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

function aktLolosSaring(a){
  const { modul, cari } = AKT.saring;
  if(modul && a.modul !== modul) return false;
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
    const isi = [a.nama, a.oleh, a.rincian, aktModulNama(a.modul),
      a.unit ? namaUnit(a.unit) : ''].filter(Boolean).join(' ').toLowerCase();
    if(!isi.includes(cari.toLowerCase())) return false;
  }
  return true;
}

/** Jam yang terbaca manusia: "3 menit lalu" untuk yang baru, tanggal untuk
    yang sudah lewat sehari. Yang baru terjadi memang itu yang dicari. */
function aktJam(iso){
  const t = new Date(iso);
  if(isNaN(t)) return '—';
  const detik = Math.round((Date.now() - t) / 1000);
  if(detik < 60)    return T('baru saja','just now');
  if(detik < 3600)  return T(`${Math.round(detik/60)} menit lalu`, `${Math.round(detik/60)} min ago`);
  if(detik < 86400) return T(`${Math.round(detik/3600)} jam lalu`, `${Math.round(detik/3600)} h ago`);
  return t.toLocaleString(LOKAL(), { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
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
    ? T('Dicatat server untuk seluruh pemakai, ditambah suntingan yang hanya hidup di peramban ini.',
        'Recorded by the server for every user, plus edits that live only in this browser.')
    : T(`Hanya unit Anda: ${namaLingkup}. Aktivitas unit lain tidak ditampilkan di layar ini.`,
        `Only your unit: ${namaLingkup}. Other units' activities are not shown here.`);
  el('ketAktivitasJam').textContent = T(`${semua.length} catatan`, `${semua.length} entries`);

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
  const ada = [...new Set(semua.map(a=>a.modul).filter(Boolean))].sort();
  fModul.innerHTML = `<option value="">${T('Semua modul','All modules')}</option>` +
    ada.map(m=>`<option value="${esc(m)}"${m===AKT.saring.modul?' selected':''}>${
      esc(aktModulNama(m))}</option>`).join('');

  const tampil = semua.filter(aktLolosSaring);

  tabel.innerHTML = `<thead><tr>
      <th>${T('Waktu','Time')}</th><th>${T('Siapa','Who')}</th>
      <th>${T('Modul','Module')}</th><th>${T('Yang dikerjakan','What was done')}</th>
      <th>Unit</th></tr></thead><tbody>${
    tampil.length ? tampil.map(a=>`<tr>
      <td><span class="mono" style="font-size:11px">${esc(aktJam(a.jam))}</span>
        ${a.lokal ? `<br><span class="cip" style="font-size:9px">${
          T('peramban ini','this browser')}</span>` : ''}</td>
      <td><b>${esc(a.nama || a.oleh || '—')}</b>${a.oleh && a.oleh !== '—'
        ? `<br><span class="mono" style="color:var(--muted);font-size:10.5px">${esc(a.oleh)}</span>` : ''}</td>
      <td>${esc(aktModulNama(a.modul))}</td>
      <td>${esc(aktAksiNama(a.aksi))}${a.rincian
        ? ` — <span style="color:var(--muted)">${esc(a.rincian)}</span>` : ''}${
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
    <b>${T('Dua sumber, dan bedanya penting.','Two sources, and the difference matters.')}</b>
    ${T('Jadwal dinas, kegiatan berkala, personel, hak, dan galeri dicatat di server dengan identitas '
      + 'dari sesi E-Logbook Anda — berlaku untuk semua orang. Peralatan dan sparepart memang hanya '
      + 'tersimpan di peramban ini, jadi catatannya pun begitu, dan barisnya diberi tanda '
      + '<b>peramban ini</b>. Yang dicatat cuma perbuatannya, bukan isi datanya: nomor lisensi tidak '
      + 'pernah ikut masuk ke sini.',
        'The duty roster, recurring jobs, personnel, rights, and gallery are recorded on the server under '
      + 'your E-Logbook identity — they hold for everyone. Equipment and spare parts are stored in this '
      + 'browser only, so their records are too, and those rows are tagged <b>this browser</b>. Only the '
      + 'action is recorded, never the data itself: licence numbers never end up in here.')}
    ${AKT.kabar ? `<br><span style="color:var(--fail)">${T('Log server tidak bisa diambil: ',
      'The server log could not be fetched: ')}${esc(AKT.kabar)}</span>` : ''}</div>`;
}

/** Ambil ulang lalu gambar. Dipanggil tiap kali layarnya dibuka — log yang
    ditampilkan basi tidak ada gunanya untuk pertanyaan "barusan siapa". */
async function aktSegarkan(){
  await aktMuat();
  gambarAktivitas();
}

el('btnSegarAktivitas').addEventListener('click', ()=>aktSegarkan());
['fModulAktivitas','fCariAktivitas'].forEach(id=>{
  const e = el(id);
  const kunci = id === 'fModulAktivitas' ? 'modul' : 'cari';
  e.addEventListener(id === 'fCariAktivitas' ? 'input' : 'change', ()=>{
    AKT.saring[kunci] = e.value.trim();
    gambarAktivitas();
  });
});

