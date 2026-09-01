/* =======================================================================
   GAMBAR KARTU PERALATAN — ilustrasi, atau foto aslinya

   Sampai sekarang kartu peralatan selalu memakai gambar vektor yang
   dibangkitkan halaman ini, dan di pojoknya tertulis ILUSTRASI supaya tidak ada
   yang mengiranya foto alat yang sebenarnya. Yang hilang: begitu foto aslinya
   ada di galeri unit, tidak ada jalan memakainya.

   Yang disimpan di baris peralatan cuma NAMA BERKASNYA, sama seperti foto
   dokumentasi — bukan gambarnya. Alasannya sama: satu foto dalam bentuk base64
   memakan seluruh jatah localStorage dalam sekali simpan.

   Kosong berarti kembali ke ilustrasi. Itu bukan keadaan istimewa yang perlu
   dijaga sendiri — cukup satu tombol yang mengosongkannya.
   ======================================================================= */

function kotakGambarKartu(asal){
  const unit = dataDibuka.unit;
  const dipilih = (asal && asal.gambar) || '';
  const galeri = (FOTO[unit] || []).map(f=>f.berkas);
  // Foto yang tertambat di baris ini didahulukan: itu yang paling mungkin
  // memang foto alat ini, bukan foto kegiatan unit yang kebetulan ada.
  const lampir = (asal && Array.isArray(asal.foto)) ? asal.foto : [];
  const semua = [...new Set([...lampir, ...galeri])];

  return `
  <div class="isian penuh gambar-kotak">
    <label>${T('Gambar di kartu','Card image')}</label>
    <div class="gambar-atur">
      <select id="dAdegan">${adeganPilihan().map(([nilai,teks])=>
        `<option value="${esc(nilai)}"${nilai === (asal ? asal.adegan : 'server') ? ' selected' : ''}
          >${esc(teks)}</option>`).join('')}</select>
      <button type="button" class="btn garis kecil" id="btnPakaiIlus"${dipilih ? '' : ' disabled'}
        >${T('Pakai ilustrasi','Use the illustration')}</button>
    </div>
    <div class="gambar-pilih" id="dGambarPilih">${
      semua.length
        ? semua.map(f=>`<button type="button" class="gambar-cip${f === dipilih ? ' terpilih' : ''}"
            data-gambar="${esc(f)}" title="${esc(f)}">
            <img src="foto/${esc(unit)}/${esc(f)}" alt="" loading="lazy"></button>`).join('')
        : `<span class="bantu" style="margin:0">${
            T('Belum ada foto di unit ini. Tambahkan lewat kotak Foto dokumentasi di bawah, lalu foto itu '
            + 'muncul di sini untuk dipilih.',
              'No photos in this unit yet. Add one in the Documentation photos box below, and it appears '
            + 'here to be chosen.')}</span>`}</div>
    <input type="hidden" id="dGambar" value="${esc(dipilih)}">
    <div class="bantu" id="dGambarKabar">${dipilih
      ? T('Kartunya memakai foto di atas. Tanda ILUSTRASI dilepas, karena yang tampil memang foto aslinya.',
          'The card uses the photo above. The ILLUSTRATION tag comes off, because what is shown really is a photograph.')
      : T('Kartunya memakai ilustrasi. Tekan salah satu foto untuk memakainya sebagai ganti.',
          'The card uses the illustration. Press one of the photos to use it instead.')}</div>
  </div>`;
}

/** Pendengar kotak gambar kartu. Dipanggil tiap kali kartunya dibuka. */
function gambarKartuPasang(){
  const kotak = el('dGambarPilih'); if(!kotak) return;
  const nilai = el('dGambar');
  const kabar = el('dGambarKabar');
  const ilus  = el('btnPakaiIlus');

  const tandai = ()=>{
    kotak.querySelectorAll('[data-gambar]').forEach(b=>
      b.classList.toggle('terpilih', b.dataset.gambar === nilai.value));
    ilus.disabled = !nilai.value;
    kabar.textContent = nilai.value
      ? T('Kartunya memakai foto yang bertanda. Tanda ILUSTRASI dilepas.',
          'The card uses the marked photo. The ILLUSTRATION tag comes off.')
      : T('Kartunya memakai ilustrasi. Tekan salah satu foto untuk memakainya sebagai ganti.',
          'The card uses the illustration. Press one of the photos to use it instead.');
  };

  kotak.addEventListener('click', e=>{
    const b = e.target.closest('[data-gambar]'); if(!b) return;
    // Menekan foto yang sedang terpilih melepasnya kembali ke ilustrasi —
    // jalan pulang yang sama dengan jalan perginya.
    nilai.value = nilai.value === b.dataset.gambar ? '' : b.dataset.gambar;
    tandai();
  });
  ilus.addEventListener('click', ()=>{ nilai.value = ''; tandai(); });
}

