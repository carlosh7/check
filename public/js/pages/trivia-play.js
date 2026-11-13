// ===== Trivia promocional — PÁGINA DE JUEGO pública (P3 — v12.44.834) =====
// Bienvenida (registro) → preguntas (con temporizador opcional) → final con
// puntuación, premio si aprueba, reintento/redirección, compartir y comprobante.
// ANTI-TRAMPA: el listado público NO trae correct_index; el jugador elige y el
// servidor corrige al final (POST /play). Para la retroalimentación en vivo se
// consulta /verify UNA vez por respuesta ya elegida.

let API='/api',data=null,questions=[],qOrder=[],ansOrder=[],answers=[],cur=0;
let timerLeft=0,timerInt=null,timerBusy=false,deviceId=null,playResult=null;
let soundOn=true,musicInt=null,ansLock=false;

const LET=['A','B','C','D'];
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
let toastTimer=null;
function toast(msg){const el=$('toast');el.textContent=msg;el.className='tvp-toast show';clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='tvp-toast'},2600)}
function reloadPage(){window.location.reload()}

// ===== SONIDO (WebAudio sintetizado, paridad fortuna) =====
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
function sCorrect(){[523,659,784].forEach(function(f,i){beep(f,.14,'triangle',.12,i*.09)})}
function sWrong(){beep(300,.18,'sawtooth',.07);beep(220,.24,'sawtooth',.07,.14)}
function sWin(){[523,659,784,1047].forEach(function(f,i){beep(f,.22,'triangle',.14,i*.16)})}
function sLose(){beep(330,.2,'sine',.08);beep(262,.3,'sine',.08,.18)}
function sTick(){beep(880,.05,'square',.04)}
// música de fondo: arpegio suave en bucle (opcional según config.quiz.music)
const MUSIC_NOTES=[262,330,392,330,349,440,392,330];
function startMusic(){
  if(musicInt||!ac())return;
  let step=0;
  musicInt=setInterval(function(){beep(MUSIC_NOTES[step%MUSIC_NOTES.length],.3,'sine',.03);step++},420)
}
function stopMusic(){if(musicInt){clearInterval(musicInt);musicInt=null}}
function toggleMusic(){soundOn=!soundOn;if(soundOn){if(quizCfg().music&&$('scr-question')&&!$('scr-question').classList.contains('hidden'))startMusic()}else{stopMusic();toast('🔇 Sonido desactivado')}}

