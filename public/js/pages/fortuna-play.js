// ===== Ruleta de la Fortuna — PÁGINA DE JUEGO pública (P1 — v12.44.833) =====
// Formulario de registro → giro (el servidor elige el premio por probabilidades) →
// la ruleta se detiene en el segmento ganador → páginas de ganador/perdedor.

let API='/api',data=null,segments=[],rot=0,spinning=false,deviceId=null,playResult=null;
let bgc='#9d174d',segCs=['#ec4899','#f9a8d4','#be185d','#f472b6','#9d174d','#fbcfe8'],tcol='#ffffff',bcol='#ffffff',lw=2;
let soundOn=true,paCount=0,playing=true;

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
let toastTimer=null;
function toast(msg){const el=$('toast');el.textContent=msg;el.className='fzp-toast show';clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='fzp-toast'},2600)}
function reloadPage(){window.location.reload()}

// ===== SONIDO (WebAudio sintetizado, paridad ruleta) =====
let actx=null;
function ac(){try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();return actx}catch(e){return null}}
function beep(freq,dur,type,vol,when){
  if(!soundOn)return;
  const a=ac();if(!a)return;
  const t=a.currentTime+(when||0);
  const o=a.createOscillator(),g=a.createGain();
  o.type=type||'sine';o.frequency.value=freq;
  g.gain.setValueAtTime(vol||0.1,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+(dur||0.15));
  o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+(dur||0.15)+0.05)
}
function sTick(){beep(600+Math.random()*200,.04,.05)}
function sWin(){[523,659,784,1047].forEach(function(f,i){beep(f,.22,'triangle',.14,i*.16)})}
function sLose(){beep(300,.2,'sawtooth',.08);beep(220,.28,'sawtooth',.08,.16)}

// ===== CONFETI propio =====
function burstConfetti(){
  try{
    const cv=$('jsccc');if(!cv)return;
    cv.width=window.innerWidth;cv.height=window.innerHeight;
    const cx=cv.getContext('2d');
    const colors=['#fde047','#f9a8d4','#6ee7b7','#7dd3fc','#c4b5fd','#fff'];
    const parts=[];
    for(let i=0;i<220;i++){
      parts.push({x:Math.random()*cv.width,y:-40-Math.random()*cv.height*.4,vx:-1.5+Math.random()*3,vy:3+Math.random()*5,
        w:10+Math.random()*10,h:12+Math.random()*12,rot:Math.random()*Math.PI,vr:-.2+Math.random()*.4,
        c:colors[Math.floor(Math.random()*colors.length)]});
    }
    const t0=Date.now();
    (function step(){
      cx.clearRect(0,0,cv.width,cv.height);
      let alive=false;
      parts.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
        if(p.y<cv.height+40)alive=true;
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.c;cx.fillRect(-p.w/2,-p.h/2,p.w,p.h);cx.restore()});
      if(alive&&Date.now()-t0<4500)requestAnimationFrame(step);
      else cx.clearRect(0,0,cv.width,cv.height);
    })();
  }catch(e){}
}

// ===== DIBUJO DE LA RULETA (paridad wheel.js) =====
const POINTER_OFFSET=0;
function draw(target){
  const cv=$('wcanvas');if(!cv)return;
  const cx=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx0=W/2,cy0=H/2,R=W/2-8;
  cx.clearRect(0,0,W,H);
  const n=segments.length;
  if(!n)return;
  const arc=(2*Math.PI)/n;
  for(let i=0;i<n;i++){
    const a0=i*arc-Math.PI/2+ (rot||0),a1=a0+arc;
    cx.beginPath();cx.moveTo(cx0,cy0);cx.arc(cx0,cy0,R,a0,a1);cx.closePath();
    cx.fillStyle=segCs[i%segCs.length];cx.fill();
    if(lw>0){cx.lineWidth=lw;cx.strokeStyle=bcol;cx.stroke()}
    cx.save();cx.translate(cx0,cy0);cx.rotate(a0+arc/2);
    cx.fillStyle=tcol;cx.font='700 '+(n>12?10:n>8?12:14)+'px Inter, sans-serif';
    cx.textAlign='right';cx.textBaseline='middle';
    cx.fillText((segments[i].label||'').slice(0,24),R-14,0);
    cx.restore()
  }
  cx.beginPath();cx.arc(cx0,cy0,R-1,0,2*Math.PI);cx.lineWidth=8;cx.strokeStyle=bcol;cx.stroke();
  cx.beginPath();cx.arc(cx0,cy0,30,0,2*Math.PI);cx.fillStyle='#fff';cx.fill();
  cx.font='18px Inter';cx.textAlign='center';cx.textBaseline='middle';cx.fillText('🎯',cx0,cy0)
}

