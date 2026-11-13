// ===== STATE =====
let API='/api',data=null,parts=[],wins=[],spinning=false,rot=0,sound=true,editIdx=-1;
let currentId=null,logoDataUrl=null,isPlaying=false;
window.wheelBgImage=null; // v12.44.821: imagen de fondo como propiedad de window (binding fiable)
// v12.44.821 (orden del dueño): SIN pesos — la ruleta siempre es simétrica.
// snapshot previo al primer giro — el reset (↻) devuelve la ruleta a ese estado,
// igual que AppSorteos ("volver al estado previo al primer giro")
let preSpinParts=null,preSpinWins=0;
let segCs=['#ff7878','#7eecec','#fff171','#7280fd'];
const cv=document.getElementById('canvas'),cx=cv.getContext('2d');
const themes=[
{name:'Clásica (original)',colors:['#6366F1','#22D3EE','#FDE047','#FB7185','#A78BFA','#34D399','#FB923C','#F472B6']},
{name:'Marino & Oro',colors:['#0A2540','#C9A227','#1B3A5C','#E4D5A2','#13294B','#B08D2E','#0F3460','#D9C5A2']},
{name:'Ejecutivo Azul',colors:['#16324F','#4A7BA6','#88B0CC','#C5D5E5','#2B4570','#6E93B8','#A9C4E0','#3E5F8A']},
{name:'Burdeos & Dorado',colors:['#6E1423','#C9A227','#8C2733','#D4AF37','#5C0E1E','#B08D2E','#A34452','#E8C766']},
{name:'Verde Corporativo',colors:['#14532D','#2E7D5B','#6FA287','#B7CFC0','#1D6A4F','#52796F','#84A98C','#2C4A3B']},
{name:'Grafito',colors:['#263238','#546E7A','#90A4AE','#CFD8DC','#37474F','#607D8B','#B0BEC5','#78909C']},
{name:'Acero & Cian',colors:['#37474F','#00ACC1','#455A64','#26C6DA','#263238','#0097A7','#607D8B','#80DEEA']},
{name:'Denim',colors:['#1B263B','#415A77','#778DA9','#E0E1DD','#2C4160','#5B7BA0','#A3B8CC','#334E75']},
{name:'Esmeralda',colors:['#0B6E4F','#6FC2B0','#084B3C','#0FA3B1','#14919B','#B4E6D9','#1D5C63','#8FD5CC']},
{name:'Ciruela',colors:['#5D3A6E','#B9A4CE','#2E1A47','#8B6FA8','#6B4C9A','#D3C4E8','#4A2C6E','#C4B0DE']},
{name:'Tierra',colors:['#606C38','#DDA15E','#283618','#BC6C25','#7F5539','#B08968','#3A5A40','#9C6644']},
{name:'Petróleo',colors:['#0B3C49','#14919B','#0B5B6E','#6FC2B0','#0D7A8C','#B4E6D9','#0F6B7A','#9AD1CB']},
{name:'Vino & Arena',colors:['#6E1423','#D9C5A0','#4A1220','#E4D5A2','#8C2733','#B08968','#5C0E1E','#C4A96A']},
{name:'Mostaza & Pizarra',colors:['#B08D2E','#343A40','#C9A227','#495057','#8C7321','#212529','#D4B45A','#6C757D']},
{name:'Real Púrpura',colors:['#3B1F5C','#8B6FA8','#2E1A47','#B9A4CE','#5D3A6E','#D3C4E8','#4A2C6E','#C4B0DE']},
{name:'Tech Azul',colors:['#0D47A1','#42A5F5','#1565C0','#90CAF9','#0B5394','#64B5F6','#1976D2','#BBDEFB']},
{name:'Arena & Acero',colors:['#8D99AE','#2B2D42','#EDF2F4','#CCD5E0','#5C6B8A','#D8DEE9','#40506E','#B4C0D8']},
{name:'Café Corporativo',colors:['#4B2E2B','#8D6E63','#A1887F','#D7CCC8','#5D4037','#BCAAA4','#3E2723','#E0D7D0']},
{name:'Azul Noche',colors:['#0F3460','#16213E','#1A1A2E','#533483','#0A1931','#3E5C94','#232D4E','#4A6FA5']},
{name:'Coral Ejecutivo',colors:['#C05C3E','#2B4570','#B08D2E','#0B5B6E','#7A1F2B','#52796F','#A34452','#343A40']}];

// v12.44.821: ángulo del puntero en coords del canvas (derecha = 0); canvas y puntero
// comparten contenedor, así que la relación relativa es fija. Segmento bajo el puntero:
// θ_rueda = offset - rot
// v12.44.821: galería de logos INTEGRADOS — elegantes, genéricos, corporativos
// (reemplaza la noria emoji). SVG de línea, sin dependencias externas.
const LOGOS = {
  trofeo:  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#475569' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'><path d='M31 24h38v15a19 19 0 0 1-38 0z'/><path d='M31 29H17v7a12 12 0 0 0 12 12'/><path d='M69 29h14v7a12 12 0 0 1-12 12'/><path d='M50 58v11'/><path d='M37 76h26'/><path d='M43 69h14v7H43z'/></g></svg>",
  estrella:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill='#475569' d='M50 13l11.4 23.1 25.5 3.7-18.5 18 4.4 25.4L50 71l-22.3 11.7 4.4-25.4-18.5-18 25.5-3.7z'/></svg>",
  corona:  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill='#475569' d='M22 70l-7-42 18 13 17-22 17 22 18-13-7 42z'/><rect x='22' y='75' width='56' height='9' rx='4' fill='#475569'/></svg>",
  diamante:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#475569' stroke-width='4.5' stroke-linejoin='round'><path d='M30 28h40l14 16-34 32L16 44z'/><path d='M16 44h68M30 28l6 16 14-16 14 16 6-16'/></g></svg>",
  medalla: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='42' r='27' fill='none' stroke='#475569' stroke-width='4.5'/><path fill='#475569' d='M50 29l5.2 10.5 11.6 1.7-8.4 8.2 2 11.6L50 55.6l-10.4 5.4 2-11.6-8.4-8.2 11.6-1.7z'/><path d='M38 66l-6 18 10-5 8 9 4-16z' fill='#475569'/><path d='M62 66l6 18-10-5-8 9-4-16z' fill='#475569'/></svg>",
  anillo:  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#475569' stroke-width='4.5'><circle cx='50' cy='50' r='33'/><circle cx='50' cy='50' r='17'/></g><circle cx='50' cy='17' r='5' fill='#475569'/></svg>"
};
function logoUri(key){ return 'data:image/svg+xml,' + encodeURIComponent(LOGOS[key]); }

