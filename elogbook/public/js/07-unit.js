/* E-Logbook · js/07-unit.js — Bentuk formulir dan isi layar mengikuti unit yang dibuka
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== UNIT LOGBOOK ==============
   Radtel dan Radkom bukan cuma beda nama: bentuk barisnya berbeda. Radkom
   mencatat jam mulai dan selesai serta frekuensi, dinasnya PS/M, dan yang
   menandatangani Manager Teknik. Semua perbedaan itu datang dari server
   lewat daftar unitSaya, jadi menambah unit ketiga kelak cukup di db.js. */

/* Unit terakhir diingat PER AKUN, bukan per perangkat.
   Satu komputer dipakai bergantian banyak teknisi; kalau ingatannya satu untuk
   seluruh perangkat, orang berikutnya yang masuk ikut terbawa ke unit orang
   sebelumnya — dan kalau kebetulan akunnya juga berhak atas unit itu, server
   tidak punya alasan menolaknya. Itu yang membuat semua orang seolah selalu
   mendarat di Radtel. */
const kunciUnit = () => 'elogbook_unit:' + ((userSaatIni && userSaatIni.username) || '');

/** Unit yang terakhir dibuka akun ini di perangkat ini. Kosong berarti biar
    server yang memilihkan — unit pertama yang boleh dibuka akun itu. */
function unitTersimpan(){
  try{ return localStorage.getItem(kunciUnit()) || ''; }catch(e){ return ''; }
}

function simpanUnit(kode){
  try{
    localStorage.setItem(kunciUnit(), kode);
    // Ingatan lama yang berlaku untuk seluruh perangkat sudah tidak dipakai.
    localStorage.removeItem('elogbook_unit');
  }catch(e){ /* penyimpanan penuh atau ditolak: tidak apa-apa, sekadar ingatan */ }
}

function pindahUnit(kode){
  if(!kode || kode === unitAktif) return;
  unitAktif = kode;
  simpanUnit(kode);
  tutupPratinjau();
  init();
}

function renderPemilihUnit(){
  const chip = document.getElementById('unitChip');
  const sel = document.getElementById('unitPilih');
  // Kalau hanya berhak satu unit, pemilihnya tidak ada gunanya — sembunyikan.
  if(unitSaya.length <= 1){ chip.style.display = 'none'; return; }
  chip.style.display = '';
  sel.innerHTML = unitSaya.map(u=>`<option value="${u.kode}" ${u.kode===unitAktif?'selected':''}>${escapeHtml(u.nama)}</option>`).join('');
}