// ===== CONFETI propio =====
function burstConfetti(){
  try{
    const cv=$('jsccc');if(!cv)return;
    cv.width=window.innerWidth;cv.height=window.innerHeight;
    const cx=cv.getContext('2d');
    const colors=['#fde047','#7dd3fc','#6ee7b7','#f9a8d4','#c4b5fd','#fff'];
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

// ===== HELPERS DE CONFIG =====
function quizCfg(){return (data&&data.quiz)||{}}
function design(){return (data&&data.design)||{}}
function scoreLabel(score,total){
  const scoring=(data&&data.scoring)||'percentage';
  if(scoring==='fraction')return score+'/'+total;
  if(scoring==='none')return '';
  return Math.round(score*100/Math.max(total,1))+'%';
}

// ===== BIENVENIDA =====
function renderWelcome(){
  const t=(data&&data.texts)||{};
  $('g-title').textContent=t.welcome_title||'Bienvenido al Quiz';
  $('g-desc').textContent=t.welcome_desc||'';
  $('g-desc').style.display=t.welcome_desc?'block':'none';
  $('btn-start').textContent=t.start_button||'Comenzar';
  const f=(data&&data.form)||{};
  $('f-name').style.display=f.name?'block':'none';
  $('f-apellido').style.display=f.apellido?'block':'none';
  $('f-phone').style.display=f.phone?'block':'none';
  if(f.consent_text){$('f-consent-row').style.display='flex';$('f-consent-text').textContent=f.consent_text}
  else{$('f-consent-row').style.display='none'}
  // pastillas informativas
  $('w-questions').textContent='❓ '+questions.length+' pregunta'+(questions.length===1?'':'s');
  const tl=quizCfg().time_limit||0;
  if(tl>0){$('w-timer').style.display='inline-block';$('w-timer').textContent='⏱️ '+tl+'s por pregunta'}
  const pop=data&&data.prize_on_pass;
  if(pop&&pop.label){$('w-prize').style.display='inline-block';$('w-prize').textContent='🎁 '+pop.label}
  const d=design();
  $('app').style.backgroundColor=d.bg_color||'#1e3a5f';
  $('btn-start').style.backgroundColor=d.button_color||'#0ea5e9';
  $('g-title').style.color=d.text_color||'#fff';
  $('g-desc').style.color=d.text_color||'#fff';
}

// ===== FLUJO DE PREGUNTAS =====
function startQuiz(){
  if(!questions.length){toast('Esta trivia aún no tiene preguntas');return}
  const email=$('f-email').value.trim();
  const err=$('form-err');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Ingresa un email válido';return}
  if($('f-consent-row').style.display!=='none'&&!$('f-consent').checked){err.textContent='Debes aceptar para participar';return}
  err.textContent='';
  $('btn-start').disabled=true;
  // barajado (solo orden de presentación; el envío va por índice de servidor)
  qOrder=questions.map(function(_,i){return i});
  ansOrder=questions.map(function(q){return q.answers.map(function(_,i){return i})});
  const qz=quizCfg();
  if(qz.shuffle_questions)shuffle(qOrder);
  if(qz.shuffle_answers)ansOrder.forEach(function(a){shuffle(a)});
  answers=questions.map(function(){return -1});
  cur=0;playResult=null;
  if(qz.music){$('btn-music').style.display='inline-flex';startMusic()}
  $('scr-welcome').classList.add('hidden');
  $('scr-final').classList.add('hidden');
  $('scr-question').classList.remove('hidden');
  showQuestion()
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp}
  return arr
}
function stopTimer(){
  if(timerInt){clearInterval(timerInt);timerInt=null}
  $('timer').style.display='none'
}
function startTimer(){
  const tl=quizCfg().time_limit||0;
  if(tl<=0){$('timer').style.display='none';return}
  const C=2*Math.PI*30;
  $('timer').style.display='block';
  const arc=$('timer-arc');
  arc.style.strokeDasharray=String(C);
  timerLeft=tl;
  $('timer-num').textContent=String(tl);
  arc.style.strokeDashoffset='0';
  let lastWhole=tl;
  const t0=Date.now();
  timerInt=setInterval(function(){
    const elapsed=(Date.now()-t0)/1000;
    const left=Math.max(tl-elapsed,0);
    $('timer-num').textContent=String(Math.ceil(left));
    arc.style.strokeDashoffset=String(C*(elapsed/tl));
    const whole=Math.ceil(left);
    if(whole!==lastWhole){lastWhole=whole;if(whole<=5&&whole>0)sTick()}
    if(left<=0){stopTimer();onTimeout()}
  },100)
}
function showQuestion(){
  ansLock=false;
  const serverIdx=qOrder[cur];
  const q=questions[serverIdx];
  const qz=quizCfg();
  const d=design();
  // numeración "3/10"
  if(qz.show_question_numbers===false){$('q-num').style.display='none'}
  else{$('q-num').style.display='inline-block';$('q-num').textContent=(cur+1)+'/'+questions.length}
  $('q-num').style.backgroundColor=d.accent_color||'#fbbf24';
  $('q-text').textContent=q.question;
  $('q-wait').textContent='';
  // respuestas en el orden de presentación; click → posición de presentación
  $('q-answers').innerHTML=ansOrder[serverIdx].map(function(realIdx,disp){
    const tag=qz.indicator==='letters'?LET[disp]:(qz.indicator==='numbers'?String(disp+1):'');
    return '<button class="tvp-ans" data-act="call" data-call="pickAnswer" data-a1="'+disp+'">'+(tag?'<b class="tvp-tag">'+tag+'</b>':'')+'<span>'+esc(q.answers[realIdx])+'</span></button>'
  }).join('');
  startTimer()
}
function markButtons(state,chosenDisp,correctDisp){
  // state: 'selected' | 'correct' ; marca clases sin revelar más de lo debido
  const btns=$('q-answers').querySelectorAll('.tvp-ans');
  btns.forEach(function(b,i){
    if(i===chosenDisp)b.classList.add(state==='correct'?'tvp-ans--correct':'tvp-ans--selected');
    else if(state==='correct'&&correctDisp!=null&&i===correctDisp)b.classList.add('tvp-ans--correct');
    else b.classList.add('tvp-ans--dim')
  })
}
function pickAnswer(disp){
  if(ansLock)return;
  ansLock=true;
  stopTimer();
  const serverIdx=qOrder[cur];
  const realIdx=ansOrder[serverIdx][parseInt(disp)];
  answers[serverIdx]=realIdx;
  const fb=quizCfg().feedback||'selected';
  if(fb==='none'){
    // sin retroalimentación: avanza directo (sin sonidos por pregunta)
    $('q-wait').textContent='';
    setTimeout(next,150);
    return
  }
  const btns=$('q-answers').querySelectorAll('.tvp-ans');
  btns.forEach(function(b){b.disabled=true});
  $('q-wait').textContent='...';
  fetch(API+'/trivias/'+data.id+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qi:serverIdx,answer:realIdx})})
    .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})
    .then(function(v){
      const correctDisp=ansOrder[serverIdx].indexOf(v.correct_index);
      if(fb==='selected_correct'){
        // marca la elegida y la correcta en verde
        markButtons(v.correct?'correct':'wrong',parseInt(disp),v.correct?null:correctDisp);
      }else{
        // solo la seleccionada (sin revelar la correcta)
        markButtons(v.correct?'correct':'selected',parseInt(disp),null);
      }
      if(v.correct)sCorrect();else sWrong();
      setTimeout(next,900)
    }).catch(function(){
      // si verify falla, seguimos sin marcar (el servidor corregirá al final)
      setTimeout(next,150)
    })
}
function onTimeout(){
  if(ansLock)return;
  ansLock=true;
  const serverIdx=qOrder[cur];
  answers[serverIdx]=-1; // sin responder
  const btns=$('q-answers').querySelectorAll('.tvp-ans');
  btns.forEach(function(b){b.disabled=true});
  if((quizCfg().feedback||'selected')!=='none')sWrong();
  $('q-wait').textContent='⏱️ ¡Tiempo agotado!';
  setTimeout(next,900)
}
function next(){
  cur++;
  if(cur<questions.length)showQuestion();
  else finish()
}