const POINTER_OFFSET=0;

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// v12.44.832: idiomas del juego (paridad AppSorteos — 7 idiomas). Elegir idioma
// pre-llena los textos públicos del juego; siguen editables a mano.
const LANGS={
 es:{t:'¡Gira la ruleta y gana!',d:'- Toca la ruleta para girar.\n- ¡Buena suerte!',b:'GIRAR'},
 en:{t:'Spin the wheel and win!',d:'- Tap the wheel to spin.\n- Good luck!',b:'SPIN'},
 pt:{t:'Gire a roleta e ganhe!',d:'- Toque na roleta para girar.\n- Boa sorte!',b:'GIRAR'},
 fr:{t:'Tournez la roue et gagnez !',d:'- Touchez la roue pour tourner.\n- Bonne chance !',b:'TOURNEZ'},
 tr:{t:'Çarkı çevir ve kazan!',d:'- Çarkı çevirmek için dokun.\n- İyi şanslar!',b:'ÇEVİR'},
 de:{t:'Dreh das Rad und gewinne!',d:'- Tippe auf das Rad, um zu drehen.\n- Viel Glück!',b:'DREHEN'},
 ja:{t:'ルーレットを回して当てよう！',d:'- ホイールをタップして回してください。\n- 幸運を！',b:'回す'}
};
function applyLang(key){
  const L=LANGS[key]||LANGS.es;
  document.getElementById('cfg-st').checked=true;
  document.getElementById('cfg-title').value=L.t;
  document.getElementById('cfg-sd').checked=true;
  document.getElementById('cfg-desc').value=L.d;
  document.getElementById('cfg-sb').checked=true;
  document.getElementById('cfg-bt').value=L.b;
  refreshP()
}
// v12.44.832: jugar de nuevo con 5 modos (auto/nunca/siempre/gana/pierde)
function refreshPA(){
  const row=document.getElementById('pa-n-row');
  if(row)row.style.display=document.getElementById('cfg-pa').value==='auto'?'flex':'none';
}
// estado de "jugar de nuevo" y comprobante durante el juego
let paCount=0,lastSpinCode=null;

// v12.44.821 (orden del dueño): SIEMPRE simétrica — porciones idénticas para todos
function effProbs(){
  const n=parts.length;
  if(!n)return[];
  return parts.map(function(){return 1/n});
}

function segIdxAt(rotation,probs){
  if(!probs||!probs.length)return 0;
  let f=(POINTER_OFFSET-(rotation||0))%(2*Math.PI);if(f<0)f+=2*Math.PI;
  let acc=0;
  for(let i=0;i<probs.length;i++){acc+=probs[i]*2*Math.PI;if(f<acc)return i}
  return probs.length-1
}


function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}

// Fix v12.44.804: toast() se llamaba en ~15 sitios pero nunca se definió —
// cada llamada lanzaba ReferenceError y cortaba el flujo (guardar/compartir).
// Usa el markup .toast que ya tiene wheel.html (#toast con clases ok/err).
let toastTimer=null;
function toast(msg,type){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=msg;
  el.className='toast show'+(type==='err'?' err':' ok');
  el.style.display='block';
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.style.display='none';el.className='toast'},2500);
}

function setType(val){
  document.getElementById('cfg-lds').checked=val;
  document.getElementById('type-anon').classList.toggle('active',!val);
  document.getElementById('type-lead').classList.toggle('active',val);
  refreshP()
}

// v12.44.821: confeti PROPIO sobre #jsccc (canvas fijo de la página). Antes dependía
// del CDN js-confetti: si el recurso tardaba o fallaba, el anuncio del ganador se
// rompía en cadena (sin historial ni registro del giro). Cero dependencias externas.
let confettiPieces=null,confettiRaf=null;
function burstConfetti(){
  try{
    const cv=document.getElementById('jsccc');if(!cv)return;
    const cxc=cv.getContext('2d');
    // el canvas vive DENTRO de #screencast (para verse también en pantalla completa):
    // coordenadas y tamaño relativos al contenedor
    const box=document.getElementById('screencast').getBoundingClientRect();
    cv.width=Math.round(box.width);cv.height=Math.round(box.height);
    const colors=['#FF6B6B','#FF9F40','#FFD43B','#69DB7C','#38D9A9','#4DABF7','#9775FA','#F783AC','#FFFFFF'];
    // posición de la rueda: el confeti EXPLOTA desde su centro y además llueve ancho
    let cx0=cv.width/2, cy0=cv.height/2;
    try{ const wr=document.getElementById('wheel-ct').getBoundingClientRect();
      cx0=wr.left-box.left+wr.width/2; cy0=wr.top-box.top+wr.height/2; }catch(e){}
    confettiPieces=[];
    // explosión radial desde la rueda (el "¡POW!") — piezas grandes y con alcance
    // para que salgan volando FUERA de la rueda y contrasten con el fondo
    for(let i=0;i<300;i++){
      const ang=Math.random()*Math.PI*2, v=11+Math.random()*18;
      confettiPieces.push({x:cx0,y:cy0,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v-5,g:0.26,drag:0.976,
        w:13+Math.random()*11,h:15+Math.random()*13,color:colors[Math.floor(Math.random()*colors.length)],
        rot:Math.random()*Math.PI*2,vr:-0.2+Math.random()*0.4,shape:Math.random()>0.45?'rect':'circle'});
    }
    // lluvia amplia desde arriba
    for(let i=0;i<280;i++){
      confettiPieces.push({x:Math.random()*cv.width,y:-50-Math.random()*cv.height*0.45,vx:-2+Math.random()*4,vy:3.5+Math.random()*5,g:0.05,drag:1,
        w:11+Math.random()*11,h:13+Math.random()*13,color:colors[Math.floor(Math.random()*colors.length)],
        rot:Math.random()*Math.PI*2,vr:-0.16+Math.random()*0.32,shape:Math.random()>0.45?'rect':'circle'});
    }
    if(confettiRaf)cancelAnimationFrame(confettiRaf);
    const t0=Date.now();
    (function step(){
      cxc.clearRect(0,0,cv.width,cv.height);
      let alive=false;
      (confettiPieces||[]).forEach(function(pc){
        pc.vx*=pc.drag;pc.vy=pc.vy*pc.drag+pc.g;pc.x+=pc.vx;pc.y+=pc.vy;pc.rot+=pc.vr;
        if(pc.y<cv.height+50&&pc.x>-60&&pc.x<cv.width+60)alive=true;
        cxc.save();cxc.translate(pc.x,pc.y);cxc.rotate(pc.rot);cxc.fillStyle=pc.color;
        if(pc.shape==='rect')cxc.fillRect(-pc.w/2,-pc.h/2,pc.w,pc.h);
        else{cxc.beginPath();cxc.arc(0,0,pc.w/2,0,2*Math.PI);cxc.fill()}
        cxc.restore();
      });
      if(alive&&Date.now()-t0<5200)confettiRaf=requestAnimationFrame(step);
      else{cxc.clearRect(0,0,cv.width,cv.height);confettiPieces=null;confettiRaf=null}
    })();
  }catch(e){/* el confeti nunca debe romper el anuncio del ganador */}
}

