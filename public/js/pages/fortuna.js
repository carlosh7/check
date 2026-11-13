// ===== Ruleta de la Fortuna — EDITOR (P1 — paridad AppSorteos — v12.44.833) =====
// Promoción con captura de leads: premios por segmento (Sin Premio/Premio/Cupón/Enlace),
// probabilidades (limitar chances) y stock (limitar cantidades).
// Enlace compartido: las promociones PUBLICADAS se editan sin clave (política ruleta).

let API='/api',data=null,prizes=[],config=null,currentId=null,logoDataUrl=null;
let previewPage='form',lastResult=null;

const LANGS={
 es:{t:'¡Gira la ruleta y gana!',d:'- Ingresa tu email para jugar.\n- Puedes girar la ruleta una vez.\n- ¡Buena suerte!',b:'Probar Suerte'},
 en:{t:'Spin the wheel and win!',d:'- Enter your email to play.\n- You can spin once.\n- Good luck!',b:'Try your luck'},
 pt:{t:'Gire a roleta e ganhe!',d:'- Digite seu email para jogar.\n- Você pode girar uma vez.\n- Boa sorte!',b:'Teste sua sorte'},
 fr:{t:'Tournez la roue et gagnez !',d:'- Entrez votre email pour jouer.\n- Vous pouvez tourner une fois.\n- Bonne chance !',b:'Tentez votre chance'},
 tr:{t:'Çarkı çevir ve kazan!',d:'- Oynamak için e-postanızı girin.\n- Bir kez çevirebilirsiniz.\n- İyi şanslar!',b:'Şansını dene'},
 de:{t:'Dreh das Rad und gewinne!',d:'- Gib deine E-Mail ein, um zu spielen.\n- Du kannst einmal drehen.\n- Viel Glück!',b:'Dein Glück versuchen'},
 ja:{t:'ルーレットを回して当てよう！',d:'- メールを入力してプレイ。\n- 回せるのは1回だけ。\n- 幸運を！',b:'運試し'}
};
// 10 temas con nombre (paridad AppSorteos: Magenta, Cielo, Medianoche, Lavanda, Grafito,
// Malva, Menta, Coral, Bosque, Hielo)
const THEMES=[
 {name:'Magenta',   bg:'#9d174d',seg:['#ec4899','#f9a8d4','#be185d','#f472b6','#9d174d','#fbcfe8'],btn:'#ec4899',ptr:'#22d3ee'},
 {name:'Cielo',     bg:'#0c4a6e',seg:['#0ea5e9','#7dd3fc','#0369a1','#38bdf8','#075985','#bae6fd'],btn:'#0ea5e9',ptr:'#fde047'},
 {name:'Medianoche',bg:'#0f172a',seg:['#334155','#64748b','#1e293b','#94a3b8','#0f172a','#cbd5e1'],btn:'#38bdf8',ptr:'#fbbf24'},
 {name:'Lavanda',   bg:'#4c1d95',seg:['#8b5cf6','#c4b5fd','#6d28d9','#a78bfa','#5b21b6','#ddd6fe'],btn:'#8b5cf6',ptr:'#fde047'},
 {name:'Grafito',   bg:'#18181b',seg:['#3f3f46','#71717a','#27272a','#a1a1aa','#18181b','#d4d4d8'],btn:'#e4e4e7',ptr:'#22d3ee'},
 {name:'Malva',     bg:'#701a45',seg:['#db2777','#f9a8d4','#9d174d','#f472b6','#831843','#fbcfe8'],btn:'#db2777',ptr:'#a7f3d0'},
 {name:'Menta',     bg:'#064e3b',seg:['#10b981','#6ee7b7','#047857','#34d399','#065f46','#a7f3d0'],btn:'#10b981',ptr:'#fde047'},
 {name:'Coral',     bg:'#7f1d1d',seg:['#ef4444','#fca5a5','#b91c1c','#f87171','#991b1b','#fecaca'],btn:'#ef4444',ptr:'#fde047'},
 {name:'Bosque',    bg:'#14532d',seg:['#16a34a','#86efac','#15803d','#4ade80','#166534','#bbf7d0'],btn:'#16a34a',ptr:'#fde047'},
 {name:'Hielo',     bg:'#334155',seg:['#e2e8f0','#94a3b8','#cbd5e1','#64748b','#f8fafc','#475569'],btn:'#0ea5e9',ptr:'#f43f5e'}
];
const LOGOS={
 trofeo:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#94a3b8' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'><path d='M31 24h38v15a19 19 0 0 1-38 0z'/><path d='M31 29H17v7a12 12 0 0 0 12 12'/><path d='M69 29h14v7a12 12 0 0 1-12 12'/><path d='M50 58v11'/><path d='M37 76h26'/></g></svg>",
 estrella:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill='#94a3b8' d='M50 13l11.4 23.1 25.5 3.7-18.5 18 4.4 25.4L50 71l-22.3 11.7 4.4-25.4-18.5-18 25.5-3.7z'/></svg>",
 diamante:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#94a3b8' stroke-width='4.5' stroke-linejoin='round'><path d='M30 28h40l14 16-34 32L16 44z'/><path d='M16 44h68M30 28l6 16 14-16 14 16 6-16'/></g></svg>",
 regalo:"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#94a3b8' stroke-width='4.5' stroke-linejoin='round'><rect x='20' y='38' width='60' height='44' rx='4'/><path d='M20 52h60M50 38v44'/><path d='M50 38c-8-14-24-10-22-2 2 8 14 2 22 2zm0 0c8-14 24-10 22-2-2 8-14 2-22 2z'/></g></svg>"
};
function logoUri(key){return 'data:image/svg+xml,'+encodeURIComponent(LOGOS[key])}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function $(id){return document.getElementById(id)}
let toastTimer=null;
function toast(msg,type){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show'+(type==='err'?' err':'');el.style.display='block';if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.style.display='none';el.className='toast'},2500)}
function getToken(){try{return localStorage.getItem('token')||null}catch(e){return null}}
function api(path,opts){opts=opts||{};const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});const tk=getToken();if(tk)h['Authorization']='Bearer '+tk;return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})})}

