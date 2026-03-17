// --- State Management ---
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUserId = localStorage.getItem('userId');
const API_URL = '/api';

// --- DOM Elements ---
const views = {
    registration: document.getElementById('view-registration'),
    login: document.getElementById('view-login'),
    admin: document.getElementById('view-admin'),
    myEvents: document.getElementById('view-my-events'),
    modalEvent: document.getElementById('modal-event')
};

// --- Navigation ---
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) views[viewName].classList.remove('hidden');
}

document.getElementById('login-nav-btn').onclick = () => {
    if (loggedUserId) {
        loadMyEvents();
    } else {
        showView('login');
    }
};

document.getElementById('back-to-reg').onclick = () => showView('registration');
document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('userId');
    loggedUserId = null;
    showView('registration');
};

document.getElementById('btn-events-list').onclick = () => loadMyEvents();
document.getElementById('btn-create-event-open').onclick = () => views.modalEvent.classList.remove('hidden');
document.getElementById('close-modal').onclick = () => views.modalEvent.classList.add('hidden');
document.getElementById('back-to-admin').onclick = () => showView('admin');

// --- Timers (Public & Admin) ---
function updateTimers() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    
    if (document.getElementById('nav-clock')) document.getElementById('nav-clock').innerText = timeStr;
    if (document.getElementById('current-clock')) document.getElementById('current-clock').innerText = timeStr;
    if (document.getElementById('admin-clock')) document.getElementById('admin-clock').innerText = timeStr;

    if (currentEvent && currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const diff = eventDate - now;
        const msg = diff > 0 ? formatCountdown(diff) : '¡EN CURSO!';
        
        if (document.getElementById('countdown-timer')) document.getElementById('countdown-timer').innerText = msg;
        if (document.getElementById('admin-countdown')) {
            document.getElementById('admin-countdown').innerHTML = `<span class="material-symbols-outlined text-[16px]">schedule</span> ${msg}`;
        }
    }
}

function formatCountdown(diff) {
    const h = Math.floor(diff / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    return `${h}h ${m}m ${s}s`;
}
setInterval(updateTimers, 1000);

// --- API & UI Logic ---

async function loadMyEvents() {
    if (!loggedUserId) return;
    const res = await fetch(`${API_URL}/events?userId=${loggedUserId}`);
    allEvents = await res.json();
    showView('myEvents');
    renderEventsList();
}

function renderEventsList() {
    const container = document.getElementById('events-list-container');
    container.innerHTML = allEvents.map(ev => `
        <div class="glass p-8 rounded-[32px] border border-white/5 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden" onclick="switchToDashboard(${ev.id})">
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-primary/10 transition-all"></div>
            <div class="flex items-start justify-between mb-6 relative z-10">
                <div class="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                    ${ev.logo_url ? `<img src="${ev.logo_url}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-primary text-3xl">event</span>`}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">Activo</span>
            </div>
            <h3 class="text-2xl font-display font-black mb-1 relative z-10">${ev.name}</h3>
            <p class="text-slate-400 text-sm mb-6 flex items-center gap-2 relative z-10">
                <span class="material-symbols-outlined text-[16px]">calendar_month</span>
                ${new Date(ev.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
            </p>
            <div class="pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestionar</span>
                <span class="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
        </div>
    `).join('');
}

async function switchToDashboard(id) {
    currentEvent = allEvents.find(e => e.id === id);
    showView('admin');
    document.getElementById('admin-event-title').innerText = currentEvent.name;
    const logoImg = document.getElementById('admin-event-logo');
    if (currentEvent.logo_url) {
        logoImg.src = currentEvent.logo_url;
        logoImg.classList.remove('hidden');
    } else {
        logoImg.classList.add('hidden');
    }
    loadAdminData();
}

// Crear Evento
document.getElementById('new-event-form').onsubmit = async (e) => {
    e.preventDefault();
    let logo_url = null;
    const logoFileInput = document.getElementById('ev-logo-input');
    const logoFile = logoFileInput.files[0];

    if (logoFile) {
        const logoFormData = new FormData();
        logoFormData.append('logo', logoFile);
        const uploadRes = await fetch(`${API_URL}/upload-logo`, { method: 'POST', body: logoFormData });
        const uploadData = await uploadRes.json();
        logo_url = uploadData.url;
    }

    const data = {
        userId: loggedUserId,
        name: document.getElementById('ev-name').value,
        date: document.getElementById('ev-date').value,
        location: document.getElementById('ev-location').value,
        description: document.getElementById('ev-desc').value,
        logo_url: logo_url
    };

    const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        views.modalEvent.classList.add('hidden');
        loadMyEvents();
        e.target.reset();
    }
};

