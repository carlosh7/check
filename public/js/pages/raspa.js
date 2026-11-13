// ===== Raspa y Gana — EDITOR (P2 — paridad AppSorteos — v12.44.834) =====
// Promoción con captura de leads: premios por tarjeta (Sin Premio/Premio/Cupón/Enlace),
// probabilidades (limitar chances) y stock (limitar cantidades).
// Enlace compartido: las promociones PUBLICADAS se editan sin clave (política ruleta).
// Preview: una TARJETA de raspar (div) + formulario al lado. Sin canvas de ruleta.

let API='/api',data=null,prizes=[],config=null,currentId=null;
let previewPage='form',lastResult=null;

const LANGS={
 es:{t:'¡Raspa y gana premios!',d:'- Ingresa tu email para jugar.\n- Puedes raspar una vez.\n- ¡Buena suerte!',b:'Probar Suerte'},
 en:{t:'Scratch and win prizes!',d:'- Enter your email to play.\n- You can scratch once.\n- Good luck!',b:'Try your luck'},
 pt:{t:'Raspe e ganhe prêmios!',d:'- Digite seu email para jogar.\n- Você pode raspar uma vez.\n- Boa sorte!',b:'Teste sua sorte'},
 fr:{t:'Grattez et gagnez des prix !',d:'- Entrez votre email pour jouer.\n- Vous pouvez gratter une fois.\n- Bonne chance !',b:'Tentez votre chance'},
 tr:{t:'Kazı ve ödül kazan!',d:'- Oynamak için e-postanızı girin.\n- Bir kez kazıyabilirsiniz.\n- İyi şanslar!',b:'Şansını dene'},
 de:{t:'Kratze und gewinne Preise!',d:'- Gib deine E-Mail ein, um zu spielen.\n- Du kannst einmal kratzen.\n- Viel Glück!',b:'Dein Glück versuchen'},
 ja:{t:'スクラッチして賞品を当てよう！',d:'- メールを入力してプレイ。\n- スクラッチできるのは1回だけ。\n- 幸運を！',b:'運試し'}
};
// 10 temas propios morados/dorados (paridad AppSorteos: temas con nombre)
// bg=fondo, btn=botón, raspa=raspadita (capa dorada), rtxt=texto sobre raspadita, card=tarjeta
const THEMES=[
 {name:'Morado Real', bg:'#6d28d9',btn:'#f59e0b',raspa:'#d4a017',rtxt:'#7c2d12',card:'#f59e0b'},
 {name:'Lavanda',     bg:'#4c1d95',btn:'#8b5cf6',raspa:'#d4a017',rtxt:'#4c1d95',card:'#c4b5fd'},
 {name:'Dorado',      bg:'#78350f',btn:'#f59e0b',raspa:'#fbbf24',rtxt:'#78350f',card:'#f59e0b'},
 {name:'Medianoche',  bg:'#0f172a',btn:'#38bdf8',raspa:'#eab308',rtxt:'#0f172a',card:'#facc15'},
 {name:'Grafito',     bg:'#18181b',btn:'#e4e4e7',raspa:'#d4a017',rtxt:'#fef3c7',card:'#a16207'},
 {name:'Uva',         bg:'#581c87',btn:'#c084fc',raspa:'#e9d5ff',rtxt:'#581c87',card:'#d8b4fe'},
 {name:'Ámbar',       bg:'#451a03',btn:'#fbbf24',raspa:'#fcd34d',rtxt:'#451a03',card:'#f59e0b'},
 {name:'Ciruela',     bg:'#701a45',btn:'#f472b6',raspa:'#d4a017',rtxt:'#701a45',card:'#fbbf24'},
 {name:'Esmeralda',   bg:'#064e3b',btn:'#10b981',raspa:'#d4a017',rtxt:'#064e3b',card:'#6ee7b7'},
 {name:'Hielo',       bg:'#334155',btn:'#0ea5e9',raspa:'#e2e8f0',rtxt:'#334155',card:'#cbd5e1'}
];
// colores de punto por premio (no hay segmentos de ruleta: paleta fija de identificación)
const DOTS=['#d4a017','#7c3aed','#f59e0b','#10b981','#0ea5e9','#ef4444','#ec4899','#64748b','#84cc16','#f97316'];
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function $(id){return document.getElementById(id)}
let toastTimer=null;
function toast(msg,type){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show'+(type==='err'?' err':'');el.style.display='block';if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.style.display='none';el.className='toast'},2500)}
function getToken(){try{return localStorage.getItem('token')||null}catch(e){return null}}
function api(path,opts){opts=opts||{};const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});const tk=getToken();if(tk)h['Authorization']='Bearer '+tk;return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})}

