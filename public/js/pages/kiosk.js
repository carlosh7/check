const API = '/api';
let eventId = null;
let selectedGuest = null;
let resetTimeout = null;
let html5QrCode = null;

function getEventFromUrl() {
  const path = window.location.pathname.split('/');
  const slug = path[1];
  if (!slug) return;
  const params = new URLSearchParams(window.location.search);
  const eid = params.get('eid');
  if (eid) { loadEvent(eid); return; }
  // Try to get event by slug
  fetch(API + '/event-by-slug/' + slug).then(function(r) { return r.json(); }).then(function(ev) {
    if (ev && ev.id) loadEvent(ev.id);
    else document.getElementById('event-name').textContent = 'Evento no encontrado';
  }).catch(function() { document.getElementById('event-name').textContent = 'Error cargando evento'; });
}

function loadEvent(eId) {
  eventId = eId;
  fetch(API + '/kiosk/' + eId + '/event').then(function(r) { return r.json(); }).then(function(ev) {
    if (ev && ev.name) {
      document.getElementById('event-name').textContent = ev.name;
      document.title = 'Kiosko | ' + ev.name;
      if (ev.primary_color) {
        document.querySelector('.checkin-btn').style.background = 'linear-gradient(135deg,' + ev.primary_color + ', #a78bfa)';
      }
    }
    updateStats();
  }).catch(function() { document.getElementById('event-name').textContent = 'Error cargando evento'; });
}

function updateStats() {
  if (!eventId) return;
  fetch(API + '/kiosk/' + eventId + '/event').then(function(r) { return r.json(); }).then(function(ev) {
    if (ev && ev.stats) {
      document.getElementById('stat-total').textContent = ev.stats.total || 0;
      document.getElementById('stat-checked').textContent = ev.stats.checkedIn || 0;
    }
  }).catch(function() {});
}

// Search
let searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(searchTimer);
  const q = this.value.trim();
  if (q.length < 2) { document.getElementById('results').innerHTML = ''; return; }
  searchTimer = setTimeout(function() { searchGuests(q); }, 300);
});

function searchGuests(q) {
  if (!eventId) return;
  hideError();
  fetch(API + '/kiosk/' + eventId + '/search?q=' + encodeURIComponent(q)).then(function(r) { return r.json(); }).then(function(guests) {
    const c = document.getElementById('results');
    if (!guests || guests.length === 0) {
      c.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px">Sin resultados</div>';
      return;
    }
    c.innerHTML = guests.map(function(g) {
      const statusClass = g.checked_in ? 'done' : 'pending';
      const statusText = g.checked_in ? '✅ Ingresó' : '⏳ Pendiente';
      const disabledClass = g.checked_in ? 'disabled' : '';
      return '<div class="result-item ' + disabledClass + '" onclick="' + (g.checked_in ? '' : 'selectGuest(\'' + g.id + '\',\'' + escJs(g.name) + '\',\'' + escJs(g.email || '') + '\',\'' + escJs(g.organization || '') + '\')') + '">'
        + '<div class="info"><div class="name">' + escHtml(g.name) + '</div>'
        + '<div class="detail">' + escHtml(g.email || g.organization || '') + '</div></div>'
        + '<div class="status ' + statusClass + '">' + statusText + '</div></div>';
    }).join('');
  }).catch(function() { showError('Error al buscar'); });
}

function selectGuest(id, name, email, org) {
  selectedGuest = { id: id, name: name, email: email, organization: org };
  document.getElementById('confirm-screen').style.display = 'block';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('confirm-name').textContent = name;
  document.getElementById('confirm-detail').textContent = [email, org].filter(Boolean).join(' · ');
  document.getElementById('search-input').value = '';
  document.getElementById('results').innerHTML = '';
}

function confirmCheckin() {
  if (!selectedGuest) return;
  // Get guest token from API
  fetch(API + '/guests/qr/' + selectedGuest.id + '/token').then(function(r) { return r.json(); }).then(function(data) {
    if (!data || !data.token) { showError('Error al obtener token'); return; }
    return fetch(API + '/kiosk/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_token: data.token }) });
  }).then(function(r) { return r.json(); }).then(function(res) {
    if (res && res.success) {
      if (res.alreadyCheckedIn) {
        showAlready(res.guest.name);
      } else {
        showSuccess(selectedGuest.name);
      }
      updateStats();
    } else {
      showError(res && res.error ? res.error : 'Error al registrar');
    }
  }).catch(function() { showError('Error de conexión'); });
}

function showSuccess(name) {
  document.getElementById('confirm-screen').style.display = 'none';
  document.getElementById('success-screen').style.display = 'block';
  document.getElementById('success-name').textContent = '¡Bienvenido, ' + name + '!';
  document.getElementById('reset-timer').style.display = 'block';
  startResetTimer('reset-timer-display');
}

function showAlready(name) {
  document.getElementById('confirm-screen').style.display = 'none';
  document.getElementById('already-screen').style.display = 'block';
  document.getElementById('already-detail').textContent = name + ' ya había registrado su ingreso anteriormente.';
  document.getElementById('reset-timer').style.display = 'block';
  startResetTimer('already-timer-display');
}

function cancelCheckin() {
  selectedGuest = null;
  document.getElementById('confirm-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'block';
  document.getElementById('search-input').focus();
}

function startResetTimer(displayId) {
  let seconds = 5;
  const el = document.getElementById(displayId);
  el.textContent = seconds;
  clearInterval(resetTimeout);
  resetTimeout = setInterval(function() {
    seconds--;
    el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(resetTimeout);
      resetKiosk();
    }
  }, 1000);
}

function resetKiosk() {
  clearInterval(resetTimeout);
  selectedGuest = null;
  document.getElementById('success-screen').style.display = 'none';
  document.getElementById('already-screen').style.display = 'none';
  document.getElementById('confirm-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'block';
  document.getElementById('reset-timer').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').focus();
  document.getElementById('results').innerHTML = '';
}

function toggleQR() {
  const reader = document.getElementById('reader');
  if (reader.style.display === 'block') {
    reader.style.display = 'none';
    if (html5QrCode) { html5QrCode.stop(); html5QrCode = null; }
    return;
  }
  reader.style.display = 'block';
  if (typeof Html5Qrcode !== 'undefined') {
    html5QrCode = new Html5Qrcode('reader');
    html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 },
      function(qrText) {
        // QR scanned - extract guest token from URL
        const token = qrText.split('/').pop();
        if (token && token.length > 5) {
          handleQRToken(token);
        }
        if (html5QrCode) { html5QrCode.stop(); html5QrCode = null; }
        reader.style.display = 'none';
      },
      function() {}
    ).catch(function(e) { console.error('QR error:', e); });
  }
}

function handleQRToken(token) {
  fetch(API + '/kiosk/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_token: token }) })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (res && res.success) {
      if (res.alreadyCheckedIn) showAlready(res.guest.name);
      else showSuccess(res.guest.name);
      updateStats();
    } else {
      showError(res && res.error ? res.error : 'QR no válido');
    }
  }).catch(function() { showError('Error al procesar QR'); });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 4000);
}

function hideError() { document.getElementById('error-msg').style.display = 'none'; }

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escJs(s) { return String(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

// Init
getEventFromUrl();
setInterval(updateStats, 15000); // Refresh stats every 15s
document.getElementById('search-input').focus();
