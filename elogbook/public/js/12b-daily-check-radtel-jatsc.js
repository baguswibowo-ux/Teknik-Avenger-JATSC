/* E-Logbook · js/12b-daily-check-radtel-jatsc.js — Daily check VCS Frequentis 3020X (Radtel JATSC)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Radtel punya dua lokasi peralatan yang bentuk daily check-nya berbeda: New
   JATSC memakai VCS Garex 300 (berkas 12), sedangkan JATSC lama masih memakai
   VCS Frequentis 3020X — daftar itemnya, kolomnya, dan pembagian bloknya
   ikut form fisiknya sendiri. Skema statusnya tetap sama Garex: OK / Alarm /
   Gangguan, supaya klik-nya konsisten dengan form Radtel di sebelah. */

/* Setiap BLOK = satu tabel kecil dengan barisnya sendiri.
   - kolom  : deretan status per baris. 'A'/'B' untuk redundan network,
              'STATUS' untuk yang cuma satu status per baris, '1'..'6' untuk
              tabel Power Supply yang membawa enam kolom pemeriksaan harian.
   - baris  : array item. String tunggal untuk tabel satu kolom item. Array
              [kiri, kanan] untuk tabel dua kolom item bersebelahan (mengikuti
              tata letak form fisiknya).
   - dua    : true kalau baris dibaca sebagai pasangan kiri/kanan. */
const DC_JATSC = [
  { kode:'A', judul:'A. VCS FREQUENTIS 3020X', blok:[
    { judul:'Power Supply', kolom:['1','2','3','4','5','6'], baris:[
      'Power Supply CAB 1','Power Supply CAB 2','Power Supply CAB 3'
    ]},
    { judul:'CIF & JIF', dua:true, kolom:['A','B'], baris:[
      ['CIF','JIF 8'],   ['JIF 1','JIF 9'],  ['JIF 2','JIF 10'],
      ['JIF 3','JIF 11'],['JIF 4','JIF 12'], ['JIF 5','JIF 13'],
      ['JIF 6','JIF 14'],['JIF 7','JIF 15']
    ]},
    { judul:'CWP (E1)', dua:true, kolom:['A','B'], baris:[
      ['CWP 15/ CD 2','CWP 44/ WS RADTEK'],
      ['CWP 16/ GND 2','CWP 45/ MER'],
      ['CWP 17/ TWR 2','CWP 54/ MANTEK'],
      ['CWP 18/ CD 1','CWP 56/ GND 3'],
      ['CWP 19/ GND 1','CWP 57/ RADKOM'],
      ['CWP 20/ TWR 1',''],
      ['CWP 21/ SPV TWR 2',''],
      ['CWP 22/ SPV TWR 1','']
    ]}
  ]},
  { kode:'B', judul:'B. RECORDING DIVOS 3 LOG3.2', blok:[
    { judul:'Power Supply', kolom:['STATUS'], baris:[
      'POWER-A1','POWER-B1','POWER-A2','POWER-B2'
    ]},
    { judul:'Server & Network', dua:true, kolom:['A','B'], baris:[
      ['DB A01','SL A01'],['DB B01','SL B01'],
      ['CLIENT DCLI 01','SL A02'],['CLIENT DCLI 02','SL B02'],
      ['CLIENT DCLI 03','SL A03'],['VL A01','SL B03'],
      ['VL B01','SL A04'],['VL A02','SL B04'],
      ['VL B02','']
    ]}
  ]},
  // C. DIRECT SPEECH — checklist ringkas: Link Domestik + Link International.
  { kode:'C', judul:'C. DIRECT SPEECH', blok:[
    { judul:'', kolom:['STATUS'], baris:['LINK DOMESTIK'] },
    { judul:'LINK INTERNATIONAL', kolom:['STATUS'], baris:[
      'SMC LAUT','VSAT','VPN','CRV'
    ]}
  ]},
  { kode:'D', judul:'D. MASTER CLOCK (BODET)', blok:[
    { judul:'Server', kolom:['STATUS'], baris:['NTP A','NTP B'] }
  ]},
  { kode:'E', judul:'E. JARINGAN', blok:[
    { judul:'MUX Megaplex 4100 (Jar. 720)', kolom:['A','B'], baris:[
      'Modul PSU','Link FO','Radio Link'
    ]},
    { judul:'MUX Luxcom (Jar. 710)', kolom:['A','B'], baris:[
      'PSU Primary','PSU Secondary','Link FO Primary','Link FO Secondary'
    ]},
    { judul:'Radio Link Loop Telecom (Jar. 720)', kolom:['STATUS'], baris:[
      'PSU','Card CCA','Card TDMoE','Card E&M'
    ]},
    { judul:'MUX Hua Huan (Jar. 710)', kolom:['A','B'], baris:[
      'Modul PSU','Link FO'
    ]},
    { judul:'Jaringan FO ILS Selatan (Alcatel)', kolom:['A','B'], baris:[
      'Link FO SW. Alcatel'
    ]},
    { judul:'Radio Link CKG 3', kolom:['STATUS'], baris:['Link A','Link B'] }
  ]}
];

