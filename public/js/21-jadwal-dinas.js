/* =======================================================================
   JADWAL DINAS BULANAN — modul milik dashboard ini

   Yang dijanjikan bagian ini: jadwal bulan yang sedang berjalan bisa dilihat
   siapa saja, dan hanya orang yang ditunjuk yang boleh mengisinya.

   DI MANA JADWALNYA TINGGAL
   Di server ini, data/dinas.json — karena "semua orang bisa lihat" tidak
   mungkin dipenuhi oleh sesuatu yang tersimpan di peramban masing-masing.
   Dulu ada tempat kedua, localStorage, untuk jalan tanpa sesi E-Logbook; ia
   ikut pergi bersama data contoh.

   Bentuknya:  { 'YYYY-MM': { <unit>: [ { nama, peran, hari:[...] } ] } }
   hari[] sepanjang jumlah hari bulan itu; isinya kode dinas unit itu, atau ''
   untuk libur.
   ======================================================================= */


const bulanKode = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const jumlahHari = (bulan) =>
  new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7)), 0).getDate();
const namaBulan = (bulan) => new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7))-1, 1)
  .toLocaleDateString(LOKAL(), { month:'long', year:'numeric' });

/* bulanIni dan lihat diisi sejak awal, bukan menunggu jdwMuatAwal(): layar unit
   bisa saja tergambar lebih dulu — sesi yang dipulihkan langsung membuka unit
   terakhir — dan bulan kosong membuat jumlahHari('') jadi NaN. */
const JDW = {
  bulanIni: bulanKode(new Date()),   // yang mengisi kartu "berdinas hari ini"
  lihat:    bulanKode(new Date()),   // bulan yang sedang dibuka di subtab
  jadwal:   {},      // { unit: [orang] } untuk JDW.bulanIni
  jadwalLihat: {},   // { unit: [orang] } untuk JDW.lihat
  bisaTulis:true,    // server punya penyimpanan tetap?
  sebab:    '',      // kenapa tidak boleh, untuk ditampilkan apa adanya
  sunting:  false,   // subtab sedang dalam mode sunting
  draf:     null     // salinan yang sedang disunting; null di luar mode sunting
};

/* ---------- Ambil dan simpan ---------- */

/** Jadwal satu bulan, dari server dashboard ini. */
async function jdwAmbil(bulan){
  const r = await srvFetch('/dinas/bulan/' + bulan, {}, 10000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  const isi = (j && j.jadwal) || {};
  delete isi._diubah;    // catatan siapa-kapan, bukan baris jadwal
  return isi;
}

/** Muat jadwal bulan berjalan. Dipanggil sekali setelah masuk. */
async function jdwMuatAwal(){
  // Bulannya bisa berganti kalau halaman ini terbuka melewati tengah malam
  // pergantian bulan, jadi disetel ulang di sini — bukan hanya saat lahir.
  JDW.bulanIni = bulanKode(new Date());
  JDW.lihat = JDW.bulanIni;
  await hakMuat();
  if(!JDW.sebab && !BOLEH.dinas) JDW.sebab = hakSebab('dinas');
  try{
    JDW.jadwal = await jdwAmbil(JDW.bulanIni);
    JDW.jadwalLihat = JDW.jadwal;
  }catch(e){
    console.warn('Jadwal dinas tidak bisa diambil:', e && e.message || e);
    JDW.jadwal = {}; JDW.jadwalLihat = {};
  }
}

async function jdwSimpanUnit(bulan, unit, orang){
  const r = await srvFetch('/dinas/bulan/' + bulan + '/' + unit, {
    method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ orang })
  }, 15000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
}

/* ---------- Dinas hari ini, diturunkan dari jadwal bulanan ---------- */

/**
 * Kode dinas yang benar-benar dipakai satu unit pada bulan berjalan.
 *
 * Petak dinas dulu dipasang dari daftar kode unit — enam kode, apa pun isi
 * jadwalnya. Unit yang sepanjang bulan hanya memakai PSJ/PSN/MJ/MN jadi
 * membawa dua kartu P dan S yang selamanya bertuliskan "tidak ada personel",
 * dan kotak yang tidak pernah terisi lebih cepat diabaikan daripada dibaca.
 *
 * Yang dikumpulkan seluruh bulan, bukan hari ini saja: kartu yang lenyap dan
 * muncul lagi tiap ganti hari lebih membingungkan daripada satu kartu kosong,
 * dan shift yang hari ini tidak ada orangnya justru perlu terlihat — itu
 * lubang jaga, bukan shift yang tidak dipakai.
 */