function openEditEntry(idx){
  editIdx=idx;document.getElementById('edit-name').value=parts[idx]||'';
  openModal('edit-modal')
}
function applyEditEntry(){
  const nm=document.getElementById('edit-name').value.trim();
  if(!nm||editIdx<0)return;
  parts[editIdx]=nm;
  document.getElementById('parts-ta').value=parts.join('\n');
  document.getElementById('part-cnt').textContent=parts.length;
  draw();closeModal('edit-modal');
  editIdx=-1
}

function newWheel(){
  if(!currentId)return;
  currentId=null;parts=[];wins=[];window.wheelBgImage=null;preSpinParts=null;
  document.getElementById('wheel-name').value='';
  document.getElementById('parts-ta').value='';
  document.getElementById('part-cnt').textContent='0';
  document.getElementById('btn-play').disabled=true;
  document.getElementById('hero-stats').classList.add('hidden');
  document.getElementById('bg-preview').style.display='none';document.getElementById('btn-rm-bg').style.display='none';
  draw()
}

function switchTab(tab,el){
  if(window.innerWidth>=1025)return;
  document.querySelectorAll('.wof__config__menu-item').forEach(function(e){e.classList.remove('active')});
  if(el)el.classList.add('active');
  document.querySelectorAll('[data-tab]').forEach(function(e){
    if(e.getAttribute('data-tab')===tab){e.classList.remove('hidden');e.style.display='block'}
    else{e.classList.add('hidden');e.style.display='none'}
  })
}
// Handle resize between mobile and desktop
window.addEventListener('resize',function(){
  if(window.innerWidth>=1025){
    document.querySelectorAll('[data-tab]').forEach(function(e){e.style.display=''})
  }
})

function uploadBg(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=function(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){window.wheelBgImage=ev.target.result;document.getElementById('bg-preview').style.backgroundImage='url('+ev.target.result+')';document.getElementById('bg-preview').style.display='block';document.getElementById('btn-rm-bg').style.display='block';refreshP()};reader.readAsDataURL(file)};
  inp.click()
}
function rmBg(){window.wheelBgImage=null;document.body.style.backgroundImage='none';document.body.classList.remove('has-bg');document.getElementById('bg-preview').style.display='none';document.getElementById('btn-rm-bg').style.display='none';refreshP()}

function toggleCollapse(h,id){
  const b=document.getElementById(id);if(!b)return;
  const isH=b.classList.contains('hidden');
  b.classList.toggle('hidden');h.classList.toggle('collapsed',!isH)
}

function getC(){
  const c=data&&data.config||{};
  // v12.44.821: capture_leads y wheel_auto_remove faltaban aqui — spin() los lee de
  // getC() y siempre daba undefined (leads y auto-remove muertos en la pagina publica)
  return {bg:c.page_background_color||'#D1E4FF',mc:c.main_color||'#1a1a1a',pc:c.pointer_color||'#ff7878',bc:c.wheel_border_color||'#111111',tc:c.wheel_slices_text_color||'#000000',sc:c.wheel_colors||segCs,lw:parseInt(c.wheel_lines_size)||0,dur:parseInt(c.wheel_spin_duration)||10,snd:c.play_sounds!==false,cft:c.show_confettis!==false,capture_leads:c.capture_leads===true,wheel_auto_remove:c.wheel_auto_remove===true}
}

// v12.44.821: tamaño base por cantidad (para buffer 500) — escala con el tamaño real
// de la rueda y se limita por el ancho del arco; nunca desaparece, se degrada gradual
// v12.44.821: pocos jugadores = fuente GRANDE (llena la porción); muchos = se reduce y ajusta
function calcFs(n){
  if(n<=4)return 40;if(n<=6)return 32;if(n<=8)return 26;if(n<=12)return 20;if(n<=16)return 16;if(n<=24)return 12;if(n<=40)return 10;if(n<=70)return 8;if(n<=110)return 6.5;if(n<=180)return 5;return 4
}

// v12.44.821: /media/ding.mp3 no existe en public/ (promesa rechazada en consola) —
// tono sintetizado con WebAudio, igual que el fallback anterior pero sin intentar el mp3
function playTone(freq,dur,gain){
  try{
    const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);o.frequency.value=freq;g.gain.value=gain;
    o.start();o.stop(a.currentTime+dur)
  }catch(e){}
}

