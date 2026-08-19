/* =======================================================================
   SEJARAH PERALATAN — garis waktu yang bisa ditulis

   Sebelum berkas ini ada, isi panel Sejarah datang dari SEJARAH di
   03-suntingan-unit.js: tiga daftar yang ditulis tangan sebagai contoh,
   berkunci id alat. Karena id itu — tx, grx, acp — juga dipakai peralatan
   sungguhan, contohnya ikut tampil di unit yang sudah tersambung ke server,
   dan tidak ada satu pun tanda di layar yang mengatakan bahwa itu karangan.
   Yang membacanya wajar mengira alat itu memang pernah dikalibrasi tahun 2019.

   Sekarang isinya tinggal di server, satu dokumen sendiri, berkunci unit lalu
   id alat. Data contoh tetap dipakai kalau halaman berjalan tanpa server —
   layar yang kosong sama sekali tidak memperlihatkan bentuk garis waktunya.

   Yang boleh menulis: sampai teknisi, tidak seperti daftar peralatannya yang
   berhenti di administrator. Yang tahu apa yang terjadi pada alat adalah orang
   yang berdinas di depannya.
   ======================================================================= */

const SJR = {
  isi: {},            // unit -> { idAlat -> [kejadian] }
  bisaTulis: true,    // simpanan servernya permanen?
  sunting: null       // { unit, alat, daftar } saat panelnya sedang disunting
};

const SJR_WARNA = [
  ['',       ['Biasa','Routine']],
  ['kuning', ['Perlu diperhatikan','Needs watching']],
  ['merah',  ['Gangguan','Fault']]
];

/** Garis waktu satu alat, terbaru di atas. Larik kosong kalau belum ada. */
function sjrUntuk(unit, alatId){
  if(!SRV.aktif) return (SEJARAH_CONTOH[alatId] || []).map((k, i)=>({ id:'c'+i, ...k }));
  return ((SJR.isi[unit] || {})[alatId] || []);
}

async function sjrMuat(){
  if(!SRV.aktif) return;
  try{
    const r = await srvFetch('/sejarah', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok || !j) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    SJR.isi = j.sejarah || {};
    if(typeof j.bisaTulis === 'boolean') SJR.bisaTulis = j.bisaTulis;
  }catch(e){
    console.warn('Sejarah peralatan tidak terbaca:', e && e.message || e);
    SJR.isi = {};
  }
}

/** Boleh menulis sejarah alat di unit yang sedang dibuka? */
const sjrBolehTulis = () => SRV.aktif
  ? (SJR.bisaTulis && bolehSuntingDb('sejarah'))
  : true;    // data contoh: suntingannya cuma di layar, dan itu memang gunanya

/* ---------- Menggambar ---------- */

/** Satu butir garis waktu, keadaan baca. */
const sjrButir = (k) => `
  <div class="butir ${esc(k.warna || '')}">
    <div class="tgl">${k.tgl ? tglRingkas(k.tgl) : T('tanpa tanggal','no date')}${
      k.olehNama ? ' · ' + esc(k.olehNama) : ''}</div>
    <div class="kepala-butir">${esc(k.judul)}</div>
    ${k.rinci ? `<div class="rinci">${esc(k.rinci)}</div>` : ''}
  </div>`;