// ===== DIBUJO DE LA RULETA (canvas, paridad wheel.js) =====
function getCanvas(){return $('wcanvas')}
function segColors(){const cs=(config&&config.design&&config.design.segment_colors)||THEMES[0].seg;return cs}
function draw(){
  const cv=getCanvas();if(!cv)return;
  const cx=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx0=W/2,cy0=H/2,R=W/2-6;
  cx.clearRect(0,0,W,H);
  const n=prizes.length;
  if(!n){cx.strokeStyle='#cbd5e1';cx.beginPath();cx.arc(cx0,cy0,R,0,2*Math.PI);cx.stroke();return}
  const arc=(2*Math.PI)/n;
  const cs=segColors();
  const bdr=(config&&config.design&&config.design.border_color)||'#ffffff';
  const tcol=(config&&config.design&&config.design.wheel_text_color)||'#ffffff';
  const lw=(config&&config.design&&config.design.lines!=null)?config.design.lines:2;
  for(let i=0;i<n;i++){
    const a0=i*arc-Math.PI/2,a1=a0+arc;
    cx.beginPath();cx.moveTo(cx0,cy0);cx.arc(cx0,cy0,R,a0,a1);cx.closePath();
    cx.fillStyle=cs[i%cs.length];cx.fill();
    if(lw>0){cx.lineWidth=lw;cx.strokeStyle=bdr;cx.stroke()}
    // texto rotado a lo largo del radio (como el original)
    cx.save();cx.translate(cx0,cy0);cx.rotate(a0+arc/2);
    cx.fillStyle=tcol;cx.font='700 '+(n>12?9:n>8?11:13)+'px Inter, sans-serif';
    cx.textAlign='right';cx.textBaseline='middle';
    const label=prizes[i].label||'';
    cx.fillText(label.slice(0,22),R-16,0);
    cx.restore()
  }
  // borde exterior
  cx.beginPath();cx.arc(cx0,cy0,R-1,0,2*Math.PI);cx.lineWidth=6;cx.strokeStyle=bdr;cx.stroke();
  // centro
  cx.beginPath();cx.arc(cx0,cy0,34,0,2*Math.PI);cx.fillStyle='#fff';cx.fill();
  if(logoDataUrl){
    const img=new Image();img.onload=function(){cx.save();cx.beginPath();cx.arc(cx0,cy0,30,0,2*Math.PI);cx.clip();cx.drawImage(img,cx0-30,cy0-30,60,60);cx.restore()};img.src=logoDataUrl
  }else{cx.font='20px Inter';cx.textAlign='center';cx.textBaseline='middle';cx.fillText('🎯',cx0,cy0)}
}