/**
 * Kunci status per sel. Dipilih supaya lintas seksi tidak pernah bertabrakan,
 * dan tetap terbaca kalau perlu ditelusuri di log:
 *   A|0|2|B   =  seksi A, blok index 0, baris index 2, kolom "B"
 *
 * Nama item TIDAK dipakai di kunci — item yang kebetulan bernama sama antar
 * blok (mis. "Modul PSU" muncul di banyak MUX) akan menimpa satu sama lain.
 */
function jatscKunci(sk, bi, ri, kk){ return `${sk}|${bi}|${ri}|${kk}`; }

/* ---------- Daftar channel DS — sampling 9 sesi (95 channel) ----------
   DIPAKAI OLEH TAB "DS TEST" (js/17-ds-test.js), bukan lagi oleh Daily Check
   JATSC. Section C Daily Check sekarang cuma checklist ringkas (lihat DC_JATSC
   di atas). Konstanta ini tetap di sini karena DS Test memakainya ulang.

   Daftar channel diambil dari workbook "Checklist Pengecekan DS" (sheet
   DATABASE DS). 64 Domestik + 31 Internasional = 95, dibagi pola selang-seling
   ke 9 sesi supaya setiap channel tersentuh persis sekali per siklus:

     Sesi ganjil (1,3,5,7,9): 8 Domestik + 3 Internasional = 11 channel
     Sesi genap  (2,4,6,8)  : 6 Domestik + 4 Internasional = 10 channel */
const DS_DOM = [
  'ATANG SJY','BTH','BTJ','CILA CAP','HLM PK','JOG','MDN FIC','MDN TMA',
  'PGK TWR','PK.BUN','PKU EAST','PKU WEST','SRG','SUB','TASIK MALAYA','TJQ',
  'UPG RUPKA','UPG UK','UPG US','KALI JATI','KTJ FSS','KTJ TMA','KTJ UJOG',
  'PKU 4','PNK 2','PNK APP','PNK FIC','HLM FIC','PK UTARA','SPV TWR JATSC',
  'SLI UM','SLI UK','SLI MWARA','BDO','BDT','CD1 JATSC','CD2 JATSC',
  'GND1 JATSC','GND2 JATSC','PLB APP','PLB PKP','PNK TMA','TKG',
  'TNJ NORTH','TNJ SOUTH','TWR1 JATSC','TWR2 JATSC','JKCN','JKTS','JKTE',
  'JKTW','6165','SLI 6176','SLI 6129','CD-TWR','6103','ARO_JATSC','6187',
  '5044','NOTOF','GSM','SLI ARO 6110','SLI FIC 6188','SLI FDO 6123'
];
const DS_INTL = [
  'KUL ANSAX CRV','KUL PUGER CRV','KUL SALAX MDN','KUL SALAX PKU',
  'SIN 5C LUSMO','SIN 5P LUSMO','SIN 6P ELGOR','SIN 6P OSERU',
  'SIN 6C ELGOR','KBL OKADA','KCH AOBA','KCH PAPSA','BNE KIY',
  'CHENNAI CRV','KBL VPN','KUL ANSAX','KUL PUGER','KUL SALAX',
  'MLB1 POSOD','MLB2 SAPDA','SIN1-4C TOMAN','SIN1-4P TOMAN',
  'SIN1C PARDI','SIN1P PARDI','SIN2P TAROS','SIN TAROS CRV',
  'KBL CRV','KCH 1 VPN','KCH CRV','SIN RADIO','SZB 1 VPN'
];

