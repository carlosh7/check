let API='/api',guestData=null,deferredPrompt=null;
const tabs=['ticket','agenda','participate','networking','event'];

// PWA Install
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();deferredPrompt=e;
  document.getElementById('install-bar').classList.add('show');
});
document.getElementById('btn-install')?.addEventListener('click',async function(){
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  const result=await deferredPrompt.userChoice;
  if(result.outcome==='accepted')document.getElementById('install-bar').classList.remove('show');
  deferredPrompt=null;
});

function switchTab(tab,el){
  document.querySelectorAll('.bottom-nav a').forEach(function(a){a.classList.remove('active')});
  if(el)el.classList.add('active');
  document.getElementById('ticket-section').style.display=tab==='ticket'?'block':'none';
  document.getElementById('agenda-section').style.display=tab==='agenda'?'block':'none';
  document.getElementById('participate-section').style.display=tab==='participate'?'block':'none';
  document.getElementById('networking-section').style.display=tab==='networking'?'block':'none';
  document.getElementById('event-stats').style.display=tab==='event'?'grid':'none';
  document.getElementById('notif-card').style.display=tab==='event'?'block':'none';
  if(tab==='participate'){loadPortalPolls();loadPortalLeaderboard();loadPortalBadges();}
  if(tab==='networking'){loadNetworking();}
}