function kodeDipakaiUnit(kode){
  const daftar = JDW.jadwal[kode];
  if(!Array.isArray(daftar)) return [];
  const ada = new Set();
  daftar.forEach(o=>(o.hari || []).forEach(h=>{ if(h) ada.add(h); }));
  /* Urutannya menurut jam mulai, bukan menurut daftar kode unit. Daftar itu
     menaruh PS di depan malam, dan begitu unit ini ternyata tidak memakai PS
     sama sekali, sisanya terbaca terbalik — malam dulu, baru pagi. Jam mulai
     yang dipakai jam dasarnya, sebelum malam mundur ke 13:00; kalau tidak,
     urutannya ikut berubah tiap kali ada yang berdinas P.

     Kode di luar daftar unit — salah ketik yang terlanjur tersimpan — tidak
     punya jam, jadi menyusul di belakang. Tetap terlihat, tidak dibuang. */
  const daftarUnit = infoUnit(kode).dinas || KODE_DINAS;
  const dikenal = [...ada].filter(k=>SHIFT[k])
    .sort((a,b)=>(SHIFT[a].mulai - SHIFT[b].mulai) ||
                 (daftarUnit.indexOf(a) - daftarUnit.indexOf(b)) ||
                 a.localeCompare(b));
  return [...dikenal, ...[...ada].filter(k=>!SHIFT[k]).sort()];
}

/** Petak kosong untuk unit yang jadwalnya belum bisa dibaca. */
function petakBaku(kode){
  const daftarUnit = infoUnit(kode).dinas || KODE_DINAS;
  const inti = daftarUnit.filter(k=>KODE_DINAS_INTI.includes(k));
  return (inti.length ? inti : daftarUnit).map(k=>({ k, o:[] }));
}

/**
 * Petak shift hari ini untuk satu unit, dari jadwal bulan berjalan.
 * null berarti unit itu memang belum punya jadwal — pemanggilnya yang
 * memutuskan apa yang ditampilkan sebagai gantinya.
 */
function dinasHariIni(kode){
  const daftar = JDW.jadwal[kode];
  if(!Array.isArray(daftar) || !daftar.length) return null;
  const hari = new Date().getDate();
  const dipakai = kodeDipakaiUnit(kode);
  const petak = (dipakai.length ? dipakai.map(k=>({ k, o:[] })) : petakBaku(kode));
  daftar.forEach(o=>{
    const k = (o.hari || [])[hari-1];
    if(!k) return;
    // Kode yang tidak ada di petak tetap ditampilkan, tidak dibuang. Nyaris
    // tidak pernah terjadi sekarang — petaknya lahir dari isi jadwal yang
    // sama — tetapi murah, dan menutup celah kalau sumbernya berubah.
    let s = petak.find(x=>x.k === k);
    if(!s){ s = { k, o:[] }; petak.push(s); }
    s.o.push({ n:o.nama, p:o.peran || T('Teknisi','Technician') });
  });
  return petak;
}

/* ---------- Tabel bulanan ---------- */

/** Baris orang untuk unit + bulan yang sedang dibuka. */
const jdwBaris = (unit) => (JDW.jadwalLihat[unit] || []);

