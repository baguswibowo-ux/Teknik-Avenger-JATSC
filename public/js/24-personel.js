/* =======================================================================
   PERSONEL — sertifikat, lisensi, rating, dan masa berlakunya

   Yang dijaga di sini satu hal: tidak ada orang yang berdinas dengan lisensi
   yang sudah mati tanpa ada yang tahu sebelumnya. Perpanjangan lisensi ATSEP
   bukan pekerjaan sehari — ada berkas, ada jadwal ujian, ada tanda tangan yang
   menunggu — jadi peringatannya dipasang DUA BULAN di muka, bukan pada hari
   habisnya. Dua bulan itu yang diminta, dan angkanya berdiri di satu tempat
   (SERT_AWAS) supaya bisa digeser tanpa mencari-cari.

   Peringatannya berjalan di dua jalur sekaligus, dan keduanya perlu:
     · beranda — papan bersama, supaya yang mengatur dinas ikut melihatnya
     · lonceng — ke akun orangnya sendiri, karena yang harus mengurus berkasnya
                 memang dia, dan papan bersama gampang dianggap urusan orang lain

   Jalur kedua itu yang membuat setiap baris personel punya kolom `username`:
   tanpanya, data ini cuma daftar nama yang tidak tahu harus memberi tahu siapa.
   ======================================================================= */

const PERSONEL_KUNCI = 'avenger.personel';
const SERT_AWAS = 60;                 // hari sebelum habis, saat peringatannya menyala
const SERT_JENIS = ['Lisensi','Rating','Sertifikat','Medical','Lainnya'];
const SERT_JENIS_EN = { 'Lisensi':'Licence','Rating':'Rating','Sertifikat':'Certificate',
  'Medical':'Medical','Lainnya':'Other' };
const sertJenisNama = (j) => BHS === 'en' ? (SERT_JENIS_EN[j] || j) : j;

/* Personel contoh — alasannya sama dengan kegiatan berkala: modul yang dibuka
   pertama kali dalam keadaan kosong tidak memperlihatkan apa pun tentang
   bentuknya. Tanggalnya dihitung dari hari ini, bukan ditulis mati, supaya
   contoh "hampir habis" tetap hampir habis kapan pun berkas ini dibuka. */
const geserHari = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
};
const personelContoh = () => [
  { id:'p1', nama:'B. Santoso', unit:'radtel', username:'radtel', jabatan:'Teknisi Radtel',
    sertifikat:[
      { jenis:'Lisensi', nama:'ATSEP Licence', nomor:'ATSEP/2019/0417', rating:'COM · Radio Telephony',
        terbit:geserHari(-1400), berlaku:geserHari(41) },
      { jenis:'Rating', nama:'Rating Radio Telephony', nomor:'RT-0417', rating:'Level 3',
        terbit:geserHari(-700), berlaku:geserHari(310) }
    ] },
  { id:'p2', nama:'A. Rahman', unit:'radkom', username:'radkom', jabatan:'Teknisi Radkom',
    sertifikat:[
      { jenis:'Lisensi', nama:'ATSEP Licence', nomor:'ATSEP/2018/0219', rating:'COM · Voice Switching',
        terbit:geserHari(-1900), berlaku:geserHari(-12) }
    ] },
  { id:'p3', nama:'D. Prasetyo', unit:'listrikmekanik', username:'listrik', jabatan:'Teknisi Listrik',
    sertifikat:[
      { jenis:'Sertifikat', nama:'K3 Listrik', nomor:'K3L/2024/118', rating:'',
        terbit:geserHari(-500), berlaku:geserHari(220) },
      { jenis:'Medical', nama:'Medical Check-up', nomor:'', rating:'',
        terbit:geserHari(-330), berlaku:geserHari(35) }
    ] },
  { id:'p4', nama:'M. Fauzi', unit:'', username:'pejabat', jabatan:'Manager Teknik',
    sertifikat:[
      { jenis:'Lisensi', nama:'ATSEP Licence', nomor:'ATSEP/2012/0088', rating:'SUR · Radar',
        terbit:geserHari(-2600), berlaku:geserHari(600) }
    ] }
];