function switchParticipateTab(tab,el){
  document.querySelectorAll('.participate-tab').forEach(function(b){
    b.style.background=b===el?'#7c3aed':'rgba(255,255,255,0.06)';
    b.style.color=b===el?'#fff':'rgba(255,255,255,0.6)';
  });
  document.getElementById('participate-polls').style.display=tab==='polls'?'block':'none';
  document.getElementById('participate-leaderboard').style.display=tab==='leaderboard'?'block':'none';
  document.getElementById('participate-mybadges').style.display=tab==='mybadges'?'block':'none';
  document.getElementById('participate-album').style.display=tab==='album'?'block':'none';
  if(tab==='album'){loadPortalAlbum();}
}

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
// Fix v12.44.804: escJs se usaba en loadPortalAlbum() pero nunca se definio
// (el album rompia con captions). Escapa backslash y comilla para onclick inline.
function escJs(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\\'").replace(/"/g,'&quot;')}

function loadPortalPolls(){
  const eId=guestData?.event?.id;
  if(!eId){document.getElementById('portal-polls-list').innerHTML='<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px 0">Evento no disponible</p>';return}
  fetch(API+'/polls/public/'+eId+'/active').then(function(r){return r.json()}).then(function(polls){
    const c=document.getElementById('portal-polls-list');
    if(!polls||polls.length===0){c.innerHTML='<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px 0">No hay encuestas activas</p>';return}
    c.innerHTML=polls.map(function(p){
      const opts=p.options||[];
      const optionsHtml=opts.map(function(o,idx){
        return '<label data-style="display:flex;align-items:center;gap:8px;padding:10px;margin:4px 0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;font-size:13px">'
          +'<input type="'+(p.type==='multiple'?'checkbox':'radio')+'" name="poll_'+p.id+'" value="'+o.id+'" data-style="accent-color:#7c3aed">'
          +escHtml(o.label)+'</label>';
      }).join('');
      return '<div class="card" data-style="margin:12px 0"><div class="card-title">📊 '+escHtml(p.title)+'</div>'
        +(p.description?'<p data-style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:12px">'+escHtml(p.description)+'</p>':'')
        +optionsHtml
        +'<button class="vote-btn" data-pollid="'+p.id+'" data-style="margin-top:12px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;font-size:13px;font-weight:600;cursor:pointer" data-act="call" data-call="votePoll" data-a1="@this">Votar</button></div>';
    }).join('');
  }).catch(function(e){console.error('Polls load error:',e);document.getElementById('portal-polls-list').innerHTML='<p data-style="font-size:13px;color:#ef4444;text-align:center;padding:20px 0">Error al cargar encuestas</p>'});
}

function votePoll(btn){
  const pollId=btn.getAttribute('data-pollid');
  const selected=document.querySelectorAll('input[name="poll_'+pollId+'"]:checked');
  if(selected.length===0){btn.style.background='#dc2626';setTimeout(function(){btn.style.background=''},500);return}
  const optionIds=[];
  selected.forEach(function(cb){optionIds.push(cb.value)});
  const qrToken=guestData?.guest?.qr_token;
  if(!qrToken){alert('Debes estar registrado para votar');return}
  fetch(API+'/polls/public/'+pollId+'/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guest_token:qrToken,option_id:optionIds[0]})})
  .then(function(r){return r.json()})
  .then(function(res){
    if(res&&res.success){
      btn.textContent='✅ Voto registrado';
      btn.style.background='rgba(16,185,129,0.2)';
      btn.style.color='#34d399';
      btn.disabled=true;
    }else{
      btn.textContent='❌ '+(res&&res.error?res.error:'Error');
      btn.style.background='#dc2626';
    }
  }).catch(function(){
    btn.textContent='❌ Error de conexión';
    btn.style.background='#dc2626';
  });
}

function loadPortalLeaderboard(){
  const eId=guestData?.event?.id;
  if(!eId)return;
  fetch(API+'/leaderboard/'+eId).then(function(r){return r.json()}).then(function(entries){
    const c=document.getElementById('portal-leaderboard-list');
    if(!entries||entries.length===0){c.innerHTML='<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px 0">Sin datos aún</p>';return}
    c.innerHTML='<div data-style="display:flex;flex-direction:column;gap:4px">'
      +entries.map(function(e,i){
        const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
        const isMe=e.guest_id===guestData?.guest?.id;
        return '<div data-style="display:flex;align-items:center;gap:10px;padding:10px;background:'+(isMe?'rgba(124,58,237,0.1)':'transparent')+';border-radius:10px;border:1px solid '+(isMe?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.04)')+'">'
          +'<span data-style="font-size:16px;font-weight:700;color:'+(i<3?'#fbbf24':'rgba(255,255,255,0.3)')+';min-width:28px;text-align:center">'+medal+'</span>'
          +'<div data-style="flex:1"><span data-style="font-size:13px;font-weight:600;color:#e2e8f0">'+escHtml(e.guest_name||'Anónimo')+'</span>'
          +(e.organization?'<span data-style="font-size:11px;color:rgba(255,255,255,0.4);display:block">'+escHtml(e.organization)+'</span>':'')+'</div>'
          +'<span data-style="font-size:15px;font-weight:700;color:#a78bfa">'+e.points+' pts</span>'
          +'</div>';
      }).join('')
      +'</div>';
  }).catch(function(){});
}

function loadPortalBadges(){
  const eId=guestData?.event?.id;
  const gId=guestData?.guest?.id;
  if(!eId||!gId)return;
  fetch(API+'/leaderboard/'+eId+'/guest/'+gId+'/badges').then(function(r){return r.json()}).then(function(badges){
    const c=document.getElementById('portal-badges-list');
    if(!badges||badges.length===0){c.innerHTML='<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px 0">No tienes insignias aún. ¡Participa en encuestas para ganarlas!</p>';return}
    c.innerHTML=badges.map(function(b){
      return '<div data-style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;margin:4px 0">'
        +'<span data-style="font-size:24px">'+(b.icon||'🏆')+'</span>'
        +'<div><span data-style="font-size:13px;font-weight:600;color:#e2e8f0">'+escHtml(b.name)+'</span>'
        +(b.description?'<span data-style="font-size:11px;color:rgba(255,255,255,0.4);display:block">'+escHtml(b.description)+'</span>':'')+'</div></div>';
    }).join('');
  }).catch(function(){});
}

async function requestNotif(){
  if(!('Notification' in window)){document.getElementById('notif-card').innerHTML='<p class="granted">❌ Notificaciones no soportadas</p>';return}
  if(Notification.permission==='granted'){document.getElementById('notif-card').innerHTML='<p class="granted">✅ Notificaciones activadas</p>';return}
  const perm=await Notification.requestPermission();
  if(perm==='granted'){
    document.getElementById('notif-card').innerHTML='<p class="granted">✅ Notificaciones activadas</p>';
    // Register push subscription
    if('serviceWorker' in navigator&&'PushManager' in window){
      try{
        const reg=await navigator.serviceWorker.ready;
        const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array('{{VAPID_PUBLIC_KEY}}')});
        await fetch(API+'/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub,guestId:guestData?.guest?.id})});
      }catch(e){console.error('Push sub error:',e)}
    }
  }else{
    document.getElementById('notif-card').innerHTML='<p class="granted">❌ Notificaciones bloqueadas</p>';
  }
}
function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=window.atob(base64);
  return Uint8Array.from(rawData.split('').map(function(c){return c.charCodeAt(0)}));
}

