/* =======================================================================
   CETAK ATAU KIRIM PDF — dipakai bersama dashboard dan E-Logbook

   Tiap tombol Cetak di kedua aplikasi berakhir di #printArea yang sudah
   jadi (kop, isi, TTD yang sudah dihitamkan), lalu window.print(). Tepat di
   titik itu cetakAtauKirim() menyela dengan satu pilihan:

     🖨 Cetak          — dialog cetak peramban seperti biasa
     ✉ Kirim PDF       — server mencetak lembar yang SAMA ke PDF
                         (POST /cetak/pdf, Edge headless — cetak-pdf.js),
                         lalu PDF-nya dikirim dari aplikasi orang itu
                         sendiri lewat menu Bagikan sistem (HP dan Windows:
                         Gmail, Outlook, WhatsApp, … — PDF terlampir), atau
                         diunduh.

   Server tidak menyimpan akun email siapa pun, dan tidak mengirim email
   sendiri. Alamat tujuan diketik langsung di aplikasi emailnya.

   Berdiri sendiri — tidak memakai fungsi milik salah satu aplikasi — karena
   dimuat oleh keduanya (/kirim-pdf.js). Gayanya pun dibawa sendiri.
   ======================================================================= */
(function(){

  const escK = (s)=> String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function pasangGaya(){
    if(document.getElementById('kpdfGaya')) return;
    const st = document.createElement('style');
    st.id = 'kpdfGaya';
    st.textContent = `
      .kpdf-lapis{position:fixed;inset:0;z-index:99999;background:rgba(8,12,20,.62);
        display:flex;align-items:center;justify-content:center;padding:16px;}
      .kpdf-kartu{background:#fff;color:#1b2230;border-radius:12px;max-width:440px;width:100%;
        box-shadow:0 18px 50px rgba(0,0,0,.35);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
        padding:18px 18px 14px;}
      .kpdf-kartu h3{margin:0 0 4px;font-size:16px;}
      .kpdf-ket{color:#5b6475;font-size:12.5px;margin-bottom:14px;word-break:break-word;}
      .kpdf-tombol{display:flex;flex-direction:column;gap:8px;}
      .kpdf-tombol button{border:1px solid #c9d1de;background:#f4f6fa;color:#1b2230;
        border-radius:8px;padding:10px 12px;font:inherit;cursor:pointer;text-align:left;}
      .kpdf-tombol button.utama{background:#1f6feb;border-color:#1f6feb;color:#fff;font-weight:600;}
      .kpdf-tombol button:disabled{opacity:.6;cursor:progress;}
      .kpdf-tombol small{display:block;font-weight:400;opacity:.8;font-size:12px;}
      .kpdf-kaki{display:flex;justify-content:flex-end;margin-top:12px;}
      .kpdf-kaki button{border:none;background:none;color:#5b6475;font:inherit;cursor:pointer;padding:6px 8px;}
      .kpdf-galat{color:#b42318;font-size:12.5px;margin-top:10px;}
      @media print{.kpdf-lapis{display:none !important;}}`;
    document.head.appendChild(st);
  }

  /** Seluruh CSS halaman ini, apa adanya — termasuk @media print dan @page
      yang disuntik tepat sebelum cetak (orientasi lanskap). */
  function kumpulkanCss(){
    let css = '';
    for(const lembar of Array.from(document.styleSheets)){
      try{ for(const r of Array.from(lembar.cssRules || [])) css += r.cssText + '\n'; }
      catch(e){ /* lembar gaya lintas asal (font Google) — tidak terbaca, dilewati */ }
    }
    return css;
  }

  const keDataUrl = (blob)=> new Promise((ok, gagal)=>{
    const r = new FileReader(); r.onload = ()=>ok(r.result); r.onerror = gagal; r.readAsDataURL(blob);
  });

  /** Salinan isi area cetak dengan semua gambar jadi data: — server
      mencetaknya tanpa jaringan sama sekali. */
  async function isiSiapKirim(area){
    const salin = area.cloneNode(true);
    const imgs = Array.from(salin.querySelectorAll('img'));
    await Promise.all(imgs.map(async (img)=>{
      const src = img.getAttribute('src') || '';
      if(!src || src.startsWith('data:')) return;
      try{
        const r = await fetch(new URL(src, location.href).href, { credentials:'same-origin' });
        if(!r.ok) throw new Error(r.status);
        img.setAttribute('src', await keDataUrl(await r.blob()));
      }catch(e){ img.removeAttribute('src'); }
    }));
    // Kanvas tersalin kosong — gambarnya diambil dari aslinya, urutannya sama.
    const kanvasAsli = Array.from(area.querySelectorAll('canvas'));
    Array.from(salin.querySelectorAll('canvas')).forEach((c, i)=>{
      try{ const g = document.createElement('img'); g.src = kanvasAsli[i].toDataURL('image/png'); c.replaceWith(g); }
      catch(e){ c.remove(); }
    });
    return salin.innerHTML;
  }

  const namaBerkas = (judul)=> (String(judul || 'Dokumen')
    .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Dokumen') + '.pdf';

  function unduh(berkas){
    const url = URL.createObjectURL(berkas);
    const a = document.createElement('a');
    a.href = url; a.download = berkas.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
  }

  async function buatPdf(area, judul){
    const r = await fetch('/cetak/pdf', {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        html: await isiSiapKirim(area), css: kumpulkanCss(), kelas: area.className, judul,
        // Tema (data-tema, dsb.) dan kelas body ikut, supaya variabel warna
        // yang dipakai lembar cetak sama dengan yang dilihat dialog cetak.
        akar: Object.fromEntries(Array.from(document.documentElement.attributes)
          .filter(a=>/^data-[\w-]+$/.test(a.name)).map(a=>[a.name, a.value])),
        badan: document.body.className
      })
    });
    if(!r.ok){
      const j = await r.json().catch(()=>null);
      throw new Error((j && j.error) || ('server menjawab ' + r.status));
    }
    return new File([await r.blob()], namaBerkas(judul), { type:'application/pdf' });
  }

  /**
   * Tawarkan Cetak atau Kirim PDF untuk isi `area` yang sudah siap cetak.
   * `cetak` dipanggil kalau yang dipilih Cetak. Selesai (resolve) setelah
   * orangnya selesai dengan pilihannya — pemanggil baru membersihkan area
   * cetaknya sesudah itu.
   */
  window.cetakAtauKirim = function({ area, judul, cetak }){
    pasangGaya();
    return new Promise((selesai)=>{
      const lapis = document.createElement('div');
      lapis.className = 'kpdf-lapis';
      document.body.appendChild(lapis);
      const tutup = (hasil)=>{ lapis.remove(); selesai(hasil); };
      lapis.addEventListener('click', (e)=>{ if(e.target === lapis) tutup('batal'); });

      const tahapPilih = ()=>{
        lapis.innerHTML = `<div class="kpdf-kartu" role="dialog" aria-modal="true">
          <h3>Lembar siap</h3>
          <div class="kpdf-ket">${escK(judul || '')}</div>
          <div class="kpdf-tombol">
            <button class="utama" data-k="cetak">🖨 Cetak<small>Buka dialog cetak / Simpan sebagai PDF</small></button>
            <button data-k="kirim">✉ Kirim PDF<small>Lewat email atau aplikasi lain milik Anda sendiri</small></button>
          </div>
          <div class="kpdf-kaki"><button data-k="batal">Batal</button></div></div>`;
        lapis.querySelector('[data-k="cetak"]').onclick = ()=>{
          lapis.remove();
          // Beri waktu lapisan ini hilang dari layar sebelum dialog cetak.
          setTimeout(()=>{ try{ cetak(); }finally{ setTimeout(()=>selesai('cetak'), 400); } }, 60);
        };
        lapis.querySelector('[data-k="kirim"]').onclick = tahapBuat;
        lapis.querySelector('[data-k="batal"]').onclick = ()=>tutup('batal');
      };

      const tahapBuat = async ()=>{
        lapis.querySelectorAll('button').forEach(b=>b.disabled = true);
        const k = lapis.querySelector('[data-k="kirim"]');
        k.innerHTML = '⏳ Membuat PDF…<small>Beberapa detik</small>';
        try{
          tahapKirim(await buatPdf(area, judul));
        }catch(e){
          tahapPilih();
          const g = document.createElement('div');
          g.className = 'kpdf-galat';
          g.textContent = 'Gagal membuat PDF: ' + (e && e.message || e);
          lapis.querySelector('.kpdf-kartu').insertBefore(g, lapis.querySelector('.kpdf-kaki'));
        }
      };

      const tahapKirim = (berkas)=>{
        const bisaBagikan = !!(navigator.canShare && navigator.canShare({ files:[berkas] }));
        const kb = Math.max(1, Math.round(berkas.size / 1024));
        /* Menu Bagikan sistem (HP, Windows) membawa PDF-nya langsung ke
           aplikasi terpasang — Gmail, Outlook, WhatsApp — sebagai lampiran.
           Gmail yang dibuka di peramban tidak bisa menerima lampiran dari
           situs lain; jalan lewat tautan sempat dicoba lalu dibuang atas
           permintaan Bagus (29 Sep 2026). */
        lapis.innerHTML = `<div class="kpdf-kartu" role="dialog" aria-modal="true">
          <h3>PDF siap</h3>
          <div class="kpdf-ket">${escK(berkas.name)} · ${kb} KB</div>
          <div class="kpdf-tombol">
            ${bisaBagikan ? `<button class="utama" data-k="bagikan">📤 Kirim / Bagikan PDF<small>Pilih aplikasinya (Gmail, Outlook, WhatsApp, …) — PDF sudah terlampir</small></button>` : ''}
            <button class="${bisaBagikan ? '' : 'utama'}" data-k="unduh">⬇ Unduh PDF</button>
          </div>
          <div class="kpdf-kaki"><button data-k="selesai">Selesai</button></div></div>`;
        const bagikan = lapis.querySelector('[data-k="bagikan"]');
        /* Berkas SAJA — tanpa title/text. Gmail di Android yang menerima teks
           dan berkas sekaligus mengambil teksnya dan membuang lampirannya. */
        if(bagikan) bagikan.onclick = async ()=>{
          try{ await navigator.share({ files:[berkas] }); tutup('kirim'); }
          catch(e){ if(e && e.name !== 'AbortError') unduh(berkas); }
        };
        lapis.querySelector('[data-k="unduh"]').onclick = ()=>unduh(berkas);
        lapis.querySelector('[data-k="selesai"]').onclick = ()=>tutup('kirim');
      };

      tahapPilih();
    });
  };
})();
