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
        chart: null,
        version: '10.5.3',
        groups: [],
    },
    constants: {
        API_URL: '/api'
    },
    
    // ═══ PERMISOS JERÁRQUICOS V10.5 ═══
    canAccess(permission) {
        const role = this.state.user?.role;
        if (role === 'ADMIN') return true;
        
        // Permisos de PRODUCTOR
        if (role === 'PRODUCTOR') {
            const producerPerms = [
                'view_groups', 'create_group', 'edit_group',
                'view_events', 'create_event', 'edit_event', 'delete_event',
                'view_users', 'create_user', 'edit_user', 'delete_user',
                'export_data', 'delete_db', 'manage_roles'
            ];
            return producerPerms.includes(permission);
        }
        
        // Permisos de STAFF
        if (role === 'STAFF') {
            const staffPerms = [
                'view_events', 'view_guests', 'create_guest', 'edit_guest', 'delete_guest', 'export_guests'
            ];
            return staffPerms.includes(permission);
        }
        
        // Permisos de CLIENTE
        if (role === 'CLIENTE') {
            const clientPerms = [
                'view_events', 'view_guests'
            ];
            return clientPerms.includes(permission);
        }
        
        return false;
    },
    
    // Actualizar opciones de rol en el formulario de invitación según permisos
    updateRoleOptions() {
        const roleSelect = document.getElementById('invite-role');
        const roleContainer = document.getElementById('invite-role-container');
        if (!roleSelect || !roleContainer) return;
        
        const role = this.state.user?.role;
        
        if (role === 'ADMIN') {
            roleContainer.classList.remove('hidden');
            roleSelect.innerHTML = `
                <option value="ADMIN">ADMIN (Super Administrador)</option>
                <option value="PRODUCTOR" selected>PRODUCTOR (Gestión de Eventos)</option>
                <option value="STAFF">STAFF (Check-in en Sitio)</option>
                <option value="CLIENTE">CLIENTE (Acceso de Cliente)</option>
                <option value="OTROS">OTROS (Acceso Restringido)</option>`;
        } else if (role === 'PRODUCTOR') {
            roleContainer.classList.remove('hidden');
            roleSelect.innerHTML = `
                <option value="PRODUCTOR" selected>PRODUCTOR (Gestión de Eventos)</option>
                <option value="STAFF">STAFF (Check-in en Sitio)</option>
                <option value="CLIENTE">CLIENTE (Acceso de Cliente)</option>
                <option value="OTROS">OTROS (Acceso Restringido)</option>`;
        } else {
            roleContainer.classList.add('hidden');
        }
    },
    
    // ═══ TEMA OSCURO/CLARO ═══
    toggleTheme: function() {
        const isDark = document.documentElement.classList.contains('dark');
        const icon = document.getElementById('theme-icon');
        
        if (isDark) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            localStorage.setItem('theme', 'light');
            if (icon) icon.textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            if (icon) icon.textContent = 'dark_mode';
        }
    },
    
    initTheme: function() {
        const saved = localStorage.getItem('theme') || 'dark';
        const icon = document.getElementById('theme-icon');
        
        if (saved === 'light') {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            if (icon) icon.textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            if (icon) icon.textContent = 'dark_mode';
        }
    },
    
    // Mostrar/ocultar elementos según permisos
    updateUIPermissions() {
        // Admin: mostrar todo el menú de administración global
        if (this.state.user?.role === 'ADMIN') {
            document.getElementById('nav-section-global')?.classList.remove('hidden');
        } else {
            document.getElementById('nav-section-global')?.classList.add('hidden');
        }
        
        // Ocultar botón de eliminar base de datos para no-admin
        if (!this.canAccess('delete_db')) {
            const deleteBtns = document.querySelectorAll('[id*="delete-db"], [id*="btn-clear-db"]');
            deleteBtns.forEach(btn => btn?.classList.add('hidden'));
        }
    },
    
    // Cargar empresas
    loadGroups: async function() {
        if (!this.state.user || this.state.user.role !== 'ADMIN') return;
        try {
            const groups = await this.fetchAPI('/groups');
            this.state.groups = groups;
            const tbody = document.getElementById('groups-tbody');
            if (tbody) {
                tbody.innerHTML = groups.map(g => `
                    <tr class="hover:bg-white/[0.02] border-b border-white/5">
                        <td class="px-8 py-5"><div class="font-bold text-base text-white">${g.name}</div></td>
                        <td class="px-8 py-5 text-slate-400 text-sm">${g.description || '-'}</td>
                        <td class="px-8 py-5 text-center"><span class="px-4 py-2 rounded-xl text-sm font-black ${g.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}">${g.status}</span></td>
                        <td class="px-8 py-5 text-center text-slate-500 text-sm">${g.created_at ? new Date(g.created_at).toLocaleDateString() : '-'}</td>
                        <td class="px-8 py-5 text-right">
                            <button onclick="App.editGroup('${g.id}')" class="px-4 py-2 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-sm font-black">Editar</button>
                        </td>
                    </tr>`).join('');
            }
        } catch(e) { console.error('Error loading groups:', e); }
    },
    
    // --- FUNCIONES GLOBALES DEFINIDAS AL INICIO ---
    loadUsersTable: async function() {
        if (!this.state.user || !['ADMIN', 'PRODUCTOR'].includes(this.state.user.role)) return;
        try {
            const [users, groups, events] = await Promise.all([
                this.fetchAPI('/users'),
                this.fetchAPI('/groups'),
                this.fetchAPI('/events')
            ]);
            
            // Guardar datos para filtros
            this.state.allUsers = users;
            this.state.allGroups = groups;
            this.state.allEvents = events;
            
            // Renderizar con filtros
            this.renderUsersTable(users, groups, events);
            
        } catch(e) { console.error('Error loading users:', e); }
    },
    
    renderUsersTable: function(users, groups, events) {
        // Cargar opciones de filtros si no existen
        const filterGroup = document.getElementById('filter-group');
        const filterEvent = document.getElementById('filter-event');
        
        if (filterGroup && groups.length > 0) {
            const currentVal = filterGroup.value;
            filterGroup.innerHTML = '<option value="">Todas las empresas</option>' + 
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            filterGroup.value = currentVal;
        }
        
        if (filterEvent && events.length > 0) {
            const currentVal = filterEvent.value;
            filterEvent.innerHTML = '<option value="">Todos los eventos</option>' + 
                events.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
            filterEvent.value = currentVal;
        }
        
        const pending = users.filter(u => u.status === 'PENDING');
        const badge = document.getElementById('pending-badge');
        const pendingSection = document.getElementById('pending-requests-section');
        const pendingList = document.getElementById('pending-users-list');
        if (badge) badge.classList.toggle('hidden', pending.length === 0);
        if (pendingSection) pendingSection.classList.toggle('hidden', pending.length === 0);
        if (pendingList) {
            pendingList.innerHTML = pending.map(u => `
                <div class="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-amber-500/20">
                    <div>
                        <p class="font-bold text-xs text-white">${u.display_name || u.username}</p>
                        <p class="text-[10px] text-slate-500">${u.username}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.approveUser('${u.id}', 'APPROVED')" class="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg text-[10px] font-bold uppercase">Aprobar</button>
                    </div>
                </div>`).join('');
        }
        
        const tbody = document.getElementById('users-tbody-simple');
        const isAdmin = this.state.user.role === 'ADMIN';
        const isProductor = this.state.user.role === 'PRODUCTOR';
        
        if (tbody) {
            tbody.innerHTML = users.map((u, index) => {
                const canEdit = isAdmin || (isProductor && u.role !== 'ADMIN');
                const roleOptions = isAdmin ? 
                    ['ADMIN', 'PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS'] :
                    ['PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS'];
                
                // Opciones de empresa
                const groupOptions = groups.map(g => 
                    `<option value="${g.id}" ${u.group_id === g.id ? 'selected' : ''}>${g.name}</option>`
                ).join('');
                const groupSelect = isAdmin && canEdit ? `
                    <div class="flex items-center gap-1">
                        <select onchange="App.assignUserGroup('${u.id}', this.value)" class="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1.5 border border-white/10 flex-1">
                            <option value="">-- Empresa --</option>
                            ${groupOptions}
                        </select>
                        <button onclick="App.quickCreateGroup()" class="px-2 py-1.5 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-[11px] font-bold" title="Crear">+</button>
                    </div>` : 
                    `<span class="px-2 py-1.5 bg-slate-800/50 rounded-lg text-[11px] ${u.group_name ? 'text-white' : 'text-slate-500'}">${u.group_name || 'Sin empresa'}</span>`;
                
                // Opciones de eventos
                let eventOptions = events.map(e => {
                    const selected = u.events && u.events.includes(e.id) ? 'selected' : '';
                    return `<option value="${e.id}" ${selected}>${e.name}</option>`;
                }).join('');
                const eventSelect = canEdit ? `
                    <div class="flex items-center gap-1">
                        <select onchange="App.assignUserEvents('${u.id}', this)" multiple class="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1.5 border border-white/10 flex-1 h-10">
                            ${eventOptions}
                        </select>
                        ${(isAdmin || isProductor) ? `<button onclick="App.quickCreateEvent()" class="px-2 py-1.5 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-[11px] font-bold" title="Crear">+</button>` : ''}
                    </div>` : 
                    `<span class="px-2 py-1.5 bg-slate-800/50 rounded-lg text-[11px] text-slate-400">${u.events ? u.events.length : 0} evt</span>`;
                
                // Selector de rol
                const roleSelect = canEdit ? 
                    `<select onchange="App.changeUserRole('${u.id}', this.value)" class="bg-slate-800 text-white text-[11px] font-bold rounded-lg px-2 py-1.5 border border-white/10">
                        ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>` : 
                    `<span class="px-2 py-1.5 rounded-lg text-[11px] font-bold ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'PRODUCTOR' ? 'bg-primary/20 text-primary' : 'bg-slate-500/20 text-slate-300'}">${u.role}</span>`;
                
                // Badge de estado
                const statusBadge = `<span class="px-2 py-1.5 rounded-lg text-[11px] font-bold ${u.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : u.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}">${u.status}</span>`;
                
                // Botón activar/desactivar
                const actionBtn = canEdit ? (u.status !== 'APPROVED' ? 
                    `<button onclick="App.approveUser('${u.id}','APPROVED')" class="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg text-[11px] font-bold">Activar</button>` : 
                    `<button onclick="App.approveUser('${u.id}','REJECTED')" class="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg text-[11px] font-bold">Desactivar</button>`) : '';
                
                const eventCountBadge = u.events && u.events.length > 0 ? 
                    `<span class="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary rounded-full text-[10px] font-bold">${u.events.length}</span>` : '';
                
                // Línea separadora sutil
                const separator = index > 0 ? '<div class="border-t border-white/5"></div>' : '';
                
                return `${separator}<tr class="hover:bg-white/[0.02]">
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                ${(u.display_name || u.username).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p class="font-bold text-xs text-white">${u.display_name || u.username}</p>
                                <p class="text-[10px] text-slate-500">${u.username}</p>
                            </div>
                        </div>
                        <div class="ml-11">
                            <p class="text-[9px] font-black uppercase text-slate-600 mb-1 tracking-wider">Eventos ${eventCountBadge}</p>
                            ${eventSelect}
                        </div>
                    </td>
                    <td class="px-4 py-3 align-top">
                        <p class="text-[9px] font-black uppercase text-slate-600 mb-1 tracking-wider">Rol</p>
                        <div class="mb-2">${roleSelect}</div>
                        <p class="text-[9px] font-black uppercase text-slate-600 mb-1 tracking-wider">Empresa</p>
                        ${groupSelect}
                    </td>
                    <td class="px-4 py-3 align-top">
                        <p class="text-[9px] font-black uppercase text-slate-600 mb-1 tracking-wider">Estado</p>
                        <div class="mb-2">${statusBadge}</div>
                        <p class="text-[9px] font-black uppercase text-slate-600 mb-1 tracking-wider">Acción</p>
                        ${actionBtn}
                    </td>
                </tr>`;
            }).join('');
        }
    },
    
    // Filtrar usuarios
    filterUsers: function() {
        const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
        const groupFilter = document.getElementById('filter-group')?.value || '';
        const eventFilter = document.getElementById('filter-event')?.value || '';
        
        let filtered = this.state.allUsers || [];
        
        // Filtro de búsqueda
        if (searchTerm) {
            filtered = filtered.filter(u => 
                (u.display_name && u.display_name.toLowerCase().includes(searchTerm)) ||
                u.username.toLowerCase().includes(searchTerm) ||
                (u.role && u.role.toLowerCase().includes(searchTerm)) ||
                (u.group_name && u.group_name.toLowerCase().includes(searchTerm))
            );
        }
        
        // Filtro por empresa
        if (groupFilter) {
            filtered = filtered.filter(u => u.group_id === groupFilter);
        }
        
        // Filtro por evento
        if (eventFilter) {
            filtered = filtered.filter(u => u.events && u.events.includes(eventFilter));
        }
        
        this.renderUsersTable(filtered, this.state.allGroups || [], this.state.allEvents || []);
    },
    
    // Crear empresa rápido desde modal
    quickCreateGroup: async function() {
        const name = prompt('Nombre de la nueva empresa:');
        if (!name || !name.trim()) return;
        const description = prompt('Descripción (opcional):') || '';
        try {
            const res = await this.fetchAPI('/groups', { 
                method: 'POST', 
                body: JSON.stringify({ name: name.trim(), description }) 
            });
            if (res.success) { 
                alert('✓ Empresa creada exitosamente');
                this.loadUsersTable();
            } else {
                alert('Error: ' + res.error);
            }
        } catch { alert('Error de conexión'); }
    },
    
    // Crear evento rápido desde modal
    quickCreateEvent: async function() {
        const name = prompt('Nombre del nuevo evento:');
        if (!name || !name.trim()) return;
        const date = prompt('Fecha del evento (YYYY-MM-DD HH:MM):') || '';
        try {
            const res = await this.fetchAPI('/events', { 
                method: 'POST', 
                body: JSON.stringify({ name: name.trim(), date, location: '', description: '' }) 
            });
            if (res.success) { 
                alert('✓ Evento creado exitosamente');
                this.loadUsersTable();
            } else {
                alert('Error: ' + res.error);
            }
        } catch { alert('Error de conexión'); }
    },
    
    // Asignar usuario a un grupo
    assignUserGroup: async function(userId, groupId) {
        try {
            const res = await this.fetchAPI(`/users/${userId}/group`, { 
                method: 'PUT', 
                body: JSON.stringify({ group_id: groupId || null }) 
            });
            if (res.success) console.log('Grupo asignado');
        } catch(e) { console.error('Error assigning group:', e); }
    },
    
    // Asignar usuario a eventos (recibe el select multiple)
    assignUserEvents: async function(userId, selectEl) {
        const selectedEvents = Array.from(selectEl.selectedOptions).map(o => o.value);
        try {
            const res = await this.fetchAPI(`/users/${userId}/events`, { 
                method: 'PUT', 
                body: JSON.stringify({ events: selectedEvents }) 
            });
            if (res.success) console.log('Eventos asignados');
        } catch(e) { console.error('Error assigning events:', e); }
    },
    
    approveUser: async function(id, status) {
        await this.fetchAPI(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        this.loadUsersTable();
    },
    
    changeUserRole: async function(id, role) {
        await this.fetchAPI(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    },
    
    loadLegalTexts: async function() {
        try {
            const s = await fetch('/api/settings').then(r => r.json());
            const pt = document.getElementById('legal-policy-text');
            const tt = document.getElementById('legal-terms-text');
            if (pt) pt.value = s.policy_data?.replace(/<[^>]*>/g,'') || '';
            if (tt) tt.value = s.terms_conditions?.replace(/<[^>]*>/g,'') || '';
        } catch {}
    },
    
    // --- NUEVO EVENTO V10 ---
    async createEvent(formData) {
        try {
            const res = await fetch(`${this.constants.API_URL}/events`, { 
                method: 'POST', 
                headers: { 'x-user-id': this.state.user.userId },
                body: formData 
            });
            const d = await res.json();
            if (d.success) {
                alert("✓ Evento creado con éxito.");
                document.getElementById('modal-event').classList.add('hidden');
                document.getElementById('new-event-form').reset();
                this.loadEvents();
            } else {
                alert("Error: " + d.error);
            }
        } catch (e) { alert("Error al crear evento."); }
    },
    
    // --- CORE NAV V10.5 (SPA Routing) ---
    showView(viewName) {
        
        // 1. Mostrar/Ocultar Contenedores Principales
        const isLogin = viewName === 'login';
        const loginEl = document.getElementById('view-login');
        const appEl = document.getElementById('app-container');
        
        if (isLogin) {
            // Mostrar login, ocultar app
            if (loginEl) { loginEl.classList.remove('hidden'); loginEl.style.display = 'flex'; }
            if (appEl) { appEl.classList.add('hidden'); appEl.style.display = 'none'; }
            return;
        } else {
            // Ocultar login, mostrar app
            if (loginEl) { loginEl.classList.add('hidden'); loginEl.style.display = 'none'; }
            if (appEl) { appEl.classList.remove('hidden'); appEl.style.display = 'flex'; }
        }

        // 2. Switchear vistas internas
        const viewIds = ["view-my-events", "view-admin", "view-admin-simple", "view-system", "view-system-simple", "view-groups", "view-legal", "view-account"];
        viewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Mapear rutas virtuales a vistas reales
        let targetViewId = "view-" + viewName;
        if (viewName === "system") {
            targetViewId = "view-system-simple";
        }
        
        // Admin/Dashboard siempre usa la versión simple dentro del nuevo layout
        if (viewName === 'admin') {
            targetViewId = "view-admin-simple";
        }
        
        const target = document.getElementById(targetViewId);
        if (target) target.classList.remove('hidden');

        // 3. Actualizar Sidebar Tabs (Visual)
        document.querySelectorAll('#sidebar-nav button').forEach(b => b.classList.remove('active', 'bg-primary', 'text-white'));
        const activeBtn = document.getElementById('nav-btn-' + viewName);
        if (activeBtn) activeBtn.classList.add('active', 'bg-primary', 'text-white');

        // Mostrar sección de evento en sidebar si hay un evento cargado
        const evSection = document.getElementById('nav-section-event');
        if (evSection) evSection.classList.toggle('hidden', !this.state.event);
        
        // El selector de eventos siempre está en la sección Production
        window.scrollTo(0, 0);
    },

    navigate(viewName, params = {}, push = true) {
        if (push) {
            const url = viewName === 'my-events' ? '/' : `/${viewName}`;
            history.pushState({ view: viewName, params }, '', url);
        }
        this.showView(viewName);
        
        if (viewName === 'my-events') this.loadEvents();
        if (viewName === 'system') {
            window.switchSystemTab('users');
        }
        if (viewName === 'legal') {
            App.loadLegalTexts();
        }
        if (viewName === 'account') {
            // Mi Cuenta se muestra directamente
        }
        if (viewName === 'groups') this.loadGroups();
    },

    initRouter() {
        window.onpopstate = (e) => {
            if (e.state && e.state.view) {
                this.navigate(e.state.view, e.state.params, false);
            } else {
                this.navigate('my-events', {}, false);
            }
        };
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
        console.log("CHECK V9.3: Cerrando sesión segura.");
        localStorage.removeItem('user');
        this.state.user = null;
        this.showView('login');
    },
    async loadAppVersion() {
        try {
            const d = await fetch('/api/app-version').then(r => r.json());
            this.state.version = d.version;
            document.querySelectorAll('.app-version-label').forEach(el => el.innerText = `Check Pro V${d.version}`);
        } catch(e) {}
    },

    // --- DATA LOADERS ---
    async loadEvents() {
        try {
            this.state.events = await this.fetchAPI('/events');
            
            const btnAdminNav = document.getElementById('nav-btn-admin');
            if (btnAdminNav) {
                btnAdminNav.classList.toggle('hidden', !this.state.user || this.state.user.role !== 'ADMIN');
            }

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
        this.state.event = this.state.events.find(e => String(e.id) === String(id));
        if (!this.state.event) return console.error("Evento no encontrado:", id);

        // Persistir evento seleccionado
        localStorage.setItem('selected_event_id', String(id));
        localStorage.setItem('selected_event_name', this.state.event.name);

        this.navigate('admin', { id });
        
        const tit = document.getElementById('admin-event-title');
        const loc = document.getElementById('admin-event-location');
        if (tit) tit.innerText = this.state.event.name;
        if (loc) loc.innerText = this.state.event.location;
        this.loadGuests();
        this.updateStats();
        if (this.state.socket) this.state.socket.emit('join_event', id);
    },
    
    // Restaurar evento desde localStorage
    restoreSelectedEvent() {
        const savedEventId = localStorage.getItem('selected_event_id');
        const savedEventName = localStorage.getItem('selected_event_name');
        
        if (savedEventId && this.state.events.length > 0) {
            const event = this.state.events.find(e => String(e.id) === String(savedEventId));
            if (event) {
                console.log("Restaurando evento:", event.name);
                this.state.event = event;
                const tit = document.getElementById('admin-event-title');
                const loc = document.getElementById('admin-event-location');
                if (tit) tit.innerText = event.name;
                if (loc) loc.innerText = event.location;
                this.navigate('admin', { id: event.id });
                this.loadGuests();
                this.updateStats();
                return true;
            }
        }
        return false;
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
    
    async handleImport(file) {
        if (!file || !this.state.event) return alert("Selecciona un evento primero.");
        const formData = new FormData();
        formData.append('file', file);
        formData.append('event_id', this.state.event.id);

        try {
            const headers = {};
            if (this.state.user) headers['x-user-id'] = this.state.user.userId;
            const res = await fetch('/api/import-preview', { method: 'POST', body: formData, headers });
            const data = await res.json();
            if (data.success) {
                this.state.importData = data;
                const modal = document.getElementById('modal-import-results');
                const content = document.getElementById('import-summary-content');
                if (content) {
                    content.innerHTML = `
                        <div class="grid grid-cols-3 gap-4">
                            <div class="p-4 bg-slate-900 rounded-2xl border border-white/5 text-center">
                                <p class="text-[10px] uppercase font-black text-slate-500 mb-1">Total Detectados</p>
                                <p class="text-2xl font-black">${data.total}</p>
                            </div>
                            <div class="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/10 text-center">
                                <p class="text-[10px] uppercase font-black text-emerald-500/60 mb-1">Se Importarán</p>
                                <p class="text-2xl font-black text-emerald-400">${data.valid}</p>
                            </div>
                            <div class="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/10 text-center">
                                <p class="text-[10px] uppercase font-black text-amber-500/60 mb-1">Duplicados</p>
                                <p class="text-2xl font-black text-amber-400">${data.total - data.valid}</p>
                            </div>
                        </div>
                        <p class="text-center text-slate-500 text-xs mt-4">Los duplicados se identifican por Email + Teléfono</p>
                    `;
                }
                modal?.classList.remove('hidden');
            } else { alert("Error al leer archivo: " + data.error); }
        } catch (e) { alert("Error de conexión al importar."); }
    }
};

// --- TAB SWITCHERS DEFINIDOS AL INICIO ---
const ALL_TAB_IDS = ['tab-users', 'tab-legal', 'tab-account'];
const ALL_SYS_IDS = ['sys-content-users', 'sys-content-legal', 'sys-content-account'];

window.switchSystemTab = function(tabName) {
    console.log('CHECK V10.3: switchSystemTab ->', tabName);
    ALL_SYS_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('#view-system .nav-tab-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'active');
        b.classList.add('text-slate-400');
    });

    const panel = document.getElementById('sys-content-' + tabName);
    if (panel) panel.classList.remove('hidden');
    const activeBtn = document.getElementById('sys-nav-' + tabName);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('bg-primary', 'text-white', 'shadow-xl', 'active');
    }
    if (tabName === 'users') App.loadUsersTable();
    if (tabName === 'legal') App.loadLegalTexts();
};

window.switchAdminTab = function(tabName) {
    console.log('CHECK V10: switchAdminTab ->', tabName || 'dashboard');
    const mainDash = document.getElementById('admin-main-dashboard');
    if (mainDash) mainDash.style.display = 'none';
    ALL_TAB_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('#view-admin .nav-tab-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'active');
        b.classList.add('text-slate-400');
        b.style.background = '';
    });

    if (!tabName) {
        if (mainDash) mainDash.style.display = 'block';
        const dashBtn = document.getElementById('nav-tab-dashboard');
        if (dashBtn) dashBtn.classList.add('bg-primary', 'text-white', 'shadow-xl', 'active');
    } else {
        const panel = document.getElementById('tab-' + tabName);
        if (panel) panel.style.display = 'block';
        const activeBtn = document.querySelector('#view-admin [data-tab="' + tabName + '"]');
        if (activeBtn) activeBtn.classList.add('bg-primary', 'text-white', 'shadow-xl', 'active');
    }
};