// ===== PREVIEW =====
function setPreview(val,el){
  previewPage=el?el.value:($('pv-page')?$('pv-page').value:'form');
  renderPreview()
}
function renderPreview(){
  const t=(config&&config.texts)||{};
  const page=$('pv-page');
  const mode=page?page.value:'form';
  const formBox=document.querySelector('.rz-pv__form');
  const resBox=$('pv-result');
  $('pv-title').textContent=t.title||'¡Raspa y gana premios!';
  $('pv-desc').textContent=t.description||'';
  $('pv-desc').style.display=(t.description)?'block':'none';
  $('pv-btn').textContent=t.button||'Probar Suerte';
  const d=(config&&config.design)||{};
  const stage=$('stage');
  stage.style.backgroundColor=d.bg_color||'#6d28d9';
  stage.style.color=d.text_color||'#ffffff';
  $('pv-btn').style.backgroundColor=d.button_color||'#f59e0b';
  // tarjeta de raspar (solo apariencia en el editor)
  const card=$('pv-card');
  if(card){
    card.textContent=d.raspadita_texto||'Raspa y Gana';
    card.style.backgroundColor=d.raspadita_color||'#d4a017';
    card.style.color=d.text_color_raspa||'#7c2d12';
  }
  const wrap=$('pv-card-wrap');
  if(wrap)wrap.style.backgroundColor=d.card_color||'#f59e0b';
  // formulario: campos según config.form
  const extras=document.querySelectorAll('.rz-input--extra');
  const f=(config&&config.form)||{};
  if(extras.length>=3){
    extras[0].style.display=f.name?'block':'none';
    extras[1].style.display=f.apellido?'block':'none';
    extras[2].style.display=f.phone?'block':'none'
  }
  if(mode==='form'||!lastResult){
    if(formBox)formBox.style.display='flex';
    if(resBox)resBox.classList.add('hidden');
    return
  }
  if(formBox)formBox.style.display='none';
  if(resBox){
    resBox.classList.remove('hidden');
    const win=mode==='win';
    $('pv-res-emoji').textContent=win?'🎉':'😔';
    $('pv-res-title').textContent=win?(t.winTitle||'Felicitaciones, ¡has ganado!'):(t.loseTitle||'¡Oh! Parece que has perdido');
    $('pv-res-desc').textContent=win?(t.winDesc||''):(t.loseDesc||'');
    const demo=prizes.find(function(p){return p.type==='cupon'||p.type==='premio'});
    $('pv-res-prize').textContent=win?('🎁 '+(demo?demo.label:'Tu premio')):'😔 ¡Sigue intentando!'
  }
}

function switchTab(tab,el){
  document.querySelectorAll('.rz__config__menu-item').forEach(function(e){e.classList.remove('active')});
  if(el)el.classList.add('active');
  ['general','premios','design','seguridad','form'].forEach(function(t){
    const el2=$('tab-'+t);if(el2)el2.classList.toggle('hidden',t!==tab)
  });
  window.scrollTo(0,0)
}
function toggleCollapse(head,bodyId){
  const b=$(bodyId);if(!b)return;
  b.classList.toggle('hidden');
  if(head)head.classList.toggle('collapsed')
}

