// ===== Tragamonedas — PÁGINA DE JUEGO pública (P4 — v12.44.834) =====
// Formulario de registro → POST /play (el servidor elige el premio por probabilidades
// y devuelve SUS símbolos) → la máquina jala la palanca, los 3 rodillos giran con
// símbolos aleatorios y caen escalonadamente en la combinación final →
// páginas de ganador/perdedor.

let API='/api',data=null,spinning=false,deviceId=null,playResult=null;
let soundOn=true,paCount=0,playing=true,idleTimer=null,spinInts=[],spinOuts=[];

const POOL=['🍒','🍋','🔔','💎','7️⃣','🍇','⭐','🎁'];
// colores por defecto = plantilla del servidor
const DEF={bg:'#7c2d12',mch:'#f59e0b',reel:'#fffbeb',tm:'#7c2d12',btn:'#f59e0b',style:'rounded'};

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
let toastTimer=null;
function toast(msg){const el=$('toast');el.textContent=msg;el.className='slp-toast show';clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='slp-toast'},2600)}
function reloadPage(){window.location.reload()}

// ===== SONIDO (WebAudio sintetizado, paridad fortuna) =====
let actx=null,lastTick=0;
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
function sTick(){const now=Date.now();if(now-lastTick<90)return;lastTick=now;beep(700+Math.random()*250,.04,'square',.05)}
function sWin(){[523,659,784,1047].forEach(function(f,i){beep(f,.22,'triangle',.14,i*.16)})}
function sLose(){beep(300,.2,'sawtooth',.08);beep(220,.28,'sawtooth',.08,.16)}

