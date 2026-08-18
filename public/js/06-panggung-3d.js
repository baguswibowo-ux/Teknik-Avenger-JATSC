/* =======================================================================
   PANGGUNG LAYAR MASUK — bandara 3D, diterjemahkan dari cns-scene.js di
   proyek Claude Design "Animasi Bandara Soekarno Hatta 3D".

   Menggantikan bangunPemandangan() lama yang menggambar siluet menara dengan
   SVG dan CSS. Yang berubah dari berkas desain aslinya: di sana ia custom
   element yang hidup selama komponen terpasang; di sini gambarnya DIJEDA
   begitu layar masuk pergi, dan jalan lagi kalau pemakai keluar dari
   dashboard. Tanpa itu WebGL terus menggambar di balik aplikasi seumur
   halaman dibuka, dan kipas laptop yang menjelaskannya.
   ======================================================================= */
const KM_FASILITAS = [
  { id:'adc',  nama:'ADC TOWER',       kode:'TWR', pos:[-34,46,44],
    ket:'Aerodrome Control Tower. Pengendalian pergerakan pesawat di runway, taxiway dan udara sekitar bandara secara visual. Kabin dilengkapi Voice Communication Control System (VCCS) dan display data penerbangan.' },
  { id:'vhf',  nama:'VHF A/G',         kode:'COM', pos:[-14,30,56],
    ket:'Antena VHF Air/Ground 118–137 MHz. Kanal komunikasi suara antara pemandu lalu lintas udara dan pilot. Redundan main/standby dengan remote control & monitoring.' },
  { id:'dvor', nama:'DVOR / DME',      kode:'NAV', pos:[4,12,-74],
    ket:'Doppler VHF Omnidirectional Range + Distance Measuring Equipment. Memberi informasi azimuth dan jarak (slant range) ke pesawat sebagai acuan navigasi en-route dan approach.' },
  { id:'loc',  nama:'ILS LOCALIZER',   kode:'NAV', pos:[-152,9,0],
    ket:'Localizer array ILS. Memancarkan sinyal panduan lateral terhadap garis tengah runway untuk precision approach CAT I/II.' },
  { id:'gs',   nama:'ILS GLIDE PATH',  kode:'NAV', pos:[104,16,20],
    ket:'Glide Path antenna. Panduan sudut turun nominal 3° terhadap threshold runway, dipasangkan dengan localizer dan marker/DME.' },
  { id:'psr',  nama:'PSR / SSR',       kode:'SUR', pos:[64,34,62],
    ket:'Primary Surveillance Radar & Secondary Surveillance Radar Mode S. PSR mendeteksi echo primer, SSR menginterogasi transponder untuk identitas, altitude dan data Mode S.' },
  { id:'ads',  nama:'ADS-B STATION',   kode:'SUR', pos:[-84,24,60],
    ket:'Automatic Dependent Surveillance – Broadcast. Menerima posisi GNSS yang dipancarkan pesawat pada 1090 MHz ES, update rate ~1 detik.' },
  { id:'dp',   nama:'DATA PROCESSING', kode:'ATM', pos:[-64,20,96],
    ket:'Ruang Automation / Data Processing: Radar Data Processing (RDP), Flight Data Processing (FDP), multi-sensor tracker, recording & AFTN/AMHS message handling. Output disajikan ke ATC console.' }
];
const KM_SIMPUL = [-64,6,96];
const KM_W = { bg:0x080d12, tanah:0x0d151c, kisi:0x1b2b36, runway:0x171d23,
               logam:0x8f9aa6, sian:0x3fd6c8, kuning:0xf0b429, kaca:0x7fe3ff, putih:0xdfe7ee };
const kmDiam = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let kmPanggung = null;

