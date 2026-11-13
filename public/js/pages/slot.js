// ===== Tragamonedas — EDITOR (P4 — paridad AppSorteos — v12.44.834) =====
// Promoción con captura de leads: premios por combinación de símbolos
// (Sin Premio/Premio/Cupón/Enlace), probabilidades (limitar chances) y stock
// (limitar cantidades). El servidor elige el premio y devuelve SUS símbolos:
// la máquina aquí solo previsualiza combinaciones.
// Enlace compartido: las promociones PUBLICADAS se editan sin clave (política fortuna).

let API='/api',data=null,prizes=[],config=null,currentId=null,focusIdx=-1;
let previewPage='form',lastResult=null;

const LANGS={
 es:{t:'¡Pon a prueba tu suerte jalando la palanca!',d:'- Ingresa tu email para jugar.\n- Tienes un solo tirón.\n- ¡Buena suerte!',b:'Jalar Palanca'},
 en:{t:'Test your luck by pulling the lever!',d:'- Enter your email to play.\n- You only get one pull.\n- Good luck!',b:'Pull the Lever'},
 pt:{t:'Teste sua sorte puxando a alavanca!',d:'- Digite seu email para jogar.\n- Você tem apenas uma puxada.\n- Boa sorte!',b:'Puxar a Alavanca'},
 fr:{t:'Tentez votre chance en tirant le levier !',d:'- Entrez votre email pour jouer.\n- Vous n\'avez qu\'un seul tirage.\n- Bonne chance !',b:'Tirez le Levier'},
 tr:{t:'Kolu çekerek şansını dene!',d:'- Oynamak için e-postanızı girin.\n- Sadece bir çekme hakkınız var.\n- İyi şanslar!',b:'Kolu Çek'},
 de:{t:'Teste dein Glück und zieh den Hebel!',d:'- Gib deine E-Mail ein, um zu spielen.\n- Du hast nur einen Zug.\n- Viel Glück!',b:'Hebel ziehen'},
 ja:{t:'レバーを引いて運試し！',d:'- メールを入力してプレイ。\n- 引けるのは1回だけ。\n- 幸運を！',b:'レバーを引く'}
};
// 10 temas cálidos naranjas/marrones (paridad AppSorteos: máquina amarillo/naranja
// con marquesina — promoción real DFBRTS)
const THEMES=[
 {name:'Ámbar',     bg:'#7c2d12',mch:'#f59e0b',reel:'#fffbeb',btn:'#f59e0b',tm:'#7c2d12'},
 {name:'Caramelo',  bg:'#9a3412',mch:'#fb923c',reel:'#fff7ed',btn:'#fb923c',tm:'#7c2d12'},
 {name:'Cobre',     bg:'#431407',mch:'#ea580c',reel:'#fff7ed',btn:'#ea580c',tm:'#fff7ed'},
 {name:'Mostaza',   bg:'#713f12',mch:'#eab308',reel:'#fefce8',btn:'#eab308',tm:'#713f12'},
 {name:'Terracota', bg:'#7f1d1d',mch:'#f87171',reel:'#fef2f2',btn:'#f87171',tm:'#7f1d1d'},
 {name:'Chocolate', bg:'#432818',mch:'#a1662f',reel:'#fdf6ec',btn:'#d97706',tm:'#fff7ed'},
 {name:'Miel',      bg:'#78350f',mch:'#fbbf24',reel:'#fffbeb',btn:'#fbbf24',tm:'#78350f'},
 {name:'Coral',     bg:'#831843',mch:'#fb7185',reel:'#fff1f2',btn:'#fb7185',tm:'#831843'},
 {name:'Dorado',    bg:'#1c1917',mch:'#facc15',reel:'#fefce8',btn:'#facc15',tm:'#1c1917'},
 {name:'Crema',     bg:'#a16207',mch:'#fde68a',reel:'#fffdf5',btn:'#fbbf24',tm:'#78350f'}
];
// combinación por defecto cuando un premio no tiene símbolos (paridad servidor)
const DEFAULT_SYMBOLS=['🍒','🍋','🔔'];
const POOL=['🍒','🍋','🔔','💎','7️⃣','🍇','⭐','🎁'];
function normalizeSymbols(symbols){
  let arr=Array.isArray(symbols)?symbols.map(function(s){return String(s==null?'':s).trim().slice(0,12)}).filter(Boolean).slice(0,3):[];
  while(arr.length<3)arr.push(DEFAULT_SYMBOLS[arr.length]||'🍒');
  return arr;
}
function randomSyms(){const a=[];for(let i=0;i<3;i++)a.push(POOL[Math.floor(Math.random()*POOL.length)]);return a}
function langDefault(key){return LANGS[key]||LANGS.es}
function styleRadius(style){return style==='square'?'0px':(style==='semi'?'12px':'24px')}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function $(id){return document.getElementById(id)}
let toastTimer=null;
function toast(msg,type){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show'+(type==='err'?' err':'');el.style.display='block';if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.style.display='none';el.className='toast'},2500)}
function getToken(){try{return localStorage.getItem('token')||null}catch(e){return null}}
function api(path,opts){opts=opts||{};const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});const tk=getToken();if(tk)h['Authorization']='Bearer '+tk;return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})}

