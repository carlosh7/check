// MASTER SCRIPT V5.6 - BLINDAJE ANTI-ERRORES 🛡️🚨破
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = null;
const API_URL = '/api';
let socket = null;
let analyticsChart = null;

console.log("CHECK V5.6: Iniciando script...");

// --- SAFE INIT ---
try {
    const savedUser = localStorage.getItem('user');
    if (savedUser && savedUser !== "undefined") {
        loggedUser = JSON.parse(savedUser);
    }
} catch (e) {
    console.warn("CHECK V5.6: Error al leer localStorage, limpiando...", e);
    localStorage.removeItem('user');
}

try {
    if (typeof io !== 'undefined') {
        socket = io();
        console.log("CHECK V5.6: Socket.io inicializado.");
    } else {
        console.error("CHECK V5.6: Socket.io no cargó correctamente (io undefined).");
    }
} catch (e) {
    console.error("CHECK V5.6: Error crítico al iniciar Socket.io:", e);
}

// --- HELPERS ---
const setClick = (id, fn) => { 
    const el = document.getElementById(id); 
    if (el) el.onclick = fn; 
    else console.warn(`CHECK V5.6: Elemento ${id} no encontrado para onclick.`);
};
const setSubmit = (id, fn) => { 
    const el = document.getElementById(id); 
    if (el) el.onsubmit = fn; 
    else console.warn(`CHECK V5.6: Elemento ${id} no encontrado para onsubmit.`);
};

async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(loggedUser ? { 'x-user-id': loggedUser.userId } : {}),
        ...options.headers
    };
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) { logout(); throw new Error('Sesión expirada'); }
        return res.json();
    } catch (e) {
        console.error(`CHECK V5.6: Error en fetch ${endpoint}:`, e);
        throw e;
    }
}

function showView(viewName) {
    console.log(`CHECK V5.6: Cambiando a vista ${viewName}`);
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        if (viewName === 'admin') {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    } else {
        console.error(`CHECK V5.6: Vista view-${viewName} no existe en el DOM.`);
    }
}

function logout() {
    localStorage.removeItem('user');
    loggedUser = null;
    showView('registration');
    loadPublicEvent();
}

// --- NAVIGATION & AUTH ---
setClick('login-nav-btn', () => loggedUser ? loadMyEvents() : showView('login'));
setClick('back-to-reg', () => showView('registration'));
setClick('btn-logout', logout);
setClick('go-to-signup', (e) => { e.preventDefault(); document.getElementById('login-form')?.classList.add('hidden'); document.getElementById('signup-form')?.classList.remove('hidden'); });
setClick('go-to-login', (e) => { e.preventDefault(); document.getElementById('signup-form')?.classList.add('hidden'); document.getElementById('login-form')?.classList.remove('hidden'); });

setSubmit('login-form', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    try {
        const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        if (data.success) {
            loggedUser = data;
            localStorage.setItem('user', JSON.stringify(data));
            loadMyEvents();
        } else alert(data.message);
    } catch (err) { alert('Error de conexión'); }
});

// --- EVENT MANAGEMENT ---
async function loadMyEvents() {
    try {
        allEvents = await apiFetch('/events');
        showView('my-events');
        const container = document.getElementById('events-list-container');
        if (container) {
            container.innerHTML = allEvents.map(ev => `
                <div class="glass-card p-8 rounded-[40px] hover:border-primary/40 transition-all group cursor-pointer border border-white/5" onclick="openAdmin('${ev.id}')">
                    <div class="flex justify-between items-start mb-8">
                        <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary transition-all group-hover:shadow-lg group-hover:shadow-primary/30">
                            <span class="material-symbols-outlined text-primary group-hover:text-white transition-colors">event_available</span>
                        </div>
                        <span class="px-4 py-1.5 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 border border-white/5 italic">Producción</span>
                    </div>
                    <h3 class="text-2xl font-black mb-2 font-display tracking-tight">${ev.name}</h3>
                    <p class="text-slate-500 text-xs mb-8 line-clamp-2 leading-relaxed">${ev.description || 'Este evento aún no cuenta con una descripción detallada.'}</p>
                    <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-sm text-primary">location_on</span> ${ev.location || 'Consultar Ubicación'}
                    </div>
                </div>
            `).join('');
        }
    } catch (err) { console.error(err); }
}

