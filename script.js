// MASTER SCRIPT V5.4 - RECONSTRUCCIÓN TOTAL 破🛡️
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const API_URL = '/api';
const socket = io();
let analyticsChart = null;

// --- HELPERS ---
const setClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
const setSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.onsubmit = fn; };

async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(loggedUser ? { 'x-user-id': loggedUser.userId } : {}),
        ...options.headers
    };
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) { logout(); throw new Error('Sesión expirada'); }
    return res.json();
}

function showView(viewName) {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');
    document.body.classList.toggle('overflow-hidden', viewName === 'admin');
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
setClick('go-to-signup', (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); });
setClick('go-to-login', (e) => { e.preventDefault(); document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); });

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
        container.innerHTML = allEvents.map(ev => `
            <div class="glass p-8 rounded-[40px] hover:border-primary/40 transition-all group cursor-pointer" onclick="openAdmin('${ev.id}')">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <span class="material-symbols-outlined text-primary">calendar_today</span>
                    </div>
                    <span class="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Proximity</span>
                </div>
                <h3 class="text-xl font-black mb-2 font-display">${ev.name}</h3>
                <p class="text-slate-500 text-sm mb-6 line-clamp-2">${ev.description || 'Sin descripción'}</p>
                <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <span class="material-symbols-outlined text-sm">location_on</span> ${ev.location || 'TBD'}
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function openAdmin(eventId) {
    currentEvent = allEvents.find(e => e.id === eventId);
    if (!currentEvent) return;
    showView('admin');
    document.getElementById('admin-event-title').innerText = currentEvent.name;
    document.getElementById('admin-event-location').innerText = currentEvent.location;
    loadGuests();
    updateStats();
    socket.emit('join_event', eventId);
}

// --- GUEST LIST & SEARCH ---
async function loadGuests() {
    try {
        allGuests = await apiFetch(`/guests/${currentEvent.id}`);
        renderGuests(allGuests);
    } catch (err) { console.error(err); }
}

function renderGuests(list) {
    const tbody = document.getElementById('guests-tbody');
    tbody.innerHTML = list.map(g => `
        <tr class="hover:bg-white/3 transition-colors">
            <td class="px-6 py-4">
                <div class="font-bold text-sm">${g.name}</div>
                <div class="text-[10px] text-slate-500 font-mono">${g.email}</div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-400">${g.organization || '-'}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="toggleCheckin('${g.id}', ${g.checked_in})" class="w-10 h-10 rounded-full flex items-center justify-center mx-auto transition-all ${g.checked_in ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-slate-600 hover:bg-white/10'}">
                    <span class="material-symbols-outlined">${g.checked_in ? 'check_circle' : 'radio_button_unchecked'}</span>
                </button>
            </td>
            <td class="px-6 py-4 text-right">
                <button class="p-2 text-slate-500 hover:text-white"><span class="material-symbols-outlined text-sm">more_vert</span></button>
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
    const stats = await apiFetch(`/stats/${currentEvent.id}`);
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-orgs').innerText = stats.orgs;
    document.getElementById('stat-presence').innerText = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) + '%' : '0%';
    document.getElementById('stat-onsite').innerText = stats.onsite || 0;
    document.getElementById('stat-health').innerText = stats.healthAlerts || 0;

    renderChart(stats.flowData);
}

function renderChart(flowData) {
    const ctx = document.getElementById('flowChart').getContext('2d');
    if (analyticsChart) analyticsChart.destroy();
    
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: (flowData || []).map(d => d.hour + ':00'),
            datasets: [{
                label: 'Flujo de Asistencia',
                data: (flowData || []).map(d => d.count),
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
            }
        }
    });
}

// --- EXPORTS ---
setClick('btn-export-excel', () => {
    if (!currentEvent) return;
    const url = `${API_URL}/export-excel/${currentEvent.id}?x-user-id=${loggedUser.userId}`;
    window.location.href = url;
});

