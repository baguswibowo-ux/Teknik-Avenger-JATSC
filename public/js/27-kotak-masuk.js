/* =======================================================================
   KOTAK MASUK — kegiatan berkala, per tanggal, tertuju ke yang berdinas

   Bedanya dengan lonceng di sebelahnya, dan kenapa keduanya ada:

     lonceng      apa yang perlu SAYA kerjakan HARI INI. Pendek, hanya yang
                  sudah jatuh tempo atau besok, dan pergi begitu beres.
     kotak masuk  seluruh kejadian di periode berjalan beserta TUJUANNYA —
                  termasuk yang masih beberapa hari lagi, dan termasuk yang
                  tertuju ke orang lain.

   Yang menentukan tujuan JADWAL DINAS pada tanggal kejadian, bukan daftar akun
   dan bukan siapa yang kebetulan berdinas hari ini. DS Test yang jatuh Sabtu
   adalah pekerjaan orang yang jadwalnya Sabtu; memberitahukannya kepada yang
   berdinas Senin hanya melahirkan pertanyaan, bukan pekerjaan yang selesai.

   Yang TIDAK dilakukan di sini: tidak ada penyimpanan baru. Kotak ini
   seluruhnya diturunkan dari kegiatan berkala + jadwal dinas + catatan selesai
   yang sudah ada. Tidak ada butir yang bisa "dibaca" atau "diarsipkan" — yang
   mengosongkan satu baris cuma pekerjaannya benar-benar dikerjakan.
   ======================================================================= */

/** Siapa yang berdinas di satu unit pada tanggal tertentu.
    null — bukan daftar kosong — kalau jadwalnya memang belum bisa dibaca:
    "belum termuat" dan "tidak ada yang berdinas" dua hal yang berbeda, dan
    yang kedua itu lubang jaga yang pantas terlihat. */
function dinasPadaTanggal(unit, d){
  // Yang termuat cuma bulan berjalan. Kejadian di pekan yang melewati pergantian
  // bulan jatuh di luar jangkauan itu, dan menebaknya lebih buruk daripada
  // mengaku tidak tahu.
  if(bulanKode(d) !== JDW.bulanIni) return null;
  const daftar = JDW.jadwal[unit];
  if(!Array.isArray(daftar) || !daftar.length) return null;
  const h = d.getDate();
  return daftar
    .map(o=>({ nama:o.nama, peran:o.peran || '', kode:(o.hari || [])[h-1] || '' }))
    .filter(o=>o.kode && o.nama);
}

/** Kenapa penerimanya tidak bisa dibaca. Dua sebab yang berbeda, dan hanya satu
    di antaranya yang bisa dibereskan dengan mengisi jadwal — yang satu lagi
    cuma soal bulan yang memang belum diambil dari server. */
function dinasSebabKosong(unit, d){
  return bulanKode(d) !== JDW.bulanIni
    ? T(`jadwal ${namaBulan(bulanKode(d))} belum dimuat`,
        `the ${namaBulan(bulanKode(d))} roster is not loaded`)
    : T('unit ini belum punya jadwal dinas bulan ini',
        'this unit has no roster for this month yet');
}

/** Satu butir per kejadian, seluruh unit yang boleh dibuka akun ini. */
function kotakButir(){
  const kini = new Date(); kini.setHours(0,0,0,0);
  const keluar = [];
  Object.entries(BKL.kegiatan).forEach(([unit, daftar])=>{
    if(!bolehBuka(unit)) return;
    (daftar || []).forEach(k=>{
      bklKejadian(k).forEach(j=>{
        const tanggal = bklTgl(j);
        const orang = dinasPadaTanggal(unit, j);
        keluar.push({
          unit, k, tanggal,
          hari:  j.getDay() || 7,
          sisa:  Math.round((j - kini) / 86400000),
          sudah: bklSudahTgl(unit, k, tanggal),
          orang,
          untukSaya: !!orang && orang.some(o=>namaSaya(o.nama))
        });
      });
    });
  });
  return keluar.sort((a,b)=>a.tanggal.localeCompare(b.tanggal)
    || a.unit.localeCompare(b.unit) || a.k.nama.localeCompare(b.k.nama));
}

