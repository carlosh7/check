// ===== STATE =====
let API='/api',data=null,parts=[],wins=[],spinning=false,rot=0,sound=true,editIdx=-1;
let currentId=null,logoDataUrl=null,bgDataUrl=null,isPlaying=false,jsConfetti=null;
let segCs=['#ff7878','#7eecec','#fff171','#7280fd'];
const cv=document.getElementById('canvas'),cx=cv.getContext('2d');
const themes=[{name:'Clasico',colors:['#ff7878','#7eecec','#fff171','#7280fd']},{name:'Oceano',colors:['#0077B6','#00B4D8','#90E0EF','#CAF0F8','#48CAE4','#023E8A']},{name:'Natura',colors:['#2D6A4F','#40916C','#52B788','#95D5B2','#D8F3DC','#1B4332']},{name:'Fuego',colors:['#FF4500','#FF6347','#FF8C00','#FFA500','#FFD700','#DC143C']},{name:'Pastel',colors:['#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF','#E8BAFF']},{name:'Neon',colors:['#FF00FF','#00FF00','#FFFF00','#00FFFF','#FF00FF','#FF6600']}];

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

function openEditEntry(idx){
  editIdx=idx;document.getElementById('edit-name').value=parts[idx]||'';
  document.getElementById('edit-chance').value='-1';
  openModal('edit-modal')
}
function applyEditEntry(){
  const nm=document.getElementById('edit-name').value.trim();
  if(!nm||editIdx<0)return;
  parts[editIdx]=nm;
  document.getElementById('parts-ta').value=parts.join('\n');
  document.getElementById('part-cnt').textContent=parts.length;
  if(document.getElementById('cfg-adv').checked)renderAdv();
  draw();closeModal('edit-modal');
  editIdx=-1
}

function newWheel(){
  if(!currentId)return;
  currentId=null;parts=[];wins=[];bgDataUrl=null;
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
  inp.onchange=function(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){bgDataUrl=ev.target.result;document.getElementById('bg-preview').style.backgroundImage='url('+ev.target.result+')';document.getElementById('bg-preview').style.display='block';document.getElementById('btn-rm-bg').style.display='block';refreshP()};reader.readAsDataURL(file)};
  inp.click()
}
function rmBg(){bgDataUrl=null;document.getElementById('bg-preview').style.display='none';document.getElementById('btn-rm-bg').style.display='none';refreshP()}

function toggleCollapse(h,id){
  const b=document.getElementById(id);if(!b)return;
  const isH=b.classList.contains('hidden');
  b.classList.toggle('hidden');h.classList.toggle('collapsed',!isH)
}

function getC(){
  const c=data&&data.config||{};
  return {bg:c.page_background_color||'#D1E4FF',mc:c.main_color||'#1a1a1a',pc:c.pointer_color||'#ff7878',bc:c.wheel_border_color||'#111111',tc:c.wheel_slices_text_color||'#000000',sc:c.wheel_colors||segCs,lw:parseInt(c.wheel_lines_size)||0,dur:parseInt(c.wheel_spin_duration)||10,snd:c.play_sounds!==false,cft:c.show_confettis!==false}
}

function calcFs(n){
  if(n<10)return 14;if(n<20)return 11;if(n<40)return 9;if(n<80)return 7;if(n<150)return 5;return 0
}

// ===== CANVAS (Winwheel.js style) =====
function draw(){
  const w=cv.width,h=cv.height,cl=getC(),ir=50;cx.clearRect(0,0,w,h);
  cx.save();cx.translate(w/2,h/2);cx.rotate(rot);
  const n=parts.length;
  if(n){
    const a=2*Math.PI/n,or=w/2-8,fs=calcFs(n);
    parts.forEach(function(nm,i){
      const s=i*a,e=(i+1)*a;
      // Segment
      cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,or,s,e);cx.closePath();
      cx.fillStyle=cl.sc[i%cl.sc.length];cx.fill();
      if(cl.lw>0){cx.strokeStyle='rgba(0,0,0,0.06)';cx.lineWidth=cl.lw;cx.stroke()}
      // Inner cutout
      cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,ir,0,2*Math.PI);cx.closePath();cx.fillStyle='#fff';cx.fill();
      // Text from outer edge
      if(fs>0){
        cx.save();cx.rotate(s+a/2);cx.textAlign='right';cx.fillStyle=cl.tc;
        cx.font='bold '+fs+'px Inter';cx.shadowColor='rgba(0,0,0,0.3)';cx.shadowBlur=2;
        let d=nm;if(nm.length>12&&fs>7)d=nm.slice(0,10)+'..';else if(nm.length>18&&fs<=7)d=nm.slice(0,14)+'..';
        cx.fillText(d,or-15,fs/3);cx.restore()
      }
    });
    // Pins between segments
    for(let i=0;i<n;i++){
      const ang=i*a+a/2;
      cx.beginPath();cx.arc(Math.cos(ang)*(or-5),Math.sin(ang)*(or-5),4,0,2*Math.PI);
      cx.fillStyle='rgba(255,255,255,0.7)';cx.fill()
    }
  }
  cx.restore()
}