// ===== CANVAS (Winwheel.js style) =====
function draw(){
  // v12.44.821: el buffer se ajusta al tamaño REAL renderizado (x densidad de píxeles)
  // — antes era 500px fijo estirado por CSS: texto pequeño y borroso al proyectar.
  // Todo el dibujo es proporcional a w, así que basta escalar las medidas fijas (SC).
  const cssW=cv.clientWidth||500;
  const target=Math.max(300,Math.min(Math.round(cssW*(window.devicePixelRatio||1)),2200));
  if(cssW>0&&Math.abs(cv.width-target)>24){cv.width=target;cv.height=target}
  const SC=cv.width/500;
  const w=cv.width,h=cv.height,cl=getC(),ir=50*SC;cx.clearRect(0,0,w,h);
  cx.save();cx.translate(w/2,h/2);cx.rotate(rot);
  const n=parts.length;
  if(n){
    // v12.44.821: segmentos PROPORCIONALES al peso — con parada uniforme la
    // probabilidad de caer en cada segmento es exactamente su arco/2π
    const probs=effProbs();
    // los segmentos llegan hasta el borde (sin hueco contra el marco negro)
    const or=w/2-1,fsBase=calcFs(n)*SC;
    const imp=document.getElementById('cfg-imp')?.checked===true;
    let s=0;
    parts.forEach(function(nm,i){
      const a=probs[i]*2*Math.PI,e=s+a;
      // Segment
      if(a>0.0001){
        cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,or,s,e);cx.closePath();
        // v12.44.821: colores del ESTADO VIVO (segCs) — antes leía la config guardada
        // y al elegir un tema solo cambiaba el puntero, no los segmentos
        cx.fillStyle=segCs[i%segCs.length];cx.fill();
        if(cl.lw>0){cx.strokeStyle='rgba(0,0,0,0.06)';cx.lineWidth=cl.lw*SC;cx.stroke()}
        // "Mejorar slices" real: separador blanco entre segmentos
        if(imp){cx.strokeStyle='rgba(255,255,255,0.85)';cx.lineWidth=3*SC;cx.stroke()}
      }
      // Inner cutout
      cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,ir,0,2*Math.PI);cx.closePath();cx.fillStyle='#fff';cx.fill();
      // texto proporcionado: fs = min(base_escalado, ancho del arco×0.9); nombre
      // truncado por ancho REAL con measureText (nunca a un número fijo de caracteres)
      const fs=Math.min(fsBase,a*(or-16*SC)*0.9);
      if(fs>=4*SC){
        cx.save();cx.rotate(s+a/2);cx.textAlign='right';cx.fillStyle=cl.tc;
        cx.font='bold '+fs+'px Inter';cx.shadowColor='rgba(0,0,0,0.3)';cx.shadowBlur=2*SC;
        const maxLen=or-ir-18*SC;
        let d=nm;
        if(cx.measureText(d).width>maxLen){
          while(d.length>1&&cx.measureText(d+'…').width>maxLen)d=d.slice(0,-1);
          d=d+'…';
        }
        cx.fillText(d,or-15*SC,fs/3);cx.restore()
      }
      s=e
    });
    // Pins en las fronteras entre segmentos (ángulos acumulados)
    let acc=0;
    for(let i=0;i<n;i++){
      cx.beginPath();cx.arc(Math.cos(acc)*(or-6*SC),Math.sin(acc)*(or-6*SC),4*SC,0,2*Math.PI);
      cx.fillStyle='rgba(255,255,255,0.7)';cx.fill();
      acc+=probs[i]*2*Math.PI
    }
  }
  cx.restore()
}

// v12.44.821: índice bajo el puntero para arcos variables (antes: división uniforme
// con +Math.PI/2, que desplazaba el anuncio un segmento respecto al puntero)
function getSegIdx(){
  return segIdxAt(rot,effProbs())
}

// ===== SPIN (Expo.easeOut) =====
// v12.44.821: el giro obedece el ESTADO VIVO del panel (checkboxes visibles), no solo
// la config guardada — así el master cambia registro/confeti/auto-remover/duración de
// último momento en el enlace y aplican al instante. La config guardada es el respaldo.
function liveCheck(id,cfgVal){
  const el=document.getElementById(id);
  return el?(el.checked===true):(cfgVal===true);
}
function spin(){
  if(spinning||!parts.length)return;
  if(preSpinParts===null){preSpinParts=parts.slice();preSpinWins=wins.length}
  const leadsOn=liveCheck('cfg-lds',getC().capture_leads);
  if(leadsOn&&!document.getElementById('lead-f').classList.contains('submitted')){
    const fn=document.getElementById('lead-nm')?.value?.trim(),em=document.getElementById('lead-em')?.value?.trim();
    if(!fn||!em){toast('Completa nombre y email','err');return}
    document.getElementById('lead-f').classList.add('submitted');
    // v12.44.832: el código del giro llega en la respuesta (para el comprobante)
    fetch(API+'/raffles/'+data.id+'/spin-with-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winnerName:'___lead___',name:fn,email:em})}).then(function(r){return r.json()}).then(function(j){if(j&&j.codigo){lastSpinCode=j.codigo;maybeCert()}}).catch(function(){});
  }
  spinning=true;
  document.getElementById('screencast').classList.add('spinning');
  document.getElementById('wheel-ct').classList.add('zooming');
  // reiniciar la animación del ganador para el próximo anuncio
  const wb=document.getElementById('win-box');if(wb)wb.classList.remove('pop');
  document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=true});
  const cl=getC();
  const dur=(parseInt(document.getElementById('cfg-dur')?.value,10)||cl.dur)*1000;
  const spins=8,target=rot+spins*2*Math.PI+Math.random()*2*Math.PI,st=Date.now(),sr=rot;
  const probs=effProbs();
  const sndOn=cl.snd&&sound;
  if(sndOn)playTone(800,.06,.06);
  let lastSeg=-1;
  (function an(){
    const p=Math.min((Date.now()-st)/dur,1);
    const e=p===1?1:1-Math.pow(2,-10*p);
    rot=sr+(target-sr)*e;draw();
    const seg=segIdxAt(rot,probs);
    document.getElementById('win-name').textContent=parts[seg];
    document.getElementById('win-box').style.display='block';
    // v12.44.821: tick + FLICK del puntero al cruzar cada frontera de segmento
    if(seg!==lastSeg){
      lastSeg=seg;
      if(sndOn)playTone(600+Math.random()*200,.03,.04);
      try{const pt=document.querySelector('.wof__wheel__pointer');
        if(pt){pt.classList.add('flick');setTimeout(function(){pt.classList.remove('flick')},80)}
      }catch(e){}
    }
    if(p<1)requestAnimationFrame(an);else{
      spinning=false;
      document.getElementById('screencast').classList.remove('spinning');
      document.getElementById('wheel-ct').classList.remove('zooming');
      document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=false});
      const win=parts[seg];
      wins.push(win);
      const armOn=liveCheck('cfg-arm',getC().wheel_auto_remove);
      if(armOn){
        parts.splice(seg,1);
        const t=document.getElementById('parts-ta');
        if(t)t.value=parts.join('\n');
        const pc=document.getElementById('part-cnt');if(pc)pc.textContent=parts.length
      }
      document.getElementById('win-name').textContent='🏆 '+win;
      // v12.44.821: el ganador sale ANIMADO arriba (pop con rebote), como el original
      if(wb){wb.classList.remove('pop');void wb.offsetWidth;wb.classList.add('pop')}
      if(liveCheck('cfg-cft',getC().cft))burstConfetti();
      updWins();
      // v12.44.832: código del giro (anónimo) + jugar de nuevo según modo
      fetch(API+'/raffles/'+data.id+'/spin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winnerName:win})}).then(function(r){return r.json()}).then(function(j){if(j&&j.codigo){lastSpinCode=j.codigo;maybeCert()}}).catch(function(){});
      maybeAgain();
    }
  })()
}