// ===== PREVIEW =====
function setPreview(val,el){
  previewPage=el?el.value:($('pv-page')?$('pv-page').value:'form');
  // v12.44.834 fix (reportado por P4): asignar lastResult para que Ganador/Perdedor
  // sí muestren la página de resultado en la preview del editor
  lastResult=previewPage!=='form'?{win:previewPage==='win'}:null;
  renderPreview()
}
function renderPreview(){
  const t=(config&&config.texts)||{};
  const page=$('pv-page');
  const mode=page?page.value:'form';
  const formBox=document.querySelector('.fz-pv__form');
  const resBox=$('pv-result');
  $('pv-title').textContent=t.title||'¡Gira la ruleta y gana!';
  $('pv-desc').textContent=t.description||'';
  $('pv-desc').style.display=(t.description)?'block':'none';
  $('pv-btn').textContent=t.button||'Probar Suerte';
  const stage=$('stage');
  stage.style.backgroundColor=(config&&config.design&&config.design.bg_color)||'#9d174d';
  stage.style.color=(config&&config.design&&config.design.text_color)||'#ffffff';
  $('pv-btn').style.backgroundColor=(config&&config.design&&config.design.button_color)||'#ec4899';
  // formulario: campos según config.form
  const extras=document.querySelectorAll('.fz-input--extra');
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
    $('pv-res-title').textContent=win?(t.winTitle||'Felicitaciones, ¡has ganado!'):(t.loseTitle||'¡Oh! Parece que has perdido');
    $('pv-res-desc').textContent=win?(t.winDesc||''):(t.loseDesc||'');
    const demo=prizes.find(function(p){return p.type==='cupon'||p.type==='premio'});
    $('pv-res-prize').textContent=win?('🎁 '+(demo?demo.label:'Tu premio')):'😔 ¡Sigue intentando!'
  }
}

function switchTab(tab,el){
  document.querySelectorAll('.fz__config__menu-item').forEach(function(e){e.classList.remove('active')});
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
  $('prize-count').textContent='Secciones ('+prizes.length+')';
  const limQ=$('cfg-quantities').checked,limC=$('cfg-chances').checked;
  const cs=segColors();
  $('prize-list').innerHTML=prizes.map(function(p,i){
    const tipos=[['sin_premio','Sin Premio'],['premio','Premio'],['cupon','Cupón'],['enlace','Enlace']];
    return '<div class="fz-prize-row">'+
      '<span class="fz-dot" data-style="background:'+cs[i%cs.length]+'"></span>'+
      '<select data-act="call" data-call="onPrizeType" data-a1="'+i+'" data-a2="@this.value">'+
        tipos.map(function(t){return '<option value="'+t[0]+'"'+(p.type===t[0]?' selected':'')+'>'+t[1]+'</option>'}).join('')+
      '</select>'+
      '<input placeholder="Texto en ruleta" maxlength="60" value="'+esc(p.label)+'" data-act="call" data-call="onPrizeLabel" data-a1="'+i+'" data-a2="@this.value">'+
      (p.type==='cupon'||p.type==='enlace'?'<input placeholder="Valor" maxlength="60" value="'+esc(p.value||'')+'" data-act="call" data-call="onPrizeValue" data-a1="'+i+'" data-a2="@this.value">':'')+
      (limQ?'<input class="fz-sm" type="number" min="0" placeholder="Stock" value="'+(p.quantity!=null?p.quantity:'')+'" title="Cantidad" data-act="call" data-call="onPrizeQty" data-a1="'+i+'" data-a2="@this.value">':'')+
      (limC?'<input class="fz-sm" type="number" min="0" max="100" placeholder="%" value="'+(p.chance!=null?p.chance:'')+'" title="Chance %" data-act="call" data-call="onPrizeChance" data-a1="'+i+'" data-a2="@this.value">':'')+
      '<button class="fz-del" data-act="call" data-call="delPrize" data-a1="'+i+'">✕</button>'+
    '</div>'
  }).join('');
  draw();renderPreview()
}
function addPrize(){
  prizes.push({type:'sin_premio',label:'¡Sigue intentando!',value:'',quantity:null,chance:null});
  renderPrizes()
}
function delPrize(i){
  if(prizes.length<=2){toast('Mínimo 2 secciones','err');return}
  prizes.splice(parseInt(i),1);renderPrizes()
}
function onPrizeType(i,v){prizes[parseInt(i)].type=v;renderPrizes()}
function onPrizeLabel(i,v){prizes[parseInt(i)].label=v;draw()}
function onPrizeValue(i,v){prizes[parseInt(i)].value=v}
function onPrizeQty(i,v){prizes[parseInt(i)].quantity=v===''?null:parseInt(v)}
function onPrizeChance(i,v){prizes[parseInt(i)].chance=v===''?null:parseFloat(v)}

