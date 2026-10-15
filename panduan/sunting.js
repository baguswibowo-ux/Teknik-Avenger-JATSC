/* =======================================================================
   PENYUNTING PANDUAN — hanya untuk administrator

   Disisipkan server ke halaman manual dan video di /panduan/. Ia bertanya
   dulu ke /panduan/api/saya; untuk akun lain ia tidak memasang apa pun.

   Manual : seluruh isi halaman bisa diketik langsung (contenteditable),
            dengan bilah alat untuk judul, daftar, kotak catatan, bab baru,
            dan sisip gambar. Simpan mengirim isi <main> ke server.
   Video  : panel per langkah — judul & ringkasan bab, judul langkah, narasi,
            tip, dan satu gambar pendamping. Simpan mengirim seluruh
            suntingan video sekaligus.
   Logo   : satu logo untuk manual dan video (kepala halaman, sampul, dan
            pojok layar video).
   ======================================================================= */
(function(){
  const jenis = document.body.dataset.panduan;
  if(!jenis) return;

  const CSS = `
  .sp-bilah{position:fixed;z-index:9999;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 32px);font:600 14px/1.2 'Barlow',system-ui,sans-serif}
  .sp-bilah[hidden]{display:none!important}
  .sp-bilah button,.sp-alat button,.sp-panel button{font:inherit;padding:9px 14px;border-radius:9px;border:1px solid #b9c6d8;background:#fff;color:#14213a;cursor:pointer;box-shadow:0 6px 18px -8px rgba(0,0,0,.35)}
  .sp-bilah button.utama,.sp-alat button.utama,.sp-panel button.utama{background:#0b6fb0;border-color:#0b6fb0;color:#fff}
  .sp-bilah button:focus-visible,.sp-alat button:focus-visible,.sp-panel button:focus-visible{outline:2px solid #f6971d;outline-offset:2px}
  .sp-alat{position:sticky;top:0;z-index:9998;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 12px;margin:0 -4px 12px;background:#fff8e8;border:1px solid #f0c77a;border-radius:0 0 12px 12px;font:600 13.5px/1.2 'Barlow',system-ui,sans-serif;color:#5c3b00}
  .sp-alat button{padding:6px 10px;box-shadow:none;font-size:13.5px}
  .sp-alat .sp-sela{flex:1}
  .sp-alat .sp-ket{font-weight:500;width:100%;font-size:12.5px;color:#7a5410}
  body.sp-menyunting main{outline:2px dashed #f0b44a;outline-offset:6px;border-radius:4px}
  body.sp-menyunting main:focus{outline-color:#0b6fb0}
  .sp-pesan{position:fixed;z-index:10000;left:50%;bottom:76px;transform:translateX(-50%);background:#103a2a;color:#e6fff1;padding:9px 16px;border-radius:9px;font:600 14px 'Barlow',system-ui,sans-serif;max-width:calc(100% - 32px)}
  .sp-pesan.galat{background:#5a1414;color:#ffecec}
  .sp-lapis{position:fixed;inset:0;z-index:9999;background:rgba(4,8,16,.6);display:grid;place-items:center;padding:16px}
  .sp-panel{width:min(620px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#14213a;border-radius:14px;padding:18px;font:15px/1.45 'Barlow',system-ui,sans-serif;display:flex;flex-direction:column;gap:10px}
  .sp-panel h3{margin:0;font:700 20px 'Rajdhani','Barlow',sans-serif}
  .sp-panel label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px;color:#4a5a74}
  .sp-panel input,.sp-panel textarea{font:15px/1.45 'Barlow',system-ui,sans-serif;padding:8px 10px;border:1px solid #c7d2e2;border-radius:8px;color:#14213a;background:#fff}
  .sp-panel textarea{min-height:90px;resize:vertical}
  .sp-panel .sp-baris{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .sp-panel .sp-baris .sp-sela{flex:1}
  .sp-panel img{max-width:100%;max-height:160px;border-radius:8px;border:1px solid #d6deea;object-fit:contain}
  .sp-panel .sp-ket{font-size:13px;color:#5a6984}
  .sp-panel hr{border:0;border-top:1px solid #e1e7f0;margin:4px 0}`;

  const el = (tag, atr = {}, isi = []) => { const e = document.createElement(tag);
    for(const [k, v] of Object.entries(atr)){ if(k === 'teks') e.textContent = v; else if(k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    [].concat(isi).forEach(c => c && e.appendChild(c)); return e; };
  let pesanT;
  function pesan(teks, galat){
    document.querySelectorAll('.sp-pesan').forEach(x => x.remove());
    const p = el('div', { class: 'sp-pesan' + (galat ? ' galat' : ''), role: 'status', teks }); document.body.appendChild(p);
    clearTimeout(pesanT); pesanT = setTimeout(() => p.remove(), galat ? 7000 : 3500);
  }
  async function api(metode, url, badan){
    const r = await fetch(url, { method: metode, credentials: 'same-origin',
      headers: badan ? { 'Content-Type': 'application/json' } : {}, body: badan ? JSON.stringify(badan) : undefined });
    const j = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(j.error || ('Gagal (' + r.status + ')'));
    return j;
  }
  /** Pilih satu berkas gambar, kembalikan { berkas, isi(base64) } atau null. */
  function pilihGambar(terima = 'image/png,image/jpeg,image/webp,image/gif'){
    return new Promise(selesai => {
      const inp = el('input', { type: 'file', accept: terima }); inp.style.display = 'none';
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0]; inp.remove(); if(!f) return selesai(null);
        const rd = new FileReader();
        rd.onload = () => selesai({ berkas: f.name, isi: String(rd.result).split(',')[1] || '' });
        rd.onerror = () => { pesan('Berkas tidak bisa dibaca.', true); selesai(null); };
        rd.readAsDataURL(f);
      });
      document.body.appendChild(inp); inp.click();
      // Kalau dialognya ditutup tanpa memilih, 'change' tidak pernah datang; tidak apa-apa.
    });
  }
  async function gantiLogo(){
    const g = await pilihGambar('image/png,image/jpeg,image/webp'); if(!g) return;
    try {
      const j = await api('POST', '/panduan/api/logo', g);
      document.querySelectorAll('img.logo-panduan').forEach(i => { i.hidden = true; i.src = j.url; });
      pesan('Logo diganti.');
    } catch(e){ pesan(e.message, true); }
  }
  async function hapusLogo(){
    if(!window.confirm || !confirm('Buang logo panduan?')) return;
    try { await api('DELETE', '/panduan/api/logo'); document.querySelectorAll('img.logo-panduan').forEach(i => { i.hidden = true; }); pesan('Logo dibuang.'); }
    catch(e){ pesan(e.message, true); }
  }

  fetch('/panduan/api/saya', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(s => {
    if(!s || !s.bolehSunting) return;
    document.head.appendChild(el('style', { teks: CSS }));
    if(jenis === 'manual') pasangManual(s);
    if(jenis === 'video') pasangVideo();
  }).catch(() => {});

  /* ============================== MANUAL ============================== */
  function pasangManual(s){
    const main = document.querySelector('main');
    let simpananAsli = null, rentang = null, alat = null;

    const bilah = el('div', { class: 'sp-bilah' }, [
      el('button', { type: 'button', class: 'utama', id: 'spMulai', teks: '✎ Sunting manual', onclick: mulai }),
      el('button', { type: 'button', teks: '🖼 Ganti logo', onclick: gantiLogo }),
      el('button', { type: 'button', teks: 'Buang logo', onclick: hapusLogo })
    ]);
    document.body.appendChild(bilah);

    // Posisi kursor terakhir di dalam isi, supaya gambar mendarat di tempat yang dimaksud.
    document.addEventListener('selectionchange', () => {
      const sel = document.getSelection();
      if(sel && sel.rangeCount && main.contains(sel.anchorNode)) rentang = sel.getRangeAt(0).cloneRange();
    });
    const pulihkan = () => { if(rentang){ const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(rentang); } else main.focus(); };
    const perintah = (c, v) => { pulihkan(); document.execCommand(c, false, v); };
    function sisipHtml(html){ pulihkan(); document.execCommand('insertHTML', false, html); }
    function bagianKini(){
      const n = rentang ? rentang.startContainer : null;
      const e = n && (n.nodeType === 1 ? n : n.parentElement);
      return e && e.closest('section.bab');
    }

    function mulai(){
      simpananAsli = main.innerHTML;
      main.contentEditable = 'true'; main.spellcheck = false;
      document.body.classList.add('sp-menyunting');
      bilah.hidden = true;
      const t = (teks, fn, judul) => el('button', { type: 'button', teks, title: judul || teks, onmousedown: e => e.preventDefault(), onclick: fn });
      alat = el('div', { class: 'sp-alat', role: 'toolbar', 'aria-label': 'Alat sunting manual' }, [
        t('B', () => perintah('bold'), 'Tebal'), t('I', () => perintah('italic'), 'Miring'),
        t('Subjudul', () => perintah('formatBlock', 'h3')), t('Paragraf', () => perintah('formatBlock', 'p')),
        t('• Daftar', () => perintah('insertUnorderedList')), t('1. Langkah', () => perintah('insertOrderedList')),
        t('Kotak catatan', () => sisipHtml('<div class="kotak tip"><b>Judul catatan</b><p>Tulis catatan di sini.</p></div><p></p>')),
        t('🖼 Sisip gambar', sisipGambar),
        t('＋ Bab baru', babBaru, 'Tambah bab sesudah bab tempat kursor berada'),
        t('Hapus bab ini', hapusBab, 'Buang bab tempat kursor berada'),
        el('span', { class: 'sp-sela' }),
        t('Batal', batal), t('Kembalikan bawaan', kembalikan),
        el('button', { type: 'button', class: 'utama', teks: '💾 Simpan', onmousedown: e => e.preventDefault(), onclick: simpan }),
        el('div', { class: 'sp-ket', teks: 'Klik di mana saja lalu ketik untuk mengubah teks. Gambar disisipkan di posisi kursor. Bab baru otomatis masuk daftar isi.' })
      ]);
      main.prepend(alat);
      main.focus();
    }

    function selesai(){
      main.contentEditable = 'false'; main.removeAttribute('contenteditable');
      document.body.classList.remove('sp-menyunting');
      alat && alat.remove(); alat = null; bilah.hidden = false;
      if(window.segarkanDaftarIsi) window.segarkanDaftarIsi();
    }
    function batal(){ main.innerHTML = simpananAsli; selesai(); pesan('Suntingan dibatalkan.'); }

    async function sisipGambar(){
      const posisi = rentang;
      const g = await pilihGambar(); if(!g) return;
      try {
        const j = await api('POST', '/panduan/api/gambar', g);
        rentang = posisi;
        sisipHtml(`<figure class="potret"><img src="${j.url}" alt="" loading="lazy"><figcaption>Keterangan gambar</figcaption></figure><p></p>`);
        pesan('Gambar disisipkan. Ubah keterangannya di bawah gambar.');
      } catch(e){ pesan(e.message, true); }
    }
    function babBaru(){
      const s = bagianKini() || [...main.querySelectorAll('section.bab')].pop();
      const id = 'bab-' + Date.now().toString(36);
      const b = el('section', { class: 'bab', id });
      b.innerHTML = '<div class="no-bab">BAB</div><h2>Judul bab baru</h2><p>Tulis isi bab di sini.</p>';
      if(s) s.after(b); else main.appendChild(b);
      if(window.segarkanDaftarIsi) window.segarkanDaftarIsi();
      b.scrollIntoView({ block: 'start' });
      const sel = document.getSelection(); const r = document.createRange(); r.selectNodeContents(b.querySelector('h2')); sel.removeAllRanges(); sel.addRange(r);
    }
    function hapusBab(){
      const s = bagianKini(); if(!s) return pesan('Klik dulu di dalam bab yang mau dibuang.', true);
      const judul = s.querySelector('h2')?.textContent || 'bab ini';
      if(!confirm('Buang "' + judul + '"? Masih bisa dibatalkan dengan tombol Batal sebelum disimpan.')) return;
      s.remove(); if(window.segarkanDaftarIsi) window.segarkanDaftarIsi();
    }
    async function simpan(){
      const salin = main.cloneNode(true);
      salin.querySelectorAll('.sp-alat').forEach(x => x.remove());
      try {
        await api('PUT', '/panduan/api/manual', { html: salin.innerHTML });
        selesai(); pesan('Manual tersimpan. Semua orang melihat versi ini sekarang.');
      } catch(e){ pesan(e.message, true); }
    }
    async function kembalikan(){
      if(!confirm('Buang semua suntingan manual dan kembali ke isi bawaan?')) return;
      try { await api('DELETE', '/panduan/api/manual'); location.reload(); }
      catch(e){ pesan(e.message, true); }
    }
  }

  /* ============================== VIDEO ============================== */
  function pasangVideo(){
    const P = window.PANDUAN; if(!P) return;
    const ubah = () => (P.suntingan = P.suntingan || { bab: {}, langkah: {} });
    document.body.appendChild(el('div', { class: 'sp-bilah' }, [
      el('button', { type: 'button', class: 'utama', teks: '✎ Sunting langkah ini', onclick: buka }),
      el('button', { type: 'button', teks: '🖼 Ganti logo', onclick: gantiLogo }),
      el('button', { type: 'button', teks: 'Buang logo', onclick: hapusLogo }),
      el('button', { type: 'button', teks: 'Kembalikan bawaan', onclick: kembalikan })
    ]));

    function buka(){
      P.jeda();
      const { b, i } = P.kini(), bab = P.BAB[b], a = bab.langkah[i];
      let gambar = a.gambar || '';
      const f = (label, id, nilai, panjang) => el('label', {}, [document.createTextNode(label),
        panjang ? el('textarea', { id }) : el('input', { id, type: 'text' })]);
      const lapis = el('div', { class: 'sp-lapis', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sunting langkah video' });
      const pratinjau = el('img', { alt: 'Gambar langkah' });
      const panel = el('div', { class: 'sp-panel' }, [
        el('h3', { teks: 'Bab ' + (b + 1) + ' · langkah ' + (i + 1) }),
        f('Judul bab', 'spBabJudul', bab.judul), f('Ringkasan bab (di daftar bab)', 'spBabRingkas', bab.ringkas),
        el('hr'),
        f('Judul langkah', 'spJ', a.j), f('Narasi', 'spN', a.n, true), f('Tip (kosongkan untuk menyembunyikan)', 'spTip', a.tip, true),
        el('div', { class: 'sp-ket', teks: 'Tulis dengan kata "tekan"; di tampilan PC otomatis dibaca "klik". Tulisan di dalam tanda kutip “…” tidak diubah.' }),
        el('div', { class: 'sp-baris' }, [el('b', { teks: 'Gambar pendamping' }), el('span', { class: 'sp-sela' }),
          el('button', { type: 'button', teks: 'Pilih gambar', onclick: async () => {
            const g = await pilihGambar(); if(!g) return;
            try { const j = await api('POST', '/panduan/api/gambar', g); gambar = j.url; pratinjau.src = gambar; pratinjau.hidden = false; }
            catch(e){ pesan(e.message, true); } } }),
          el('button', { type: 'button', teks: 'Buang gambar', onclick: () => { gambar = ''; pratinjau.hidden = true; } })]),
        pratinjau,
        el('div', { class: 'sp-baris' }, [el('span', { class: 'sp-sela' }),
          el('button', { type: 'button', teks: 'Batal', onclick: () => lapis.remove() }),
          el('button', { type: 'button', class: 'utama', teks: '💾 Simpan', onclick: simpan })])
      ]);
      lapis.appendChild(panel); document.body.appendChild(lapis);
      panel.querySelector('#spBabJudul').value = bab.judul; panel.querySelector('#spBabRingkas').value = bab.ringkas;
      panel.querySelector('#spJ').value = a.j; panel.querySelector('#spN').value = a.n; panel.querySelector('#spTip').value = a.tip || '';
      if(gambar){ pratinjau.src = gambar; } else pratinjau.hidden = true;
      lapis.addEventListener('keydown', e => { if(e.key === 'Escape') lapis.remove(); });
      panel.querySelector('#spJ').focus();

      async function simpan(){
        const d = ubah(), v = (id) => panel.querySelector('#' + id).value.trim();
        const kb = String(b), kl = b + '-' + i;
        d.bab[kb] = { judul: v('spBabJudul') === bab._asli.judul ? undefined : v('spBabJudul'),
                      ringkas: v('spBabRingkas') === bab._asli.ringkas ? undefined : v('spBabRingkas') };
        d.langkah[kl] = { j: v('spJ') === a._asli.j ? undefined : v('spJ'), n: v('spN') === a._asli.n ? undefined : v('spN'),
                          tip: v('spTip') === (a._asli.tip || '') ? undefined : v('spTip'), gambar: gambar || undefined };
        for(const k of [kb]) if(!Object.values(d.bab[k]).some(x => x !== undefined)) delete d.bab[k];
        if(!Object.values(d.langkah[kl]).some(x => x !== undefined)) delete d.langkah[kl];
        try {
          await api('PUT', '/panduan/api/video', JSON.parse(JSON.stringify(d)));
          P.terapkan(d); P.segarkan(); lapis.remove(); pesan('Langkah tersimpan.');
        } catch(e){ pesan(e.message, true); }
      }
    }
    async function kembalikan(){
      if(!confirm('Buang semua suntingan teks dan gambar video, kembali ke bawaan?')) return;
      try { await api('DELETE', '/panduan/api/video'); P.suntingan = { bab: {}, langkah: {} }; P.terapkan(P.suntingan); P.segarkan(); pesan('Video kembali ke bawaan.'); }
      catch(e){ pesan(e.message, true); }
    }
  }
})();