// v12.44.832: mostrar "GIRAR DE NUEVO" según el modo elegido
// (auto = cada N participaciones; siempre; nunca; solo-gana [en sorteo siempre];
//  solo-pierde [en sorteo nunca])
function maybeAgain(){
  const mode=(document.getElementById('cfg-pa')?.value)||getC().play_again_mode||'auto';
  const every=parseInt(document.getElementById('cfg-pa-n')?.value,10)||getC().play_again_every||3;
  paCount++;
  let show=false;
  if(mode==='always'||mode==='win')show=true;
  else if(mode==='auto')show=(paCount>=every);
  const b=document.getElementById('btn-again');
  if(b)b.style.display=show?'flex':'none'
}
// v12.44.832: girar de nuevo — restaura el estado local pre-giro (la lista del editor
// NO se toca) y, en modo leads, vuelve a pedir el registro del siguiente participante
function spinAgain(){
  const b=document.getElementById('btn-again');if(b)b.style.display='none';
  const c=document.getElementById('btn-cert');if(c)c.style.display='none';
  paCount=0;lastSpinCode=null;
  if(preSpinParts!==null){parts=preSpinParts.slice();draw()}
  const lf=document.getElementById('lead-f');
  if(lf)lf.classList.remove('submitted');
  document.getElementById('win-box').style.display='none';
  refreshP()
}
// v12.44.832: comprobante descargable (PDF generado por el servidor con el giro real)
function maybeCert(){
  if(!liveCheck('cfg-cert',getC().certificate))return;
  if(!lastSpinCode)return;
  const c=document.getElementById('btn-cert');
  if(c)c.style.display='flex'
}
function downloadCert(){
  if(!lastSpinCode){toast('Gira la ruleta primero','err');return}
  window.open(API+'/raffles/'+data.id+'/certificate?codigo='+encodeURIComponent(lastSpinCode),'_blank')
}

// v12.44.821: girar con clic sobre la ruleta o barra espaciadora (paridad AppSorteos)
cv.addEventListener('click',function(){if(!spinning)spin()});
document.addEventListener('keydown',function(e){
  if(e.code!=='Space')return;
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  if(!parts.length)return;
  e.preventDefault();
  if(!spinning)spin()
});

function resetW(){
  rot=0;spinning=false;
  // v12.44.821: restaurar el estado previo al primer giro (participantes, pesos y lista)
  if(preSpinParts!==null){
    parts=preSpinParts.slice();wins=wins.slice(0,preSpinWins);
    const t=document.getElementById('parts-ta');if(t)t.value=parts.join('\n');
    const pc=document.getElementById('part-cnt');if(pc)pc.textContent=parts.length;
    updWins();
    preSpinParts=null;preSpinWts=null
  }
  document.getElementById('screencast').classList.remove('spinning');
  document.getElementById('wheel-ct').classList.remove('zooming');
  draw();document.getElementById('win-box').style.display='none';
  document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=false})
}
// v12.44.821: panel de GANADORES vertical elegante — posición numerada en círculo, sin emojis
function updWins(){
  const wl=document.getElementById('wins-list');
  if(!wins.length){wl.innerHTML='';wl.classList.remove('show');return}
  wl.classList.add('show');
  wl.innerHTML='<div class="win-panel-title">Ganadores</div>'+wins.map(function(w,i){
    return '<div class="win-row"><span class="win-pos">'+(i+1)+'</span><span class="win-name-t">'+esc(w)+'</span></div>'
  }).join('')
}
function toggleWins(){document.getElementById('wins-list').classList.toggle('show')}
function toggleSnd(){sound=!sound;document.getElementById('btn-snd').textContent=sound?'🔊':'🔇'}

function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('screencast').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
document.addEventListener('fullscreenchange',function(){document.getElementById('screencast').classList.toggle('fullscreen',!!document.fullscreenElement);requestAnimationFrame(function(){draw()})});

// ===== PLAY MODE =====
function playMode(){if(!currentId)return;isPlaying=true;document.getElementById('wof').classList.add('playing');document.getElementById('btn-close-pl').style.display='flex'}
function exitPlay(){isPlaying=false;document.getElementById('wof').classList.remove('playing');document.getElementById('btn-close-pl').style.display='none';if(document.fullscreenElement)document.exitFullscreen().catch(function(){})}