function jdwTabel(unit){
  const bulan = JDW.lihat;
  const hariN = jumlahHari(bulan);
  const kodeShift = infoUnit(unit).dinas || [];
  const baris = JDW.sunting ? JDW.draf : jdwBaris(unit);
  const iniBulanIni = bulan === JDW.bulanIni;
  const hariIni = iniBulanIni ? new Date().getDate() : 0;

  const kepala = `<tr><th class="jdw-nama">${T('Nama','Name')}</th><th class="jdw-peran">${
    T('Peran','Role')}</th>` +
    Array.from({length:hariN}, (_,i)=>`<th class="${i+1===hariIni?'jdw-hari-ini':''}">${i+1}</th>`).join('') +
    (JDW.sunting ? '<th></th>' : '') + '</tr>';

  /* Baris penanda kegiatan berkala, tepat di bawah tanggalnya. Di sinilah
     "kegiatan mingguan dan bulanan muncul pada jadwal yang sudah dibuat"
     benar-benar terjadi: yang membaca jadwal untuk mencari nama sendiri
     sekaligus melihat tanggal berapa saja yang ada pekerjaan tetapnya. */
  const adaBerkala = bklDaftar(unit).length;
  const barisBerkala = adaBerkala ? `<tr class="jdw-berkala">
    <td class="jdw-nama" colspan="2">${T('Kegiatan berkala','Recurring jobs')}</td>
    ${Array.from({length:hariN}, (_,i)=>{
      const keg = bklPadaHari(unit, bulan, i + 1);
      if(!keg.length) return `<td class="${i+1===hariIni?'jdw-hari-ini':''}"></td>`;
      // Shift ikut disebut di tooltip, bukan digambar sebagai titik terpisah:
      // barisnya cuma setinggi satu sel per tanggal, dan memecahnya jadi dua
      // titik akan membuat tabel sebulan penuh sulit dibaca sekilas.
      const judul = keg.map(k=>k.nama + (bklShift(k) ? ` (${bklShiftNama(bklShift(k))})` : '')).join(' · ');
      const mingguan = keg.some(k=>k.jenis === 'mingguan');
      return `<td class="${i+1===hariIni?'jdw-hari-ini':''}" title="${esc(judul)}">
        <span class="bkl-titik ${mingguan?'mingguan':'bulanan'}">${keg.length > 1 ? keg.length : '●'}</span></td>`;
    }).join('')}
    ${JDW.sunting ? '<td></td>' : ''}</tr>` : '';

  if(!baris.length){
    return `<table class="jdw"><thead>${kepala}</thead><tbody>${barisBerkala}
      <tr><td colspan="${hariN + 2 + (JDW.sunting?1:0)}" style="text-align:center;color:var(--muted);padding:22px">
        ${T('Belum ada jadwal untuk bulan ini.','No roster for this month yet.')}
      </td></tr></tbody></table>`;
  }

  const isi = baris.map((o,i)=>{
    const sel = (h)=>{
      const nilai = (o.hari || [])[h] || '';
      if(!JDW.sunting){
        return `<td class="${h+1===hariIni?'jdw-hari-ini':''}"${nilai
          ? ` style="color:${warnaShift(nilai, 'var(--text)')}"` : ''}>${esc(nilai) || '·'}</td>`;
      }
      return `<td class="${h+1===hariIni?'jdw-hari-ini':''}"><select data-baris="${i}" data-hari="${h}">
        <option value=""></option>${kodeShift.map(k=>
          `<option value="${esc(k)}"${k===nilai?' selected':''}>${esc(k)}</option>`).join('')}
        ${nilai && !kodeShift.includes(nilai) ? `<option value="${esc(nilai)}" selected>${esc(nilai)}</option>` : ''}
      </select></td>`;
    };
    return `<tr>
      <td class="jdw-nama">${JDW.sunting
        ? `<input type="text" data-baris="${i}" data-kolom="nama" value="${esc(o.nama || '')}">`
        : esc(o.nama || '')}</td>
      <td class="jdw-peran">${JDW.sunting
        ? `<input type="text" data-baris="${i}" data-kolom="peran" value="${esc(o.peran || '')}">`
        : esc(o.peran || '—')}</td>
      ${Array.from({length:hariN}, (_,h)=>sel(h)).join('')}
      ${JDW.sunting ? `<td><button class="btn garis kecil" data-jdw-buang="${i}">✕</button></td>` : ''}
    </tr>`;
  }).join('');

  return `<table class="jdw"><thead>${kepala}</thead><tbody>${barisBerkala}${isi}</tbody></table>`;
}

/** Seluruh isi subtab Jadwal Dinas. Digambar terpisah supaya tombol sunting
    tidak perlu menggambar ulang seluruh layar unit. */
