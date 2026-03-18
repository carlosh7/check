// MASTER SCRIPT V7.0 - ARQUITECTURA LIMPIA E INDUSTRIAL 🛡️🚀💎
console.log("CHECK V7.0: Iniciando Sistema Centralizado...");

// --- ESTADO CENTRALIZADO (STATE MANAGEMENT) ---
window.App = {
    state: {
        event: null,
        events: [],
        guests: [],
        user: null,
        socket: null,
        chart: null
    },
    constants: {
        API_URL: '/api'
    },
    
    // --- CORE NAV ---
    showView(viewName) {
        if (typeof window.FORCE_NAVGATION === 'function') {
            window.FORCE_NAVGATION(viewName);
        } else {
            console.error("CHECK V7.8: Motor FORCE_NAVGATION no disponible. Actualice index.html.");
        }
    },

    // --- AUTH ---
    async fetchAPI(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.user) headers['x-user-id'] = this.state.user.userId;
        
        try {
            const res = await fetch(`${this.constants.API_URL}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
            if (res.status === 401 || res.status === 403) throw new Error('Auth fail');
            return res.json();
        } catch (e) {
            if (e.message === 'Auth fail') this.logout();
            throw e;
        }
    },
    logout() {
        console.log("CHECK V9.3: Cerrando sesión segura. Retornando a Login.");
        localStorage.removeItem('user');
        this.state.user = null;
        if (typeof window.FORCE_NAVGATION === 'function') {
            window.FORCE_NAVGATION('login');
        }
    },

    // --- DATA LOADERS ---
    async loadEvents() {
        try {
            this.state.events = await this.fetchAPI('/events');
            this.showView('my-events');
            this.renderEventsGrid();
        } catch (e) { this.showView('login'); }
    },
    renderEventsGrid() {
        const c = document.getElementById('events-list-container');
        if (!c) return;
        c.innerHTML = this.state.events.map(ev => `
            <div class="glass-card p-8 rounded-[40px] hover:border-primary/40 transition-all group cursor-pointer border border-white/5 bg-slate-900/40 shadow-xl" onclick="window.App.openEvent('${ev.id}')">
                <div class="flex justify-between items-start mb-8">
                    <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary transition-all group-hover:shadow-lg group-hover:shadow-primary/30">
                        <span class="material-symbols-outlined text-primary group-hover:text-white transition-colors">event_available</span>
                    </div>
                </div>
                <h3 class="text-2xl font-black mb-2 text-white font-display">${ev.name}</h3>
                <p class="text-slate-500 text-xs line-clamp-2">${ev.description || 'Evento sin descripción.'}</p>
                <div class="mt-6 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="material-symbols-outlined text-sm text-primary">location_on</span> ${ev.location || 'Consultar'}
                </div>
            </div>
        `).join('');
    },
    async openEvent(id) {
        this.state.event = this.state.events.find(e => e.id === id);
        if (!this.state.event) return;
        this.showView('admin');
        const tit = document.getElementById('admin-event-title');
        const loc = document.getElementById('admin-event-location');
        if (tit) tit.innerText = this.state.event.name;
        if (loc) loc.innerText = this.state.event.location;
        this.loadGuests();
        this.updateStats();
        if (this.state.socket) this.state.socket.emit('join_event', id);
    },
    async loadGuests() {
        if (!this.state.event) return;
        this.state.guests = await this.fetchAPI(`/guests/${this.state.event.id}`);
        this.renderGuestsTarget(this.state.guests);
    },
    renderGuestsTarget(list) {
        const tb = document.getElementById('guests-tbody');
        if (!tb) return;
        tb.innerHTML = list.map(g => `
            <tr class="hover:bg-white/2 transition-colors border-b border-white/5">
                <td class="px-6 py-5">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shadow-inner">
                            ${(g.name || 'I').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-sm text-white">${g.name || 'S/N'}</div>
                            <div class="text-[10px] text-slate-500 font-medium tracking-tight">${g.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-5 text-xs text-slate-400">${g.organization || '<span class="opacity-30">-</span>'}</td>
                <td class="px-6 py-5 text-center">
                    <button onclick="window.App.toggleCheckin('${g.id}', ${g.checked_in})" class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-slate-500 hover:text-white border border-white/10'}">
                        ${g.checked_in ? 'Acreditado' : 'Pendiente'}
                    </button>
                </td>
                <td class="px-6 py-5 text-right">
                    <button class="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-600 hover:text-white transition-all"><span class="material-symbols-outlined text-sm">edit</span></button>
                </td>
            </tr>
        `).join('');
    },
    async toggleCheckin(gId, status) {
        await this.fetchAPI(`/checkin/${gId}`, { method: 'POST', body: JSON.stringify({ status: !status }) });
        this.loadGuests();
    },
    async updateStats() {
        if (!this.state.event) return;
        const s = await this.fetchAPI(`/stats/${this.state.event.id}`);
        const sv = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        sv('stat-total', s.total);
        sv('stat-orgs', s.orgs);
        sv('stat-presence', s.total > 0 ? Math.round((s.checkedIn / s.total) * 100) + '%' : '0%');
        sv('stat-onsite', s.onsite || 0);
        sv('stat-health', s.healthAlerts || 0);
        this.renderChart(s.flowData);
    },
    renderChart(flow) {
        const canvas = document.getElementById('flowChart');
        if (!canvas || typeof Chart === 'undefined') return;
        if (this.state.chart) this.state.chart.destroy();
        this.state.chart = new Chart(canvas.getContext('2d'), {
            type: 'line', data: {
                labels: (flow || []).map(d => d.hour + ':00'),
                datasets: [{
                    data: (flow || []).map(d => d.count),
                    borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    tension: 0.4, fill: true, borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#fff'
                }]
            }, options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                    x: { grid: { display: false }, ticks: { color: '#64748b' } }
                } 
            }
        });
    },
    async loadPublicEvent(eventNameParam = null) {
        try {
            const evs = await this.fetchAPI('/events');
            if (evs.length > 0) {
                // Si viene un nombre en la URL, buscamos el evento específico. Si no, tomamos el primero activo.
                let targetEvent = evs[0];
                if (eventNameParam) {
                    const found = evs.find(e => e.name.replace(/\s+/g, '-').toLowerCase() === eventNameParam.toLowerCase());
                    if (found) targetEvent = found;
                }
                this.state.event = targetEvent;
                const badge = document.getElementById('event-name-badge');
                if (badge) badge.innerText = this.state.event.name;
            }
        } catch (e) {}
    },
    
    // --- IMPORT ENGINE V7 ---
    async handleImport(file) {
        if (!file || !this.state.event) return;
        const fd = new FormData();
        fd.append('file', file); fd.append('eventId', this.state.event.id);
        
        try {
            const res = await fetch(`${this.constants.API_URL}/import-dry-run`, { method: 'POST', headers: { 'x-user-id': this.state.user.userId }, body: fd });
            const result = await res.json();
            const sum = document.getElementById('import-summary-content');
            if (sum) {
                sum.innerHTML = `
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center">
                            <p class="text-[10px] font-black uppercase text-emerald-500 mb-2">Datos Nuevos</p>
                            <p class="text-4xl font-mono text-emerald-400 font-bold">${result.summary.new}</p>
                        </div>
                        <div class="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                            <p class="text-[10px] font-black uppercase text-amber-500 mb-2">Duplicados Omitidos</p>
                            <p class="text-4xl font-mono text-amber-400 font-bold">${result.summary.existing}</p>
                        </div>
                    </div>
                `;
            }
            document.getElementById('modal-import-results')?.classList.remove('hidden');
            
            document.getElementById('btn-confirm-import').onclick = async () => {
                await this.fetchAPI('/import-confirm', { method: 'POST', body: JSON.stringify({ eventId: this.state.event.id, guests: result.data }) });
                document.getElementById('modal-import-results')?.classList.add('hidden');
                this.loadGuests(); this.updateStats();
                alert('¡Importación V7 Completada con Éxito!');
            };
        } catch (e) { alert("Error: El formato del archivo no es compatible o está corrupto."); }
    }
};

// --- DOM READY BOOTSTRAP V9.0 ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore Auth
    try {
        const s = localStorage.getItem('user');
        if (s && s !== "undefined" && s !== "null") window.App.state.user = JSON.parse(s);
    } catch(e){}

    // 2. ROUTING SPA ESTRICTO
    const path = window.location.pathname;
    const isRegistrationPath = path.toLowerCase().endsWith('/registro');

    if (isRegistrationPath) {
        const pathSegments = path.split('/');
        const eventNameStr = pathSegments.length > 2 ? pathSegments[1] : null;
        App.loadPublicEvent(eventNameStr);
        window.FORCE_NAVGATION('registration');
    } else {
        // ESTADO POR DEFECTO: LOGIN O DASHBOARD
        if (App.state.user) App.loadEvents();
        else window.FORCE_NAVGATION('login');
    }

    // 2. Sockets
    if (typeof io !== 'undefined') {
        window.App.state.socket = io();
        window.App.state.socket.on('update_stats', (id) => { if (App.state.event?.id === id) App.updateStats(); });
        window.App.state.socket.on('checkin_update', () => App.loadGuests());
    }

    // 3. Listeners
    const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    // Login Form
    sf('login-form', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-user').value; const p = document.getElementById('login-pass').value;
        try {
            const d = await App.fetchAPI('/login', { method: 'POST', body: JSON.stringify({username: u, password: p}) });
            if (d.success) { 
                App.state.user = d; 
                localStorage.setItem('user', JSON.stringify(d)); 
                App.loadEvents(); 
            } else alert(d.message);
        } catch (err) { alert('Error de conexión con el servidor.'); }
    });

    // Public Reg Form
    sf('public-reg-form', async (e) => {
        e.preventDefault();
        if (!App.state.event) return alert("El sistema no ha detectado un evento activo. Contacte a STAFF.");
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "Procesando..."; btn.disabled = true;
        
        const b = { 
            event_id: App.state.event.id, 
            name: document.getElementById('reg-name').value, 
            email: document.getElementById('reg-email').value, 
            phone: document.getElementById('reg-phone')?.value, 
            organization: document.getElementById('reg-org')?.value, 
            gender: 'O', 
            dietary_notes: document.getElementById('reg-diet')?.value || '' 
        };
        try {
            const res = await fetch(`${App.constants.API_URL}/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(b) });
            const data = await res.json();
            if (data.success) {
                alert("✓ Registro Confirmado exitosamente."); 
                e.target.reset();
            } else {
                alert("Fallo el registro: " + data.error);
            }
        } catch (er) { alert("Error de red pública."); }
        finally { btn.innerText = originalText; btn.disabled = false; }
    });

    // Search
    document.getElementById('guest-search')?.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase();
        const f = App.state.guests.filter(g => (g.name||'').toLowerCase().includes(t) || (g.email||'').toLowerCase().includes(t) || (g.organization||'').toLowerCase().includes(t));
        App.renderGuestsTarget(f);
    });

    // Navigation Buttons (Admin)
    cl('btn-events-list-nav', () => App.loadEvents());
    
    // Admin Actions
    cl('btn-clear-db', async () => {
        if (!App.state.event) return;
        if (!confirm("☢️ PELIGRO: Está a punto de borrar TODOS los invitados de este evento. Esta acción NO se puede deshacer. ¿Continuar?")) return;
        try {
            await App.fetchAPI(`/clear-db/${App.state.event.id}`, {method: 'POST'});
            App.loadGuests(); App.updateStats(); 
            alert("✓ Base de datos purgada.");
        } catch(e) { alert("Error al limpiar."); }
    });

    cl('btn-export-excel', () => {
        if (App.state.event && App.state.user) window.location.href = `${App.constants.API_URL}/export-excel/${App.state.event.id}?x-user-id=${App.state.user.userId}`;
    });

    cl('btn-export-analytics', async () => {
        if (!App.state.event || typeof window.jspdf === 'undefined') return alert("Librería PDF no disponible");
        try {
            const s = await App.fetchAPI(`/stats/${App.state.event.id}`);
            const doc = new window.jspdf.jsPDF();
            
            // Premium Header
            doc.setFillColor(15, 23, 42); // slate-950
            doc.rect(0, 0, 210, 50, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28); 
            doc.text("CHECK ANALYTICS", 15, 25);
            doc.setFontSize(10); 
            doc.setTextColor(124, 58, 237); // primary
            doc.text(`REPORT V7.0 | ${App.state.event.name.toUpperCase()}`, 15, 35);
            
            // Table
            doc.autoTable({ 
                startY: 60, 
                head: [['Identificador de Métrica', 'Valor Consolidado']], 
                body: [
                    ['Total de Invitados en Base de Datos', s.total], 
                    ['Asistencia Efectiva Acumulada', s.checkedIn], 
                    ['Tasa de Presencia Global', (s.total > 0 ? Math.round((s.checkedIn/s.total)*100) : 0) + '%'],
                    ['Ausencia (No Show)', s.total - s.checkedIn], 
                    ['Empresas / Organizaciones Únicas', s.orgs],
                    ['Requerimientos Alimenticios o Médicos', s.healthAlerts || 0]
                ],
                theme: 'striped',
                headStyles: { fillColor: [124, 58, 237] },
                styles: { fontSize: 11, cellPadding: 6 }
            });
            
            doc.save(`Analitica_V7_${App.state.event.name.replace(/\s+/g,'_')}.pdf`);
        } catch(e) { alert("Error al generar el PDF Analytics."); }
    });

    // Import Modals & logic
    cl('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel')?.click());
    cl('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf')?.click());
    document.getElementById('admin-file-import-excel')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    document.getElementById('admin-file-import-pdf')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    cl('close-import-modal', () => document.getElementById('modal-import-results')?.classList.add('hidden'));

    // Clocks logic (using IDs)
    setInterval(() => {
        const m = new Date();
        const s = m.toLocaleTimeString('es-ES', {hour12: false});
        document.querySelectorAll('#events-list-clock, #admin-clock-real').forEach(e => e.innerText = s);
        if (App.state.event) {
            const d = new Date(App.state.event.date) - m;
            let cstr = "EVENTO ACTIVO";
            if (d > 0) {
                const h = Math.floor(d / 3600000).toString().padStart(2, '0');
                const min = Math.floor((d % 3600000) / 60000).toString().padStart(2, '0');
                const sec = Math.floor((d % 60000) / 1000).toString().padStart(2, '0');
                cstr = `${h}:${min}:${sec}`;
            }
            const cEl1 = document.getElementById('admin-clock-countdown');
            const cEl2 = document.getElementById('countdown-timer');
            if (cEl1) cEl1.innerText = cstr;
            if (cEl2) cEl2.innerText = cstr;
        }
    }, 1000);

    // Bootstrap Entry
    if (App.state.user) App.loadEvents();
    else { App.showView('registration'); App.loadPublicEvent(); }
});

// Retro-compatibilidad para el botón STAFF y otros onclicks inline (Nuclear Shield V6.0 -> V7.0)
window.showView = (v) => App.showView(v);
window.logout = () => App.logout();