/** Sesuaikan seluruh layar dengan bentuk unit yang sedang dibuka. */
function terapkanUnit(){
  const u = infoUnit();
  if(!u) return;

  // Kepala halaman. Judulnya milik unit, bukan kamus bahasa: Radtel dan Radkom
  // berada di bawah Komunikasi Penerbangan, sedangkan Radar dan Navigasi punya
  // nama resminya sendiri.
  const judulUtama = document.querySelector('.brand-title');
  if(judulUtama && u.brand) judulUtama.textContent = u.brand;
  const sub = document.querySelector('.brand-sub');
  if(sub) sub.textContent = u.peralatan.toUpperCase();
  document.getElementById('metaKelompokIsi').textContent = u.kelompok;
  document.getElementById('metaPeralatanIsi').textContent = u.peralatan;

  // Tab Daily Check hanya untuk unit yang memang punya formulirnya
  const tabDc = document.querySelector('.tab-btn[data-tab="dailycheck"]');
  if(tabDc){
    tabDc.style.display = u.adaDailyCheck ? '' : 'none';
    if(!u.adaDailyCheck && tabDc.classList.contains('active')) pilihTab('logbook');
    tabDc.textContent = u.kode === 'radkom' ? T('tabDcRadkom') : T('tabDailyCheck');
  }

  // Monitoring Frekuensi hanya dipakai unit yang memang punya formnya.
  const tabMon = document.querySelector('.tab-btn[data-tab="monitoring"]');
  if(tabMon){
    tabMon.style.display = u.adaMonitoring ? '' : 'none';
    if(!u.adaMonitoring && tabMon.classList.contains('active')) pilihTab('logbook');
  }
  // Tab wadah Preventive Maintenance dan sub-tabnya. Wadahnya muncul selama
  // unit ini punya minimal salah satu isi (DS Test atau salah satu lembar
  // berkala). Di dalamnya, sub-tab DS Test hanya untuk unit yang memakainya;
  // sub-tab pekerjaan berkala diperlakukan satu paket seperti sebelumnya
  // — tidak ada unit yang punya sebagiannya saja.
  const tabPm = document.querySelector('.tab-btn[data-tab="preventive"]');
  const adaPm = !!(u.adaDsTest || u.adaBerkala);
  if(tabPm){
    tabPm.style.display = adaPm ? '' : 'none';
    if(!adaPm && tabPm.classList.contains('active')) pilihTab('logbook');
  }
  const subDs = document.querySelector('.subtab-btn[data-subtab="dstest"]');
  if(subDs) subDs.style.display = u.adaDsTest ? '' : 'none';
  ['bk-neptuno','bk-gatevox','bk-cleaning','bk-restart'].forEach(nama=>{
    const s = document.querySelector(`.subtab-btn[data-subtab="${nama}"]`);
    if(s) s.style.display = u.adaBerkala ? '' : 'none';
  });
  // Kalau sub-tab yang lagi aktif ternyata tidak dipakai unit ini, pindah
  // ke sub-tab pertama yang masih terlihat — kalau tidak, wadahnya terbuka
  // di ruang kosong dan seolah tidak ada isinya.
  const wadahPm = document.getElementById('view-preventive');
  if(wadahPm){
    const aktifSub = wadahPm.querySelector('.subtab-btn.active');
    const aktifTerlihat = aktifSub && aktifSub.style.display !== 'none';
    if(!aktifTerlihat){
      const gantinya = wadahPm.querySelector('.subtab-btn:not([style*="display: none"])');
      if(gantinya) gantinya.click();
    }
  }
  // Tab wadah FORM (LTK + BAPB). LTK ada untuk sebagian unit; BAPB
  // dianggap ada untuk semua unit (berita acara pemasangan barang
  // berlaku umum). Wadahnya muncul selama minimal salah satunya
  // dipakai — praktisnya selalu terlihat karena BAPB selalu ada.
  const tabForm = document.querySelector('.tab-btn[data-tab="form"]');
  const adaBapb = true;
  const adaForm = !!(u.adaLtk || adaBapb);
  if(tabForm){
    tabForm.style.display = adaForm ? '' : 'none';
    if(!adaForm && tabForm.classList.contains('active')) pilihTab('logbook');
  }
  const subLtk = document.querySelector('.subtab-btn[data-subtab="ltk"]');
  if(subLtk) subLtk.style.display = u.adaLtk ? '' : 'none';
  const wadahForm = document.getElementById('view-form');
  if(wadahForm){
    const aktifSub = wadahForm.querySelector('.subtab-btn.active');
    const aktifTerlihat = aktifSub && aktifSub.style.display !== 'none';
    if(!aktifTerlihat){
      const gantinya = wadahForm.querySelector('.subtab-btn:not([style*="display: none"])');
      if(gantinya) gantinya.click();
    }
  }

  // Empat formulir daily check dengan bentuk berbeda: Garex (Radtel/unit lain),
  // Frequentis 3020X (Radtel di JATSC), Radkom, dan Navigasi (unit ppabn).
  // Radtel dapat pemilih lokasi di form-nya sendiri — dan selector itu yang
  // menentukan mana yang tampak.
  const radkom = u.kode === 'radkom';
  const nav = u.kode === 'ppabn';            // Fasilitas Navigasi (ILS + DVOR/DME)
  const punyaLokasi = u.kode === 'radtel';   // JATSC vs New JATSC
  document.getElementById('dcRadkomWrap').style.display  = radkom ? '' : 'none';
  document.getElementById('dcLegendRadkom').style.display= radkom ? '' : 'none';
  // Suhu MER hanya untuk Radtel Garex/Frequentis di gedung MER — Radkom dan
  // Navigasi tidak mengukurnya (Navigasi tersebar di site ILS/DVOR luar MER).
  document.getElementById('dcSuhuWrap').style.display    = (radkom || nav) ? 'none' : '';
  // dcAlatWrap sekarang cuma menampung dua <select> tersembunyi (dcLokasi &
  // dcTempat) — sumber kebenaran yang ditulis lewat setDcLokasi(). Selalu
  // sembunyi, apa pun unitnya.
  const dcAlatWrap = document.getElementById('dcAlatWrap');
  if(dcAlatWrap) dcAlatWrap.style.display = 'none';
  // Sub-tab pemilih lokasi (Frequentis vs Garex) — hanya Radtel yang butuh.
  const dcSubtabs = document.getElementById('dcSubtabs');
  if(dcSubtabs) dcSubtabs.style.display = punyaLokasi ? '' : 'none';
  const dcLegendGarex = document.getElementById('dcLegendGarex');
  const dcJatscWrap = document.getElementById('dcJatscWrap');
  const dcGarexWrap = document.getElementById('dcGarexWrap');
  const dcNavWrap = document.getElementById('dcNavWrap');
  const jatsc = punyaLokasi && document.getElementById('dcLokasi')?.value === 'jatsc';
  dcGarexWrap.style.display = (radkom || jatsc || nav) ? 'none' : '';
  if(dcJatscWrap) dcJatscWrap.style.display = (!radkom && !nav && jatsc) ? '' : 'none';
  if(dcNavWrap) dcNavWrap.style.display = nav ? '' : 'none';
  // Legenda Normal/Alarm/Gangguan dipakai Garex, JATSC, dan Navigasi — hanya
  // Radkom yang legendanya sendiri (OK / NOT OK). Sembunyikan saat radkom.
  if(dcLegendGarex) dcLegendGarex.style.display = radkom ? 'none' : '';
  // Judul tab tetap "Daily Check" apa pun peralatannya — nama alat sudah
  // disebut di selector di dalam form, tidak perlu diulang di kepala.
  const dcJudul = document.querySelector('[data-t="dcJudul"]');
  const dcSub = document.querySelector('[data-t="dcSub"]');
  if(dcJudul) dcJudul.textContent = T('dcJudul');
  if(dcSub) dcSub.textContent = radkom ? T('dcRadkomSub') : T('dcSub');
  if(radkom && Object.keys(dcRkState).length === 0){ initDcRkState(); renderDcRkTable(); }
  if(!radkom && !nav && jatsc && Object.keys(dcJState || {}).length === 0){ initDcJState(); renderDcJatscTable(); }
  if(nav && Object.keys(dcNState || {}).length === 0){ initDcNState(); renderDcNavTable(); }
  if(punyaLokasi && typeof sinkronSubtabDc === 'function') sinkronSubtabDc();

  // Judul seksi logbook mengikuti nama form unit itu
  const judul = document.querySelector('[data-t="logbookJudul"]');
  if(judul) judul.textContent = u.judul;

  // Kolom yang bentuknya ditentukan unit. Jam mulai–selesai dulu cuma milik
  // Radkom; sekarang seluruh unit memakainya — pekerjaan punya awal dan akhir
  // di mana pun ia dikerjakan. Frekuensi tetap milik Radkom saja.
  document.getElementById('feJamSelesaiWrap').style.display = u.pakaiJamSelesai ? '' : 'none';
  document.getElementById('feFrekWrap').style.display = u.pakaiFrek ? '' : 'none';
  document.getElementById('feJamLabel').textContent = u.pakaiJamSelesai ? T('jamMulaiUtc') : T('jamUtc');
  document.getElementById('feUraianLabel').textContent = u.labelUraian;
  document.getElementById('fePjLabel').textContent = u.labelPj + ' (' + T('namaKecil') + ')';
  const pj = document.getElementById('fePjNama');
  pj.placeholder = (bahasa === 'en' ? 'Name of ' : 'Nama ') + u.labelPj.toLowerCase();
  pj.removeAttribute('data-t-ph');   // placeholder-nya kini ditentukan unit, bukan kamus

  // Pilihan dinas berbeda per unit — isi ulang, jangan tumpuk
  const isiDinas = (el, tambahSemua)=>{
    if(!el) return;
    const lama = el.value;
    el.innerHTML = (tambahSemua ? `<option value="">${T('semua')}</option>` : '') +
                   u.dinas.map(d=>`<option>${d}</option>`).join('');
    if([...el.options].some(o=>o.value===lama)) el.value = lama;
  };
  isiDinas(document.getElementById('feDinas'), false);
  isiDinas(document.getElementById('prDinas'), true);
  isiDinas(document.getElementById('dcDinas'), false);

  // Info peralatan + lokasi di bawah sub-tab Daily Check. Disegarkan setiap
  // kali terapkanUnit() jalan supaya pindah unit (Radtel ↔ Radkom/lainnya)
  // ikut menyembunyikan/menampilkan info bar sesuai visibilitas #dcSubtabs.
  if(typeof sinkronSubtabDc === 'function') sinkronSubtabDc();
}