// ===== DIBUJO DE LA MÁQUINA (CSS puro, sin canvas — CSP friendly) =====
function renderMachine(){
  const d=(config&&config.design)||{};
  const machine=$('pv-machine');
  if(machine){
    machine.style.backgroundColor=d.machine_color||'#f59e0b';
    machine.style.borderRadius=styleRadius(d.machine_style||'rounded');
  }
  const mq=$('pv-marquee');
  if(mq){
    mq.style.borderRadius=styleRadius(d.machine_style||'rounded');
    mq.style.color=d.text_color_machine||'#7c2d12';
  }
  const t=(config&&config.texts)||{};
  $('pv-marquee-txt').textContent=t.title||langDefault(config&&config.language).t;
  const reelBg=d.reel_bg||'#fffbeb';
  const reelTc=d.text_color_machine||'#7c2d12';
  // rodillos: símbolos de la combinación enfocada o emojis aleatorios
  const syms=(focusIdx>=0&&prizes[focusIdx])?normalizeSymbols(prizes[focusIdx].symbols):randomSyms();
  for(let i=0;i<3;i++){
    const reel=$('pv-reel'+i);
    if(!reel)continue;
    reel.textContent=syms[i];
    reel.style.backgroundColor=reelBg;
    reel.style.color=reelTc;
    reel.style.borderRadius=(d.machine_style==='square'?'0px':(d.machine_style==='semi'?'8px':'12px'));
  }
}

// ===== PREVIEW =====
function setPreview(val,el){
  previewPage=el?el.value:($('pv-page')?$('pv-page').value:'form');
  renderPreview()
}
function renderPreview(){
  const t=(config&&config.texts)||{};
  const page=$('pv-page');
  const mode=page?page.value:'form';
  const formBox=document.querySelector('.sl-pv__form');
  const resBox=$('pv-result');
  $('pv-desc').textContent=t.description||'';
  $('pv-desc').style.display=(t.description)?'block':'none';
  $('pv-btn').textContent=t.button||'Jalar Palanca';
  const stage=$('stage');
  stage.style.backgroundColor=(config&&config.design&&config.design.bg_color)||'#7c2d12';
  stage.style.color=(config&&config.design&&config.design.text_color)||'#ffffff';
  $('pv-btn').style.backgroundColor=(config&&config.design&&config.design.button_color)||'#f59e0b';
  renderMachine();
  // formulario: campos según config.form
  const extras=document.querySelectorAll('.sl-input--extra');
  const f=(config&&config.form)||{};
  if(extras.length>=3){
    extras[0].style.display=f.name?'block':'none';
    extras[1].style.display=f.apellido?'block':'none';
    extras[2].style.display=f.phone?'block':'none'
  }
  if(mode==='form'){
    if(formBox)formBox.style.display='flex';
    if(resBox)resBox.classList.add('hidden');
    return
  }
  if(formBox)formBox.style.display='none';
  if(resBox){
    resBox.classList.remove('hidden');
    const win=mode==='win';
    $('pv-res-title').textContent=win?(t.winTitle||'¡Jackpot! ¡Has ganado!'):(t.loseTitle||'¡Oh! La palanca no te acompañó');
    $('pv-res-desc').textContent=win?(t.winDesc||''):(t.loseDesc||'');
    const demo=prizes.find(function(p){return p.type==='cupon'||p.type==='premio'});
    $('pv-res-prize').textContent=win?('🎁 '+(demo?demo.label:'Tu premio')):'😔 ¡No fue la combinación ganadora!'
  }
}

