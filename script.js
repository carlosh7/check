// MASTER SCRIPT V5.7 - REFUERZO DE INTERACCIÓN 🛡️🚀破
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = null;
const API_URL = '/api';
let socket = null;
let analyticsChart = null;

console.log("CHECK V5.7: Iniciando sistema...");

// --- SAFE INIT ---
function initCore() {
    try {
        const savedUser = localStorage.getItem('user');
        if (savedUser && savedUser !== "undefined") {
            loggedUser = JSON.parse(savedUser);
            console.log("CHECK V5.7: Usuario detectado:", loggedUser.username);
        }
    } catch (e) {
        console.warn("CHECK V5.7: Error en localStorage:", e);
        localStorage.removeItem('user');
    }

    try {
        if (typeof io !== 'undefined') {
            socket = io();
            console.log("CHECK V5.7: Socket.io Conectado.");
            setupSocketListeners();
        } else {
            console.warn("CHECK V5.7: Socket.io no disponible (Offline mode).");
        }
    } catch (e) {
        console.error("CHECK V5.7: Error en Socket.io init:", e);
    }
}

// --- HELPERS ---
const setClick = (id, fn) => { 
    const el = document.getElementById(id); 
    if (el) { el.onclick = fn; return true; }
    return false;
};
const setSubmit = (id, fn) => { 
    const el = document.getElementById(id); 
    if (el) { el.onsubmit = fn; return true; }
    return false;
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
        console.error(`CHECK V5.7: Error Fetch ${endpoint}:`, e);
        throw e;
    }
}

function showView(viewName) {
    console.log(`CHECK V5.7: Navegando a ${viewName}`);
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        document.body.style.overflow = (viewName === 'admin') ? 'hidden' : 'auto';
        window.scrollTo(0, 0);
    } else {
        console.error(`CHECK V5.7: Vista ${viewName} no encontrada.`);
    }
}

function logout() {
    localStorage.removeItem('user');
    loggedUser = null;
    showView('registration');
    loadPublicEvent();
}

// --- LOGIC ---
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
                    </div>
                    <h3 class="text-2xl font-black mb-2 font-display tracking-tight text-white">${ev.name}</h3>
                    <p class="text-slate-500 text-xs mb-8 line-clamp-2">${ev.description || 'Sin descripción.'}</p>
                    <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-sm text-primary">location_on</span> ${ev.location || 'N/A'}
                    </div>
                </div>
            `).join('');
        }
    } catch (err) { console.error("Error al cargar eventos:", err); }
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

async function toggleCheckin(guestId, currentStatus) {
    try {
        await apiFetch(`/checkin/${guestId}`, { method: 'POST', body: JSON.stringify({ status: !currentStatus }) });
        loadGuests();
    } catch (err) { alert('Error check-in'); }
}

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
    } catch (e) { console.error("Error stats:", e); }
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

function setupSocketListeners() {
    socket.on('update_stats', (id) => { if (currentEvent && id === currentEvent.id) updateStats(); });
    socket.on('checkin_update', () => loadGuests());
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initCore();

    // STAFF ACCESS
    setClick('login-nav-btn', () => {
        console.log("CHECK V5.7: Botón Acceso STAFF clicado.");
        if (loggedUser) loadMyEvents();
        else showView('login');
    });

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

    // PUBLIC REGISTRATION (V5.7 FIX)
    setSubmit('public-reg-form', async (e) => {
        e.preventDefault();
        if (!currentEvent) { alert("Error: Evento no detectado. Contacte a soporte STAFF."); return; }
        const body = {
            event_id: currentEvent.id,
            name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
            phone: document.getElementById('reg-phone').value,
            organization: document.getElementById('reg-org').value,
            gender: "O",
            dietary_notes: document.getElementById('reg-diet').value
        };
        try {
            const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) {
                alert("¡Registro Exitoso! Bienvenido al evento.");
                e.target.reset();
            } else alert("Error en el registro.");
        } catch (err) { alert("Error de red."); }
    });

    // ADMIN ACTIONS
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
        } catch (err) { alert('Error al guardar'); }
    });

    setClick('btn-clear-db', async () => {
        if (!currentEvent) return;
        if (!confirm('¿Limpiar base de datos?')) return;
        try {
            await apiFetch(`/clear-db/${currentEvent.id}`, { method: 'POST' });
            loadGuests(); updateStats();
            alert('Limpio.');
        } catch (err) { alert('Error al limpiar'); }
    });

    setClick('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel')?.click());
    setClick('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf')?.click());
    
    // SEARCH
    document.getElementById('guest-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allGuests.filter(g => 
            g.name.toLowerCase().includes(term) || 
            g.email.toLowerCase().includes(term) || 
            (g.organization && g.organization.toLowerCase().includes(term))
        );
        renderGuests(filtered);
    });

    // EXPORTS
    setClick('btn-export-excel', () => {
        if (!currentEvent || !loggedUser) return;
        window.location.href = `${API_URL}/export-excel/${currentEvent.id}?x-user-id=${loggedUser.userId}`;
    });

    setClick('btn-export-analytics', async () => {
        if (!currentEvent) return;
        const stats = await apiFetch(`/stats/${currentEvent.id}`);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("CHECK REPORT V5.7", 20, 20);
        doc.autoTable({
            startY: 40,
            head: [['Métrica', 'Valor']],
            body: [['Total', stats.total], ['Asistencia', stats.checkedIn]]
        });
        doc.save(`Reporte_${currentEvent.id}.pdf`);
    });

    // FINISH
    if (!loggedUser) { showView('registration'); loadPublicEvent(); }
    else loadMyEvents();
});

// CLOCK
setInterval(() => {
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
}, 1000);

async function loadPublicEvent() {
    try {
        const evs = await apiFetch('/events');
        if (evs.length > 0) currentEvent = evs[0];
    } catch (err) {}
}
