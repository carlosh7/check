// MASTER SCRIPT V6.0 - NÚCLEO NUCLEAR 🛡️🚀🔑破
window.currentEvent = null;
window.allEvents = [];
window.allGuests = [];
window.loggedUser = null;
window.API_URL = '/api';
window.socket = null;
window.analyticsChart = null;

console.log("CHECK V6.0: SISTEMA NUCLEAR INICIADO.");

// --- EXPOSE GLOBAL FUNCTIONS ---
window.showView = function(viewName) {
    console.log("CHECK V6.0: Ejecutando showView para ->", viewName);
    const views = document.querySelectorAll('[id^="view-"]');
    views.forEach(v => {
        v.classList.add('hidden');
        v.style.display = 'none';
    });
    
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        // Usar display explícito según el tipo de vista
        if (viewName === 'admin') target.style.display = 'grid';
        else if (viewName === 'my-events') target.style.display = 'block';
        else target.style.display = 'flex';

        document.body.style.overflow = (viewName === 'admin') ? 'hidden' : 'auto';
        window.scrollTo(0, 0);
        console.log("CHECK V6.0: Vista cambiada con éxito.");
    } else {
        console.error("CHECK V6.0: NO SE ENCONTRÓ LA VISTA:", viewName);
    }
};

window.logout = function() {
    console.log("CHECK V6.0: Logout.");
    localStorage.removeItem('user');
    window.loggedUser = null;
    window.showView('registration');
    window.loadPublicEvent();
};

// --- AUTH & API ---
window.apiFetch = async function(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(window.loggedUser ? { 'x-user-id': window.loggedUser.userId } : {}),
        ...options.headers
    };
    try {
        const res = await fetch(`${window.API_URL}${endpoint}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) { window.logout(); throw new Error('Auth fail'); }
        return res.json();
    } catch (e) {
        console.error("API FAIL:", e);
        throw e;
    }
};

// --- LOADERS ---
window.loadMyEvents = async function() {
    try {
        console.log("CHECK V6.0: Cargando eventos corporativos...");
        window.allEvents = await window.apiFetch('/events');
        window.showView('my-events');
        const container = document.getElementById('events-list-container');
        if (container) {
            container.innerHTML = window.allEvents.map(ev => `
                <div class="glass-card p-8 rounded-[40px] hover:border-primary/40 transition-all group cursor-pointer border border-white/5 bg-slate-900/40" onclick="window.openAdmin('${ev.id}')">
                    <div class="flex justify-between items-start mb-8">
                        <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary transition-all group-hover:shadow-lg group-hover:shadow-primary/30">
                            <span class="material-symbols-outlined text-primary group-hover:text-white transition-colors">event_available</span>
                        </div>
                    </div>
                    <h3 class="text-2xl font-black mb-2 text-white">${ev.name}</h3>
                    <p class="text-slate-500 text-xs">${ev.description || ''}</p>
                </div>
            `).join('');
        }
    } catch (err) { window.showView('login'); }
};

window.openAdmin = async function(eventId) {
    window.currentEvent = window.allEvents.find(e => e.id === eventId);
    if (!window.currentEvent) return;
    window.showView('admin');
    document.getElementById('admin-event-title').innerText = window.currentEvent.name;
    window.loadGuests();
    window.updateStats();
    if (window.socket) window.socket.emit('join_event', eventId);
};

window.loadGuests = async function() {
    if (!window.currentEvent) return;
    window.allGuests = await window.apiFetch(`/guests/${window.currentEvent.id}`);
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;
    tbody.innerHTML = window.allGuests.map(g => `
        <tr class="border-b border-white/5">
            <td class="px-10 py-6 text-white font-bold">${g.name}</td>
            <td class="px-10 py-6 text-slate-400">${g.organization || ''}</td>
            <td class="px-10 py-6 text-center">
                <button onclick="window.toggleCheckin('${g.id}', ${g.checked_in})" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase ${g.checked_in ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-slate-500'}">
                    ${g.checked_in ? 'OK' : 'PND'}
                </button>
            </td>
        </tr>
    `).join('');
};

window.toggleCheckin = async function(guestId, status) {
    await window.apiFetch(`/checkin/${guestId}`, { method: 'POST', body: JSON.stringify({ status: !status }) });
    window.loadGuests();
};

window.updateStats = async function() {
    if (!window.currentEvent) return;
    const stats = await window.apiFetch(`/stats/${window.currentEvent.id}`);
    document.getElementById('stat-total').innerText = stats.total;
    // (Actualizar otros campos si es necesario)
};

window.loadPublicEvent = async function() {
    try {
        const evs = await window.apiFetch('/events');
        if (evs.length > 0) window.currentEvent = evs[0];
    } catch (e) {}
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("CHECK V6.0: DOM LISTO.");
    try {
        const saved = localStorage.getItem('user');
        if (saved && saved !== "undefined") window.loggedUser = JSON.parse(saved);
        
        if (typeof io !== 'undefined') {
            window.socket = io();
            window.socket.on('update_stats', (id) => { if (window.currentEvent && id === window.currentEvent.id) window.updateStats(); });
            window.socket.on('checkin_update', () => window.loadGuests());
        }
    } catch (e) { console.error("Init Core fail:", e); }

    // Forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = await window.apiFetch('/login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('login-user').value, password: document.getElementById('login-pass').value }) });
        if (data.success) {
            window.loggedUser = data;
            localStorage.setItem('user', JSON.stringify(data));
            window.loadMyEvents();
        } else alert(data.message);
    };

    const regForm = document.getElementById('public-reg-form');
    if (regForm) regForm.onsubmit = async (e) => {
        e.preventDefault();
        const body = { event_id: window.currentEvent?.id, name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, phone: document.getElementById('reg-phone').value, organization: document.getElementById('reg-org').value, gender: "O", dietary_notes: document.getElementById('reg-diet').value };
        const res = await fetch(`${window.API_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { alert("¡Éxito!"); e.target.reset(); }
    };

    // Global listeners for nav buttons in admin
    const navBtn = document.getElementById('btn-events-list-nav');
    if (navBtn) navBtn.onclick = () => window.loadMyEvents();
    
    // Initial view
    if (window.loggedUser) window.loadMyEvents();
    else { window.showView('registration'); window.loadPublicEvent(); }
});

// Clock
setInterval(() => {
    const str = new Date().toLocaleTimeString('es-ES', { hour12: false });
    document.querySelectorAll('#events-list-clock, #admin-clock-real').forEach(el => el.innerText = str);
}, 1000);