/** Angka di rel: yang tertuju ke saya dan belum beres. Yang tertuju ke orang
    lain tidak dihitung — lencana yang tidak bisa dikosongkan siapa pun akan
    berhenti dibaca dalam sepekan. */
const kotakUntukSaya = () => kotakButir().filter(b=>b.untukSaya && !b.sudah);

let KOTAK_SARING = 'saya';    // 'saya' | 'semua'

function gambarKotakMasuk(){
  const kotak = el('isiKotak'); if(!kotak) return;
  const semua = kotakButir();
  const milikSaya = semua.filter(b=>b.untukSaya);
  const tampil = KOTAK_SARING === 'saya' ? milikSaya : semua;

  const lencana = el('lencanaKotak');
  const n = kotakUntukSaya().length;
  if(lencana){ lencana.textContent = n; lencana.hidden = !n; }

  el('ketKotak').textContent =
    T(`Periode berjalan · pekan ${periodeKini('mingguan')}`,
      `Current period · week ${periodeKini('mingguan')}`);

  el('saringKotak').innerHTML = [
    ['saya',  T(`Untuk saya (${milikSaya.length})`, `For me (${milikSaya.length})`)],
    ['semua', T(`Semua unit saya (${semua.length})`, `All my units (${semua.length})`)]
  ].map(([nilai, teks])=>`<button class="btn ${KOTAK_SARING === nilai ? '' : 'garis '}kecil"
      data-saring-kotak="${nilai}">${esc(teks)}</button>`).join('');

  if(!tampil.length){
    kotak.innerHTML = `<div class="panel"><div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">${
      KOTAK_SARING === 'saya'
        ? T('Tidak ada kegiatan berkala yang tertuju ke Anda di periode ini. Anda tidak tercantum '
          + 'berdinas pada tanggal-tanggal kejadiannya, atau pekerjaannya sudah beres semua.',
            'No recurring job is addressed to you this period. You are not rostered on any of the '
          + 'occurrence dates, or everything is already done.')
        : T('Belum ada kegiatan berkala di unit yang boleh Anda buka.',
            'No recurring jobs in the units you may open yet.')}</div></div>`;
    kotakPasang();
    return;
  }

  // Dikelompokkan per tanggal: yang dibaca orang "apa saja hari Rabu", bukan
  // "kapan saja pekerjaan bernama X".
  const perTanggal = {};
  tampil.forEach(b=>{ (perTanggal[b.tanggal] = perTanggal[b.tanggal] || []).push(b); });

  kotak.innerHTML = Object.entries(perTanggal).map(([tanggal, butir])=>{
    const s = butir[0].sisa;
    const rupa = butir.every(b=>b.sudah) ? 'aman' : s < 0 ? 'bahaya' : s === 0 ? 'awas' : '';
    const kapan = s < 0 ? T(`lewat ${-s} hari`, `${-s} days ago`)
      : s === 0 ? T('hari ini','today')
      : s === 1 ? T('besok','tomorrow')
      : T(`${s} hari lagi`, `in ${s} days`);
    return `<div class="panel" style="margin-bottom:14px">
      <div class="kepala">
        <h3>${esc(hariNama(butir[0].hari))}, ${esc(tglRingkas(tanggal))}</h3>
        <span class="cip ${rupa}">${esc(kapan.toUpperCase())}</span>
      </div>
      <div class="badan" style="display:grid;gap:10px">${butir.map(b=>kotakBaris(b)).join('')}</div>
    </div>`;
  }).join('');

  kotakPasang();
}