function jdwIsi(unit){
  const u = infoUnit(unit);
  const bulan = JDW.lihat;
  const bolehSunting = BOLEH.dinas && JDW.bisaTulis;

  const kepala = `
    <div class="atur-data">
      <span class="ket">${T('Jadwal','Roster')} ${esc(namaBulan(bulan))} · ${esc(u.nama)}
        ${bulan === JDW.bulanIni ? T('· bulan berjalan','· current month') : ''}</span>
      <span class="tombol">
        <input type="month" id="jdwBulan" value="${esc(bulan)}"${JDW.sunting?' disabled':''}>
        ${JDW.sunting
          ? `<button class="btn garis kecil" id="jdwBatal">${T('Batal','Cancel')}</button>
             <button class="btn garis kecil" id="jdwImpor">${T('Impor dari berkas','Import from a file')}</button>
             <button class="btn garis kecil" id="jdwTambahOrang">${T('Tambah orang','Add person')}</button>
             <button class="btn kecil" id="jdwSimpan">${T('Simpan jadwal','Save roster')}</button>`
          : bolehSunting
            ? `<button class="btn kecil" id="jdwSunting">${T('Sunting jadwal','Edit roster')}</button>`
            : ''}
      </span>
    </div>
    ${bolehSunting || JDW.sunting ? '' : `<div class="catatan" style="margin-top:0"><b>${
      T('Anda hanya bisa melihat jadwal ini.','You can only view this roster.')}</b> ${esc(JDW.sebab)} ${
      T('Jadwal bulan berjalan sengaja terbuka untuk semua akun; yang boleh mengisinya ditentukan per '
        + 'peran oleh administrator, di panel Siapa Boleh Mengisi Apa pada layar Kelola Akun.',
        'The current month roster is deliberately open to every account; who may fill it in is decided '
        + 'per role by an administrator, in the Who May Fill What panel on the Manage Accounts screen.')}</div>`}`;

  const petak = dinasUnit(unit);
  return kepala
    + `<div class="jdw-gulir">${jdwTabel(unit)}</div>`
    + `<div class="dinas-baris" style="margin-top:18px">${
        petak.map(s=>kartuShift(s, kodeTerpakai(petak))).join('')}</div>`
    + `<div class="catatan"><b>${T('Kode yang bisa diisi:','Codes you can fill in:')}</b> ${u.dinas.join(' · ')}.
        ${T('Huruf terakhir menyebut gedungnya — <b>J</b> untuk JATSC, <b>N</b> untuk New JATSC — dan jamnya '
          + 'sama untuk keduanya. Jam dinas dihitung UTC: <b>PS</b> 00:00–12:00, <b>M</b> 12:00–00:00, dan '
          + 'kalau hari itu dipecah <b>P</b> 00:00–07:00 dan <b>S</b> 07:00–13:00, malamnya mundur jadi '
          + '13:00–00:00. <b>SPKL</b> (Surat Perintah Kerja Lembur) mengikuti bentuk shift dasarnya — '
          + '<b>SPKLPSJ</b> berarti SPKL untuk shift PS di JATSC, dan seterusnya — jamnya sama, kartunya '
          + 'berwarna beda. <b>CUTI</b>, <b>CAP</b> (Cuti Alasan Penting/sakit), dan <b>IJIN</b> tetap '
          + 'memasang orangnya di petak hari itu supaya kelihatan siapa yang absen, tetapi tidak '
          + 'dihitung sebagai berdinas. Kartu di atas hanya memuat kode yang benar-benar terisi di '
          + 'jadwal bulan ini; yang tidak dipakai tidak ikut dipasang sebagai kotak kosong.',
            'The last letter names the building — <b>J</b> for JATSC, <b>N</b> for New JATSC — and the hours '
          + 'are the same for both. Shift hours are UTC: <b>PS</b> 00:00–12:00, <b>M</b> 12:00–00:00, and when '
          + 'a day is split into <b>P</b> 00:00–07:00 and <b>S</b> 07:00–13:00, the night moves back to '
          + '13:00–00:00. <b>SPKL</b> (overtime work order) follows its base shift — <b>SPKLPSJ</b> means '
          + 'SPKL during the PS shift at JATSC, and so on — same hours, distinct colour. <b>CUTI</b> (annual '
          + 'leave), <b>CAP</b> (leave for a critical reason / sick), and <b>IJIN</b> (permitted absence) '
          + 'still show the person on that day so an absence is visible, but do not count as on-duty. The '
          + 'cards above carry only the codes this month’s roster actually uses; the rest are not laid out '
          + 'as empty slots.')}</div>`
    + `<div class="catatan"><b>${T('Tersimpan di server ini.','Stored on this server.')}</b> ${
        T('Jadwal yang disimpan di sini terlihat oleh semua orang yang membuka dashboard ini — '
          + 'itu memang gunanya. Modulnya milik dashboard ini, bukan E-Logbook: yang ditanyakan ke '
          + 'E-Logbook hanya siapa Anda, untuk menentukan boleh mengisi atau tidak.',
          'A roster saved here is visible to everyone who opens this dashboard — that is the point. '
          + 'The module belongs to this dashboard, not to E-Logbook: the only thing asked of E-Logbook '
          + 'is who you are, to decide whether you may fill it in.')}</div>`;
}

/** Gambar ulang isi subtab saja. */
function jdwGambar(){
  const kotak = el('s-dinas');
  if(!kotak || !unitDibuka) return;
  kotak.innerHTML = jdwIsi(unitDibuka);
  jdwPasang(unitDibuka);
}

