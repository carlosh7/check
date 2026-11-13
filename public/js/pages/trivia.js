// ===== Trivia promocional — EDITOR (P3 — paridad AppSorteos — v12.44.834) =====
// Juego de preguntas con captura de leads: preguntas (2-4 respuestas, 1 correcta),
// retroalimentación, temporizador, nota de aprobación y premio al aprobar.
// Enlace compartido: las trivias PUBLICADAS se editan sin clave (política ruleta).
// CSP: TODOS los estilos generados van con data-style (nunca style=).

let API='/api',data=null,questions=[],config=null,currentId=null,editIndex=-1;
let previewPage='welcome';

// textos por idioma (paridad AppSorteos "Bienvenido al Quiz")
const LANGS={
 es:{wt:'Bienvenido al Quiz',wd:'¡Resuelve las preguntas de este quiz y demuestra cuánto sabes!',sb:'Comenzar',ft:'Felicitaciones, ¡has terminado!',fd:'Tu puntuación: [score]',cb:'Descargar comprobante'},
 en:{wt:'Welcome to the Quiz',wd:'Answer the questions of this quiz and show how much you know!',sb:'Start',ft:'Congratulations, you have finished!',fd:'Your score: [score]',cb:'Download receipt'},
 pt:{wt:'Bem-vindo ao Quiz',wd:'Responda às perguntas deste quiz e mostre o quanto você sabe!',sb:'Começar',ft:'Parabéns, você terminou!',fd:'Sua pontuação: [score]',cb:'Baixar comprovante'},
 fr:{wt:'Bienvenue au Quiz',wd:'Répondez aux questions de ce quiz et montrez ce que vous savez !',sb:'Commencer',ft:'Félicitations, vous avez terminé !',fd:'Votre score : [score]',cb:'Télécharger le reçu'},
 tr:{wt:'Quiz’e Hoş Geldiniz',wd:'Bu quizin sorularını cevaplayın ve ne bildiğinizi gösterin!',sb:'Başla',ft:'Tebrikler, bitirdiniz!',fd:'Puanınız: [score]',cb:'Makbuzu indir'},
 de:{wt:'Willkommen zum Quiz',wd:'Beantworte die Fragen dieses Quiz und zeige, wie viel du weißt!',sb:'Starten',ft:'Gratulation, du hast es geschafft!',fd:'Deine Punkte: [score]',cb:'Beleg herunterladen'},
 ja:{wt:'クイズへようこそ',wd:'このクイズの問題を解いて、あなたの知識を示しましょう！',sb:'開始',ft:'おめでとう、完了しました！',fd:'あなたのスコア: [score]',cb:'証明書をダウンロード'}
};
// 10 temas en tonos azules (paridad AppSorteos, versión Trivia)
const THEMES=[
 {name:'Océano',    bg:'#1e3a5f',txt:'#ffffff',btn:'#0ea5e9',acc:'#fbbf24'},
 {name:'Cielo',     bg:'#0c4a6e',txt:'#ffffff',btn:'#38bdf8',acc:'#fde047'},
 {name:'Medianoche',bg:'#0f172a',txt:'#e2e8f0',btn:'#3b82f6',acc:'#fbbf24'},
 {name:'Azur',      bg:'#1e40af',txt:'#ffffff',btn:'#60a5fa',acc:'#fde047'},
 {name:'Turquesa',  bg:'#134e4a',txt:'#ffffff',btn:'#14b8a6',acc:'#fde047'},
 {name:'Índigo',    bg:'#312e81',txt:'#ffffff',btn:'#818cf8',acc:'#fbbf24'},
 {name:'Cobalto',   bg:'#0e7490',txt:'#ffffff',btn:'#22d3ee',acc:'#fef08a'},
 {name:'Grafito',   bg:'#18181b',txt:'#e4e4e7',btn:'#38bdf8',acc:'#22d3ee'},
 {name:'Marino',    bg:'#172554',txt:'#dbeafe',btn:'#1d4ed8',acc:'#fbbf24'},
 {name:'Hielo',     bg:'#334155',txt:'#f8fafc',btn:'#0ea5e9',acc:'#f43f5e'}
];
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function $(id){return document.getElementById(id)}
let toastTimer=null;
function toast(msg,type){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show'+(type==='err'?' err':'');el.style.display='block';if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.style.display='none';el.className='toast'},2500)}
function getToken(){try{return localStorage.getItem('token')||null}catch(e){return null}}
function api(path,opts){opts=opts||{};const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});const tk=getToken();if(tk)h['Authorization']='Bearer '+tk;return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})}

