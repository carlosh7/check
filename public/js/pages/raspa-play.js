// ===== Raspa y Gana — PÁGINA DE JUEGO pública (P2 — v12.44.834) =====
// Formulario de registro → el servidor elige el premio (POST /play) → aparece la
// TARJETA con capa dorada que se raspa con el mouse/dedo (canvas +
// globalCompositeOperation='destination-out'). Al descubrirse >55% se revela
// automáticamente el resultado DEBAJO de la tarjeta → ganador/perdedor.
// Nota CSP: los estilos dinámicos van por CSSOM (element.style.*) o data-style en
// HTML generado — nunca el atributo style="..." (lo bloquea style-src-attr).

let API='/api',data=null,prizeResult=null,deviceId=null,played=false,revealed=false;
let bgc='#6d28d9',coatingColor='#d4a017',coatingText='Raspa y Gana',coatingTextColor='#7c2d12',cardColor='#f59e0b',btnColor='#f59e0b';
let soundOn=true,paCount=0;
// estado del raspado
let scratching=false,erasedMoves=0,scratchRatio=0;
const SCRATCH_RADIUS=18,REVEAL_AT=0.55;

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
let toastTimer=null;
function toast(msg){const el=$('toast');el.textContent=msg;el.className='rzp-toast show';clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='rzp-toast'},2600)}
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
// rasqueta: chasquidos cortos mientras se raspa
function sScrape(){beep(2200+Math.random()*600,.03,'square',.03)}
function sWin(){[523,659,784,1047].forEach(function(f,i){beep(f,.22,'triangle',.14,i*.16)})}
function sLose(){beep(300,.2,'sawtooth',.08);beep(220,.28,'sawtooth',.08,.16)}