// ── Networking ──
let netQrCode = null;

function loadNetworking() {
  if (!guestData) return;
  const guestId = guestData.guest?.id;
  const eventId = guestData.event?.id;
  if (!guestId || !eventId) return;
  // Load QR
  const qrUrl = window.location.origin + '/api/guests/qr/' + guestId;
  document.getElementById('networking-qr-img').src = qrUrl;
  // Load score
  fetch(API + '/networking/' + eventId + '/guest/' + guestId + '/score').then(function(r) { return r.json(); }).then(function(data) {
    if (data) {
      document.getElementById('net-score').textContent = data.score || 0;
      document.getElementById('net-connections').textContent = data.uniqueConnections || 0;
    }
  }).catch(function() {});
  // Load connections list
  fetch(API + '/networking/' + eventId + '/guest/' + guestId).then(function(r) { return r.json(); }).then(function(conns) {
    const c = document.getElementById('net-connections-list');
    if (!conns || conns.length === 0) { c.innerHTML = '<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px">Aún no tienes conexiones. Escanea el QR de otros asistentes.</p>'; return; }
    c.innerHTML = conns.map(function(n) {
      return '<div data-act="call" data-call="openNetProfile" data-a1="' + n.connected_guest_id + '" data-style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;margin:4px 0;cursor:pointer">'
        + '<span data-style="font-size:18px">👤</span>'
        + '<div data-style="flex:1"><span data-style="font-size:13px;font-weight:600;color:#e2e8f0">' + escHtml(n.connected_name) + '</span>'
        + '<span data-style="font-size:11px;color:rgba(255,255,255,0.4);display:block">' + escHtml(n.connected_email || n.connected_org || '') + '</span></div>'
        + '<span data-style="font-size:16px;color:rgba(255,255,255,0.3)">›</span></div>';
    }).join('');
  }).catch(function() {});
  // A4: Sugerencias de networking
  fetch(API + '/networking/' + eventId + '/guest/' + guestId + '/suggestions').then(function(r) { return r.json(); }).then(function(sugs) {
    const box = document.getElementById('net-suggestions-list');
    if (!box) return;
    if (!sugs || sugs.length === 0) { box.innerHTML = '<p data-style="font-size:12px;color:rgba(255,255,255,0.3);padding:10px;text-align:center">Aún no hay sugerencias. Conéctate con alguien para desbloquear recomendaciones.</p>'; return; }
    box.innerHTML = sugs.slice(0, 5).map(function(sg) {
      return '<div data-style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;margin:4px 0">'
        + '<span data-style="font-size:18px">🤝</span>'
        + '<div data-style="flex:1;min-width:0"><span data-style="font-size:13px;font-weight:600;color:#e2e8f0">' + escHtml(sg.name) + '</span>'
        + '<span data-style="font-size:11px;color:rgba(255,255,255,0.4);display:block">' + escHtml(sg.organization || sg.position || '') + (sg.shared_connections ? ' · ' + sg.shared_connections + ' conexiones en común' : '') + '</span></div>'
        + (sg.qr_token ? '<button data-act="call" data-call="connectSuggestion" data-a1="' + sg.qr_token + '" data-a2="' + escHtml(sg.name).replace(/'/g,'') + '" data-style="padding:6px 12px;border-radius:8px;border:none;background:rgba(16,185,129,0.15);color:#34d399;font-size:11px;font-weight:700;cursor:pointer">Conectar</button>' : '')
        + '</div>';
    }).join('');
  }).catch(function() {});
}

function connectSuggestion(toToken, name) {
  if (!guestData) return;
  const eventId = guestData.event?.id;
  const myToken = guestData.guest?.qr_token;
  fetch(API + '/networking/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, from_guest_token: myToken, to_guest_token: toToken })
  }).then(function(r) { return r.json(); }).then(function(res) {
    if (res && res.success) { alert('✅ ¡Conectado con ' + (name || 'el asistente') + '!'); loadNetworking(); }
    else alert(res && res.error ? res.error : 'No se pudo conectar');
  }).catch(function() { alert('Error de conexión'); });
}

function toggleNetQR() {
  const reader = document.getElementById('net-reader');
  if (reader.style.display === 'block') {
    reader.style.display = 'none';
    if (netQrCode) { netQrCode.stop(); netQrCode = null; }
    return;
  }
  reader.style.display = 'block';
  if (typeof Html5Qrcode !== 'undefined') {
    netQrCode = new Html5Qrcode('net-reader');
    netQrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 },
      function(qrText) {
        const token = qrText.split('/').pop();
        if (token && token.length > 5) {
          handleNetQR(token);
        }
        if (netQrCode) { netQrCode.stop(); netQrCode = null; }
        reader.style.display = 'none';
      }, function() {}
    ).catch(function(e) { console.error('QR error:', e); });
  }
}