// ===== PESTAÑAS / COLAPSO =====
function switchTab(tab,el){
  document.querySelectorAll('.tv__config__menu-item').forEach(function(e){e.classList.remove('active')});
  if(el)el.classList.add('active');
  ['general','preguntas','design','seguridad','form'].forEach(function(t){
    const el2=$('tab-'+t);if(el2)el2.classList.toggle('hidden',t!==tab)
  });
  window.scrollTo(0,0)
}
function toggleCollapse(head,bodyId){
  const b=$(bodyId);if(!b)return;
  b.classList.toggle('hidden');
  if(head)head.classList.toggle('collapsed')
}

// ===== PREGUNTAS (en memoria; se persisten al guardar) =====
function renderQuestions(){
  $('q-count').textContent='Preguntas ('+questions.length+')';
  $('stat-questions').textContent=questions.length;
  const LET=['A','B','C','D'];
  if(!questions.length){
    $('question-list').innerHTML='<div class="tv-hint" data-style="text-align:center;padding:10px">Aún no hay preguntas. Crea una o cárgalas desde CSV.</div>';
    renderPreview();return
  }
  $('question-list').innerHTML=questions.map(function(q,i){
    const correct=(q.answers&&q.answers[q.correct_index])?q.answers[q.correct_index]:'—';
    return '<div class="tv-q-row">'+
      '<div data-style="flex:1;min-width:0">'+
        '<div data-style="font-size:12.5px;font-weight:700;color:#1e293b;line-height:1.35">'+(i+1)+'. '+esc(q.question)+'</div>'+
        '<div data-style="font-size:11px;color:#059669;margin-top:2px">✔ Correcta: '+esc(correct)+'</div>'+
        '<div data-style="font-size:11px;color:#94a3b8;margin-top:2px">'+q.answers.map(function(a,ai){return LET[ai]+') '+esc(a)}).join(' · ')+'</div>'+
      '</div>'+
      '<button class="tv-del" title="Editar" data-act="call" data-call="editQuestion" data-a1="'+i+'" data-style="color:#0369a1">✏️</button>'+
      '<button class="tv-del" title="Eliminar" data-act="call" data-call="delQuestion" data-a1="'+i+'">✕</button>'+
    '</div>'
  }).join('');
  renderPreview()
}
function openQuestionModal(){editIndex=-1;fillQuestionModal(null);$('qm-err').textContent='';$('question-modal').classList.add('show')}
function editQuestion(i){editIndex=parseInt(i);fillQuestionModal(questions[editIndex]);$('qm-err').textContent='';$('question-modal').classList.add('show')}
function fillQuestionModal(q){
  $('q-modal-title').textContent=q?'Editar pregunta '+(editIndex+1):'Nueva pregunta';
  $('qm-question').value=q?q.question:'';
  for(let i=0;i<4;i++){
    $('qm-a'+i).value=(q&&q.answers&&q.answers[i])?q.answers[i]:'';
    $('qm-c'+i).checked=!!(q&&q.correct_index===i);
  }
}
function confirmQuestion(){
  const question=$('qm-question').value.trim();
  const answers=[];
  for(let i=0;i<4;i++){const v=$('qm-a'+i).value.trim();if(v)answers.push(v)}
  let correct=-1;
  for(let i=0;i<4;i++){if($('qm-c'+i).checked)correct=i}
  if(!question){$('qm-err').textContent='Escribe la pregunta';return}
  if(answers.length<2){$('qm-err').textContent='Necesitas al menos 2 respuestas';return}
  if(correct<0){$('qm-err').textContent='Marca cuál respuesta es la correcta';return}
  if(correct>=answers.length){$('qm-err').textContent='La correcta debe ser una respuesta con texto';return}
  const item={question:question,answers:answers,correct_index:correct};
  if(editIndex>=0)questions[editIndex]=item;else questions.push(item);
  $('question-modal').classList.remove('show');
  renderQuestions();
  toast(editIndex>=0?'✏️ Pregunta actualizada':'＋ Pregunta añadida','ok');
}
function delQuestion(i){
  if(!confirm('¿Eliminar esta pregunta? (se aplica al guardar)'))return;
  questions.splice(parseInt(i),1);renderQuestions()
}

