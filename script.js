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

// --- DOM READY BOOTSTRAP V10.2 ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore Auth
    try {
        const s = localStorage.getItem('user');
        if (s && s !== "undefined" && s !== "null") window.App.state.user = JSON.parse(s);
    } catch(e){}

    // 2. ROUTING SPA ESTRICTO V9
    const path = window.location.pathname;
    const isRegistrationPath = path.toLowerCase().endsWith('/registro');
    if (isRegistrationPath) {
        const segments = path.split('/');
        App.loadPublicEvent(segments.length > 2 ? segments[1] : null);
        window.FORCE_NAVGATION('registration');
    } else {
        if (App.state.user) App.loadEvents();
        else window.FORCE_NAVGATION('login');
    }

    // 3. Sockets
    if (typeof io !== 'undefined') {
        window.App.state.socket = io();
        window.App.state.socket.on('update_stats', (id) => { if (App.state.event?.id === id) App.updateStats(); });
        window.App.state.socket.on('checkin_update', () => App.loadGuests());
    }

    // 4. Tab Switcher del Admin V10 - ROBUSTO CON IDs DIRECTOS
    const ALL_TAB_IDS = ['tab-users', 'tab-legal', 'tab-account'];

    window.switchAdminTab = function(tabName) {
        console.log('CHECK V10: switchAdminTab ->', tabName || 'dashboard');
        // Ocultar dashboard principal y todos los tabs
        const mainDash = document.getElementById('admin-main-dashboard');
        if (mainDash) mainDash.style.display = 'none';
        ALL_TAB_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Restablecer todos los botones de nav
        document.querySelectorAll('.nav-tab-btn').forEach(b => {
            b.style.background = '';
            b.style.color = '';
            b.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20', 'active');
            b.classList.add('text-slate-400');
        });

        if (!tabName) {
            // Mostrar dashboard principal
            if (mainDash) mainDash.style.display = 'block';
            const dashBtn = document.getElementById('nav-tab-dashboard');
            if (dashBtn) {
                dashBtn.classList.remove('text-slate-400');
                dashBtn.classList.add('bg-primary', 'text-white', 'shadow-xl', 'active');
            }
        } else {
            // Mostrar tab pedido
            const panel = document.getElementById('tab-' + tabName);
            if (panel) panel.style.display = 'block';
            const activeBtn = document.querySelector('[data-tab="' + tabName + '"]');
            if (activeBtn) {
                activeBtn.classList.remove('text-slate-400');
                activeBtn.classList.add('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20', 'active');
            }
            if (tabName === 'users') App.loadUsersTable();
            if (tabName === 'legal') App.loadLegalTexts();
        }
    };

    document.getElementById('nav-tab-dashboard')?.addEventListener('click', () => switchAdminTab(null));
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
    });

    // 5. Listeners generales
    const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    // Login Form
    sf('login-form', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-user').value; const p = document.getElementById('login-pass').value;
        try {
            const d = await App.fetchAPI('/login', { method: 'POST', body: JSON.stringify({username: u, password: p}) });
            if (d.success) { 
                App.state.user = d; localStorage.setItem('user', JSON.stringify(d));
                // Actualizar sidebar info
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                if (sbu) sbu.textContent = d.username || 'Usuario';
                if (sbr) sbr.textContent = d.role || 'Staff';
                App.loadEvents(); 
            } else alert(d.message || 'Credenciales inválidas.');
        } catch (err) { alert('Error de conexión con el servidor.'); }
    });

    // Signup Form (Solicitar Cuenta)
    cl('go-to-signup', (e) => {
        e.preventDefault();
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('signup-form')?.classList.remove('hidden');
    });
    cl('go-to-login', () => {
        document.getElementById('signup-form')?.classList.add('hidden');
        document.getElementById('login-form')?.classList.remove('hidden');
    });
    sf('signup-form', async (e) => {
        e.preventDefault();
        const u = document.getElementById('signup-user').value;
        const p = document.getElementById('signup-pass').value;
        try {
            const d = await App.fetchAPI('/signup', { method: 'POST', body: JSON.stringify({ username: u, password: p, role: 'PRODUCTOR' }) });
            if (d.success) alert('✓ Solicitud enviada. Un administrador debe aprobar tu acceso.');
            else alert('No se pudo enviar la solicitud.');
            document.getElementById('signup-form')?.classList.add('hidden');
            document.getElementById('login-form')?.classList.remove('hidden');
        } catch(err) { alert('Error de conexión.'); }
    });

    // Modales Legales (Links del Login)
    async function openLegalModal(key, title) {
        try {
            const settings = await fetch('/api/settings').then(r => r.json());
            const modal = document.getElementById('modal-legal');
            document.getElementById('modal-legal-title').textContent = title;
            document.getElementById('modal-legal-content').innerHTML = settings[key] || '<p>Contenido no disponible.</p>';
            modal?.classList.remove('hidden');
        } catch(e) { alert('No se pudo cargar el texto legal.'); }
    }
    cl('btn-open-policy', () => openLegalModal('policy_data', 'Política de Tratamiento de Datos'));
    cl('btn-open-terms', () => openLegalModal('terms_conditions', 'Términos y Condiciones'));
    cl('btn-close-legal', () => document.getElementById('modal-legal')?.classList.add('hidden'));

    // Logout
    cl('btn-logout', () => App.logout());

    // Public Reg Form
    sf('public-reg-form', async (e) => {
        e.preventDefault();
        if (!App.state.event) return alert("Sin evento activo.");
        const btn = e.target.querySelector('button[type="submit"]');
        const orig = btn.innerText; btn.innerText = "Procesando..."; btn.disabled = true;
        const b = { event_id: App.state.event.id, name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, phone: document.getElementById('reg-phone')?.value, organization: document.getElementById('reg-org')?.value, gender: 'O', dietary_notes: document.getElementById('reg-diet')?.value || '' };
        try {
            const res = await fetch(`${App.constants.API_URL}/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(b) });
            const data = await res.json();
            if (data.success) { alert("✓ Registro Confirmado."); e.target.reset(); }
            else alert("Error: " + data.error);
        } catch { alert("Error de red."); }
        finally { btn.innerText = orig; btn.disabled = false; }
    });

    // Search
    document.getElementById('guest-search')?.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase();
        const f = App.state.guests.filter(g => (g.name||'').toLowerCase().includes(t) || (g.email||'').toLowerCase().includes(t) || (g.organization||'').toLowerCase().includes(t));
        App.renderGuestsTarget(f);
    });

    // Navigation Buttons
    cl('btn-events-list-nav', () => App.loadEvents());
    
    // Admin Actions
    cl('btn-clear-db', async () => {
        if (!App.state.event) return;
        if (!confirm("☢️ PELIGRO: Va a borrar TODOS los invitados de este evento. ¿Continuar?")) return;
        try { await App.fetchAPI(`/clear-db/${App.state.event.id}`, {method: 'POST'}); App.loadGuests(); App.updateStats(); alert("✓ Base de datos purgada."); }
        catch(e) { alert("Error."); }
    });
    cl('btn-export-excel', () => { if (App.state.event && App.state.user) window.location.href = `${App.constants.API_URL}/export-excel/${App.state.event.id}?x-user-id=${App.state.user.userId}`; });
    cl('btn-export-analytics', async () => {
        if (!App.state.event || typeof window.jspdf === 'undefined') return alert("Librería PDF no disponible");
        try {
            const s = await App.fetchAPI(`/stats/${App.state.event.id}`);
            const doc = new window.jspdf.jsPDF();
            doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 50, 'F');
            doc.setTextColor(255,255,255); doc.setFontSize(28); doc.text("CHECK ANALYTICS", 15, 25);
            doc.setFontSize(10); doc.setTextColor(124,58,237); doc.text(`REPORT V10.2 | ${App.state.event.name.toUpperCase()}`, 15, 35);
            doc.autoTable({ startY: 60, head: [['Métrica', 'Valor']], body: [['Total Invitados', s.total],['Asistencia', s.checkedIn],['Presencia', (s.total > 0 ? Math.round((s.checkedIn/s.total)*100) : 0) + '%'],['No Show', s.total - s.checkedIn],['Organizaciones', s.orgs],['Alertas Médicas', s.healthAlerts||0]], theme: 'striped', headStyles: {fillColor:[124,58,237]}, styles:{fontSize:11,cellPadding:6} });
            doc.save(`Analitica_V10.2_${App.state.event.name.replace(/\s+/g,'_')}.pdf`);
        } catch(e) { alert("Error al generar PDF."); }
    });

    // Import
    cl('admin-import-excel-btn', () => document.getElementById('admin-file-import-excel')?.click());
    cl('admin-import-pdf-btn', () => document.getElementById('admin-file-import-pdf')?.click());
    document.getElementById('admin-file-import-excel')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    document.getElementById('admin-file-import-pdf')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    cl('close-import-modal', () => document.getElementById('modal-import-results')?.classList.add('hidden'));

    // ------- V10: GESTIÓN DE USUARIOS -------
    App.loadUsersTable = async () => {
        if (!App.state.user || App.state.user.role !== 'ADMIN') return;
        const users = await App.fetchAPI('/users');
        const pending = users.filter(u => u.status === 'PENDING');
        const badge = document.getElementById('pending-badge');
        const pendingSection = document.getElementById('pending-requests-section');
        const pendingList = document.getElementById('pending-users-list');

        if (badge) badge.classList.toggle('hidden', pending.length === 0);
        if (pendingSection) pendingSection.classList.toggle('hidden', pending.length === 0);
        if (pendingList) {
            pendingList.innerHTML = pending.map(u => `
                <div class="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-amber-500/20">
                    <div>
                        <p class="font-bold text-sm text-white">${u.username}</p>
                        <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">${u.role} · Solicitado ${new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.approveUser('${u.id}', 'APPROVED')" class="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-xl text-xs font-black uppercase transition-all">Aprobar</button>
                        <button onclick="App.approveUser('${u.id}', 'REJECTED')" class="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-xl text-xs font-black uppercase transition-all">Rechazar</button>
                    </div>
                </div>`).join('');
        }

        const tbody = document.getElementById('users-tbody');
        if (tbody) {
            tbody.innerHTML = users.map(u => `
                <tr class="hover:bg-white/2 transition-colors border-b border-white/5">
                    <td class="px-8 py-5">
                        <div class="font-bold text-sm text-white">${u.username}</div>
                        <div class="text-[10px] text-slate-500">${new Date(u.created_at).toLocaleDateString('es-ES')}</div>
                    </td>
                    <td class="px-8 py-5">
                        <select onchange="App.changeUserRole('${u.id}', this.value)" class="bg-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 border border-white/10 cursor-pointer">
                            ${['ADMIN','PRODUCTOR','STAFF','CLIENTE','OTROS'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </td>
                    <td class="px-8 py-5 text-center">
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}">${u.status}</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${u.status !== 'APPROVED' ? `<button onclick="App.approveUser('${u.id}','APPROVED')" class="px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary/40 rounded-xl text-[10px] font-black uppercase transition-all">Activar</button>` : `<button onclick="App.approveUser('${u.id}','REJECTED')" class="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-xl text-[10px] font-black uppercase transition-all">Desactivar</button>`}
                    </td>
                </tr>`).join('');
        }
    };

    App.approveUser = async (id, status) => {
        await App.fetchAPI(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        App.loadUsersTable();
    };
    App.changeUserRole = async (id, role) => {
        await App.fetchAPI(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    };

    // Modal de Invitación
    cl('btn-open-invite', () => document.getElementById('modal-invite')?.classList.remove('hidden'));
    cl('btn-close-invite', () => document.getElementById('modal-invite')?.classList.add('hidden'));
    sf('invite-user-form', async (e) => {
        e.preventDefault();
        const u = document.getElementById('invite-username').value;
        const p = document.getElementById('invite-password').value;
        const r = document.getElementById('invite-role').value;
        try {
            const res = await App.fetchAPI('/users/invite', { method: 'POST', body: JSON.stringify({username: u, password: p, role: r}) });
            if (res.success) { alert(`✓ Usuario "${u}" creado con rol ${r}.`); document.getElementById('invite-user-form').reset(); document.getElementById('modal-invite')?.classList.add('hidden'); App.loadUsersTable(); }
            else alert('Error: ' + (res.error || 'No se pudo crear el usuario.'));
        } catch { alert('Error de conexión.'); }
    });

    // ------- V10: TEXTOS LEGALES -------
    App.loadLegalTexts = async () => {
        try {
            const s = await fetch('/api/settings').then(r => r.json());
            const pt = document.getElementById('legal-policy-text');
            const tt = document.getElementById('legal-terms-text');
            if (pt) pt.value = s.policy_data?.replace(/<[^>]*>/g,'') || '';
            if (tt) tt.value = s.terms_conditions?.replace(/<[^>]*>/g,'') || '';
        } catch {}
    };
    cl('btn-save-policy', async () => {
        const val = document.getElementById('legal-policy-text')?.value;
        await App.fetchAPI('/settings', { method: 'PUT', body: JSON.stringify({ policy_data: '<p>' + val.replace(/\n/g,'</p><p>') + '</p>' }) });
        alert('✓ Política de datos guardada.');
    });
    cl('btn-save-terms', async () => {
        const val = document.getElementById('legal-terms-text')?.value;
        await App.fetchAPI('/settings', { method: 'PUT', body: JSON.stringify({ terms_conditions: '<p>' + val.replace(/\n/g,'</p><p>') + '</p>' }) });
        alert('✓ Términos y Condiciones guardados.');
    });

    // ------- V10: CAMBIO DE CONTRASEÑA -------
    sf('change-pass-form', async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('new-pass-1').value;
        const p2 = document.getElementById('new-pass-2').value;
        if (p1 !== p2) return alert('Las contraseñas no coinciden.');
        if (!App.state.user) return;
        try {
            await App.fetchAPI(`/users/${App.state.user.userId}/password`, { method: 'PUT', body: JSON.stringify({ password: p1 }) });
            alert('✓ Contraseña actualizada exitosamente.');
            document.getElementById('change-pass-form').reset();
        } catch { alert('Error al actualizar contraseña.'); }
    });

    // Clocks
    setInterval(() => {
        const ms = new Date();
        const s = ms.toLocaleTimeString('es-ES', {hour12: false});
        document.querySelectorAll('#events-list-clock, #admin-clock-real').forEach(e => e.innerText = s);
        if (App.state.event) {
            const d = new Date(App.state.event.date) - ms;
            let cstr = "EVENTO ACTIVO";
            if (d > 0) { const h=Math.floor(d/3600000).toString().padStart(2,'0'); const min=Math.floor((d%3600000)/60000).toString().padStart(2,'0'); const sec=Math.floor((d%60000)/1000).toString().padStart(2,'0'); cstr=`${h}:${min}:${sec}`; }
            const c1 = document.getElementById('admin-clock-countdown'); const c2 = document.getElementById('countdown-timer');
            if (c1) c1.innerText = cstr; if (c2) c2.innerText = cstr;
        }
    }, 1000);
});

// Retrocompatibilidad
window.showView = (v) => App.showView(v);
window.logout = () => App.logout();

