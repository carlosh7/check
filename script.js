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
    views[viewName].classList.remove('hidden');
}

document.getElementById('login-nav-btn').onclick = () => {
    if (loggedUserId) {
        showView('admin');
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

// --- Theme Management ---
const themeBtn = document.getElementById('theme-btn');
const html = document.documentElement;
html.setAttribute('data-theme', localStorage.getItem('theme') || 'light');

themeBtn.onclick = () => {
    let target = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
};

// --- Timers (Public & Admin) ---
function updateTimers() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    
    // Public View
    if (document.getElementById('current-clock')) document.getElementById('current-clock').innerText = timeStr;
    // Admin Dashboard View
    if (document.getElementById('admin-clock')) document.getElementById('admin-clock').innerText = timeStr;

    if (currentEvent && currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const diff = eventDate - now;
        const msg = diff > 0 ? formatCountdown(diff) : '¡Comenzó!';
        
        if (document.getElementById('countdown-timer')) document.getElementById('countdown-timer').innerText = msg;
        if (document.getElementById('admin-countdown')) document.getElementById('admin-countdown').innerText = msg;
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

// Cargar eventos del usuario
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
        <div class="stat-card" style="cursor: pointer;" onclick="switchToDashboard(${ev.id})">
            <h3>${ev.name}</h3>
            <p>${new Date(ev.date).toLocaleDateString()}</p>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: var(--primary);">Gestionar →</p>
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
    const logoFile = document.getElementById('ev-logo-input').files[0];

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
    }
};

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
    } else {
        const err = await res.json();
        alert(err.message || 'Error al crear cuenta');
    }
};

// Login
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
        showView('admin');
        loadMyEvents();
    } else {
        alert('Error de acceso');
    }
};

// Dashboard Data
async function loadAdminData() {
    if (!currentEvent) return;
    
    // Stats de Asistencia
    const sRes = await fetch(`${API_URL}/stats/${currentEvent.id}`);
    const stats = await sRes.json();
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
    document.getElementById('stat-missing').innerText = (stats.total || 0) - (stats.checkedIn || 0);

    // Stats de Satisfacción
    const fRes = await fetch(`${API_URL}/surveys/stats/${currentEvent.id}`);
    const fStats = await fRes.json();
    document.getElementById('stat-satisfaction').innerText = fStats.avgRating ? fStats.avgRating.toFixed(1) : "0.0";

    const gRes = await fetch(`${API_URL}/guests/${currentEvent.id}`);
    allGuests = await gRes.json();
    renderGuests(allGuests);
}

// Lógica de QR
document.getElementById('btn-show-qr').onclick = async () => {
    const res = await fetch(`${API_URL}/events/${currentEvent.id}/qrcode`);
    const data = await res.json();
    document.getElementById('qr-display').src = data.qrCode;
    document.getElementById('modal-qr').classList.remove('hidden');
};
document.getElementById('close-qr').onclick = () => document.getElementById('modal-qr').classList.add('hidden');

// Lógica de Encuestas (Personalización)
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
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 0.75rem; border-radius: var(--radius-sm);">
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.9rem; font-weight: 500;">${q.question}</span>
                <span style="font-size: 0.7rem; color: var(--text-secondary);">${q.type === 'yes_no' ? 'Sí / No' : 'Calificación 1-5'}</span>
            </div>
            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="deleteQuestion(${q.id})">Eliminar</button>
        </div>
    `).join('') || '<p style="text-align: center; color: var(--text-secondary);">No hay preguntas personalizadas aún.</p>';
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

// Búsqueda en Dashboard
document.getElementById('guest-search').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allGuests.filter(g => 
        g.name.toLowerCase().includes(term) || 
        (g.organization && g.organization.toLowerCase().includes(term))
    );
    renderGuests(filtered);
};

function renderGuests(data) {
    const tbody = document.getElementById('guests-tbody');
    tbody.innerHTML = data.map(g => `
        <tr>
            <td>${g.name}</td>
            <td>${g.organization || '-'}</td>
            <td><span style="color: ${g.checked_in ? '#34C759' : '#8E8E93'}">${g.checked_in ? 'Presente' : 'Pendiente'}</span></td>
            <td>
                <button class="btn" style="padding: 0.5rem 1rem;" onclick="toggleCheckin(${g.id}, ${g.checked_in})">
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

// Borrar Evento
document.getElementById('btn-delete-event').onclick = async () => {
    if (!confirm('¿Estás seguro de borrar este evento y todos sus datos?')) return;
    const res = await fetch(`${API_URL}/events/${currentEvent.id}`, { method: 'DELETE' });
    if (res.ok) {
        currentEvent = null;
        loadMyEvents();
    }
};

// Importar Excel / PDF
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
        alert('Datos importados correctamente');
        loadAdminData();
    }
}

// Exportar PDF
document.getElementById('btn-export-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = jsPDF();
    doc.text(`Reporte: ${currentEvent.name}`, 14, 20);
    doc.autoTable({
        head: [['Nombre', 'Organización', 'Estado']],
        body: allGuests.map(g => [g.name, g.organization, g.checked_in ? 'SÍ' : 'NO']),
        startY: 30
    });
    doc.save(`Reporte.pdf`);
};

// Inicialización Pública
async function initPublic() {
    const res = await fetch(`${API_URL}/events`);
    const evs = await res.json();
    if (evs.length > 0) {
        currentEvent = evs[0];
        document.getElementById('event-name-display').innerText = currentEvent.name;
        document.getElementById('event-desc-display').innerText = currentEvent.description;
        const logoImg = document.getElementById('public-event-logo');
        if (currentEvent.logo_url) {
            logoImg.src = currentEvent.logo_url;
            logoImg.classList.remove('hidden');
        }
    }
}
initPublic();
updateTimers();