/** Dipakai terapkanUnit saat tab aktif harus dipindah paksa. */
function pilihTab(nama){
  const btn = document.querySelector(`.tab-btn[data-tab="${nama}"]`);
  if(btn) btn.click();
}

const mapEntry = e => ({ id:e.ID, tanggal:e.Tanggal, jam:e.Jam, dinas:e.Dinas||'', uraian:e.Uraian, teknisiNama:e.TeknisiNama, teknisiTtd:e.TeknisiTTD, pjNama:e.PJNama, pjTtd:e.PJTTD, teknisiNamaList:e.TeknisiNamaListJSON||[],
                         jamSelesai:e.JamSelesai||'', frek:e.Frek||'', unit:e.Unit||'radtel', lokasi:e.Lokasi||'',
                         diinputOleh:e.DiinputOleh||'', dibuatPada:e.DibuatPada||'', dibuatOlehUsername:e.DibuatOlehUsername||'',
                         ttdOleh:e.TtdOleh||'', ttdPada:e.TtdPada||'', ttdUntuk:e.TtdUntuk||'', lampiran:e.Lampiran||[] });
const mapDc = r => ({ id:r.ID, tanggal:r.Tanggal, tanggalIso:r.TanggalIso||'', dinas:r.Dinas, suhu:r.Suhu, remark:r.Remark, teknisiNama:r.TeknisiNama, teknisiTtd:r.TeknisiTTD, managerNama:r.ManagerNama, managerTtd:r.ManagerTTD, fails:r.FailsJSON||[], warns:r.WarnsJSON||[], teknisiNamaList:r.TeknisiNamaListJSON||[],
                     diinputOleh:r.DiinputOleh||'', dibuatPada:r.DibuatPada||'', dibuatOlehUsername:r.DibuatOlehUsername||'',
                     ttdOleh:r.TtdOleh||'', ttdPada:r.TtdPada||'', ttdUntuk:r.TtdUntuk||'' });
const mapIssue = i => ({ id:i.ID, jenis:i.Jenis, keterangan:i.Keterangan, lokasi:i.Lokasi, status:i.Status,
                         tglReport:i.TanggalReport||'', tglClosed:i.TanggalClosed||'',
                         dilaporkanOleh:i.DilaporkanOleh||'', diinputOleh:i.DiinputOleh||'',
                         ditutupOleh:i.DitutupOleh||'', keteranganClosed:i.KeteranganClosed||'',
                         dibuatPada:i.DibuatPada||'',
                         lampiranOpen:i.LampiranOpen||[], lampiranClosed:i.LampiranClosed||[] });
const ISSUE_HEADER = { jenis:'Jenis', keterangan:'Keterangan', lokasi:'Lokasi', status:'Status',
                       tglReport:'TanggalReport', tglClosed:'TanggalClosed',
                       dilaporkanOleh:'DilaporkanOleh', keteranganClosed:'KeteranganClosed' };