/** Pasang pendengar untuk isi yang barusan digambar. */
function jdwPasang(unit){
  const kotak = el('s-dinas');
  if(!kotak) return;

  const bulanEl = kotak.querySelector('#jdwBulan');
  if(bulanEl) bulanEl.addEventListener('change', async ()=>{
    const b = bulanEl.value;
    if(!/^\d{4}-\d{2}$/.test(b)) return;
    JDW.lihat = b;
    try{
      JDW.jadwalLihat = b === JDW.bulanIni ? JDW.jadwal : await jdwAmbil(b);
    }catch(e){
      pesan(T('Jadwal bulan itu tidak bisa diambil: ','That month could not be fetched: ') + (e && e.message || e));
      JDW.jadwalLihat = {};
    }
    jdwGambar();
  });

  const btnSunting = kotak.querySelector('#jdwSunting');
  if(btnSunting) btnSunting.addEventListener('click', ()=>{
    // Salinan dalam, bukan rujukan: Batal harus benar-benar mengembalikan
    // keadaan sebelum disunting, termasuk kalau sudah puluhan sel diubah.
    JDW.draf = jdwBaris(unit).map(o=>({ nama:o.nama, peran:o.peran, hari:[...(o.hari||[])] }));
    if(!JDW.draf.length) JDW.draf.push({ nama:'', peran:'', hari:[] });
    JDW.sunting = true;
    jdwGambar();
  });

  const btnBatal = kotak.querySelector('#jdwBatal');
  if(btnBatal) btnBatal.addEventListener('click', ()=>{
    JDW.sunting = false; JDW.draf = null; jdwGambar();
  });

  const btnImpor = kotak.querySelector('#jdwImpor');
  if(btnImpor) btnImpor.addEventListener('click', ()=>imporBuka(unit));

  const btnTambah = kotak.querySelector('#jdwTambahOrang');
  if(btnTambah) btnTambah.addEventListener('click', ()=>{
    JDW.draf.push({ nama:'', peran:'', hari:[] });
    jdwGambar();
  });

  const btnSimpan = kotak.querySelector('#jdwSimpan');
  if(btnSimpan) btnSimpan.addEventListener('click', async ()=>{
    // hari[] dirapatkan jadi larik penuh sepanjang bulannya. Menyetel satu sel
    // di tengah larik kosong meninggalkan lubang, dan lubang itu jadi null
    // begitu di-JSON — tersimpan sebagai sesuatu yang bukan kode dinas dan
    // bukan pula kosong.
    const hariN = jumlahHari(JDW.lihat);
    const orang = JDW.draf
      .map(o=>({
        nama:  String(o.nama || '').trim(),
        peran: String(o.peran || '').trim(),
        hari:  Array.from({length:hariN}, (_,i)=>String((o.hari || [])[i] || ''))
      }))
      .filter(o=>o.nama);
    btnSimpan.disabled = true;
    try{
      await jdwSimpanUnit(JDW.lihat, unit, orang);
      JDW.jadwalLihat = { ...JDW.jadwalLihat, [unit]: orang };
      if(JDW.lihat === JDW.bulanIni) JDW.jadwal = JDW.jadwalLihat;
      JDW.sunting = false; JDW.draf = null;
      jdwGambar();
      // Kartu "hari ini" di beranda dan layar Dinas ikut berubah, jadi
      // digambar ulang — bukan menunggu orangnya menyegarkan halaman.
      if(JDW.lihat === JDW.bulanIni) gambarDinas();
      pesan(T('Jadwal tersimpan.','Roster saved.'));
    }catch(e){
      pesan(T('Gagal menyimpan jadwal: ','Could not save the roster: ') + (e && e.message || e));
      btnSimpan.disabled = false;
    }
  });

  if(!JDW.sunting) return;

  // Sel dan isian dalam mode sunting menulis langsung ke draf. Tanpa
  // menggambar ulang: mengetik satu huruf lalu kehilangan kursor membuat
  // tabel selebar 31 kolom ini tidak mungkin diisi.
  kotak.querySelectorAll('.jdw select[data-hari]').forEach(s=>{
    s.addEventListener('change', ()=>{
      const b = JDW.draf[Number(s.dataset.baris)];
      if(!b) return;
      if(!Array.isArray(b.hari)) b.hari = [];
      b.hari[Number(s.dataset.hari)] = s.value;
      s.style.color = warnaShift(s.value, '');
    });
    s.style.color = warnaShift(s.value, '');
  });
  kotak.querySelectorAll('.jdw input[data-kolom]').forEach(i=>{
    i.addEventListener('input', ()=>{
      const b = JDW.draf[Number(i.dataset.baris)];
      if(b) b[i.dataset.kolom] = i.value;
    });
  });
  kotak.querySelectorAll('.jdw button[data-jdw-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      JDW.draf.splice(Number(b.dataset.jdwBuang), 1);
      if(!JDW.draf.length) JDW.draf.push({ nama:'', peran:'', hari:[] });
      jdwGambar();
    });
  });
}

