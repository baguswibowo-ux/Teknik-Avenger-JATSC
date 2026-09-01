/* E-Logbook · js/12c-daily-check-navigasi.js — Daily check Fasilitas Navigasi (unit ppabn)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Bentuk formnya ikut lembar kertas milik dinas Navigasi: satu tabel per
   fasilitas (ILS di empat runway + DVOR/DME di dua site), dengan lima kolom
   status per baris — Tx 1, Tx 2, Mon 1, Mon 2, Mon Stb. Skema statusnya
   sengaja disamakan dengan Daily Check Radtel JATSC (Frequentis 3020X):
   OK / Alarm / Gangguan yang berputar di setiap klik, supaya bunyi kliknya
   konsisten lintas seksi dan tidak perlu diajar dua kali.

   Legenda pemetaannya:
     ✓ (ok)    = Normal   / Serviceable (di kolom Tx dibaca "S")
     ! (warn)  = Alarm    (biasanya hanya berlaku di kolom Mon)
     ✕ (fail)  = Gangguan / Unserviceable (di kolom Tx dibaca "U/S")
*/

/* Setiap SEKSI = satu fasilitas yang berdiri sendiri.
   - kode   : huruf pendek yang dipakai sebagai bagian kunci penyimpanan
              status per sel. Wajib unik antar seksi.
   - judul  : nama fasilitas apa adanya, tampil sebagai kepala tabel.
   - blok   : sub-tabel. Biasanya satu blok per seksi; boleh > 1 kalau
              satu fasilitas dipecah beberapa kelompok item (contohnya
              memisah "ILS Ground" dari "Marker" dalam satu runway).
       - kolom : deretan label kolom status. Untuk Navigasi selalu lima:
                 Tx 1, Tx 2, Mon 1, Mon 2, Mon Stb.
       - baris : nama item. String tunggal per baris (bukan pasangan
                 kiri/kanan seperti pola 'dua' di JATSC — form Navigasi
                 tidak dua kolom item bersebelahan).

   Nambah item baru = tambah string di `baris`.
   Nambah fasilitas baru = tambah obyek { kode, judul, blok:[...] } di ujung
   array. Kode-nya bisa 'G', 'H', dst. */
const DC_NAV_KOLOM_STD = ['Tx 1','Tx 2','Mon 1','Mon 2','Mon Stb'];

const DC_NAV = [
  { kode:'A', judul:'A. ILS R/W 25 R', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'LLZ', 'GP', 'DME', 'MM', 'OM'
    ]}
  ]},
  { kode:'B', judul:'B. ILS R/W 07 L', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'LLZ', 'GP', 'DME'
    ]}
  ]},
  { kode:'C', judul:'C. ILS R/W 25 L', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'LLZ', 'GP', 'DME'
    ]}
  ]},
  { kode:'D', judul:'D. ILS R/W 07 R', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'LLZ', 'GP', 'DME'
    ]}
  ]},
  { kode:'E', judul:'E. DVOR/DME "CKG"', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'DVOR "CKG"', 'DME "CKG"'
    ]}
  ]},
  { kode:'F', judul:'F. DVOR/DME "DKI"', blok:[
    { judul:'', kolom:DC_NAV_KOLOM_STD, baris:[
      'DVOR "DKI"', 'DME "DKI"'
    ]}
  ]}
];

/**
 * Kunci status per sel. Dipilih supaya lintas seksi tidak pernah bertabrakan,
 * dan tetap terbaca kalau perlu ditelusuri di log:
 *   A|0|2|Mon 1  =  seksi A, blok index 0, baris index 2, kolom "Mon 1"
 *
 * Nama item TIDAK dipakai di kunci — item yang kebetulan bernama sama antar
 * fasilitas (mis. "LLZ" muncul di empat runway) tidak akan menimpa satu
 * sama lain karena `kode` seksinya berbeda.
 */
function navKunci(sk, bi, ri, kk){ return `${sk}|${bi}|${ri}|${kk}`; }

let dcNState = {};

function initDcNState(){
  dcNState = {};
  DC_NAV.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((nama, ri)=>{
        if(!nama) return;
        blok.kolom.forEach(kk=>{
          dcNState[navKunci(seksi.kode, bi, ri, kk)] = 'ok';
        });
      });
    });
  });
}

function cycleNavStatus(s){ return s==='ok' ? 'warn' : (s==='warn' ? 'fail' : 'ok'); }
function navSimbol(s){ return s==='ok' ? '✓' : (s==='warn' ? '!' : '✕'); }

function toggleDcNStatus(k){
  dcNState[k] = cycleNavStatus(dcNState[k] || 'ok');
  renderDcNavTable();
}

