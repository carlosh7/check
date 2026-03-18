// --- State Management (Master v3.0) ---
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const API_URL = '/api';
const socket = io(); // Inicializar Socket.io

// --- DOM Elements ---
const views = {
    registration: document.getElementById('view-registration'),
    login: document.getElementById('view-login'),
    admin: document.getElementById('view-admin'),
    myEvents: document.getElementById('view-my-events'),
    modalEvent: document.getElementById('modal-event')
};

// --- API Helpers (Auth Headers) ---
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(loggedUser ? { 'x-user-id': loggedUser.userId } : {}),
        ...options.headers
    };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Sesión expirada o permisos insuficientes');
    }
    return response.json();
}

// --- Navigation ---
function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.add('hidden'));
    if (views[viewName]) views[viewName].classList.remove('hidden');
    document.body.classList.toggle('overflow-hidden', viewName === 'admin');
}

function logout() {
    localStorage.removeItem('user');
    loggedUser = null;
    showView('registration');
}

// --- UI Interaction Handlers ---
document.getElementById('login-nav-btn').onclick = () => {
    if (loggedUser) loadMyEvents();
    else showView('login');
};

document.getElementById('btn-logout').onclick = logout;
document.title = "Check | Maestro";

// --- Socket Events (Real-time) ---
socket.on('checkin_update', ({ guestId, status }) => {
    const guest = allGuests.find(g => g.id === guestId);
    if (guest) {
        guest.checked_in = status;
        renderGuests(allGuests);
        updateDashboardVisuals();
    }
});

socket.on('new_registration', ({ id, name }) => {
    console.log("Nuevo registro recibido:", name);
    if (currentEvent) loadAdminData();
});

// --- Core Logic ---

async function loadMyEvents() {
    if (!loggedUser) return;
    allEvents = await apiFetch(`/events`);
    showView('myEvents');
    renderEventsList();
}

function renderEventsList() {
    const container = document.getElementById('events-list-container');
    if (!container) return;

    container.innerHTML = allEvents.map(ev => `
        <div class="card bg-slate-900 border-white/5 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden" onclick="switchToDashboard('${ev.id}')">
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-primary/10 transition-all"></div>
            <div class="flex items-start justify-between mb-8 relative z-10">
                <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                    ${ev.logo_url ? `<img src="${ev.logo_url}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-primary text-2xl">event</span>`}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">${ev.status}</span>
            </div>
            <h3 class="text-2xl font-display font-black mb-1 relative z-10">${ev.name}</h3>
            <p class="text-slate-500 text-sm mb-8 flex items-center gap-2 relative z-10 font-medium">${ev.location || 'Sede Remota'}</p>
            <div class="pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Entrar</span>
                <span class="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
        </div>
    `).join('');
}

async function switchToDashboard(id) {
    currentEvent = allEvents.find(e => e.id === id);
    if (!currentEvent) return;

    socket.emit('join_event', id); // Unirse a la sala del evento
    showView('admin');
    
    document.getElementById('admin-event-title').innerText = currentEvent.name;
    document.getElementById('admin-event-location').innerText = currentEvent.location || 'Sin ubicación';
    
    const logoImg = document.getElementById('admin-event-logo');
    if (logoImg) {
        logoImg.src = currentEvent.logo_url || '';
        logoImg.classList.toggle('hidden', !currentEvent.logo_url);
    }
    
    loadAdminData();
}

// Authentication
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;

    try {
        const data = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.success) {
            loggedUser = data;
            localStorage.setItem('user', JSON.stringify(data));
            loadMyEvents();
        }
    } catch (err) { alert('Error de acceso'); }
};

async function loadAdminData() {
    if (!currentEvent) return;
    
    const stats = await apiFetch(`/stats/${currentEvent.id}`);
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
    document.getElementById('stat-missing').innerText = (stats.total || 0) - (stats.checkedIn || 0);

    allGuests = await apiFetch(`/guests/${currentEvent.id}`);
    renderGuests(allGuests);
}

function renderGuests(data) {
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(g => `
        <tr class="group">
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary border border-primary/20">
                        ${g.name.split(' ').map(n=>n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm text-white">${g.name}</p>
                        <p class="text-[10px] text-slate-600 font-mono">${g.email || 'SIN CORREO'}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5">
                <span class="text-xs font-semibold text-slate-500 uppercase">${g.organization || '---'}</span>
            </td>
            <td class="px-6 py-5 text-center">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${g.checked_in ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-600 border border-white/5'}">
                    ${g.checked_in ? 'Presente' : 'Ausente'}
                </div>
            </td>
            <td class="px-6 py-5 text-right">
                <button onclick="toggleCheckin('${g.id}', ${g.checked_in})" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-slate-800 text-slate-500' : 'bg-primary text-white'}">
                    ${g.checked_in ? 'Deshacer' : 'Check-in'}
                </button>
            </td>
        </tr>
    `).join('');
}

window.toggleCheckin = async function(id, status) {
    await apiFetch(`/checkin/${id}`, {
        method: 'POST',
        body: JSON.stringify({ status: !status })
    });
    // La actualización visual vendrá por Socket
};

// Registro Público v3.0
document.getElementById('public-reg-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        phone: document.getElementById('reg-phone').value,
        organization: document.getElementById('reg-org').value
    };

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert('¡Registro Exitoso!');
        e.target.reset();
    }
};

// --- Initialization ---
async function init() {
    // Cargar primer evento público si existe
    const evs = await fetch(`${API_URL}/events`).then(r => r.json());
    if (evs.length > 0) {
        currentEvent = evs[0];
        document.getElementById('event-name-badge').innerText = currentEvent.name;
    }
}
init();