/** Satu baris pekerjaan di dalam kelompok tanggalnya. */
function kotakBaris(b){
  const { unit, k, sudah, orang, untukSaya } = b;
  const penerima = orang === null
    ? `<span class="kmk-samar">${esc(dinasSebabKosong(unit, new Date(b.tanggal + 'T00:00:00')))}</span>`
    : orang.length
      ? orang.map(o=>`<span class="kmk-orang${namaSaya(o.nama) ? ' saya' : ''}">${esc(o.nama)}
          <span class="mono">${esc(o.kode)}</span></span>`).join('')
      : `<span class="kmk-samar">${T('tidak ada yang berdinas hari itu','nobody is rostered that day')}</span>`;

  return `<article class="kmk ${sudah ? 'beres' : ''}${untukSaya ? ' saya' : ''}">
    <div class="kmk-kiri">
      <div class="kmk-jd">
        <span class="cip ${bklRupaJenis(k.jenis)}">${esc(bklJenisNama(k.jenis).toUpperCase())}</span>
        ${bklSumber(k).cip ? `<span class="cip">${esc(bklSumber(k).cip)}</span>` : ''}
        <b>${esc(k.nama)}</b>
      </div>
      <div class="kmk-rn">${esc(namaUnit(unit))}${k.ket ? ' · ' + esc(k.ket) : ''}</div>
      <div class="kmk-orang-baris">${T('Berdinas','On duty')}: ${penerima}</div>
    </div>
    <div class="kmk-kanan">
      ${sudah
        ? `<span class="bkl-status aman">${T('Sudah dikerjakan','Done')} · ${esc(sudah.nama || sudah.oleh)}</span>`
        : `<span class="bkl-status ${b.sisa < 0 ? 'bahaya' : b.sisa <= 0 ? 'awas' : ''}">${
            T('Belum dikerjakan','Not done yet')}</span>`}
      <span class="kmk-tombol">
        ${kotakTautanForm(unit, k)}
        <button class="btn garis kecil" data-kotak-buka="${esc(unit)}">${T('Buka kegiatannya','Open the job')}</button>
      </span>
    </div>
  </article>`;
}

/**
 * Tombol yang membuka formulir kegiatan ini di E-Logbook, langsung pada tabnya.
 *
 * Tautannya membawa #<tab>:<unit> — tabnya dari registri sumber, jadi sumber
 * baru mendapat tombolnya tanpa satu baris pun ditambahkan di sini. E-Logbook
 * membaca potongan itu saat halaman dibuka dan langsung berpindah ke tab yang
 * disebut; lihat tautanMasuk() di elogbook/public/js/26-init.js.
 *
 * Unit ikut disebut karena tab-tab itu hanya ada pada unit yang memang punya
 * formulirnya; tanpa itu tautannya mendarat di unit terakhir yang dibuka orang,
 * yang belum tentu unit ini.
 *
 * Tidak dipasang sama sekali dalam tiga keadaan, dan ketiganya sama sebabnya —
 * tombol yang menuju entah ke mana lebih buruk daripada tidak ada tombol:
 *   · kegiatannya tidak bersumber lembar
 *   · alamat E-Logbook belum diketahui (/_info belum menjawab, atau memang
 *     tidak ada E-Logbook di belakangnya)
 *   · unit ini tidak punya formulirnya, jadi di sana tabnya disembunyikan
 */
function kotakTautanForm(unit, k){
  const f = bklSumber(k);
  if(!f.tab || !TAUTAN_ELOGBOOK || !bklFormAda(unit, k)) return '';
  return `<a class="btn kecil" href="${esc(TAUTAN_ELOGBOOK)}#${esc(f.tab)}:${esc(unit)}"
    title="${esc(T('Buka tab ' + f.judul + ' di E-Logbook untuk unit ini',
                   'Open the ' + f.judul + ' tab in E-Logbook for this unit'))}">${
    esc(T('Buka ' + f.judul, 'Open ' + f.judul))}</a>`;
}