function kmBangunPanggung(){
  const T = window.THREE;
  const wadah = document.getElementById('kmScene');
  const lapis = document.getElementById('kmLapis');
  const detail = document.getElementById('kmDetail');
  const tombolUlang = document.getElementById('kmUlangi');
  const w = wadah.clientWidth || 1200, h = wadah.clientHeight || 700;

  const renderer = new T.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  wadah.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color(KM_W.bg);
  scene.fog = new T.Fog(KM_W.bg, 380, 900);
  const camera = new T.PerspectiveCamera(38, w/h, 1, 3000);

  /* ---- orbit ---- */
  const bidik = new T.Vector3(-6, 12, 10);
  /* Kamera desainnya dipatok 330 dengan pitch rendah, untuk panggung selebar
     layar desktop. Di HP bingkainya tinggi-sempit dan bandara ini melebar, jadi
     sudut rendah cuma menghasilkan langit hitam. Yang menolong bukan mundur —
     kabut mulai di 380 dan semuanya jadi kelabu — melainkan menunduk. */
  let jarak, yaw, pitch, otomatis = !kmDiam;
  /* Posisi awalnya dihitung, bukan ditulis sekali di tempat: tombol PUTAR ULANG
     memanggil fungsi yang sama, dan lebar panggung bisa sudah berubah sejak
     halaman dibuka. */
  const kameraAwal = () => {
    const sempit = (wadah.clientWidth || w) < 700;
    jarak = sempit ? 320 : 330;
    yaw   = 0.85;
    pitch = sempit ? 0.72 : 0.42;
  };
  kameraAwal();
  const pasangKamera = () => {
    pitch = Math.max(0.08, Math.min(1.15, pitch));
    jarak = Math.max(120, Math.min(760, jarak));
    camera.position.set(
      bidik.x + jarak*Math.cos(pitch)*Math.sin(yaw),
      bidik.y + jarak*Math.sin(pitch),
      bidik.z + jarak*Math.cos(pitch)*Math.cos(yaw));
    camera.lookAt(bidik);
  };
  /* Kamera diserahkan ke pemakainya begitu ia benar-benar memutar panggung.
     Dulu ini terjadi di pointerdown, jadi satu klik saja — tanpa geser
     sedikit pun — sudah mematikan putaran otomatisnya, dan yang mengklik
     tidak merasa meminta apa-apa. */
  const hentiOtomatis = () => {
    if(!otomatis) return;
    otomatis = false;
    tombolUlang.classList.add('km-perlu');
  };
  let seret = null;
  const kanvas = renderer.domElement;
  kanvas.addEventListener('pointerdown', e=>{
    seret = { x:e.clientX, y:e.clientY };
    wadah.classList.add('km-geser'); kanvas.setPointerCapture(e.pointerId);
  });
  kanvas.addEventListener('pointermove', e=>{
    if(!seret) return;
    hentiOtomatis();
    yaw   -= (e.clientX - seret.x) * 0.005;
    pitch += (e.clientY - seret.y) * 0.004;
    seret = { x:e.clientX, y:e.clientY };
    pasangKamera(); if(kmDiam) gambarSekali();
  });
  const lepas = () => { seret = null; wadah.classList.remove('km-geser'); };
  kanvas.addEventListener('pointerup', lepas);
  kanvas.addEventListener('pointercancel', lepas);
  kanvas.addEventListener('wheel', e=>{
    e.preventDefault(); hentiOtomatis();
    jarak *= 1 + Math.sign(e.deltaY)*0.08;
    pasangKamera(); if(kmDiam) gambarSekali();
  }, { passive:false });

  /* ---- cahaya ---- */
  scene.add(new T.HemisphereLight(0x2a4356, 0x05080b, 0.85));
  const surya = new T.DirectionalLight(0xbcd4e6, 1.15);
  surya.position.set(-160, 220, 180);
  surya.castShadow = true;
  surya.shadow.mapSize.set(2048, 2048);
  const sc = surya.shadow.camera;
  sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.far = 800;
  scene.add(surya);
  const isian = new T.DirectionalLight(0x2f6f80, 0.45);
  isian.position.set(200, 90, -160); scene.add(isian);

  const bahan = (c, o) => new T.MeshStandardMaterial(Object.assign({ color:c, roughness:0.72, metalness:0.15 }, o||{}));
  const nyala = (c, o) => new T.MeshBasicMaterial({ color:c, transparent:true, opacity: o==null ? 0.85 : o });

  /* ---- tanah, kisi, runway, taxiway ---- */
  const tanah = new T.Mesh(new T.PlaneGeometry(1800,1800), bahan(KM_W.tanah,{roughness:0.95,metalness:0}));
  tanah.rotation.x = -Math.PI/2; tanah.receiveShadow = true; scene.add(tanah);
  const kisi = new T.GridHelper(1600, 64, KM_W.kisi, 0x121c24);
  kisi.position.y = 0.05; kisi.material.transparent = true; kisi.material.opacity = 0.4; scene.add(kisi);

  const runway = new T.Mesh(new T.PlaneGeometry(360,26), bahan(KM_W.runway,{roughness:0.9,metalness:0}));
  runway.rotation.x = -Math.PI/2; runway.position.set(0,0.12,0); runway.receiveShadow = true; scene.add(runway);
  const bahu = new T.Mesh(new T.PlaneGeometry(360,34), bahan(0x121a21,{roughness:1,metalness:0}));
  bahu.rotation.x = -Math.PI/2; bahu.position.set(0,0.08,0); scene.add(bahu);
  for(let x=-168; x<=168; x+=24){
    const d = new T.Mesh(new T.PlaneGeometry(12,1.1), nyala(KM_W.putih,0.5));
    d.rotation.x = -Math.PI/2; d.position.set(x,0.2,0); scene.add(d);
  }
  for(const sisi of [-1,1]){
    const tepi = new T.Mesh(new T.PlaneGeometry(360,0.8), nyala(0x9fb4c4,0.35));
    tepi.rotation.x = -Math.PI/2; tepi.position.set(0,0.2,sisi*12.4); scene.add(tepi);
  }
  const taxi = new T.Mesh(new T.PlaneGeometry(300,14), bahan(0x151d24,{roughness:0.95,metalness:0}));
  taxi.rotation.x = -Math.PI/2; taxi.position.set(-10,0.1,34); scene.add(taxi);
  for(let x=-150; x<=140; x+=10){
    const d = new T.Mesh(new T.PlaneGeometry(6,0.6), nyala(KM_W.kuning,0.4));
    d.rotation.x = -Math.PI/2; d.position.set(x-10,0.18,34); scene.add(d);
  }
  const lampuRunway = [];
  for(let i=0; i<22; i++){
    const s = new T.Mesh(new T.SphereGeometry(0.9,8,8), nyala(i<8 ? KM_W.kuning : 0xffffff, 0.9));
    s.position.set(140 + i*14, 1.2, 0); scene.add(s); lampuRunway.push(s);
  }
  for(const sisi of [-1,1]){
    for(let i=0; i<8; i++){
      const s = new T.Mesh(new T.SphereGeometry(0.8,8,8), nyala(0x66ff99,0.9));
      s.position.set(132, 1.2, sisi*(2 + i*1.6)); scene.add(s);
    }
  }

  /* ---- menara ADC ---- */
  const menara = new T.Group(); menara.position.set(-34,0,44);
  const kakiM = new T.Mesh(new T.BoxGeometry(26,7,20), bahan(0x232b33));
  kakiM.position.y = 3.5; kakiM.castShadow = true; kakiM.receiveShadow = true; menara.add(kakiM);
  const batang = new T.Mesh(new T.CylinderGeometry(4.6,6.6,34,16), bahan(0x3d464f,{roughness:0.6}));
  batang.position.y = 24; batang.castShadow = true; menara.add(batang);
  for(let i=0; i<5; i++){
    const r = new T.Mesh(new T.TorusGeometry(5.3 - i*0.35, 0.28, 8, 24), bahan(0x596570,{metalness:0.5}));
    r.rotation.x = Math.PI/2; r.position.y = 12 + i*6; menara.add(r);
  }
  const dek = new T.Mesh(new T.CylinderGeometry(11,9,2.4,16), bahan(0x2b333c));
  dek.position.y = 41; dek.castShadow = true; menara.add(dek);
  const kabin = new T.Mesh(new T.CylinderGeometry(10.2,11.4,9,16),
    new T.MeshPhysicalMaterial({ color:KM_W.kaca, transparent:true, opacity:0.35,
      roughness:0.08, metalness:0.1, emissive:0x1d6f80, emissiveIntensity:0.6 }));
  kabin.position.y = 46.6; menara.add(kabin);
  const atapM = new T.Mesh(new T.CylinderGeometry(12.4,11.6,1.8,16), bahan(0x1e262e));
  atapM.position.y = 51.8; atapM.castShadow = true; menara.add(atapM);
  const lampuKabin = new T.PointLight(0x8ff0ff, 0.9, 90); lampuKabin.position.y = 46; menara.add(lampuKabin);
  const tiangM = new T.Mesh(new T.CylinderGeometry(0.5,0.7,16,8), bahan(KM_W.logam,{metalness:0.6}));
  tiangM.position.y = 60; menara.add(tiangM);
  const suar = new T.Mesh(new T.SphereGeometry(1.5,12,12), nyala(KM_W.kuning,1));
  suar.position.y = 69; menara.add(suar);
  scene.add(menara);

  /* ---- tiang VHF A/G ---- */
  const vhf = new T.Group(); vhf.position.set(-14,0,56);
  const vTiang = new T.Mesh(new T.CylinderGeometry(0.55,0.8,30,8), bahan(KM_W.logam,{metalness:0.55}));
  vTiang.position.y = 15; vTiang.castShadow = true; vhf.add(vTiang);
  for(let i=0; i<4; i++){
    const lengan = new T.Mesh(new T.BoxGeometry(7,0.3,0.3), bahan(0xa7b3bf,{metalness:0.6}));
    lengan.position.y = 12 + i*5; lengan.rotation.y = i*0.8; vhf.add(lengan);
    const dipol = new T.Mesh(new T.CylinderGeometry(0.22,0.22,4.5,6), bahan(0xc3ccd6,{metalness:0.6}));
    dipol.position.set(3.2*Math.cos(i*0.8), 12 + i*5, -3.2*Math.sin(i*0.8)); vhf.add(dipol);
  }
  scene.add(vhf);

  /* ---- DVOR / DME ---- */
  const dvor = new T.Group(); dvor.position.set(4,0,-74);
  const piring = new T.Mesh(new T.CylinderGeometry(15,15,0.9,32), bahan(0x39424b,{metalness:0.4}));
  piring.position.y = 7; piring.castShadow = true; dvor.add(piring);
  for(let i=0; i<8; i++){
    const k = new T.Mesh(new T.CylinderGeometry(0.4,0.4,7,6), bahan(0x4c565f));
    k.position.set(11*Math.cos(i*Math.PI/4), 3.5, 11*Math.sin(i*Math.PI/4)); dvor.add(k);
  }
  for(let i=0; i<24; i++){
    const sisi = new T.Mesh(new T.BoxGeometry(1.6,2.2,0.6), bahan(0x6d7986,{metalness:0.5}));
    const a = i*Math.PI/12;
    sisi.position.set(14*Math.cos(a), 8.6, 14*Math.sin(a)); sisi.rotation.y = -a; dvor.add(sisi);
  }
  const radome = new T.Mesh(new T.ConeGeometry(4.6,8,20), bahan(0xe4e9ee,{roughness:0.5}));
  radome.position.y = 12; radome.castShadow = true; dvor.add(radome);
  const dmeRumah = new T.Mesh(new T.BoxGeometry(9,4.5,7), bahan(0x2f373f));
  dmeRumah.position.set(22,2.3,6); dmeRumah.castShadow = true; dvor.add(dmeRumah);
  const dmeAntena = new T.Mesh(new T.CylinderGeometry(0.9,0.9,9,10), bahan(0xc9d2da,{metalness:0.5}));
  dmeAntena.position.set(22,9,6); dvor.add(dmeAntena);
  scene.add(dvor);

  /* ---- ILS localizer ---- */
  const loc = new T.Group(); loc.position.set(-152,0,0);
  for(let i=-6; i<=6; i++){
    const p = new T.Mesh(new T.CylinderGeometry(0.35,0.35,6,6), bahan(0x545e68));
    p.position.set(0,3,i*3.4); loc.add(p);
    const d = new T.Mesh(new T.BoxGeometry(0.5,1.4,2.6), bahan(0xd6dee6,{metalness:0.4}));
    d.position.set(0,6.6,i*3.4); d.castShadow = true; loc.add(d);
  }
  const locBar = new T.Mesh(new T.BoxGeometry(0.4,0.4,44), bahan(0x8b96a2,{metalness:0.6}));
  locBar.position.y = 7.6; loc.add(locBar);
  scene.add(loc);

  /* ---- ILS glide path ---- */
  const gp = new T.Group(); gp.position.set(104,0,20);
  const gpTiang = new T.Mesh(new T.CylinderGeometry(0.6,0.9,14,8), bahan(KM_W.logam,{metalness:0.5}));
  gpTiang.position.y = 7; gpTiang.castShadow = true; gp.add(gpTiang);
  for(let i=0; i<3; i++){
    const d = new T.Mesh(new T.BoxGeometry(2.6,1.2,0.5), bahan(0xdfe6ec,{metalness:0.4}));
    d.position.set(1.6, 4 + i*4.4, 0); gp.add(d);
  }
  const gpRumah = new T.Mesh(new T.BoxGeometry(7,4,6), bahan(0x2f373f));
  gpRumah.position.set(-8,2,3); gpRumah.castShadow = true; gp.add(gpRumah);
  scene.add(gp);

  /* ---- PSR / SSR ---- */
  const radar = new T.Group(); radar.position.set(64,0,62);
  const rKaki = new T.Mesh(new T.BoxGeometry(14,10,14), bahan(0x252d35));
  rKaki.position.y = 5; rKaki.castShadow = true; radar.add(rKaki);
  const rMenara = new T.Mesh(new T.CylinderGeometry(2.4,3.6,20,12), bahan(0x3f4851));
  rMenara.position.y = 20; rMenara.castShadow = true; radar.add(rMenara);
  const rKepala = new T.Group(); rKepala.position.y = 31;
  rKepala.add(new T.Mesh(new T.CylinderGeometry(3.2,3.6,4,12), bahan(0x555f69,{metalness:0.5})));
  const psrPiring = new T.Mesh(new T.BoxGeometry(2,9,26), bahan(0xb9c3cd,{metalness:0.6,roughness:0.45}));
  psrPiring.position.set(0,5,0); psrPiring.castShadow = true; rKepala.add(psrPiring);
  const ssrBatang = new T.Mesh(new T.BoxGeometry(1.2,1.6,22), bahan(0xe2e8ee,{metalness:0.5}));
  ssrBatang.position.set(0,10.4,0); rKepala.add(ssrBatang);
  radar.add(rKepala);
  const sapuan = new T.Mesh(new T.CircleGeometry(150,40,0,0.5),
    new T.MeshBasicMaterial({ color:KM_W.sian, transparent:true, opacity:0.1, side:T.DoubleSide, depthWrite:false }));
  sapuan.rotation.x = -Math.PI/2; sapuan.position.y = 0.35; radar.add(sapuan);
  for(const r of [50,100,150]){
    const cincin = new T.Mesh(new T.RingGeometry(r-0.5, r, 96),
      new T.MeshBasicMaterial({ color:KM_W.sian, transparent:true, opacity:0.12, side:T.DoubleSide, depthWrite:false }));
    cincin.rotation.x = -Math.PI/2; cincin.position.y = 0.3; radar.add(cincin);
  }
  scene.add(radar);

  /* ---- stasiun ADS-B ---- */
  const ads = new T.Group(); ads.position.set(-84,0,60);
  const aTiang = new T.Mesh(new T.CylinderGeometry(0.45,0.7,22,8), bahan(KM_W.logam,{metalness:0.55}));
  aTiang.position.y = 11; aTiang.castShadow = true; ads.add(aTiang);
  const aAntena = new T.Mesh(new T.CylinderGeometry(0.9,0.9,7,10), bahan(0xf1f5f8,{roughness:0.5}));
  aAntena.position.y = 24; ads.add(aAntena);
  const aRumah = new T.Mesh(new T.BoxGeometry(6,3.6,5), bahan(0x2c343c));
  aRumah.position.set(6,1.8,2); aRumah.castShadow = true; ads.add(aRumah);
  const panelSurya = new T.Mesh(new T.BoxGeometry(7,0.3,4), bahan(0x16324a,{metalness:0.6,roughness:0.3}));
  panelSurya.position.set(6,4,2); panelSurya.rotation.z = 0.18; ads.add(panelSurya);
  scene.add(ads);

  /* ---- gedung data processing ---- */
  const dp = new T.Group(); dp.position.set(-64,0,96);
  const badanDp = new T.Mesh(new T.BoxGeometry(52,15,30), bahan(0x222a32));
  badanDp.position.y = 7.5; badanDp.castShadow = true; badanDp.receiveShadow = true; dp.add(badanDp);
  const atapDp = new T.Mesh(new T.BoxGeometry(55,1.4,33), bahan(0x1a2128));
  atapDp.position.y = 15.6; dp.add(atapDp);
  for(let i=0; i<9; i++){
    for(let r=0; r<2; r++){
      const jendela = new T.Mesh(new T.PlaneGeometry(3.6,3), nyala(0x63e0ff,0.55));
      jendela.position.set(-22 + i*5.5, 5 + r*6, 15.1); dp.add(jendela);
    }
  }
  const pendingin = new T.Mesh(new T.BoxGeometry(10,3,8), bahan(0x39424b));
  pendingin.position.set(16,17.5,0); dp.add(pendingin);
  const lampuDp = new T.PointLight(0x4fd0ff, 0.7, 70);
  lampuDp.position.set(0,12,20); dp.add(lampuDp);
  scene.add(dp);

  /* ---- tautan data: tiap fasilitas mengalir ke ruang processing ---- */
  const tautan = [];
  const simpul = new T.Vector3(KM_SIMPUL[0], KM_SIMPUL[1], KM_SIMPUL[2]);
  KM_FASILITAS.filter(f => f.id !== 'dp').forEach((f,i)=>{
    const dari = new T.Vector3(f.pos[0], Math.max(6, f.pos[1]*0.5), f.pos[2]);
    const tengah = dari.clone().add(simpul).multiplyScalar(0.5);
    tengah.y += dari.distanceTo(simpul)*0.18 + 10;
    const lengkung = new T.QuadraticBezierCurve3(dari, tengah, simpul);
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(lengkung.getPoints(48)),
      new T.LineBasicMaterial({ color:KM_W.sian, transparent:true, opacity:0.18 })));
    const denyut = [];
    for(let p=0; p<3; p++){
      const s = new T.Mesh(new T.SphereGeometry(1.15,8,8), nyala(KM_W.sian,0.95));
      scene.add(s); denyut.push({ mesh:s, geser:p/3 + i*0.11 });
    }
    tautan.push({ lengkung, denyut });
  });

  /* ---- berkas ILS ---- */
  const berkasIls = new T.Mesh(new T.ConeGeometry(26,300,4,1,true),
    new T.MeshBasicMaterial({ color:KM_W.kuning, transparent:true, opacity:0.06, side:T.DoubleSide, depthWrite:false }));
  berkasIls.rotation.z = -Math.PI/2; berkasIls.rotation.y = Math.PI/4;
  berkasIls.position.set(0,26,0); scene.add(berkasIls);

  /* ---- pesawat ---- */
  function buatPesawat(skala, warna){
    const g = new T.Group();
    const kulit = bahan(0xeef2f6, { roughness:0.45, metalness:0.2 });
    const badanP = new T.Mesh(new T.CapsuleGeometry(2.3,22,8,16), kulit);
    badanP.rotation.z = Math.PI/2; badanP.castShadow = true; g.add(badanP);
    const hidung = new T.Mesh(new T.ConeGeometry(2.3,5,16), kulit);
    hidung.rotation.z = -Math.PI/2; hidung.position.x = -15.5; g.add(hidung);
    const garis = new T.Mesh(new T.BoxGeometry(24,1.1,0.2), nyala(warna,0.9));
    garis.position.set(0,0.6,2.35); g.add(garis);
    const garis2 = garis.clone(); garis2.position.z = -2.35; g.add(garis2);
    const sayap = new T.Mesh(new T.BoxGeometry(6.5,0.7,34), bahan(0xdde4ea,{roughness:0.5}));
    sayap.position.set(1,-0.4,0); sayap.castShadow = true; g.add(sayap);
    const ujungKi = new T.Mesh(new T.BoxGeometry(3,2.4,0.7), bahan(0xdde4ea));
    ujungKi.position.set(2.4,0.6,17); g.add(ujungKi);
    const ujungKa = ujungKi.clone(); ujungKa.position.z = -17; g.add(ujungKa);
    for(const z of [-9,9]){
      const mesin = new T.Mesh(new T.CylinderGeometry(1.7,1.5,5.5,14), bahan(0xb9c2cb,{metalness:0.5}));
      mesin.rotation.z = Math.PI/2; mesin.position.set(-1.5,-2.1,z); mesin.castShadow = true; g.add(mesin);
    }
    const sirip = new T.Mesh(new T.BoxGeometry(6,9,0.6), bahan(warna,{roughness:0.5}));
    sirip.position.set(12.5,5.2,0); sirip.castShadow = true; g.add(sirip);
    const stabil = new T.Mesh(new T.BoxGeometry(4.2,0.5,14), bahan(0xdde4ea));
    stabil.position.set(13,0.6,0); g.add(stabil);
    const navKi = new T.Mesh(new T.SphereGeometry(0.6,8,8), nyala(0xff4d4d,1));
    navKi.position.set(2.4,0.6,18.4); g.add(navKi);
    const navKa = new T.Mesh(new T.SphereGeometry(0.6,8,8), nyala(0x4dff87,1));
    navKa.position.set(2.4,0.6,-18.4); g.add(navKa);
    const kilat = new T.Mesh(new T.SphereGeometry(0.7,8,8), nyala(0xffffff,1));
    kilat.position.set(15.5,5.2,0); g.add(kilat);
    g.scale.setScalar(skala);
    g.userData = { kilat };
    return g;
  }
  const datang  = buatPesawat(1,    0x2f6fb5); scene.add(datang);
  const taxiing = buatPesawat(0.85, 0xc23a3a); taxiing.rotation.y = Math.PI; scene.add(taxiing);
  const lintas  = buatPesawat(1.1,  0x2c7a5b); scene.add(lintas);

  const cincinTrack = new T.Mesh(new T.RingGeometry(6,7,40),
    new T.MeshBasicMaterial({ color:KM_W.sian, transparent:true, opacity:0.5, side:T.DoubleSide, depthWrite:false }));
  cincinTrack.rotation.x = -Math.PI/2; cincinTrack.position.y = 0.5; scene.add(cincinTrack);

  /* ---- label fasilitas ---- */
  const labelEl = {};
  const pilihFasilitas = (f) => {
    detail.style.display = 'block';
    detail.querySelector('.km-kode').textContent = f.kode;
    detail.querySelector('h4').textContent = f.nama;
    detail.querySelector('p').textContent = f.ket;
  };
  KM_FASILITAS.forEach(f=>{
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'km-chip';
    chip.innerHTML = '<i></i>' + f.nama + '<em>' + f.kode + '</em>';
    chip.addEventListener('click', ()=>pilihFasilitas(f));
    lapis.appendChild(chip);
    labelEl[f.id] = { el:chip, v:new T.Vector3(f.pos[0], f.pos[1], f.pos[2]) };
  });
  pilihFasilitas(KM_FASILITAS[0]);

  const labelPesawat = document.createElement('div');
  labelPesawat.className = 'km-label-pesawat';
  lapis.appendChild(labelPesawat);

  /* ---- gerak ---- */
  const jam = new T.Clock();
  let waktu = 0, kirimTerakhir = -1;
  const v = new T.Vector3();
  const proyeksi = (vek, node, sela) => {
    v.copy(vek).project(camera);
    const nx = v.x*0.5 + 0.5, ny = -v.y*0.5 + 0.5;
    const m = sela == null ? 0.02 : sela;
    const tampak = v.z < 1 && nx > m && nx < 1-m && ny > m && ny < 1-m;
    node.style.opacity = tampak ? '1' : '0';
    node.style.visibility = tampak ? 'visible' : 'hidden';
    node.style.left = (nx*100) + '%';
    node.style.top  = (ny*100) + '%';
    return tampak;
  };
  pasangKamera();

  /* Satu putaran = satu kedatangan penuh: final approach, touchdown, lalu
     vacating ke apron. Angka di rel kanan diambil dari perhitungan yang sama,
     jadi yang terbaca di panel memang yang sedang terlihat di panggung. */
  function majuAdegan(dt){
    waktu += dt;
    if(otomatis){ yaw += dt*0.035; pasangKamera(); }

    rKepala.rotation.y += dt*1.2;
    sapuan.rotation.z  -= dt*1.2;
    suar.material.opacity = 0.35 + 0.65*Math.abs(Math.sin(waktu*2.4));
    lampuKabin.intensity  = 0.75 + 0.2*Math.sin(waktu*1.3);
    lampuRunway.forEach((s,i)=>{ s.material.opacity = 0.35 + 0.65*Math.max(0, Math.sin(waktu*3 - i*0.45)); });

    tautan.forEach(({lengkung,denyut})=>{
      denyut.forEach(p=>{
        const u = (waktu*0.18 + p.geser) % 1;
        p.mesh.position.copy(lengkung.getPoint(u));
        p.mesh.material.opacity = 0.25 + 0.75*Math.sin(u*Math.PI);
      });
    });

    const putaran = 26, t = (waktu % putaran)/putaran;
    let ax, ay, fase, gsNilai;
    if(t < 0.62){
      const u = t/0.62;
      ax = 460 - u*370; ay = 3 + (1-u)*(1-u)*88;
      fase = 'FINAL APPROACH · ILS RWY 25L'; gsNilai = 152 - u*12;
    } else if(t < 0.72){
      const u = (t-0.62)/0.1;
      ax = 90 - u*90; ay = 3 - u*0.6;
      fase = 'TOUCHDOWN · ROLLOUT'; gsNilai = 140 - u*60;
    } else {
      const u = (t-0.72)/0.28;
      ax = 0 - u*150; ay = 2.4;
      fase = 'VACATING · TWY TO APRON'; gsNilai = 80 - u*68;
    }
    datang.position.set(ax, ay + 2.4, 0);
    datang.rotation.z = t < 0.62 ? 0.045 : 0;
    datang.userData.kilat.material.opacity = (waktu*3) % 1 < 0.12 ? 1 : 0.05;
    cincinTrack.position.set(ax, 0.5, 0);
    cincinTrack.scale.setScalar(1 + 0.25*Math.sin(waktu*3));

    const tt = (waktu % 40)/40;
    taxiing.position.set(-140 + tt*250, 2.2, 34);
    taxiing.rotation.y = Math.PI;
    taxiing.userData.kilat.material.opacity = 0.15;

    const et = (waktu % 34)/34;
    lintas.position.set(-320 + et*660, 175, -240 + et*90);
    lintas.rotation.y = Math.PI + 0.22;
    lintas.userData.kilat.material.opacity = (waktu*2.6) % 1 < 0.1 ? 1 : 0.05;

    const ketinggian = Math.round(ay*34 + 45);
    labelPesawat.textContent = 'GIA 652 · A333\n' + fase +
      '\nGS ' + Math.round(gsNilai) + ' kt   ALT ' + ketinggian + ' ft';
    if(waktu - kirimTerakhir > 0.5){
      kirimTerakhir = waktu;
      document.getElementById('kmFase').textContent = fase;
      document.getElementById('kmGs').textContent = Math.round(gsNilai) + ' kt';
      document.getElementById('kmAlt').textContent = ketinggian + ' ft';
    }
  }

  /* Label ditata setelah kamera bergerak: yang bertumpuk digeser ke atas, dan
     di panggung sempit semuanya disembunyikan — di lebar itu label lebih banyak
     menutupi bandara daripada menjelaskannya. */
  function tataLabel(){
    const sempit = wadah.clientWidth < 600;
    const sudah = [];
    for(const id in labelEl){
      const L = labelEl[id];
      if(sempit){ L.el.style.visibility = 'hidden'; L.el.style.opacity = '0'; continue; }
      if(!proyeksi(L.v, L.el, 0.06)) continue;
      const px = parseFloat(L.el.style.left) * wadah.clientWidth / 100;
      const py = parseFloat(L.el.style.top)  * wadah.clientHeight / 100;
      let geser = 0;
      for(const p of sudah){
        if(Math.abs(p.x - px) < 130 && Math.abs(p.y - (py + geser)) < 24) geser -= 24;
      }
      sudah.push({ x:px, y:py + geser });
      L.el.style.transform = 'translate(-50%,-100%) translateY(' + geser + 'px)';
    }
    v.copy(datang.position); v.y += 12;
    proyeksi(v, labelPesawat);
  }

  /* Digambar dulu, labelnya menyusul. tataLabel() memproyeksikan lewat
     camera.matrixWorldInverse, dan yang menyegarkan matriks itu render() —
     jadi label yang ditata lebih dulu selalu memakai kamera sebelumnya. Di
     loop 60fps selisih satu gambar tidak terlihat, tapi gambarSekali() dipakai
     justru di tempat yang tidak ada gambar berikutnya: setelah resize dan
     setelah PUTAR ULANG dalam mode hemat gerak. */
  function gambarSekali(){ renderer.render(scene, camera); tataLabel(); }

  let raf = 0, jalan = false;
  const gerak = () => {
    raf = requestAnimationFrame(gerak);
    majuAdegan(Math.min(jam.getDelta(), 0.05));
    tataLabel();
    renderer.render(scene, camera);
  };

  new ResizeObserver(()=>{
    const lw = wadah.clientWidth, lh = wadah.clientHeight;
    if(!lw || !lh) return;
    camera.aspect = lw/lh; camera.updateProjectionMatrix();
    renderer.setSize(lw, lh);
    if(!jalan) gambarSekali();
  }).observe(wadah);

  /* Diberi nama, bukan dikembalikan sebagai objek anonim: ulangi() memanggil
     jalankan(), dan `this` di dalam objek literal ikut ke mana pun metodenya
     dipegang orang. */
  const kendali = {
    jalankan(){
      if(jalan) return;
      jalan = true;
      if(kmDiam){ jalan = false; majuAdegan(0); gambarSekali(); return; }
      jam.getDelta();          // buang selisih waktu selama dijeda
      gerak();
    },
    jeda(){ jalan = false; cancelAnimationFrame(raf); },
    /* Seluruh panggung dikembalikan ke keadaan sesaat setelah halaman dibuka:
       kamera di sudut awalnya, putaran otomatis hidup lagi, dan kedatangan
       GIA 652 dimulai ulang dari final approach. Cukup mengatur ulang angka —
       geometri, cahaya, dan renderer-nya tidak perlu dibangun ulang, dan itu
       yang membuatnya tidak perlu menyegarkan halaman. */
    ulangi(){
      kameraAwal();
      pasangKamera();
      otomatis = !kmDiam;
      tombolUlang.classList.remove('km-perlu');
      waktu = 0; kirimTerakhir = -1;
      // Loop yang sudah jalan menggambar sendiri; yang dijeda dinyalakan, dan
      // dalam mode hemat gerak jalankan() menggambar sekali lalu berhenti lagi.
      if(jalan) gambarSekali(); else kendali.jalankan();
    }
  };
  return kendali;
}