function switchTab(tab,el){
  document.querySelectorAll('.sl__config__menu-item').forEach(function(e){e.classList.remove('active')});
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
  $('prize-count').textContent='Combinaciones ('+prizes.length+')';
  const limQ=$('cfg-quantities').checked,limC=$('cfg-chances').checked;
  $('prize-list').innerHTML=prizes.map(function(p,i){
    const tipos=[['sin_premio','Sin Premio'],['premio','Premio'],['cupon','Cupón'],['enlace','Enlace']];
    const syms=normalizeSymbols(p.symbols);
    return '<div class="sl-prize-row'+(focusIdx===i?' sel':'')+'" data-act="call" data-call="focusPrize" data-a1="'+i+'">'+
      '<span class="sl-symsmini" title="'+esc(syms.join(' '))+'">'+esc(syms.join(''))+'</span>'+
      '<select data-act="call" data-call="onPrizeType" data-a1="'+i+'" data-a2="@this.value">'+
        tipos.map(function(t){return '<option value="'+t[0]+'"'+(p.type===t[0]?' selected':'')+'>'+t[1]+'</option>'}).join('')+
      '</select>'+
      '<input placeholder="Texto del premio" maxlength="60" value="'+esc(p.label)+'" data-act="call" data-call="onPrizeLabel" data-a1="'+i+'" data-a2="@this.value">'+
      (p.type==='cupon'||p.type==='enlace'?'<input placeholder="Valor" maxlength="60" value="'+esc(p.value||'')+'" data-act="call" data-call="onPrizeValue" data-a1="'+i+'" data-a2="@this.value">':'')+
      '<input class="sl-syms" placeholder="Símbolos: 7️⃣,7️⃣,7️⃣" maxlength="60" title="3 símbolos separados por coma" value="'+esc(syms.join(','))+'" data-act="call" data-call="onPrizeSymbols" data-a1="'+i+'" data-a2="@this.value">'+
      (limQ?'<input class="sl-sm" type="number" min="0" placeholder="Stock" value="'+(p.quantity!=null?p.quantity:'')+'" title="Cantidad" data-act="call" data-call="onPrizeQty" data-a1="'+i+'" data-a2="@this.value">':'')+
      (limC?'<input class="sl-sm" type="number" min="0" max="100" placeholder="%" value="'+(p.chance!=null?p.chance:'')+'" title="Chance %" data-act="call" data-call="onPrizeChance" data-a1="'+i+'" data-a2="@this.value">':'')+
      '<button class="sl-del" data-act="call" data-call="delPrize" data-a1="'+i+'">✕</button>'+
    '</div>'
  }).join('');
  renderMachine();renderPreview()
}
function addPrize(){
  prizes.push({type:'sin_premio',label:'¡Sigue intentando!',value:'',symbols:randomSyms(),quantity:null,chance:null});
  renderPrizes()
}
function delPrize(i){
  if(prizes.length<=2){toast('Mínimo 2 combinaciones','err');return}
  const idx=parseInt(i);
  prizes.splice(idx,1);
  if(focusIdx===idx)focusIdx=-1;
  renderPrizes()
}
function focusPrize(i){focusIdx=parseInt(i);renderPrizes()}
function onPrizeType(i,v){prizes[parseInt(i)].type=v;renderPrizes()}
function onPrizeLabel(i,v){prizes[parseInt(i)].label=v;renderMachine()}
function onPrizeValue(i,v){prizes[parseInt(i)].value=v}
function onPrizeSymbols(i,v){
  const raw=String(v||'').split(',').map(function(s){return s.trim()}).filter(Boolean).slice(0,3);
  prizes[parseInt(i)].symbols=raw;
  renderMachine()
}
function onPrizeQty(i,v){prizes[parseInt(i)].quantity=v===''?null:parseInt(v)}
function onPrizeChance(i,v){prizes[parseInt(i)].chance=v===''?null:parseFloat(v)}

