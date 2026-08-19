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

function bukaKartuData(jenis, asal){
  dataDibuka = { jenis, unit: unitDibuka, asal: asal ? { ...asal } : null };
  const baru = !asal;
  const alatIni = jenis === 'peralatan';

  el('judulKartuData').textContent = alatIni
    ? (baru ? T('Tambah peralatan','Add equipment')   : T('Ubah peralatan','Edit equipment'))
    : (baru ? T('Tambah sparepart','Add spare part')  : T('Ubah sparepart','Edit spare part'));
  el('ketKartuData').textContent   = namaUnit(unitDibuka);
  el('btnSimpanData').textContent  = baru ? T('Tambahkan','Add') : T('Simpan perubahan','Save changes');

  /* Kotak hapus hanya untuk yang memang boleh menghapus. Menggambarnya untuk
     semua orang dan menunggu server menolak berarti menawarkan sesuatu yang
     pasti gagal — dan pada tombol berwarna bahaya, tawaran itu terbaca sebagai
     izin. Keputusan yang mengikat tetap milik server. */
  const bolehHapusIni = BOLEH_HAPUS[jenis];
  const kotakHapus = (baru || !bolehHapusIni) ? '' : `
    <div class="bahaya">
      <div class="jdl">${T('Hapus dari daftar','Delete from the list')}</div>
      <p>${T('Terhapus dari server untuk semua orang — tidak ada apa pun di E-Logbook yang ikut terhapus.',
             'Deleted from the server for everyone — nothing in E-Logbook is deleted along with it.')}
        ${alatIni ? T('Trouble yang menunjuk peralatan ini tetap ada, tapi kehilangan kaitannya.',
                      'Trouble records pointing at this equipment stay, but lose their link.') : ''}</p>
      <button class="btn bahaya-tombol" id="btnHapusData">${T('Hapus','Delete')}</button>
    </div>`;

  el('badanKartuData').innerHTML = kotakPapanNama(alatIni)
    + '<div class="isian-grid">'
    + (alatIni
    ? dIsian('dNama', T('Nama peralatan','Equipment name'), asal && asal.nama,
        T('Nama yang muncul di kartu dan di daftar trouble.','The name shown on the card and in the trouble list.'),
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
          T('Menentukan warna lampu di kartu dan hitungan di beranda.',
            'Decides the lamp colour on the card and the counts on the home screen.'))
      + kotakGambarKartu(asal)
      + '</div>'
      + kotakDokumentasi(asal)
      + kotakDicatat(asal)
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
      + kotakDicatat(asal)
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
  const { jenis, unit, asal } = dataDibuka;
  const nilai = (id) => el(id).value.trim();

  try{
    if(jenis === 'peralatan'){
      const nama = nilai('dNama');
      if(!nama) throw new Error(T('Nama peralatan belum diisi.','The equipment name is empty.'));
      const isi = {
        nama, tipe: nilai('dTipe') || '—', lokasi: nilai('dLokasi') || '—',
        status: el('dStatus').value, adegan: el('dAdegan').value,
        // Kosong berarti kartunya kembali memakai ilustrasi.
        gambar: el('dGambar').value,
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
        daftar.push({ id, ...isi, dibuat: new Date().toISOString() });
        alatDipilih = id;
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

  if(!(await dbSimpanUnit(jenis, unit))){
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
  const { jenis, unit, asal } = dataDibuka;
  if(jenis === 'peralatan'){
    const daftar = alatDaftar(unit);
    const i = daftar.findIndex(x=>x.id === asal.id);
    if(i >= 0) daftar.splice(i, 1);
    if(alatDipilih === asal.id) alatDipilih = (daftar[0] || {}).id || null;
  }else{
    const i = PART.findIndex(x=>x.pn === asal.pn);
    if(i >= 0) PART.splice(i, 1);
  }
  if(!(await dbSimpanUnit(jenis, unit))){
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