function handleNetQR(token) {
  if (!guestData) return;
  const eventId = guestData.event?.id;
  const myToken = guestData.guest?.qr_token;
  if (!eventId || !myToken) { alert('Error: datos de invitado no disponibles'); return; }
  if (token === myToken) { alert('¡Este es tu propio código!'); return; }
  fetch(API + '/networking/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, from_guest_token: myToken, to_guest_token: token })
  }).then(function(r) { return r.json(); }).then(function(res) {
    if (res && res.success) {
      if (res.alreadyConnected) {
        alert('Ya estás conectado con ' + (res.guest?.name || 'este asistente'));
      } else {
        alert('✅ ¡Conexión realizada con ' + (res.guest?.name || 'el asistente') + '!');
      }
      loadNetworking();
    } else {
      alert('❌ ' + (res && res.error ? res.error : 'Error al conectar'));
    }
  }).catch(function() { alert('Error de conexión'); });
}

// ── Álbum de fotos ──

function loadPortalAlbum() {
  const eId = guestData?.event?.id;
  if (!eId) return;
  fetch(API + '/album/' + eId).then(function(r) { return r.json(); }).then(function(photos) {
    const c = document.getElementById('portal-album-grid');
    if (!photos || photos.length === 0) { c.innerHTML = '<p data-style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px;grid-column:1/-1">Aún no hay fotos. ¡Sé el primero en subir!</p>'; return; }
    c.innerHTML = photos.map(function(p) {
      return '<div data-style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.03)"><img src="' + p.url + '" data-style="width:100%;height:100%;object-fit:cover;cursor:pointer" data-act="call" data-call="viewPhoto" data-a1="' + p.url + '" data-a2="' + escJs(p.caption||'') + '">'
        + (p.caption ? '<div data-style="position:absolute;bottom:0;left:0;right:0;padding:4px 6px;background:linear-gradient(transparent,rgba(0,0,0,0.7));font-size:10px;color:rgba(255,255,255,0.8)">' + escHtml(p.caption) + '</div>' : '')
        + '</div>';
    }).join('');
  }).catch(function() {});
}

