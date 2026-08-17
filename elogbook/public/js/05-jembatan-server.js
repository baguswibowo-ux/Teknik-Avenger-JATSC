/* E-Logbook · js/05-jembatan-server.js — gsRun: pemanggilan API server, percobaan ulang, penanganan 401
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== JEMBATAN KE SERVER ==============
   Dulu memakai google.script.run ke Apps Script. Sekarang memanggil API server
   sendiri, tapi nama fungsinya sengaja dipertahankan sama persis sehingga
   seluruh kode di bawah tidak perlu berubah. */

/** Ditandai true saat server menjawab 401, agar percobaan ulang tidak diteruskan. */
let sesiHabis = false;

async function gsCall(fn, args){
  const res = await fetch('/api/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ args })
  });

  // Tiap jawaban membawa header Date — dipakai menyelaraskan jam tanpa
  // permintaan tambahan, jadi selisihnya ikut terkoreksi selama aplikasi dipakai.
  catatWaktuServer(res);

  if(res.status === 401){
    sesiHabis = true;
    showLogin('Sesi Anda sudah berakhir. Silakan masuk lagi.');
    throw new Error('Sesi berakhir.');
  }

  let data = null;
  try{ data = await res.json(); }catch(e){ /* jawaban bukan JSON */ }

  if(!res.ok){
    const pesan = res.status === 403
      ? ((data && data.error) || 'Hanya administrator yang boleh melakukan ini.')
      : ((data && data.error) || ('Server menjawab ' + res.status));
    console.error(fn, pesan);
    const err = new Error(pesan);
    // Server sudah menjawab dengan jelas — mengulang hanya menghasilkan jawaban
    // yang sama, dan untuk permintaan yang mengubah data justru berisiko ganda.
    err.dariServer = true;
    throw err;
  }
  return data ? data.result : null;
}

/** Panggil fungsi server dengan percobaan ulang otomatis (koneksi jaringan kadang gagal). */
async function gsRun(fn, ...args){
  const maxTry = 3;
  let lastErr;
  sesiHabis = false;
  for(let i=1; i<=maxTry; i++){
    try{
      return await gsCall(fn, args);
    }catch(err){
      lastErr = err;
      if(err.dariServer) break;   // penolakan atau galat isian: jawabannya tidak akan berubah
      if(sesiHabis) break;        // percuma diulang: user harus login dulu
      if(i < maxTry){
        if(fn === 'getAllData') toast(`Koneksi gagal, mencoba lagi (${i}/${maxTry-1})...`);
        await new Promise(r=>setTimeout(r, 1200 * i));
      }
    }
  }
  throw lastErr;
}