setClick('btn-export-analytics', async () => {
    if (!currentEvent) return;
    const stats = await apiFetch(`/stats/${currentEvent.id}`);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Estilo Premium
    doc.setFillColor(124, 58, 237); // Primary color
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("REPORTE DE ANALÍTICA", 15, 25);
    doc.setFontSize(10);
    doc.text(currentEvent.name.toUpperCase(), 15, 32);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.text("Resumen Ejecutivo", 15, 55);

    // Tabla de Métricas
    const metrics = [
        ["Total Invitados", stats.total.toString()],
        ["Asistencia Real", stats.checkedIn.toString()],
        ["Porcentaje Presencia", (stats.total > 0 ? Math.round((stats.checkedIn/stats.total)*100) : 0) + "%"],
        ["Organizaciones", stats.orgs.toString()],
        ["Registros On-Site", (stats.onsite || 0).toString()],
        ["Alertas de Salud", (stats.healthAlerts || 0).toString()]
    ];

    doc.autoTable({
        startY: 65,
        head: [['Métrica', 'Valor']],
        body: metrics,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
        styles: { font: 'helvetica', fontSize: 10 }
    });

    // Tabla de Flujo
    doc.addPage();
    doc.text("Flujo Horario de Ingresos", 15, 20);
    const flowBody = (stats.flowData || []).map(d => [d.hour + ":00 hs", d.count + " personas"]);
    doc.autoTable({
        startY: 30,
        head: [['Hora', 'Ingresos']],
        body: flowBody.length > 0 ? flowBody : [['-', 'Sin registros']],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Analitica_${currentEvent.name.replace(/\s/g, '_')}.pdf`);
});

// --- IMPORT ---
setClick('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel').click());
setClick('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf').click());

const handleImport = async (inputEl) => {
    if (!inputEl.files[0] || !currentEvent) return;
    const formData = new FormData();
    formData.append('file', inputEl.files[0]);
    formData.append('eventId', currentEvent.id);

    try {
        const res = await fetch(`${API_URL}/import-dry-run`, {
            method: 'POST',
            headers: { 'x-user-id': loggedUser.userId },
            body: formData
        });
        const result = await res.json();
        if (result.error) return alert(result.error);

        const summary = document.getElementById('import-summary-content');
        summary.innerHTML = `
            <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div class="flex justify-between mb-2"><span>Nuevos</span><span class="text-green-500 font-bold">+${result.summary.new}</span></div>
                <div class="flex justify-between mb-2"><span>Duplicados</span><span class="text-amber-500 font-bold">${result.summary.existing}</span></div>
                <div class="flex justify-between border-t border-white/10 pt-2 mt-2 font-black"><span>Total a importar</span><span>${result.summary.new}</span></div>
            </div>
        `;
        document.getElementById('modal-import-results').classList.remove('hidden');

        setClick('btn-confirm-import', async () => {
            await apiFetch('/import-confirm', { method: 'POST', body: JSON.stringify({ eventId: currentEvent.id, guests: result.data }) });
            document.getElementById('modal-import-results').classList.add('hidden');
            loadGuests();
            updateStats();
        });
    } catch (err) { alert('Error al procesar archivo'); }
};

document.getElementById('admin-file-import-excel').addEventListener('change', (e) => handleImport(e.target));
document.getElementById('admin-file-import-pdf').addEventListener('change', (e) => handleImport(e.target));
setClick('close-import-modal', () => document.getElementById('modal-import-results').classList.add('hidden'));

// --- CLOCKS & COUNTDOWN ---
function updateClocks() {
    const now = new Date();
    const clockText = now.toLocaleTimeString('es-ES', { hour12: false });
    
    document.querySelectorAll('[id$="clock-real"], [id$="list-clock"]').forEach(el => el.innerText = clockText);

    if (currentEvent) {
        const evDate = new Date(currentEvent.date);
        const diff = evDate - now;
        const cdEl = document.getElementById('admin-clock-countdown');
        const regCdEl = document.getElementById('countdown-timer');

        if (diff > 0) {
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            const str = `${h}:${m}:${s}`;
            if (cdEl) cdEl.innerText = str;
            if (regCdEl) regCdEl.innerText = str;
        } else {
            if (cdEl) cdEl.innerText = "00:00:00";
            if (regCdEl) regCdEl.innerText = "EVENTO INICIADO";
        }
    }
}

setInterval(updateClocks, 1000);

// --- INITIAL LOAD ---
async function loadPublicEvent() {
    try {
        const evs = await apiFetch('/events');
        if (evs.length > 0) {
            currentEvent = evs[0]; // Simplificación: usar el primero
            document.getElementById('event-name-badge').innerText = currentEvent.name;
        }
    } catch (err) {}
}

window.onload = () => {
    if (loggedUser) loadMyEvents();
    else {
        showView('registration');
        loadPublicEvent();
    }
};

// Sockets
socket.on('update_stats', (eId) => { if (currentEvent && eId === currentEvent.id) updateStats(); });
socket.on('checkin_update', ({ guestId, status }) => { loadGuests(); });
