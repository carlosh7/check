// --- State Management ---
let currentEvent = null;
let allEvents = [];
let allGuests = [];
const API_URL = 'http://localhost:3000/api';

// --- DOM Elements ---
const views = {
    registration: document.getElementById('view-registration'),
    login: document.getElementById('view-login'),
    admin: document.getElementById('view-admin'),
    modalEvent: document.getElementById('modal-event')
};

// --- Navigation ---
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

document.getElementById('login-nav-btn').onclick = () => showView('login');
document.getElementById('back-to-reg').onclick = () => showView('registration');
document.getElementById('btn-logout').onclick = () => showView('registration');
document.getElementById('btn-new-event').onclick = () => views.modalEvent.classList.remove('hidden');
document.getElementById('close-modal').onclick = () => views.modalEvent.classList.add('hidden');

// --- Theme Management ---
const themeBtn = document.getElementById('theme-btn');
const html = document.documentElement;
let savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);

themeBtn.addEventListener('click', () => {
    let current = html.getAttribute('data-theme');
    let target = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
});

// --- Real-time Clock & Countdown ---
function updateTimers() {
    const now = new Date();
    document.getElementById('current-clock').innerText = now.toLocaleTimeString();

    if (currentEvent && currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const diff = eventDate - now;

        if (diff > 0) {
            const h = Math.floor(diff / 36e5);
            const m = Math.floor((diff % 36e5) / 6e4);
            const s = Math.floor((diff % 6e4) / 1000);
            document.getElementById('countdown-timer').innerText = `Inicia en: ${h}h ${m}m ${s}s`;
            document.getElementById('countdown-timer').style.color = 'var(--primary)';
        } else {
            document.getElementById('countdown-timer').innerText = '¡El evento ha comenzado!';
            document.getElementById('countdown-timer').style.color = '#34C759'; // Apple Green
        }
    }
}
setInterval(updateTimers, 1000);

// --- API Interactions ---

async function fetchEvents() {
    const res = await fetch(`${API_URL}/events`);
    allEvents = await res.json();
    if (allEvents.length > 0) {
        currentEvent = allEvents[0];
        updateEventUI();
    }
}

function updateEventUI() {
    document.getElementById('event-name-display').innerText = currentEvent.name;
    document.getElementById('event-desc-display').innerText = `${currentEvent.location} • ${new Date(currentEvent.date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}`;
}

// Registro Público
document.getElementById('public-reg-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentEvent) return alert('No hay un evento seleccionado');

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
        alert('¡Registro exitoso! Te esperamos.');
        e.target.reset();
    }
};

// Login
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('login-user').value,
        password: document.getElementById('login-pass').value
    };

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        showView('admin');
        loadAdminData();
    } else {
        alert('Acceso denegado');
    }
};

// Admin Data
async function loadAdminData() {
    if (!currentEvent) return;
    
    // Cargar Stats
    const sRes = await fetch(`${API_URL}/stats/${currentEvent.id}`);
    const stats = await sRes.json();
    document.getElementById('stat-total').innerText = stats.total || 0;
    const perc = stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
    document.getElementById('stat-presence').innerText = `${perc}%`;
    document.getElementById('stat-missing').innerText = (stats.total || 0) - (stats.checkedIn || 0);

    // Cargar Lista
    const gRes = await fetch(`${API_URL}/guests/${currentEvent.id}`);
    allGuests = await gRes.json();
    renderGuests();
}

function renderGuests() {
    const tbody = document.getElementById('guests-tbody');
    tbody.innerHTML = allGuests.map(g => `
        <tr>
            <td>${g.name}</td>
            <td>${g.organization || '-'}</td>
            <td><span style="color: ${g.checked_in ? '#34C759' : '#8E8E93'}">${g.checked_in ? 'Presente' : 'Pendiente'}</span></td>
            <td>
                <button class="btn" onclick="toggleCheckin(${g.id}, ${g.checked_in})">
                    ${g.checked_in ? 'Deshacer' : 'Validar'}
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

// PDF Report
document.getElementById('btn-export-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = jsPDF();
    
    doc.setFontSize(22);
    doc.text(`Reporte de Evento: ${currentEvent.name}`, 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Estadísticas:`, 14, 35);
    doc.text(`Total Inscritos: ${allGuests.length}`, 14, 42);
    const asistentes = allGuests.filter(g => g.checked_in);
    doc.text(`Asistentes: ${asistentes.length}`, 14, 49);
    doc.text(`Faltantes: ${allGuests.length - asistentes.length}`, 14, 56);

    // Tabla discriminada
    const data = allGuests.map(g => [g.name, g.organization, g.checked_in ? 'ASISTENTE' : 'FALTANTE']);
    
    doc.autoTable({
        head: [['Nombre', 'Organización', 'Estado']],
        body: data,
        startY: 65,
        theme: 'grid',
        headStyles: { fillColor: [0, 122, 255] }
    });

    doc.save(`Reporte-${currentEvent.name}.pdf`);
};

// Importar Excel
document.getElementById('btn-import-trigger').onclick = () => document.getElementById('admin-file-import').click();
document.getElementById('admin-file-import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentEvent) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/import/${currentEvent.id}`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        alert('Base de datos alimentada correctamente');
        loadAdminData();
    }
};

// Inicialización
fetchEvents();
updateTimers();