// ===== SIDEBAR REFRESH =====
function refreshP(){
  console.log('[BG-DEBUG] refreshP corriendo | wheelBgImage=', window.wheelBgImage ? String(window.wheelBgImage).slice(0,40) : String(window.wheelBgImage));
  const sc=document.getElementById('screencast'),bg=document.getElementById('c-bg').value,mn=document.getElementById('c-main').value;
  sc.style.backgroundColor=bg;sc.style.backgroundImage=window.wheelBgImage?'url("'+window.wheelBgImage+'")':'none';sc.style.backgroundSize='cover';sc.style.backgroundPosition='center';sc.style.color=mn;
  // v12.44.821: imagen de fondo cubre TODA la ventana, en vivo (subir/quitar desde el panel)
  if(window.wheelBgImage){document.body.style.backgroundImage='url("'+window.wheelBgImage+'")';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';document.body.style.backgroundAttachment='fixed';document.body.classList.add('has-bg')}
  else{document.body.style.backgroundImage='none';document.body.classList.remove('has-bg')}
  document.querySelector('.wof__wheel__pointer').style.color=document.getElementById('c-ptr').value;
  document.querySelector('.wof__wheel__border').style.borderColor=document.getElementById('c-bdr').value;
  const st=document.getElementById('cfg-st').checked,tv=document.getElementById('cfg-title').value;
  document.getElementById('cfg-title').style.display=st?'block':'none';
  const sd=document.getElementById('cfg-sd').checked,dv=document.getElementById('cfg-desc').value;
  document.getElementById('cfg-desc').style.display=sd?'block':'none';
  const sb=document.getElementById('cfg-sb').checked,bv=document.getElementById('cfg-bt').value;
  document.getElementById('cfg-bt').style.display=sb?'block':'none';
  // v12.44.821: el título real vive en #pv-title (puesto por load() desde la config);
  // el input del panel está vacío en modo juego compartido — usarlo como respaldo.
  const tvReal=tv||document.getElementById('pv-title').textContent||'';
  document.getElementById('pv-title').textContent=tvReal;document.getElementById('pv-title').style.display=(st&&tvReal)?'block':'none';
  document.getElementById('pv-desc').textContent=dv||'';document.getElementById('pv-desc').style.display=sd?'block':'none';
  document.querySelectorAll('.wof__main__btn').forEach(function(b){b.textContent='🎡 '+(bv||'GIRAR')});
  // v12.44.821: un solo botón GIRAR cuando no hay leads (el derecho solo existe para el
  // flujo de captura; antes aparecían dos botones girar a la vez)
  const lds=document.getElementById('cfg-lds').checked;
  const bs=document.getElementById('btn-spin');
  if(bs)bs.style.display=(sb&&!lds)?'flex':'none';
  const br=document.getElementById('btn-spin-r');
  if(br)br.style.display=(sb&&lds)?'flex':'none';
  document.getElementById('lead-f').style.display=lds?'block':'none';
  draw()
}

function onSrcChange(){
  const v=document.getElementById('src-src').value;
  document.getElementById('btn-imp').style.display=v==='manual'?'none':'block';
  document.getElementById('src-survey').style.display=v==='survey'?'block':'none';
}
function importParts(){if(!currentId)return;
  fetch(API+'/raffles/'+currentId+'/populate',{method:'POST'}).then(function(r){return r.json()}).then(function(r){
    if(r&&r.participants&&r.participants.length){document.getElementById('parts-ta').value=r.participants.join('\n');onPartsChange();toast('Importados','ok')}
    else toast('Sin participantes','err')
  }).catch(function(){toast('Error','err')})
}
function onPartsChange(){
  const t=document.getElementById('parts-ta');
  const names=(t?.value||'').split('\n').map(function(s){return s.trim()}).filter(Boolean);
  parts=names;
  document.getElementById('part-cnt').textContent=parts.length;
  draw()
}
function sortP(){const t=document.getElementById('parts-ta');if(!t)return;t.value=t.value.split('\n').map(function(s){return s.trim()}).filter(Boolean).sort().join('\n');onPartsChange()}
function shuffleP(){const t=document.getElementById('parts-ta');if(!t)return;const l=t.value.split('\n').map(function(s){return s.trim()}).filter(Boolean);for(let i=l.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const x=l[i];l[i]=l[j];l[j]=x}t.value=l.join('\n');onPartsChange()}
function clearP(){document.getElementById('parts-ta').value='';onPartsChange()}
// v12.44.811: llamado por delegacion (data-act) desde los inputs de la config
function setSegC(i,v,node){segCs[i]=v;if(node&&node.previousElementSibling)node.previousElementSibling.textContent=v;draw()}


// ===== THEMES =====
function renderThemes(){
  const el=document.getElementById('theme-ps');
  let h='';
  themes.forEach(function(t,i){
    const s=t.colors.map(function(c){return'<span data-style="background:'+c+'"></span>'}).join('');
    h+='<div class="color_palette" data-act="call" data-call="useTheme" data-a1="'+i+'" title="'+t.name+'">'+s+'</div>'
  });
  el.innerHTML=h;
  // v12.44.821: barra de temas del área de juego (elegir paleta en vivo, incluso en fullscreen)
  const q=document.getElementById('q-themes');
  if(q)q.innerHTML=themes.map(function(t,i){
    const s=t.colors.slice(0,6).map(function(c){return'<span data-style="background:'+c+'"></span>'}).join('');
    return '<div class="q-palette" data-act="call" data-call="useTheme" data-a1="'+i+'" title="'+t.name+'">'+s+'</div>'
  }).join('')
}
// v12.44.821: elegir un logo integrado (elegante, corporativo)
function useLogo(key){
  if(!LOGOS[key])return;
  logoDataUrl=logoUri(key);
  document.getElementById('wheel-logo').src=logoDataUrl;
  draw()
}
function renderLogos(){
  const el=document.getElementById('logo-presets');if(!el)return;
  el.innerHTML=Object.keys(LOGOS).map(function(k){
    return '<div class="logo-preset" data-act="call" data-call="useLogo" data-a1="'+k+'" title="'+k+'"><img src="'+logoUri(k)+'" alt="'+k+'"></div>'
  }).join('')
}
function useTheme(idx){
  const t=themes[idx];if(!t)return;
  segCs=t.colors.slice();renderSegCs();draw();
  document.getElementById('c-ptr').value=segCs[0];document.getElementById('v-ptr').textContent=segCs[0];
  refreshP()
}
function renderSegCs(){const el=document.getElementById('seg-cs');el.innerHTML=segCs.map(function(c,i){return'<div class="color-input"><span>'+c+'</span><input type="color" value="'+c+'" data-act="call" data-call="setSegC" data-a1="'+i+'" data-a2="@this.value" data-a3="@this"></div>'}).join('')}

function uploadLogo(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=function(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){logoDataUrl=ev.target.result;document.getElementById('logo-pv').innerHTML='<img src="'+ev.target.result+'" data-style="width:100%;height:100%;object-fit:cover">';document.getElementById('btn-rm-logo').style.display='block';draw()};reader.readAsDataURL(file)};
  inp.click()
}
function rmLogo(){logoDataUrl=null;document.getElementById('logo-pv').innerHTML='🎡';document.getElementById('btn-rm-logo').style.display='none';draw()}

