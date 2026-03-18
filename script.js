// --- State Management ---
let currentEvent = null;
let allEvents = [];
let allGuests = [];
let loggedUser = JSON.parse(localStorage.getItem('user')) || null;
const API_URL = '/api';
const socket = io(); 
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
    modalSurvey: document.getElementById('modal-survey'),
    modalImportResults: document.getElementById('modal-import-results'),
    modalQr: document.getElementById('modal-qr'),
    modalPartners: document.getElementById('modal-partners')
};

// --- Helpers ---
const setClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
};

const setSubmit = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onsubmit = fn;
};

// --- API Helpers ---
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

// --- Authentication Events ---
setClick('login-nav-btn', () => {
    if (loggedUser) loadMyEvents();
    else showView('login');
});

setClick('back-to-reg', () => showView('registration'));
setClick('btn-logout', logout);

setClick('go-to-signup', (e) => {
    e.preventDefault();
    document.getElementById('login-form')?.classList.add('hidden');
    document.getElementById('signup-form')?.classList.remove('hidden');
});

setClick('go-to-login', (e) => {
    e.preventDefault();
    document.getElementById('signup-form')?.classList.add('hidden');
    document.getElementById('login-form')?.classList.remove('hidden');
});

setSubmit('signup-form', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-user')?.value;
    const password = document.getElementById('signup-pass')?.value;
    try {
        const data = await apiFetch('/signup', {
            method: 'POST',
            body: JSON.stringify({ username, password, role: 'PRODUCTOR' })
        });
        if (data.success) {
            alert('Solicitud enviada. Espera aprobación.');
            document.getElementById('signup-form')?.classList.add('hidden');
            document.getElementById('login-form')?.classList.remove('hidden');
        }
    } catch (err) { alert('Error al solicitar cuenta'); }
});

setSubmit('login-form', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user')?.value;
    const password = document.getElementById('login-pass')?.value;
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
        alert(err.message.includes('aprobación') ? 'Cuenta pendiente de aprobación' : 'Error de acceso');
    }
});

// --- Socket Events ---
socket.on('checkin_update', ({ guestId, status }) => {
    const guest = allGuests.find(g => g.id === guestId);
    if (guest) {
        guest.checked_in = status;
        renderGuests(allGuests);
        loadAdminData();
    }
});

socket.on('new_registration', () => {
    if (currentEvent) loadAdminData();
});

// --- Events & Dashboard ---
async function loadMyEvents() {
    if (!loggedUser) return;
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
            <div class="flex items-start justify-between mb-8">
                <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                    ${ev.logo_url ? `<img src="${ev.logo_url}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-primary text-2xl">event</span>`}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">${ev.status || 'ACTIVE'}</span>
            </div>
            <h3 class="text-2xl font-display font-black mb-1">${ev.name}</h3>
            <p class="text-slate-500 text-sm mb-8">${ev.location || 'Sede Remota'}</p>
        </div>
    `).join('');
}

window.switchToDashboard = async function(id) {
    currentEvent = allEvents.find(e => String(e.id) === String(id));
    if (!currentEvent) return;
    socket.emit('join_event', id);
    showView('admin');
    const title = document.getElementById('admin-event-title');
    if (title) title.innerText = currentEvent.name;
    const loc = document.getElementById('admin-event-location');
    if (loc) loc.innerText = currentEvent.location || 'Sin ubicación';
    const logoImg = document.getElementById('admin-event-logo');
    if (logoImg) {
        logoImg.src = currentEvent.logo_url || '';
        logoImg.classList.toggle('hidden', !currentEvent.logo_url);
    }
    loadAdminData();
};

async function loadAdminData() {
    if (!currentEvent) return;
    
    // Carga independiente para evitar bloqueos
    try {
        const stats = await apiFetch(`/stats/${currentEvent.id}`);
        document.getElementById('stat-total').innerText = stats.total || 0;
        document.getElementById('stat-orgs').innerText = stats.orgs || 0;
        document.getElementById('stat-presence').innerText = `${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`;
        document.getElementById('stat-onsite').innerText = stats.onsite || 0;
        document.getElementById('stat-health').innerText = stats.healthAlerts || 0;
        document.getElementById('stat-gender-ratio').innerText = stats.genderRatio || "0.0";
        updateFlowChart(stats.flowData || []);
    } catch (e) { console.error("Stats Error", e); }

    try {
        allGuests = await apiFetch(`/guests/${currentEvent.id}`);
        renderGuests(allGuests);
    } catch (e) { console.error("Guests Load Error", e); }

    startClocks();
}

function startClocks() {
    if (window.clockInterval) clearInterval(window.clockInterval);
    const clockReal = document.getElementById('admin-clock-real');
    const clockCountdown = document.getElementById('admin-clock-countdown');
    
    window.clockInterval = setInterval(() => {
        const now = new Date();
        if (clockReal) clockReal.innerText = now.toLocaleTimeString();

        if (currentEvent && currentEvent.date && clockCountdown) {
            const eventDate = new Date(currentEvent.date);
            const diff = eventDate - now;
            if (diff > 0) {
                const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                clockCountdown.innerText = `${h}:${m}:${s}`;
                clockCountdown.classList.replace('text-green-500', 'text-red-500');
            } else {
                clockCountdown.innerText = "EN CURSO";
                clockCountdown.classList.replace('text-red-500', 'text-green-500');
            }
        }
    }, 1000);
}

// Navigation Back
setClick('btn-events-list-nav', loadMyEvents);

setClick('btn-admin-partners', async () => {
    views.modalPartners.classList.remove('hidden');
    const partners = await apiFetch('/admin/users/pending');
    const tbody = document.getElementById('partners-tbody');
    if (tbody) {
        tbody.innerHTML = partners.map(u => `
            <tr>
                <td class="px-6 py-4 font-bold text-sm">${u.username}</td>
                <td class="px-6 py-4 text-xs text-slate-500">${u.role}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="approvePartner('${u.id}', 'APPROVED')" class="text-primary font-black text-[10px] uppercase mr-4">Aprobar</button>
                    <button onclick="approvePartner('${u.id}', 'REJECTED')" class="text-red-500 font-black text-[10px] uppercase">Rechazar</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="text-center py-10 text-slate-500">No hay solicitudes pendientes</td></tr>';
    }
});