const DS_PLAN = (function(){
  const plan = []; let d = 0, i = 0;
  for(let s = 1; s <= 9; s++){
    const ganjil = (s % 2 === 1);
    const nd = ganjil ? 8 : 6, ni = ganjil ? 3 : 4;
    plan.push({ sesi:s, dom:DS_DOM.slice(d, d+nd), intl:DS_INTL.slice(i, i+ni) });
    d += nd; i += ni;
  }
  return plan;
})();

/** Kunci status per channel. Karena satu channel hanya muncul di satu sesi,
    kuncinya cukup pakai nama channel — tidak perlu ikut nomor sesi. */
function dsKunci(nama){ return 'DS|' + nama; }

let dcJState = {};

function initDcJState(){
  dcJState = {};
  // Init state hanya menyiapkan default 'ok' untuk tiap sel yang bakal dirender.
  DC_JATSC.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((br, ri)=>{
        const pasang = Array.isArray(br) ? br : [br];
        // Untuk blok 'dua' item bisa kosong — sengaja untuk sel kosong di form
        // fisik. Yang kosong tidak dibuatkan statusnya.
        pasang.forEach((nama, si)=>{
          if(!nama) return;
          blok.kolom.forEach(kk=>{
            const k = jatscKunci(seksi.kode, bi, ri * 2 + si, kk);
            dcJState[k] = 'ok';
          });
        });
      });
    });
  });
}

function cycleJatscStatus(s){ return s==='ok' ? 'warn' : (s==='warn' ? 'fail' : 'ok'); }
function jatscSimbol(s){ return s==='ok' ? '✓' : (s==='warn' ? '!' : '✕'); }

function toggleDcJStatus(k){
  dcJState[k] = cycleJatscStatus(dcJState[k] || 'ok');
  renderDcJatscTable();
}

/**
 * Kumpulkan temuan (fail = gangguan, warn = alarm) untuk ringkas ke daftar.
 * Nama item yang tampil di daftar dibuat manusiawi: "A · Power Supply CAB 1"
 * bukan kunci teknis "A|0|0|1", supaya rekap gampang dibaca.
 */
function jatscTemuan(){
  const fails = [], warns = [];
  DC_JATSC.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((br, ri)=>{
        const pasang = Array.isArray(br) ? br : [br];
        pasang.forEach((nama, si)=>{
          if(!nama) return;
          blok.kolom.forEach(kk=>{
            const k = jatscKunci(seksi.kode, bi, ri * 2 + si, kk);
            const s = dcJState[k];
            if(s === 'fail') fails.push(`${seksi.kode} · ${nama} (${kk})`);
            else if(s === 'warn') warns.push(`${seksi.kode} · ${nama} (${kk})`);
          });
        });
      });
    });
  });
  return { fails, warns };
}

/**
 * Gambar seluruh form JATSC ke dalam #dcJatscWrap. Tiap seksi punya kepalanya,
 * tiap blok punya sub-tabelnya. Blok "dua" digambar sebagai satu tabel dengan
 * dua rangkap kolom di sampingnya — sama seperti bentuk form fisiknya.
 */