/**
 * Kumpulkan temuan (fail = gangguan/US, warn = alarm) untuk ringkas ke daftar.
 * Nama item yang tampil di daftar dibuat manusiawi: "A · LLZ (Tx 1)" bukan
 * kunci teknis "A|0|0|Tx 1", supaya rekap gampang dibaca.
 */
function navTemuan(){
  const fails = [], warns = [];
  DC_NAV.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((nama, ri)=>{
        if(!nama) return;
        blok.kolom.forEach(kk=>{
          const k = navKunci(seksi.kode, bi, ri, kk);
          const s = dcNState[k];
          if(s === 'fail') fails.push(`${seksi.kode} · ${nama} (${kk})`);
          else if(s === 'warn') warns.push(`${seksi.kode} · ${nama} (${kk})`);
        });
      });
    });
  });
  return { fails, warns };
}

/**
 * Gambar seluruh form Navigasi ke dalam #dcNavWrap. Tiap seksi punya kepalanya,
 * tiap blok punya sub-tabelnya sendiri — bentuk yang sama dipakai form JATSC,
 * supaya kalau kelak ada blok kedua per seksi (mis. Marker terpisah), tinggal
 * tambahkan blok kedua di DC_NAV tanpa mengubah pengganda ini.
 */
function renderDcNavTable(){
  const wrap = document.getElementById('dcNavWrap');
  if(!wrap) return;
  const bagian = DC_NAV.map(seksi=>{
    const kepala = `<div class="dc-j-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const sub = b.judul ? `<div class="dc-j-blok-judul">${escapeHtml(b.judul)}</div>` : '';
      const kols = b.kolom;
      const headKols = kols.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
      const rows = b.baris.map((nama, ri)=>{
        const status = kols.map(kk=>{
          const k = navKunci(seksi.kode, bi, ri, kk);
          const s = dcNState[k] || 'ok';
          return `<td><button class="status-btn ${s}" onclick="toggleDcNStatus('${k}')">${navSimbol(s)}</button></td>`;
        }).join('');
        return `<tr><td class="name">${escapeHtml(nama)}</td>${status}</tr>`;
      }).join('');
      return `${sub}<div class="dc-table-wrap">
        <table class="dc dc-j">
          <thead><tr><th>Item</th>${headKols}</tr></thead>
          <tbody>${rows}</tbody></table></div>`;
    }).join('');
    return `<div class="dc-j-seksi">${kepala}${blok}</div>`;
  }).join('');
  wrap.innerHTML = bagian;
}

/** Baca-saja untuk modal detail dan halaman cetak — sel bertombol jadi span,
 *  dan ukuran hurufnya lebih kecil ketika cetak supaya muat di lembar A4. */
function dcNavTabelBaca(state, cetak){
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${s==='ok'?'p-ok':(s==='warn'?'p-warn':'p-fail')}">${navSimbol(s)}</span></td>`
    : `<td><span class="status-btn ${s}" style="cursor:default;">${navSimbol(s)}</span></td>`;

  return DC_NAV.map(seksi=>{
    const kepala = `<div style="font-weight:bold;font-size:${cetak?'9pt':'12px'};margin:${cetak?'6px 0 3px':'10px 0 4px'};">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const sub = b.judul ? `<div style="font-size:${cetak?'8pt':'11px'};color:${cetak?'#333':'var(--muted)'};margin:${cetak?'3px 0 2px':'6px 0 2px'};">${escapeHtml(b.judul)}</div>` : '';
      const kols = b.kolom;
      const headKols = kols.map(k=>`<td>${escapeHtml(k)}</td>`).join('');
      const rows = b.baris.map((nama, ri)=>{
        const stats = kols.map(kk=>{
          const k = navKunci(seksi.kode, bi, ri, kk);
          return sel(state[k] || 'ok');
        }).join('');
        return `<tr><td style="text-align:left;">${escapeHtml(nama)}</td>${stats}</tr>`;
      }).join('');
      const tabel = `<table class="${cetak?'':'dc dc-j'}" style="font-size:${cetak?'7.5pt':''};">
        <thead><tr class="p-kepala"><td>Item</td>${headKols}</tr></thead>
        <tbody>${rows}</tbody></table>`;
      return sub + (cetak ? tabel : `<div class="dc-table-wrap" style="margin-bottom:8px;">${tabel}</div>`);
    }).join('');
    return kepala + blok;
  }).join('');
}

const dcNavDetailHtml = state => dcNavTabelBaca(state, false);

/** Unit mana yang sedang memakai form ini. Navigasi = unit ppabn. */
function dcNavAktif(){ return unitAktif === 'ppabn'; }