// Signup / Login toggles
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');

document.getElementById('go-to-signup').onclick = (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
};

document.getElementById('go-to-login').onclick = (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
};

// Signup API
signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-user').value;
    const password = document.getElementById('signup-pass').value;

    const res = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        alert('¡Cuenta creada! Ahora puedes iniciar sesión.');
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
};

// Login API
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('login-user').value,
            password: document.getElementById('login-pass').value
        })
    });

    if (res.ok) {
        const data = await res.json();
        loggedUserId = data.userId;
        localStorage.setItem('userId', loggedUserId);
        loadMyEvents();
    } else {
        alert('Error de acceso');
    }
};

// Dashboard Data
async function loadAdminData() {
    if (!currentEvent) return;
    
    const sRes = await fetch(`${API_URL}/stats/${currentEvent.id}`);
    const stats = await sRes.json();
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
    document.getElementById('stat-missing').innerText = (stats.total || 0) - (stats.checkedIn || 0);

    const fRes = await fetch(`${API_URL}/surveys/stats/${currentEvent.id}`);
    const fStats = await fRes.json();
    document.getElementById('stat-satisfaction').innerText = fStats.avgRating ? fStats.avgRating.toFixed(1) : "0.0";

    const gRes = await fetch(`${API_URL}/guests/${currentEvent.id}`);
    allGuests = await gRes.json();
    renderGuests(allGuests);
}

// QR Logic
document.getElementById('btn-show-qr').onclick = async () => {
    const res = await fetch(`${API_URL}/events/${currentEvent.id}/qrcode`);
    const data = await res.json();
    document.getElementById('qr-display').src = data.qrCode;
    document.getElementById('modal-qr').classList.remove('hidden');
};
document.getElementById('close-qr').onclick = () => document.getElementById('modal-qr').classList.add('hidden');

// Survey Customization
const questionsList = document.getElementById('questions-list');
document.getElementById('btn-edit-survey').onclick = () => {
    document.getElementById('modal-survey').classList.remove('hidden');
    loadSurveyQuestions();
};
document.getElementById('close-survey-modal').onclick = () => document.getElementById('modal-survey').classList.add('hidden');

async function loadSurveyQuestions() {
    const res = await fetch(`${API_URL}/surveys/questions/${currentEvent.id}`);
    const questions = await res.json();
    questionsList.innerHTML = questions.map(q => `
        <div class="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
            <div>
                <p class="font-bold text-sm mb-1">${q.question}</p>
                <span class="text-[10px] uppercase tracking-tighter text-slate-500">${q.type === 'yes_no' ? 'Sí / No' : '5 Estrellas'}</span>
            </div>
            <button onclick="deleteQuestion(${q.id})" class="text-red-400 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `).join('') || '<p class="text-center text-slate-500 py-10">No hay preguntas aún.</p>';
}

