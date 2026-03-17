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
    Object.values(views).forEach(v => {
        if (v) v.classList.add('hidden');
    });
    if (views[viewName]) views[viewName].classList.remove('hidden');

    // Reset layout specifics if needed
    if (viewName === 'admin') {
        document.body.classList.add('overflow-hidden'); // Sidebar layout benefit
    } else {
        document.body.classList.remove('overflow-hidden');
    }
}

// Handlers for dynamic navigation
const loginNavBtn = document.getElementById('login-nav-btn');
if (loginNavBtn) {
    loginNavBtn.onclick = () => {
        if (loggedUserId) {
            loadMyEvents();
        } else {
            showView('login');
        }
    };
}

const backToRegBtn = document.getElementById('back-to-reg');
if (backToRegBtn) backToRegBtn.onclick = () => showView('registration');

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = () => {
        localStorage.removeItem('userId');
        loggedUserId = null;
        showView('registration');
    };
}

const eventsListNavBtn = document.getElementById('btn-events-list-nav');
if (eventsListNavBtn) eventsListNavBtn.onclick = () => loadMyEvents();

const eventsListMainBtn = document.getElementById('btn-events-list'); // For compatibility with some layouts
if (eventsListMainBtn) eventsListMainBtn.onclick = () => loadMyEvents();

const createEventOpenBtn = document.getElementById('btn-create-event-open');
if (createEventOpenBtn) createEventOpenBtn.onclick = () => views.modalEvent.classList.remove('hidden');

const closeModalBtn = document.getElementById('close-modal');
if (closeModalBtn) closeModalBtn.onclick = () => views.modalEvent.classList.add('hidden');

// --- Timers (Public & Admin) ---
function updateTimers() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    
    // Multiple possible clock locations based on layout
    ['admin-clock', 'events-list-clock', 'current-clock'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = timeStr;
    });

    if (currentEvent && currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const diff = eventDate - now;
        const msg = diff > 0 ? formatCountdown(diff) : '¡EN CURSO!';
        
        const ct = document.getElementById('countdown-timer');
        if (ct) ct.innerText = msg;
        
        const act = document.getElementById('admin-countdown');
        if (act) act.innerText = msg;
    }
}

function formatCountdown(diff) {
    const h = Math.floor(diff / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    if (!container) return;

    container.innerHTML = allEvents.map(ev => `
        <div class="card bg-slate-900 border-white/5 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden" onclick="switchToDashboard(${ev.id})">
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-primary/10 transition-all"></div>
            <div class="flex items-start justify-between mb-8 relative z-10">
                <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                    ${ev.logo_url ? `<img src="${ev.logo_url}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-primary text-2xl">event</span>`}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">Activo</span>
            </div>
            <h3 class="text-2xl font-display font-black mb-1 relative z-10">${ev.name}</h3>
            <p class="text-slate-500 text-sm mb-8 flex items-center gap-2 relative z-10 font-medium">
                <span class="material-symbols-outlined text-[16px]">calendar_month</span>
                ${new Date(ev.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div class="pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Entrar al Panel</span>
                <span class="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
        </div>
    `).join('') || '<p class="col-span-3 text-center py-20 text-slate-500 font-bold uppercase tracking-widest">No tienes eventos creados</p>';
}

async function switchToDashboard(id) {
    currentEvent = allEvents.find(e => e.id === id);
    if (!currentEvent) return;

    showView('admin');
    
    // Update Header
    const titleEl = document.getElementById('admin-event-title');
    if (titleEl) titleEl.innerText = currentEvent.name;

    const locEl = document.getElementById('admin-event-location');
    if (locEl) locEl.innerText = currentEvent.location || 'Sede no especificada';

    const logoImg = document.getElementById('admin-event-logo');
    if (logoImg) {
        if (currentEvent.logo_url) {
            logoImg.src = currentEvent.logo_url;
            logoImg.classList.remove('hidden');
        } else {
            logoImg.classList.add('hidden');
        }
    }
    
    loadAdminData();
}

// Form Handlers
const newEventForm = document.getElementById('new-event-form');
if (newEventForm) {
    newEventForm.onsubmit = async (e) => {
        e.preventDefault();
        let logo_url = null;
        const logoFileInput = document.getElementById('ev-logo-input');
        const logoFile = logoFileInput ? logoFileInput.files[0] : null;

        if (logoFile) {
            const logoFormData = new FormData();
            logoFormData.append('logo', logoFile);
            try {
                const uploadRes = await fetch(`${API_URL}/upload-logo`, { method: 'POST', body: logoFormData });
                const uploadData = await uploadRes.json();
                logo_url = uploadData.url;
            } catch (err) { console.error("Logo upload failed", err); }
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
            if (views.modalEvent) views.modalEvent.classList.add('hidden');
            loadMyEvents();
            e.target.reset();
        }
    };
}

// Authentication Forms
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');

const goToSignup = document.getElementById('go-to-signup');
if (goToSignup) goToSignup.onclick = (e) => {
    e.preventDefault();
    if (loginForm) loginForm.classList.add('hidden');
    if (signupForm) signupForm.classList.remove('hidden');
};

const goToLogin = document.getElementById('go-to-login');
if (goToLogin) goToLogin.onclick = (e) => {
    e.preventDefault();
    if (signupForm) signupForm.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
};

if (signupForm) {
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
            if (loginForm) loginForm.classList.remove('hidden');
        }
    };
}

