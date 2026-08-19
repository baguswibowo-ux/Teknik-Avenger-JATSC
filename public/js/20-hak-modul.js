/* =======================================================================
   HAK MODUL — siapa boleh mengisi apa

   Tiga modul milik dashboard ini dijaga di sini: jadwal dinas, kegiatan
   berkala, dan data personel. Dulu hanya jadwal dinas yang punya penjagaan,
   dan bentuknya satu daftar nama — administrator menunjuk orang satu per satu.

   Itu tidak cukup begitu modulnya bertambah tiga. Yang ditanyakan di lapangan
   bukan "siapa namanya" melainkan "peran mana yang boleh": pejabat unit boleh
   mengatur jadwal dinas anak buahnya, teknisi tidak; data personel berhenti di
   administrator karena isinya nomor lisensi orang. Karena itu hak per peran
   yang jadi pokoknya, dan daftar nama tinggal sebagai pengecualian — satu-dua
   orang yang diberi hak di luar perannya.

   Administrator selalu boleh, di mana pun, dan tidak bisa dicabut dari layar
   ini. Kalau bisa, satu centang yang salah cukup untuk mengunci orang yang
   seharusnya membetulkannya.
   ======================================================================= */

const HAK_MODUL = ['dinas','berkala','personel','peralatan','sparepart','sejarah','dokumen','galeri'];
const HAK_PERAN = ['admin','pejabat','adminunit','pic','teknisi'];
const HAK_NAMA  = {
  dinas:     ['Jadwal Dinas','Duty Roster'],
  berkala:   ['Kegiatan Berkala','Recurring Jobs'],
  personel:  ['Data Personel','Personnel Records'],
  peralatan: ['Daftar Peralatan','Equipment List'],
  sparepart: ['Sparepart','Spare Parts'],
  sejarah:   ['Sejarah Peralatan','Equipment History'],
  dokumen:   ['Dokumen','Documents'],
  galeri:    ['Galeri Foto','Photo Gallery']
};

/* Peran yang boleh menghapus — sama persis dengan PERAN_HAPUS di server.js.
   Yang berlaku tetap keputusan server; ini hanya supaya tombol hapus tidak
   digambar untuk orang yang pasti ditolak begitu menekannya. */
const HAK_PERAN_HAPUS = ['admin','adminunit'];

/* Sama persis dengan HAK_BAWAAN di server.js. Disalin, bukan diambil dari sana:
   ia dipakai hakRapi() untuk melengkapi modul yang tidak disebut jawaban
   server, dan sebagai tebakan awal sebelum jawaban itu datang. Bawaan yang
   berbeda antara keduanya akan membuat modul yang sama terasa punya aturan
   yang berganti-ganti sendiri. */
const hakBawaan = () => ({
  dinas:     { peran:['admin','pejabat','adminunit'],                    petugas:[] },
  berkala:   { peran:['admin','pejabat','adminunit','pic','teknisi'],    petugas:[] },
  personel:  { peran:['admin','adminunit','pic','teknisi'],              petugas:[] },
  /* Daftar peralatan hanya administrator — alasannya ada di HAK_BAWAAN
     server.js: ia daftar induk yang ditunjuk modul lain lewat id. */
  peralatan: { peran:['admin'],                                          petugas:[] },
  sparepart: { peran:['admin','adminunit','pic','teknisi'],              petugas:[] },
  /* Sejarah alat dibuka sampai teknisi walau daftar alatnya tidak — yang
     menuliskan apa yang terjadi pada alat adalah yang berdinas di depannya.
     Alasan lengkapnya di HAK_BAWAAN server.js. */
  sejarah:   { peran:['admin','pejabat','adminunit','pic','teknisi'],     petugas:[] },
  dokumen:   { peran:['admin','adminunit','pic','teknisi'],              petugas:[] },
  galeri:    { peran:['admin','adminunit','pic','teknisi'],              petugas:[] }
});

let HAK = hakBawaan();
/** Hak akun yang sedang masuk, per modul. Diisi hakMuat(). */
const BOLEH = Object.fromEntries(HAK_MODUL.map(m=>[m, false]));
/** Boleh MENGHAPUS, per modul. Terpisah dari BOLEH karena yang boleh mengisi
    jauh lebih banyak daripada yang boleh menghapus. */
const BOLEH_HAPUS = Object.fromEntries(HAK_MODUL.map(m=>[m, false]));

/** Boleh menghapus di modul ini, menurut yang diketahui halaman. Tebakan awal
    saja; jawaban server menimpanya. */
const hakHapusHitung = (modul) =>
  !!akun && HAK_PERAN_HAPUS.includes(akun.role) && hakHitung(modul);