setClick('close-partners-modal', () => views.modalPartners.classList.add('hidden'));

window.approvePartner = async (userId, status) => {
    await apiFetch('/admin/users/approve', { method: 'POST', body: JSON.stringify({ userId, status }) });
    document.getElementById('btn-admin-partners').click(); // Refresh
};

// Event Modal (Create/Edit)
setClick('btn-create-event-open', () => {
    document.getElementById('new-event-form').reset();
    document.getElementById('ev-id-hidden').value = '';
    views.modalEvent.classList.remove('hidden');
});

setClick('btn-edit-event', () => {
    if (!currentEvent) return;
    document.getElementById('ev-id-hidden').value = currentEvent.id;
    document.getElementById('ev-name').value = currentEvent.name;
    document.getElementById('ev-date').value = currentEvent.date;
    document.getElementById('ev-location').value = currentEvent.location || '';
    document.getElementById('ev-desc').value = currentEvent.description || '';
    views.modalEvent.classList.remove('hidden');
});

setClick('close-modal', () => views.modalEvent.classList.add('hidden'));

setSubmit('new-event-form', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ev-id-hidden').value;
    const data = {
        name: document.getElementById('ev-name').value,
        date: document.getElementById('ev-date').value,
        location: document.getElementById('ev-location').value,
        description: document.getElementById('ev-desc').value,
        logo_url: currentEvent?.logo_url || '' 
    };

    try {
        if (id) {
            await apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            alert('Evento actualizado');
            switchToDashboard(id);
        } else {
            const res = await apiFetch('/events', { method: 'POST', body: JSON.stringify(data) });
            alert('Evento creado');
            loadMyEvents();
        }
        views.modalEvent.classList.add('hidden');
    } catch (err) { alert('Error al guardar evento'); }
});

setClick('btn-delete-event', async () => {
    if (!currentEvent) return;
    if (confirm('¿Estás seguro de eliminar este evento? Esta acción es irreversible.')) {
        await apiFetch(`/events/${currentEvent.id}`, { method: 'DELETE' });
        loadMyEvents();
    }
});