async function openAdmin(eventId) {
    currentEvent = allEvents.find(e => e.id === eventId);
    if (!currentEvent) return;
    showView('admin');
    const titleEl = document.getElementById('admin-event-title');
    const locEl = document.getElementById('admin-event-location');
    if (titleEl) titleEl.innerText = currentEvent.name;
    if (locEl) locEl.innerText = currentEvent.location;
    loadGuests();
    updateStats();
    if (socket) socket.emit('join_event', eventId);
}

// --- GUEST LIST & SEARCH ---
async function loadGuests() {
    if (!currentEvent) return;
    try {
        allGuests = await apiFetch(`/guests/${currentEvent.id}`);
        renderGuests(allGuests);
    } catch (err) { console.error(err); }
}

function renderGuests(list) {
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(g => `
        <tr class="hover:bg-white/2 transition-colors border-b border-white/5">
            <td class="px-10 py-6">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs border border-primary/20">
                        ${g.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-sm text-white">${g.name}</div>
                        <div class="text-[10px] text-slate-500 font-medium tracking-tight">${g.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-10 py-6 text-xs text-slate-400 font-medium">${g.organization || '<span class="italic opacity-50">Sin Empresa</span>'}</td>
            <td class="px-10 py-6 text-center">
                <button onclick="toggleCheckin('${g.id}', ${g.checked_in})" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-slate-500 border border-white/5 hover:border-primary/40 hover:text-primary'}">
                    ${g.checked_in ? 'Acreditado' : 'Pendiente'}
                </button>
            </td>
            <td class="px-10 py-6 text-right">
                <button class="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-600 hover:text-white transition-all"><span class="material-symbols-outlined text-sm">edit</span></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('guest-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allGuests.filter(g => 
        g.name.toLowerCase().includes(term) || 
        g.email.toLowerCase().includes(term) || 
        (g.organization && g.organization.toLowerCase().includes(term))
    );
    renderGuests(filtered);
});

async function toggleCheckin(guestId, currentStatus) {
    try {
        await apiFetch(`/checkin/${guestId}`, { method: 'POST', body: JSON.stringify({ status: !currentStatus }) });
        loadGuests();
    } catch (err) { alert('Error al procesar check-in'); }
}

// --- STATS & CHARTS ---
async function updateStats() {
    if (!currentEvent) return;
    try {
        const stats = await apiFetch(`/stats/${currentEvent.id}`);
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setVal('stat-total', stats.total);
        setVal('stat-orgs', stats.orgs);
        setVal('stat-presence', stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) + '%' : '0%');
        setVal('stat-onsite', stats.onsite || 0);
        setVal('stat-health', stats.healthAlerts || 0);
        renderChart(stats.flowData);
    } catch (e) { console.error("CHECK V5.6: Error al actualizar stats:", e); }
}

function renderChart(flowData) {
    const canvas = document.getElementById('flowChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (analyticsChart) analyticsChart.destroy();
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: (flowData || []).map(d => d.hour + ':00'),
            datasets: [{
                data: (flowData || []).map(d => d.count),
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.05)',
                tension: 0.5,
                fill: true,
                borderWidth: 4,
                pointRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 3,
                pointBorderColor: '#7c3aed'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 10, weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 10, weight: 'bold' } } }
            }
        }
    });
}

// --- UI BUTTONS & MODALS ---
setClick('btn-events-list-nav', () => loadMyEvents());
setClick('btn-create-event-open', () => { 
    const idHidden = document.getElementById('ev-id-hidden');
    const form = document.getElementById('new-event-form');
    if (idHidden) idHidden.value = ''; 
    if (form) form.reset();
    document.getElementById('modal-event')?.classList.remove('hidden'); 
});
setClick('btn-edit-event', () => {
    if (!currentEvent) return;
    const setF = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setF('ev-id-hidden', currentEvent.id);
    setF('ev-name', currentEvent.name);
    setF('ev-date', currentEvent.date);
    setF('ev-location', currentEvent.location);
    setF('ev-desc', currentEvent.description);
    document.getElementById('modal-event')?.classList.remove('hidden');
});
setClick('close-modal', () => document.getElementById('modal-event')?.classList.add('hidden'));

setSubmit('new-event-form', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ev-id-hidden')?.value;
    const body = {
        name: document.getElementById('ev-name')?.value,
        date: document.getElementById('ev-date')?.value,
        location: document.getElementById('ev-location')?.value,
        description: document.getElementById('ev-desc')?.value
    };
    try {
        if (id) await apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        else await apiFetch('/events', { method: 'POST', body: JSON.stringify(body) });
        document.getElementById('modal-event')?.classList.add('hidden');
        loadMyEvents();
    } catch (err) { alert('Error al guardar evento'); }
});

setClick('btn-clear-db', async () => {
    if (!currentEvent) return;
    if (!confirm('¿ESTÁS SEGURO? Esta acción borrará todos los invitados y respuestas de encuestas de este evento. No se puede deshacer.')) return;
    try {
        await apiFetch(`/clear-db/${currentEvent.id}`, { method: 'POST' });
        loadGuests();
        updateStats();
        alert('Base de datos del evento limpiada.');
    } catch (err) { alert('Error al limpiar datos'); }
});

setClick('btn-show-qr', () => {
    if (!currentEvent) return;
    if (typeof QRCode !== 'undefined') {
        QRCode.toDataURL(`http://${window.location.host}/feedback.html?eventId=${currentEvent.id}`, (err, url) => {
            const disp = document.getElementById('qr-display');
            if (disp) disp.src = url;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        });
    }
});
setClick('close-qr', () => document.getElementById('modal-qr')?.classList.add('hidden'));