/**
 * Boleh menyunting database unit yang sedang dibuka?
 *
 * Dua syarat, dan keduanya perlu: modulnya memang dibuka untuk peran ini, DAN
 * unit yang sedang di layar memang dipegang akun ini. Yang kedua tidak bisa
 * disimpulkan dari yang pertama — hak modul berlaku untuk perannya, bukan
 * untuk satu unit tertentu.
 *
 * Ini soal tombol digambar atau tidak. Yang menolak sungguhan tetap server,
 * dan halaman tidak pernah jadi tempat penjagaannya.
 */
const bolehSuntingDb = (modul) => !!BOLEH[modul] && bolehBuka(unitDibuka);

function hakRapi(mentah){
  const bawaan = hakBawaan();
  const hasil = {};
  for(const m of HAK_MODUL){
    const a = (mentah && mentah[m]) || {};
    hasil[m] = {
      peran: [...new Set((Array.isArray(a.peran) ? a.peran : bawaan[m].peran)
        .map(p=>String(p||'').toLowerCase()).filter(p=>HAK_PERAN.includes(p)))],
      petugas: [...new Set((Array.isArray(a.petugas) ? a.petugas : [])
        .map(u=>String(u||'').trim().toLowerCase()).filter(Boolean))]
    };
  }
  return hasil;
}

/** Jawaban dari HAK yang sedang dipegang halaman. Yang berlaku tetap jawaban
    server; ini cuma untuk menggambar layar sebelum jawabannya datang. */
const hakHitung = (modul) => {
  if(!akun) return false;
  if(akun.role === 'admin') return true;
  const h = HAK[modul] || { peran:[], petugas:[] };
  return h.peran.includes(akun.role)
      || h.petugas.includes(String(akun.user || '').toLowerCase());
};

/** Kenapa tidak boleh, dalam satu kalimat yang bisa ditempel apa adanya. */
const hakSebab = (modul) => T(
  `Peran ${peranAkun()} belum diberi hak mengisi ${HAK_NAMA[modul][0]}.`,
  `The ${peranAkun()} role has not been given rights over ${HAK_NAMA[modul][1]}.`);

/**
 * Hak akun ini, dan — untuk administrator — seluruh isi berkas haknya.
 *
 * Satu permintaan untuk ketiga modul sekaligus: menanyakannya menjelang tiap
 * tombol digambar berarti tiga perjalanan bolak-balik tiap kali layar unit
 * berganti, dan jawabannya toh tidak berubah di tengah sesi.
 */
async function hakMuat(){
  try{
    const r = await srvFetch('/dinas/saya', {}, 8000);
    const j = await r.json().catch(()=>null);
    const bm = j && j.bolehModul;
    /* Bentuk jawabannya berubah: dulu satu boolean per modul, sekarang
       { isi, hapus }. Bentuk lama tetap dibaca supaya halaman ini tidak
       menuntut server yang sudah diperbarui — kalau dua sisi ini sempat
       berbeda versi, yang lama cuma kehilangan pemisahan hapusnya, bukan
       kehilangan seluruh haknya. */
    HAK_MODUL.forEach(m=>{
      const h = bm && bm[m];
      if(h && typeof h === 'object'){
        BOLEH[m] = !!h.isi;
        BOLEH_HAPUS[m] = !!h.hapus;
      }else{
        BOLEH[m] = h !== undefined ? !!h : !!(j && j.boleh);
        BOLEH_HAPUS[m] = BOLEH[m] && hakHapusHitung(m);
      }
    });
    JDW.bisaTulis = !j || j.bisaTulis !== false;
    if(!(j && j.user)){
      JDW.sebab = T('Sesi E-Logbook tidak terbaca dari sini.',
                    'Your E-Logbook session could not be read from here.');
    }else{
      JDW.sebab = hakSebab('dinas');
    }
  }catch(e){
    HAK_MODUL.forEach(m=>{ BOLEH[m] = false; BOLEH_HAPUS[m] = false; });
    JDW.sebab = T('Tidak bisa menanyakan hak ke server: ','Could not ask the server about permissions: ')
              + (e && e.message || e);
  }
  // Isi berkas haknya hanya dijawab untuk administrator; 403 di sini bukan
  // kesalahan, cuma berarti panel pengaturannya memang tidak untuk akun ini.
  if(akun && akun.role === 'admin'){
    try{
      const r = await srvFetch('/hak', {}, 8000);
      const j = await r.json().catch(()=>null);
      if(r.ok && j && j.hak) HAK = hakRapi(j.hak);
    }catch(e){ /* biarkan bawaan */ }
  }
}

async function hakSimpan(){
  const r = await srvFetch('/hak', {
    method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ hak: HAK })
  }, 10000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  if(j && j.hak) HAK = hakRapi(j.hak);
  // Hak akun sendiri ikut berubah kalau yang disunting perannya sendiri.
  await hakMuat();
}