// ===== IMPORTAR CSV =====
function openCsvModal(){$('csv-text').value='';$('csv-err').textContent='';$('csv-modal').classList.add('show')}
function parseCsvTriviaLocal(csv){
  const out=[];let skipped=0;
  String(csv||'').split(/\r?\n/).forEach(function(line){
    const raw=line.trim();
    if(!raw)return;
    const parts=(raw.indexOf(';')!==-1?raw.split(';'):raw.split(',')).map(function(p){return p.trim()});
    if(parts.length<3){skipped++;return}
    const question=parts[0].replace(/^"|"$/g,'');
    if(!question||/^pregunta$/i.test(question)){skipped++;return}
    const rawIdx=parts[parts.length-1].replace(/^"|"$/g,'');
    const answers=parts.slice(1,-1).map(function(a){return a.replace(/^"|"$/g,'')}).filter(Boolean).slice(0,4);
    if(answers.length<2){skipped++;return}
    let correct=-1;
    if(/^[A-Da-d]$/.test(rawIdx))correct='abcd'.indexOf(rawIdx.toLowerCase());
    else{
      const n=parseInt(rawIdx,10);
      if(!isNaN(n)){
        if(n>=0&&n<answers.length)correct=n;
        else if(n===answers.length)correct=answers.length-1; // tolerar 1-based
      }
    }
    if(!question||correct<0||correct>=answers.length){skipped++;return}
    out.push({question:question,answers:answers,correct_index:correct});
  });
  return {questions:out,skipped:skipped};
}
function confirmCsv(){
  const parsed=parseCsvTriviaLocal($('csv-text').value);
  if(!parsed.questions.length){$('csv-err').textContent='No se reconoció ninguna pregunta (formato: pregunta;r1;r2;r3;r4;índice)';return}
  const room=200-questions.length;
  const toAdd=parsed.questions.slice(0,Math.max(room,0));
  questions=questions.concat(toAdd);
  $('csv-modal').classList.remove('show');
  renderQuestions();
  toast('📋 '+toAdd.length+' preguntas importadas'+(parsed.skipped?' ('+parsed.skipped+' líneas omitidas)':'')+(toAdd.length<parsed.questions.length?' — límite 200':''),'ok');
}

// ===== TEMAS =====
function renderThemes(){
  $('theme-ps').innerHTML=THEMES.map(function(t,i){
    return '<div class="tv-theme-dot" data-act="call" data-call="useTheme" data-a1="'+i+'" data-style="background:'+t.bg+'" title="'+t.name+'"><span data-style="display:block;width:10px;height:10px;border-radius:50%;background:'+t.btn+';margin:auto"></span></div>'
  }).join('')
}
function useTheme(i){
  const t=THEMES[parseInt(i)];if(!t)return;
  config.design.bg_color=t.bg;
  config.design.text_color=t.txt;
  config.design.button_color=t.btn;
  config.design.accent_color=t.acc;
  syncDesignInputs();refreshP()
}

