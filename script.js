// --- State Management (Master v3.0) ---
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const API_URL = '/api';
const socket = io(); // Inicializar Socket.io
let attendanceChart = null; 
let autoPrintEnabled = false;

// --- DOM Elements ---
const views = {
    registration: document.getElementById('view-registration'),
    login: document.getElementById('view-login'),
    admin: document.getElementById('view-admin'),
    myEvents: document.getElementById('view-my-events'),
    modalEvent: document.getElementById('modal-event'),
    modalMailing: document.getElementById('modal-mailing'),
    modalSurvey: document.getElementById('modal-survey')
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

// --- Authentication ---
document.getElementById('login-nav-btn').onclick = () => {
    if (loggedUser) loadMyEvents();
    else showView('login');
};

document.getElementById('btn-logout').onclick = logout;

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
    } catch (err) { 
        if (err.message.includes('aprobación')) alert('Tu cuenta está pendiente de aprobación por el administrador.');
        else alert('Error de acceso: Verifica tus credenciales'); 
    }
};

// --- Socket Events (Real-time) ---
socket.on('checkin_update', ({ guestId, status }) => {
    const guest = allGuests.find(g => g.id === guestId);
    if (guest) {
        guest.checked_in = status;
        renderGuests(allGuests);
        loadAdminData(); // Actualizar métricas
    }
});

socket.on('new_registration', ({ id, name }) => {
    if (currentEvent) loadAdminData();
});

// --- Core Logic: Events & Dashboard ---