function uploadPortalPhoto(input) {
  if (!input || !input.files || !input.files[0]) return;
  const eId = guestData?.event?.id;
  const token = guestData?.guest?.qr_token;
  if (!eId || !token) { alert('Debes estar registrado'); return; }
  const caption = document.getElementById('portal-photo-caption').value.trim();
  const formData = new FormData();
  formData.append('photo', input.files[0]);
  formData.append('guest_token', token);
  formData.append('event_id', eId);
  formData.append('caption', caption);
  fetch(API + '/album/upload', { method: 'POST', body: formData })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (res && res.success) {
      document.getElementById('portal-photo-caption').value = '';
      input.value = '';
      alert('✅ Foto subida. El organizador la revisará antes de publicarla.');
      loadPortalAlbum();
    } else {
      alert('❌ ' + (res && res.error ? res.error : 'Error al subir'));
    }
  }).catch(function() { alert('Error de conexión'); });
}

function viewPhoto(url, caption) {
  const html = '<div data-style="max-width:90vw;max-height:80vh"><img src="' + url + '" data-style="max-width:100%;max-height:70vh;border-radius:12px">'
    + (caption ? '<p data-style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.7)">' + escHtml(caption) + '</p>' : '') + '</div>';
  Swal.fire({ html: html, showConfirmButton: false, background: '#0f172a', backdrop: 'rgba(0,0,0,0.9)', showCloseButton: true });
}