// ===== SAVE/LOAD =====
function saveW(){
  const el=document.getElementById('wheel-name'),name=el?.value?.trim();
  if(!name){toast('Nombre requerido','err');return}
  if(!currentId){toast('Primero crea la ruleta','err');return}
  const cfg={page_background_color:document.getElementById('c-bg').value,page_background_image:window.wheelBgImage,main_color:document.getElementById('c-main').value,pointer_color:document.getElementById('c-ptr').value,wheel_border_color:document.getElementById('c-bdr').value,wheel_slices_text_color:document.getElementById('c-txt').value,wheel_colors:segCs,wheel_lines_size:parseInt(document.getElementById('cfg-ln').value)||0,wheel_spin_duration:parseInt(document.getElementById('cfg-dur').value)||10,play_sounds:document.getElementById('cfg-snd').checked,show_confettis:document.getElementById('cfg-cft').checked,wheel_auto_remove:document.getElementById('cfg-arm').checked,capture_leads:document.getElementById('cfg-lds').checked,improve_slices:document.getElementById('cfg-imp').checked,show_title:document.getElementById('cfg-st').checked,title:document.getElementById('cfg-title').value,show_desc:document.getElementById('cfg-sd').checked,description:document.getElementById('cfg-desc').value,show_start_button:document.getElementById('cfg-sb').checked,start_button:document.getElementById('cfg-bt').value,logo:logoDataUrl,language:document.getElementById('cfg-lang')?document.getElementById('cfg-lang').value:'es',play_again_mode:document.getElementById('cfg-pa')?document.getElementById('cfg-pa').value:'auto',play_again_every:parseInt(document.getElementById('cfg-pa-n')?.value,10)||3,certificate:document.getElementById('cfg-cert')?document.getElementById('cfg-cert').checked:false};
  // v12.44.821: desde el ENLACE COMPARTIDO se guarda por /public-config (sin clave):
  // config + participantes en una sola llamada, auditada en el backend. No renombra
  // ni borra ni cambia estado — solo lo que se ajusta de último momento.
  fetch(API+'/raffles/'+currentId+'/public-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:cfg,participants:parts.map(function(n){return {name:n}})})})
    .then(function(){toast('✅ Guardado','ok');document.getElementById('btn-play').disabled=false;loadSav()})
    .catch(function(e){toast('Error: '+e.message,'err')})
}

function loadSav(){
  const eId=window._eventId;
  if(!eId){document.getElementById('sav-list').innerHTML='<div data-style="font-size:13px;color:#9ca3af">Selecciona un evento</div>';return}
  fetch(API+'/raffles/events/'+eId+'/raffles').then(function(r){return r.json()}).then(function(list){
    const el=document.getElementById('sav-list');
    // v12.44.821: listar ruletas requiere sesión — sin ella el aviso es honesto
    if(!Array.isArray(list)){el.innerHTML='<div data-style="font-size:12px;color:#9ca3af;text-align:center;padding:8px">🔒 Inicia sesión en la app para ver tus ruletas guardadas</div>';return}
    if(!list.length){el.innerHTML='<div data-style="font-size:13px;color:#9ca3af;text-align:center;padding:8px">No hay ruletas guardadas</div>';return}
    el.innerHTML=list.map(function(r){const s=r.stats||{};return'<div data-style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer" data-act="call" data-call="loadW" data-a1="' + r.id + '" data-a2="' + (r.name||'') + '"><div><div data-style="font-weight:600;font-size:13px;color:#1a1a1a">'+(r.name||'Sin nombre')+'</div><div data-style="font-size:11px;color:#9ca3af">'+(r.total_participants||0)+' part · '+(s.spins||0)+' giros</div></div><button data-style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px" data-act="call" data-stop="1" data-call="delW" data-a1="' + r.id + '">🗑️</button></div>'}).join('')
  }).catch(function(){})
}
function delW(id){if(!confirm('¿Eliminar ruleta?'))return;fetch(API+'/raffles/'+id,{method:'DELETE'}).then(function(){loadSav();if(currentId===id){currentId=null;document.getElementById('btn-play').disabled=true}}).catch(function(){})}

function copyLink(){const u=document.getElementById('share-url');if(!u||!u.value)return;navigator.clipboard.writeText(u.value).then(function(){toast('✅ Link copiado','ok');closeModal('share-modal')}).catch(function(){u.select();document.execCommand('copy');toast('✅ Link copiado','ok');closeModal('share-modal')})}

function loadW(id,name){
  currentId=id;document.getElementById('wheel-name').value=name||'';
  fetch(API+'/raffles/'+id).then(function(r){return r.json()}).then(function(r){
    const c=r.config||{};
    document.getElementById('c-bg').value=c.page_background_color||'#D1E4FF';document.getElementById('v-bg').textContent=c.page_background_color||'#D1E4FF';
    document.getElementById('c-main').value=c.main_color||'#1a1a1a';document.getElementById('v-main').textContent=c.main_color||'#1a1a1a';
    document.getElementById('c-ptr').value=c.pointer_color||'#ff7878';document.getElementById('v-ptr').textContent=c.pointer_color||'#ff7878';
    document.getElementById('c-bdr').value=c.wheel_border_color||'#111111';document.getElementById('v-bdr').textContent=c.wheel_border_color||'#111111';
    document.getElementById('c-txt').value=c.wheel_slices_text_color||'#000000';document.getElementById('v-txt').textContent=c.wheel_slices_text_color||'#000000';
    document.getElementById('cfg-ln').value=String(c.wheel_lines_size||0);document.getElementById('cfg-dur').value=String(c.wheel_spin_duration||10);
    document.getElementById('cfg-snd').checked=c.play_sounds!==false;document.getElementById('cfg-cft').checked=c.show_confettis!==false;
    document.getElementById('cfg-arm').checked=c.wheel_auto_remove===true;document.getElementById('cfg-lds').checked=c.capture_leads===true;
    document.getElementById('cfg-imp').checked=c.improve_slices===true;
    window.wheelBgImage=c.page_background_image||null;
    if(window.wheelBgImage){document.getElementById('bg-preview').style.backgroundImage='url('+window.wheelBgImage+')';document.getElementById('bg-preview').style.display='block';document.getElementById('btn-rm-bg').style.display='block'}else{document.getElementById('bg-preview').style.display='none';document.getElementById('btn-rm-bg').style.display='none'}
    document.getElementById('cfg-st').checked=c.show_title!==false;document.getElementById('cfg-title').value=c.title||'';
    document.getElementById('cfg-sd').checked=c.show_desc!==false;document.getElementById('cfg-desc').value=c.description||'';
    document.getElementById('cfg-sb').checked=c.show_start_button!==false;document.getElementById('cfg-bt').value=c.start_button||'Girar';
    // v12.44.832: idioma, jugar de nuevo y comprobante
    if(document.getElementById('cfg-lang'))document.getElementById('cfg-lang').value=c.language||'es';
    if(document.getElementById('cfg-pa'))document.getElementById('cfg-pa').value=c.play_again_mode||'auto';
    if(document.getElementById('cfg-pa-n'))document.getElementById('cfg-pa-n').value=String(c.play_again_every||3);
    if(document.getElementById('cfg-cert'))document.getElementById('cfg-cert').checked=c.certificate===true;
    if(document.getElementById('pa-n-row'))document.getElementById('pa-n-row').style.display=(c.play_again_mode||'auto')==='auto'?'flex':'none';
    segCs=c.wheel_colors||['#ff7878','#7eecec','#fff171','#7280fd'];logoDataUrl=c.logo||null;
    renderSegCs();refreshP();
    fetch(API+'/raffles/'+id+'/participants').then(function(r){return r.json()}).then(function(ps){
      parts=(ps||[]).map(function(p){return p.name||p.email||''}).filter(Boolean);
      document.getElementById('parts-ta').value=parts.join('\n');onPartsChange()
    }).catch(function(){});
    fetch(API+'/raffles/'+id+'/results').then(function(r){return r.json()}).then(function(rs){wins=[];(rs||[]).forEach(function(rr){(rr.winners||[]).forEach(function(w){wins.push(w.name||w)})});if(wins.length)updWins()}).catch(function(){});
    document.getElementById('btn-play').disabled=false;
    const en=(data&&data.event_name||'evento').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    document.getElementById('share-url').value=window.location.origin+'/'+en+'/raffle/'+id
  }).catch(function(){toast('Error al cargar','err')})
}

// ===== LOAD =====
async function load(){
  let p=window.location.pathname.split('/'),id=null,idx=p.indexOf('raffle');
  if(idx>-1)id=p[idx+1];
  if(!id||id==='undefined'){
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error')&&(document.getElementById('error').style.display='flex');
    return
  }
  try{
    const r=await fetch(API+'/raffles/'+id+'/public');if(!r.ok)throw Error('No encontrada');
    data=await r.json();
    parts=data.participants||[];wins=[];
    if(!parts.length){document.getElementById('loading').classList.add('hidden');document.getElementById('error')&&(document.getElementById('error').style.display='flex');return}
    if(data.results&&data.results.length){data.results.forEach(function(rr){(rr.winners||[]).forEach(function(w){wins.push(w.name||w)})})}
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('screencast').style.display='flex';
    const c=data.config||{};currentId=data.id;
    window._eventId=data.event_id||null;
    document.getElementById('screencast').style.backgroundColor=c.page_background_color||'#D1E4FF';
    // v12.44.821: la imagen de fondo cubre TODA la ventana (body, cover, fija) y el
    // panel la mantiene para pantalla completa — así no quedan zonas fuera de la imagen
    if(c.page_background_image){document.body.style.backgroundImage='url('+c.page_background_image+')';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';document.body.style.backgroundAttachment='fixed';document.body.classList.add('has-bg')}
    else{document.body.style.backgroundImage='none';document.body.classList.remove('has-bg')}
    if(c.page_background_image){document.getElementById('screencast').style.backgroundImage='url('+c.page_background_image+')';document.getElementById('screencast').style.backgroundSize='cover';document.getElementById('screencast').style.backgroundPosition='center'}else{document.getElementById('screencast').style.backgroundImage='none'}
    document.getElementById('screencast').style.color=c.main_color||'#1a1a1a';
    document.querySelector('.wof__wheel__pointer').style.color=c.pointer_color||'#ff7878';
    document.querySelector('.wof__wheel__border').style.borderColor=c.wheel_border_color||'#111111';
    if(c.logo)document.getElementById('wheel-logo').src=c.logo;
    else document.getElementById('wheel-logo').src=logoUri('trofeo');
    const st=c.show_title!==false,sd=c.show_desc!==false,sb=c.show_start_button!==false;
    if(st&&c.title)document.getElementById('pv-title').textContent=c.title;else document.getElementById('pv-title').style.display='none';
    if(sd&&c.description)document.getElementById('pv-desc').textContent=c.description;else document.getElementById('pv-desc').style.display='none';
    document.querySelectorAll('.wof__main__btn').forEach(function(b){b.textContent='🎡 '+(c.start_button||'GIRAR')});
    // v12.44.821: las tarjetas de modo reflejan la configuración guardada
    setType(!!c.capture_leads);
    if(c.capture_leads){document.getElementById('lead-f').style.display='block';document.getElementById('btn-spin').style.display='none'}
    else{document.getElementById('btn-spin').style.display='flex';const br=document.getElementById('btn-spin-r');if(br)br.style.display='none'}
    if(st||sd||sb)document.getElementById('right-panel').style.display='flex';
    sound=c.play_sounds!==false;document.getElementById('btn-snd').textContent=sound?'🔊':'🔇';
    renderThemes();renderLogos();
    const qt=document.getElementById('q-themes');if(qt)qt.style.display='flex';
    segCs=c.wheel_colors||['#ff7878','#7eecec','#fff171','#7280fd'];renderSegCs();
    document.getElementById('parts-ta').value=parts.join('\n');document.getElementById('part-cnt').textContent=parts.length;
    // v12.44.821: el modal Compartir siempre tiene el enlace actual (antes quedaba
    // vacío al abrir por el enlace directo)
    document.getElementById('share-url').value=window.location.origin+window.location.pathname;
    // Hero stats
    fetch(API+'/raffles/'+id+'/stats').then(function(r){return r.json()}).then(function(s){
      document.getElementById('stat-visits').textContent=s.visits||0;
      document.getElementById('stat-spins').textContent=s.spins||0;
      document.getElementById('stat-users').textContent=s.participants||0;
      // v12.44.821: registros (leads) capturados
      const sl=document.getElementById('stat-leads');if(sl)sl.textContent=s.leads||0;
      document.getElementById('hero-stats').classList.remove('hidden')
    }).catch(function(){});
    // v12.44.821: redibujar a la resolución real una vez aplicados los estilos
    requestAnimationFrame(function(){draw()});
    if(wins.length)updWins()
  }catch(e){document.getElementById('loading').classList.add('hidden');document.getElementById('error').style.display='flex';document.getElementById('errmsg').textContent='Error al cargar la ruleta'}
}
load();
