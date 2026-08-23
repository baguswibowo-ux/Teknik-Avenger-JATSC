/* =======================================================================
   DATABASE UNIT — isinya berbeda per unit, aksesnya berbeda per peran
   ======================================================================= */
/**
 * Deretan tombol unit di atas layar Database Unit.
 *
 * Yang digambar hanya unit yang memang terbuka untuk akun ini. Sebelumnya
 * seluruh unit tampil dan yang tertutup diberi gembok — bermaksud menjelaskan,
 * tapi hasilnya tujuh tombol mati mengapit satu yang hidup, dan orang harus
 * mencari unitnya sendiri di antara yang bukan urusannya. Administrator tetap
 * melihat semuanya karena memang itu pekerjaannya.
 */
function gambarPilihUnit(){
  const boleh = unitBoleh();
  const semua = akun.unit === 'semua';
  el('ketAkses').textContent = semua
    ? T(`Peran ${peranAkun()} — seluruh ${UNIT.length} unit terbuka.`,
        `Role ${peranAkun()} — all ${UNIT.length} units are open.`)
    : boleh.length === 1
      ? T(`Peran ${peranAkun()} — unit ${boleh[0].nama}.`,
          `Role ${peranAkun()} — ${boleh[0].nama} unit.`)
      : T(`Peran ${peranAkun()} — ${boleh.length} unit terbuka untuk akun ini.`,
          `Role ${peranAkun()} — ${boleh.length} units are open to this account.`);

  if(!boleh.length){
    // Akun tanpa unit sama sekali. Layar kosong tanpa keterangan akan terbaca
    // sebagai kerusakan, padahal ini soal penugasan yang belum diberikan.
    el('pilihUnit').innerHTML = `<div style="color:var(--muted);font-size:12.5px;padding:4px 0">${
      T('Akun ini belum ditugaskan ke unit mana pun. Mintalah administrator menugaskannya lewat Kelola Akun.',
        'This account has not been assigned to any unit yet. Ask an administrator to assign one under Manage Accounts.')}</div>`;
    return;
  }

  el('pilihUnit').innerHTML = boleh.map(u=>
    `<button class="btn ${u.kode===unitDibuka?'':'garis'}" data-unit="${u.kode}">${esc(u.nama)}</button>`
  ).join('');
  el('pilihUnit').querySelectorAll('button[data-unit]').forEach(b=>{
    b.addEventListener('click', ()=>bukaUnit(b.dataset.unit));
  });
}

function bukaUnit(kode){
  unitDibuka = kode; subtabAktif = 'peralatan';
  alatDipilih = (PERALATAN[kode] || [])[0] ? PERALATAN[kode][0].id : null;
  gambarPilihUnit(); gambarUnit(); pindahLayar('unit');
}

/* =======================================================================
   GAMBAR PENGENAL UNIT

   Kotak di kiri nama unit. Bawaannya ilustrasi vektor yang dibangkitkan
   halaman ini menurut u.adegan — bagus untuk contoh, tapi ia tidak pernah
   jadi gambar unit yang sebenarnya: yang ada di kepala Radtel bukan menara
   karangan melainkan logo atau foto yang dipilih sendiri.

   Servernya sudah ada sejak modul database unit dipasang (POST dan DELETE
   /logo/:unit, berkasnya di public/foto/_logo/), cuma belum pernah ada jalan
   menekannya dari layar. Ini jalannya.

   Hanya administrator, dan itu diputuskan server — bukan hak.json: mengganti
   gambar unit mengubah layar semua orang sekaligus, dan tidak ada centang di
   layar hak yang pantas membukanya tanpa sengaja. Tombol di sini cuma tidak
   digambar untuk yang pasti ditolak.
   ======================================================================= */

const bolehGantiIkon = () =>
  KEMAMPUAN.galeriTulis && !!akun && akun.role === 'admin';

/** Kotak gambar unit: yang diunggah kalau ada, ilustrasi kalau belum. */
function ikonUnitHtml(u){
  const l = LOGO[u.kode];
  /* Nama berkasnya tetap sama tiap kali diganti (kode unit + ekstensi), jadi
     tanpa penanda ini peramban akan menunjukkan gambar lama sampai singgahannya
     kedaluwarsa. Cap waktunya yang jadi penandanya. */
  const isi = (l && l.berkas)
    ? `<img src="/foto/_logo/${esc(l.berkas)}?v=${esc(String(l.jam || '').replace(/\D/g, ''))}"
         alt="${esc(u.nama)}">`
    : adegan(u.adegan);
  if(!bolehGantiIkon()) return `<div class="ikon-unit">${isi}</div>`;
  return `<button type="button" class="ikon-unit bisa" id="ikonUnit"
    title="${T('Ganti gambar unit ini','Change this unit’s image')}">${isi}<span class="tutup">${
      l ? T('Ganti gambar','Change image') : T('Pilih gambar','Choose image')}</span></button>`;
}

const IKON_EXT_SAH   = /\.(jpe?g|png|webp|svg)$/i;
const IKON_BATAS     = 2 * 1024 * 1024;   // sama dengan LOGO_BATAS di server.js

function pasangIkonUnit(){
  const kotak = el('isiUnit').querySelector('#ikonUnit');
  if(kotak) kotak.addEventListener('click', ()=>ikonUnitPilih(unitDibuka, kotak));
  const buang = el('isiUnit').querySelector('#ikonUnitBuang');
  if(buang) buang.addEventListener('click', ()=>ikonUnitBuang(unitDibuka));
}