/** Satu baris dalam keadaan sunting. */
const sjrBarisSunting = (k, i) => `
  <div class="sert-sunting" data-sjr="${i}">
    <div class="isian" style="margin-bottom:0;min-width:140px">
      <label>${T('Tanggal','Date')}</label>
      <input type="date" data-sj="${i}" data-kolom="tgl" value="${esc(k.tgl || '')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:150px">
      <label>${T('Tingkat','Level')}</label>
      <select data-sj="${i}" data-kolom="warna">${SJR_WARNA.map(([nilai, nama])=>
        `<option value="${esc(nilai)}"${nilai === (k.warna || '') ? ' selected' : ''}>${
          esc(T(nama[0], nama[1]))}</option>`).join('')}</select></div>
    <div class="isian" style="margin-bottom:0;flex:2;min-width:180px">
      <label>${T('Kejadian','Event')}</label>
      <input type="text" data-sj="${i}" data-kolom="judul" value="${esc(k.judul || '')}"
        placeholder="${T('mis. Penggantian antena VHF #3','e.g. VHF antenna #3 replaced')}"></div>
    <div class="isian" style="margin-bottom:0;flex:3;min-width:220px">
      <label>${T('Rincian','Details')}</label>
      <input type="text" data-sj="${i}" data-kolom="rinci" value="${esc(k.rinci || '')}"
        placeholder="${T('apa yang dikerjakan, hasilnya, sisa pekerjaannya',
                         'what was done, the result, what is left')}"></div>
    <button class="btn garis kecil" data-sjr-buang="${i}"
      title="${T('Hapus baris ini','Delete this row')}">✕</button>
  </div>`;

/**
 * Isi panel Sejarah untuk satu alat — dipanggil gambarRinciAlat().
 *
 * Dua keadaan dalam satu panel: membaca dan menyunting. Dibuat begitu, bukan
 * lewat kartu melayang seperti personel, karena yang menulis riwayat hampir
 * selalu sedang melihat riwayat yang sudah ada — dan kartu yang menutupinya
 * memaksa orang mengingat apa yang barusan dibacanya.
 */
function sjrPanel(unit, alat){
  const boleh = sjrBolehTulis();
  const sunting = SJR.sunting && SJR.sunting.unit === unit && SJR.sunting.alat === alat.id;
  const daftar = sunting ? SJR.sunting.daftar : sjrUntuk(unit, alat.id);

  const kepala = `<div class="kepala"><h3>${T('Sejarah','History')} — ${esc(alat.nama)}</h3>
    <span style="display:flex;gap:7px;align-items:center">
      <span class="ket">${daftar.length
        ? T('terbaru di atas','newest first')
        : T('belum ada catatan','nothing recorded yet')}</span>
      ${boleh && !sunting ? `<button class="btn garis kecil" id="sjrUbah">${
        T('Tulis','Write')}</button>` : ''}
    </span></div>`;

  if(sunting){
    /* Melebar ke dua kolom selama disunting: enam kotak isian di dalam kolom
       1.55fr milik .grid2 membuat tiap baris terlipat jadi tiga tingkat, dan
       yang sedang menulis riwayat perlu melihat tanggal, judul, dan rinciannya
       sekaligus. */
    return `<div class="panel" style="grid-column:1/-1">${kepala}<div class="badan">
      <div class="atur-data" style="margin-top:0">
        <span class="ket">${daftar.length} ${T('kejadian','events')} · ${
          T('yang paling baru naik sendiri ke atas setelah disimpan',
            'the newest rises to the top on its own once saved')}</span>
        <span class="tombol"><button class="btn garis kecil" id="sjrTambahBaris">${
          T('Tambah kejadian','Add an event')}</button></span>
      </div>
      ${daftar.length ? daftar.map(sjrBarisSunting).join('')
        : `<div style="color:var(--muted);font-size:12.5px;padding:6px 0">${
            T('Belum ada. Tekan Tambah kejadian.','None yet. Press Add an event.')}</div>`}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn garis kecil" id="sjrBatal">${T('Batal','Cancel')}</button>
        <button class="btn kecil" id="sjrSimpan">${T('Simpan','Save')}</button>
      </div>
    </div></div>`;
  }

  return `<div class="panel">${kepala}<div class="badan">${
    daftar.length
      ? `<div class="riwayat">${daftar.map(sjrButir).join('')}</div>`
      : `<div style="color:var(--muted);font-size:12.5px;line-height:1.7">${
          T('Belum ada riwayat untuk alat ini.','No history for this equipment yet.')}
         ${boleh ? T('Tekan Tulis untuk mencatat kejadian pertamanya.',
                     'Press Write to record its first event.')
                 : T('Yang boleh menulisnya ditentukan per peran di Kelola Akun.',
                     'Who may write it is decided per role under Manage Accounts.')}</div>`
  }${SRV.aktif ? '' : `<div class="catatan" style="margin-top:12px">${
      T('Ini data contoh. Suntingannya tidak dikirim ke mana pun dan hilang saat halaman disegarkan.',
        'This is sample data. Edits go nowhere and vanish when the page is refreshed.')}</div>`}
  </div></div>`;
}

