let API='/api',eventData=null,cdInterval=null;

function downloadQR(){
  const img=document.getElementById('qr-img');
  if(!img||!img.src)return;
  const a=document.createElement('a');
  a.href=img.src;a.download='qrevento.png';
  a.click()
}

function updateCountdown(){
  if(!eventData||!eventData.date)return;
  const target=new Date(eventData.date).getTime(),now=Date.now(),diff=target-now;
  if(diff<=0){
    document.getElementById('countdown').style.display='none';
    document.getElementById('event-passed').style.display='block';
    if(cdInterval)clearInterval(cdInterval);
    return
  }
  const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),
      m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
  document.getElementById('cd-days').textContent=String(d).padStart(2,'0');
  document.getElementById('cd-hours').textContent=String(h).padStart(2,'0');
  document.getElementById('cd-mins').textContent=String(m).padStart(2,'0');
  document.getElementById('cd-secs').textContent=String(s).padStart(2,'0')
}

async function load(){
  let p=window.location.pathname.split('/'),eventId=null,idx=p.indexOf('landing');
  if(idx>0)eventId=p[idx-1];
  if(!eventId||eventId==='event'){
    const params=new URLSearchParams(window.location.search);
    eventId=params.get('event')
  }
  if(!eventId){
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main').innerHTML='<div class="card"><h1 style="color:#ef4444">Invitación no válida</h1><p style="color:rgba(255,255,255,0.5)">El enlace no es válido o ha expirado.</p></div>';
    document.getElementById('main').style.display='block';return
  }
  try{
    const r=await fetch(API+'/event/'+eventId);
    if(!r.ok)throw Error('No encontrado');
    eventData=await r.json();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main').style.display='block';
    document.title=eventData.name+' | Invitación';
    document.getElementById('event-name').textContent=eventData.name||'Evento';
    if(eventData.date)document.getElementById('event-date').textContent=new Date(eventData.date).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    if(eventData.location&&eventData.location!=='Por definir')document.getElementById('event-location').textContent='📍 '+eventData.location;
    if(eventData.description){document.getElementById('event-desc').textContent=eventData.description;document.getElementById('event-desc').style.display='block'}
    document.getElementById('btn-register').href='/registro.html?event='+eventId;
    // Calendar links
    if(eventData.date){
      const startTxt=new Date(eventData.date).toISOString().replace(/-|:|\.\d+/g,'');
      const endTxt=eventData.end_date?new Date(eventData.end_date).toISOString().replace(/-|:|\.\d+/g,'') : new Date(new Date(eventData.date).getTime()+7200000).toISOString().replace(/-|:|\.\d+/g,'');
      const txt=encodeURIComponent(eventData.name||'Evento');
      const loc=encodeURIComponent(eventData.location||'');
      const desc=encodeURIComponent(eventData.description||'');
      document.getElementById('btn-calendar').href='/api/event/'+eventId+'/ics';
    }
    // Generate QR for event registration link
    const regUrl=window.location.origin+'/registro.html?event='+eventId;
    try{
      const qrRes=await fetch(API+'/event/'+eventId+'/qr');
      if(qrRes.ok){const blob=await qrRes.blob();document.getElementById('qr-img').src=URL.createObjectURL(blob)}
    }catch(e){}
    // Show map if coordinates exist
    if(eventData.music_url){
      document.getElementById('music-container').style.display='block';
      document.getElementById('event-music').src=eventData.music_url;
    }
    if(eventData.video_conference_url){
      document.getElementById('video-container').style.display='block';
      document.getElementById('video-link').href=eventData.video_conference_url;
    }
    if(eventData.latitude&&eventData.longitude){
      document.getElementById('map-container').style.display='block';
      try{
        const map=L.map('event-map').setView([eventData.latitude,eventData.longitude],eventData.map_zoom||14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);
        L.marker([eventData.latitude,eventData.longitude]).addTo(map).bindPopup(eventData.name||'Evento')
      }catch(e){}
    }
    updateCountdown();
    cdInterval=setInterval(updateCountdown,1000)
  }catch(e){
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main').innerHTML='<div class="card"><h1 style="color:#ef4444">Invitación no disponible</h1><p style="color:rgba(255,255,255,0.5)">No se pudo cargar la invitación.</p></div>';
    document.getElementById('main').style.display='block'
  }
}
load();