/** Pilih berkas, kirim, lalu gambar ulang layarnya dari jawaban server. */
function ikonUnitPilih(unit, kotak){
  const pilih = document.createElement('input');
  pilih.type = 'file';
  pilih.accept = '.png,.webp,.jpg,.jpeg,.svg,image/png,image/webp,image/jpeg,image/svg+xml';
  pilih.addEventListener('change', async ()=>{
    const berkas = pilih.files[0]; if(!berkas) return;
    // Diperiksa di sini juga, bukan cuma di server: menunggu 2 MB terkirim
    // hanya untuk ditolak adalah menit yang tidak perlu hilang.
    if(!IKON_EXT_SAH.test(berkas.name)){
      pesan(T('Gambar harus .png, .webp, .jpg, atau .svg.',
              'The image must be .png, .webp, .jpg, or .svg.')); return;
    }
    if(berkas.size > IKON_BATAS){
      pesan(T('Gambar lebih dari 2 MB.','The image is larger than 2 MB.')); return;
    }
    kotak.classList.add('sibuk');
    try{
      const r = await srvFetch('/logo/' + encodeURIComponent(unit), {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ berkas: berkas.name, isi: await berkasBase64(berkas) })
      }, 20000);
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
      await unitdbMuat();
      gambarUnit();
      pesan(T('Gambar unit diganti.','Unit image changed.'));
    }catch(e){
      kotak.classList.remove('sibuk');
      pesan(T('Gagal mengganti gambar: ','Could not change the image: ') + (e && e.message || e));
    }
  });
  pilih.click();
}

async function ikonUnitBuang(unit){
  if(!confirm(T('Kembalikan gambar unit ini ke ilustrasi bawaan?\n\nBerkasnya dihapus dari server.',
                'Return this unit\'s image to the default illustration?\n\nThe file is removed from the server.'))) return;
  try{
    const r = await srvFetch('/logo/' + encodeURIComponent(unit), { method:'DELETE' }, 15000);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
    await unitdbMuat();
    gambarUnit();
  }catch(e){
    pesan(T('Gagal menghapus gambar: ','Could not remove the image: ') + (e && e.message || e));
  }
}

/**
 * Isi kolom "Teknisi / Manager Teknik" untuk satu baris logbook.
 *
 * Dua nama bertumpuk, masing-masing berlabel. Sebelum ini kolomnya cuma satu
 * nama, dipilih dengan `PJNama || TeknisiNama || DiinputOleh` — dan karena
 * pj_nama di E-Logbook baru terisi setelah catatannya ditandatangani, yang
 * hampir selalu lolos justru nama teknisinya. Kolom bernama Penanggung Jawab
 * yang isinya teknisi: benar orangnya, salah sebutannya.
 *
 * Manager teknik yang belum mengisi ditulis "belum ditandatangani", bukan
 * dipinjamkan dari daftar akun pejabat. Nama pejabat yang dipasang di baris
 * yang belum ia sentuh adalah tanda tangan yang tidak pernah dibubuhkan.
 */
function namaPenanggungHtml(r){
  const baris = (label, nama, kosong)=>`<div class="nama-peran">
    <span class="lbl">${label}</span>
    <span class="${nama ? 'nm' : 'nm belum'}">${esc(nama || kosong)}</span></div>`;
  return baris(T('Teknisi','Technician'), r.teknisi, T('tidak tercatat','not recorded'))
       + baris(T('Manager','Manager'),    r.pj,      T('belum ditandatangani','not yet signed'));
}