function updateFlowChart(flowData) {
    const canvas = document.getElementById('flowChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
                labels,
                datasets: [{
                    label: 'Ingresos',
                    data,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
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
                        ${g.name[0].toUpperCase()}
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

// Guest Search Logic
const guestSearch = document.getElementById('guest-search');
if (guestSearch) {
    guestSearch.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allGuests.filter(g => 
            g.name.toLowerCase().includes(term) || 
            (g.email && g.email.toLowerCase().includes(term)) || 
            (g.organization && g.organization.toLowerCase().includes(term))
        );
        renderGuests(filtered);
    };
}

window.toggleCheckin = async function(id, status) {
    const newStatus = !status;
    await apiFetch(`/checkin/${id}`, { method: 'POST', body: JSON.stringify({ status: newStatus }) });
    if (newStatus && autoPrintEnabled) printBadge(id);
};

window.printBadge = async function(id) {
    const guest = allGuests.find(g => g.id === id);
    if (!guest) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4, 3] });
    const qrDataUrl = await QRCode.toDataURL(guest.qr_token || guest.id, { margin: 1, width: 200 });
    doc.addImage(qrDataUrl, 'PNG', 0.5, 0.5, 2, 2);
    doc.setFontSize(18);
    doc.text(guest.name, 1.5, 2.8, { align: 'center' });
    doc.setFontSize(10);
    doc.text(guest.organization || "INVITADO", 1.5, 3.0, { align: 'center' });
    doc.save(`Badge_${guest.name}.pdf`);
};

// --- Features Listeners ---
setClick('toggle-autoprint', function() {
    autoPrintEnabled = !autoPrintEnabled;
    this.classList.toggle('bg-primary', autoPrintEnabled);
    this.classList.toggle('bg-slate-800', !autoPrintEnabled);
    const dot = this.querySelector('.dot');
    if (dot) dot.classList.toggle('translate-x-5', autoPrintEnabled);
});

setClick('btn-show-qr', () => {
    if (!currentEvent) return;
    QRCode.toDataURL(`${window.location.origin}/survey.html?event=${currentEvent.id}`, (err, url) => {
        const img = document.getElementById('qr-display');
        if (img) img.src = url;
        views.modalQr?.classList.remove('hidden');
    });
});

setClick('close-qr', () => views.modalQr?.classList.add('hidden'));

setClick('btn-open-mailing', async () => {
    if (!currentEvent) return;
    views.modalMailing?.classList.remove('hidden');
    try {
        const config = await apiFetch(`/mailing-config/${currentEvent.id}`);
        if (config) {
            document.getElementById('smtp-host').value = config.smtp_host || '';
            document.getElementById('smtp-port').value = config.smtp_port || '';
            document.getElementById('smtp-user').value = config.smtp_user || '';
            document.getElementById('welcome-sub').value = config.welcome_subject || '';
            document.getElementById('welcome-body').value = config.welcome_body || '';
        }
    } catch(e) {}
});

setClick('close-mailing-modal', () => views.modalMailing?.classList.add('hidden'));

setSubmit('mailing-config-form', async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        host: document.getElementById('smtp-host').value,
        port: parseInt(document.getElementById('smtp-port').value),
        user: document.getElementById('smtp-user').value,
        pass: document.getElementById('smtp-pass').value,
        welcome_sub: document.getElementById('welcome-sub').value,
        welcome_body: document.getElementById('welcome-body').value
    };
    await apiFetch('/mailing-config', { method: 'POST', body: JSON.stringify(data) });
    alert('Guardado');
    views.modalMailing?.classList.add('hidden');
});

// Export & Cleanup Listeners
setClick('btn-export-excel', () => {
    if (!currentEvent) return;
    window.location.href = `${API_URL}/export-excel/${currentEvent.id}?x-user-id=${loggedUser.userId}`;
});

setClick('btn-export-analytics', () => {
    alert("Generando reporte de analítica... (Se descargará en breve)");
    // Aquí se podría implementar jsPDF para un reporte visual
});

setClick('btn-clear-db', async () => {
    if (!currentEvent) return;
    if (confirm('¿ESTÁS SEGURO? Se borrarán todos los invitados y respuestas de este evento. Esta acción NO se puede deshacer.')) {
        const res = await apiFetch(`/clear-db/${currentEvent.id}`, { method: 'POST' });
        if (res.success) {
            alert(res.message);
            loadAdminData();
        }
    }
});

setClick('btn-edit-survey', () => {
    if (!currentEvent) return;
    views.modalSurvey?.classList.remove('hidden');
    loadSurveyQuestions();
});

setClick('close-survey-modal', () => views.modalSurvey?.classList.add('hidden'));

async function loadSurveyQuestions() {
    const questions = await apiFetch(`/surveys/questions/${currentEvent.id}`);
    const list = document.getElementById('questions-list');
    if (!list) return;
    list.innerHTML = questions.map(q => `
        <div class="flex justify-between p-4 bg-slate-900 mb-2 rounded-xl">
            <span>${q.question}</span>
            <button onclick="deleteQuestion('${q.id}')" class="text-red-500">Eliminar</button>
        </div>
    `).join('') || '<p class="text-center p-4">Sin preguntas</p>';
}