function renderDcJatscTable(){
  const wrap = document.getElementById('dcJatscWrap');
  if(!wrap) return;
  const bagian = DC_JATSC.map(seksi=>{
    const kepala = `<div class="dc-j-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const sub = b.judul ? `<div class="dc-j-blok-judul">${escapeHtml(b.judul)}</div>` : '';
      const kols = b.kolom;

      if(b.dua){
        // Kepala: NAMA | kolom... | NAMA | kolom...
        const headKols = kols.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
        const rows = b.baris.map((br, ri)=>{
          const cell = (nama, si)=>{
            if(!nama) return `<td class="name" style="color:var(--muted);">—</td>` + '<td></td>'.repeat(kols.length);
            const status = kols.map(kk=>{
              const k = jatscKunci(seksi.kode, bi, ri * 2 + si, kk);
              const s = dcJState[k] || 'ok';
              return `<td><button class="status-btn ${s}" onclick="toggleDcJStatus('${k}')">${jatscSimbol(s)}</button></td>`;
            }).join('');
            return `<td class="name">${escapeHtml(nama)}</td>${status}`;
          };
          return `<tr>${cell(br[0], 0)}${cell(br[1], 1)}</tr>`;
        }).join('');
        return `${sub}<div class="dc-table-wrap">
          <table class="dc dc-j">
            <thead><tr><th>${escapeHtml('Item')}</th>${headKols}<th>${escapeHtml('Item')}</th>${headKols}</tr></thead>
            <tbody>${rows}</tbody></table></div>`;
      }

      // Blok satu-kolom: NAMA | kolom...
      const headKols = kols.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
      const rows = b.baris.map((br, ri)=>{
        const nama = br;
        const status = kols.map(kk=>{
          const k = jatscKunci(seksi.kode, bi, ri * 2, kk);
          const s = dcJState[k] || 'ok';
          return `<td><button class="status-btn ${s}" onclick="toggleDcJStatus('${k}')">${jatscSimbol(s)}</button></td>`;
        }).join('');
        return `<tr><td class="name">${escapeHtml(nama)}</td>${status}</tr>`;
      }).join('');
      return `${sub}<div class="dc-table-wrap">
        <table class="dc dc-j">
          <thead><tr><th>${escapeHtml('Item')}</th>${headKols}</tr></thead>
          <tbody>${rows}</tbody></table></div>`;
    }).join('');
    return `<div class="dc-j-seksi">${kepala}${blok}</div>`;
  }).join('');
  wrap.innerHTML = bagian;
}

/** Baca-saja untuk modal detail dan halaman cetak — sel bertombol jadi span,
 *  dan ukuran hurufnya lebih kecil ketika cetak supaya muat di lembar A4. */
function dcJatscTabelBaca(state, cetak){
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${s==='ok'?'p-ok':(s==='warn'?'p-warn':'p-fail')}">${jatscSimbol(s)}</span></td>`
    : `<td><span class="status-btn ${s}" style="cursor:default;">${jatscSimbol(s)}</span></td>`;

  return DC_JATSC.map(seksi=>{
    const kepala = `<div style="font-weight:bold;font-size:${cetak?'9pt':'12px'};margin:${cetak?'6px 0 3px':'10px 0 4px'};">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const sub = b.judul ? `<div style="font-size:${cetak?'8pt':'11px'};color:${cetak?'#333':'var(--muted)'};margin:${cetak?'3px 0 2px':'6px 0 2px'};">${escapeHtml(b.judul)}</div>` : '';
      const kols = b.kolom;
      const headKols = kols.map(k=>`<td>${escapeHtml(k)}</td>`).join('');
      let tabel;
      if(b.dua){
        const rows = b.baris.map((br, ri)=>{
          const cell = (nama, si)=>{
            if(!nama) return `<td></td>` + '<td></td>'.repeat(kols.length);
            const stats = kols.map(kk=>{
              const k = jatscKunci(seksi.kode, bi, ri * 2 + si, kk);
              return sel(state[k] || 'ok');
            }).join('');
            return `<td style="text-align:left;">${escapeHtml(nama)}</td>${stats}`;
          };
          return `<tr>${cell(br[0], 0)}${cell(br[1], 1)}</tr>`;
        }).join('');
        tabel = `<table class="${cetak?'':'dc dc-j'}" style="font-size:${cetak?'7.5pt':''};">
          <thead><tr class="p-kepala"><td>Item</td>${headKols}<td>Item</td>${headKols}</tr></thead>
          <tbody>${rows}</tbody></table>`;
      }else{
        const rows = b.baris.map((br, ri)=>{
          const nama = br;
          const stats = kols.map(kk=>{
            const k = jatscKunci(seksi.kode, bi, ri * 2, kk);
            return sel(state[k] || 'ok');
          }).join('');
          return `<tr><td style="text-align:left;">${escapeHtml(nama)}</td>${stats}</tr>`;
        }).join('');
        tabel = `<table class="${cetak?'':'dc dc-j'}" style="font-size:${cetak?'7.5pt':''};">
          <thead><tr class="p-kepala"><td>Item</td>${headKols}</tr></thead>
          <tbody>${rows}</tbody></table>`;
      }
      return sub + (cetak ? tabel : `<div class="dc-table-wrap" style="margin-bottom:8px;">${tabel}</div>`);
    }).join('');
    return kepala + blok;
  }).join('');
}

const dcJatscDetailHtml = state => dcJatscTabelBaca(state, false);

/** Unit dan lokasi mana yang sedang memakai form ini. Radtel + Lokasi=JATSC. */
function dcRadtelJatscAktif(){
  if(unitAktif !== 'radtel') return false;
  const sel = document.getElementById('dcLokasi');
  return sel && sel.value === 'jatsc';
}