// índice de segmento bajo el puntero (arriba) dado el ángulo actual
function segIdxAt(){
  const n=segments.length;if(!n)return 0;
  let f=(POINTER_OFFSET-(rot||0))%(2*Math.PI);if(f<0)f+=2*Math.PI;
  const arc=2*Math.PI/n;
  return Math.floor(f/arc)%n;
}

// giro con destino FIJO: el servidor ya eligió el segmento; animamos hasta él
function spinTo(targetIdx,done){
  const n=segments.length;if(!n)return;
  spinning=true;
  $('scr-form').classList.add('hidden');
  $('scr-spinning').classList.remove('hidden');
  const arc=2*Math.PI/n;
  // rotación final tal que el centro del segmento target quede bajo el puntero (arriba):
  // el puntero apunta al ángulo -π/2. centro del segmento i = i*arc + arc/2 (medido desde -π/2).
  const center=targetIdx*arc+arc/2;
  // rot tal que (POINTER_OFFSET - rot) mod 2π == center  →  rot = POINTER_OFFSET - center
  let finalRot=POINTER_OFFSET-center;
  // normalizar a rot actual + vueltas
  const turns=6;
  while(finalRot<=rot+turns*2*Math.PI-arc*0.45)finalRot+=2*Math.PI;
  const dur=(data&&data.design&&data.design.duration?data.design.duration:6)*1000;
  const st=Date.now(),sr=rot;
  let lastSeg=-1;
  (function an(){
    const p=Math.min((Date.now()-st)/dur,1);
    const e=p===1?1:1-Math.pow(2,-10*p);
    rot=sr+(finalRot-sr)*e;draw();
    const seg=segIdxAt();
    if(seg!==lastSeg){lastSeg=seg;sTick()}
    if(p<1)requestAnimationFrame(an);
    else{rot=finalRot;draw();spinning=false;done()}
  })()
}