// ===== PREVIEW =====
function setPreview(el){
  previewPage=el?el.value:($('pv-page')?$('pv-page').value:'welcome');
  renderPreview()
}
function scoreLabel(score,total){
  if(config.scoring==='fraction')return score+'/'+total;
  if(config.scoring==='none')return '';
  return Math.round(score*100/Math.max(total,1))+'%';
}
function renderPreview(){
  const t=(config&&config.texts)||{};
  const quiz=(config&&config.quiz)||{};
  const page=previewPage;
  const box=$('pv-box');
  box.style.backgroundColor=(config&&config.design&&config.design.bg_color)||'#1e3a5f';
  box.style.color=(config&&config.design&&config.design.text_color)||'#ffffff';
  $('pv-btn').style.backgroundColor=(config&&config.design&&config.design.button_color)||'#0ea5e9';
  $('pv-final-btn').style.backgroundColor=(config&&config.design&&config.design.button_color)||'#0ea5e9';
  $('pv-qnum').style.backgroundColor=(config&&config.design&&config.design.accent_color)||'#fbbf24';
  $('pv-qnum').style.color='#1e293b';
  // formulario mock según config.form
  const extras=document.querySelectorAll('.tvi-input--extra');
  const f=(config&&config.form)||{};
  extras.forEach(function(el,ix){el.style.display=(ix===0&&f.name)||(ix===1&&f.apellido)||(ix===2&&f.phone)?'block':'none'});
  $('pv-welcome').classList.toggle('hidden',page!=='welcome');
  $('pv-question').classList.toggle('hidden',page!=='question');
  $('pv-final').classList.toggle('hidden',page!=='final');
  if(page==='question'){
    // demo: primera pregunta (o una de muestra)
    const q=questions[0]||{question:'¿Cuál es la capital de Francia?',answers:['Madrid','París','Roma','Londres']};
    const total=Math.max(questions.length,1);
    $('pv-qnum').textContent=quiz.show_question_numbers===false?'':'1/'+total;
    $('pv-qnum').style.display=quiz.show_question_numbers===false?'none':'inline-block';
    $('pv-qtext').textContent=q.question;
    const LET=['A','B','C','D'];
    $('pv-answers').innerHTML=q.answers.map(function(a,ai){
      const tag=quiz.indicator==='letters'?LET[ai]:(quiz.indicator==='numbers'?String(ai+1):'');
      return '<div class="tvi-ans" data-style="background:rgba(255,255,255,.12)">'+(tag?'<b class="tvi-tag" data-style="background:'+(config.design.accent_color||'#fbbf24')+'">'+tag+'</b>':'')+esc(a)+'</div>'
    }).join('')
  }
  if(page==='final'){
    $('pv-final-title').textContent=t.final_title||'Felicitaciones, ¡has terminado!';
    const demo=config.scoring==='none'?'':'92%';
    $('pv-final-desc').textContent=(t.final_desc||'Tu puntuación: [score]').replace('[score]',demo);
    const pop=config.prize_on_pass;
    $('pv-final-prize').style.display=(pop&&pop.label)?'inline-block':'none';
    $('pv-final-prize').textContent='🎁 '+(pop&&pop.label?pop.label:'');
    $('pv-final-btn').style.display=config.final_button==='none'?'none':'inline-block';
    $('pv-final-btn').textContent=config.final_button==='redirect'?'Continuar':'Reintentar';
  }
}

// ===== REFRESH EN VIVO =====
function refreshP(){
  $('pv-title').textContent=($('txt-welcome-t').value||config.texts.welcome_title||'');
  $('pv-desc').textContent=$('txt-welcome-d').value||config.texts.welcome_desc||'';
  $('pv-btn').textContent=$('txt-start-b').value||config.texts.start_button||'Comenzar';
  config.design.bg_color=$('c-bg').value;
  config.design.text_color=$('c-txt').value;
  config.design.button_color=$('c-btn').value;
  config.design.accent_color=$('c-acc').value;
  renderPreview()
}
function syncDesignInputs(){
  $('c-bg').value=config.design.bg_color;$('v-bg').textContent=config.design.bg_color;
  $('c-txt').value=config.design.text_color;$('v-txt').textContent=config.design.text_color;
  $('c-btn').value=config.design.button_color;$('v-btn').textContent=config.design.button_color;
  $('c-acc').value=config.design.accent_color;$('v-acc').textContent=config.design.accent_color;
}
function applyLang(){
  const key=$('cfg-lang').value;
  const L=LANGS[key]||LANGS.es;
  $('txt-welcome-t').value=L.wt;$('txt-welcome-d').value=L.wd;$('txt-start-b').value=L.sb;
  $('txt-final-t').value=L.ft;$('txt-final-d').value=L.fd;$('txt-cert-b').value=L.cb;
  refreshP();toast('Textos restaurados al idioma','ok')
}