function bukaKartuData(jenis, asal, parentAlatId){
  const baru = !asal;
  const alatIni = jenis === 'peralatan';
  const subIni  = jenis === 'subunit';
  const seperti = alatIni || subIni;      // sub-unit memakai bentuk isian yang sama
  // Bentuk kompak untuk alat induk: nama + gambar kartu + grup saja. Dipakai
  // dua situasi:
  //  1. Menambah alat baru — item teknisnya (merk/tipe/S-N/P-N/tahun/lokasi/
  //     status) diisi belakangan lewat tab sub-unit di panel Identitas,
  //     bersama sejarahnya yang memang berkunci per sub. Jadi form Tambah
  //     tidak menuntut isian yang belum tentu ada saat alatnya baru masuk.
  //  2. Menyunting alat yang sudah punya sub — field teknis pindah ke sub,
  //     yang tersisa di induk cuma nama & gambar kartu.
  const kompak = alatIni && (!asal
    || (Array.isArray(asal.sub) && asal.sub.length > 0));
  dataDibuka = { jenis, unit: unitDibuka, asal: asal ? { ...asal } : null,
                 parentAlatId: parentAlatId || null, kompak };

  // Konteks parent buat sub-unit: nama alat induk masuk ke keterangan judul
  // supaya jelas ini sub milik alat mana — beda kalau di layar terlihat dua
  // panel modal berturut-turut dan orang lupa yang barusan diklik.
  const parentAlat = subIni
    ? (PERALATAN[unitDibuka] || []).find(a=>a.id === parentAlatId)
    : null;

  el('judulKartuData').textContent = alatIni
    ? (baru ? T('Tambah peralatan','Add equipment')   : T('Ubah peralatan','Edit equipment'))
    : subIni
      ? (baru ? T('Tambah sub-unit','Add sub-unit')   : T('Ubah sub-unit','Edit sub-unit'))
      : (baru ? T('Tambah sparepart','Add spare part') : T('Ubah sparepart','Edit spare part'));
  el('ketKartuData').textContent   = subIni && parentAlat
    ? `${namaUnit(unitDibuka)} · ${parentAlat.nama}`
    : namaUnit(unitDibuka);
  el('btnSimpanData').textContent  = baru ? T('Tambahkan','Add') : T('Simpan perubahan','Save changes');

  /* Kotak hapus hanya untuk yang memang boleh menghapus. Menggambarnya untuk
     semua orang dan menunggu server menolak berarti menawarkan sesuatu yang
     pasti gagal — dan pada tombol berwarna bahaya, tawaran itu terbaca sebagai
     izin. Keputusan yang mengikat tetap milik server. Sub-unit menumpang izin
     peralatan — ia hidup di dalam baris peralatan, jadi izinnya satu paket. */
  const bolehHapusIni = subIni ? BOLEH_HAPUS.peralatan : BOLEH_HAPUS[jenis];
  const kotakHapus = (baru || !bolehHapusIni) ? '' : `
    <div class="bahaya">
      <div class="jdl">${subIni
        ? T('Hapus sub-unit ini','Delete this sub-unit')
        : T('Hapus dari daftar','Delete from the list')}</div>
      <p>${subIni
        ? T('Sub-unit ini hilang dari alat induknya untuk semua orang. Data alat induk sendiri tetap.',
            'This sub-unit disappears from its parent equipment for everyone. The parent record itself stays.')
        : T('Terhapus dari server untuk semua orang — tidak ada apa pun di E-Logbook yang ikut terhapus.',
            'Deleted from the server for everyone — nothing in E-Logbook is deleted along with it.')}
        ${alatIni ? T('Trouble yang menunjuk peralatan ini tetap ada, tapi kehilangan kaitannya.',
                      'Trouble records pointing at this equipment stay, but lose their link.') : ''}</p>
      <button class="btn bahaya-tombol" id="btnHapusData">${T('Hapus','Delete')}</button>
    </div>`;

  // Kartu Tambah/Ubah alat induk — bentuk ringkas. Cuma nama, grup, gambar
  // kartu, dan foto dokumentasi. Isian teknis (merk/tipe/S-N/P-N/tahun/lokasi/
  // status) tidak diminta di sini: alat baru diisi belakangan lewat tab
  // sub-unit di panel Identitas, dan sejarahnya memang berkunci per sub. Untuk
  // alat yang sudah punya sub, tempatnya bergeser ke sub — jadi bentuknya
  // sama.
  if(kompak){
    const nAda = !!asal;
    const ket = nAda
      ? T('Peralatan ini punya sub-unit — merk, tipe, S/N, P/N, tahun, lokasi, dan status '
        + 'diatur di masing-masing tab sub-unit. Di sini cukup atur nama yang tampil di kartu '
        + 'dan gambar kartunya.',
          'This equipment has sub-units — make, type, S/N, P/N, year, location, and status live '
        + 'in each sub-unit tab. Here you only set the card display name and image.')
      : T('Cukup nama dan gambar kartu dulu. Setelah alat masuk daftar, buka panel Identitas '
        + 'dan tambah sub-unit di sana — merk, tipe, S/N, P/N, tahun, lokasi, status, dan sejarahnya '
        + 'diisi per sub, sesuai bentuk alat sesungguhnya.',
          'Name and card image are enough for now. After the equipment is added, open the Identity '
        + 'panel and add sub-units there — make, type, S/N, P/N, year, location, status, and history '
        + 'are filled per sub, matching how the equipment is really shaped.');
    el('badanKartuData').innerHTML = `
      <div class="bantu" style="margin-bottom:10px">${ket}</div>
      <div class="isian-grid">
        ${dIsian('dNama', T('Nama peralatan','Equipment name'),
          (asal && asal.nama) || '',
          T('Nama yang muncul di kartu dan di daftar trouble.','The name shown on the card and in the trouble list.'),
          null, true)}
        ${dIsian('dGrup', T('Grup lokasi','Location group'),
          (asal && asal.grup) || (!asal ? grupDipilih : ''),
          T('Kelompok tab di layar Peralatan — mis. <span class="mono">JATSC</span>. Kosongkan kalau tidak dalam kelompok tertentu.',
            'The tab group on the Equipment screen — e.g. <span class="mono">JATSC</span>. Leave empty if none.'))}
        ${kotakGambarKartu(asal)}
      </div>
      ${kotakDokumentasi(asal)}
      ${kotakHapus}`;
    el('btnHapusData')?.addEventListener('click', hapusData);
    gambarKartuPasang();
    dokumentasiPasang(asal);
    el('lapisData').classList.add('buka');
    el('dNama').focus();
    return;
  }

  el('badanKartuData').innerHTML = kotakPapanNama(seperti)
    + '<div class="isian-grid">'
    + (seperti
    ? dIsian('dNama',
        subIni ? T('Nama sub-unit','Sub-unit name') : T('Nama peralatan','Equipment name'),
        asal && asal.nama,
        subIni
          ? T('Nama yang jadi label tab di panel Identity — mis. baris pertama, kanal, atau nomor unitnya.',
              'The label shown on the Identity tab — e.g. line one, channel, or the unit number.')
          : T('Nama yang muncul di kartu dan di daftar trouble.','The name shown on the card and in the trouble list.'),
        null, true)
      + dIsian('dMerk', T('Merk','Make'), asal && asal.merk,
        T('Pabrikannya, mis. <span class="mono">Park Air Systems</span>.',
          'The manufacturer, e.g. <span class="mono">Park Air Systems</span>.'))
      + dIsian('dTipe', T('Tipe / model','Type / model'), asal && asal.tipe,
        T('Boleh sekalian jumlahnya, mis. <span class="mono">T6 · 8 unit</span>.',
          'The quantity may go here too, e.g. <span class="mono">T6 · 8 units</span>.'))
      + dIsian('dSn', T('Serial number (S/N)','Serial number (S/N)'), asal && asal.sn)
      + dIsian('dPnAlat', T('Part number (P/N)','Part number (P/N)'), asal && asal.pn)
      + dIsian('dTahun', T('Tahun pembuatan','Year of manufacture'), asal && asal.tahun,
        T('Yang tertera di papan nama, bukan tanggal pencatatan di aplikasi ini.',
          'As printed on the nameplate — not the date this record was created.'))
      + dIsian('dLokasi', T('Lokasi','Location'), asal && asal.lokasi,
        T('Ruang atau shelter tempat alatnya berada.','The room or shelter the equipment sits in.'))
      + dPilih('dStatus', 'Status', ALAT_STATUS, asal ? asal.status : 'Normal',
          subIni
            ? T('Status sub-unit ini sendiri — tidak menggantikan status alat induk.',
                'Status of this sub-unit — does not replace the parent equipment status.')
            : T('Menentukan warna lampu di kartu dan hitungan di beranda.',
                'Decides the lamp colour on the card and the counts on the home screen.'))
      // Grup lokasi — hanya untuk alat, sub-unit ikut grup alat induknya.
      // Waktu tambah alat dari tab grup yang sedang aktif, isian ini terisi
      // otomatis dengan nama tab itu supaya alat baru langsung masuk grupnya.
      + (alatIni ? dIsian('dGrup', T('Grup lokasi','Location group'),
          (asal && asal.grup) || (!asal ? grupDipilih : ''),
          T('Kelompok tab di layar Peralatan — mis. <span class="mono">JATSC</span>, '
          + '<span class="mono">NEW JATSC</span>, <span class="mono">Radio ACC Primary</span>. '
          + 'Kosongkan kalau alatnya tidak dalam kelompok tertentu.',
            'The tab group on the Equipment screen — e.g. <span class="mono">JATSC</span>, '
          + '<span class="mono">NEW JATSC</span>, <span class="mono">Radio ACC Primary</span>. '
          + 'Leave empty if the equipment does not belong to a specific group.')) : '')
      // Sub-unit tidak punya kartu 3D sendiri — ia hidup di dalam kartu alat
      // induknya. Kotak "gambar kartu" (adegan + foto pengganti) sengaja
      // dilewati supaya isian tidak menyesatkan.
      + (alatIni ? kotakGambarKartu(asal) : '')
      + '</div>'
      + kotakDokumentasi(asal)
      + kotakHapus
    : dIsian('dNama', T('Nama sparepart','Spare part name'), asal && asal.nama, null, null, true)
      + dIsian('dMerk', T('Merk','Make'), asal && asal.merk)
      + dIsian('dTipe', T('Tipe / model','Type / model'), asal && asal.tipe)
      + dIsian('dPn', 'Part number', asal && asal.pn,
        T('Harus unik — dipakai untuk mengenali barisnya.','Must be unique — it is how the row is identified.'))
      + dIsian('dSn', T('Serial number (S/N)','Serial number (S/N)'), asal && asal.sn)
      + dIsian('dTahun', T('Tahun pembuatan','Year of manufacture'), asal && asal.tahun)
      + dIsian('dRak', T('Rak','Rack'), asal && asal.rak,
        T('Kode rak di gudang, mis. <span class="mono">A-04</span>.',
          'The rack code in the store, e.g. <span class="mono">A-04</span>.'))
      + dIsian('dStok', T('Stok','Stock'), asal ? asal.stok : 0, null, 'number')
      + dIsian('dMin', T('Minimum','Minimum'), asal ? asal.min : 1,
          T('Stok di bawah angka ini dihitung sebagai sparepart minim di beranda.',
            'Stock below this number counts as a low spare part on the home screen.'), 'number')
      + dPilih('dSatuan', T('Satuan','Unit'), PART_SATUAN, asal ? asal.satuan : 'pcs')
      + dIsian('dPakai', T('Dipakai terakhir','Last used'), asal ? asal.pakai : isoHariIni(), null, 'date')
      + '</div>'
      + kotakDokumentasi(asal)
      + kotakHapus);

  el('btnHapusData')?.addEventListener('click', hapusData);
  papanNamaPasang();
  gambarKartuPasang();
  dokumentasiPasang(asal);
  el('lapisData').classList.add('buka');
  el('dNama').focus();
}