// ===== CONFETI propio =====
function burstConfetti(){
  try{
    const cv=$('jsccc');if(!cv)return;
    cv.width=window.innerWidth;cv.height=window.innerHeight;
    const cx=cv.getContext('2d');
    const colors=['#fde047','#d4a017','#a78bfa','#6ee7b7','#7dd3fc','#fff'];
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

// ===== TARJETA DE RASPAR (canvas) =====
function getCanvas(){return $('scanvas')}
// pinta la capa dorada sobre TODA la tarjeta (se vuelve a llamar al jugar de nuevo)
function drawCoating(){
  const cv=getCanvas();if(!cv)return;
  const cx=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  cx.globalCompositeOperation='source-over';
  cx.clearRect(0,0,W,H);
  // fondo metálico de la raspadita (degradado del color configurado)
  const g=cx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,shade(coatingColor,18));
  g.addColorStop(.5,coatingColor);
  g.addColorStop(1,shade(coatingColor,-16));
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  // brillos diagonales (efecto foil)
  cx.save();
  cx.globalAlpha=.14;cx.fillStyle='#fff';
  for(let i=-H;i<W;i+=46){cx.beginPath();cx.moveTo(i,0);cx.lineTo(i+26,0);cx.lineTo(i+26-H,H);cx.lineTo(i-H,H);cx.closePath();cx.fill()}
  cx.restore();
  // texto de la raspadita centrado (se adapta al largo)
  const label=coatingText||'Raspa y Gana';
  cx.fillStyle=coatingTextColor||'#7c2d12';
  cx.font='900 '+(label.length>14?22:label.length>10?26:30)+'px Inter, sans-serif';
  cx.textAlign='center';cx.textBaseline='middle';
  cx.fillText(label,W/2,H/2-26);
  cx.font='700 13px Inter, sans-serif';
  cx.globalAlpha=.75;
  cx.fillText('✨ 👆 ✨',W/2,H/2+22);
  cx.globalAlpha=1;
}
// aclarar/oscurecer un color hex (utilidad del degradado)
function shade(hex,amt){
  try{
    let h=String(hex||'#d4a017').replace('#','');
    if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');
    const n=parseInt(h,16);
    const r=Math.min(255,Math.max(0,(n>>16)+amt)),g=Math.min(255,Math.max(0,((n>>8)&255)+amt)),b=Math.min(255,Math.max(0,(n&255)+amt));
    return 'rgb('+r+','+g+','+b+')'
  }catch(e){return hex}
}
// coordenada del puntero dentro del canvas (escalada al tamaño real del bitmap)
function canvasPos(e){
  const cv=getCanvas();if(!cv)return null;
  const r=cv.getBoundingClientRect();
  const t=(e.touches&&e.touches[0])?e.touches[0]:e;
  return {x:(t.clientX-r.left)*cv.width/r.width,y:(t.clientY-r.top)*cv.height/r.height};
}
function scratchAt(pos){
  const cv=getCanvas();if(!cv)return;
  const cx=cv.getContext('2d');
  cx.globalCompositeOperation='destination-out';
  cx.beginPath();cx.arc(pos.x,pos.y,SCRATCH_RADIUS,0,2*Math.PI);cx.fill();
  erasedMoves++;
  if(erasedMoves%6===0){sScrape();checkRatio()}
}
// muestrea el canal alfa (1 de cada 8 píxeles) para saber cuánta capa quedó
function checkRatio(){
  if(revealed)return;
  const cv=getCanvas();if(!cv)return;
  try{
    const img=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let clear=0,total=0;
    for(let i=3;i<img.length;i+=32){total++;if(img[i]===0)clear++}
    scratchRatio=total?clear/total:0;
    if(scratchRatio>REVEAL_AT)reveal();
  }catch(e){}
}
function reveal(){
  if(revealed||!prizeResult)return;
  revealed=true;
  const cv=getCanvas();
  if(cv)cv.getContext('2d').clearRect(0,0,cv.width,cv.height);
  const wrap=$('card-wrap');if(wrap)wrap.classList.add('revealed');
  const hint=$('card-hint');if(hint)hint.style.visibility='hidden';
  renderResult(prizeResult);
  const resBox=$('scratch-result');
  if(resBox){resBox.classList.remove('hidden');try{resBox.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}}
}

// eventos de puntero (mouse + touch) sobre el canvas
function bindScratch(){
  const cv=getCanvas();if(!cv)return;
  function down(e){if(!played||revealed)return;e.preventDefault();scratching=true;ac();scratchAt(canvasPos(e))}
  function move(e){
    if(!scratching||revealed)return;
    e.preventDefault();
    scratchAt(canvasPos(e));
  }
  function up(){if(scratching){scratching=false;checkRatio()}}
  cv.addEventListener('mousedown',down);
  window.addEventListener('mousemove',move);
  window.addEventListener('mouseup',up);
  cv.addEventListener('touchstart',down,{passive:false});
  cv.addEventListener('touchmove',move,{passive:false});
  cv.addEventListener('touchend',up);
  cv.addEventListener('touchcancel',up);
}

// ===== FLUJO =====
function renderForm(){
  const t=(data&&data.texts)||{};
  $('g-title').textContent=t.title||'¡Raspa y gana premios!';
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
  $('btn-play').style.backgroundColor=d.button_color||btnColor;
  $('g-title').style.color=d.text_color||'#fff';
  $('g-desc').style.color=d.text_color||'#fff';
  // tarjeta: color de tarjeta (marco) detrás de la raspadita
  const wrap=$('card-wrap');
  if(wrap)wrap.style.backgroundColor=d.card_color||cardColor;
}
function renderResult(r){
  const t=(data&&data.texts)||{};
  $('res-emoji').textContent=r.prize.win?'🎉':(r.prize.type==='sin_premio'?'😔':'🎁');
  $('res-title').textContent=r.prize.win?(t.winTitle||'Felicitaciones, ¡has ganado!'):(t.loseTitle||'¡Oh! Parece que has perdido');
  $('res-desc').textContent=r.prize.win?(t.winDesc||''):(t.loseDesc||'');
  const link=(r.prize.type==='enlace'&&r.prize.value)?r.prize.value:null;
  if(link){
    $('res-prize-box').innerHTML='<span class="rzp-prize-label">🎁 Tu premio</span><span class="rzp-prize">'+esc(r.prize.label)+'</span><a href="'+esc(link)+'" target="_blank" rel="noopener" data-style="color:#fff;font-weight:800">Abrir enlace →</a>';
  }else{
    $('res-prize-box').innerHTML='<span class="rzp-prize-label">'+(r.prize.win?'🎁 Tu premio':'🎫 Resultado')+'</span><span class="rzp-prize">'+esc(r.prize.label)+'</span>'+(r.prize.type==='cupon'&&r.prize.value?'<span class="rzp-value">Código: '+esc(r.prize.value)+'</span>':'');
  }
  $('res-prize-box').classList.remove('hidden');
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
  if(!prizeResult){toast('Raspa primero');return}
  window.open(API+'/raspas/'+data.id+'/certificate?play='+encodeURIComponent(prizeResult.playId),'_blank')
}
function play(){
  if(played)return;
  const email=$('f-email').value.trim();
  const err=$('form-err');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Ingresa un email válido';return}
  if($('f-consent-row').style.display!=='none'&&!$('f-consent').checked){err.textContent='Debes aceptar para participar';return}
  err.textContent='';
  $('btn-play').disabled=true;
  fetch(API+'/raspas/'+data.id+'/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    email:email,
    name:$('f-name').value.trim()||null,
    apellido:$('f-apellido').value.trim()||null,
    phone:$('f-phone').value.trim()||null,
    consent:$('f-consent').checked,
    deviceId:deviceId
  })}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(j){
    prizeResult=j;
    played=true;
    // ocultar el formulario y activar la raspadita (el premio YA lo decidió el servidor)
    $('form-box').classList.add('hidden');
    const hint=$('card-hint');if(hint)hint.style.visibility='visible';
    const cv=getCanvas();if(cv){cv.style.cursor='crosshair';cv.style.pointerEvents='auto'}
    toast('Raspa la tarjeta con el dedo o el mouse 👆');
  }).catch(function(e){
    $('btn-play').disabled=false;
    err.textContent=e.message||'No se pudo participar'
  })
}
function playAgain(){
  played=false;revealed=false;erasedMoves=0;scratchRatio=0;prizeResult=null;paCount=0;
  $('btn-again').style.display='none';
  $('btn-cert').style.display='none';
  $('res-share').classList.add('hidden');
  $('scratch-result').classList.add('hidden');
  const wrap=$('card-wrap');if(wrap)wrap.classList.remove('revealed');
  const hint=$('card-hint');if(hint)hint.style.visibility='hidden';
  const cv=getCanvas();if(cv){cv.style.pointerEvents='none'}
  drawCoating();
  $('form-box').classList.remove('hidden');
  $('f-email').value='';$('f-name').value='';$('f-apellido').value='';$('f-phone').value='';
  $('btn-play').disabled=false;
  $('form-err').textContent='';
  try{$('scr-form').scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
  toast('Regístrate de nuevo para otra oportunidad');
}

// ===== CARGA =====
function init(){
  try{deviceId=localStorage.getItem('rz_device')||null;if(!deviceId){deviceId='xxxxxxxx'.replace(/x/g,function(){return '0123456789abcdef'[Math.floor(Math.random()*16)]})+Date.now().toString(36);localStorage.setItem('rz_device',deviceId)}}catch(e){}
  const m=window.location.pathname.match(/\/raspa\/([a-f0-9-]{36})\/jugar/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  fetch(API+'/raspas/'+m[1]+'/public').then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(d){
    data=d;
    const design=d.design||{};
    bgc=design.bg_color||bgc;
    coatingColor=design.raspadita_color||coatingColor;
    coatingText=design.raspadita_texto||coatingText;
    coatingTextColor=design.text_color_raspa||coatingTextColor;
    cardColor=design.card_color||cardColor;
    btnColor=design.button_color||btnColor;
    soundOn=d.play_sounds!==false;
    document.getElementById('app').style.backgroundColor=bgc;
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderForm();
    // la raspadita se ve desde el inicio pero NO se puede raspar hasta participar
    const cv=getCanvas();if(cv)cv.style.pointerEvents='none';
    drawCoating();
    bindScratch();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=e.message||'Error al cargar';
  })
}
init();