async function loadMyEvents() {
    if (!loggedUser) return;
    
    // Mostrar/Ocultar botones de Admin
    const btnAdminPartners = document.getElementById('btn-admin-partners');
    if (btnAdminPartners) btnAdminPartners.classList.toggle('hidden', loggedUser.role !== 'ADMIN');

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

    socket.emit('join_event', id);
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

async function loadAdminData() {
    if (!currentEvent) return;
    
    const stats = await apiFetch(`/stats/${currentEvent.id}`);
    
    // Población de tarjetas Maestro
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-orgs').innerText = stats.orgs || 0;
    document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
    document.getElementById('stat-onsite').innerText = stats.onsite || 0;
    
    // Segmentos Críticos
    document.getElementById('stat-health').innerText = stats.healthAlerts || 0;
    document.getElementById('stat-gender-ratio').innerText = stats.genderRatio || "0.0";

    // Actualizar Gráfica
    updateFlowChart(stats.flowData || []);

    allGuests = await apiFetch(`/guests/${currentEvent.id}`);
    renderGuests(allGuests);
}

function updateFlowChart(flowData) {
    const ctx = document.getElementById('flowChart')?.getContext('2d');
    if (!ctx) return;

    const labels = flowData.map(d => `${d.hour}:00`);
    const data = flowData.map(d => d.count);

    if (attendanceChart) {
        attendanceChart.data.labels = labels;
        attendanceChart.data.datasets[0].data = data;
        attendanceChart.update();
    } else {
        attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ingresos por Hora',
                    data: data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
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
            <td class="px-6 py-5 text-right flex gap-2 justify-end">
                <button onclick="toggleCheckin('${g.id}', ${g.checked_in})" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-slate-800 text-slate-500' : 'bg-primary text-white'}">
                    ${g.checked_in ? 'Deshacer' : 'Check-in'}
                </button>
                <button onclick="printBadge('${g.id}')" class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all">
                    <span class="material-symbols-outlined text-[18px]">print</span>
                </button>
            </td>
        </tr>
    `).join('');
}

window.printBadge = async function(id) {
    const guest = allGuests.find(g => g.id === id);
    if (!guest) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 3] // Tamaño estándar escarapela (4x3 pulgadas)
    });

    const primaryColor = '#6366f1';
    
    // 1. Cabecera / Fondo sutil
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(0, 0, 3, 4, 'F');
    
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 3, 0.6, 'F');

    // 2. Logo si existe
    if (currentEvent.logo_url) {
        try {
            // Intento básico de añadir imagen (idealmente base64)
            // doc.addImage(currentEvent.logo_url, 'PNG', 1.25, 0.15, 0.5, 0.3);
        } catch(e) {}
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(currentEvent.name.toUpperCase(), 1.5, 0.35, { align: 'center' });

    // 3. QR Code
    const qrDataUrl = await QRCode.toDataURL(guest.qr_token || guest.id, { margin: 1, width: 200 });
    doc.addImage(qrDataUrl, 'PNG', 0.5, 0.8, 2, 2);

    // 4. Datos del Invitado
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(18);
    doc.text(guest.name, 1.5, 3.2, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(guest.organization || "INVITADO ESPECIAL", 1.5, 3.45, { align: 'center' });

    // 5. Pie de página decorativo
    doc.setFillColor(primaryColor);
    doc.rect(0, 3.8, 3, 0.2, 'F');

    doc.save(`Escarapela_${guest.name.replace(' ', '_')}.pdf`);
};

window.toggleCheckin = async function(id, status) {
    const newStatus = !status;
    await apiFetch(`/checkin/${id}`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
    });
    
    // Si se activa y autoPrint está ON, imprimir
    if (newStatus && autoPrintEnabled) {
        printBadge(id);
    }
};

// Toggle Auto-Print UI
document.getElementById('toggle-autoprint').onclick = function() {
    autoPrintEnabled = !autoPrintEnabled;
    this.classList.toggle('bg-primary', autoPrintEnabled);
    this.classList.toggle('bg-slate-800', !autoPrintEnabled);
    this.querySelector('.dot').classList.toggle('translate-x-5', autoPrintEnabled);
    this.querySelector('.dot').classList.toggle('bg-white', autoPrintEnabled);
    this.querySelector('.dot').classList.toggle('bg-slate-600', !autoPrintEnabled);
};

// --- Mailing Logic ---
document.getElementById('btn-open-mailing').onclick = async () => {
    if (!currentEvent) return;
    views.modalMailing.classList.remove('hidden');
    try {
        const config = await apiFetch(`/mailing-config/${currentEvent.id}`);
        if (config) {
            document.getElementById('smtp-host').value = config.smtp_host || '';
            document.getElementById('smtp-port').value = config.smtp_port || '';
            document.getElementById('smtp-user').value = config.smtp_user || '';
            document.getElementById('smtp-pass').value = config.smtp_pass || '';
            document.getElementById('welcome-sub').value = config.welcome_subject || '';
            document.getElementById('welcome-body').value = config.welcome_body || '';
            document.getElementById('survey-sub').value = config.survey_subject || '';
            document.getElementById('survey-body').value = config.survey_body || '';
        }
    } catch (e) {}
};

document.getElementById('close-mailing-modal').onclick = () => views.modalMailing.classList.add('hidden');

// Registro Público v3.0
document.getElementById('public-reg-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentEvent) return alert("Selecciona un evento primero");

    const data = {
        event_id: currentEvent.id,
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        phone: document.getElementById('reg-phone').value,
        organization: document.getElementById('reg-org').value,
        gender: document.getElementById('reg-gender').value,
        dietary_notes: document.getElementById('reg-diet').value
    };

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert('¡Registro Exitoso! Te esperamos.');
        e.target.reset();
    }
};

document.getElementById('mailing-config-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        host: document.getElementById('smtp-host').value,
        port: parseInt(document.getElementById('smtp-port').value),
        user: document.getElementById('smtp-user').value,
        pass: document.getElementById('smtp-pass').value,
        welcome_sub: document.getElementById('welcome-sub').value,
        welcome_body: document.getElementById('welcome-body').value,
        survey_sub: document.getElementById('survey-sub').value,
        survey_body: document.getElementById('survey-body').value
    };
    await apiFetch('/mailing-config', { method: 'POST', body: JSON.stringify(data) });
    alert('Configuración guardada.');
    views.modalMailing.classList.add('hidden');
};

// --- Survey Logic ---
document.getElementById('btn-edit-survey').onclick = () => {
    if (!currentEvent) return;
    views.modalSurvey.classList.remove('hidden');
    loadSurveyQuestions();
};

document.getElementById('close-survey-modal').onclick = () => views.modalSurvey.classList.add('hidden');

document.getElementById('new-question-type').onchange = (e) => {
    document.getElementById('multiple-options-container').classList.toggle('hidden', e.target.value !== 'multiple');
};

async function loadSurveyQuestions() {
    const questions = await apiFetch(`/surveys/questions/${currentEvent.id}`);
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;

    questionsList.innerHTML = questions.map(q => {
        let typeBadge = "⭐ Estrellas";
        if (q.type === 'yes_no') typeBadge = "🌓 Sí/No";
        if (q.type === 'open') typeBadge = "📝 Abierta";
        if (q.type === 'multiple') typeBadge = `📑 Múltiple (${q.options})`;

        return `
            <div class="flex items-center justify-between p-5 bg-slate-900 border border-white/5 rounded-2xl">
                <div>
                    <p class="font-bold text-sm mb-1">${q.question}</p>
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${typeBadge}</span>
                </div>
                <button onclick="deleteQuestion('${q.id}')" class="text-red-500/60 hover:text-red-500 transition-colors">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
    }).join('') || '<p class="text-center text-slate-600 py-10 uppercase text-[10px] font-black tracking-widest">No hay preguntas</p>';
}