setClick('btn-delete-event', async () => {
    if (!currentEvent) return;
    if (!confirm('¿ELIMINAR EVENTO PERMANENTEMENTE?')) return;
    try {
        await apiFetch(`/events/${currentEvent.id}`, { method: 'DELETE' });
        loadMyEvents();
    } catch (err) { alert('Solo el administrador puede eliminar eventos corporativos.'); }
});

// --- EXPORTS & ANALYTICS ---
setClick('btn-export-excel', () => {
    if (!currentEvent || !loggedUser) return;
    window.location.href = `${API_URL}/export-excel/${currentEvent.id}?x-user-id=${loggedUser.userId}`;
});

setClick('btn-export-analytics', async () => {
    if (!currentEvent) return;
    try {
        const stats = await apiFetch(`/stats/${currentEvent.id}`);
        if (typeof window.jspdf === 'undefined') return alert('Librería PDF no cargada');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 210, 50, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28); doc.text("CHECK ANALYTICS", 20, 30);
        doc.setFontSize(10); doc.text(currentEvent.name.toUpperCase() + " | REPORT V5.6", 20, 40);
        doc.setTextColor(40, 40, 40);
        doc.autoTable({
            startY: 60,
            head: [['Métrica de Rendimiento', 'Valor Consolidado']],
            body: [
                ['Total de Invitados Registrados', stats.total],
                ['Total de Asistencia Efectiva', stats.checkedIn],
                ['Tasa de Presencia (%)', (stats.total > 0 ? Math.round((stats.checkedIn/stats.total)*100) : 0) + "%"],
                ['Empresas Participantes', stats.orgs],
                ['Alertas Médicas / Dieta', stats.healthAlerts]
            ],
            theme: 'striped', headStyles: { fillColor: [124, 58, 237], borderRadius: 10 }
        });
        doc.save(`Check_Analitica_${currentEvent.name.replace(/\s/g, '_')}.pdf`);
    } catch (e) { alert('Error al generar PDF'); }
});