setSubmit('add-question-form', async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        question: document.getElementById('new-question-input').value,
        type: document.getElementById('new-question-type').value
    };
    await apiFetch('/surveys/questions', { method: 'POST', body: JSON.stringify(data) });
    e.target.reset();
    loadSurveyQuestions();
});

window.deleteQuestion = async function(id) {
    if (confirm('¿Eliminar?')) {
        await apiFetch(`/surveys/questions/${id}`, { method: 'DELETE' });
        loadSurveyQuestions();
    }
};

setClick('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel')?.click());
const fileIn = document.getElementById('admin-file-import-excel');
if (fileIn) {
    fileIn.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentEvent) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('eventId', currentEvent.id);
        const res = await fetch(`${API_URL}/import-dry-run`, {
            method: 'POST',
            headers: { ...(loggedUser ? { 'x-user-id': loggedUser.userId } : {}) },
            body: fd
        });
        if (res.ok) {
            const report = await res.json();
            document.getElementById('import-summary-content').innerText = `${report.summary.new} nuevos invitados encontrados.`;
            views.modalImportResults?.classList.remove('hidden');
            window.pendingImportData = report.data;
        }
    };
}

setClick('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf')?.click());
const filePdfIn = document.getElementById('admin-file-import-pdf');
if (filePdfIn) {
    filePdfIn.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentEvent) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('eventId', currentEvent.id);
        const res = await fetch(`${API_URL}/import-dry-run`, { // Compartimos endpoint para procesar PDF tmb
            method: 'POST',
            headers: { ...(loggedUser ? { 'x-user-id': loggedUser.userId } : {}) },
            body: fd
        });
        if (res.ok) {
            const report = await res.json();
            document.getElementById('import-summary-content').innerHTML = `
                <p class="text-white font-bold">${report.summary.new} nuevos invitados.</p>
                <p class="text-slate-500 text-xs">${report.summary.existing} ya presentes (se ignorarán).</p>
            `;
            views.modalImportResults?.classList.remove('hidden');
            window.pendingImportData = report.data;
        } else { alert("Error al cargar PDF (Verifica el formato)"); }
    };
}

// Survey Extra Logic (Multiple Choice)
const questionType = document.getElementById('new-question-type');
const optContainer = document.getElementById('multiple-options-container');
if (questionType) {
    questionType.onchange = (e) => {
        optContainer?.classList.toggle('hidden', e.target.value !== 'multiple');
    };
}

// Re-defining setSubmit for 'add-question-form' to include options
setSubmit('add-question-form', async (e) => {
    e.preventDefault();
    const data = {
        event_id: currentEvent.id,
        question: document.getElementById('new-question-input').value,
        type: document.getElementById('new-question-type').value,
        options: document.getElementById('multiple-options-input')?.value || null
    };
    await apiFetch('/surveys/questions', { method: 'POST', body: JSON.stringify(data) });
    e.target.reset();
    optContainer?.classList.add('hidden'); // Hide options after submission
    loadSurveyQuestions();
});

setClick('btn-confirm-import', async () => {
    if (!window.pendingImportData || !currentEvent) return;
    await apiFetch('/import-confirm', { method: 'POST', body: JSON.stringify({ eventId: currentEvent.id, guests: window.pendingImportData }) });
    alert('Completado');
    views.modalImportResults?.classList.add('hidden');
    loadAdminData();
});

setClick('close-import-modal', () => views.modalImportResults?.classList.add('hidden'));

// --- Registration Form ---
setSubmit('public-reg-form', async (e) => {
    e.preventDefault();
    if (!currentEvent) return alert("Cargando evento...");
    const data = {
        event_id: currentEvent.id,
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        organization: document.getElementById('reg-org').value
    };
    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        alert('¡Registrado!');
        e.target.reset();
    }
});

// --- Initialization ---
async function init() {
    try {
        if (loggedUser) await loadMyEvents();
        else showView('registration'); // Cambiado a registration como página principal por defecto

        const res = await fetch(`${API_URL}/events`);
        if (res.ok) {
            const evs = await res.json();
            if (evs.length > 0) {
                currentEvent = evs[0];
                const badge = document.getElementById('event-name-badge');
                if (badge) badge.innerText = currentEvent.name;
            }
        }
    } catch (e) { console.error("Init Error", e); }
}

init();