// ===== FINAL =====
function finish(){
  stopTimer();stopMusic();
  $('scr-question').classList.add('hidden');
  $('btn-start').disabled=false;
  const body={
    email:$('f-email').value.trim(),
    name:$('f-name').value.trim()||null,
    apellido:$('f-apellido').value.trim()||null,
    phone:$('f-phone').value.trim()||null,
    consent:$('f-consent').checked,
    deviceId:deviceId,
    answers:answers
  };
  fetch(API+'/trivias/'+data.id+'/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})
    .then(function(j){
      playResult=j;
      renderFinal(j)
    }).catch(function(e){
      // seguridad (máx. por email / dispositivo / whitelist): vuelta a bienvenida con error amable
      $('scr-question').classList.add('hidden');
      $('scr-welcome').classList.remove('hidden');
      $('f-email').value='';$('f-name').value='';$('f-apellido').value='';$('f-phone').value='';
      $('form-err').textContent=e.message||'No se pudo registrar tu jugada';
    })
}
function renderFinal(r){
  const t=(data&&data.texts)||{};
  const passed=!!r.passed;
  $('res-emoji').textContent=passed?'🎉':'💪';
  $('res-title').textContent=t.final_title||'Felicitaciones, ¡has terminado!';
  $('res-desc').textContent=(t.final_desc||'Tu puntuación: [score]').replace('[score]',scoreLabel(r.score,r.total));
  // badge de aprobado solo si hay nota de aprobación
  const grade=quizCfg().passing_grade||0;
  if(grade>0){
    $('res-passed').style.display='inline-block';
    $('res-passed').textContent=passed?'✅ Aprobado ('+grade+'%)':'❌ No aprobado ('+grade+'%)';
    $('res-passed').style.backgroundColor=passed?'rgba(16,185,129,.25)':'rgba(239,68,68,.25)';
  }else{$('res-passed').style.display='none'}
  // premio
  if(r.prize&&r.prize.label){
    $('res-prize-box').classList.remove('hidden');
    $('res-prize').textContent=r.prize.label;
    $('res-value').textContent=(r.prize.type==='cupon'||r.prize.type==='enlace')&&r.prize.value?('Código: '+r.prize.value):'';
  }else{$('res-prize-box').classList.add('hidden')}
  // comprobante (solo si aprueba y está activado)
  if(data.certificate&&passed){$('btn-cert').style.display='inline-block';$('btn-cert').textContent=t.certificate||'Descargar comprobante'}
  else{$('btn-cert').style.display='none'}
  // botón final: reintentar / redirección / nada
  const fb=(data&&data.final_button)||'retry';
  if(fb==='retry'){$('btn-again').style.display='inline-block';$('btn-again').textContent='🔄 Reintentar'}
  else if(fb==='redirect'&&(data.redirect_url)){$('btn-again').style.display='inline-block';$('btn-again').textContent='Continuar →'}
  else{$('btn-again').style.display='none'}
  // compartir
  if(data.share_buttons){
    $('res-share').classList.remove('hidden');
    const txt=(passed?'¡Obtuve '+scoreLabel(r.score,r.total)+' en ':'Jugué la trivia ')+(data.name||'esta promoción');
    const url=window.location.href;
    $('sh-wa').href='https://wa.me/?text='+encodeURIComponent(txt+' '+url);
    $('sh-fb').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    $('sh-x').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(txt+'&url='+encodeURIComponent(url));
  }else{$('res-share').classList.add('hidden')}
  $('scr-final').classList.remove('hidden');
  if(passed){sWin();if(r.prize)burstConfetti()}else{sLose()}
}
function retryQuiz(){
  const fb=(data&&data.final_button)||'retry';
  if(fb==='redirect'&&data.redirect_url){window.location.href=data.redirect_url;return}
  $('btn-again').style.display='none';
  $('btn-cert').style.display='none';
  $('res-share').classList.add('hidden');
  $('scr-final').classList.add('hidden');
  $('scr-welcome').classList.remove('hidden');
  // el registro NO se repite: se vuelve a pedir el email (el servidor rechaza
  // si alcanzó el máximo por email — error amable en el formulario)
  $('f-email').value='';$('f-name').value='';$('f-apellido').value='';$('f-phone').value='';
  $('form-err').textContent='¡Bien intentado! Regístrate de nuevo para otra oportunidad.';
  $('btn-start').disabled=false;
}
function downloadCert(){
  if(!playResult){toast('Termina la trivia primero');return}
  window.open(API+'/trivias/'+data.id+'/certificate?play='+encodeURIComponent(playResult.playId),'_blank')
}

// ===== CARGA =====
function init(){
  try{deviceId=localStorage.getItem('tv_device')||null;if(!deviceId){deviceId='xxxxxxxx'.replace(/x/g,function(){return '0123456789abcdef'[Math.floor(Math.random()*16)]})+Date.now().toString(36);localStorage.setItem('tv_device',deviceId)}}catch(e){}
  const m=window.location.pathname.match(/\/trivia\/([a-f0-9-]{36})\/jugar/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  fetch(API+'/trivias/'+m[1]+'/public').then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})}).then(function(d){
    data=d;
    questions=d.questions||[];
    renderWelcome();
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=e.message||'Error al cargar';
  })
}
init();