// ===== TEMAS =====
function renderThemes(){
  $('theme-ps').innerHTML=THEMES.map(function(t,i){
    return '<div class="sl-theme-dot" data-act="call" data-call="useTheme" data-a1="'+i+'" title="'+t.name+'" data-style="background:'+t.mch+'"></div>'
  }).join('')
}
function useTheme(i){
  const t=THEMES[parseInt(i)];if(!t)return;
  config.design.bg_color=t.bg;
  config.design.machine_color=t.mch;
  config.design.reel_bg=t.reel;
  config.design.button_color=t.btn;
  config.design.text_color_machine=t.tm;
  syncDesignInputs();refreshP()
}

// ===== REFRESH EN VIVO =====
function refreshP(){
  config.texts.title=$('txt-title').value||config.texts.title||'';
  config.texts.description=$('txt-desc').value||config.texts.description||'';
  config.texts.button=$('txt-button').value||config.texts.button||'Jalar Palanca';
  config.design.bg_color=$('c-bg').value;
  config.design.text_color=$('c-txt').value;
  config.design.button_color=$('c-btn').value;
  config.design.machine_color=$('c-mch').value;
  config.design.machine_style=$('cfg-style').value;
  config.design.reel_bg=$('c-reel').value;
  config.design.text_color_machine=$('c-mtxt').value;
  config.design.duration=parseInt($('cfg-dur').value)||6;
  renderPreview()
}
function syncDesignInputs(){
  $('c-bg').value=config.design.bg_color;$('v-bg').textContent=config.design.bg_color;
  $('c-txt').value=config.design.text_color;$('v-txt').textContent=config.design.text_color;
  $('c-btn').value=config.design.button_color;$('v-btn').textContent=config.design.button_color;
  $('c-mch').value=config.design.machine_color;$('v-mch').textContent=config.design.machine_color;
  $('c-reel').value=config.design.reel_bg;$('v-reel').textContent=config.design.reel_bg;
  $('c-mtxt').value=config.design.text_color_machine;$('v-mtxt').textContent=config.design.text_color_machine;
  $('cfg-style').value=config.design.machine_style||'rounded';
  $('cfg-dur').value=String(config.design.duration||6)
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
    name:$('sl-name').value.trim()||'Promoción sin nombre',
    status:status,
    config:collectConfig(),
    prizes:prizes.map(function(p){return {
      type:p.type,label:p.label,value:p.value||'',
      symbols:normalizeSymbols(p.symbols),
      quantity:p.quantity,chance:p.chance
    }})
  }
}
function collectConfig(){
  return {
    language:$('cfg-lang').value,
    texts:{title:$('txt-title').value.trim(),description:$('txt-desc').value.trim(),button:$('txt-button').value.trim(),winTitle:$('txt-wint').value.trim(),winDesc:$('txt-wind').value.trim(),loseTitle:$('txt-loset').value.trim(),loseDesc:$('txt-losed').value.trim()},
    design:{bg_color:$('c-bg').value,text_color:$('c-txt').value,button_color:$('c-btn').value,machine_color:$('c-mch').value,machine_style:$('cfg-style').value,reel_bg:$('c-reel').value,text_color_machine:$('c-mtxt').value,duration:parseInt($('cfg-dur').value)||6},
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
  if(!$('sl-name').value.trim()){toast('Ponle un nombre','err');return}
  const bad=prizes.find(function(p){return !p.label.trim()||((p.type==='cupon'||p.type==='enlace')&&!String(p.value||'').trim())});
  if(bad){toast('Hay premios incompletos','err');return}
  const body=buildPayload(publish?'published':undefined);
  const logged=!!getToken();
  const p=logged
    ? api('/slots/'+currentId,{method:'PUT',body:JSON.stringify(body)})
    : api('/slots/'+currentId+'/public-config',{method:'PUT',body:JSON.stringify({config:body.config,prizes:body.prizes})});
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
  $('share-url').value=window.location.origin+'/'+slug+'/tragamonedas/'+currentId+'/jugar';
  $('share-url-edit').value=window.location.origin+'/'+slug+'/tragamonedas/'+currentId;
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
  if(!eId){$('mis-list').innerHTML='<div class="sl-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
  fetch(API+'/slots/events/'+eId+'/slots').then(function(r){return r.json()}).then(function(list){
    if(!Array.isArray(list)){$('mis-list').innerHTML='<div class="sl-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
    if(!list.length){$('mis-list').innerHTML='<div class="sl-hint">No hay promociones guardadas</div>';return}
    $('mis-list').innerHTML=list.map(function(s){const st=s.stats||{};return'<div data-style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer" data-act="call" data-call="loadS" data-a1="'+s.id+'" data-a2="'+esc(s.name||'')+'"><div><div data-style="font-weight:700;font-size:12.5px">'+(s.name||'Sin nombre')+'</div><div data-style="font-size:11px;color:#9ca3af">'+(s.prizeCount||0)+' combinaciones · '+st.plays+' jugadas · '+st.views+' vistas</div></div><button data-style="background:none;border:none;color:#ef4444;font-size:13px;cursor:pointer" data-act="call" data-stop="1" data-call="delS" data-a1="'+s.id+'">🗑️</button></div>'}).join('')
  }).catch(function(){})
}
function loadS(id,name){
  window.location.search='';
  load(id)
}
function delS(id){if(!confirm('¿Eliminar promoción?'))return;fetch(API+'/slots/'+id,{method:'DELETE'}).then(function(){loadMis()}).catch(function(){})}

// ===== EXTRAS =====
function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('stage').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
function reloadPage(){window.location.reload()}

// ===== CARGA =====
function load(id){
  const p=getToken()?api('/slots/'+id):api('/slots/'+id+'/public-editor');
  p.then(function(s){
    data={id:s.id,event_id:s.event_id,event_name:s.event_name,views:s.views||0,status:s.status};
    currentId=s.id;
    config=Object.assign({
      language:'es',
      texts:{},design:{},form:{},security:{},
      limit_chances:false,limit_quantities:false,
      play_sounds:true,share_buttons:false,certificate:false,
      play_again_mode:'auto',play_again_every:3
    },s.config||{});
    // rellenar huecos con la plantilla
    const def={texts:{},design:{},form:{},security:{}};
    ['texts','design','form','security'].forEach(function(k){config[k]=Object.assign(def[k],config[k]||{})});
    prizes=(s.prizes||[]).map(function(x){return {type:x.type,label:x.label,value:x.value||'',symbols:x.symbols,quantity:x.quantity,chance:x.chance}});
    $('loading').classList.add('hidden');
    $('hero-stats').classList.remove('hidden');
    $('sl-name').value=s.name||'';
    $('stat-views').textContent=data.views;
    $('stat-plays').textContent='-';
    $('stat-prizes').textContent=prizes.length;
    $('cfg-lang').value=config.language||'es';
    $('txt-title').value=config.texts.title||langDefault(config.language).t;
    $('txt-desc').value=config.texts.description||langDefault(config.language).d;
    $('txt-button').value=config.texts.button||langDefault(config.language).b;
    $('txt-wint').value=config.texts.winTitle||'¡Jackpot! ¡Has ganado!';
    $('txt-wind').value=config.texts.winDesc||'';
    $('txt-loset').value=config.texts.loseTitle||'¡Oh! La palanca no te acompañó';
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
  const m=window.location.pathname.match(/\/tragamonedas\/([a-f0-9-]{36})/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  const id=m[1];
  load(id)
}
init();