/* Blok SESI di rel kiri mengikuti kolom username, jadi sebelum menekan Masuk
   pun sudah terlihat akun mana yang akan dipakai dan perannya apa. Dalam mode
   server yang ditampilkan sesi E-Logbook yang sebenarnya, bukan akun contoh —
   dua daftar akun yang berbeda tidak boleh tercampur di satu tempat. */
function kmSegarkanSesi(){
  const u = el('iUser').value.trim().toLowerCase();
  let a = null, sumber = '';
  if(SRV.mode === 'server'){
    if(SRV.sesi && SRV.sesi.username.toLowerCase() === u){
      a = { nama: SRV.sesi.nama || SRV.sesi.username,
            peran: PERAN_SERVER[SRV.sesi.role] || SRV.sesi.role || 'Pengguna' };
      sumber = 'SESI SERVER AKTIF';
    }
  }else{
    const c = akunContohMuat().find(x=>x.username.toLowerCase() === u);
    if(c){
      a = { nama: c.nama || c.username, peran: c.peran || PERAN_SERVER[c.role] || c.role || 'Pengguna' };
      sumber = c.aktif ? 'SIAP MASUK · TEKAN MASUK' : 'AKUN NONAKTIF · TIDAK BISA MASUK';
    }
  }
  el('kmSesi').classList.toggle('km-siap', !!a);
  el('kmSesiInisial').textContent = a ? inisial(a.nama) : '—';
  el('kmSesiNama').textContent    = a ? a.nama.toUpperCase() : 'BELUM LOGIN';
  el('kmSesiPeran').textContent   = a ? a.peran.toUpperCase() : 'KLIK UNTUK MASUK ATAU DAFTAR';
  el('kmSesiKet').textContent     = a ? sumber : 'AKSES TERBATAS · READ ONLY';
}

/* Buka/tutup kartu masuk. Selama tertutup panggung 3D-nya tidak tertutupi
   apa-apa, dan itu keadaan awalnya. */
function kmSetMasuk(buka){
  el('kmLapisMasuk').classList.toggle('km-buka', buka);
  if(buka){
    (KM_TAB === 'daftar' ? el('dfNama') : el('iUser')).focus();
    // Sesinya ditanyakan ulang tiap kartu dibuka. Lihat srvSegarkanSesi().
    srvSegarkanSesi();
  }
  else document.activeElement?.blur?.();   // fokus tidak boleh tertinggal di kartu yang sudah tak terlihat
}