if (loginForm) {
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
            alert('Error de acceso: Credenciales inválidas');
        }
    };
}

// Dashboard Data Loader
async function loadAdminData() {
    if (!currentEvent) return;
    
    try {
        const sRes = await fetch(`${API_URL}/stats/${currentEvent.id}`);
        const stats = await sRes.json();
        document.getElementById('stat-total').innerText = stats.total || 0;
        document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
        document.getElementById('stat-missing').innerText = (stats.total || 0) - (stats.checkedIn || 0);

        const fRes = await fetch(`${API_URL}/surveys/stats/${currentEvent.id}`);
        const fStats = await fRes.json();
        const satisfactionEl = document.getElementById('stat-satisfaction');
        if (satisfactionEl) satisfactionEl.innerText = fStats.avgRating ? fStats.avgRating.toFixed(1) : "0.0";

        const gRes = await fetch(`${API_URL}/guests/${currentEvent.id}`);
        allGuests = await gRes.json();
        renderGuests(allGuests);
    } catch (err) {
        console.error("Failed to load dashboard data", err);
    }
}

// QR & Feedback
const btnShowQr = document.getElementById('btn-show-qr');
if (btnShowQr) {
    btnShowQr.onclick = async () => {
        const res = await fetch(`${API_URL}/events/${currentEvent.id}/qrcode`);
        const data = await res.json();
        const qrImg = document.getElementById('qr-display');
        if (qrImg) qrImg.src = data.qrCode;
        const modalQr = document.getElementById('modal-qr');
        if (modalQr) modalQr.classList.remove('hidden');
    };
}
const closeQrBtn = document.getElementById('close-qr');
if (closeQrBtn) closeQrBtn.onclick = () => document.getElementById('modal-qr').classList.add('hidden');

// Survey Logic
const btnEditSurvey = document.getElementById('btn-edit-survey');
if (btnEditSurvey) {
    btnEditSurvey.onclick = () => {
        const modalSurvey = document.getElementById('modal-survey');
        if (modalSurvey) modalSurvey.classList.remove('hidden');
        loadSurveyQuestions();
    };
}
const closeSurveyBtn = document.getElementById('close-survey-modal');
if (closeSurveyBtn) closeSurveyBtn.onclick = () => document.getElementById('modal-survey').classList.add('hidden');

async function loadSurveyQuestions() {
    const res = await fetch(`${API_URL}/surveys/questions/${currentEvent.id}`);
    const questions = await res.json();
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;

    questionsList.innerHTML = questions.map(q => `
        <div class="flex items-center justify-between p-5 bg-slate-900 border border-white/5 rounded-2xl">
            <div>
                <p class="font-bold text-sm mb-1">${q.question}</p>
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${q.type === 'yes_no' ? 'Binario (Sí/No)' : 'Puntuación (Estrellas)'}</span>
            </div>
            <button onclick="deleteQuestion(${q.id})" class="w-10 h-10 flex items-center justify-center text-red-500/60 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `).join('') || '<p class="text-center text-slate-600 py-10 uppercase text-[10px] font-black tracking-widest">No hay preguntas configuradas</p>';
}