async function load(){
  const p=window.location.pathname.split('/'),params=new URLSearchParams(window.location.search);
  const guestId=params.get('g');
  if(!guestId){document.getElementById('loading').classList.add('hidden');document.getElementById('main').innerHTML='<div data-style="padding:40px;text-align:center"><h2 data-style="color:#ef4444">Enlace inválido</h2></div>';document.getElementById('main').style.display='block';return}
  try{
    const r=await fetch(API+'/portal/'+guestId);if(!r.ok)throw Error('No encontrado');
    guestData=await r.json();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main').style.display='block';

    const g=guestData.guest||{},ev=guestData.event||{};
    document.title='Portal | '+(ev.name||'Evento');
    document.getElementById('event-name-header').textContent=ev.name||'Evento';
    document.getElementById('event-date-header').textContent=ev.date?new Date(ev.date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):'';
    document.getElementById('guest-name').textContent=g.name||'Invitado';
    document.getElementById('guest-email').textContent=g.email||'';

    // Status
    const statusEl=document.getElementById('checkin-status');
    if(g.checked_in){statusEl.textContent='✅ Check-in realizado';statusEl.className='status ok'}
    else{statusEl.textContent='⏳ Pendiente';statusEl.className='status pending'}

    // QR
    const qrUrl=window.location.origin+'/api/guests/qr/'+guestId;
    document.getElementById('qr-img').src=qrUrl;

    // Event stats
    document.getElementById('stat-date').textContent=ev.date?new Date(ev.date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}):'—';
    document.getElementById('stat-location').textContent=ev.location||'—';

    // Agenda
    const sessions=guestData.sessions||[];
    if(sessions.length>0){
      document.getElementById('agenda-section').style.display='block';
      document.getElementById('agenda-list').innerHTML=sessions.map(function(s){
        return '<div class="session-item"><div class="time">'+(s.start_time||'')+'</div><div class="info"><div class="title">'+(s.title||'')+'</div><div class="detail">'+(s.location||'')+'</div></div></div>';
      }).join('');
    }

    // Load gamification data
    loadPortalPolls();
    loadPortalLeaderboard();
    loadPortalBadges();

    // PWA: register service worker + cache guest data for offline
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
      // Cache guest data for offline access
      if(guestData && guestData.guest){
        const cacheData = { guest: guestData.guest, event: guestData.event };
        try{ localStorage.setItem('portal_guest_' + guestId, JSON.stringify(cacheData)); }catch(e){}
      }
    }
    // Online/offline detection
    const offlineBar = document.getElementById('offline-bar');
    window.addEventListener('online', function() { if(offlineBar)offlineBar.style.display='none'; });
    window.addEventListener('offline', function() { if(offlineBar)offlineBar.style.display='flex'; });
    // Check if we're offline and have cached data
    if(!navigator.onLine){
      const cached = localStorage.getItem('portal_guest_' + guestId);
      if(cached && !guestData){
        try{
          const cd = JSON.parse(cached);
          document.getElementById('guest-name').textContent = cd.guest?.name || 'Invitado';
          document.getElementById('guest-email').textContent = cd.guest?.email || '';
          document.getElementById('event-name-header').textContent = cd.event?.name || 'Evento';
          document.getElementById('loading').classList.add('hidden');
          document.getElementById('main').style.display = 'block';
        }catch(e){}
      }
    }
  }catch(e){
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main').innerHTML='<div data-style="padding:40px;text-align:center"><h2 data-style="color:#ef4444">Portal no disponible</h2><p data-style="color:rgba(255,255,255,0.4);margin-top:8px">No se pudo cargar tu información.</p></div>';
    document.getElementById('main').style.display='block'
  }
}
load();

  // M4: Perfil de networking + conexiones en común
  function openNetProfile(guestId) {
    if (!guestData) return;
    const eventId = guestData.event?.id;
    const myId = guestData.guest?.id;
    fetch(API + '/networking/profile/' + guestId + '?event_id=' + eventId).then(function(r){ return r.json(); }).then(function(prof) {
      fetch(API + '/networking/' + eventId + '/guest/' + guestId + '/mutual?other=' + myId).then(function(r){ return r.json(); }).then(function(mutual) {
        const mutualNames = Array.isArray(mutual) ? mutual.map(function(x){ return x.name || x; }) : [];
        const sessionsHtml = (prof.sessions || []).map(function(s2){
          return '<div data-style="font-size:12px;color:#94a3b8">• ' + escHtml(s2.title) + (s2.start_time ? ' · ' + s2.start_time : '') + '</div>';
        }).join('') || '<div data-style="font-size:12px;color:rgba(255,255,255,0.3)">Sin sesiones registradas</div>';
        const mutualHtml = mutualNames.length
          ? '<p data-style="font-size:12px;color:#34d399;margin:8px 0 2px">🤝 ' + mutualNames.length + ' conexión(es) en común: ' + escHtml(mutualNames.slice(0,5).join(', ')) + (mutualNames.length>5?'…':'') + '</p>'
          : '<p data-style="font-size:12px;color:rgba(255,255,255,0.3);margin:8px 0 2px">Sin conexiones en común</p>';
        const ov = document.createElement('div');
        ov.id = 'net-profile-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
        ov.innerHTML = '<div data-style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:16px;max-width:380px;width:100%;padding:24px;color:#e2e8f0">'
          + '<div data-style="text-align:center;margin-bottom:12px"><div data-style="width:56px;height:56px;border-radius:50%;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:26px">👤</div>'
          + '<h3 data-style="font-size:16px;font-weight:800;margin:0">' + escHtml(prof.name || '') + '</h3>'
          + '<p data-style="font-size:12px;color:rgba(255,255,255,0.5);margin:2px 0">' + escHtml(prof.position || '') + (prof.organization ? ' · ' + escHtml(prof.organization) : '') + '</p>'
          + (prof.email ? '<p data-style="font-size:12px;color:#34d399;margin:4px 0 0">' + escHtml(prof.email) + '</p>' : '') + '</div>'
          + '<div data-style="display:flex;gap:8px;margin:12px 0">'
          + '<div data-style="flex:1;text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:8px"><p data-style="font-size:18px;font-weight:800;margin:0">' + (prof.connections || 0) + '</p><p data-style="font-size:10px;color:rgba(255,255,255,0.4)">CONEXIONES</p></div>'
          + '<div data-style="flex:1;text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:8px"><p data-style="font-size:18px;font-weight:800;margin:0">' + mutualNames.length + '</p><p data-style="font-size:10px;color:rgba(255,255,255,0.4)">EN COMÚN</p></div></div>'
          + mutualHtml
          + '<p data-style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.35);margin:14px 0 4px">Sesiones</p>' + sessionsHtml
          + '<button data-act="removeClosest" data-target="net-profile-overlay" data-style="width:100%;margin-top:16px;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,0.06);color:#e2e8f0;font-weight:700;cursor:pointer">Cerrar</button></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
      });
    }).catch(function(){ alert('No se pudo cargar el perfil'); });
  }