// ===== PREMIOS =====
function renderPrizes(){
  $('prize-count').textContent='Premios ('+prizes.length+')';
  const limQ=$('cfg-quantities').checked,limC=$('cfg-chances').checked;
  $('prize-list').innerHTML=prizes.map(function(p,i){
    const tipos=[['sin_premio','Sin Premio'],['premio','Premio'],['cupon','Cupón'],['enlace','Enlace']];
    return '<div class="rz-prize-row">'+
      '<span class="rz-dot" data-style="background:'+DOTS[i%DOTS.length]+'"></span>'+
      '<select data-act="call" data-call="onPrizeType" data-a1="'+i+'" data-a2="@this.value">'+
        tipos.map(function(t){return '<option value="'+t[0]+'"'+(p.type===t[0]?' selected':'')+'>'+t[1]+'</option>'}).join('')+
      '</select>'+
      '<input placeholder="Texto del premio" maxlength="60" value="'+esc(p.label)+'" data-act="call" data-call="onPrizeLabel" data-a1="'+i+'" data-a2="@this.value">'+
      (p.type==='cupon'||p.type==='enlace'?'<input placeholder="Valor" maxlength="60" value="'+esc(p.value||'')+'" data-act="call" data-call="onPrizeValue" data-a1="'+i+'" data-a2="@this.value">':'')+
      (limQ?'<input class="rz-sm" type="number" min="0" placeholder="Stock" value="'+(p.quantity!=null?p.quantity:'')+'" title="Cantidad" data-act="call" data-call="onPrizeQty" data-a1="'+i+'" data-a2="@this.value">':'')+
      (limC?'<input class="rz-sm" type="number" min="0" max="100" placeholder="%" value="'+(p.chance!=null?p.chance:'')+'" title="Chance %" data-act="call" data-call="onPrizeChance" data-a1="'+i+'" data-a2="@this.value">':'')+
      '<button class="rz-del" data-act="call" data-call="delPrize" data-a1="'+i+'">✕</button>'+
    '</div>'
  }).join('');
  renderPreview()
}
function addPrize(){
  prizes.push({type:'sin_premio',label:'¡Sigue intentando!',value:'',quantity:null,chance:null});
  renderPrizes()
}
function delPrize(i){
  if(prizes.length<=2){toast('Mínimo 2 premios','err');return}
  prizes.splice(parseInt(i),1);renderPrizes()
}
function onPrizeType(i,v){prizes[parseInt(i)].type=v;renderPrizes()}
function onPrizeLabel(i,v){prizes[parseInt(i)].label=v}
function onPrizeValue(i,v){prizes[parseInt(i)].value=v}
function onPrizeQty(i,v){prizes[parseInt(i)].quantity=v===''?null:parseInt(v)}
function onPrizeChance(i,v){prizes[parseInt(i)].chance=v===''?null:parseFloat(v)}

// ===== TEMAS =====
function renderThemes(){
  $('theme-ps').innerHTML=THEMES.map(function(t,i){
    const s=[t.bg,t.btn,t.raspa,t.card].map(function(c){return'<span data-style="background:'+c+'"></span>'}).join('');
    return '<div class="rz-theme-dot" data-act="call" data-call="useTheme" data-a1="'+i+'" title="'+t.name+'">'+s+'</div>'
  }).join('')
}
function useTheme(i){
  const t=THEMES[parseInt(i)];if(!t)return;
  config.design.bg_color=t.bg;
  config.design.button_color=t.btn;
  config.design.raspadita_color=t.raspa;
  config.design.text_color_raspa=t.rtxt;
  config.design.card_color=t.card;
  syncDesignInputs();refreshP()
}

// ===== REFRESH EN VIVO =====
function refreshP(){
  $('pv-title').textContent=($('txt-title').value||config.texts.title||'');
  $('pv-desc').textContent=$('txt-desc').value||config.texts.description||'';
  $('pv-btn').textContent=$('txt-button').value||config.texts.button||'Probar Suerte';
  config.design.bg_color=$('c-bg').value;
  config.design.text_color=$('c-txt').value;
  config.design.button_color=$('c-btn').value;
  config.design.raspadita_color=$('c-raspa').value;
  config.design.raspadita_texto=$('txt-raspa-texto').value.trim()||'Raspa y Gana';
  config.design.text_color_raspa=$('c-raspa-txt').value;
  config.design.card_color=$('c-card').value;
  const stage=$('stage');
  stage.style.backgroundColor=config.design.bg_color;
  stage.style.color=config.design.text_color;
  $('pv-btn').style.backgroundColor=config.design.button_color;
  renderPreview()
}
function syncDesignInputs(){
  $('c-bg').value=config.design.bg_color;$('v-bg').textContent=config.design.bg_color;
  $('c-txt').value=config.design.text_color;$('v-txt').textContent=config.design.text_color;
  $('c-btn').value=config.design.button_color;$('v-btn').textContent=config.design.button_color;
  $('c-raspa').value=config.design.raspadita_color||'#d4a017';$('v-raspa').textContent=config.design.raspadita_color||'#d4a017';
  $('txt-raspa-texto').value=config.design.raspadita_texto||'Raspa y Gana';
  $('c-raspa-txt').value=config.design.text_color_raspa||'#7c2d12';$('v-raspa-txt').textContent=config.design.text_color_raspa||'#7c2d12';
  $('c-card').value=config.design.card_color||'#f59e0b';$('v-card').textContent=config.design.card_color||'#f59e0b'
}
function applyLang(){
  const key=$('cfg-lang').value;
  const L=LANGS[key]||LANGS.es;
  $('txt-title').value=L.t;$('txt-desc').value=L.d;$('txt-button').value=L.b;
  refreshP();toast('Textos restaurados al idioma','ok')
}