const addQuestionForm = document.getElementById('add-question-form');
if (addQuestionForm) {
    addQuestionForm.onsubmit = async (e) => {
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
}

window.deleteQuestion = async function(id) {
    await fetch(`${API_URL}/surveys/questions/${id}`, { method: 'DELETE' });
    loadSurveyQuestions();
};

// Search & Table
const guestSearch = document.getElementById('guest-search');
if (guestSearch) {
    guestSearch.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allGuests.filter(g => 
            g.name.toLowerCase().includes(term) || 
            (g.organization && g.organization.toLowerCase().includes(term)) ||
            (g.email && g.email.toLowerCase().includes(term))
        );
        renderGuests(filtered);
    };
}

function renderGuests(data) {
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(g => `
        <tr class="group">
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary border border-primary/20">
                        ${g.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm text-white">${g.name}</p>
                        <p class="text-[10px] text-slate-600 font-mono font-medium">${g.email || 'SIN CORREO'}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-tight">${g.organization || '---'}</span>
            </td>
            <td class="px-6 py-5 text-center">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${g.checked_in ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-600 border border-white/5'}">
                    <span class="w-1.5 h-1.5 rounded-full ${g.checked_in ? 'bg-green-400' : 'bg-slate-600'}"></span>
                    ${g.checked_in ? 'In situ' : 'Ausente'}
                </div>
            </td>
            <td class="px-6 py-5 text-right">
                <button onclick="toggleCheckin(${g.id}, ${g.checked_in})" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-primary text-white hover:bg-accent ring-4 ring-primary/10 shadow-xl'}">
                    ${g.checked_in ? 'Anular' : 'Check-in'}
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" class="text-center py-20 text-slate-600 font-bold uppercase text-[10px] tracking-widest">No se encontraron asistentes</td></tr>';
}

window.toggleCheckin = async function(id, currentStatus) {
    await fetch(`${API_URL}/checkin/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: !currentStatus })
    });
    loadAdminData();
};

// Import & Management
const btnDeleteEvent = document.getElementById('btn-delete-event');
if (btnDeleteEvent) {
    btnDeleteEvent.onclick = async () => {
        if (!confirm('¿Deseas eliminar permanentemente este evento y todos los datos de sus invitados?')) return;
        const res = await fetch(`${API_URL}/events/${currentEvent.id}`, { method: 'DELETE' });
        if (res.ok) {
            currentEvent = null;
            loadMyEvents();
        }
    };
}

const importExcelBtn = document.getElementById('admin-import-excel-btn');
const importPdfBtn = document.getElementById('admin-import-pdf-btn');
const inputExcel = document.getElementById('admin-file-import-excel');
const inputPdf = document.getElementById('admin-file-import-pdf');

if (importExcelBtn) importExcelBtn.onclick = () => inputExcel.click();
if (importPdfBtn) importPdfBtn.onclick = () => inputPdf.click();

if (inputExcel) inputExcel.onchange = (e) => handleImport(e, 'import');
if (inputPdf) inputPdf.onchange = (e) => handleImport(e, 'import-pdf');

async function handleImport(e, endpoint) {
    const file = e.target.files[0];
    if (!file || !currentEvent) return;

    const formData = new FormData();
    formData.append('file', file);
    
    // UI Feedback
    const btn = e.target.id.includes('excel') ? importExcelBtn : importPdfBtn;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Procesando...';

    const res = await fetch(`${API_URL}/${endpoint}/${currentEvent.id}`, {
        method: 'POST',
        body: formData
    });

    btn.innerHTML = oldHtml;
    if (res.ok) {
        loadAdminData();
        alert('Datos importados correctamente.');
    } else {
        alert('Error al importar el archivo.');
    }
}

// Public Form Registration
const publicRegForm = document.getElementById('public-reg-form');
if (publicRegForm) {
    publicRegForm.onsubmit = async (e) => {
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
            alert('¡Registro exitoso! Te esperamos en el evento.');
            e.target.reset();
        } else {
            alert('Error en el registro. Inténtalo de nuevo.');
        }
    };
}

// Initial Loading
async function init() {
    // 1. Determine Public Event
    const res = await fetch(`${API_URL}/events`);
    const evs = await res.json();
    if (evs.length > 0) {
        currentEvent = evs[0];
        
        // Update Registration Page
        const badge = document.getElementById('event-name-badge');
        if (badge) badge.innerText = currentEvent.name;

        const desc = document.getElementById('event-desc-display');
        if (desc) desc.innerText = currentEvent.description || 'Confirma tu asistencia ahora.';
    }
    
    updateTimers();
}

init();