function gambarUnit(){
  if(!unitDibuka){
    const boleh = unitBoleh();
    const daftar = boleh.length === UNIT.length
      ? T('seluruh unit','all units') : boleh.map(u=>esc(u.nama)).join(', ');
    el('isiUnit').innerHTML = `<div class="panel"><div class="badan" style="color:var(--muted);font-size:13px;line-height:1.7">
      ${T('Pilih unit di atas untuk membuka databasenya. Akun','Pick a unit above to open its database. Account')}
      <b style="color:var(--text)">${esc(akun.user)}</b>
      ${T('berhak atas','has access to')} ${daftar}.
      </div></div>`;
    return;
  }
  const u = infoUnit(unitDibuka);
  const alat = PERALATAN[unitDibuka] || [];
  const trouble = TROUBLE.filter(t=>t.unit === unitDibuka).sort((a,b)=>umurHari(b.tgl)-umurHari(a.tgl));
  const part = PART.filter(p=>p.unit === unitDibuka);
  // Saat tersambung, unit yang memang belum punya catatan harus terlihat
  // kosong — bukan diisi cuplikan contoh yang menyamar jadi data nyata.
  const log = LOGBOOK[unitDibuka] || [];
  const radkom = unitDibuka === 'radkom';
  const foto = FOTO[unitDibuka] || [];

  const tab = (id,teks,lencana)=>`<button data-sub="${id}" class="${subtabAktif===id?'aktif':''}">
    ${teks}${lencana?` <span class="mono" style="opacity:.75">(${lencana})</span>`:''}</button>`;

  el('isiUnit').innerHTML = `
    <div class="kepala-unit">
      ${ikonUnitHtml(u)}
      <div style="flex:1;min-width:200px">
        <h2>${esc(u.nama)}</h2>
        <div class="sub">${esc(u.alat)}</div>
        <div class="mono" style="font-size:10.5px;color:var(--muted);margin-top:5px">
          ${T('kode dinas','shift codes')} ${u.dinas.join(' · ')} · ${alat.length}
          ${T('peralatan terdaftar','equipment registered')}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${(bolehGantiIkon() && LOGO[unitDibuka]) ? `<button class="btn garis kecil" id="ikonUnitBuang">${
          T('Pakai ilustrasi','Use illustration')}</button>` : ''}
        <!-- Bukan "unit ini": E-Logbook tidak membaca satu pun parameter URL,
             dan unit aktifnya cuma ada di memori — tidak ada cara menunjuknya
             dari luar. Yang dijanjikan tombol ini hanya membuka aplikasinya.

             Tetap di sini walau kepala dashboard sekarang punya tombol yang
             sama: yang sudah berada di layar unit tidak perlu naik lagi ke
             kepala halaman untuk menyeberang. -->
        <a class="btn" href="#" data-elogbook>${T('Buka E-Logbook','Open E-Logbook')}</a>
      </div>
    </div>

    <div class="subtab" id="subtab">
      ${tab('peralatan',T('Peralatan','Equipment'),alat.length)}
      ${tab('trouble','Trouble',trouble.length)}
      ${tab('sparepart',T('Sparepart','Spare Parts'),part.length)}
      ${tab('dinas',T('Jadwal Dinas','Duty Roster'))}
      ${tab('berkala',T('Kegiatan Berkala','Recurring Jobs'),
            bklJatuhTempo(unitDibuka).filter(x=>x.sisa <= 0).length || '')}
      ${tab('personel',T('Personel','Personnel'), psnAwasUnit(unitDibuka) || '')}
      ${tab('logbook','E-Logbook')}
      ${tab('galeri',T('Galeri','Gallery'),foto.length)}
      ${tab('dokumen',T('Dokumen','Documents'),(BERKAS[unitDibuka] || []).length)}
    </div>

    <!-- PERALATAN -->
    <div class="subisi ${subtabAktif==='peralatan'?'aktif':''}" id="s-peralatan">
      <div class="atur-data">
        <span class="ket">${alat.length} ${T('peralatan · klik kartu untuk membuka sejarah dan identitasnya',
          'equipment · click a card to open its history and identity')}</span>
        <span class="tombol">
          ${bolehSuntingDb('peralatan') ? `<button class="btn kecil" data-db-tambah="peralatan">${
            T('Tambah peralatan','Add equipment')}</button>` : ''}
        </span>
      </div>
      <div class="alat-grid">${alat.map(a=>{
        const t = trouble.filter(x=>x.alat === a.id).length;
        const w = a.status==='Down'?'merah':a.status==='Warning'?'kuning':'hijau';
        // Foto aslinya kalau ada, ilustrasi kalau tidak. Tanda ILUSTRASI ikut
        // dilepas bersama gambarnya — tanda itu ada supaya tidak ada yang
        // mengira gambar vektor sebagai foto alat, dan pada foto sungguhan ia
        // justru berbohong ke arah sebaliknya.
        const gbr = a.gambar
          ? `<img class="bingkai-foto" src="foto/${esc(unitDibuka)}/${esc(a.gambar)}" alt=""
               loading="lazy" onerror="this.remove()">`
          : `${adegan(a.adegan)}<span class="tanda-ilus">${T('ILUSTRASI','ILLUSTRATION')}</span>`;
        return `<article class="alat-kartu ${a.id===alatDipilih?'terpilih':''}" data-alat="${a.id}">
          <div class="bingkai"><span class="lampu ${w}"></span>${gbr}</div>
          <div class="isi">
            <div class="nm">${esc(a.nama)}</div>
            <div class="tp">${esc(a.tipe)}</div>
            <div class="kaki">
              <span class="cip ${w==='merah'?'bahaya':w==='kuning'?'awas':'aman'}">${esc(a.status)}</span>
              <span class="mono" style="font-size:10px;color:var(--muted)">${esc(a.lokasi)}</span>
            </div>
          </div></article>`;
      }).join('')}</div>
      ${alat.length ? '' : `<div class="panel"><div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">
        ${T('Belum ada peralatan terdaftar di unit ini. Tekan','No equipment registered in this unit yet. Press')}
        <b style="color:var(--text)">${T('Tambah peralatan','Add equipment')}</b>
        ${T('di atas untuk mengisinya.','above to fill it in.')}</div></div>`}
      <div id="rinciAlat" style="margin-top:18px"></div>
    </div>

    <!-- TROUBLE -->
    <div class="subisi ${subtabAktif==='trouble'?'aktif':''}" id="s-trouble">
      <div class="panel"><div class="kepala"><h3>Trouble ${esc(u.nama)}</h3>
        <span class="ket">${trouble.length} ${T('catatan belum selesai','records still open')}</span></div>
        ${trouble.length ? `<table>${kepalaTrouble(true)}
          <tbody>${trouble.map(t=>barisTrouble(t,true)).join('')}</tbody></table>`
          : `<div class="badan" style="color:var(--muted);font-size:12.5px">${
              T('Tidak ada trouble terbuka di unit ini.','No open trouble in this unit.')}</div>`}
      </div></div>

    <!-- SPAREPART -->
    <div class="subisi ${subtabAktif==='sparepart'?'aktif':''}" id="s-sparepart">
      <div class="atur-data">
        <span class="ket">${part.length} ${T('sparepart terdaftar di unit ini',
          'spare parts registered in this unit')}</span>
        <span class="tombol">
          ${bolehSuntingDb('sparepart') ? `<button class="btn kecil" data-db-tambah="sparepart">${
            T('Tambah sparepart','Add spare part')}</button>` : ''}
        </span>
      </div>
      <div class="panel"><div class="kepala"><h3>${T('Sparepart','Spare Parts')} ${esc(u.nama)}</h3>
        <span class="ket">${part.filter(p=>p.stok<p.min).length} ${
          T('di bawah minimum','below minimum')}</span></div>
        ${part.length ? `<div class="gulir" style="max-height:none">
          <table><thead><tr><th>${T('Sparepart','Spare Part')}</th><th>Part Number</th>
          <th>${T('Rak','Rack')}</th><th>${T('Stok / Min','Stock / Min')}</th>
          <th>${T('Dipakai Terakhir','Last Used')}</th><th></th></tr></thead><tbody>${
          [...part].sort((a,b)=>(a.stok/Math.max(a.min,1))-(b.stok/Math.max(b.min,1))).map(p=>{
            const w = p.stok===0?'var(--fail)':p.stok<p.min?'var(--warn)':'var(--ok)';
            return `<tr><td>${esc(p.nama)}</td><td><span class="mono">${esc(p.pn)}</span></td>
              <td><span class="rak-kode">${esc(p.rak)}</span></td>
              <td><span class="mono" style="color:${w};font-weight:600">${p.stok}</span>
                  <span class="mono" style="color:var(--muted)"> / ${p.min} ${esc(p.satuan)}</span>
                  <span class="stok-bar"><i style="width:${Math.min(100,p.stok/Math.max(p.min,1)*100)}%;background:${w}"></i></span></td>
              <td><span class="mono" style="color:var(--muted)">${tglRingkas(p.pakai)}</span></td>
              <td style="text-align:right">${bolehSuntingDb('sparepart')
                ? `<button class="btn garis kecil"
                     data-db-ubah="sparepart" data-pn="${esc(p.pn)}">${T('Ubah','Edit')}</button>`
                : ''}</td></tr>`;
          }).join('')}</tbody></table></div>`
          : `<div class="badan" style="color:var(--muted);font-size:12.5px">${
              T('Belum ada sparepart terdaftar untuk unit ini.','No spare parts registered for this unit yet.')}</div>`}
      </div>
    </div>

    <!-- DINAS — isinya digambar jdwGambar() setelah kerangka ini terpasang,
         karena subtab ini menggambar ulang dirinya sendiri saat disunting. -->
    <div class="subisi ${subtabAktif==='dinas'?'aktif':''}" id="s-dinas"></div>

    <!-- KEGIATAN BERKALA — sama alasannya dengan Jadwal Dinas di atas:
         subtab ini menggambar ulang dirinya sendiri saat disunting. -->
    <div class="subisi ${subtabAktif==='berkala'?'aktif':''}" id="s-berkala"></div>

    <!-- PERSONEL unit ini. Alasannya sama lagi: saringan dan tombol tambahnya
         menggambar ulang isinya sendiri. -->
    <div class="subisi ${subtabAktif==='personel'?'aktif':''}" id="s-personel"></div>

    <!-- LOGBOOK -->
    <div class="subisi ${subtabAktif==='logbook'?'aktif':''}" id="s-logbook">
      <div class="panel"><div class="kepala"><h3>${T('Cuplikan Logbook','Logbook Extract')} — ${esc(u.nama)}</h3>
        <span class="ket">${log.length
          ? log.length + T(' baris terakhir',' most recent rows')
          : T('belum ada catatan','no records yet')}</span></div>
        ${log.length ? '' : `<div class="badan" style="color:var(--muted);font-size:12.5px">
          ${T('Belum ada catatan logbook untuk unit ini di server.',
              'No logbook records for this unit on the server yet.')}</div>`}
        <table${log.length?'':' hidden'}><thead><tr><th>${T('Tanggal','Date')}</th><th>${T('Jam','Time')}</th>${
          radkom?`<th>${T('Selesai','Finished')}</th><th>${T('Frek','Freq')}</th>`:''}
          <th>${T('Dinas','Shift')}</th><th>${radkom
            ? T('Catatan / Tindakan','Notes / Action')
            : T('Uraian Pekerjaan / Kejadian','Work / Event Description')}</th>
          <!-- Dua nama dalam satu kolom, bukan dua kolom. Keduanya menjawab
               pertanyaan yang sama — siapa yang bertanggung jawab atas baris
               ini — dan memisahkannya jadi dua kolom akan menambah lebar tabel
               yang di Radkom sudah membawa dua kolom lebih banyak.

               Sebutannya juga tidak lagi bercabang. Dulu Radkom sendirian
               memakai "Manager Teknik" dan unit lain "Penanggung Jawab". -->
          <th>${T('Teknisi / Manager Teknik','Technician / Technical Manager')}</th></tr></thead>
        <tbody>${log.map(r=>`<tr>
          <td><span class="mono">${tglRingkas(r.tgl)}</span></td>
          <td><span class="mono">${esc(r.jam)}</span></td>
          ${radkom?`<td><span class="mono">${esc(r.selesai||'—')}</span></td>
                    <td><span class="mono">${esc(r.frek||'—')}</span></td>`:''}
          <td><span class="sel-shift s-${esc(r.dinas)}" style="padding:2px 8px;display:inline-block">${esc(r.dinas)}</span></td>
          <td>${esc(r.uraian)}</td><td>${namaPenanggungHtml(r)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="catatan"><b>${T('Bentuk barisnya mengikuti unit.','The row shape follows the unit.')}</b>
        ${radkom
          ? T('Radkom membawa jam selesai dan frekuensi; unit lain tidak punya kedua kolom itu.',
              'Radkom carries a finish time and a frequency; the other units have neither column.')
          : T('Unit ini tidak memakai kolom jam selesai dan frekuensi — itu khusus Radkom.',
              'This unit has no finish-time or frequency column — those belong to Radkom alone.')}
        ${T('Perbedaan ini sudah berlaku di E-Logbook yang sekarang; dashboard hanya mengikutinya.',
            'That difference already holds in E-Logbook today; the dashboard only follows it.')}</div>
    </div>

    <!-- GALERI -->
    <div class="subisi ${subtabAktif==='galeri'?'aktif':''}" id="s-galeri">
      <div class="panel"><div class="kepala"><h3>${T('Galeri','Gallery')} ${esc(u.nama)}</h3>
        <span class="ket">${foto.length} ${T('foto dokumentasi','documentation photos')}</span></div>
        ${foto.length ? `<div class="badan"><div class="foto-grid" id="fotoGrid">${foto.map((f,i)=>`
          <figure class="foto-kartu" data-foto="${i}">
            <div class="bing">
              <img src="/foto/${esc(unitDibuka)}/${esc(f.berkas)}" alt="${esc(f.ket)}" loading="lazy">
              <div class="hilang">${T('BERKAS BELUM ADA','FILE NOT UPLOADED')}<br>${esc(f.berkas)}${
                KEMAMPUAN.galeriTulis ? `<br><b>${T('TEKAN UNTUK MEMILIH','PRESS TO CHOOSE')}</b>` : ''}</div>
            </div>
            <figcaption class="isi">
              <div class="ket">${esc(f.ket)}</div>
              <div class="meta">${f.tgl ? tglRingkas(f.tgl) + ' · ' : ''}${esc(f.berkas)}</div>
              ${KEMAMPUAN.galeriTulis
                ? `<button class="buang" data-buang="${esc(f.berkas)}" title="${
                    T('Hapus foto ini','Delete this photo')}">${T('Hapus','Delete')}</button>` : ''}
            </figcaption>
          </figure>`).join('')}</div></div>`
          : `<div class="badan" style="color:var(--muted);font-size:12.5px">${
              T('Belum ada foto untuk unit ini.','No photos for this unit yet.')}</div>`}
      </div>

      ${KEMAMPUAN.galeriTulis ? `
      <div class="panel"><div class="kepala"><h3>${T('Tambah foto','Add photo')}</h3>
        <span class="ket">${T('tersimpan permanen di server ini','stored permanently on this server')}</span></div>
        <div class="badan">
          <div class="brk-atur">
            <div><label for="galKet">${T('Keterangan','Caption')}</label>
              <input type="text" id="galKet" placeholder="${
                T('mis. Kalibrasi pemancar setelah ganti modul','e.g. Transmitter calibration after module swap')}"></div>
            <div><label for="galTgl">${T('Tanggal','Date')}</label>
              <input type="date" id="galTgl"></div>
          </div>
          <label class="jatuh" id="galJatuh">
            <input type="file" id="galInput" accept="image/*" multiple>
            <div class="ajak">${T('Tarik foto ke sini, atau tekan untuk memilih',
              'Drag photos here, or press to choose')}</div>
            <div class="ket2">${T('Boleh beberapa sekaligus · .jpg .png .webp · paling besar 15 MB per berkas',
              'Several at once is fine · .jpg .png .webp · at most 15 MB per file')}<br>
              ${T('Dua kotak di atas berlaku untuk foto yang ditambahkan berikutnya.',
                  'The two boxes above apply to the photos added next.')}</div>
          </label>
          <div id="galKabar" class="gal-kabar"></div>
        </div>
      </div>` : `
      <!-- Kotak unggah tidak ditawarkan kalau penyimpanannya tidak permanen.
           Menawarkannya lalu gagal di tengah unggahan jauh lebih menjengkelkan
           daripada mengatakannya di depan. -->
      <div class="catatan"><b>${T('Unggah foto tidak tersedia di sini.','Photo upload is not available here.')}</b>
        ${T('Salinan ini berjalan tanpa penyimpanan tetap, jadi foto yang diunggah akan '
            + 'hilang dengan sendirinya. Galeri hanya bisa diisi dari server yang berjalan di kantor.',
            'This copy runs without permanent storage, so any photo uploaded would disappear on its own. '
            + 'The gallery can only be filled from the server running in the office.')}</div>`}

      <div class="catatan">
        <b>${T('Foto sungguhan, bukan ilustrasi.','Real photographs, not illustrations.')}</b>
        ${T('Berkasnya tersimpan di','The files live in')}
        <span class="mono">public/foto/${esc(unitDibuka)}/</span>
        ${T('dan keterangannya di','and their captions in')}
        <span class="mono">public/foto/daftar.json</span> —
        ${T('bukan di E-Logbook, karena modul galeri belum ada di sana. Ubin bertanda',
            'not in E-Logbook, because the gallery module does not exist there yet. A tile marked')}
        <b>${T('BERKAS BELUM ADA','FILE NOT UPLOADED')}</b>
        ${T('adalah slot yang sudah diberi keterangan tapi berkasnya belum masuk: tekan ubinnya untuk '
            + 'mengisi slot itu, dan keterangannya ikut terpakai.',
            'is a slot whose caption is already written but whose file has not arrived: press the tile '
            + 'to fill that slot, and the caption comes along with it.')}
      </div>
    </div>

    <!-- DOKUMEN -->
    <div class="subisi ${subtabAktif==='dokumen'?'aktif':''}" id="s-dokumen">
      <div class="panel">
        <div class="kepala"><h3>${T('Dokumen','Documents')} ${esc(u.nama)}</h3>
          <span class="ket">${T('SOP, manual, sertifikat kalibrasi, berita acara, foto',
            'SOPs, manuals, calibration certificates, handover records, photos')}</span></div>
        <div class="badan">
          <div class="brk-atur">
            <div><label for="brkAlat">${T('Kaitkan ke peralatan','Link to equipment')}</label>
              <select id="brkAlat">
                <option value="">— ${T('tidak dikaitkan','not linked')} —</option>
                ${alat.map(a=>`<option value="${esc(a.id)}"${a.id===alatDipilih?' selected':''}>${esc(a.nama)}</option>`).join('')}
              </select></div>
            <div><label for="brkKat">${T('Kategori','Category')}</label>
              <select id="brkKat">
                <option value="">${T('Tebak dari nama berkas','Guess from the file name')}</option>
                ${BRK_KATEGORI.map(k=>`<option value="${esc(k)}">${esc(brkKategoriNama(k))}</option>`).join('')}
              </select></div>
          </div>
          <label class="jatuh" id="brkJatuh">
            <input type="file" id="brkInput" multiple>
            <div class="ajak">${T('Tarik berkas ke sini, atau tekan untuk memilih',
              'Drag files here, or press to choose')}</div>
            <div class="ket2">${T('Boleh beberapa sekaligus · paling besar','Several at once is fine · at most')}
              ${brkUkuran(BRK_BATAS)} ${T('per berkas','per file')}<br>
              ${T('Dua kotak di atas berlaku untuk berkas yang ditambahkan berikutnya.',
                  'The two boxes above apply to the files added next.')}</div>
          </label>
        </div>
        <div id="daftarBerkas"></div>
      </div>
      <div class="catatan">${
        `<b>${T('Berkasnya tersimpan di server dashboard ini.','The files are stored on this dashboard server.')}</b>
            ${T('Menyegarkan halaman tidak menghilangkannya lagi. Tempatnya data/dokumen/ di server ini — '
              + 'bukan di E-Logbook, dan bukan di dalam public/, jadi tidak ada yang bisa mengunduhnya '
              + 'tanpa masuk lebih dulu. Yang boleh menambah ditentukan panel Hak Akses per unit; yang '
              + 'boleh mengeluarkan hanya administrator, dan berkasnya ikut terhapus dari server.',
                'Refreshing the page no longer empties it. They live in data/dokumen/ on this server — not '
              + 'in E-Logbook, and not inside public/, so nobody can download them without signing in '
              + 'first. Who may add is set per unit in the Access Rights panel; only an administrator may '
              + 'remove, and the file is deleted from the server with it.')}`}
      </div>
    </div>`;

  el('subtab').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    subtabAktif = b.dataset.sub;
    el('subtab').querySelectorAll('button').forEach(x=>x.classList.toggle('aktif', x === b));
    document.querySelectorAll('#isiUnit .subisi').forEach(s=>
      s.classList.toggle('aktif', s.id === 's-'+subtabAktif));
    // Tab yang panjang isinya — Peralatan, Dokumen — bisa membuat halaman
    // tergulung jauh ke bawah. Berpindah ke tab yang pendek dari posisi itu
    // meninggalkan orangnya menatap ruang kosong di bawah isi yang sudah habis,
    // dan tampak seperti tabnya tidak berganti. Barisnya ditarik kembali ke
    // muka layar tiap kali berpindah, tapi hanya kalau ia memang sudah lewat.
    const rel = el('subtab').getBoundingClientRect();
    if(rel.top < 0 || rel.bottom > innerHeight){
      el('subtab').scrollIntoView({ block:'start', behavior:'smooth' });
    }
    // Tab yang separuh keluar bingkai saat barisnya digulir mendatar ikut
    // ditarik masuk, jadi yang sedang menyala selalu terlihat utuh.
    b.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'smooth' });
  });
  el('isiUnit').querySelectorAll('.alat-kartu').forEach(k=>{
    k.addEventListener('click', ()=>{
      alatDipilih = k.dataset.alat;
      el('isiUnit').querySelectorAll('.alat-kartu').forEach(x=>
        x.classList.toggle('terpilih', x === k));
      // Peralatan yang dipilih di sini ikut jadi kaitan berkas berikutnya,
      // supaya menambah foto alat tidak perlu memilih alatnya dua kali.
      if(el('brkAlat')) el('brkAlat').value = alatDipilih;
      gambarRinciAlat();
    });
  });
  gambarRinciAlat();
  gambarGaleri(foto);
  brkPasang();
  // Subtab Jadwal Dinas mengisi dirinya sendiri: ia digambar ulang tiap kali
  // masuk atau keluar mode sunting, jadi tidak ikut di dalam template besar
  // di atas. Mode sunting unit sebelumnya sengaja tidak dibawa ke unit baru.
  JDW.sunting = false; JDW.draf = null;
  jdwGambar();
  // Kegiatan Berkala sama persis alasannya.
  if(BKL.unit !== unitDibuka){ BKL.sunting = false; BKL.draf = null; }
  bklGambar();
  // Personel juga: saringan dan tombol tambahnya menggambar ulang isinya.
  gambarPersonel();
  pasangIkonUnit();
  // Layar ini digambar ulang tiap pindah unit, jadi tombol E-Logbook di
  // dalamnya selalu lahir kembali dengan href="#" — alamatnya harus dipasang
  // ulang di sini, bukan sekali saja saat halaman dimuat.
  if(TAUTAN_ELOGBOOK) pasangTautanElogbook(TAUTAN_ELOGBOOK);
}

/**
 * Galeri: menandai foto yang berkasnya belum ada, dan membuka yang ada.
 *
 * Dipasang di sini, bukan sebagai atribut onerror di markup, supaya nama
 * berkasnya tidak perlu lolos dua lapis kutip. Ubin yang gagal dimuat tidak
 * disembunyikan — justru ditandai: daftar foto boleh ditulis sebelum berkasnya
 * masuk, dan yang belum masuk harus kelihatan supaya tidak terlupakan.
 */
function gambarGaleri(foto){
  const grid = el('fotoGrid');
  const unit = unitDibuka;

  if(grid) grid.querySelectorAll('.foto-kartu').forEach(kartu=>{
    const img = kartu.querySelector('img');
    const f = foto[Number(kartu.dataset.foto)];
    const tandai = ()=>kartu.classList.add('kosong');
    // Gambar yang gagal sebelum baris ini jalan tidak pernah memicu onerror
    // lagi — complete && naturalWidth 0 menangkap keadaan itu.
    if(img.complete && !img.naturalWidth) tandai();
    img.addEventListener('error', tandai);

    kartu.addEventListener('click', e=>{
      if(e.target.closest('.buang')) return;      // ditangani pendengar di bawah
      if(kartu.classList.contains('sibuk')) return;
      // Ubin yang berkasnya belum ada berperan sebagai tombol: ia mengisi
      // slot itu, jadi nama berkas dan keterangannya sudah ditentukan dan
      // yang diminta dari pemakai cuma gambarnya.
      // Slot kosong berperan sebagai tombol unggah — tapi hanya kalau memang
      // ada tempat menyimpannya. Kalau tidak, ubin itu sekadar keterangan
      // bahwa berkasnya tidak ikut.
      if(kartu.classList.contains('kosong')){
        return KEMAMPUAN.galeriTulis ? isiSlotFoto(unit, f, kartu) : undefined;
      }
      bukaFotoBesar(img.src, f);
    });

    // Tombolnya tidak digambar sama sekali kalau galeri tidak bisa ditulis.
    kartu.querySelector('.buang')?.addEventListener('click', async ()=>{
      if(!confirm(T(`Hapus foto "${f.ket || f.berkas}"?\n\nBerkasnya ikut terhapus dari server.`,
        `Delete the photo "${f.ket || f.berkas}"?\n\nThe file is removed from the server as well.`))) return;
      kartu.classList.add('sibuk');
      try{
        const r = await fetch(`/galeri/${encodeURIComponent(unit)}/${encodeURIComponent(f.berkas)}`,
          { method:'DELETE' });
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
        await muatGaleri(); gambarUnit();
      }catch(e){
        kartu.classList.remove('sibuk');
        pesan(T('Gagal menghapus: ','Delete failed: ') + (e && e.message || e));
      }
    });
  });

  pasangUnggahFoto(unit);
}

/** Pilih satu berkas untuk mengisi slot yang keterangannya sudah ditulis. */
function isiSlotFoto(unit, f, kartu){
  const pilih = document.createElement('input');
  pilih.type = 'file';
  pilih.accept = 'image/*';
  pilih.addEventListener('change', async ()=>{
    const berkas = pilih.files[0]; if(!berkas) return;
    kartu.classList.add('sibuk');
    try{
      // Nama slot yang dipakai, bukan nama berkas asal: seluruh gunanya slot
      // adalah supaya foto ini punya nama dan keterangan yang sudah disepakati.
      await kirimFoto(unit, berkas, f.berkas, f.ket, f.tgl);
      await muatGaleri(); gambarUnit();
    }catch(e){
      kartu.classList.remove('sibuk');
      pesan(T('Gagal mengunggah: ','Upload failed: ') + (e && e.message || e));
    }
  });
  pilih.click();
}

const FOTO_EXT_SAH = /\.(jpe?g|png|webp)$/i;
const FOTO_BATAS_KLIEN = 15 * 1024 * 1024;

/**
 * Batas badan permintaan di Vercel: 4.500.000 byte. Angka itu diukur langsung
 * ke produksi, bukan dikutip dari dokumentasi — 4.403.170 byte lolos, 4.505.570
 * byte dijawab 413 sebelum fungsinya sempat berjalan.
 *
 * Yang dikirim adalah base64 (⁴⁄₃ dari berkas) di dalam bungkus JSON, jadi
 * berkas asli yang benar-benar muat cuma ±3,2 MB — jauh di bawah 15 MB yang
 * dijanjikan layar. Foto kamera ponsel hampir selalu di atas itu.
 *
 * Di kantor batas ini tidak ada sama sekali: Express menerima 60 MB. Jadi
 * pengecilan di bawah dikerjakan menurut ukuran, bukan menurut "sedang di
 * Vercel atau tidak" — foto kecil tetap dikirim apa adanya di kedua tempat,
 * dan yang besar diperkecil di kedua tempat juga. Satu perilaku, bukan dua.
 */
const FOTO_SASARAN_BADAN = 3600000;   // panjang base64, disisakan ruang untuk bungkus JSON
const FOTO_SISI_MAKS     = 2048;      // masih cukup untuk membaca tulisan di layar alat

/** Bitmap dari sebuah berkas gambar. createImageBitmap kalau ada — ia bekerja
    di luar utas utama sehingga layar tidak membeku; Image sebagai cadangan. */
async function gambarDari(berkas){
  if(window.createImageBitmap) return await createImageBitmap(berkas);
  return await new Promise((selesai, gagal)=>{
    const url = URL.createObjectURL(berkas);
    const g = new Image();
    g.onload  = ()=>{ URL.revokeObjectURL(url); selesai(g); };
    g.onerror = ()=>{ URL.revokeObjectURL(url); gagal(new Error('gambar tidak terbaca')); };
    g.src = url;
  });
}

/**
 * Perkecil foto sampai muat, atau null kalau memang sudah muat sejak awal.
 *
 * Hasilnya selalu JPEG — pemanggilnya wajib ikut mengganti akhiran nama jadi
 * .jpg, kalau tidak berkas PNG akan tersimpan dengan isi JPEG dan peramban
 * yang membukanya nanti bingung sendiri.
 *
 * Mutu diturunkan bertahap, bukan langsung ke yang paling rendah: foto alat
 * sering dipakai untuk membaca angka di layar atau nomor seri, dan 0,85 masih
 * menyimpan itu sementara 0,55 sudah mulai mengaburkannya.
 */
async function kecilkanFoto(berkas){
  if(berkas.size * 4 / 3 <= FOTO_SASARAN_BADAN) return null;

  const gambar = await gambarDari(berkas);
  const skala  = Math.min(1, FOTO_SISI_MAKS / Math.max(gambar.width, gambar.height));
  const lebar  = Math.max(1, Math.round(gambar.width  * skala));
  const tinggi = Math.max(1, Math.round(gambar.height * skala));

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar; kanvas.height = tinggi;
  kanvas.getContext('2d').drawImage(gambar, 0, 0, lebar, tinggi);
  if(gambar.close) gambar.close();

  let terkecil = null;
  for(const mutu of [0.85, 0.75, 0.65, 0.55]){
    const blob = await new Promise(s=>kanvas.toBlob(s, 'image/jpeg', mutu));
    if(!blob) break;
    terkecil = blob;
    if(blob.size * 4 / 3 <= FOTO_SASARAN_BADAN) return blob;
  }
  // Sudah mentok dan masih kebesaran. Yang terkecil tetap dikembalikan supaya
  // pemeriksaan di kirimFoto yang menolaknya — dengan pesan yang menyebut
  // angka, bukan 413 telanjang dari Vercel.
  return terkecil;
}

/**
 * Isi satu berkas sebagai base64 tanpa kepala 'data:...;base64,' di depannya.
 *
 * Base64 lewat FileReader, bukan multipart: bentuknya sama dengan lampiran di
 * E-Logbook, jadi seluruh aplikasi ini cuma punya satu bentuk badan permintaan.
 */
const berkasBase64 = (berkas) => new Promise((selesai, gagal)=>{
  const baca = new FileReader();
  baca.onload = ()=>selesai(String(baca.result).split(',')[1] || '');
  baca.onerror = ()=>gagal(new Error('berkas tidak terbaca'));
  baca.readAsDataURL(berkas);
});

/** Kirim satu foto ke galeri unit. */
async function kirimFoto(unit, berkas, nama, ket, tgl){
  if(berkas.size > FOTO_BATAS_KLIEN) throw new Error('lebih dari 15 MB');
  if(!FOTO_EXT_SAH.test(nama)) throw new Error('hanya .jpg, .png, atau .webp');

  const kecil = await kecilkanFoto(berkas);
  if(kecil){ berkas = kecil; nama = nama.replace(FOTO_EXT_SAH, '.jpg'); }

  const isi = await berkasBase64(berkas);
  if(isi.length > FOTO_SASARAN_BADAN){
    throw new Error(T('masih terlalu besar setelah dikecilkan — coba potong fotonya dulu',
                      'still too large after shrinking — try cropping it first'));
  }

  const r = await fetch('/galeri/' + encodeURIComponent(unit), {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ berkas:nama, ket:ket || '', tgl:tgl || '', isi })
  });
  const j = await r.json().catch(()=>({}));
  // 413 dari Vercel berbadan teks biasa, bukan JSON, jadi j.error kosong dan
  // pesannya akan jatuh jadi "server menjawab 413" — angka telanjang yang tidak
  // memberi tahu pemakai apa pun. Disebut sendiri supaya ada artinya.
  if(r.status === 413 && !j.error){
    throw new Error(T('ditolak server karena terlalu besar', 'rejected by the server — too large'));
  }
  if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
  return j;
}

/**
 * Nama berkas yang aman dipakai sebagai nama berkas di disk sekaligus bagian
 * URL: huruf kecil, tanpa spasi, tanpa aksen. Diawali kode unit dan tanggal
 * supaya folder foto tetap terbaca walau dibuka lewat Explorer.
 */
function namaFotoBaru(unit, asal, tgl){
  const ext = (asal.match(FOTO_EXT_SAH) || ['.jpg'])[0].toLowerCase().replace('.jpeg','.jpg');
  // NFD memisahkan aksen jadi tanda gabung tersendiri, \p{M} membuangnya —
  // "Kalibrasi Ané" jadi "kalibrasi-ane", bukan "kalibrasi-an-".
  const pokok = asal.replace(FOTO_EXT_SAH,'')
    .normalize('NFD').replace(/\p{M}/gu,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'foto';
  const cap = (tgl || new Date().toISOString().slice(0,10)).replace(/-/g,'');
  return `${unit}-${cap}-${pokok}${ext}`;
}

function pasangUnggahFoto(unit){
  const jatuh = el('galJatuh'); if(!jatuh) return;
  const masuk = el('galInput');
  const kabar = el('galKabar');

  const terima = async (daftar)=>{
    const berkas = [...daftar].filter(b=>FOTO_EXT_SAH.test(b.name));
    const ditolak = daftar.length - berkas.length;
    if(!berkas.length){
      kabar.innerHTML = `<span class="gagal">${T('Tidak ada foto yang bisa dipakai — hanya .jpg, .png, dan .webp.',
        'No usable photos — only .jpg, .png, and .webp.')}</span>`;
      return;
    }
    const ket = el('galKet').value.trim();
    const tgl = el('galTgl').value;
    let sudah = 0;
    const gagal = [];
    for(const b of berkas){
      kabar.innerHTML = T(`Mengunggah <b>${esc(b.name)}</b> — ${sudah + 1} dari ${berkas.length}...`,
                          `Uploading <b>${esc(b.name)}</b> — ${sudah + 1} of ${berkas.length}...`);
      try{
        await kirimFoto(unit, b, namaFotoBaru(unit, b.name, tgl), ket, tgl);
        sudah++;
      }catch(e){
        gagal.push(`${b.name}: ${e && e.message || e}`);
      }
    }
    await muatGaleri();
    // Keterangan sengaja dikosongkan setelah berhasil: dipakai ulang tanpa
    // sadar, seluruh galeri bisa berakhir dengan satu kalimat yang sama.
    if(sudah) el('galKet').value = '';
    gambarUnit();
    const k = el('galKabar');
    k.innerHTML = `<b>${sudah} ${T('foto tersimpan.','photos saved.')}</b>`
      + (ditolak ? T(` ${ditolak} berkas dilewati karena bukan gambar.`,
                     ` ${ditolak} files skipped — not images.`) : '')
      + (gagal.length ? `<br><span class="gagal">${T('Gagal','Failed')}: ${esc(gagal.join('; '))}</span>` : '');
  };

  masuk.addEventListener('change', ()=>{ terima(masuk.files); masuk.value = ''; });

  ['dragenter','dragover'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.add('siap');
  }));
  ['dragleave','drop'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.remove('siap');
  }));
  jatuh.addEventListener('drop', e=>{
    if(e.dataTransfer && e.dataTransfer.files.length) terima(e.dataTransfer.files);
  });
}

function bukaFotoBesar(sumber, f){
  const kotak = el('fotoBesar');
  kotak.querySelector('img').src = sumber;
  kotak.querySelector('.kap').innerHTML =
    `${esc(f.ket)}<span>${f.tgl ? tglRingkas(f.tgl) + ' · ' : ''}${esc(f.berkas)}</span>`;
  kotak.classList.add('buka');
}

const tutupFotoBesar = ()=>el('fotoBesar').classList.remove('buka');

// Dipasang sekali di sini, bukan di gambarGaleri(): gambarUnit() mengganti
// innerHTML tiap kali unit berpindah, dan pemasangan berulang akan menumpuk
// pendengar yang sama pada elemen yang tidak pernah ikut diganti.
el('fotoBesar').addEventListener('click', tutupFotoBesar);
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') tutupFotoBesar(); });

function gambarRinciAlat(){
  const kotak = el('rinciAlat'); if(!kotak) return;
  const alat = (PERALATAN[unitDibuka] || []).find(a=>a.id === alatDipilih);
  if(!alat){ kotak.innerHTML = ''; return; }
  kotak.innerHTML = `<div class="grid2">
    ${sjrPanel(unitDibuka, alat)}
    <div class="panel"><div class="kepala"><h3>${T('Identitas','Identity')}</h3>
      <span style="display:flex;gap:7px;align-items:center">
        ${bolehSuntingDb('peralatan') ? `<button class="btn garis kecil"
          data-db-ubah="peralatan" data-alat="${esc(alat.id)}">${T('Ubah','Edit')}</button>` : ''}
      </span></div>
      <div class="badan"><div class="spek">
        ${[
            // Yang kosong tidak ikut: baris "S/N: —" tidak memberi tahu apa pun.
            [T('Merk','Make'), alat.merk],
            [T('Tipe','Type'), alat.tipe],
            ['S/N', alat.sn],
            ['P/N', alat.pn],
            [T('Tahun pembuatan','Year of manufacture'), alat.tahun],
            [T('Lokasi','Location'), alat.lokasi],
            ['Status', alat.status],
            [T('Dicatat','Recorded'), alat.dibuat ? new Date(alat.dibuat).toLocaleDateString(LOKAL()) : '']
          ].filter(([,v])=>v && v !== '—')
          .map(([k,v])=>`<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}
      </div>
      ${(alat.foto || []).length ? `<div class="foto-lampir" style="margin-top:12px">${
        alat.foto.map(f=>`<span class="foto-cip"><img src="foto/${esc(unitDibuka)}/${esc(f)}" alt="">${
          esc(f)}</span>`).join('')}</div>` : ''}
      </div></div>
  </div>`;
  sjrPasang(unitDibuka, alat);
}