// ===== FLUJO =====
function renderForm(){
  const t=(data&&data.texts)||{};
  $('g-title').textContent=t.title||'¡Gira la ruleta y gana!';
  $('g-desc').textContent=t.description||'';
  $('g-desc').style.display=t.description?'block':'none';
  $('btn-play').textContent=t.button||'Probar Suerte';
  const f=(data&&data.form)||{};
  $('f-name').style.display=f.name?'block':'none';
  $('f-apellido').style.display=f.apellido?'block':'none';
  $('f-phone').style.display=f.phone?'block':'none';
  if(f.consent_text){$('f-consent-row').style.display='flex';$('f-consent-text').textContent=f.consent_text}
  else{$('f-consent-row').style.display='none'}
  const d=(data&&data.design)||{};
  document.getElementById('app').style.backgroundColor=d.bg_color||bgc;
  $('btn-play').style.backgroundColor=d.button_color||'#ec4899';
  $('g-title').style.color=d.text_color||'#fff';
  $('g-desc').style.color=d.text_color||'#fff';
}
function renderResult(r){
  const t=(data&&data.texts)||{};
  $('res-emoji').textContent=r.prize.win?'🎉':(r.prize.type==='sin_premio'?'😔':'🎁');
  $('res-title').textContent=r.prize.win?(t.winTitle||'Felicitaciones, ¡has ganado!'):(t.loseTitle||'¡Oh! Parece que has perdido');
  $('res-desc').textContent=r.prize.win?(t.winDesc||''):(t.loseDesc||'');
  $('res-prize').textContent=r.prize.label;
  $('res-prize-box').classList.toggle('hidden',!r.prize.win);
  const link=(r.prize.type==='enlace'&&r.prize.value)?r.prize.value:null;
  if(link){$('res-prize-box').innerHTML='<a href="'+esc(link)+'" target="_blank" rel="noopener" data-style="color:#fff;font-weight:800">Abrir enlace →</a>'}
  else if(r.prize.type==='enlace'){/* sin valor */}
  else{$('res-prize-box').innerHTML='<span class="fzp-prize-label">🎁 Tu premio</span><span id="res-prize" class="fzp-prize">'+esc(r.prize.label)+'</span>'+(r.prize.type==='cupon'&&r.prize.value?'<span id="res-value" class="fzp-value">Código: '+esc(r.prize.value)+'</span>':'')}
  if(data.certificate){$('btn-cert').style.display='block'}
  // jugar de nuevo según modo (paridad AppSorteos)
  const pa=(data&&data.play_again)||{mode:'auto',every:3};
  paCount++;
  let show=false;
  if(pa.mode==='always'||pa.mode==='win')show=r.prize.win;
  else if(pa.mode==='lose')show=!r.prize.win;
  else if(pa.mode==='auto')show=(paCount>=pa.every);
  $('btn-again').style.display=show?'block':'none';
  // compartir
  if(data.share_buttons){
    $('res-share').classList.remove('hidden');
    const txt=(r.prize.win?'¡Gané '+r.prize.label+' en ':'Participé en ')+(data.name||'la promoción');
    const url=window.location.href;
    $('sh-wa').href='https://wa.me/?text='+encodeURIComponent(txt+' '+url);
    $('sh-fb').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    $('sh-x').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(txt+'&url='+encodeURIComponent(url));
  }
  if(r.prize.win){sWin();burstConfetti()}else{sLose()}
}
function downloadCert(){
  if(!playResult){toast('Gira primero');return}
  window.open(API+'/fortunas/'+data.id+'/certificate?play='+encodeURIComponent(playResult.playId),'_blank')
}
function play(){
  if(spinning)return;
  const email=$('f-email').value.trim();
  const err=$('form-err');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Ingresa un email válido';return}
  if($('f-consent-row').style.display!=='none'&&!$('f-consent').checked){err.textContent='Debes aceptar para participar';return}
  err.textContent='';
  $('btn-play').disabled=true;
  fetch(API+'/fortunas/'+data.id+'/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    email:email,
    name:$('f-name').value.trim()||null,
    apellido:$('f-apellido').value.trim()||null,
    phone:$('f-phone').value.trim()||null,
    consent:$('f-consent').checked,
    deviceId:deviceId
  })}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(j){
    playResult=j;
    spinTo(j.segmentIndex,function(){
      $('scr-spinning').classList.add('hidden');
      $('scr-result').classList.remove('hidden');
      renderResult(j)
    })
  }).catch(function(e){
    $('btn-play').disabled=false;
    err.textContent=e.message||'No se pudo participar'
  })
}
function playAgain(){
  $('btn-again').style.display='none';
  $('btn-cert').style.display='none';
  $('res-share').classList.add('hidden');
  $('scr-result').classList.add('hidden');
  $('scr-form').classList.remove('hidden');
  $('f-email').value='';$('f-name').value='';$('f-apellido').value='';$('f-phone').value='';
  $('btn-play').disabled=false;
  $('form-err').textContent='';
  paCount=0;playing=true;
  toast('Regístrate de nuevo para otra oportunidad');
}

// ===== CARGA =====
function init(){
  try{deviceId=localStorage.getItem('fz_device')||null;if(!deviceId){deviceId='xxxxxxxx'.replace(/x/g,function(){return '0123456789abcdef'[Math.floor(Math.random()*16)]})+Date.now().toString(36);localStorage.setItem('fz_device',deviceId)}}catch(e){}
  const m=window.location.pathname.match(/\/fortuna\/([a-f0-9-]{36})\/jugar/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  fetch(API+'/fortunas/'+m[1]+'/public').then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(d){
    data=d;
    segments=d.segments||[];
    const design=d.design||{};
    bgc=design.bg_color||bgc;
    segCs=design.segment_colors||segCs;
    tcol=design.wheel_text_color||tcol;
    bcol=design.border_color||bcol;
    lw=design.lines!=null?design.lines:2;
    soundOn=d.play_sounds!==false;
    document.getElementById('app').style.backgroundColor=bgc;
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderForm();
    draw();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=e.message||'Error al cargar';
  })
}
init();