const PSN = {
  daftar:  [],
  boleh:   false,   // akun ini boleh mengubah?
  masuk:   true,    // nomor lisensinya utuh, atau sudah dipotong server?
  dibuka:  null,    // salinan orang yang sedang terbuka di kartu; null = tambah
  saring:  { unit:'', sert:'', cari:'' }
};

/** Sisa hari sampai habis. null kalau tanggalnya memang belum diisi. */
const sertSisa = (s) => {
  if(!s || !s.berlaku) return null;
  const kini = new Date(); kini.setHours(0,0,0,0);
  return Math.round((new Date(s.berlaku + 'T00:00:00') - kini) / 86400000);
};
const sertRupa = (sisa) => sisa == null ? '' : sisa < 0 ? 'bahaya' : sisa <= SERT_AWAS ? 'awas' : 'aman';

/** Seluruh sertifikat yang perlu diperhatikan, lintas orang, terdesak di atas. */
function sertPerhatian(){
  const keluar = [];
  PSN.daftar.forEach(p=>(p.sertifikat || []).forEach(s=>{
    const sisa = sertSisa(s);
    if(sisa == null || sisa > SERT_AWAS) return;
    keluar.push({ orang:p, s, sisa });
  }));
  return keluar.sort((a,b)=>a.sisa - b.sisa);
}

/* ---------- Ambil dan simpan ---------- */

function psnLokalMuat(){
  try{
    const s = JSON.parse(localStorage.getItem(PERSONEL_KUNCI) || 'null');
    if(Array.isArray(s) && s.length) return s;
  }catch(e){ /* rusak: pakai contoh */ }
  return personelContoh();
}
function psnLokalSimpan(){
  try{ localStorage.setItem(PERSONEL_KUNCI, JSON.stringify(PSN.daftar)); }
  catch(e){ console.warn('Data personel tidak bisa disimpan di peramban:', e && e.message || e); }
}

async function psnMuat(){
  if(!SRV.aktif){
    PSN.daftar = psnLokalMuat();
    PSN.boleh = BOLEH.personel;
    PSN.masuk = true;
    return;
  }
  try{
    const r = await srvFetch('/personel', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    PSN.daftar = (j && Array.isArray(j.personel)) ? j.personel : [];
    PSN.boleh  = !!(j && j.boleh);
    PSN.masuk  = !!(j && j.masuk);
  }catch(e){
    console.warn('Data personel tidak bisa diambil:', e && e.message || e);
    PSN.daftar = []; PSN.boleh = false;
  }
}

async function psnSimpan(aksi, orang){
  if(!SRV.aktif){
    psnLokalSimpan();
    aktCatat('personel', aksi || 'ubah', (orang && orang.unit) || '', (orang && orang.nama) || '');
    return;
  }
  const r = await srvFetch('/personel', {
    method:'PUT', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ personel: PSN.daftar })
  }, 15000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
}

/* ---------- Personel di dalam Database Unit ----------

   Dulu ini layar tersendiri di rel navigasi, berisi seluruh orang dari seluruh
   unit sekaligus. Sekarang ia duduk sebagai subtab di Database Unit — satu unit
   satu daftar — karena begitulah data ini dipakai: yang mengurus lisensi Radtel
   adalah orang Radtel, dan daftar lintas unit membuat setiap pencarian dimulai
   dengan menyaring.

   Yang TIDAK ikut pindah adalah peringatannya. Sertifikat yang mendekati habis
   tetap muncul di beranda untuk semua orang dan di lonceng akun orangnya
   sendiri. Peringatan yang baru terlihat kalau unitnya kebetulan dibuka bukan
   peringatan. */

const psnUnit = (unit) => PSN.daftar.filter(p=>(p.unit || '') === unit);

/** Sertifikat yang perlu diperhatikan di satu unit — untuk angka di subtabnya. */
const psnAwasUnit = (unit) => sertPerhatian().filter(x=>(x.orang.unit || '') === unit).length;