/** Pendengar panel Sejarah. Dipanggil sekali tiap gambarRinciAlat(). */
function sjrPasang(unit, alat){
  const ubah = el('sjrUbah');
  if(ubah) ubah.addEventListener('click', ()=>{
    // Salinan dalam, supaya Batal benar-benar mengembalikan keadaan semula.
    SJR.sunting = { unit, alat: alat.id,
      daftar: JSON.parse(JSON.stringify(sjrUntuk(unit, alat.id))) };
    gambarRinciAlat();
  });

  const batal = el('sjrBatal');
  if(batal) batal.addEventListener('click', ()=>{ SJR.sunting = null; gambarRinciAlat(); });

  const tambah = el('sjrTambahBaris');
  if(tambah) tambah.addEventListener('click', ()=>{
    /* Tanpa oleh/olehNama: pencatatnya ditetapkan server dari sesi, dan
       mengirimkannya dari sini cuma akan terbaca seolah layar yang memutuskan. */
    SJR.sunting.daftar.unshift({ id: '', tgl: isoHariIni(), warna: '', judul: '', rinci: '' });
    gambarRinciAlat();
  });

  document.querySelectorAll('[data-sj]').forEach(i=>{
    const k = SJR.sunting && SJR.sunting.daftar[Number(i.dataset.sj)];
    if(!k) return;
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', ()=>{
      k[i.dataset.kolom] = i.value;
    });
  });
  document.querySelectorAll('[data-sjr-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      SJR.sunting.daftar.splice(Number(b.dataset.sjrBuang), 1);
      gambarRinciAlat();
    });
  });

  const simpan = el('sjrSimpan');
  if(simpan) simpan.addEventListener('click', ()=>sjrSimpan(unit, alat));
}

async function sjrSimpan(unit, alat){
  const tombol = el('sjrSimpan');
  // Baris tanpa judul dibuang tanpa berkata apa-apa: menekan Tambah kejadian
  // lalu berubah pikiran bukan kesalahan yang perlu dilaporkan.
  const daftar = SJR.sunting.daftar.filter(k=>String(k.judul || '').trim());

  if(!SRV.aktif){
    // Data contoh: suntingannya tinggal di layar ini saja, dan panelnya sudah
    // mengatakan begitu. Tidak ada yang perlu dikirim.
    SEJARAH_CONTOH[alat.id] = daftar.map(({ id:_buang, ...sisa })=>sisa);
    SJR.sunting = null; gambarRinciAlat();
    return;
  }

  tombol.disabled = true;
  try{
    const r = await srvFetch(`/sejarah/${encodeURIComponent(unit)}/${encodeURIComponent(alat.id)}`, {
      method:'PUT', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ sejarah: daftar })
    }, 15000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    // Yang dipakai jawaban server, bukan kiriman: id baris baru lahir di sana,
    // dan urutannya juga ditentukan di sana.
    if(!SJR.isi[unit]) SJR.isi[unit] = {};
    if(j.sejarah && j.sejarah.length) SJR.isi[unit][alat.id] = j.sejarah;
    else delete SJR.isi[unit][alat.id];
    SJR.sunting = null;
    gambarRinciAlat();
    aktCatat('sejarah', 'tulis', unit, alat.nama);
    pesan(T('Sejarah tersimpan.','History saved.'));
  }catch(e){
    pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
  }finally{
    if(tombol) tombol.disabled = false;
  }
}
