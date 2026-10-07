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
const sjrBolehTulis = () => SJR.bisaTulis && bolehSuntingDb('sejarah');

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
  }
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

/* =======================================================================
   STIKER QR — satu per alat, ditempel di alatnya

   Yang memindai (tanpa login) mendarat di /q/<token>: lembar Sejarah
   Peralatan RESMI terakhir untuk alat itu — yang sudah disetujui Manager
   Teknik lewat antrian cetak. Tokennya acak dan dibuat server (/qr-alat);
   alat yang sama selalu mendapat token yang sama, jadi mencetak ulang tidak
   mematikan stiker yang sudah tertempel. Gambar QR-nya juga dari server
   (/q/<token>/qr.svg), jadi halaman ini tidak butuh pustaka apa pun.
   ======================================================================= */

/** Alat yang dicetak stikernya lewat "QR semua alat": INDUKNYA saja. Halaman
    pindai induk sudah membawa seluruh sub-unitnya, jadi satu stiker per alat
    cukup. Stiker khusus satu sub-unit masih bisa dicetak dari tombol QR saat
    sub-unit itu sedang dibuka, dan stiker sub yang sudah tertempel tetap hidup. */
function qrDaftarAlat(daftar){
  return (daftar || []).filter(a=>a && a.id)
    .map(a=>({ id:a.id, nama:a.nama || '', sn:a.sn || '' }));
}

/**
 * Minta token lalu buka lembar stiker siap cetak di jendela baru.
 * Jendelanya dibuka DULU, sebelum menunggu server — peramban memblokir
 * jendela yang dibuka sesudah await karena dianggap bukan dari klik.
 */
async function qrCetakStiker(unit, daftar){
  if(!daftar.length){ pesan(T('Tidak ada alat untuk dibuatkan QR.','No equipment to make a QR for.')); return; }
  const jendela = window.open('', '_blank');
  if(!jendela){ pesan(T('Jendela baru diblokir peramban. Izinkan pop-up untuk dashboard ini.',
                        'The browser blocked the new window. Allow pop-ups for this dashboard.')); return; }
  jendela.document.write(`<p style="font:14px Arial;padding:20px">${T('Menyiapkan QR…','Preparing QR…')}</p>`);
  try{
    const u = infoUnit(unit);
    const r = await srvFetch('/qr-alat', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ unit, unitNama:u.nama || unit, kelompok:u.alat || u.nama || '',
                             alat: daftar.map(a=>({ id:a.id, nama:a.nama })) })
    }, 20000);
    const j = await r.json().catch(()=>null);
    if(!r.ok || !j || !j.token) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    const stiker = daftar.filter(a=>j.token[a.id]).map(a=>{
      const t = j.token[a.id];
      return `<div class="stiker">
        <img src="${esc(j.dasar)}/q/${esc(t)}/qr.svg" alt="QR">
        <div class="nama">${esc(a.nama)}</div>
        ${a.sn && a.sn !== '—' ? `<div class="kecil">S/N ${esc(a.sn)}</div>` : ''}
        <div class="kecil">${esc(u.nama || unit)} · ${T('pindai untuk sejarah alat','scan for equipment history')}</div>
      </div>`;
    }).join('');
    jendela.document.open();
    jendela.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>QR ${esc(u.nama || unit)}</title>
      <style>
        @page{size:A4;margin:10mm}
        body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
        .alat{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #ccc;font-size:13px}
        .alat button{padding:6px 14px;font-size:13px}
        .lembar{display:grid;grid-template-columns:repeat(auto-fill,52mm);gap:4mm;padding:4mm}
        .stiker{width:52mm;border:1px dashed #999;padding:3mm;text-align:center;box-sizing:border-box;break-inside:avoid}
        .stiker img{width:40mm;height:40mm;display:block;margin:0 auto 2mm}
        .nama{font-size:9pt;font-weight:bold;line-height:1.2;word-break:break-word}
        .kecil{font-size:7pt;color:#333;margin-top:1mm}
        @media print{.alat{display:none}.lembar{padding:0}}
      </style></head><body>
      <div class="alat"><button onclick="print()">${T('Cetak','Print')}</button>
        <span>${daftar.length} ${T('stiker · gunting di garis putus-putus. Cetak dengan skala 100%.',
          'stickers · cut along the dashed lines. Print at 100% scale.')}</span></div>
      <div class="lembar">${stiker}</div></body></html>`);
    jendela.document.close();
  }catch(e){
    jendela.close();
    pesan(T('QR gagal dibuat: ','Could not make the QR: ') + (e && e.message || e));
  }
}