document.getElementById('add-question-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        question: document.getElementById('new-question-input').value,
        type: document.getElementById('new-question-type').value,
        options: document.getElementById('multiple-options-input').value || null
    };
    await apiFetch('/surveys/questions', { method: 'POST', body: JSON.stringify(data) });
    e.target.reset();
    document.getElementById('multiple-options-container').classList.add('hidden');
    loadSurveyQuestions();
};

window.deleteQuestion = async function(id) {
    if (confirm('¿Eliminar pregunta?')) {
        await apiFetch(`/surveys/questions/${id}`, { method: 'DELETE' });
        loadSurveyQuestions();
    }
};

// --- Partner Management (Admin Only) ---
const btnAdminPartners = document.getElementById('btn-admin-partners');
if (btnAdminPartners) {
    btnAdminPartners.onclick = () => {
        document.getElementById('modal-partners').classList.remove('hidden');
        loadPendingPartners();
    };
}
document.getElementById('close-partners-modal').onclick = () => document.getElementById('modal-partners').classList.add('hidden');

async function loadPendingPartners() {
    const users = await apiFetch('/admin/users/pending');
    const tbody = document.getElementById('partners-tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
        <tr class="group">
            <td class="px-6 py-5">
                <p class="font-bold text-sm text-white">${u.username}</p>
                <p class="text-[10px] text-slate-600 font-mono">${u.id}</p>
            </td>
            <td class="px-6 py-5">
                <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 rounded-full text-slate-400 border border-white/10">${u.role}</span>
            </td>
            <td class="px-6 py-5 text-right flex gap-2 justify-end">
                <button onclick="processPartner('${u.id}', 'APPROVED')" class="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-[10px] font-black uppercase tracking-widest border border-green-500/20 hover:bg-green-500 hover:text-white transition-all">Aprobar</button>
                <button onclick="processPartner('${u.id}', 'REJECTED')" class="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">Rechazar</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="text-center py-20 text-slate-600 uppercase text-[10px] font-black tracking-widest">No hay solicitudes pendientes</td></tr>';
}

window.processPartner = async function(userId, status) {
    await apiFetch('/admin/users/approve', {
        method: 'POST',
        body: JSON.stringify({ userId, status })
    });
    alert(status === 'APPROVED' ? 'Socio Aprobado' : 'Socio Rechazado');
    loadPendingPartners();
};

// --- Initialization ---
async function init() {
    const evs = await fetch(`${API_URL}/events`).then(r => r.json());
    if (evs.length > 0) {
        currentEvent = evs[0];
        const badge = document.getElementById('event-name-badge');
        if (badge) badge.innerText = currentEvent.name;
    }
}
// --- Service Worker Registration (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('PWA Service Worker registrado');
        }).catch(err => console.log('Error registrando SW', err));
    });
}