function tutupKartuData(){
  el('lapisData').classList.remove('buka');
  dataDibuka = null;
}

async function simpanData(){
  const { jenis, unit, asal, parentAlatId, kompak } = dataDibuka;
  const nilai = (id) => el(id).value.trim();

  try{
    if(jenis === 'peralatan'){
      const nama = nilai('dNama');
      if(!nama) throw new Error(T('Nama peralatan belum diisi.','The equipment name is empty.'));
      // Bentuk kompak (alat induk yang sudah punya sub-unit): hanya nama,
      // grup, adegan, gambar kartu, dan foto dokumentasi yang disunting di
      // sini. Field teknis (merk/tipe/sn/pn/tahun/lokasi/status) TIDAK
      // ditulis ulang — dibiarkan apa adanya pada baris supaya nilai lama
      // (kalau ada) tidak tak sengaja dihapus. Object.assign hanya menimpa
      // key yang ada di `isi`.
      const isi = kompak
        ? {
            nama,
            adegan: el('dAdegan').value,
            gambar: el('dGambar').value,
            grup: nilai('dGrup'),
            foto: dokTerpasang()
          }
        : {
            nama, tipe: nilai('dTipe') || '—', lokasi: nilai('dLokasi') || '—',
            status: el('dStatus').value, adegan: el('dAdegan').value,
            // Kosong berarti kartunya kembali memakai ilustrasi.
            gambar: el('dGambar').value,
            grup: nilai('dGrup'),
            merk: nilai('dMerk'), sn: nilai('dSn'), pn: nilai('dPnAlat'),
            tahun: nilai('dTahun'), foto: dokTerpasang()
          };
      const daftar = alatDaftar(unit);
      if(asal){
        const a = daftar.find(x=>x.id === asal.id);
        if(!a) throw new Error(T('Peralatan itu sudah tidak ada di daftar.','That equipment is no longer in the list.'));
        Object.assign(a, isi);
      }else{
        const id = alatIdBaru(unit, nama);
        // dibuat: kapan baris ini masuk ke daftar — berbeda dari tahun pembuatan
        // alatnya di papan nama, dan keduanya memang perlu tercatat.
        // Untuk form ringkas, field teknis yang tidak diminta tetap dipasang
        // di sini dengan default: tanpa itu, kartu peralatan akan menampilkan
        // "undefined" pada status/tipe/lokasi sebelum jawaban server datang
        // (server mengisi default di rapikanAlat, tapi klien tidak baca ulang
        // setelah simpan). Server akan menimpa kalau isinya tak sah, jadi
        // memasang default lokal aman.
        const bakuKompak = kompak ? {
          merk: '', tipe: '', sn: '', pn: '', tahun: '', lokasi: '',
          status: 'Normal', sub: []
        } : {};
        daftar.push({ id, ...bakuKompak, ...isi, dibuat: new Date().toISOString() });
        alatDipilih = id;
      }
    }else if(jenis === 'subunit'){
      const nama = nilai('dNama');
      if(!nama) throw new Error(T('Nama sub-unit belum diisi.','The sub-unit name is empty.'));
      const parent = alatDaftar(unit).find(a=>a.id === parentAlatId);
      if(!parent) throw new Error(T('Alat induknya sudah tidak ada di daftar.',
                                    'The parent equipment is no longer in the list.'));
      const isi = {
        nama, tipe: nilai('dTipe'), lokasi: nilai('dLokasi'),
        status: el('dStatus').value,
        merk: nilai('dMerk'), sn: nilai('dSn'), pn: nilai('dPnAlat'),
        tahun: nilai('dTahun'), foto: dokTerpasang()
      };
      parent.sub = Array.isArray(parent.sub) ? parent.sub : [];
      if(asal){
        const s = parent.sub.find(x=>x.id === asal.id);
        if(!s) throw new Error(T('Sub-unit itu sudah tidak ada di daftar.',
                                 'That sub-unit is no longer in the list.'));
        Object.assign(s, isi);
      }else{
        const id = 's' + Math.random().toString(36).slice(2,8);
        parent.sub.push({ id, ...isi, dibuat: new Date().toISOString() });
        // Sub baru langsung jadi tab aktif — hampir pasti orang mau langsung
        // melihat isinya di panel Identity, bukan tab lama.
        subDipilih = id;
      }
    }else{
      const nama = nilai('dNama');
      const pn   = nilai('dPn');
      if(!nama) throw new Error(T('Nama sparepart belum diisi.','The spare part name is empty.'));
      if(!pn)   throw new Error(T('Part number belum diisi.','The part number is empty.'));
      // Part number jadi pegangan satu-satunya untuk menemukan barisnya lagi,
      // jadi kembarnya harus ditolak sebelum tersimpan — bukan setelah.
      if(PART.some(p=>p.pn.toLowerCase() === pn.toLowerCase() && (!asal || p.pn !== asal.pn))){
        throw new Error(T('Part number ' + pn + ' sudah dipakai sparepart lain.',
                          'Part number ' + pn + ' is already used by another spare part.'));
      }
      const isi = {
        nama, pn, unit,
        rak: nilai('dRak') || '—',
        stok: Math.max(0, Number(el('dStok').value) || 0),
        min:  Math.max(0, Number(el('dMin').value) || 0),
        satuan: el('dSatuan').value,
        pakai: nilai('dPakai') || isoHariIni(),
        merk: nilai('dMerk'), tipe: nilai('dTipe'), sn: nilai('dSn'),
        tahun: nilai('dTahun'), foto: dokTerpasang()
      };
      if(asal){
        const p = PART.find(x=>x.pn === asal.pn);
        if(!p) throw new Error(T('Sparepart itu sudah tidak ada di daftar.','That spare part is no longer in the list.'));
        Object.assign(p, isi);
      }else{
        PART.push({ ...isi, dibuat: new Date().toISOString() });
      }
    }
  }catch(e){
    // Kartunya dibiarkan terbuka: isian yang sudah diketik tidak boleh hilang
    // hanya karena satu syarat belum terpenuhi.
    pesan(e && e.message || String(e));
    return;
  }

  // Sub-unit hidup di dalam baris peralatan — endpoint penyimpanannya sama.
  const modulSimpan = jenis === 'subunit' ? 'peralatan' : jenis;
  if(!(await dbSimpanUnit(modulSimpan, unit))){
    // Pesannya sudah disampaikan dbSimpanUnit, dan isinya sudah dibaca ulang
    // dari server. Kartunya ditutup supaya yang tampil bukan isian lama yang
    // ternyata tidak jadi tersimpan.
    tutupKartuData();
    gambarUnit(); gambarUbin(); gambarCincin();
    return;
  }
  // Pencatatannya dikerjakan server dengan identitas sungguhan; mencatat di
  // sini juga akan memunculkan satu perbuatan dua kali.
  tutupKartuData();
  gambarUnit(); gambarUbin(); gambarCincin();
  pesan(asal ? T('Perubahan tersimpan.','Changes saved.') : T('Ditambahkan ke daftar.','Added to the list.'));
}