// ===== GUARDAR / PUBLICAR =====
function buildPayload(status){
  return {
    name:$('tv-name').value.trim()||'Trivia sin nombre',
    status:status,
    config:collectConfig(),
    questions:questions
  }
}
function collectConfig(){
  return {
    language:$('cfg-lang').value,
    texts:{
      welcome_title:$('txt-welcome-t').value.trim(),
      welcome_desc:$('txt-welcome-d').value.trim(),
      start_button:$('txt-start-b').value.trim(),
      final_title:$('txt-final-t').value.trim(),
      final_desc:$('txt-final-d').value.trim(),
      certificate:$('txt-cert-b').value.trim()
    },
    quiz:{
      time_limit:parseInt($('cfg-timer').value)||0,
      feedback:$('cfg-feedback').value,
      indicator:$('cfg-indicator').value,
      passing_grade:parseInt($('cfg-grade').value)||0,
      shuffle_questions:$('cfg-shuffle-q').checked,
      shuffle_answers:$('cfg-shuffle-a').checked,
      music:$('cfg-music').checked,
      show_question_numbers:$('cfg-numbers').checked
    },
    scoring:$('cfg-scoring').value,
    final_button:$('cfg-finalbtn').value,
    redirect_url:$('cfg-redirect').value.trim(),
    design:{bg_color:$('c-bg').value,text_color:$('c-txt').value,button_color:$('c-btn').value,accent_color:$('c-acc').value},
    form:{email:true,name:$('fm-name').checked,apellido:$('fm-apellido').checked,phone:$('fm-phone').checked,consent_text:$('fm-consent').value.trim()},
    security:{max_per_email:parseInt($('sec-max').value)||1,allowed_emails:$('sec-allowed').value.split('\n').map(function(s){return s.trim()}).filter(Boolean),device_limit:$('sec-device').value,device_max:parseInt($('sec-device-max').value)||1},
    share_buttons:$('cfg-share').checked,
    certificate:$('cfg-cert').checked,
    prize_on_pass:config.prize_on_pass||null
  }
}
function saveT(publish){
  if(!$('tv-name').value.trim()){toast('Ponle un nombre','err');return}
  if(!questions.length){toast('Agrega al menos 1 pregunta','err');return}
  const bad=questions.find(function(q){return !q.question.trim()||q.answers.length<2||q.correct_index==null||q.correct_index>=q.answers.length});
  if(bad){toast('Hay preguntas incompletas','err');return}
  const body=buildPayload(publish?'published':undefined);
  const logged=!!getToken();
  const p=logged
    ? api('/trivias/'+currentId,{method:'PUT',body:JSON.stringify(body)})
    : api('/trivias/'+currentId+'/public-config',{method:'PUT',body:JSON.stringify({config:body.config,questions:body.questions})});
  return p.then(function(){
    if(publish)data._published=true;
    toast(publish?'🚀 ¡Trivia publicada!':'💾 Guardado','ok');
    updateShareUrls();
  }).catch(function(e){toast('Error: '+e.message,'err');throw e})
}
function publishT(){
  saveT(true).then(function(){
    // tras publicar, abrir el juego en pestaña nueva
    updateShareUrls();
    const url=$('share-url').value;
    if(url)window.open(url,'_blank')
  }).catch(function(){})
}
function updateShareUrls(){
  const slug=((data&&data.event_name)||'evento').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  $('share-url').value=window.location.origin+'/'+slug+'/trivia/'+currentId+'/jugar';
  $('share-url-edit').value=window.location.origin+'/'+slug+'/trivia/'+currentId;
}
function openShare(){
  updateShareUrls();
  $('share-modal').classList.add('show')
}
function copyLink(){
  const u=$('share-url').value;
  navigator.clipboard.writeText(u).then(function(){toast('✅ Enlace copiado','ok');$('share-modal').classList.remove('show')}).catch(function(){$('share-url').select();document.execCommand('copy');toast('✅ Enlace copiado','ok')})
}
function closeModal(id){$(id).classList.remove('show')}