/* Orang yang belum punya unit. Ditampilkan di tiap unit, tapi hanya kepada yang
   boleh mengubah: baris lama yang terlanjur kosong harus ada yang membereskan,
   dan kalau tidak muncul di mana pun ia hilang tanpa ada yang tahu. */
const psnTanpaUnit = () => PSN.daftar.filter(p=>!(p.unit || ''));

function psnLolosSaring(p){
  const { sert, cari } = PSN.saring;
  if(sert){
    const daftar = p.sertifikat || [];
    const cocok =
      sert === 'kosong' ? daftar.some(s=>!s.berlaku) || !daftar.length
    : sert === 'habis'  ? daftar.some(s=>{ const n = sertSisa(s); return n != null && n < 0; })
    :                     daftar.some(s=>{ const n = sertSisa(s); return n != null && n >= 0 && n <= SERT_AWAS; });
    if(!cocok) return false;
  }
  if(cari){
    const q = cari.toLowerCase();
    const isi = [p.nama, p.jabatan, p.username,
      ...(p.sertifikat || []).flatMap(s=>[s.nama, s.nomor, s.rating, s.jenis])]
      .filter(Boolean).join(' ').toLowerCase();
    if(!isi.includes(q)) return false;
  }
  return true;
}

/** Satu baris tabel personel. Dipakai dua kali — daftar unit ini, dan daftar
    orang yang belum punya unit — jadi dibangun sekali di sini. */
function psnBaris(p){
  const daftar = p.sertifikat || [];
  const terdekat = daftar
    .map(s=>({ s, sisa: sertSisa(s) }))
    .filter(x=>x.sisa != null)
    .sort((a,b)=>a.sisa - b.sisa)[0];
  const rupa = terdekat ? sertRupa(terdekat.sisa) : '';
  return `<tr>
    <td><b>${esc(p.nama)}</b>${p.username
      ? `<br><span class="mono" style="color:var(--muted);font-size:10.5px">${esc(p.username)}</span>` : ''}</td>
    <td>${p.jabatan ? esc(p.jabatan) : '<span class="mono" style="color:var(--muted)">—</span>'}</td>
    <td>${daftar.length ? `<div class="sert-baris">${daftar.map(s=>{
      const n = sertSisa(s);
      return `<span class="sert-pil ${sertRupa(n)}" title="${esc([s.nomor, s.rating].filter(Boolean).join(' · '))}">
        <b>${esc(sertJenisNama(s.jenis))}</b> ${esc(s.nama || s.nomor || '—')}${
        s.berlaku ? ` <span class="mono">${tglRingkas(s.berlaku)}</span>` : ''}</span>`;
    }).join('')}</div>` : `<span style="color:var(--muted);font-size:12px">${
      T('belum ada','none yet')}</span>`}</td>
    <td>${terdekat
      ? `<span class="sert-sisa ${rupa}">${terdekat.sisa < 0
          ? T(`habis ${-terdekat.sisa} hari lalu`, `lapsed ${-terdekat.sisa} days ago`)
          : T(`${terdekat.sisa} hari lagi`, `${terdekat.sisa} days left`)}</span>
         <br><span class="mono" style="color:var(--muted);font-size:10.5px">${
           tglRingkas(terdekat.s.berlaku)}</span>`
      : `<span class="mono" style="color:var(--muted)">—</span>`}</td>
    <td style="text-align:right">${PSN.boleh
      ? `<button class="btn garis kecil" data-psn="${esc(p.id)}">${T('Ubah','Edit')}</button>` : ''}</td>
  </tr>`;
}

const psnKepalaTabel = () => `<thead><tr>
  <th>${T('Nama','Name')}</th><th>${T('Jabatan','Position')}</th>
  <th>${T('Lisensi, rating, sertifikat','Licences, ratings, certificates')}</th>
  <th>${T('Paling dekat habis','Nearest expiry')}</th><th></th></tr></thead>`;