async function hapusData(){
  const { jenis, unit, asal, parentAlatId } = dataDibuka;
  if(jenis === 'peralatan'){
    const daftar = alatDaftar(unit);
    const i = daftar.findIndex(x=>x.id === asal.id);
    if(i >= 0) daftar.splice(i, 1);
    if(alatDipilih === asal.id) alatDipilih = (daftar[0] || {}).id || null;
  }else if(jenis === 'subunit'){
    const parent = alatDaftar(unit).find(a=>a.id === parentAlatId);
    if(parent && Array.isArray(parent.sub)){
      parent.sub = parent.sub.filter(x=>x.id !== asal.id);
    }
    // Kalau tab aktif adalah yang barusan dihapus, lepas — panel Identity
    // akan jatuh balik ke sub pertama yang tersisa (atau ke Induk).
    if(subDipilih === asal.id) subDipilih = null;
  }else{
    const i = PART.findIndex(x=>x.pn === asal.pn);
    if(i >= 0) PART.splice(i, 1);
  }
  const modulSimpan = jenis === 'subunit' ? 'peralatan' : jenis;
  if(!(await dbSimpanUnit(modulSimpan, unit))){
    tutupKartuData();
    gambarUnit(); gambarUbin(); gambarCincin();
    return;
  }
  tutupKartuData();
  gambarUnit(); gambarUbin(); gambarCincin();
  pesan(T('Dihapus dari daftar.','Deleted from the list.'));
}

/* Satu pendengar di #isiUnit, bukan satu per tombol: seluruh isi layar unit
   diganti tiap kali unitnya berpindah atau daftarnya berubah, dan pendengar
   yang dipasang per tombol akan mati bersama tombolnya. */
el('isiUnit').addEventListener('click', e=>{
  const tambah = e.target.closest('[data-db-tambah]');
  if(tambah) return bukaKartuData(tambah.dataset.dbTambah, null);

  const ubah = e.target.closest('[data-db-ubah]');
  if(ubah){
    e.stopPropagation();       // tombol Ubah di kartu alat tidak ikut memilih kartunya
    const jenis = ubah.dataset.dbUbah;
    const asal = jenis === 'peralatan'
      ? (PERALATAN[unitDibuka] || []).find(a=>a.id === ubah.dataset.alat)
      : PART.find(p=>p.pn === ubah.dataset.pn);
    if(asal) bukaKartuData(jenis, asal);
    return;
  }

});

el('btnBatalData').addEventListener('click', tutupKartuData);
el('btnSimpanData').addEventListener('click', simpanData);
el('lapisData').addEventListener('click', e=>{ if(e.target === el('lapisData')) tutupKartuData(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisData').classList.contains('buka')) tutupKartuData();
});

