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

const SERT_AWAS = 60;                 // hari sebelum habis, saat peringatannya menyala
const SERT_JENIS = ['Lisensi','Rating','Sertifikat','Medical','Lainnya'];
const SERT_JENIS_EN = { 'Lisensi':'Licence','Rating':'Rating','Sertifikat':'Certificate',
  'Medical':'Medical','Lainnya':'Other' };

/* Kategori pelatihan di eChain (label = nilai yang disimpan; bookmarklet yang
   mencocokkannya ke pilihan di form eChain). */
const ECHAIN_KATEGORI = ['MANDATORY','NON MANDATORY','MANAGERIAL','KURSUS','SEMINAR',
  'WORKSHOP','BASIC','ADVANCED','CONTINUATION','DEVELOPMENTAL'];
/* Gerbang VPN — bookmarklet yang meneruskan ke halaman form setelah login. */
const ECHAIN_VPN = 'https://vpn.airnavindonesia.co.id:20443/';
const sertJenisNama = (j) => BHS === 'en' ? (SERT_JENIS_EN[j] || j) : j;

const PSN = {
  daftar:  [],
  boleh:   false,   // akun ini boleh mengubah?
  masuk:   true,    // nomor lisensinya utuh, atau sudah dipotong server?
  dibuka:  null,    // salinan orang yang sedang terbuka di kartu; null = tambah
  tunda:   [],      // bukti yang dipilih sebelum orangnya punya id di server
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

async function psnMuat(){
  try{
    const r = await srvFetch('/personel', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    PSN.daftar = (j && Array.isArray(j.personel)) ? j.personel : [];
    PSN.boleh  = !!(j && j.boleh);
    PSN.masuk  = !!(j && j.masuk);
    await psnBerkasMuat();
  }catch(e){
    console.warn('Data personel tidak bisa diambil:', e && e.message || e);
    PSN.daftar = []; PSN.boleh = false;
  }
}

async function psnSimpan(aksi, orang){
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
    <td>${(PSN.berkas[p.id] || []).length
      ? `<span class="psn-lampiran" title="${T('bukti terlampir','attachments')}">${
          (PSN.berkas[p.id] || []).length} ${T('bukti','files')}</span>`
      : '<span class="mono" style="color:var(--muted)">—</span>'}</td>
    <td style="text-align:right">${PSN.boleh
      ? `<button class="btn garis kecil" data-psn="${esc(p.id)}">${T('Ubah','Edit')}</button>` : ''}</td>
  </tr>`;
}

const psnKepalaTabel = () => `<thead><tr>
  <th>${T('Nama','Name')}</th>
  <th>${T('Lisensi, rating, sertifikat','Licences, ratings, certificates')}</th>
  <th>${T('Paling dekat habis','Nearest expiry')}</th>
  <th>${T('Bukti','Proof')}</th><th></th></tr></thead>`;

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
      ${PSN.masuk ? '' : T('Nomor lisensinya disamarkan sampai Anda masuk.',
                           'Licence numbers stay masked until you sign in.')}</div>`;
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
  <div class="sert-bungkus" data-sert="${i}">
  <div class="sert-sunting">
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
  </div>
  ${psnBerkasCip(PSN.dibuka, s)}
  </div>`;

function psnBuka(asal, unitBawaan){
  // Salinan dalam: Batal harus benar-benar mengembalikan keadaan semula,
  // termasuk sertifikat yang sudah dihapus dari daftar di kartunya.
  PSN.dibuka = asal
    ? JSON.parse(JSON.stringify(asal))
    : { id:'', nama:'', unit: unitBawaan || '', username:'', sertifikat:[], pelatihan:[] };
  if(!Array.isArray(PSN.dibuka.pelatihan)) PSN.dibuka.pelatihan = [];
  PSN.tunda = [];
  PSN.tab = 'sert';                       // tab aktif di kartu: 'sert' | 'plt'
  PSN.pltTahun = String(new Date().getFullYear());   // tahun yang sedang dilihat di tab Pelatihan
  PSN.pltPilih = new Set();               // id pelatihan yang dicentang untuk batch ke eChain
  PSN.pltPdfKet = '';                     // laporan terakhir "Isi dari PDF sertifikat"
  el('judulPersonel').textContent = asal ? T('Ubah personel','Edit person')
                                         : T('Tambah personel','Add person');
  el('ketKartuPersonel').textContent = asal ? asal.nama : '';
  psnGambarKartu();
  el('lapisPersonel').classList.add('buka');
}

function psnGambarKartu(){
  const p = PSN.dibuka;
  // Unit yang boleh dipilih akun ini: administrator melihat semua, akun unit
  // hanya unitnya. Kalau cuma satu, unitnya dikunci dan diisi otomatis.
  const unitPakai = (typeof unitBoleh === 'function' && unitBoleh().length) ? unitBoleh() : UNIT;
  const kunciUnit = unitPakai.length <= 1;
  if(kunciUnit && unitPakai[0]) p.unit = unitPakai[0].kode;
  const unitOpsi = kunciUnit
    ? unitPakai.map(u=>[u.kode, u.nama])
    : [['', T('— pilih unit —','— choose unit —')]].concat(unitPakai.map(u=>[u.kode, u.nama]));

  el('badanPersonel').innerHTML =
    `<div class="imp-atur" style="margin-top:0;padding-top:0;border-top:none">
      <div class="isian"><label>${T('Nama','Name')}</label>
        <input type="text" id="pNama" list="dlAkunNama" autocomplete="off" value="${esc(p.nama || '')}"
          placeholder="${T('ketik atau pilih dari akun','type or pick from accounts')}">
        <datalist id="dlAkunNama">${USERS.map(u=>`<option value="${esc(u.nama || '')}"></option>`).join('')}</datalist>
        <div class="ket" id="pNikKet" style="font-size:11px;margin-top:4px;color:var(--muted)">${
          p.username ? 'NIK ' + esc(p.username) : T('akun belum terkait','no account linked')}</div></div>
      ${dPilih('pUnit', 'Unit', unitOpsi, p.unit,
        kunciUnit ? T('Unit Anda','Your unit') : T('Ikut dari nama bila akunnya cocok','From the name when the account matches'))}
    </div>

    <div class="subtab" style="margin-top:14px">
      <button type="button" data-ptab="sert" class="${PSN.tab==='sert'?'aktif':''}">${
        T('Lisensi, Rating & Medec','Licences, Ratings & Medical')}</button>
      <button type="button" data-ptab="plt" class="${PSN.tab==='plt'?'aktif':''}">${
        T('Pelatihan','Training')}</button>
    </div>

    <div style="margin-top:12px">${PSN.tab==='plt' ? psnTabPelatihan(p) : psnTabSert(p)}</div>

    ${psnBerkasLepas(p)}

    ${p.id ? `<div class="bahaya" style="margin-top:18px">
      <div class="jdl">${T('Hapus personel ini','Delete this person')}</div>
      <p>${T('Baris ini beserta seluruh sertifikatnya dibuang. Akun E-Logbook-nya tidak ikut terhapus.',
             'This row and all of its certificates are removed. Their E-Logbook account is not deleted.')}</p>
      <button class="btn bahaya-tombol" id="btnHapusPersonel">${T('Hapus','Delete')}</button>
    </div>` : ''}`;

  // Ganti tab: baca dulu isian kepala supaya tidak hilang saat digambar ulang.
  el('badanPersonel').querySelectorAll('[data-ptab]').forEach(b=>b.addEventListener('click', ()=>{
    psnBacaKepala(); PSN.tab = b.dataset.ptab; psnGambarKartu();
  }));
  // Nama -> akun/NIK + unit otomatis.
  const nm = el('pNama');
  if(nm) nm.addEventListener('input', ()=>{ PSN.dibuka.nama = nm.value; psnAutoAkun(); });
  const un = el('pUnit');
  if(un) un.addEventListener('change', ()=>{ PSN.dibuka.unit = un.value; });

  if(PSN.tab === 'plt') psnWirePlt(); else psnWireSert();
  psnBerkasPasang();

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

/* Membaca isian kepala kartu ke objek yang sedang dibuka. Dipakai sebelum
   menggambar ulang (ganti tab) supaya nama/unit/akun tidak hilang. */
function psnBacaKepala(){
  const p = PSN.dibuka; if(!p) return;
  const nm = el('pNama'), un = el('pUnit');
  if(nm) p.nama = nm.value;
  if(un) p.unit = un.value;
  // p.username dijaga oleh psnAutoAkun, tidak dibaca dari kolom lagi.
}

/* Begitu nama cocok persis dengan satu akun E-Logbook, NIK-nya dikaitkan dan
   unitnya ikut (kalau unitnya tidak dikunci). Nama dari <datalist> akun, jadi
   kecocokan biasanya tepat; nama kembar (cocok lebih dari satu) dibiarkan
   supaya tidak salah kait. Kaitan lama tidak dihapus saat nama diketik ulang. */
function psnAutoAkun(){
  const p = PSN.dibuka; if(!p) return;
  const nama = (p.nama || '').trim().toLowerCase();
  const cocok = nama ? USERS.filter(u => String(u.nama || '').trim().toLowerCase() === nama) : [];
  if(cocok.length === 1){
    p.username = cocok[0].username || '';
    const un = el('pUnit');
    // Unit ikut hanya kalau tidak dikunci dan akunnya punya unit.
    if(un && !un.disabled && un.options.length > 1 && Array.isArray(cocok[0].unit) && cocok[0].unit[0]){
      p.unit = cocok[0].unit[0];
      un.value = p.unit;
    }
  }
  const ket = el('pNikKet');
  if(ket) ket.textContent = p.username ? 'NIK ' + p.username : T('akun belum terkait','no account linked');
}

const pltTahunOf = (t) => String(t.mulai || t.tglSert || t.selesai || '').slice(0, 4);

/* ---------- Tab 1: Lisensi, Rating & Medec ---------- */
function psnTabSert(p){
  return `
    <div class="atur-data" style="margin:4px 0 10px">
      <span class="ket">${(p.sertifikat || []).length} ${
        T('lisensi / rating / medec','licences / ratings / medical')}</span>
      <span class="tombol"><button class="btn garis kecil" id="btnTambahSert">${
        T('Tambah baris','Add a row')}</button></span>
    </div>
    ${(p.sertifikat || []).length
      ? (p.sertifikat).map(psnBarisSert).join('')
      : `<div style="color:var(--muted);font-size:12.5px;padding:6px 0">${
          T('Belum ada. Tekan Tambah baris.','None yet. Press Add a row.')}</div>`}`;
}

function psnWireSert(){
  const badan = el('badanPersonel');
  badan.querySelectorAll('[data-sk]').forEach(i=>{
    const s = PSN.dibuka.sertifikat[Number(i.dataset.sk)];
    if(!s) return;
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', ()=>{ s[i.dataset.kolom] = i.value; });
  });
  badan.querySelectorAll('[data-sert-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{ PSN.dibuka.sertifikat.splice(Number(b.dataset.sertBuang), 1); psnGambarKartu(); });
  });
  const tb = el('btnTambahSert');
  if(tb) tb.addEventListener('click', ()=>{
    PSN.dibuka.sertifikat.push({ id:'s' + Date.now().toString(36),
      jenis:'Lisensi', nama:'', nomor:'', rating:'', terbit:'', berlaku:'' });
    psnGambarKartu();
  });
}

/* ---------- Tab 2: Pelatihan (per tahun) ---------- */
function psnTabPelatihan(p){
  const list = p.pelatihan || [];
  const tahunAda = [...new Set(list.map(pltTahunOf).filter(Boolean))];
  const kini = String(new Date().getFullYear());
  const tahunPil = [...new Set([...tahunAda, kini, PSN.pltTahun])].filter(Boolean).sort().reverse();
  // Yang tampil: tahun terpilih, plus baris baru yang belum ada tanggalnya.
  const tampil = list.map((t, i) => ({ t, i }))
    .filter(x => pltTahunOf(x.t) === PSN.pltTahun || !pltTahunOf(x.t));
  return `
    <div class="atur-data" style="margin:4px 0 10px;gap:10px;align-items:flex-end">
      <div class="isian" style="margin-bottom:0;max-width:120px">
        <label>${T('Tahun','Year')}</label>
        <select id="pltTahunPilih">${tahunPil.map(y=>`<option value="${esc(y)}"${y===PSN.pltTahun?' selected':''}>${esc(y)}</option>`).join('')}</select>
      </div>
      <span class="ket">${list.length} ${T('pelatihan total','training total')}${
        PSN.pltPilih.size ? ` · ${PSN.pltPilih.size} ${T('dipilih','picked')}` : ''}</span>
      <span class="tombol" style="margin-left:auto">
        <a class="btn garis kecil" href="/alat-echain.html" target="_blank" rel="noopener"
           style="text-decoration:none" title="${T('Pasang bookmarklet pengisi form eChain','Install the eChain form bookmarklet')}">${T('Bot eChain','eChain bot')}</a>
        ${PSN.pltPilih.size ? `<button class="btn kecil" id="btnBatchPlt">${
          T('Siapkan terpilih ke eChain','Prepare picked for eChain')} (${PSN.pltPilih.size})</button>` : ''}
        <button class="btn garis kecil" id="btnTambahPlt">${T('Tambah pelatihan','Add training')}</button></span>
    </div>
    <div class="isian" style="border-bottom:1px dashed var(--line);padding-bottom:10px;margin-bottom:10px">
      <label class="btn garis kecil" style="display:inline-block;cursor:pointer">
        📄 ${T('Isi dari PDF sertifikat','Fill from certificate PDFs')}
        <input type="file" id="pltPdf" accept=".pdf,application/pdf" multiple hidden>
      </label>
      <div class="bantu" id="pltPdfKet" style="margin-top:6px">${PSN.pltPdfKet || T(
        'Pilih satu atau banyak PDF sertifikat sekaligus. Tiap PDF jadi satu baris pelatihan, isiannya terisi sendiri, dan PDF-nya ikut jadi lampiran. Periksa isian bergaris biru, lalu Simpan.',
        'Pick one or many certificate PDFs. Each becomes a training row, filled in automatically, with the PDF attached. Check the fields outlined in blue, then Save.')}</div>
    </div>
    ${tampil.length
      ? tampil.map(x => pltBarisKartu(x.t, x.i)).join('')
      : `<div style="color:var(--muted);font-size:12.5px;padding:6px 0">${
          T('Belum ada pelatihan di tahun ini. Tekan Tambah pelatihan.','No training this year. Press Add training.')}</div>`}`;
}

function pltBarisKartu(t, i){
  // Kolom yang terisi dari PDF diberi garis biru sampai orangnya menyentuhnya.
  const biru = (k) => (t._pdf || []).includes(k) ? ' style="box-shadow:0 0 0 1px var(--accent)"' : '';
  return `
  <div class="sert-bungkus" data-plt="${i}">
  <div class="sert-sunting">
    <div class="isian" style="margin-bottom:0;align-self:flex-end;min-width:0">
      <input type="checkbox" data-plt-pick="${esc(t.id)}" ${PSN.pltPilih.has(t.id)?'checked':''}
        title="${T('Pilih untuk dikirim bareng ke eChain','Pick to send together to eChain')}"
        style="width:18px;height:18px;cursor:pointer"></div>
    <div class="isian" style="margin-bottom:0;min-width:150px">
      <label>${T('Kategori','Category')}</label>
      <select data-pk="${i}" data-pcol="kategori"${biru('kategori')}>
        <option value="">${T('- pilih -','- choose -')}</option>
        ${ECHAIN_KATEGORI.map(k=>`<option value="${esc(k)}"${k===(t.kategori||'')?' selected':''}>${esc(k)}</option>`).join('')}
      </select></div>
    <div class="isian" style="margin-bottom:0;flex:2;min-width:180px">
      <label>${T('Nama pelatihan','Training name')}</label>
      <input type="text" data-pk="${i}" data-pcol="nama"${biru('nama')} value="${esc(t.nama||'')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:140px">
      <label>${T('No. Sertifikat','Certificate no.')}</label>
      <input type="text" data-pk="${i}" data-pcol="nomor"${biru('nomor')} value="${esc(t.nomor||'')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:128px">
      <label>${T('Tgl. mulai','Start')}</label>
      <input type="date" data-pk="${i}" data-pcol="mulai"${biru('mulai')} value="${esc(t.mulai||'')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:128px">
      <label>${T('Tgl. selesai','End')}</label>
      <input type="date" data-pk="${i}" data-pcol="selesai"${biru('selesai')} value="${esc(t.selesai||'')}"></div>
    <div class="isian" style="margin-bottom:0;min-width:128px">
      <label>${T('Tgl. sertifikat','Cert. date')}</label>
      <input type="date" data-pk="${i}" data-pcol="tglSert"${biru('tglSert')} value="${esc(t.tglSert||'')}"></div>
    <button class="btn garis kecil" data-plt-buang="${i}" title="${T('Hapus baris ini','Delete this row')}">&#10005;</button>
  </div>
  <div class="sert-sunting" style="margin-top:4px">
    <div class="isian" style="margin-bottom:0;flex:2;min-width:200px">
      <label>${T('Tempat / Penyelenggara','Place / Organiser')}</label>
      <input type="text" data-pk="${i}" data-pcol="tempat"${biru('tempat')} value="${esc(t.tempat||'')}"></div>
    <div class="isian" style="margin-bottom:0;align-self:flex-end">
      ${t.dikirim
        ? `<span class="sert-sisa aman" title="${T('Sudah disiapkan ke eChain','Prepared for eChain')}">&#10003; eChain</span>`
        : `<button class="btn garis kecil" data-plt-echain="${i}" type="button">${T('Siapkan ke eChain','Prepare for eChain')}</button>`}</div>
  </div>
  ${pltBerkasCip(PSN.dibuka, t)}
  </div>`;
}

/* Lampiran satu baris pelatihan. Memakai rak berkas personel yang sama dengan
   sertifikat (berkas menempel lewat id barisnya). Bedanya dengan psnBerkasCip:
   berkas yang masih ditahan (PSN.tunda) ikut ditampilkan juga untuk orang yang
   sudah tersimpan, karena PDF dari "Isi dari PDF" selalu ditahan dulu dan baru
   naik saat Simpan — Batal tidak meninggalkan berkas yatim di server. */
function pltBerkasCip(orang, t){
  const nunggu = PSN.tunda.filter(x=>x.sert === t.id);
  const milik  = orang.id ? psnBerkasSert(orang.id, t.id) : [];
  return `<div class="psn-berkas">
    ${milik.map(b=>`<span class="psn-cip">
      <a href="/personel/${esc(orang.id)}/berkas/${esc(b.id)}" target="_blank" rel="noopener"
        title="${esc(b.nama)} · ${brkUkuran(b.ukuran)}">${esc(brkEkstensi(b.nama))} · ${esc(b.nama)}</a>
      ${BOLEH_HAPUS.personel
        ? `<button class="psn-cip-buang" data-brk-buang="${esc(b.id)}"
             title="${T('Hapus berkas ini','Delete this file')}">✕</button>` : ''}
    </span>`).join('')}
    ${nunggu.map(x=>`<span class="psn-cip">
      <span class="psn-cip-tunda" title="${esc(x.file.name)} · ${brkUkuran(x.file.size)}">${
        esc(brkEkstensi(x.file.name))} · ${esc(x.file.name)}</span>
      <button class="psn-cip-buang" data-brk-tunda="${esc(x.id)}"
        title="${T('Batalkan berkas ini','Drop this file')}">✕</button>
    </span>`).join('')}
    ${PSN.berkasBisaTulis
      ? `<button class="btn garis kecil" data-brk-lampir="${esc(t.id)}">${
          milik.length || nunggu.length ? T('Tambah bukti','Add proof') : T('Lampirkan PDF','Attach PDF')}</button>
         ${nunggu.length ? `<span class="psn-berkas-ket">${
           T('Naik ke server begitu Simpan ditekan.','Uploaded when you press Save.')}</span>` : ''}`
      : ''}
  </div>`;
}

/* "Isi dari PDF sertifikat": tiap PDF dibaca di peramban (public/pelatihan-pdf.mjs,
   dimuat saat pertama dipakai), jadi satu baris pelatihan baru yang isiannya
   terisi sendiri, dan PDF-nya ditahan sebagai lampiran baris itu. Tidak ada
   yang tersimpan sebelum Simpan ditekan. PDF hasil pindai (tanpa teks)
   dibaca lewat OCR yang sudah ada (ocrSiapkan, public/vendor/ocr/). */
async function pltIsiDariPdf(e){
  const input = e.target;
  const daftar = [...(input.files || [])].filter(f=>/\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  input.value = '';
  if(!daftar.length){ pesan(T('Pilih berkas PDF.','Choose PDF files.')); return; }
  const p = PSN.dibuka; if(!p) return;
  if(!Array.isArray(p.pelatihan)) p.pelatihan = [];

  const lapor = (html, warna) => {
    PSN.pltPdfKet = html;
    const k = el('pltPdfKet'); if(k){ k.innerHTML = html; k.style.color = warna || ''; }
  };
  input.disabled = true;

  let modul;
  try{
    lapor(T('Memuat pembaca PDF (pertama kali saja, ±1,8 MB)...','Loading the PDF reader (first time only, ~1.8 MB)...'));
    modul = await import(new URL('pelatihan-pdf.mjs', location.href).href);
  }catch(err){
    input.disabled = false;
    lapor(T('Pembaca PDF gagal dimuat: ','The PDF reader failed to load: ') + esc(err && err.message || err), 'var(--fail)');
    return;
  }
  const ocr = typeof ocrSiapkan === 'function'
    ? async (kanvas) => {
        const w = await ocrSiapkan(m => lapor(esc(m)));
        await w.setParameters({ tessedit_pageseg_mode: '3' });   // halaman utuh, tata letak bebas
        return (await w.recognize(kanvas)).data.text;
      }
    : null;

  const baru = [], tanpaTeks = [], bedaNama = [], gagal = [], kembar = [];
  for(let i = 0; i < daftar.length; i++){
    const f = daftar[i];
    lapor(T(`Membaca ${i + 1}/${daftar.length}: `, `Reading ${i + 1}/${daftar.length}: `) + esc(f.name));
    try{
      const { isi, cocokNama, sumber } = await modul.bacaPdfPelatihan(f, { namaOrang: p.nama, ocr });
      const t = {
        id: 't' + Date.now().toString(36) + i,
        kategori: isi.kategori, nama: isi.nama || f.name.replace(/\.pdf$/i, ''),
        nomor: isi.nomor, tempat: isi.tempat, mulai: isi.mulai, selesai: isi.selesai,
        tglSert: isi.tglSert, dikirim: false
      };
      t._pdf = Object.keys(isi).filter(k=>isi[k]);
      if(t.nomor && p.pelatihan.some(x=>x.nomor && x.nomor === t.nomor)) kembar.push(t.nomor);
      p.pelatihan.push(t);
      baru.push(t);
      if(PSN.berkasBisaTulis && f.size <= BRK_BATAS){
        PSN.tunda.push({ id: 'b' + Date.now().toString(36) + PSN.tunda.length, sert: t.id, file: f });
      }
      if(sumber === 'kosong') tanpaTeks.push(f.name);
      if(cocokNama === false) bedaNama.push(f.name);
    }catch(err){
      console.warn('[pelatihan] PDF gagal dibaca:', f.name, err);
      gagal.push(f.name);
    }
  }
  input.disabled = false;

  // Tampilkan tahun dari baris baru pertama; sebut kalau tersebar di beberapa tahun.
  const tahun = [...new Set(baru.map(pltTahunOf).filter(Boolean))].sort().reverse();
  if(tahun[0]) PSN.pltTahun = tahun[0];

  const potong = (a) => esc(a.slice(0, 4).join(', ') + (a.length > 4 ? ` +${a.length - 4}` : ''));
  let html = baru.length
    ? `<b>${baru.length}</b> ${T('PDF terbaca jadi baris pelatihan baru','PDFs became new training rows')}. ${
        T('Isian bergaris biru diambil dari PDF — periksa lagi, lalu Simpan. PDF-nya ikut jadi lampiran.',
          'Fields outlined in blue came from the PDF — check them, then Save. The PDFs are attached.')}`
    : T('Tidak ada PDF yang terbaca.','No PDF could be read.');
  if(tahun.length > 1) html += `<br>${T('Tersebar di tahun','Spread over years')} ${esc(tahun.join(', '))} — ${
    T('ganti Tahun untuk melihat sisanya.','switch Year to see the rest.')}`;
  if(tanpaTeks.length) html += `<br><span style="color:var(--warn)">${
    T('Tidak terbaca (pindaian tanpa teks?) — lengkapi manual','No text found (a scan?) — fill in by hand')}: ${potong(tanpaTeks)}.</span>`;
  if(bedaNama.length) html += `<br><span style="color:var(--warn)">${
    T(`Nama ${esc(p.nama || '')} tidak ditemukan di sertifikat — pastikan bukan milik orang lain`,
      `The name ${esc(p.nama || '')} was not found on the certificate — make sure it is theirs`)}: ${potong(bedaNama)}.</span>`;
  if(kembar.length) html += `<br><b style="color:var(--warn)">${
    T('No. sertifikat ini sudah ada di daftar','This certificate number is already listed')}: ${potong(kembar)}.</b>`;
  if(gagal.length) html += `<br><span style="color:var(--fail)">${T('Gagal dibaca','Could not read')}: ${potong(gagal)}.</span>`;

  PSN.pltPdfKet = html;
  psnGambarKartu();
}

function psnWirePlt(){
  const badan = el('badanPersonel');
  badan.querySelectorAll('[data-pk]').forEach(i=>{
    const t = PSN.dibuka.pelatihan[Number(i.dataset.pk)];
    if(!t) return;
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', ()=>{
      t[i.dataset.pcol] = i.value;
      // Sudah diperiksa/diubah orangnya: garis biru "dari PDF" dilepas.
      if(t._pdf){ t._pdf = t._pdf.filter(k=>k !== i.dataset.pcol); i.style.boxShadow = ''; }
    });
  });
  const pdf = el('pltPdf');
  if(pdf) pdf.addEventListener('change', pltIsiDariPdf);
  badan.querySelectorAll('[data-plt-buang]').forEach(b=>b.addEventListener('click', ()=>{
    PSN.dibuka.pelatihan.splice(Number(b.dataset.pltBuang), 1); psnGambarKartu();
  }));
  badan.querySelectorAll('[data-plt-echain]').forEach(b=>b.addEventListener('click', ()=>{
    pltEchainKirim(PSN.dibuka.pelatihan[Number(b.dataset.pltEchain)]);
  }));
  badan.querySelectorAll('[data-plt-pick]').forEach(c=>c.addEventListener('change', ()=>{
    const id = c.dataset.pltPick;
    if(c.checked) PSN.pltPilih.add(id); else PSN.pltPilih.delete(id);
    psnGambarKartu();   // perbarui penghitung & tombol batch
  }));
  const bb = el('btnBatchPlt');
  if(bb) bb.addEventListener('click', pltEchainKirimBatch);
  const th = el('pltTahunPilih');
  if(th) th.addEventListener('change', ()=>{ PSN.pltTahun = th.value; psnGambarKartu(); });
  const tb = el('btnTambahPlt');
  if(tb) tb.addEventListener('click', ()=>{
    PSN.dibuka.pelatihan.push({ id:'t' + Date.now().toString(36),
      kategori:'', nama:'', nomor:'', tempat:'', mulai:'', selesai:'', tglSert:'', dikirim:false });
    psnGambarKartu();
  });
}

/* Menyiapkan satu pelatihan untuk eChain: salin ke clipboard, buka gerbang VPN,
   tandai. Tidak menulis langsung ke eChain (form & Simpan tetap di tangan orang,
   unggahan eChain tak bisa dihapus). Tanda disimpan saat kartu ini ditekan Simpan. */
/** Menyalin teks ke clipboard, dengan cadangan textarea bila API diblokir. */
async function psnSalin(teks){
  try{ await navigator.clipboard.writeText(teks); }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = teks;
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(_){}
    ta.remove();
  }
}

/** Bentuk satu entri pelatihan menjadi item muatan eChain. */
const pltItem = (t) => ({
  kategori:t.kategori||'', mulai:t.mulai||'', selesai:t.selesai||'',
  training:t.nama||'', no_sert:t.nomor||'', tgl_sert:t.tglSert||'', tempat:t.tempat||''
});

async function pltEchainKirim(t){
  if(!t) return;
  const p = PSN.dibuka;
  const nik = (p.username || '').trim();
  if(!nik){ pesan(T('Kaitkan akun (NIK) dulu sebelum kirim ke eChain.','Link an account (NIK) first.')); return; }
  if(!t.nama){ pesan(T('Isi nama pelatihan dulu.','Fill the training name first.')); return; }
  await psnSalin(JSON.stringify({ v:1, src:'avengers-echain', tipe:'pelatihan', nik, nama:p.nama||'', item:pltItem(t) }));
  t.dikirim = true;
  psnGambarKartu();
  pesan(T('Tersalin. Login eChain, klik bookmark "Isi eChain", lalu tekan Simpan di kartu ini agar tandanya tetap.',
          'Copied. Fill in eChain via the bookmarklet, then press Save here to keep the mark.'));
  window.open(ECHAIN_VPN, '_blank', 'noopener');
}

/* Batch: kumpulkan pelatihan yang dicentang jadi satu antrean, salin ke
   clipboard, buka gerbang VPN. Di eChain, bookmarklet "Isi & Lanjut" mengisi
   satu tab lalu membuka tab berikutnya untuk item selanjutnya. */
async function pltEchainKirimBatch(){
  const p = PSN.dibuka;
  const nik = (p.username || '').trim();
  if(!nik){ pesan(T('Kaitkan akun (NIK) dulu sebelum kirim ke eChain.','Link an account (NIK) first.')); return; }
  const pilih = (p.pelatihan || []).filter(t => PSN.pltPilih.has(t.id) && t.nama);
  if(!pilih.length){ pesan(T('Centang dulu pelatihan yang mau dikirim (yang ada namanya).','Tick the training rows to send first.')); return; }
  await psnSalin(JSON.stringify({ v:1, src:'avengers-echain', tipe:'pelatihan-batch', nik, nama:p.nama||'', items:pilih.map(pltItem) }));
  pilih.forEach(t => t.dikirim = true);
  psnGambarKartu();
  pesan(T(`Tersalin ${pilih.length} pelatihan. Login eChain, klik bookmark "Isi eChain" sekali (semua tab terbuka), lalu klik lagi di tiap tab. Tekan Simpan agar tanda tetap.`,
          `Copied ${pilih.length} training records. In eChain click "Isi eChain" once (all tabs open), then click it in each tab.`));
  window.open(ECHAIN_VPN, '_blank', 'noopener');
}

function psnTutup(){
  el('lapisPersonel').classList.remove('buka');
  PSN.dibuka = null;
  PSN.tunda = [];
}

el('btnBatalPersonel').addEventListener('click', psnTutup);
el('lapisPersonel').addEventListener('click', e=>{ if(e.target === el('lapisPersonel')) psnTutup(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisPersonel').classList.contains('buka')) psnTutup();
});

el('btnSimpanPersonel').addEventListener('click', async ()=>{
  const p = PSN.dibuka; if(!p) return;
  p.nama = el('pNama').value.trim();
  p.unit = el('pUnit').value;
  // p.username sudah dikaitkan otomatis dari nama (psnAutoAkun).
  if(!p.nama){ pesan(T('Nama belum diisi.','The name is empty.')); return; }
  // Baris pelatihan yang benar-benar kosong dibuang diam-diam (Tambah lalu batal).
  p.pelatihan = (p.pelatihan || []).filter(t =>
    t.nama || t.nomor || t.kategori || t.mulai || t.selesai || t.tglSert || t.tempat ||
    PSN.tunda.some(x=>x.sert === t.id));
  // Penanda "dari PDF" hanya untuk kartu yang sedang terbuka, bukan data.
  p.pelatihan.forEach(t => { delete t._pdf; });
  PSN.pltPdfKet = '';
  // Baris sertifikat yang sama sekali kosong dibuang tanpa berkata apa-apa:
  // menekan Tambah baris lalu berubah pikiran bukan kesalahan yang perlu
  // dilaporkan.
  // Baris yang sudah dilampiri bukti dikecualikan: orang yang menempelkan
  // pindaian ke sebuah baris jelas tidak sedang berubah pikiran soal barisnya.
  p.sertifikat = (p.sertifikat || []).filter(s=>
    s.nama || s.nomor || s.rating || s.berlaku ||
    PSN.tunda.some(t=>t.sert === (s.id || '')));

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
    // Sekarang orangnya punya id, jadi bukti yang ditahan di kartu punya tempat
    // untuk mendarat. Gagalnya satu berkas tidak membatalkan yang sudah tersimpan.
    const gagal = await psnTundaKirim(p.id, b);
    psnTutup(); gambarPersonel(); gambarPerhatian(); gambarLonceng();
    pesan(gagal.length
      ? T('Tersimpan, tapi ada bukti yang gagal naik: ',
          'Saved, but some proof failed to upload: ') + gagal.join('; ')
      : T('Data personel tersimpan.','Personnel record saved.'));
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

/* ---------- Bukti sertifikat: berkas yang menempel pada barisnya ----------

   Baris sertifikat selama ini cuma memuat nomor dan tanggal. Yang ditanya
   pertama kali saat lisensi diperiksa adalah pindaiannya, dan itu selama ini
   tinggal di folder pribadi masing-masing — tidak ikut ke mana-mana waktu
   orangnya cuti atau pindah unit.

   Berkasnya menempel pada satu baris sertifikat lewat id barisnya, bukan lewat
   nomor urut: satu baris yang dihapus menggeser sisanya, dan bukti lisensi
   akan berpindah menempel ke sertifikat yang lain tanpa ada yang menyentuhnya.

   Orang baru boleh dilampiri sebelum tersimpan, tapi berkasnya belum bisa
   berangkat: id yang dituju belum ada, dan berkas yang diunggah ke id yang
   belum ada tidak punya tempat untuk mendarat. Jadi ia ditahan di kartu dan
   berangkat sendiri tepat sesudah Simpan berhasil. Yang ditahan tinggal di
   peramban — Batal membuangnya tanpa menyisakan apa pun di server, dan itu
   sebabnya menahan lebih baik daripada mengunggah dulu ke id sementara. */

const PSN_EXT_SAH = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|md|jpe?g|png|webp|gif|bmp|tiff?|zip|rar|7z|dwg|dxf)$/i;

/** Rak berkas seluruh orang: id personel -> array baris. */
PSN.berkas = {};
PSN.berkasBisaTulis = true;

/** Berkas milik satu baris sertifikat. */
const psnBerkasSert = (orangId, sertId) =>
  (PSN.berkas[orangId] || []).filter(b => (b.sert || '') === sertId);

async function psnBerkasMuat(){
  try{
    const r = await srvFetch('/personel/berkas', {}, 10000);
    // 401 sebelum masuk bukan kerusakan — raknya memang tertutup sampai ada sesi.
    if(r.status === 401){ PSN.berkas = {}; return; }
    const j = await r.json().catch(()=>null);
    if(!r.ok || !j) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    PSN.berkas = j.berkas || {};
    if(typeof j.bisaTulis === 'boolean') PSN.berkasBisaTulis = j.bisaTulis;
  }catch(e){
    console.warn('Rak berkas personel tidak terbaca:', e && e.message || e);
    PSN.berkas = {};
  }
}

/** Unggah satu bukti, sebagai base64 — persis seperti rak dokumen unit. */
async function psnBerkasKirim(orangId, f, sertId){
  const isi = await berkasBase64(f);
  const r = await srvFetch(`/personel/${encodeURIComponent(orangId)}/berkas`, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ nama:f.name, jenis:f.type || '', sert:sertId, isi })
  }, 120000);
  const j = await r.json().catch(()=>({}));
  if(r.status === 413 && !j.error){
    throw new Error(T('terlalu besar untuk dikirim lewat jalur ini','too large for this upload path'));
  }
  if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
  return j.baris;
}

/** Cip berkas di bawah satu baris sertifikat, beserta tombol lampir. */
function psnBerkasCip(orang, s){
  if(!orang.id){
    const nunggu = PSN.tunda.filter(t=>t.sert === (s.id || ''));
    return `<div class="psn-berkas">
      ${nunggu.map(t=>`<span class="psn-cip">
        <span class="psn-cip-tunda" title="${esc(t.file.name)} · ${brkUkuran(t.file.size)}">${
          esc(brkEkstensi(t.file.name))} · ${esc(t.file.name)}</span>
        <button class="psn-cip-buang" data-brk-tunda="${esc(t.id)}"
          title="${T('Batalkan berkas ini','Drop this file')}">✕</button>
      </span>`).join('')}
      ${PSN.berkasBisaTulis
        ? `<button class="btn garis kecil" data-brk-lampir="${esc(s.id || '')}">${
             nunggu.length ? T('Tambah bukti','Add proof')
                           : T('Lampirkan bukti','Attach proof')}</button>
           <span class="psn-berkas-ket">${nunggu.length
             ? T('Berangkat begitu Simpan ditekan.','Uploaded as soon as you press Save.')
             : T('Terkirim sesudah orangnya disimpan.','Sent once the person is saved.')}</span>`
        : `<span class="psn-berkas-ket">${T('Unggahan dimatikan di lingkungan ini.',
                                            'Uploads are off in this environment.')}</span>`}
    </div>`;
  }
  const milik = psnBerkasSert(orang.id, s.id || '');
  return `<div class="psn-berkas">
    ${milik.map(b=>`<span class="psn-cip">
      <a href="/personel/${esc(orang.id)}/berkas/${esc(b.id)}" target="_blank" rel="noopener"
        title="${esc(b.nama)} · ${brkUkuran(b.ukuran)}">${esc(brkEkstensi(b.nama))} · ${esc(b.nama)}</a>
      ${BOLEH_HAPUS.personel
        ? `<button class="psn-cip-buang" data-brk-buang="${esc(b.id)}"
             title="${T('Hapus berkas ini','Delete this file')}">✕</button>` : ''}
    </span>`).join('')}
    ${PSN.berkasBisaTulis
      ? `<button class="btn garis kecil" data-brk-lampir="${esc(s.id || '')}">${
          milik.length ? T('Tambah bukti','Add proof') : T('Lampirkan bukti','Attach proof')}</button>`
      : `<span class="psn-berkas-ket">${T('Unggahan dimatikan di lingkungan ini.',
                                          'Uploads are off in this environment.')}</span>`}
  </div>`;
}

/** Pendengar tombol lampir dan hapus di kartu personel. */
function psnBerkasPasang(){
  const badan = el('badanPersonel'); if(!badan) return;
  const orang = PSN.dibuka; if(!orang) return;

  badan.querySelectorAll('[data-brk-lampir]').forEach(t=>{
    t.addEventListener('click', ()=>{
      const pilih = document.createElement('input');
      pilih.type = 'file';
      pilih.multiple = true;
      pilih.addEventListener('change', async ()=>{
        const daftar = [...pilih.files].filter(f=>PSN_EXT_SAH.test(f.name));
        if(!daftar.length){
          pesan(T('Jenis berkas itu tidak diterima.','That file type is not accepted.'));
          return;
        }
        if(!orang.id){
          const tolak = [];
          for(const f of daftar){
            if(f.size > BRK_BATAS){
              tolak.push(f.name + ': ' + T('lebih dari 25 MB','over 25 MB')); continue;
            }
            PSN.tunda.push({ id:'t' + Date.now().toString(36) + PSN.tunda.length,
              sert: t.dataset.brkLampir, file: f });
          }
          psnGambarKartu();
          if(tolak.length) pesan(T('Tidak bisa dilampirkan: ','Cannot attach: ') + tolak.join('; '));
          return;
        }
        t.disabled = true;
        const asal = t.textContent;
        const gagal = [];
        let sudah = 0;
        for(const f of daftar){
          if(f.size > BRK_BATAS){ gagal.push(f.name + ': ' + T('lebih dari 25 MB','over 25 MB')); continue; }
          t.textContent = T(`Mengunggah ${sudah + 1}/${daftar.length}...`,
                            `Uploading ${sudah + 1}/${daftar.length}...`);
          try{ await psnBerkasKirim(orang.id, f, t.dataset.brkLampir); sudah++; }
          catch(e){ gagal.push(f.name + ': ' + (e && e.message || e)); }
        }
        t.disabled = false; t.textContent = asal;
        // Satu kali baca ulang untuk seluruh kiriman: yang dijawab server rak
        // seluruh orang, dan mengambilnya berulang tidak menambah apa pun.
        if(sudah) await psnBerkasMuat();
        psnGambarKartu();
        if(gagal.length) pesan(T('Gagal mengunggah: ','Upload failed: ') + gagal.join('; '));
        else if(sudah)   pesan(T(`${sudah} berkas terlampir.`, `${sudah} files attached.`));
      });
      pilih.click();
    });
  });

  badan.querySelectorAll('[data-brk-tunda]').forEach(t=>{
    t.addEventListener('click', ()=>{
      PSN.tunda = PSN.tunda.filter(x=>x.id !== t.dataset.brkTunda);
      psnGambarKartu();
    });
  });

  badan.querySelectorAll('[data-brk-buang]').forEach(t=>{
    t.addEventListener('click', async ()=>{
      if(!confirm(T('Hapus berkas bukti ini dari server?','Delete this attachment from the server?'))) return;
      try{
        const r = await srvFetch(
          `/personel/${encodeURIComponent(orang.id)}/berkas/${encodeURIComponent(t.dataset.brkBuang)}`,
          { method:'DELETE' }, 15000);
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
        await psnBerkasMuat();
        psnGambarKartu();
      }catch(e){
        pesan(T('Gagal menghapus: ','Could not delete: ') + (e && e.message || e));
      }
    });
  });
}

/**
 * Kirim seluruh bukti yang ditahan, sesudah orangnya punya id.
 *
 * Dijalankan berurutan, bukan berbarengan: jalur unggahnya sama dengan yang
 * dipakai rak dokumen unit, dan tombol Simpan dipakai sekalian sebagai penunjuk
 * kemajuan supaya orang tahu kartunya belum boleh ditutup.
 *
 * @returns {Promise<string[]>} daftar kegagalan; kosong berarti semuanya naik.
 */
async function psnTundaKirim(orangId, tombol){
  if(!PSN.tunda.length) return [];
  const antre = PSN.tunda;
  PSN.tunda = [];
  const gagal = [];
  const asal = tombol ? tombol.textContent : '';
  let sudah = 0;
  for(const t of antre){
    if(tombol) tombol.textContent = T(`Mengunggah ${sudah + 1}/${antre.length}...`,
                                      `Uploading ${sudah + 1}/${antre.length}...`);
    try{ await psnBerkasKirim(orangId, t.file, t.sert); sudah++; }
    catch(e){ gagal.push(t.file.name + ': ' + (e && e.message || e)); }
  }
  if(tombol) tombol.textContent = asal;
  if(sudah) await psnBerkasMuat();
  return gagal;
}

/**
 * Berkas yang tidak menempel pada baris sertifikat mana pun.
 *
 * Ada dua cara ia lahir, dan keduanya wajar: baris sertifikat yang dihapus
 * meninggalkan buktinya, dan bukti yang dilampirkan ke baris baru lalu
 * kartunya ditutup dengan Batal menempel pada baris yang tidak pernah
 * tersimpan. Tanpa panel ini berkasnya tetap ada di server tapi tidak muncul
 * di mana pun — memakan ruang, tidak bisa dibuka, tidak bisa dihapus.
 */
function psnBerkasLepas(orang){
  if(!orang.id) return '';
  // Lampiran baris pelatihan juga punya tempat, jadi bukan berkas lepas.
  const idSert = new Set([...(orang.sertifikat || []), ...(orang.pelatihan || [])].map(s=>s.id || ''));
  const lepas = (PSN.berkas[orang.id] || []).filter(b=>!idSert.has(b.sert || ''));
  if(!lepas.length) return '';
  return `<div class="atur-data" style="margin:16px 0 6px">
      <span class="ket">${lepas.length} ${
        T('berkas tidak menempel pada baris mana pun','files attached to no row')}</span>
    </div>
    <div class="psn-berkas">
      ${lepas.map(b=>`<span class="psn-cip">
        <a href="/personel/${esc(orang.id)}/berkas/${esc(b.id)}" target="_blank" rel="noopener"
          title="${esc(b.nama)} · ${brkUkuran(b.ukuran)}">${esc(brkEkstensi(b.nama))} · ${esc(b.nama)}</a>
        ${BOLEH_HAPUS.personel
          ? `<button class="psn-cip-buang" data-brk-buang="${esc(b.id)}"
               title="${T('Hapus berkas ini','Delete this file')}">✕</button>` : ''}
      </span>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--muted);padding:0 0 8px">${
      T('Sisa dari baris sertifikat yang sudah dihapus, atau dari baris yang batal disimpan.',
        'Left over from a deleted certificate row, or from a row whose save was cancelled.')}</div>`;
}