// ===== TEMAS / LOGOS =====
function renderThemes(){
  $('theme-ps').innerHTML=THEMES.map(function(t,i){
    const s=t.seg.slice(0,5).map(function(c){return'<span data-style="background:'+c+'"></span>'}).join('');
    return '<div class="fz-theme-dot" data-act="call" data-call="useTheme" data-a1="'+i+'" title="'+t.name+'">'+s+'</div>'
  }).join('')
}
function useTheme(i){
  const t=THEMES[parseInt(i)];if(!t)return;
  config.design.segment_colors=t.seg.slice();
  config.design.bg_color=t.bg;
  config.design.button_color=t.btn;
  config.design.pointer_color=t.ptr;
  syncDesignInputs();draw();refreshP()
}
function renderLogos(){
  const el=document.createElement('div');
  el.innerHTML=Object.keys(LOGOS).map(function(k){
    return '<div class="fz-theme-dot" data-act="call" data-call="useLogo" data-a1="'+k+'" title="'+k+'"><img src="'+logoUri(k)+'" data-style="width:100%;height:100%"></div>'
  }).join('');
  const pv=$('logo-pv');if(pv&&!pv._gallery){pv._gallery=true;pv.parentElement.insertBefore(el,pv.nextSibling)}
}
function useLogo(key){if(!LOGOS[key])return;logoDataUrl=logoUri(key);const pv=$('logo-pv');pv.innerHTML='<img src="'+logoDataUrl+'" data-style="width:100%;height:100%;object-fit:cover">';$('btn-rm-logo').style.display='block';draw()}
function uploadLogo(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=function(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){logoDataUrl=ev.target.result;$('logo-pv').innerHTML='<img src="'+ev.target.result+'" data-style="width:100%;height:100%;object-fit:cover">';$('btn-rm-logo').style.display='block';draw()};reader.readAsDataURL(file)};
  inp.click()
}
function rmLogo(){logoDataUrl=null;$('logo-pv').textContent='🎯';$('btn-rm-logo').style.display='none';draw()}