/** Isi subtab Personel untuk satu unit. */
function psnIsi(unit){
  const orang = psnUnit(unit);
  const perhatian = sertPerhatian().filter(x=>(x.orang.unit || '') === unit);
  const habis = perhatian.filter(x=>x.sisa < 0).length;
  const dekat = perhatian.length - habis;
  const tampil = orang.filter(psnLolosSaring);
  const yatim = PSN.boleh ? psnTanpaUnit() : [];

  return `
    <div class="atur-data">
      <span class="ket">${orang.length} ${T('orang terdaftar di unit ini','people on record in this unit')}
        · ${PSN.boleh ? T('Anda boleh menambah dan mengubah','you may add and change')
                      : T('Anda bisa melihat, tapi tidak mengubah','you can look, but not change')}</span>
      <span class="tombol">${PSN.boleh
        ? `<button class="btn kecil" id="psnTambah">${T('Tambah personel','Add person')}</button>` : ''}</span>
    </div>

    <div class="ubin-baris" style="margin-top:0">
      ${ubin('biru', T('Personel','Personnel'), orang.length,
          T('terdaftar di unit ini','on record in this unit'))}
      ${ubin(habis ? 'merah' : 'hijau', T('Sudah Habis','Expired'), habis,
          T('lisensi atau sertifikat mati','licences or certificates lapsed'))}
      ${ubin(dekat ? 'kuning' : 'hijau', T('Kurang 2 Bulan','Under 2 Months'), dekat,
          T('perlu diurus dari sekarang','need starting on now'))}
      ${ubin('biru', T('Total Sertifikat','Certificates'),
          orang.reduce((n,p)=>n + (p.sertifikat || []).length, 0),
          T('lisensi, rating, dan sertifikat','licences, ratings, and certificates'))}
    </div>

    <div class="panel" style="margin-top:18px">
      <div class="kepala"><h3>${T('Personel','Personnel')} ${esc(namaUnit(unit))}</h3>
        <span class="ket">${tampil.length} ${T('baris tampil','rows shown')}</span></div>
      <div class="badan" style="padding-bottom:0">
        <div class="saring">
          <div class="isian"><label for="fSertPersonel">${T('Masa berlaku','Validity')}</label>
            <select id="fSertPersonel">
              <option value="">${T('Semua','All')}</option>
              <option value="habis"${PSN.saring.sert==='habis'?' selected':''}>${
                T('Sudah habis','Already expired')}</option>
              <option value="dekat"${PSN.saring.sert==='dekat'?' selected':''}>${
                T('Kurang dari 2 bulan','Expiring within 2 months')}</option>
              <option value="kosong"${PSN.saring.sert==='kosong'?' selected':''}>${
                T('Belum ada tanggalnya','No expiry recorded')}</option>
            </select></div>
          <div class="isian lebar"><label for="fCariPersonel">${
            T('Cari nama / lisensi','Search name / licence')}</label>
            <input type="text" id="fCariPersonel" autocomplete="off" spellcheck="false"
              value="${esc(PSN.saring.cari || '')}" placeholder="${
              T('mis. Santoso, ATSEP','e.g. Santoso, ATSEP')}"></div>
        </div>
      </div>
      <div class="gulir" style="max-height:none"><table id="tblPersonel">${psnKepalaTabel()}<tbody>${
        tampil.length ? tampil.map(psnBaris).join('')
        : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">${
            orang.length
              ? T('Tidak ada yang cocok dengan saringan itu.','Nothing matches that filter.')
              : T('Belum ada personel terdaftar di unit ini.','No personnel on record in this unit yet.')
          }</td></tr>`}</tbody></table></div>
    </div>

    ${yatim.length ? `<div class="panel" style="margin-top:18px">
      <div class="kepala"><h3>${T('Belum ditetapkan unitnya','No unit set yet')}</h3>
        <span class="ket">${yatim.length} ${T('orang','people')}</span></div>
      <div class="gulir" style="max-height:none"><table>${psnKepalaTabel()}<tbody>${
        yatim.map(psnBaris).join('')}</tbody></table></div>
      <div class="badan"><div class="catatan" style="margin-top:0"><b>${
        T('Daftar ini sama di setiap unit.','This list is the same in every unit.')}</b> ${
        T('Isinya baris yang kolom unitnya masih kosong — dari sebelum data personel pindah ke dalam '
        + 'Database Unit. Tekan Ubah dan tetapkan unitnya, lalu barisnya pindah ke daftar unit itu dan '
        + 'hilang dari sini. Hanya terlihat oleh yang berhak mengubah.',
          'These are rows whose unit column is still empty — from before personnel moved into the Unit '
        + 'Database. Press Edit and set the unit, and the row moves to that unit’s list and disappears '
        + 'from here. Only visible to those who may make changes.')}</div></div>
    </div>` : ''}

    <div class="catatan">
      <b>${T('Peringatannya menyala dua bulan di muka, di luar layar ini.',
             'The warning lights two months ahead, outside this screen.')}</b>
      ${T(`Sertifikat yang tinggal ${SERT_AWAS} hari atau kurang muncul di beranda — terlihat semua unit — `
        + 'dan di lonceng akun orangnya sendiri. Karena itu tiap baris punya kolom akun E-Logbook. Baris '
        + 'tanpa akun tetap terhitung di beranda, tapi tidak ada yang bisa diberi tahu secara pribadi.',
          `A certificate with ${SERT_AWAS} days or fewer left appears on the home screen — visible across `
        + 'all units — and in that person’s own notification bell. That is why every row has an E-Logbook '
        + 'account column. A row without an account still counts on the home screen, but there is nobody '
        + 'to tell privately.')}
      ${SRV.aktif
        ? (PSN.masuk ? '' : T('Nomor lisensinya disamarkan sampai Anda masuk.',
                              'Licence numbers stay masked until you sign in.'))
        : T('Ini data contoh, tersimpan di peramban ini saja.',
            'This is sample data, stored in this browser only.')}</div>`;
}

/** Gambar ulang subtab Personel unit yang sedang dibuka. */
function gambarPersonel(){
  const kotak = el('s-personel');
  if(!kotak || !akun || !unitDibuka) return;
  kotak.innerHTML = psnIsi(unitDibuka);
  psnPasang();
  psnLencana();
}

/** Angka di label subtabnya — ditambal langsung, dengan alasan yang sama
    dengan bklLencana(): menggambar ulang seluruh layar unit akan memantulkan
    subtab yang sedang dibuka kembali ke Peralatan. */
function psnLencana(){
  const tab = document.querySelector('#subtab button[data-sub="personel"]');
  if(!tab) return;
  const n = psnAwasUnit(unitDibuka);
  tab.innerHTML = T('Personel','Personnel')
    + (n ? ` <span class="mono" style="opacity:.75">(${n})</span>` : '');
}

function psnPasang(){
  const kotak = el('s-personel'); if(!kotak) return;

  kotak.querySelectorAll('[data-psn]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const p = PSN.daftar.find(x=>x.id === b.dataset.psn);
      if(p) psnBuka(p);
    });
  });

  const tambah = kotak.querySelector('#psnTambah');
  // Unit yang sedang dibuka jadi bawaannya: orang yang ditambahkan dari daftar
  // Radtel hampir pasti orang Radtel, dan kolom unit yang dibiarkan kosong
  // itulah yang dulu melahirkan baris tanpa unit.
  if(tambah) tambah.addEventListener('click', ()=>psnBuka(null, unitDibuka));

  const sert = kotak.querySelector('#fSertPersonel');
  if(sert) sert.addEventListener('change', ()=>{
    PSN.saring.sert = sert.value; gambarPersonel();
  });
  const cari = kotak.querySelector('#fCariPersonel');
  if(cari) cari.addEventListener('input', ()=>{
    PSN.saring.cari = cari.value.trim();
    gambarPersonel();
    // Menggambar ulang mengganti kotaknya, jadi kursornya harus dikembalikan.
    const baru = el('fCariPersonel');
    if(baru){ baru.focus(); baru.setSelectionRange(baru.value.length, baru.value.length); }
  });
}

/* ---------- Kartu ubah personel ---------- */

const psnBarisSert = (s, i) => `
  <div class="sert-sunting" data-sert="${i}">
    <div class="isian" style="margin-bottom:0;min-width:120px">
      <label>${T('Jenis','Kind')}</label>
      <select data-sk="${i}" data-kolom="jenis">${SERT_JENIS.map(j=>
        `<option value="${esc(j)}"${j===(s.jenis||'Lisensi')?' selected':''}>${esc(sertJenisNama(j))}</option>`).join('')}
      </select></div>
    <div class="isian" style="margin-bottom:0;flex:2;min-width:160px">
      <label>${T('Nama sertifikat','Certificate name')}</label>
      <input type="text" data-sk="${i}" data-kolom="nama" value="${esc(s.nama || '')}"
        placeholder="${T('mis. ATSEP Licence','e.g. ATSEP Licence')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:140px">
      <label>${T('Nomor','Number')}</label>
      <input type="text" data-sk="${i}" data-kolom="nomor" value="${esc(s.nomor || '')}"></div>
    <div class="isian" style="margin-bottom:0;flex:2;min-width:150px">
      <label>Rating</label>
      <input type="text" data-sk="${i}" data-kolom="rating" value="${esc(s.rating || '')}"
        placeholder="${T('mis. COM · Radio Telephony','e.g. COM · Radio Telephony')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:140px">
      <label>${T('Terbit','Issued')}</label>
      <input type="date" data-sk="${i}" data-kolom="terbit" value="${esc(s.terbit || '')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:140px">
      <label>${T('Berlaku sampai','Valid until')}</label>
      <input type="date" data-sk="${i}" data-kolom="berlaku" value="${esc(s.berlaku || '')}"></div>
    <button class="btn garis kecil" data-sert-buang="${i}"
      title="${T('Hapus baris ini','Delete this row')}">✕</button>
  </div>`;

function psnBuka(asal, unitBawaan){
  // Salinan dalam: Batal harus benar-benar mengembalikan keadaan semula,
  // termasuk sertifikat yang sudah dihapus dari daftar di kartunya.
  PSN.dibuka = asal
    ? JSON.parse(JSON.stringify(asal))
    : { id:'', nama:'', unit: unitBawaan || '', username:'', jabatan:'', sertifikat:[] };
  el('judulPersonel').textContent = asal ? T('Ubah personel','Edit person')
                                         : T('Tambah personel','Add person');
  el('ketKartuPersonel').textContent = asal ? asal.nama : '';
  psnGambarKartu();
  el('lapisPersonel').classList.add('buka');
}

function psnGambarKartu(){
  const p = PSN.dibuka;
  const akunPilihan = [['', T('— tidak dikaitkan —','— not linked —')]]
    .concat((USERS.length ? USERS : akunContohMuat()).map(u=>[u.username, `${u.nama || u.username} · ${u.username}`]));

  el('badanPersonel').innerHTML =
    `<div class="imp-atur" style="margin-top:0;padding-top:0;border-top:none">
      ${dIsian('pNama', T('Nama','Name'), p.nama)}
      ${dPilih('pUnit', 'Unit', [['', T('— tidak ditetapkan —','— not set —')]]
        .concat(UNIT.map(u=>[u.kode, u.nama])), p.unit)}
      ${dIsian('pJabatan', T('Jabatan','Position'), p.jabatan)}
      ${dPilih('pAkun', T('Akun E-Logbook','E-Logbook account'), akunPilihan, p.username,
        T('Ke sinilah peringatan masa berlaku dikirim.','This is where the expiry warning is sent.'))}
    </div>

    <div class="atur-data" style="margin:18px 0 10px">
      <span class="ket">${(p.sertifikat || []).length} ${
        T('lisensi / rating / sertifikat','licences / ratings / certificates')}</span>
      <span class="tombol"><button class="btn garis kecil" id="btnTambahSert">${
        T('Tambah baris','Add a row')}</button></span>
    </div>
    ${(p.sertifikat || []).length
      ? (p.sertifikat).map(psnBarisSert).join('')
      : `<div style="color:var(--muted);font-size:12.5px;padding:6px 0">${
          T('Belum ada. Tekan Tambah baris.','None yet. Press Add a row.')}</div>`}

    ${p.id ? `<div class="bahaya" style="margin-top:18px">
      <div class="jdl">${T('Hapus personel ini','Delete this person')}</div>
      <p>${T('Baris ini beserta seluruh sertifikatnya dibuang. Akun E-Logbook-nya tidak ikut terhapus.',
             'This row and all of its certificates are removed. Their E-Logbook account is not deleted.')}</p>
      <button class="btn bahaya-tombol" id="btnHapusPersonel">${T('Hapus','Delete')}</button>
    </div>` : ''}`;

  el('badanPersonel').querySelectorAll('[data-sk]').forEach(i=>{
    const s = PSN.dibuka.sertifikat[Number(i.dataset.sk)];
    if(!s) return;
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', ()=>{
      s[i.dataset.kolom] = i.value;
    });
  });
  el('badanPersonel').querySelectorAll('[data-sert-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      PSN.dibuka.sertifikat.splice(Number(b.dataset.sertBuang), 1);
      psnGambarKartu();
    });
  });
  el('btnTambahSert').addEventListener('click', ()=>{
    PSN.dibuka.sertifikat.push({ jenis:'Lisensi', nama:'', nomor:'', rating:'', terbit:'', berlaku:'' });
    psnGambarKartu();
  });
  const hapus = el('btnHapusPersonel');
  if(hapus) hapus.addEventListener('click', async ()=>{
    if(!confirm(T(`Hapus ${PSN.dibuka.nama} dari daftar personel?`,
                  `Delete ${PSN.dibuka.nama} from the personnel list?`))) return;
    const simpanan = PSN.daftar;
    const dibuang = PSN.dibuka;
    PSN.daftar = PSN.daftar.filter(x=>x.id !== PSN.dibuka.id);
    try{
      await psnSimpan('hapus', dibuang);
      psnTutup(); gambarPersonel(); gambarPerhatian(); gambarLonceng();
      pesan(T('Personel dihapus.','Person deleted.'));
    }catch(e){
      PSN.daftar = simpanan;      // gagal menyimpan: kembalikan daftarnya
      pesan(T('Gagal menghapus: ','Could not delete: ') + (e && e.message || e));
    }
  });
}

function psnTutup(){
  el('lapisPersonel').classList.remove('buka');
  PSN.dibuka = null;
}

el('btnBatalPersonel').addEventListener('click', psnTutup);
el('lapisPersonel').addEventListener('click', e=>{ if(e.target === el('lapisPersonel')) psnTutup(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisPersonel').classList.contains('buka')) psnTutup();
});

el('btnSimpanPersonel').addEventListener('click', async ()=>{
  const p = PSN.dibuka; if(!p) return;
  p.nama     = el('pNama').value.trim();
  p.unit     = el('pUnit').value;
  p.jabatan  = el('pJabatan').value.trim();
  p.username = el('pAkun').value;
  if(!p.nama){ pesan(T('Nama belum diisi.','The name is empty.')); return; }
  // Baris sertifikat yang sama sekali kosong dibuang tanpa berkata apa-apa:
  // menekan Tambah baris lalu berubah pikiran bukan kesalahan yang perlu
  // dilaporkan.
  p.sertifikat = (p.sertifikat || []).filter(s=>s.nama || s.nomor || s.rating || s.berlaku);

  const b = el('btnSimpanPersonel');
  const simpanan = JSON.parse(JSON.stringify(PSN.daftar));
  const lama = PSN.daftar.find(x=>x.id === p.id);
  if(lama) Object.assign(lama, p);
  else{
    p.id = 'p' + (Date.now().toString(36));
    PSN.daftar.push(p);
  }
  b.disabled = true;
  try{
    await psnSimpan(lama ? 'ubah' : 'tambah', p);
    psnTutup(); gambarPersonel(); gambarPerhatian(); gambarLonceng();
    pesan(T('Data personel tersimpan.','Personnel record saved.'));
  }catch(e){
    PSN.daftar = simpanan;
    pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
  }finally{
    b.disabled = false;
  }
});

/* Tombol Tambah dan saringannya tidak dipasang di sini lagi: keduanya lahir dan
   mati bersama isi subtab Personel yang digambar ulang tiap kali, jadi
   pendengarnya ikut dipasang di psnPasang(). */