// ===== GUARDAR / PUBLICAR =====
function buildPayload(status){
  return {
    name:$('rz-name').value.trim()||'Promoción sin nombre',
    status:status,
    config:collectConfig(),
    prizes:prizes
  }
}
function collectConfig(){
  return {
    language:$('cfg-lang').value,
    texts:{title:$('txt-title').value.trim(),description:$('txt-desc').value.trim(),button:$('txt-button').value.trim(),winTitle:$('txt-wint').value.trim(),winDesc:$('txt-wind').value.trim(),loseTitle:$('txt-loset').value.trim(),loseDesc:$('txt-losed').value.trim()},
    design:{bg_color:$('c-bg').value,text_color:$('c-txt').value,button_color:$('c-btn').value,raspadita_color:$('c-raspa').value,raspadita_texto:$('txt-raspa-texto').value.trim()||'Raspa y Gana',text_color_raspa:$('c-raspa-txt').value,card_color:$('c-card').value},
    form:{email:true,name:$('fm-name').checked,apellido:$('fm-apellido').checked,phone:$('fm-phone').checked,consent_text:$('fm-consent').value.trim()},
    security:{max_per_email:parseInt($('sec-max').value)||1,allowed_emails:$('sec-allowed').value.split('\n').map(function(s){return s.trim()}).filter(Boolean),device_limit:$('sec-device').value,device_max:parseInt($('sec-device-max').value)||1},
    limit_chances:$('cfg-chances').checked,
    limit_quantities:$('cfg-quantities').checked,
    play_sounds:$('cfg-snd').checked,
    share_buttons:$('cfg-share').checked,
    certificate:$('cfg-cert').checked,
    play_again_mode:$('cfg-pa').value,
    play_again_every:parseInt($('cfg-pa-n').value)||3
  }
}
function saveF(publish){
  if(!$('rz-name').value.trim()){toast('Ponle un nombre','err');return}
  const bad=prizes.find(function(p){return !p.label.trim()||((p.type==='cupon'||p.type==='enlace')&&!String(p.value||'').trim())});
  if(bad){toast('Hay premios incompletos','err');return}
  const body=buildPayload(publish?'published':undefined);
  const logged=!!getToken();
  const p=logged
    ? api('/raspas/'+currentId,{method:'PUT',body:JSON.stringify(body)})
    : api('/raspas/'+currentId+'/public-config',{method:'PUT',body:JSON.stringify({config:body.config,prizes:body.prizes})});
  return p.then(function(){
    if(publish)config._published=true;
    toast(publish?'🚀 ¡Promoción publicada!':'💾 Guardado','ok');
    updateShareUrls();
  }).catch(function(e){toast('Error: '+e.message,'err');throw e})
}
function publishF(){
  saveF(true).then(function(){
    // tras publicar, abrir el juego en pestaña nueva
    updateShareUrls();
    const url=$('share-url').value;
    if(url)window.open(url,'_blank')
  }).catch(function(){})
}
function updateShareUrls(){
  const slug=((data&&data.event_name)||'evento').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  $('share-url').value=window.location.origin+'/'+slug+'/raspa/'+currentId+'/jugar';
  $('share-url-edit').value=window.location.origin+'/'+slug+'/raspa/'+currentId;
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

// ===== MIS PROMOCIONES (requiere sesión) =====
function loadMis(){
  const eId=window._eventId;
  if(!eId){$('mis-list').innerHTML='<div class="rz-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
  fetch(API+'/raspas/events/'+eId+'/raspas').then(function(r){return r.json()}).then(function(list){
    if(!Array.isArray(list)){$('mis-list').innerHTML='<div class="rz-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
    if(!list.length){$('mis-list').innerHTML='<div class="rz-hint">No hay promociones guardadas</div>';return}
    $('mis-list').innerHTML=list.map(function(f){const s=f.stats||{};return'<div data-style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer" data-act="call" data-call="loadF" data-a1="'+f.id+'" data-a2="'+esc(f.name||'')+'"><div><div data-style="font-weight:700;font-size:12.5px">'+(f.name||'Sin nombre')+'</div><div data-style="font-size:11px;color:#9ca3af">'+(f.prizeCount||0)+' premios · '+s.plays+' jugadas · '+s.views+' vistas</div></div><button data-style="background:none;border:none;color:#ef4444;font-size:13px;cursor:pointer" data-act="call" data-stop="1" data-call="delF" data-a1="'+f.id+'">🗑️</button></div>'}).join('')
  }).catch(function(){})
}
function loadF(id,name){
  window.location.search='';
  load(id)
}
function delF(id){if(!confirm('¿Eliminar promoción?'))return;fetch(API+'/raspas/'+id,{method:'DELETE'}).then(function(){loadMis()}).catch(function(){})}

// ===== EXTRAS =====
function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('stage').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
function reloadPage(){window.location.reload()}

// ===== CARGA =====
function load(id){
  const p=getToken()?api('/raspas/'+id):api('/raspas/'+id+'/public-editor');
  p.then(function(f){
    data={id:f.id,event_id:f.event_id,event_name:f.event_name,views:f.views||0,status:f.status};
    currentId=f.id;
    config=Object.assign({
      language:'es',
      texts:{},design:{},form:{},security:{},
      limit_chances:false,limit_quantities:false,
      play_sounds:true,share_buttons:false,certificate:false,
      play_again_mode:'auto',play_again_every:3
    },f.config||{});
    // rellenar huecos con la plantilla
    const def={texts:{},design:{},form:{},security:{}};
    ['texts','design','form','security'].forEach(function(k){config[k]=Object.assign(def[k],config[k]||{})});
    prizes=(f.prizes||[]).map(function(x){return {type:x.type,label:x.label,value:x.value||'',quantity:x.quantity,chance:x.chance}});
    $('loading').classList.add('hidden');
    $('hero-stats').classList.remove('hidden');
    $('rz-name').value=f.name||'';
    $('stat-views').textContent=data.views;
    $('stat-plays').textContent='-';
    $('stat-prizes').textContent=prizes.length;
    $('cfg-lang').value=config.language||'es';
    $('txt-title').value=config.texts.title||LANGS[config.language||'es'].t;
    $('txt-desc').value=config.texts.description||LANGS[config.language||'es'].d;
    $('txt-button').value=config.texts.button||LANGS[config.language||'es'].b;
    $('txt-wint').value=config.texts.winTitle||'Felicitaciones, ¡has ganado!';
    $('txt-wind').value=config.texts.winDesc||'';
    $('txt-loset').value=config.texts.loseTitle||'¡Oh! Parece que has perdido';
    $('txt-losed').value=config.texts.loseDesc||'';
    $('cfg-snd').checked=config.play_sounds!==false;
    $('cfg-share').checked=config.share_buttons===true;
    $('cfg-cert').checked=config.certificate===true;
    $('cfg-pa').value=config.play_again_mode||'auto';
    $('cfg-pa-n').value=String(config.play_again_every||3);
    $('cfg-chances').checked=config.limit_chances===true;
    $('cfg-quantities').checked=config.limit_quantities===true;
    $('fm-name').checked=(config.form.name===true);
    $('fm-apellido').checked=(config.form.apellido===true);
    $('fm-phone').checked=(config.form.phone===true);
    $('fm-consent').value=config.form.consent_text||'';
    $('sec-max').value=String(config.security.max_per_email!=null?config.security.max_per_email:1);
    $('sec-allowed').value=(config.security.allowed_emails||[]).join('\n');
    $('sec-device').value=config.security.device_limit||'off';
    $('sec-device-max').value=String(config.security.device_max!=null?config.security.device_max:1);
    syncDesignInputs();
    renderThemes();renderPrizes();renderPreview();loadMis();
    updateShareUrls();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=/publicadas/i.test(e.message)?'Esta promoción no está publicada. Ábrela desde la app (Configuración del evento → Promociones) o publícala.':(e.message||'Error al cargar');
  })
}

function init(){
  const m=window.location.pathname.match(/\/raspa\/([a-f0-9-]{36})/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  const id=m[1];
  load(id)
}
init();