function getSegIdx(){
  if(!parts.length)return 0;
  let a=2*Math.PI/parts.length,f=(-rot+Math.PI/2)%(2*Math.PI);if(f<0)f+=2*Math.PI;
  return Math.floor(f/a)%parts.length
}

// ===== SPIN (Expo.easeOut) =====
function spin(){
  if(spinning||!parts.length)return;
  if(getC().capture_leads&&!document.getElementById('lead-f').classList.contains('submitted')){
    const fn=document.getElementById('lead-nm')?.value?.trim(),em=document.getElementById('lead-em')?.value?.trim();
    if(!fn||!em){toast('Completa nombre y email','err');return}
    document.getElementById('lead-f').classList.add('submitted');
    fetch(API+'/raffles/'+data.id+'/spin-with-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winnerName:'___lead___',name:fn,email:em})}).catch(function(){});
  }
  spinning=true;
  document.getElementById('screencast').classList.add('spinning');
  document.getElementById('wheel-ct').classList.add('zooming');
  document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=true});
  const cl=getC(),dur=cl.dur*1000;
  const spins=8,target=rot+spins*2*Math.PI+Math.random()*2*Math.PI,st=Date.now(),sr=rot;
  if(cl.snd){try{new Audio('/media/ding.mp3').play()}catch(e){try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=800;g.gain.value=.06;o.start();o.stop(a.currentTime+0.06)}catch(ex){}}}
  (function an(){
    const p=Math.min((Date.now()-st)/dur,1);
    const e=p===1?1:1-Math.pow(2,-10*p);
    rot=sr+(target-sr)*e;draw();
    document.getElementById('win-name').textContent=parts[getSegIdx()];
    document.getElementById('win-box').style.display='block';
    if(p<1)requestAnimationFrame(an);else{
      spinning=false;
      document.getElementById('screencast').classList.remove('spinning');
      document.getElementById('wheel-ct').classList.remove('zooming');
      document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=false});
      const win=parts[getSegIdx()];
      wins.push(win);
      if(getC().wheel_auto_remove)parts=parts.filter(function(p,i){return i!==getSegIdx()});
      document.getElementById('win-name').textContent='🏆 '+win;
      if(getC().cft){
        if(!jsConfetti)jsConfetti=new JSConfetti();
        jsConfetti.addConfetti({confettiNumber:250,confettiColors:['#ff7878','#7eecec','#fff171','#7280fd','#7c3aed','#fbbf24','#34d399']})
      }
      updWins();
      fetch(API+'/raffles/'+data.id+'/spin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winnerName:win})}).catch(function(){});
    }
  })()
}

function resetW(){rot=0;spinning=false;document.getElementById('screencast').classList.remove('spinning');document.getElementById('wheel-ct').classList.remove('zooming');draw();document.getElementById('win-box').style.display='none';document.querySelectorAll('.wof__main__btn').forEach(function(b){b.disabled=false})}
function updWins(){const wl=document.getElementById('wins-list');if(wins.length){wl.classList.add('show');wl.innerHTML=wins.map(function(w,i){const m=i===0?'🥇':i===1?'🥈':i===2?'🥉':'🎁';return'<span style="margin-right:12px;display:inline-flex"><span style="margin-right:4px">'+(i+1)+'.</span>'+w+'</span>'}).join('')}}
function toggleWins(){document.getElementById('wins-list').classList.toggle('show')}
function toggleSnd(){sound=!sound;document.getElementById('btn-snd').textContent=sound?'🔊':'🔇'}