// --- IMPORT LOGIC (V5.6 REINFORCED) ---
setClick('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel')?.click());
setClick('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf')?.click());

const handleImport = async (inputEl) => {
    if (!inputEl.files[0] || !currentEvent || !loggedUser) return;
    const formData = new FormData();
    formData.append('file', inputEl.files[0]);
    formData.append('eventId', currentEvent.id);
    try {
        const res = await fetch(`${API_URL}/import-dry-run`, { method: 'POST', headers: { 'x-user-id': loggedUser.userId }, body: formData });
        const result = await res.json();
        const summary = document.getElementById('import-summary-content');
        if (summary) {
            summary.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 text-center">
                        <p class="text-[10px] font-black uppercase text-emerald-500 mb-1">Listos</p>
                        <p class="text-3xl font-black font-mono text-emerald-500">${result.summary.new}</p>
                    </div>
                    <div class="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20 text-center">
                        <p class="text-[10px] font-black uppercase text-amber-500 mb-1">Duplicados</p>
                        <p class="text-3xl font-black font-mono text-amber-500">${result.summary.existing}</p>
                    </div>
                </div>
                <p class="text-xs text-slate-500 font-bold bg-white/5 p-4 rounded-2xl text-center italic">
                    La importación solo añadirá los ${result.summary.new} registros nuevos detectados.
                </p>
            `;
        }
        document.getElementById('modal-import-results')?.classList.remove('hidden');
        setClick('btn-confirm-import', async () => {
            await apiFetch('/import-confirm', { method: 'POST', body: JSON.stringify({ eventId: currentEvent.id, guests: result.data }) });
            document.getElementById('modal-import-results')?.classList.add('hidden');
            loadGuests(); updateStats();
            alert('¡Importación completada con éxito!');
        });
    } catch (err) { alert('El formato del archivo no es compatible.'); }
};

document.getElementById('admin-file-import-excel')?.addEventListener('change', (e) => handleImport(e.target));
document.getElementById('admin-file-import-pdf')?.addEventListener('change', (e) => handleImport(e.target));
setClick('close-import-modal', () => document.getElementById('modal-import-results')?.classList.add('hidden'));

// --- CLOCKS ---
function updateClocks() {
    const now = new Date();
    const str = now.toLocaleTimeString('es-ES', { hour12: false });
    document.querySelectorAll('#events-list-clock, #admin-clock-real').forEach(el => el.innerText = str);
    if (currentEvent) {
        const diff = new Date(currentEvent.date) - now;
        const cdEl = document.getElementById('admin-clock-countdown');
        const regCdEl = document.getElementById('countdown-timer');
        if (diff > 0) {
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            const timeStr = `${h}:${m}:${s}`;
            if (cdEl) cdEl.innerText = timeStr;
            if (regCdEl) regCdEl.innerText = timeStr;
        } else {
            if (cdEl) cdEl.innerText = "00:00:00";
            if (regCdEl) regCdEl.innerText = "INICIADO";
        }
    }
}
setInterval(updateClocks, 1000);

async function loadPublicEvent() {
    try {
        const evs = await apiFetch('/events');
        if (evs.length > 0) {
            currentEvent = evs[0];
            const badge = document.getElementById('event-name-badge');
            if (badge) badge.innerText = currentEvent.name;
        }
    } catch (err) {}
}

window.onload = () => {
    try {
        console.log("CHECK V5.6: window.onload disparado.");
        if (loggedUser) loadMyEvents();
        else { showView('registration'); loadPublicEvent(); }
    } catch (e) {
        console.error("CHECK V5.6: Error en window.onload:", e);
        showView('registration');
    }
};

if (socket) {
    socket.on('update_stats', (id) => { if (currentEvent && id === currentEvent.id) updateStats(); });
    socket.on('checkin_update', () => loadGuests());
}