document.getElementById('add-question-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        question: document.getElementById('new-question-input').value,
        type: document.getElementById('new-question-type').value
    };
    await fetch(`${API_URL}/surveys/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    document.getElementById('new-question-input').value = '';
    loadSurveyQuestions();
};

async function deleteQuestion(id) {
    await fetch(`${API_URL}/surveys/questions/${id}`, { method: 'DELETE' });
    loadSurveyQuestions();
}

// Search Logic
document.getElementById('guest-search').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allGuests.filter(g => 
        g.name.toLowerCase().includes(term) || 
        (g.organization && g.organization.toLowerCase().includes(term)) ||
        (g.email && g.email.toLowerCase().includes(term))
    );
    renderGuests(filtered);
};

function renderGuests(data) {
    const tbody = document.getElementById('guests-tbody');
    tbody.innerHTML = data.map(g => `
        <tr class="hover:bg-white/[0.02] transition-colors group">
            <td class="px-8 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                        ${g.name.split(' ').map(n=>n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${g.name}</p>
                        <p class="text-[10px] text-slate-500 font-mono">${g.email || '-'}</p>
                    </div>
                </div>
            </td>
            <td class="px-8 py-5 text-center">
                <span class="text-xs font-medium text-slate-400">${g.organization || '-'}</span>
            </td>
            <td class="px-8 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${g.checked_in ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-500 border border-white/5'}">
                    ${g.checked_in ? 'Presente' : 'Pendiente'}
                </span>
            </td>
            <td class="px-8 py-5 text-right">
                <button onclick="toggleCheckin(${g.id}, ${g.checked_in})" class="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'}">
                    ${g.checked_in ? 'Deshacer' : 'Check-in'}
                </button>
            </td>
        </tr>
    `).join('');
}

async function toggleCheckin(id, currentStatus) {
    await fetch(`${API_URL}/checkin/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: !currentStatus })
    });
    loadAdminData();
}

// Delete Event
document.getElementById('btn-delete-event').onclick = async () => {
    if (!confirm('¿Estás seguro de borrar este evento y todos sus datos asociados?')) return;
    const res = await fetch(`${API_URL}/events/${currentEvent.id}`, { method: 'DELETE' });
    if (res.ok) {
        currentEvent = null;
        loadMyEvents();
    }
};

// Import Handlers
document.getElementById('btn-import-excel-trigger').onclick = () => document.getElementById('admin-file-import-excel').click();
document.getElementById('btn-import-pdf-trigger').onclick = () => document.getElementById('admin-file-import-pdf').click();

document.getElementById('admin-file-import-excel').onchange = (e) => handleImport(e, 'import');
document.getElementById('admin-file-import-pdf').onchange = (e) => handleImport(e, 'import-pdf');

async function handleImport(e, endpoint) {
    const file = e.target.files[0];
    if (!file || !currentEvent) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/${endpoint}/${currentEvent.id}`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        loadAdminData();
        alert('Base de datos actualizada con éxito');
    }
}

// Export PDF
document.getElementById('btn-export-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = jsPDF();
    doc.text(`Lista de Asistencia: ${currentEvent.name}`, 14, 20);
    doc.autoTable({
        head: [['Nombre', 'Organización', 'Estado']],
        body: allGuests.map(g => [g.name, g.organization, g.checked_in ? 'PRESENTE' : 'FALTANTE']),
        startY: 30
    });
    doc.save(`Asistencia_${currentEvent.name.replace(/ /g, '_')}.pdf`);
};

// Public Initialization
async function initPublic() {
    const res = await fetch(`${API_URL}/events`);
    const evs = await res.json();
    if (evs.length > 0) {
        currentEvent = evs[0];
        document.getElementById('event-name-display').innerText = currentEvent.name;
        document.getElementById('event-desc-display').innerText = currentEvent.description || 'Regístrate para asegurar tu lugar.';
        const logoImg = document.getElementById('public-event-logo');
        if (currentEvent.logo_url) {
            logoImg.src = currentEvent.logo_url;
            logoImg.classList.remove('hidden');
        }
    }
}

initPublic();
updateTimers();