// ===== CONFETI propio (paridad fortuna) =====
function burstConfetti(){
  try{
    const cv=$('jsccc');if(!cv)return;
    cv.width=window.innerWidth;cv.height=window.innerHeight;
    const cx=cv.getContext('2d');
    const colors=['#fde047','#fb923c','#f87171','#fbbf24','#fff7ed','#fff'];
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

// ===== MÁQUINA (aplicar diseño — element.style vía JS, CSP friendly) =====
function machineRadius(style){return style==='square'?'0px':(style==='semi'?'12px':'24px')}
function reelRadius(style){return style==='square'?'0px':(style==='semi'?'8px':'12px')}
function applyMachineDesign(machine){
  const d=(data&&data.design)||{};
  const rad=d.machine_style||DEF.style;
  machine.style.backgroundColor=d.machine_color||DEF.mch;
  machine.style.borderRadius=machineRadius(rad);
  const mq=machine.querySelector('.slp-machine__marquee');
  if(mq){mq.style.borderRadius=machineRadius(rad);mq.style.color=d.text_color_machine||DEF.tm}
  machine.querySelectorAll('.slp-reel').forEach(function(r){
    r.style.backgroundColor=d.reel_bg||DEF.reel;
    r.style.color=d.text_color_machine||DEF.tm;
    r.style.borderRadius=reelRadius(rad);
  });
}
function setReels(ids,syms){ids.forEach(function(id,i){const el=$(id);if(el)el.textContent=syms[i]})}
function randomSyms(){const a=[];for(let i=0;i<3;i++)a.push(POOL[Math.floor(Math.random()*POOL.length)]);return a}

// reposo: los rodillos cambian solos suave (se detiene al jugar)
function startIdle(){
  stopIdle();
  idleTimer=setInterval(function(){setReels(['r0','r1','r2'],randomSyms())},1100);
}
function stopIdle(){if(idleTimer){clearInterval(idleTimer);idleTimer=null}}
function clearSpinTimers(){
  spinInts.forEach(function(t){clearInterval(t)});
  spinOuts.forEach(function(t){clearTimeout(t)});
  spinInts=[];spinOuts=[];
}

// giro con destino FIJO: el servidor ya eligió el premio y devolvió SU combinación;
// cada rodillo cambia de símbolo cada ~80ms y para escalonado en el símbolo final
// (con la duración por defecto 6s: rodillo 1 a los 2s, 2 a los 2.6s, 3 a los 3.2s)
function spinToSymbols(finalSyms,done){
  spinning=true;
  stopIdle();
  setReels(['s0','s1','s2'],[ $('r0').textContent,$('r1').textContent,$('r2').textContent ]);
  $('scr-form').classList.add('hidden');
  $('scr-spinning').classList.remove('hidden');
  const dur=(data&&data.design&&data.design.duration?data.design.duration:6)*1000;
  const stops=[dur/3,dur*13/30,dur*8/15];
  const ids=['s0','s1','s2'];
  ids.forEach(function(id,i){
    const el=$(id);
    el.classList.remove('landed');
    spinInts[i]=setInterval(function(){el.textContent=POOL[Math.floor(Math.random()*POOL.length)];sTick()},80);
    spinOuts[i]=setTimeout(function(){
      // parar SOLO este rodillo en el símbolo final del resultado del servidor
      clearInterval(spinInts[i]);
      el.textContent=finalSyms[i];
      el.classList.add('landed');
    },stops[i]);
  });
  setTimeout(function(){
    clearSpinTimers();
    ids.forEach(function(id){$(id).classList.remove('landed')});
    spinning=false;
    done();
  },stops[2]+300);
}

// ===== FLUJO =====
function renderForm(){
  const t=(data&&data.texts)||{};
  $('g-title').textContent=t.title||'¡Pon a prueba tu suerte jalando la palanca!';
  $('g-title2').textContent=$('g-title').textContent;
  $('g-desc').textContent=t.description||'';
  $('g-desc').style.display=t.description?'block':'none';
  $('btn-play').textContent=t.button||'Jalar Palanca';
  const f=(data&&data.form)||{};
  $('f-name').style.display=f.name?'block':'none';
  $('f-apellido').style.display=f.apellido?'block':'none';
  $('f-phone').style.display=f.phone?'block':'none';
  if(f.consent_text){$('f-consent-row').style.display='flex';$('f-consent-text').textContent=f.consent_text}
  else{$('f-consent-row').style.display='none'}
  const d=(data&&data.design)||{};
  document.getElementById('app').style.backgroundColor=d.bg_color||DEF.bg;
  $('btn-play').style.backgroundColor=d.button_color||DEF.btn;
  $('g-desc').style.color=d.text_color||'#fff';
  applyMachineDesign($('m-form'));
  applyMachineDesign($('m-spin'));
}
function renderResult(r){
  const t=(data&&data.texts)||{};
  $('res-emoji').textContent=r.prize.win?'🎉':(r.prize.type==='sin_premio'?'😔':'🎁');
  $('res-title').textContent=r.prize.win?(t.winTitle||'¡Jackpot! ¡Has ganado!'):(t.loseTitle||'¡Oh! La palanca no te acompañó');
  $('res-desc').textContent=r.prize.win?(t.winDesc||''):(t.loseDesc||'');
  const box=$('res-prize-box');
  if(r.prize.win)box.classList.remove('hidden');else box.classList.add('hidden');
  // combinación que salió en los rodillos
  const syms=Array.isArray(r.symbols)?r.symbols:[];
  $('res-symbols').textContent=syms.join(' ');
  const link=(r.prize.type==='enlace'&&r.prize.value)?r.prize.value:null;
  if(link){box.innerHTML='<span class="slp-symbols">'+esc(syms.join(' '))+'</span><a href="'+esc(link)+'" target="_blank" rel="noopener" data-style="color:#fff;font-weight:800;font-size:18px">Abrir enlace →</a>'}
  else{box.innerHTML='<span class="slp-symbols">'+esc(syms.join(' '))+'</span><span class="slp-prize-label">🎁 Tu premio</span><span class="slp-prize">'+esc(r.prize.label)+'</span>'+(r.prize.type==='cupon'&&r.prize.value?'<span class="slp-value">Código: '+esc(r.prize.value)+'</span>':'')}
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
  if(!playResult){toast('Jala la palanca primero');return}
  window.open(API+'/slots/'+data.id+'/certificate?play='+encodeURIComponent(playResult.playId),'_blank')
}
function play(){
  if(spinning)return;
  const email=$('f-email').value.trim();
  const err=$('form-err');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Ingresa un email válido';return}
  if($('f-consent-row').style.display!=='none'&&!$('f-consent').checked){err.textContent='Debes aceptar para participar';return}
  err.textContent='';
  $('btn-play').disabled=true;
  fetch(API+'/slots/'+data.id+'/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    email:email,
    name:$('f-name').value.trim()||null,
    apellido:$('f-apellido').value.trim()||null,
    phone:$('f-phone').value.trim()||null,
    consent:$('f-consent').checked,
    deviceId:deviceId
  })}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(j){
    playResult=j;
    const finalSyms=(Array.isArray(j.symbols)&&j.symbols.length===3)?j.symbols:['🍒','🍋','🔔'];
    spinToSymbols(finalSyms,function(){
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
  startIdle();
  toast('Regístrate de nuevo para otra oportunidad');
}

// ===== CARGA =====
function init(){
  try{deviceId=localStorage.getItem('slot_device')||null;if(!deviceId){deviceId='xxxxxxxx'.replace(/x/g,function(){return '0123456789abcdef'[Math.floor(Math.random()*16)]})+Date.now().toString(36);localStorage.setItem('slot_device',deviceId)}}catch(e){}
  const m=window.location.pathname.match(/\/tragamonedas\/([a-f0-9-]{36})\/jugar/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  fetch(API+'/slots/'+m[1]+'/public').then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(d){
    data=d;
    soundOn=d.play_sounds!==false;
    document.getElementById('app').style.backgroundColor=(d.design&&d.design.bg_color)||DEF.bg;
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderForm();
    startIdle();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=e.message||'Error al cargar';
  })
}
init();