// ===== EXTRAS =====
function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('stage').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
function reloadPage(){window.location.reload()}

// ===== CARGA =====
function load(id){
  const p=getToken()?api('/trivias/'+id):api('/trivias/'+id+'/public-editor');
  p.then(function(t){
    data={id:t.id,event_id:t.event_id,event_name:t.event_name,views:t.views||0,status:t.status};
    currentId=t.id;
    config=Object.assign({
      language:'es',
      texts:{},quiz:{},design:{},form:{},security:{},
      scoring:'percentage',final_button:'retry',redirect_url:'',
      share_buttons:true,certificate:false,prize_on_pass:null
    },t.config||{});
    // rellenar huecos con la plantilla
    const def={texts:{},quiz:{},design:{},form:{},security:{}};
    ['texts','quiz','design','form','security'].forEach(function(k){config[k]=Object.assign(def[k],config[k]||{})});
    questions=(t.questions||[]).map(function(q){
      return {question:q.question,answers:(q.answers||[]).slice(),correct_index:parseInt(q.correct_index)||0}
    });
    $('loading').classList.add('hidden');
    $('hero-stats').classList.remove('hidden');
    $('tv-name').value=t.name||'';
    $('stat-views').textContent=data.views;
    $('stat-plays').textContent='-';
    $('stat-questions').textContent=questions.length;
    $('cfg-lang').value=config.language||'es';
    const L=LANGS[config.language]||LANGS.es; // idioma desconocido → español
    $('txt-welcome-t').value=config.texts.welcome_title||L.wt;
    $('txt-welcome-d').value=config.texts.welcome_desc||L.wd;
    $('txt-start-b').value=config.texts.start_button||L.sb;
    $('txt-final-t').value=config.texts.final_title||L.ft;
    $('txt-final-d').value=config.texts.final_desc||L.fd;
    $('txt-cert-b').value=config.texts.certificate||L.cb;
    $('cfg-music').checked=config.quiz.music===true;
    $('cfg-shuffle-q').checked=config.quiz.shuffle_questions===true;
    $('cfg-shuffle-a').checked=config.quiz.shuffle_answers===true;
    $('cfg-numbers').checked=config.quiz.show_question_numbers!==false;
    $('cfg-share').checked=config.share_buttons===true;
    $('cfg-cert').checked=config.certificate===true;
    $('cfg-feedback').value=config.quiz.feedback||'selected';
    $('cfg-indicator').value=config.quiz.indicator||'none';
    $('cfg-timer').value=String(config.quiz.time_limit||0);
    $('cfg-grade').value=String(config.quiz.passing_grade||0);
    $('cfg-scoring').value=config.scoring||'percentage';
    $('cfg-finalbtn').value=config.final_button||'retry';
    $('cfg-redirect').value=config.redirect_url||'';
    $('fm-name').checked=(config.form.name===true);
    $('fm-apellido').checked=(config.form.apellido===true);
    $('fm-phone').checked=(config.form.phone===true);
    $('fm-consent').value=config.form.consent_text||'';
    $('sec-max').value=String(config.security.max_per_email!=null?config.security.max_per_email:1);
    $('sec-allowed').value=(config.security.allowed_emails||[]).join('\n');
    $('sec-device').value=config.security.device_limit||'off';
    $('sec-device-max').value=String(config.security.device_max!=null?config.security.device_max:1);
    syncDesignInputs();
    renderThemes();renderQuestions();renderPreview();
    updateShareUrls();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=/publicadas/i.test(e.message)?'Esta trivia no está publicada. Ábrela desde la app (Configuración del evento → Promociones) o publícala.':(e.message||'Error al cargar');
  })
}

function init(){
  const m=window.location.pathname.match(/\/trivia\/([a-f0-9-]{36})/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  load(m[1])
}
init();