// --- DOM READY BOOTSTRAP V10.2 ---
document.addEventListener('DOMContentLoaded', () => {
    // 0. Helpers Críticos (Hoisting manual)
    const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    // 0. Sync Version
    App.loadAppVersion();

    // 1. Restore Auth
    try {
        const s = localStorage.getItem('user');
        if (s && s !== "undefined" && s !== "null") window.App.state.user = JSON.parse(s);
    } catch(e){}

    // 2. ROUTING SPA ESTRICTO V10.3
    const path = window.location.pathname;
    
    // El registro vive ahora en registro.html, pero mantenemos una redirección por si acaso
    if (path.toLowerCase().endsWith('/registro')) {
        console.log("CHECK V10.3: Ruta de registro detectada. Redirigiendo a archivo aislado...");
        // Nota: server.js ya sirve registro.html directamente para estas rutas
    }

    // FLUJO PRINCIPAL: Login es siempre el punto de entrada
    if (App.state.user) {
        if (App.state.user.role === 'ADMIN') {
            console.log("CHECK V10.3: Acceso ADMIN detectado. Cargando Panel Global.");
            window.App.showView('system'); // Nueva vista global
            window.switchSystemTab('users'); // Inicializar pestaña
        } else {
            console.log("CHECK V10.3: Acceso STAFF detectado. Cargando Selector de Eventos.");
            App.loadEvents();
        }
    } else {
        App.showView('login');
    }

    // 3. Sockets
    if (typeof io !== 'undefined') {
        window.App.state.socket = io();
        window.App.state.socket.on('update_stats', (id) => { if (App.state.event?.id === id) App.updateStats(); });
        window.App.state.socket.on('checkin_update', () => App.loadGuests());
    }

    // Listeners System
    document.getElementById('sys-nav-users')?.addEventListener('click', () => switchSystemTab('users'));
    document.getElementById('sys-nav-legal')?.addEventListener('click', () => switchSystemTab('legal'));
    document.getElementById('sys-nav-account')?.addEventListener('click', () => switchSystemTab('account'));
    document.getElementById('sys-nav-events')?.addEventListener('click', () => App.loadEvents());

    document.getElementById('nav-tab-dashboard')?.addEventListener('click', () => switchAdminTab(null));
    document.querySelectorAll('#view-admin [data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
    });

    // 5. Listeners generales

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
                
                // Actualizar permisos UI
                App.updateUIPermissions();
                App.updateRoleOptions();
                
                if (d.role === 'ADMIN') {
                    App.navigate('system');
                    setTimeout(() => window.switchSystemTab('users'), 100);
                } else {
                    App.loadEvents();
                }
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
    cl('admin-global-nav-btn', () => App.showView('system'));
    
    cl('btn-delete-event', () => App.handleDeleteEvent());
    cl('btn-delete-event-sidebar', () => App.handleDeleteEvent());

    App.handleDeleteEvent = async () => {
        if (!App.state.event) return;
        if (!confirm(`☢️ ¿Seguro que deseas ELIMINAR el evento "${App.state.event.name}"? Esta acción es irreversible.`)) return;
        
        try {
            const res = await App.fetchAPI(`/events/${App.state.event.id}`, { method: 'DELETE' });
            if (res.success) {
                alert("✓ Evento eliminado.");
                App.state.event = null;
                App.navigate('my-events');
            }
        } catch { alert("No se pudo eliminar el evento."); }
    };

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
            doc.setFontSize(10); doc.setTextColor(124,58,237); doc.text(`REPORT V${App.state.version} | ${App.state.event.name.toUpperCase()}`, 15, 35);
            doc.autoTable({ startY: 60, head: [['Métrica', 'Valor']], body: [['Total Invitados', s.total],['Asistencia', s.checkedIn],['Presencia', (s.total > 0 ? Math.round((s.checkedIn/s.total)*100) : 0) + '%'],['No Show', s.total - s.checkedIn],['Organizaciones', s.orgs],['Alertas Médicas', s.healthAlerts||0]], theme: 'striped', headStyles: {fillColor:[124,58,237]}, styles:{fontSize:11,cellPadding:6} });
            doc.save(`Analitica_V${App.state.version}_${App.state.event.name.replace(/\s+/g,'_')}.pdf`);
        } catch(e) { alert("Error al generar PDF."); }
    });

    // Import listeners para nuevos botones del sidebar
    document.getElementById('admin-file-import-excel')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    document.getElementById('admin-file-import-pdf')?.addEventListener('change', e => { if(e.target.files[0]) App.handleImport(e.target.files[0]); });
    
    // QR Feedback
    cl('btn-show-qr', () => App.showQR());
    cl('close-qr', () => document.getElementById('modal-qr')?.classList.add('hidden'));

    App.showQR = async () => {
        if (!App.state.event) return alert("Selecciona un evento primero.");
        const url = `${window.location.origin}/register.html?event=${App.state.event.id}`;
        const qrEl = document.getElementById('qr-display');
        if (qrEl && typeof qrcode !== 'undefined') {
            const qrDataUrl = await qrcode.toDataURL(url, { width: 400, margin: 2 });
            qrEl.src = qrDataUrl;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        } else if (qrEl) {
            // Fallback: generar QR con Canvas API simple
            alert("Generando código QR...");
            qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        }
    };

    // Mailing (placeholder - implementar según necesidad)
    App.openMailing = () => {
        if (!App.state.event) return alert("Selecciona un evento primero.");
        alert("Módulo de Mailing en desarrollo. Aquí podrás enviar correos masivos a los invitados del evento.");
    };
    cl('btn-mailing', () => App.openMailing());

    // Listener para importación (Ya definido en App.handleImport)

    cl('btn-confirm-import', async () => {
        const btn = document.getElementById('btn-confirm-import');
        btn.innerText = "PROCESANDO..."; btn.disabled = true;
        try {
            const res = await App.fetchAPI('/import-confirm', { method: 'POST', body: JSON.stringify({ event_id: App.state.event.id }) });
            if (res.success) {
                alert(`✓ Importación exitosa: ${res.count} invitados añadidos.`);
                document.getElementById('modal-import-results')?.classList.add('hidden');
                App.loadGuests();
            } else { alert("Error: " + res.error); }
        } catch(e) { alert("Fallo en la importación."); }
        finally { btn.innerText = "PROCESAR E IMPORTAR AHORA"; btn.disabled = false; }
    });

    cl('close-import-modal', () => document.getElementById('modal-import-results')?.classList.add('hidden'));

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

    // 6. Inicialización V10.5
    const init = async () => {
        App.initRouter();
        App.loadAppVersion();
        
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try {
                App.state.user = JSON.parse(savedUser);
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                if (sbu) sbu.textContent = App.state.user.username || 'Usuario';
                if (sbr) sbr.textContent = App.state.user.role || 'Staff';
                
                // Cargar eventos y restaurar selección si existe
                await App.loadEvents();
                App.restoreSelectedEvent();
            } catch { App.logout(); }
        } else {
            App.showView('login');
        }

        // Clocks V10.5
        setInterval(() => {
            const ms = new Date();
            const s = ms.toLocaleTimeString('es-ES', {hour12: false});
            document.querySelectorAll('#events-list-clock, #admin-clock-real').forEach(e => e.innerText = s);
            if (App.state.event) {
                const eventDate = new Date(App.state.event.date);
                const diff = eventDate - ms;
                let cstr = "EVENTO ACTIVO";
                if (diff > 0) { 
                    const h = Math.floor(diff/3600000).toString().padStart(2,'0'); 
                    const min = Math.floor((diff%3600000)/60000).toString().padStart(2,'0'); 
                    const sec = Math.floor((diff%60000)/1000).toString().padStart(2,'0'); 
                    cstr = `${h}:${min}:${sec}`; 
                }
                const c1 = document.getElementById('admin-clock-countdown');
                if (c1) c1.innerText = cstr;
            }
        }, 1000);
    };
    init();

    // --- EVENT LISTERS FALTANTES (AGREGADOS V10.5.3) ---
    // Modal de Invitación
    cl('btn-open-invite', () => document.getElementById('modal-invite')?.classList.remove('hidden'));
    cl('btn-close-invite', () => document.getElementById('modal-invite')?.classList.add('hidden'));
    cl('btn-open-invite-admin', () => document.getElementById('modal-invite')?.classList.remove('hidden'));
    
    // Modal de Eventos
    cl('btn-create-event-open', () => {
        document.getElementById('ev-id-hidden').value = "";
        document.getElementById('new-event-form').reset();
        document.getElementById('modal-event')?.classList.remove('hidden');
    });
    cl('close-modal', () => document.getElementById('modal-event')?.classList.add('hidden'));

    // Form de crear evento
    sf('new-event-form', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('name', document.getElementById('ev-name').value);
        fd.append('date', document.getElementById('ev-date').value);
        fd.append('end_date', document.getElementById('ev-end-date').value);
        fd.append('location', document.getElementById('ev-location').value);
        fd.append('description', document.getElementById('ev-desc').value);
        const logo = document.getElementById('ev-logo-file').files[0];
        if (logo) fd.append('logo', logo);
        App.createEvent(fd);
    });

    // Form de invitación de usuario
    sf('invite-user-form', async (e) => {
        e.preventDefault();
        const displayName = document.getElementById('invite-display-name').value;
        const u = document.getElementById('invite-username').value;
        const p = document.getElementById('invite-password').value;
        const r = document.getElementById('invite-role').value;
        try {
            const res = await App.fetchAPI('/users/invite', { method: 'POST', body: JSON.stringify({username: u, password: p, role: r, display_name: displayName}) });
            if (res.success) { alert(`✓ Usuario "${displayName}" creado con rol ${r}.`); document.getElementById('invite-user-form').reset(); document.getElementById('modal-invite')?.classList.add('hidden'); App.loadUsersTable(); }
            else alert('Error: ' + (res.error || 'No se pudo crear el usuario.'));
        } catch { alert('Error de conexión.'); }
    });

    // Form de cambio de contraseña
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

    // ═══ GRUPOS V10.5 ═══
    cl('btn-create-group', async () => {
        const name = prompt('Nombre del grupo:');
        if (!name) return;
        const description = prompt('Descripción del grupo (opcional):');
        try {
            const res = await App.fetchAPI('/groups', { method: 'POST', body: JSON.stringify({ name, description }) });
            if (res.success) { alert('✓ Grupo creado'); App.loadGroups(); }
            else alert('Error: ' + res.error);
        } catch { alert('Error de conexión.'); }
    });
});

// Retrocompatibilidad
window.showView = (v) => App.showView(v);
window.logout = () => App.logout();

