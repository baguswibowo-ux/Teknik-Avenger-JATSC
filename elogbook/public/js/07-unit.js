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
  if(sub) sub.textContent = u.peralatan.toUpperCase() + ' — MER NEW JATSC';
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
  const tabDs = document.querySelector('.tab-btn[data-tab="dstest"]');
  if(tabDs){
    tabDs.style.display = u.adaDsTest ? '' : 'none';
    if(!u.adaDsTest && tabDs.classList.contains('active')) pilihTab('logbook');
  }
  // Keempat tab pekerjaan berkala baru dipakai Radtel; unit lain belum punya
  // daftarnya. Diperlakukan satu paket: tidak ada unit yang punya sebagian.
  ['bk-neptuno','bk-gatevox','bk-cleaning','bk-restart'].forEach(nama=>{
    const t = document.querySelector(`.tab-btn[data-tab="${nama}"]`);
    if(!t) return;
    t.style.display = u.adaBerkala ? '' : 'none';
    if(!u.adaBerkala && t.classList.contains('active')) pilihTab('logbook');
  });
  const tabLtk = document.querySelector('.tab-btn[data-tab="ltk"]');
  if(tabLtk){
    tabLtk.style.display = u.adaLtk ? '' : 'none';
    if(!u.adaLtk && tabLtk.classList.contains('active')) pilihTab('logbook');
  }

  // Dua formulir daily check yang berbeda bentuk — tampilkan yang sesuai unit.
  const radkom = u.kode === 'radkom';
  document.getElementById('dcGarexWrap').style.display   = radkom ? 'none' : '';
  document.getElementById('dcRadkomWrap').style.display  = radkom ? '' : 'none';
  document.getElementById('dcLegendGarex').style.display = radkom ? 'none' : '';
  document.getElementById('dcLegendRadkom').style.display= radkom ? '' : 'none';
  document.getElementById('dcSuhuWrap').style.display    = radkom ? 'none' : '';
  const dcJudul = document.querySelector('[data-t="dcJudul"]');
  const dcSub = document.querySelector('[data-t="dcSub"]');
  if(dcJudul) dcJudul.textContent = u.dcJudul || (radkom ? T('dcRadkomJudul') : T('dcJudul'));
  if(dcSub) dcSub.textContent = radkom ? T('dcRadkomSub') : T('dcSub');
  if(radkom && Object.keys(dcRkState).length === 0){ initDcRkState(); renderDcRkTable(); }

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
                         dibuatPada:i.DibuatPada||'',
                         lampiranOpen:i.LampiranOpen||[], lampiranClosed:i.LampiranClosed||[] });
const ISSUE_HEADER = { jenis:'Jenis', keterangan:'Keterangan', lokasi:'Lokasi', status:'Status',
                       tglReport:'TanggalReport', tglClosed:'TanggalClosed', dilaporkanOleh:'DilaporkanOleh' };