// ===== REFRESH EN VIVO =====
function refreshP(){
  $('pv-title').textContent=($('txt-title').value||config.texts.title||'');
  $('pv-desc').textContent=$('txt-desc').value||config.texts.description||'';
  $('pv-btn').textContent=$('txt-button').value||config.texts.button||'Probar Suerte';
  config.design.bg_color=$('c-bg').value;
  config.design.text_color=$('c-txt').value;
  config.design.button_color=$('c-btn').value;
  config.design.pointer_color=$('c-ptr').value;
  config.design.border_color=$('c-bdr').value;
  config.design.wheel_text_color=$('c-wtxt').value;
  config.design.lines=parseInt($('cfg-ln').value)||0;
  config.design.duration=parseInt($('cfg-dur').value)||6;
  const stage=$('stage');
  stage.style.backgroundColor=config.design.bg_color;
  stage.style.color=config.design.text_color;
  $('pv-btn').style.backgroundColor=config.design.button_color;
  document.querySelector('.fz-pv__pointer').style.color=config.design.pointer_color;
  draw();renderPreview()
}
function syncDesignInputs(){
  $('c-bg').value=config.design.bg_color;$('v-bg').textContent=config.design.bg_color;
  $('c-txt').value=config.design.text_color;$('v-txt').textContent=config.design.text_color;
  $('c-btn').value=config.design.button_color;$('v-btn').textContent=config.design.button_color;
  $('c-ptr').value=config.design.pointer_color;$('v-ptr').textContent=config.design.pointer_color;
  $('c-bdr').value=config.design.border_color;$('v-bdr').textContent=config.design.border_color;
  $('c-wtxt').value=config.design.wheel_text_color;$('v-wtxt').textContent=config.design.wheel_text_color;
  $('cfg-ln').value=String(config.design.lines!=null?config.design.lines:2);
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
    name:$('fz-name').value.trim()||'Promoción sin nombre',
    status:status,
    config:collectConfig(),
    prizes:prizes
  }
}
function collectConfig(){
  return {
    language:$('cfg-lang').value,
    texts:{title:$('txt-title').value.trim(),description:$('txt-desc').value.trim(),button:$('txt-button').value.trim(),winTitle:$('txt-wint').value.trim(),winDesc:$('txt-wind').value.trim(),loseTitle:$('txt-loset').value.trim(),loseDesc:$('txt-losed').value.trim()},
    design:{bg_color:$('c-bg').value,text_color:$('c-txt').value,button_color:$('c-btn').value,pointer_color:$('c-ptr').value,border_color:$('c-bdr').value,wheel_text_color:$('c-wtxt').value,segment_colors:segColors(),lines:parseInt($('cfg-ln').value)||0,duration:parseInt($('cfg-dur').value)||6,center_logo:logoDataUrl},
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
  if(!$('fz-name').value.trim()){toast('Ponle un nombre','err');return}
  const bad=prizes.find(function(p){return !p.label.trim()||((p.type==='cupon'||p.type==='enlace')&&!String(p.value||'').trim())});
  if(bad){toast('Hay secciones incompletas','err');return}
  const body=buildPayload(publish?'published':undefined);
  const logged=!!getToken();
  const p=logged
    ? api('/fortunas/'+currentId,{method:'PUT',body:JSON.stringify(body)})
    : api('/fortunas/'+currentId+'/public-config',{method:'PUT',body:JSON.stringify({config:body.config,prizes:body.prizes})});
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
  $('share-url').value=window.location.origin+'/'+slug+'/fortuna/'+currentId+'/jugar';
  $('share-url-edit').value=window.location.origin+'/'+slug+'/fortuna/'+currentId;
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
  if(!eId){$('mis-list').innerHTML='<div class="fz-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
  fetch(API+'/fortunas/events/'+eId+'/fortunas').then(function(r){return r.json()}).then(function(list){
    if(!Array.isArray(list)){$('mis-list').innerHTML='<div class="fz-hint">🔒 Inicia sesión en la app para ver tus promociones</div>';return}
    if(!list.length){$('mis-list').innerHTML='<div class="fz-hint">No hay promociones guardadas</div>';return}
    $('mis-list').innerHTML=list.map(function(f){const s=f.stats||{};return'<div data-style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer" data-act="call" data-call="loadF" data-a1="'+f.id+'" data-a2="'+esc(f.name||'')+'"><div><div data-style="font-weight:700;font-size:12.5px">'+(f.name||'Sin nombre')+'</div><div data-style="font-size:11px;color:#9ca3af">'+(f.prizeCount||0)+' secciones · '+s.plays+' jugadas · '+s.views+' vistas</div></div><button data-style="background:none;border:none;color:#ef4444;font-size:13px;cursor:pointer" data-act="call" data-stop="1" data-call="delF" data-a1="'+f.id+'">🗑️</button></div>'}).join('')
  }).catch(function(){})
}
function loadF(id,name){
  window.location.search='';
  load(id)
}
function delF(id){if(!confirm('¿Eliminar promoción?'))return;fetch(API+'/fortunas/'+id,{method:'DELETE'}).then(function(){loadMis()}).catch(function(){})}

// ===== EXTRAS =====
function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('stage').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
function reloadPage(){window.location.reload()}

// ===== CARGA =====
function load(id){
  const p=getToken()?api('/fortunas/'+id):api('/fortunas/'+id+'/public-editor');
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
    $('fz-name').value=f.name||'';
    $('stat-views').textContent=data.views;
    $('stat-plays').textContent='-';
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
    if(config.design.center_logo){logoDataUrl=config.design.center_logo;$('logo-pv').innerHTML='<img src="'+logoDataUrl+'" data-style="width:100%;height:100%;object-fit:cover">';$('btn-rm-logo').style.display='block'}
    syncDesignInputs();
    renderThemes();renderLogos();renderPrizes();renderPreview();loadMis();
    updateShareUrls();
  }).catch(function(e){
    $('loading').classList.add('hidden');
    $('error').style.display='flex';
    $('errmsg').textContent=/publicadas/i.test(e.message)?'Esta promoción no está publicada. Ábrela desde la app (Configuración del evento → Promociones) o publícala.':(e.message||'Error al cargar');
  })
}

function init(){
  // v12.44.834 fix: los paneles acordeón (sec-h) no estaban cableados — sin esto
  // Idioma/Textos/Opciones/Premios/Diseño/Seguridad eran inalcanzables en el editor
  document.querySelectorAll('.sec-h').forEach(function(h){
    h.addEventListener('click',function(){
      const b=h.nextElementSibling;
      if(b&&b.classList.contains('sec-b')){b.classList.toggle('hidden');h.classList.toggle('collapsed')}
    });
  });
  const m=window.location.pathname.match(/\/fortuna\/([a-f0-9-]{36})/i);
  if(!m){$('loading').classList.add('hidden');$('error').style.display='flex';$('errmsg').textContent='Enlace inválido';return}
  const id=m[1];
  load(id)
}
init();