function toggleFS(){
  if(!document.fullscreenElement)document.getElementById('screencast').requestFullscreen().catch(function(){});
  else document.exitFullscreen().catch(function(){})
}
document.addEventListener('fullscreenchange',function(){document.getElementById('screencast').classList.toggle('fullscreen',!!document.fullscreenElement)});

// ===== PLAY MODE =====
function playMode(){if(!currentId)return;isPlaying=true;document.getElementById('wof').classList.add('playing');document.getElementById('btn-close-pl').style.display='flex'}
function exitPlay(){isPlaying=false;document.getElementById('wof').classList.remove('playing');document.getElementById('btn-close-pl').style.display='none';if(document.fullscreenElement)document.exitFullscreen().catch(function(){})}

// ===== SIDEBAR REFRESH =====
function refreshP(){
  const sc=document.getElementById('screencast'),bg=document.getElementById('c-bg').value,mn=document.getElementById('c-main').value;
  sc.style.backgroundColor=bg;sc.style.backgroundImage=bgDataUrl?'url('+bgDataUrl+')':'none';sc.style.backgroundSize='cover';sc.style.backgroundPosition='center';sc.style.color=mn;
  document.querySelector('.wof__wheel__pointer').style.color=document.getElementById('c-ptr').value;
  document.querySelector('.wof__wheel__border').style.borderColor=document.getElementById('c-bdr').value;
  const st=document.getElementById('cfg-st').checked,tv=document.getElementById('cfg-title').value;
  document.getElementById('cfg-title').style.display=st?'block':'none';
  const sd=document.getElementById('cfg-sd').checked,dv=document.getElementById('cfg-desc').value;
  document.getElementById('cfg-desc').style.display=sd?'block':'none';
  const sb=document.getElementById('cfg-sb').checked,bv=document.getElementById('cfg-bt').value;
  document.getElementById('cfg-bt').style.display=sb?'block':'none';
  document.getElementById('pv-title').textContent=tv||'Mi Ruleta';document.getElementById('pv-title').style.display=st?'block':'none';
  document.getElementById('pv-desc').textContent=dv||'';document.getElementById('pv-desc').style.display=sd?'block':'none';
  document.querySelectorAll('.wof__main__btn').forEach(function(b){b.textContent='🎡 '+(bv||'GIRAR');b.style.display=sb?'flex':'none'});
  const lds=document.getElementById('cfg-lds').checked;
  document.getElementById('lead-f').style.display=lds?'block':'none';
  if(lds)document.getElementById('btn-spin').style.display='none';
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
function onPartsChange(){const t=document.getElementById('parts-ta');parts=(t?.value||'').split('\n').map(function(s){return s.trim()}).filter(Boolean);document.getElementById('part-cnt').textContent=parts.length;if(!document.getElementById('cfg-adv').checked)draw()}
function sortP(){const t=document.getElementById('parts-ta');if(!t)return;t.value=t.value.split('\n').map(function(s){return s.trim()}).filter(Boolean).sort().join('\n');onPartsChange()}
function shuffleP(){const t=document.getElementById('parts-ta');if(!t)return;const l=t.value.split('\n').map(function(s){return s.trim()}).filter(Boolean);for(let i=l.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const x=l[i];l[i]=l[j];l[j]=x}t.value=l.join('\n');onPartsChange()}
function clearP(){document.getElementById('parts-ta').value='';onPartsChange()}
function toggleAdv(){renderAdv()}
function renderAdv(){const list=document.getElementById('adv-list'),btn=document.getElementById('btn-add-e'),adv=document.getElementById('cfg-adv').checked;if(!adv){list.style.display='none';btn.style.display='none';return}list.style.display='block';btn.style.display='block';list.innerHTML=parts.map(function(n,i){const pct=Math.round(100/parts.length);return'<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px"><input class="form-control" style="flex:1;font-size:12px;padding:4px 8px" value="'+n+'" onchange="parts['+i+']=this.value;draw()"><span style="font-size:11px;color:#6b7280;min-width:36px;text-align:right">Auto</span><button style="background:none;border:none;cursor:pointer;font-size:13px" onclick="openEditEntry('+i+')">⚙️</button><button style="background:none;border:none;cursor:pointer;font-size:13px;color:#ef4444" onclick="rmE('+i+')">🗑️</button></div>'}).join('')}
function rmE(i){parts.splice(i,1);document.getElementById('parts-ta').value=parts.join('\n');renderAdv();document.getElementById('part-cnt').textContent=parts.length;draw()}
function addE(){parts.push('');renderAdv();document.getElementById('parts-ta').value=parts.join('\n');document.getElementById('part-cnt').textContent=parts.length}

// ===== THEMES =====
function renderThemes(){
  const el=document.getElementById('theme-ps'),q=document.getElementById('q-themes');
  let h='',qh='';
  themes.forEach(function(t,i){
    const s=t.colors.map(function(c){return'<span style="background:'+c+'"></span>'}).join('');
    h+='<div class="color_palette" onclick="useTheme('+i+')" title="'+t.name+'">'+s+'</div>';
    qh+='<div class="color_palette" onclick="useTheme('+i+')" title="'+t.name+'">'+s+'</div>'
  });
  el.innerHTML=h;q.innerHTML=qh
}
function useTheme(idx){
  const t=themes[idx];if(!t)return;
  segCs=t.colors.slice();renderSegCs();draw();
  document.getElementById('c-ptr').value=segCs[0];document.getElementById('v-ptr').textContent=segCs[0];
  refreshP()
}
function renderSegCs(){const el=document.getElementById('seg-cs');el.innerHTML=segCs.map(function(c,i){return'<div class="color-input"><span>'+c+'</span><input type="color" value="'+c+'" onchange="segCs['+i+']=this.value;this.previousElementSibling.textContent=this.value;draw()"></div>'}).join('')}

function uploadLogo(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=function(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){logoDataUrl=ev.target.result;document.getElementById('logo-pv').innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover">';document.getElementById('btn-rm-logo').style.display='block';draw()};reader.readAsDataURL(file)};
  inp.click()
}
function rmLogo(){logoDataUrl=null;document.getElementById('logo-pv').innerHTML='🎡';document.getElementById('btn-rm-logo').style.display='none';draw()}

// ===== SAVE/LOAD =====
function saveW(){
  const el=document.getElementById('wheel-name'),name=el?.value?.trim();
  if(!name){toast('Nombre requerido','err');return}
  if(!currentId){toast('Primero crea la ruleta','err');return}
  const cfg={page_background_color:document.getElementById('c-bg').value,page_background_image:bgDataUrl,main_color:document.getElementById('c-main').value,pointer_color:document.getElementById('c-ptr').value,wheel_border_color:document.getElementById('c-bdr').value,wheel_slices_text_color:document.getElementById('c-txt').value,wheel_colors:segCs,wheel_lines_size:parseInt(document.getElementById('cfg-ln').value)||0,wheel_spin_duration:parseInt(document.getElementById('cfg-dur').value)||10,play_sounds:document.getElementById('cfg-snd').checked,show_confettis:document.getElementById('cfg-cft').checked,wheel_auto_remove:document.getElementById('cfg-arm').checked,capture_leads:document.getElementById('cfg-lds').checked,improve_slices:document.getElementById('cfg-imp').checked,show_title:document.getElementById('cfg-st').checked,title:document.getElementById('cfg-title').value,show_desc:document.getElementById('cfg-sd').checked,description:document.getElementById('cfg-desc').value,show_start_button:document.getElementById('cfg-sb').checked,start_button:document.getElementById('cfg-bt').value,logo:logoDataUrl};
  fetch(API+'/raffles/'+currentId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,config:cfg})})
    .then(function(){return fetch(API+'/raffles/'+currentId+'/participants/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({participants:parts.map(function(n){return{name:n}})})})})
    .then(function(){toast('✅ Guardado','ok');document.getElementById('btn-play').disabled=false;loadSav()})
    .catch(function(e){toast('Error: '+e.message,'err')})
}

function loadSav(){
  const eId=window._eventId;
  if(!eId){document.getElementById('sav-list').innerHTML='<div style="font-size:13px;color:#9ca3af">Selecciona un evento</div>';return}
  fetch(API+'/raffles/events/'+eId+'/raffles').then(function(r){return r.json()}).then(function(list){
    const el=document.getElementById('sav-list');
    if(!list||!list.length){el.innerHTML='<div style="font-size:13px;color:#9ca3af;text-align:center;padding:8px">No hay ruletas guardadas</div>';return}
    el.innerHTML=list.map(function(r){const s=r.stats||{};return'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer" onclick="loadW(\''+r.id+'\',\''+(r.name||'')+'\')"><div><div style="font-weight:600;font-size:13px;color:#1a1a1a">'+(r.name||'Sin nombre')+'</div><div style="font-size:11px;color:#9ca3af">'+(r.total_participants||0)+' part · '+(s.spins||0)+' giros</div></div><button style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px" onclick="event.stopPropagation();delW(\''+r.id+'\')">🗑️</button></div>'}).join('')
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
    bgDataUrl=c.page_background_image||null;
    if(bgDataUrl){document.getElementById('bg-preview').style.backgroundImage='url('+bgDataUrl+')';document.getElementById('bg-preview').style.display='block';document.getElementById('btn-rm-bg').style.display='block'}else{document.getElementById('bg-preview').style.display='none';document.getElementById('btn-rm-bg').style.display='none'}
    document.getElementById('cfg-st').checked=c.show_title!==false;document.getElementById('cfg-title').value=c.title||'';
    document.getElementById('cfg-sd').checked=c.show_desc!==false;document.getElementById('cfg-desc').value=c.description||'';
    document.getElementById('cfg-sb').checked=c.show_start_button!==false;document.getElementById('cfg-bt').value=c.start_button||'Girar';
    segCs=c.wheel_colors||['#ff7878','#7eecec','#fff171','#7280fd'];logoDataUrl=c.logo||null;
    renderSegCs();refreshP();
    fetch(API+'/raffles/'+id+'/participants').then(function(r){return r.json()}).then(function(ps){const n=(ps||[]).map(function(p){return p.name||p.email}).filter(Boolean);document.getElementById('parts-ta').value=n.join('\n');onPartsChange()}).catch(function(){});
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
    if(c.page_background_image){document.getElementById('screencast').style.backgroundImage='url('+c.page_background_image+')';document.getElementById('screencast').style.backgroundSize='cover';document.getElementById('screencast').style.backgroundPosition='center'}else{document.getElementById('screencast').style.backgroundImage='none'}
    document.getElementById('screencast').style.color=c.main_color||'#1a1a1a';
    document.querySelector('.wof__wheel__pointer').style.color=c.pointer_color||'#ff7878';
    document.querySelector('.wof__wheel__border').style.borderColor=c.wheel_border_color||'#111111';
    if(c.logo)document.getElementById('wheel-logo').src=c.logo;
    const st=c.show_title!==false,sd=c.show_desc!==false,sb=c.show_start_button!==false;
    if(st&&c.title)document.getElementById('pv-title').textContent=c.title;else document.getElementById('pv-title').style.display='none';
    if(sd&&c.description)document.getElementById('pv-desc').textContent=c.description;else document.getElementById('pv-desc').style.display='none';
    document.querySelectorAll('.wof__main__btn').forEach(function(b){b.textContent='🎡 '+(c.start_button||'GIRAR')});
    if(c.capture_leads){document.getElementById('lead-f').style.display='block';document.getElementById('btn-spin').style.display='none'}
    else{document.getElementById('btn-spin').style.display='flex'}
    if(st||sd||sb)document.getElementById('right-panel').style.display='flex';
    sound=c.play_sounds!==false;document.getElementById('btn-snd').textContent=sound?'🔊':'🔇';
    renderThemes();document.getElementById('q-themes').style.display='flex';
    segCs=c.wheel_colors||['#ff7878','#7eecec','#fff171','#7280fd'];renderSegCs();
    document.getElementById('parts-ta').value=parts.join('\n');document.getElementById('part-cnt').textContent=parts.length;
    // Hero stats
    fetch(API+'/raffles/'+id+'/stats').then(function(r){return r.json()}).then(function(s){
      document.getElementById('stat-visits').textContent=s.visits||0;
      document.getElementById('stat-spins').textContent=s.spins||0;
      document.getElementById('stat-users').textContent=s.participants||0;
      document.getElementById('hero-stats').classList.remove('hidden')
    }).catch(function(){});
    draw();if(wins.length)updWins()
  }catch(e){document.getElementById('loading').classList.add('hidden');document.getElementById('error').style.display='flex';document.getElementById('errmsg').textContent='Error al cargar la ruleta'}
}
load();