function kotakPasang(){
  el('saringKotak').querySelectorAll('[data-saring-kotak]').forEach(b=>{
    b.addEventListener('click', ()=>{ KOTAK_SARING = b.dataset.saringKotak; gambarKotakMasuk(); });
  });
  el('isiKotak').querySelectorAll('[data-kotak-buka]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const unit = b.dataset.kotakBuka;
      if(!bolehBuka(unit)){
        pesan(T(`Akun Anda tidak berhak membuka unit ${namaUnit(unit)}.`,
                `Your account may not open the ${namaUnit(unit)} unit.`));
        return;
      }
      // bukaUnit() sudah berpindah layar sendiri; subtabnya disetel sesudahnya
      // karena ia selalu mendarat di Peralatan. Sama dengan yang dilakukan
      // lonceng — dua jalan menuju tempat yang sama harus sampai dengan cara
      // yang sama juga.
      bukaUnit(unit); subtabAktif = 'berkala'; gambarUnit();
    });
  });
}

/** Panel "Perlu Perhatian" di beranda — papan bersama, bukan milik satu orang. */
function gambarPerhatian(){
  const kotak = el('perhatian'); if(!kotak) return;

  const kerja = bklJatuhTempo().filter(x=>x.sisa <= 3);
  const sert  = sertPerhatian();

  const kartuKerja = kerja.map(({unit, k, sisa})=>`
    <article class="hal ${sisa < 0 ? 'bahaya' : sisa === 0 ? 'awas' : ''}" data-hal-unit="${esc(unit)}">
      <span class="cip ${bklRupaJenis(k.jenis)}">${esc(bklJenisNama(k.jenis).toUpperCase())}</span>
      <span class="jd">${esc(k.nama)}</span>
      <span class="rn">${esc(namaUnit(unit))} · ${sisa < 0
        ? T(`lewat ${-sisa} hari`, `${-sisa} days overdue`)
        : sisa === 0 ? T('jatuh tempo hari ini','due today')
        : T(`${sisa} hari lagi`, `in ${sisa} days`)}</span>
    </article>`).join('');

  const kartuSert = sert.map(({orang, s, sisa})=>`
    <article class="hal ${sisa < 0 ? 'bahaya' : 'awas'}"${
      orang.unit ? ` data-hal-unit="${esc(orang.unit)}" data-hal-sub="personel"` : ''}>
      <span class="cip ${sisa < 0 ? 'bahaya' : 'awas'}">${esc(sertJenisNama(s.jenis)).toUpperCase()}</span>
      <span class="jd">${esc(orang.nama)}</span>
      <span class="rn">${esc(s.nama || s.nomor || '—')} · ${sisa < 0
        ? T(`habis ${-sisa} hari lalu`, `lapsed ${-sisa} days ago`)
        : T(`tinggal ${sisa} hari`, `${sisa} days left`)}</span>
    </article>`).join('');

  const kosong = !kerja.length && !sert.length;
  kotak.innerHTML = kosong
    ? `<div class="hal-kosong">${
        T('Tidak ada pekerjaan berkala yang lewat jatuh tempo, dan tidak ada lisensi yang mendekati '
        + 'masa habisnya dalam dua bulan ke depan.',
          'No recurring job is past its due date, and no licence comes near its expiry in the next two '
        + 'months.')}</div>`
    : kartuKerja + kartuSert;

  el('ketPerhatian').textContent = kosong
    ? T('semuanya terkendali','all clear')
    : T(`${kerja.length + sert.length} hal · ${kerja.length} pekerjaan · ${sert.length} sertifikat`,
        `${kerja.length + sert.length} items · ${kerja.length} jobs · ${sert.length} certificates`);

  kotak.querySelectorAll('[data-hal-unit]').forEach(a=>{
    a.addEventListener('click', ()=>{
      const kode = a.dataset.halUnit;
      if(!bolehBuka(kode)) return;
      // Subtab tujuannya ikut kartunya: pekerjaan berkala ke Kegiatan Berkala,
      // sertifikat ke Personel unit orangnya.
      bukaUnit(kode); subtabAktif = a.dataset.halSub || 'berkala'; gambarUnit();
    });
  });
}

