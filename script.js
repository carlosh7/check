// MASTER SCRIPT V7.0 - ARQUITECTURA LIMPIA E INDUSTRIAL 🛡️🚀💎
console.log("CHECK V7.0: Iniciando Sistema Centralizado...");

// --- localStorage WRAPPER (soporta Tracking Prevention de Edge) ---
const LS = {
    get: (k) => { try { return localStorage.getItem(k); } catch(e) { console.warn('[LS] Error get:', k, e); return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { console.warn('[LS] Error set:', k, e); } },
    remove: (k) => { try { localStorage.removeItem(k); } catch(e) { console.warn('[LS] Error remove:', k, e); } }
};
console.log('[INIT] Script loaded, LS available');

// --- ANTI-FLASH: Ocultar app cuando la página se hace visible (prerender) ---
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const appEl = document.getElementById('app-container');
        if (appEl && !appEl.classList.contains('hidden')) {
            const savedUser = LS.get('user');
            if (!savedUser || savedUser === "undefined" || savedUser === "null") {
                appEl.classList.add('hidden');
                appEl.style.display = 'none';
            }
        }
    }
});

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
        quillEditor: null,
        editingTemplate: null,
        emailTemplates: [],
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
            LS.set('theme', 'light');
            if (icon) icon.textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            LS.set('theme', 'dark');
            if (icon) icon.textContent = 'dark_mode';
        }
    },
    
    checkVersion: async function() {
        try {
            const res = await this.fetchAPI('/app-version');
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = 'V' + res.version;
            }
            location.reload();
        } catch(e) {
            console.error('Error al verificar versión:', e);
        }
    },
    
    initTheme: function() {
        const saved = LS.get('theme') || 'dark';
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
    
    // Cargar empresas con usuarios
    loadGroups: async function() {
        if (!this.state.user || this.state.user.role !== 'ADMIN') return;
        try {
            const groups = await this.fetchAPI('/groups');
            const users = await this.fetchAPI('/users');
            this.state.groups = groups;
            this.state.allUsers = users;
            
            const tbody = document.getElementById('groups-tbody');
            if (tbody) {
                tbody.innerHTML = groups.map(g => {
                    const groupUsers = users.filter(u => u.group_id === g.id);
                    const userChips = groupUsers.map(u => `
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-white text-[10px] rounded-lg">
                            <span class="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-[8px] font-bold">${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}</span>
                            ${u.display_name || u.username}
                            <span class="text-[8px] text-slate-400">${u.role}</span>
                            <button onclick="App.removeUserFromGroup('${u.id}', '${g.id}')" class="w-4 h-4 flex items-center justify-center bg-red-500/30 hover:bg-red-500/50 text-red-400 hover:text-red-300 rounded-full text-[8px] font-bold">×</button>
                        </span>`).join('');
                    
                    return `
                    <tr class="hover:bg-white/[0.02] border-b border-white/5">
                        <td class="px-8 py-5">
                            <div class="font-bold text-base text-white">${g.name}</div>
                            <div class="text-[10px] text-slate-500 mt-1">${g.description || ''}</div>
                        </td>
                        <td class="px-8 py-5">
                            <div class="text-slate-400 text-sm">${g.email || '-'}</div>
                            <div class="text-slate-500 text-xs">${g.phone || ''}</div>
                        </td>
                        <td class="px-8 py-5 text-center"><span class="px-4 py-2 rounded-xl text-sm font-black ${g.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}">${g.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
                        <td class="px-8 py-5 text-center">
                            <div class="flex flex-wrap gap-1 max-w-[150px]">${userChips || '<span class="text-slate-500 text-xs">Sin usuarios</span>'}</div>
                            <div class="flex gap-1 mt-2">
                                <button onclick="App.showUserSelectorForGroup('${g.id}')" class="px-2 py-1 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-[10px] font-bold">+ Usuario</button>
                            </div>
                        </td>
                        <td class="px-8 py-5 text-right">
                            <div class="flex gap-2 justify-end">
                                <button onclick="App.openCompanyModal('${g.id}')" class="px-4 py-2 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-sm font-black">Editar</button>
                            </div>
                        </td>
                    </tr>`;
                }).join('');
            }
        } catch(e) { console.error('Error loading groups:', e); }
    },
    
    removeUserFromGroup: async function(userId, groupId) {
        if (!confirm('¿Quitar este usuario de la empresa?')) return;
        try {
            await this.fetchAPI(`/groups/${groupId}/users/${userId}`, { method: 'DELETE' });
            this.loadGroups();
        } catch(e) { console.error('Error removing user from group:', e); }
    },
    
    showUserSelectorForGroup: function(groupId) {
        const users = (this.state.allUsers || []).filter(u => u.group_id !== groupId);
        if (users.length === 0) {
            alert('No hay más usuarios disponibles para agregar.');
            return;
        }
        
        const options = users.map(u => `<option value="${u.id}">${u.display_name || u.username} (${u.role})</option>`).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-user-selector-group';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">person_add</span> Asignar Usuario a Empresa
                </h3>
                <select id="select-user-for-group" class="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-white/10 mb-4">
                    <option value="">-- Seleccionar usuario --</option>
                    ${options}
                </select>
                <div class="flex gap-3">
                    <button onclick="App.assignUserToGroupFromSelector('${groupId}')" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Asignar</button>
                    <button onclick="App.closeUserSelectorGroup()" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    assignUserToGroupFromSelector: async function(groupId) {
        const select = document.getElementById('select-user-for-group');
        const userId = select.value;
        if (!userId) return alert('Selecciona un usuario');
        
        try {
            const res = await this.fetchAPI(`/groups/${groupId}/users`, { 
                method: 'POST', 
                body: JSON.stringify({ userId, role_in_group: 'PRODUCTOR' }) 
            });
            if (res.success) {
                this.loadGroups();
                this.closeUserSelectorGroup();
            }
        } catch(e) { console.error('Error assigning user to group:', e); }
    },
    
    closeUserSelectorGroup: function() {
        document.getElementById('modal-user-selector-group')?.remove();
    },
    
    // --- EVENT USER MANAGEMENT V10.6 ---
    showUserSelectorForEvent: function(eventId) {
        const users = this.state.allUsers || [];
        const eventUsers = users.filter(u => u.events && u.events.includes(eventId));
        const assignedUserIds = eventUsers.map(u => u.id);
        const availableUsers = users.filter(u => !assignedUserIds.includes(u.id));
        
        if (availableUsers.length === 0) {
            alert('No hay más usuarios disponibles para agregar.');
            return;
        }
        
        const options = availableUsers.map(u => 
            `<option value="${u.id}">${u.display_name || u.username} (${u.role})</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-user-selector-event';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">group_add</span> Agregar Personal al Evento
                </h3>
                <select id="select-user-for-event" class="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-white/10 mb-4">
                    <option value="">-- Seleccionar usuario --</option>
                    ${options}
                </select>
                <div class="flex gap-3">
                    <button onclick="App.assignUserToEventFromSelector('${eventId}')" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Agregar</button>
                    <button onclick="App.closeUserSelectorEvent()" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    assignUserToEventFromSelector: async function(eventId) {
        const select = document.getElementById('select-user-for-event');
        const userId = select.value;
        if (!userId) return alert('Selecciona un usuario');
        
        const users = this.state.allUsers || [];
        const user = users.find(u => u.id === userId);
        const currentEvents = user?.events || [];
        
        try {
            const res = await this.fetchAPI(`/users/${userId}/events`, { 
                method: 'PUT', 
                body: JSON.stringify({ events: [...currentEvents, eventId] }) 
            });
            if (res.success) {
                // Recargar usuarios
                const users = await this.fetchAPI('/users');
                this.state.allUsers = users;
                this.loadUsersTable();
                this.closeUserSelectorEvent();
                alert('✓ Usuario agregado al evento');
            }
        } catch(e) { console.error('Error assigning user to event:', e); }
    },
    
    closeUserSelectorEvent: function() {
        document.getElementById('modal-user-selector-event')?.remove();
    },
    
    removeUserFromEvent: async function(userId, eventId) {
        if (!confirm('¿Quitar este usuario del evento?')) return;
        try {
            await this.fetchAPI(`/users/${userId}/events/${eventId}`, { method: 'DELETE' });
            // Recargar usuarios
            const users = await this.fetchAPI('/users');
            this.state.allUsers = users;
            this.loadUsersTable();
        } catch(e) { console.error('Error removing user from event:', e); }
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
        if (!this.state.user) return; // No renderizar si no hay sesión
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
                
                // Chips de empresa asignada
                const userGroup = groups.find(g => String(g.id) === String(u.group_id));
                const groupChip = userGroup ? `
                    <div class="flex items-center gap-1 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-white text-[10px] rounded-lg">
                            ${userGroup.name}
                            <button onclick="App.removeUserGroup('${u.id}')" class="w-4 h-4 flex items-center justify-center bg-red-500/30 hover:bg-red-500/50 text-red-400 hover:text-red-300 rounded-full text-[8px] font-bold ml-1" title="Quitar empresa">×</button>
                        </span>
                    </div>` : `<span class="text-[10px] text-slate-500">Sin empresa</span>`;
                const groupSelect = isAdmin && canEdit ? `
                    <div class="mb-2">${groupChip}</div>
                    <button onclick="App.showGroupSelector('${u.id}', '${userGroup?.id || ''}')" class="px-2 py-1 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-[10px] font-bold" title="Asignar empresa">+ Asignar</button>` : 
                    `<div class="mb-2">${groupChip}</div>`;
                
                // Chips de eventos asignados
                const userEvents = events.filter(e => u.events && u.events.map(ev => String(ev)).includes(String(e.id)));
                const eventChips = userEvents.map(e => 
                    `<span class="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-[10px] rounded-lg mb-1">
                        ${e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name}
                        <button onclick="App.removeUserEvent('${u.id}', '${e.id}')" class="w-4 h-4 flex items-center justify-center bg-red-500/30 hover:bg-red-500/50 text-red-400 hover:text-red-300 rounded-full text-[8px] font-bold ml-1" title="Quitar evento">×</button>
                    </span>`
                ).join('');
                const eventSelect = canEdit ? `
                    <div class="flex items-start gap-1">
                        <div class="flex flex-wrap gap-1">${eventChips || '<span class="text-[10px] text-slate-500">Sin eventos</span>'}</div>
                    </div>
                    <button onclick="App.showEventSelector('${u.id}', ${JSON.stringify(u.events || []).replace(/"/g, '&quot;')})" class="mt-1 px-2 py-1 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-[10px] font-bold" title="Agregar evento">+ Agregar</button>` : 
                    `<div class="flex flex-wrap gap-1">${eventChips || '<span class="text-[10px] text-slate-500">Sin eventos</span>'}</div>`;
                
                // Selector de rol
                const roleSelect = canEdit ? 
                    `<select onchange="App.changeUserRole('${u.id}', this.value)" class="bg-slate-800 text-white text-[11px] font-bold rounded-lg px-2 py-1.5 border border-white/10">
                        ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>` : 
                    `<span class="px-2 py-1.5 rounded-lg text-[11px] font-bold ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'PRODUCTOR' ? 'bg-primary/20 text-primary' : 'bg-slate-500/20 text-slate-300'}">${u.role}</span>`;
                
                // Badge de estado
                const statusLabel = u.status === 'APPROVED' ? 'Aprobado' : u.status === 'PENDING' ? 'Pendiente' : 'Rechazado';
                const statusBadge = `<span class="px-2 py-1.5 rounded-lg text-[11px] font-bold ${u.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : u.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}">${statusLabel}</span>`;
                
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
                                ${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-xs text-white">${u.display_name || u.username}</p>
                                    <span class="px-1.5 py-0.5 text-[8px] font-black rounded ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'PRODUCTOR' ? 'bg-primary/20 text-primary' : 'bg-slate-500/20 text-slate-400'}">${u.role}</span>
                                </div>
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
        if (!this.state.user) return; // No filtrar si no hay sesión
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
    
    // Quitar empresa de un usuario
    removeUserGroup: async function(userId) {
        if (!confirm('¿Quitar la empresa asignada a este usuario?')) return;
        try {
            const res = await this.fetchAPI(`/users/${userId}/group`, { 
                method: 'PUT', 
                body: JSON.stringify({ group_id: null }) 
            });
            if (res.success) {
                console.log('Empresa quitada');
                this.loadUsersTable();
            }
        } catch(e) { console.error('Error removing group:', e); }
    },
    
    // Quitar un evento específico de un usuario
    removeUserEvent: async function(userId, eventId) {
        try {
            const res = await this.fetchAPI(`/users/${userId}/events/${eventId}`, { method: 'DELETE' });
            if (res.success) {
                console.log('Evento quitado');
                this.loadUsersTable();
            }
        } catch(e) { console.error('Error removing event:', e); }
    },
    
    // Mostrar selector de empresas para asignar
    showGroupSelector: function(userId, currentGroupId) {
        const groups = this.state.allGroups || [];
        
        const options = groups.map(g => 
            `<option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>${g.name}</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-select-group';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">folder</span> Asignar Empresa
                </h3>
                <select id="select-group-target" class="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-white/10 mb-4">
                    <option value="">-- Seleccionar empresa --</option>
                    ${options}
                </select>
                <div class="flex gap-3">
                    <button onclick="App.assignUserGroupFromSelector('${userId}')" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Asignar</button>
                    <button onclick="App.navigateToCreateGroup('${userId}')" class="px-4 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">+ Crear</button>
                    <button onclick="App.closeGroupSelector()" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    navigateToCreateGroup: function(userId) {
        this.closeGroupSelector();
        this.navigate('groups');
    },
    
    assignUserGroupFromSelector: async function(userId) {
        const select = document.getElementById('select-group-target');
        const groupId = select.value;
        try {
            const res = await this.fetchAPI(`/users/${userId}/group`, { 
                method: 'PUT', 
                body: JSON.stringify({ group_id: groupId || null }) 
            });
            if (res.success) {
                this.loadUsersTable();
                this.closeGroupSelector();
            }
        } catch(e) { console.error('Error assigning group:', e); }
    },
    
    openCreateGroupModal: function() {
        const name = prompt('Nombre de la nueva empresa:');
        if (!name || !name.trim()) return;
        const description = prompt('Descripción (opcional):') || '';
        
        fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), description })
        }).then(r => r.json()).then(d => {
            if (d.success) {
                alert('✓ Empresa creada');
                this.loadGroups();
            }
        }).catch(() => alert('Error al crear empresa'));
    },
    
    closeGroupSelector: function() {
        document.getElementById('modal-select-group')?.remove();
    },
    
    // Mostrar selector de eventos para agregar
    showEventSelector: function(userId, currentEvents) {
        const events = this.state.allEvents || [];
        const assignedIds = currentEvents || [];
        const availableEvents = events.filter(e => !assignedIds.includes(e.id));
        
        if (availableEvents.length === 0) {
            alert('No hay más eventos disponibles para asignar.');
            return;
        }
        
        const options = availableEvents.map(e => 
            `<option value="${e.id}">${e.name}</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-select-event';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">event</span> Agregar Evento
                </h3>
                <select id="select-event-target" class="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-white/10 mb-4">
                    <option value="">-- Seleccionar evento --</option>
                    ${options}
                </select>
                <div class="flex gap-3">
                    <button onclick="App.assignEventFromSelector('${userId}')" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Agregar</button>
                    <button onclick="App.navigateToCreateEvent('${userId}')" class="px-4 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">+ Crear</button>
                    <button onclick="App.closeEventSelector()" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    navigateToCreateEvent: function(userId) {
        this.closeEventSelector();
        this.navigate('my-events');
        setTimeout(() => {
            document.getElementById('btn-create-event-open')?.click();
        }, 200);
    },
    
    assignEventFromSelector: async function(userId) {
        const select = document.getElementById('select-event-target');
        const eventId = select.value;
        if (!eventId) return alert('Selecciona un evento');
        
        // Obtener eventos actuales del usuario desde la tabla en pantalla
        const userRow = this.state.allUsers?.find(u => u.id === userId);
        const currentEvents = userRow?.events || [];
        
        try {
            // Enviar TODOS los eventos (los actuales + el nuevo)
            const res = await this.fetchAPI(`/users/${userId}/events`, { 
                method: 'PUT', 
                body: JSON.stringify({ events: [...currentEvents, eventId] }) 
            });
            if (res.success) {
                this.loadUsersTable();
                this.closeEventSelector();
            }
        } catch(e) { console.error('Error adding event:', e); }
    },
    
    closeEventSelector: function() {
        document.getElementById('modal-select-event')?.remove();
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
    
    async updateEvent(id, data) {
        try {
            const res = await this.fetchAPI(`/events/${id}`, { 
                method: 'PUT', 
                body: JSON.stringify(data)
            });
            if (res.success) {
                alert("✓ Evento actualizado.");
                document.getElementById('modal-event').classList.add('hidden');
                this.loadEvents();
            } else {
                alert("Error: " + res.error);
            }
        } catch (e) { alert("Error al actualizar evento."); }
    },
    
    // --- COMPANY CRUD V10.6 ---
    openCompanyModal: function(groupId = null) {
        const modal = document.getElementById('modal-company');
        document.getElementById('company-id-hidden').value = groupId || '';
        document.getElementById('company-form').reset();
        
        if (groupId) {
            const group = this.state.allGroups?.find(g => g.id === groupId);
            if (group) {
                document.getElementById('company-name').value = group.name || '';
                document.getElementById('company-description').value = group.description || '';
                document.getElementById('company-email').value = group.email || '';
                document.getElementById('company-phone').value = group.phone || '';
                document.getElementById('company-status').value = group.status || 'ACTIVE';
            }
        }
        
        modal?.classList.remove('hidden');
    },
    
    closeCompanyModal: function() {
        document.getElementById('modal-company')?.classList.add('hidden');
    },
    
    saveCompany: async function(data) {
        const groupId = document.getElementById('company-id-hidden').value;
        try {
            if (groupId) {
                await this.fetchAPI(`/groups/${groupId}`, { 
                    method: 'PUT', 
                    body: JSON.stringify(data)
                });
                alert('✓ Empresa actualizada');
            } else {
                await this.fetchAPI('/groups', { 
                    method: 'POST', 
                    body: JSON.stringify(data)
                });
                alert('✓ Empresa creada');
            }
            this.closeCompanyModal();
            this.loadGroups();
        } catch (e) { 
            console.error('Error saving company:', e);
            alert('Error al guardar empresa'); 
        }
    },
    
    // --- PROFILE V10.6 ---
    loadProfileData: async function() {
        if (!this.state.user) return;
        
        document.getElementById('profile-display-name').value = this.state.user.display_name || '';
        document.getElementById('profile-phone').value = this.state.user.phone || '';
        document.getElementById('profile-email').value = this.state.user.username || '';
        
        // Cargar empresas disponibles
        try {
            const groups = await this.fetchAPI('/groups');
            this.state.allGroups = groups;
            const select = document.getElementById('profile-company');
            if (select) {
                select.innerHTML = '<option value="">-- Sin empresa asignada --</option>' + 
                    groups.map(g => `<option value="${g.id}" ${g.id === this.state.user.group_id ? 'selected' : ''}>${g.name}</option>`).join('');
            }
        } catch (e) { console.error('Error loading groups:', e); }
    },
    
    saveProfile: async function(data) {
        try {
            const res = await this.fetchAPI(`/users/${this.state.user.userId}/profile`, { 
                method: 'PUT', 
                body: JSON.stringify(data)
            });
            if (res.success) {
                this.state.user = { ...this.state.user, ...data };
                LS.set('user', JSON.stringify(this.state.user));
                alert('✓ Perfil actualizado');
                this.loadProfileData();
            }
        } catch (e) { alert('Error al actualizar perfil'); }
    },
    
    // --- SMTP CONFIG V10.6 ---
    loadSMTPConfig: async function() {
        try {
            const config = await this.fetchAPI('/smtp-config');
            document.getElementById('smtp-host').value = config.smtp_host || '';
            document.getElementById('smtp-port').value = config.smtp_port || 587;
            document.getElementById('smtp-user').value = config.smtp_user || '';
            document.getElementById('smtp-pass').value = config.smtp_pass ? '***' : '';
            document.getElementById('smtp-secure').checked = config.smtp_secure == 1;
            document.getElementById('smtp-from-name').value = config.from_name || 'Check';
            document.getElementById('smtp-from-email').value = config.from_email || '';
        } catch (e) { console.error('Error loading SMTP config:', e); }
    },
    
    // --- IMAP CONFIG ---
    loadIMAPConfig: async function() {
        try {
            const config = await this.fetchAPI('/imap-config');
            document.getElementById('imap-host').value = config.imap_host || '';
            document.getElementById('imap-port').value = config.imap_port || 993;
            document.getElementById('imap-user').value = config.imap_user || '';
            document.getElementById('imap-pass').value = config.imap_pass ? '***' : '';
            document.getElementById('imap-tls').checked = config.imap_tls == 1;
        } catch (e) { console.error('Error loading IMAP config:', e); }
    },
    
    saveIMAPConfig: async function() {
        const data = {
            imap_host: document.getElementById('imap-host').value,
            imap_port: parseInt(document.getElementById('imap-port').value) || 993,
            imap_user: document.getElementById('imap-user').value,
            imap_pass: document.getElementById('imap-pass').value,
            imap_tls: document.getElementById('imap-tls').checked
        };
        try {
            await this.fetchAPI('/imap-config', { method: 'PUT', body: JSON.stringify(data) });
            alert('✓ Configuración IMAP guardada');
        } catch (e) { alert('Error al guardar configuración IMAP'); }
    },
    
    testIMAPConnection: async function() {
        const data = {
            imap_host: document.getElementById('imap-host').value,
            imap_port: parseInt(document.getElementById('imap-port').value) || 993,
            imap_user: document.getElementById('imap-user').value,
            imap_pass: document.getElementById('imap-pass').value,
            imap_tls: document.getElementById('imap-tls').checked
        };
        try {
            const result = await this.fetchAPI('/imap-test', { method: 'POST', body: JSON.stringify(data) });
            if (result.success) {
                alert('✓ Conexión IMAP exitosa');
            } else {
                alert('✗ Error: ' + (result.error || 'Desconocido'));
            }
        } catch (e) { alert('Error al probar conexión IMAP'); }
    },
    
    toggleEmailSection: function() {
        const submenu = document.getElementById('nav-email-submenu');
        const arrow = document.getElementById('email-section-arrow');
        if (submenu) {
            submenu.classList.toggle('hidden');
            if (arrow) {
                if (submenu.classList.contains('hidden')) {
                    arrow.style.transform = '';
                    arrow.textContent = 'chevron_right';
                } else {
                    arrow.style.transform = 'rotate(90deg)';
                    arrow.textContent = 'expand_more';
                }
            }
        }
    },
    
    toggleEmailAdminMenu: function() {
        const menu = document.getElementById('email-admin-menu');
        const arrow = document.getElementById('email-admin-arrow');
        if (menu) {
            menu.classList.toggle('hidden');
            if (arrow) {
                arrow.style.transform = menu.classList.contains('hidden') ? '' : 'rotate(180deg)';
            }
        }
    },
    
    // Cerrar menú al hacer clic afuera
    closeEmailAdminMenu: function() {
        const menu = document.getElementById('email-admin-menu');
        const arrow = document.getElementById('email-admin-arrow');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            if (arrow) arrow.style.transform = '';
        }
    },
    
    navigateEmailSection: function(section) {
        // Verificar que view-smtp esté visible, si no navegar
        const smtpView = document.getElementById('view-smtp');
        if (!smtpView || smtpView.classList.contains('hidden')) {
            this.navigate('smtp');
            // Esperar a que se cargue la vista antes de mostrar sección
            setTimeout(() => this._showEmailSection(section), 50);
            return;
        }
        
        this._showEmailSection(section);
    },
    
    _showEmailSection: function(section) {
        // Ocultar todos los contenidos de email
        document.querySelectorAll('.email-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.email-nav-btn').forEach(el => {
            el.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl');
            el.classList.add('bg-white/5', 'text-slate-400');
        });
        
        // Mostrar el contenido seleccionado
        const content = document.getElementById('email-content-' + section);
        const navBtn = document.getElementById('email-nav-' + section);
        if (content) content.classList.remove('hidden');
        if (navBtn) {
            navBtn.classList.remove('bg-white/5', 'text-slate-400');
            navBtn.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl');
        }
        
        // Guardar preferencia en localStorage
        LS.set('email_admin_section', section);
        
        // Cargar datos según sección
        if (section === 'config') {
            App.loadSMTPConfig();
            App.loadIMAPConfig();
        } else if (section === 'templates') {
            App.loadEmailTemplates();
        }
    },
    
    showCreateTemplateModal: function() {
        this.state.editingTemplate = null;
        document.getElementById('template-editor-title').textContent = 'Nueva Plantilla';
        document.getElementById('tpl-name').value = '';
        document.getElementById('tpl-subject').value = '';
        this._initTemplateEditor();
        document.getElementById('modal-template-editor').classList.remove('hidden');
        this.switchTemplateEditorTab('visual');
    },
    
    showTemplateEditor: function(templateId, templateName) {
        const template = this.state.emailTemplates?.find(t => t.id === templateId);
        if (!template) {
            return alert('Plantilla no encontrada. Recarga la página.');
        }
        this.state.editingTemplate = template;
        document.getElementById('template-editor-title').textContent = 'Editar: ' + (template.name || templateName);
        document.getElementById('tpl-name').value = template.name || '';
        document.getElementById('tpl-subject').value = template.subject || '';
        document.getElementById('modal-template-editor').classList.remove('hidden');
        this._initTemplateEditor(template.body || '');
        this.switchTemplateEditorTab('visual');
    },
    
    closeTemplateEditor: function() {
        document.getElementById('modal-template-editor')?.classList.add('hidden');
        if (this.state.quillEditor) {
            this.state.quillEditor = null;
        }
    },
    
    _initTemplateEditor: function(initialHtml) {
        console.log('[QUILL] initTemplateEditor called, existing editor:', !!this.state.quillEditor);
        const container = document.getElementById('tpl-quill-editor');
        if (this.state.quillEditor) {
            console.log('[QUILL] destroying existing editor');
            try { this.state.quillEditor.destroy(); } catch(e) {}
            this.state.quillEditor = null;
        }
        if (container) {
            container.innerHTML = '';
        }
        
        this.state.quillEditor = new Quill('#tpl-quill-editor', {
            theme: 'snow',
            placeholder: 'Escribe el contenido de tu email aquí...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
        if (initialHtml) {
            this.state.quillEditor.clipboard.dangerouslyPasteHTML(initialHtml);
        }
        this._loadVariablesPalette();
    },
    
    _loadVariablesPalette: function() {
        const isEvent = this.state.editingTemplate?.event_id;
        const vars = isEvent 
            ? ['{{guest_name}}', '{{guest_email}}', '{{event_name}}', '{{event_date}}', '{{event_location}}', '{{agenda}}', '{{qr_code}}', '{{checkin_time}}']
            : ['{{user_name}}', '{{email}}', '{{password}}', '{{role}}', '{{company_name}}', '{{login_url}}', '{{reset_url}}', '{{reset_code}}'];
        
        const palette = document.getElementById('tpl-variables-palette');
        if (!palette) return;
        
        palette.innerHTML = vars.map(v => 
            `<button onclick="App.insertVariable('${v}')" class="px-2 py-1 bg-slate-800/60 hover:bg-primary/20 hover:text-primary text-slate-400 rounded-lg text-[10px] font-mono font-bold border border-white/5 transition-all">${v}</button>`
        ).join('');
    },
    
    insertVariable: function(varName) {
        if (this.state.quillEditor) {
            const range = this.state.quillEditor.getSelection(true);
            this.state.quillEditor.insertText(range.index, varName);
            this.state.quillEditor.setSelection(range.index + varName.length);
            this.state.quillEditor.focus();
        } else {
            const ta = document.getElementById('tpl-code-editor');
            if (ta) {
                const start = ta.selectionStart;
                ta.value = ta.value.substring(0, start) + varName + ta.value.substring(start);
                ta.selectionStart = ta.selectionEnd = start + varName.length;
                ta.focus();
            }
        }
    },
    
    switchTemplateEditorTab: function(tab) {
        const tabs = ['visual', 'code', 'preview'];
        tabs.forEach(t => {
            document.getElementById('tab-btn-' + t)?.classList.remove('bg-primary', 'text-white', 'shadow');
            document.getElementById('tab-btn-' + t)?.classList.add('bg-white/5', 'text-slate-400');
        });
        
        const activeTab = document.getElementById('tab-btn-' + tab);
        if (activeTab) {
            activeTab.classList.remove('bg-white/5', 'text-slate-400');
            activeTab.classList.add('bg-primary', 'text-white', 'shadow');
        }
        
        document.getElementById('editor-visual-container')?.classList.add('hidden');
        document.getElementById('editor-code-container')?.classList.add('hidden');
        document.getElementById('editor-preview-container')?.classList.add('hidden');
        
        if (tab === 'visual') {
            document.getElementById('editor-visual-container')?.classList.remove('hidden');
            setTimeout(() => this.state.quillEditor?.focus(), 50);
        } else if (tab === 'code') {
            document.getElementById('editor-code-container')?.classList.remove('hidden');
            const body = this.state.quillEditor ? this.state.quillEditor.root.innerHTML : (this.state.editingTemplate?.body || '');
            document.getElementById('tpl-code-editor').value = body;
            setTimeout(() => document.getElementById('tpl-code-editor')?.focus(), 50);
        } else if (tab === 'preview') {
            document.getElementById('editor-preview-container')?.classList.remove('hidden');
            this._updateTemplatePreview();
        }
    },
    
    _updateTemplatePreview: function() {
        const body = this.state.quillEditor ? this.state.quillEditor.root.innerHTML : document.getElementById('tpl-code-editor')?.value || '';
        const subject = document.getElementById('tpl-subject').value || 'Vista Previa';
        const name = document.getElementById('tpl-name').value || 'Plantilla';
        
        const preview = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;padding:20px;margin:0;background:#f0f0f0;}table{background:white;width:100%;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);}td{padding:30px;}</style></head><body><table><tr><td>${body}</td></tr></table></body></html>`;
        
        const iframe = document.getElementById('tpl-preview-frame');
        if (iframe) {
            iframe.srcdoc = preview;
        }
    },
    
    saveTemplate: async function() {
        const name = document.getElementById('tpl-name').value.trim();
        const subject = document.getElementById('tpl-subject').value.trim();
        const body = this.state.quillEditor ? this.state.quillEditor.root.innerHTML : document.getElementById('tpl-code-editor')?.value || '';
        
        if (!name) return alert('Ingresa un nombre para la plantilla.');
        if (!subject) return alert('Ingresa el asunto del email.');
        
        try {
            const tpl = this.state.editingTemplate;
            if (tpl) {
                await this.fetchAPI(`/email-templates/${tpl.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, subject, body })
                });
            } else {
                await this.fetchAPI('/email-templates', {
                    method: 'POST',
                    body: JSON.stringify({ name, subject, body })
                });
            }
            alert('✓ Plantilla guardada');
            this.closeTemplateEditor();
            this.loadEmailTemplates();
        } catch (e) { 
            alert('Error al guardar plantilla: ' + e.message); 
        }
    },
    
    syncEmails: function() {
        alert('Sincronizar correos - FASE 4');
    },
    
    switchEmailService: function(service) {
        // Ocultar todos los formularios y tabs
        document.querySelectorAll('.email-form').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.email-service-tab').forEach(el => {
            el.classList.remove('bg-primary', 'text-white', 'shadow-xl');
            el.classList.add('bg-white/5', 'text-slate-400');
        });
        
        // Mostrar el formulario seleccionado
        const form = document.getElementById('form-' + service);
        const tab = document.getElementById('tab-btn-' + service);
        if (form) form.classList.remove('hidden');
        if (tab) {
            tab.classList.remove('bg-white/5', 'text-slate-400');
            tab.classList.add('bg-primary', 'text-white', 'shadow-xl');
        }
    },
    
    loadEmailTemplates: async function() {
        try {
            console.log("[DEBUG] Loading templates, user:", this.state.user);
            const templates = await this.fetchAPI('/email-templates');
            console.log("[DEBUG] Templates loaded:", templates);
            this.state.emailTemplates = templates; // Guardar en estado
            
            const container = document.getElementById('email-templates-list');
            if (container) {
                if (templates && templates.length > 0) {
                    container.innerHTML = templates.map(t => `
                        <div class="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                            <div class="flex items-center justify-between mb-2">
                                <h5 class="font-bold text-white text-sm">${t.name}</h5>
                                <span class="px-2 py-1 rounded text-[8px] font-black ${t.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}">${t.is_active ? 'Activo' : 'Inactivo'}</span>
                            </div>
                            <p class="text-xs text-slate-400 mb-3"><strong>Asunto:</strong> ${t.subject || 'Sin asunto'}</p>
                            <button onclick="App.showTemplateEditor('${t.id}', '${(t.name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg text-xs font-bold">Editar Plantilla</button>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p class="text-slate-500 text-center py-8">No hay plantillas configuradas.</p>';
                }
            }
        } catch (e) { 
            console.error('[ERROR] loadEmailTemplates:', e); 
            const container = document.getElementById('email-templates-list');
            if (container) {
                container.innerHTML = `<p class="text-red-400 text-center py-8">Error al cargar plantillas: ${e.message}</p>`;
            }
        }
    },
    
    // --- EVENT EMAIL CONFIG V10.6 ---
    currentEventId: null,
    
    openEventEmailConfig: function() {
        const eventId = document.getElementById('ev-id-hidden').value;
        if (!eventId) return alert('Guarda el evento primero');
        
        this.currentEventId = eventId;
        const event = this.state.events?.find(e => String(e.id) === String(eventId));
        document.getElementById('email-event-name').textContent = event?.name || 'Evento';
        
        // Load config
        this.loadEventEmailConfig(eventId);
        this.loadEventEmailTemplates(eventId);
        this.loadEventAgenda(eventId);
        
        document.getElementById('modal-event-email')?.classList.remove('hidden');
    },
    
    closeEventEmailConfig: function() {
        document.getElementById('modal-event-email')?.classList.add('hidden');
        this.currentEventId = null;
    },
    
    switchEmailTab: function(tab) {
        document.querySelectorAll('.email-tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + tab)?.classList.add('active');
        document.querySelectorAll('.email-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('content-' + tab)?.classList.remove('hidden');
    },
    
    loadEventEmailConfig: async function(eventId) {
        try {
            const config = await this.fetchAPI(`/events/${eventId}/email-config`);
            document.getElementById('ev-smtp-enabled').checked = config.enabled == 1;
            document.getElementById('ev-smtp-host').value = config.smtp_host || '';
            document.getElementById('ev-smtp-port').value = config.smtp_port || 587;
            document.getElementById('ev-smtp-secure').checked = config.smtp_secure == 1;
            document.getElementById('ev-smtp-user').value = config.smtp_user || '';
            document.getElementById('ev-smtp-pass').value = config.smtp_pass || '';
            document.getElementById('ev-smtp-from-name').value = config.from_name || '';
            document.getElementById('ev-smtp-from-email').value = config.from_email || '';
        } catch (e) { console.error('Error loading event email config:', e); }
    },
    
    saveEventEmailConfig: async function() {
        const eventId = this.currentEventId;
        const data = {
            smtp_host: document.getElementById('ev-smtp-host').value,
            smtp_port: parseInt(document.getElementById('ev-smtp-port').value) || 587,
            smtp_user: document.getElementById('ev-smtp-user').value,
            smtp_pass: document.getElementById('ev-smtp-pass').value,
            smtp_secure: document.getElementById('ev-smtp-secure').checked,
            from_name: document.getElementById('ev-smtp-from-name').value,
            from_email: document.getElementById('ev-smtp-from-email').value,
            enabled: document.getElementById('ev-smtp-enabled').checked
        };
        
        try {
            await this.fetchAPI(`/events/${eventId}/email-config`, { 
                method: 'PUT', 
                body: JSON.stringify(data) 
            });
            alert('✓ Configuración SMTP guardada');
        } catch (e) { alert('Error al guardar configuración'); }
    },
    
    testEventEmail: async function() {
        const testEmail = prompt('Ingresa un email de prueba:');
        if (!testEmail) return;
        
        try {
            const res = await this.fetchAPI(`/events/${this.currentEventId}/email-test`, {
                method: 'POST',
                body: JSON.stringify({ test_email: testEmail })
            });
            if (res.success) {
                alert('✓ Email de prueba enviado (revisa la consola del servidor)');
            } else {
                alert('Error: ' + (res.error || 'No se pudo enviar'));
            }
        } catch (e) { alert('Error al probar conexión'); }
    },
    
    loadEventEmailTemplates: async function(eventId) {
        try {
            const templates = await this.fetchAPI(`/events/${eventId}/email-templates`);
            this.state.eventEmailTemplates = templates;
            
            const container = document.getElementById('event-email-templates-list');
            if (container) {
                const templateNames = {
                    'registration_confirm': 'Confirmación de registro',
                    'checkin_welcome': 'Bienvenida con agenda',
                    'event_thanks': 'Agradecimiento post-evento',
                    'suggestion_request': 'Solicitud de sugerencias'
                };
                
                const autoLabels = {
                    'registration_confirm': 'Al registrarse',
                    'checkin_welcome': 'Al hacer check-in',
                    'event_thanks': 'Post-evento',
                    'suggestion_request': '1 día después'
                };
                
                container.innerHTML = templates.map(t => `
                    <div class="template-editor">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h5 class="font-bold text-white">${templateNames[t.template_type] || t.template_type}</h5>
                                <div class="flex items-center gap-2 mt-1">
                                    <label class="flex items-center gap-1 text-xs">
                                        <input type="checkbox" ${t.is_active == 1 ? 'checked' : ''} onchange="App.toggleEventTemplateActive('${t.template_type}', this.checked)">
                                        <span class="text-slate-400">Activo</span>
                                    </label>
                                    <label class="flex items-center gap-1 text-xs">
                                        <input type="checkbox" ${t.auto_send == 1 ? 'checked' : ''} onchange="App.toggleEventTemplateAutoSend('${t.template_type}', this.checked)">
                                        <span class="text-primary">Auto ${autoLabels[t.template_type] || ''}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div>
                                <label class="text-[10px] font-black uppercase text-slate-500 ml-2">Asunto</label>
                                <input type="text" id="ev-tpl-subject-${t.template_type}" value="${t.subject || ''}" class="input-field bg-slate-800/50 text-sm" placeholder="Asunto del email">
                            </div>
                            <div>
                                <label class="text-[10px] font-black uppercase text-slate-500 ml-2">Cuerpo (HTML)</label>
                                <textarea id="ev-tpl-body-${t.template_type}" rows="6" class="input-field bg-slate-800/50 text-xs resize-none">${t.body || ''}</textarea>
                            </div>
                            <div class="text-[10px] text-slate-500">
                                Variables: {{guest_name}}, {{guest_email}}, {{event_name}}, {{event_date}}, {{event_location}}, {{checkin_time}}, {{agenda}}, {{organization}}
                            </div>
                            <button onclick="App.saveEventEmailTemplate('${t.template_type}')" class="w-full py-2 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg text-xs font-bold">Guardar Plantilla</button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) { console.error('Error loading event templates:', e); }
    },
    
    saveEventEmailTemplate: async function(templateType) {
        const eventId = this.currentEventId;
        const subject = document.getElementById(`ev-tpl-subject-${templateType}`)?.value || '';
        const body = document.getElementById(`ev-tpl-body-${templateType}`)?.value || '';
        
        try {
            await this.fetchAPI(`/events/${eventId}/email-templates/${templateType}`, {
                method: 'PUT',
                body: JSON.stringify({ subject, body })
            });
            alert('✓ Plantilla guardada');
        } catch (e) { alert('Error al guardar plantilla'); }
    },
    
    toggleEventTemplateActive: async function(templateType, isActive) {
        const eventId = this.currentEventId;
        const template = this.state.eventEmailTemplates?.find(t => t.template_type === templateType);
        if (!template) return;
        
        try {
            await this.fetchAPI(`/events/${eventId}/email-templates/${templateType}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    subject: template.subject, 
                    body: template.body,
                    is_active: isActive ? 1 : 0,
                    auto_send: template.auto_send
                })
            });
        } catch (e) { console.error('Error toggling template:', e); }
    },
    
    toggleEventTemplateAutoSend: async function(templateType, autoSend) {
        const eventId = this.currentEventId;
        const template = this.state.eventEmailTemplates?.find(t => t.template_type === templateType);
        if (!template) return;
        
        try {
            await this.fetchAPI(`/events/${eventId}/email-templates/${templateType}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    subject: template.subject, 
                    body: template.body,
                    is_active: template.is_active,
                    auto_send: autoSend ? 1 : 0
                })
            });
        } catch (e) { console.error('Error toggling auto send:', e); }
    },
    
    // Agenda
    loadEventAgenda: async function(eventId) {
        try {
            const agenda = await this.fetchAPI(`/events/${eventId}/agenda`);
            this.state.eventAgenda = agenda;
            this.renderEventAgenda(agenda);
        } catch (e) { console.error('Error loading agenda:', e); }
    },
    
    renderEventAgenda: function(agenda) {
        const container = document.getElementById('event-agenda-list');
        if (!container) return;
        
        container.innerHTML = agenda.map((item, index) => `
            <div class="agenda-item flex gap-3 items-start" data-index="${index}">
                <div class="flex-1 grid grid-cols-4 gap-2">
                    <input type="time" value="${item.start_time || ''}" data-field="start_time" class="w-28">
                    <input type="time" value="${item.end_time || ''}" data-field="end_time" class="w-28">
                    <input type="text" value="${item.title || ''}" data-field="title" placeholder="Título" class="flex-1">
                    <input type="text" value="${item.speaker || ''}" data-field="speaker" placeholder="Ponente" class="flex-1">
                </div>
                <button onclick="this.parentElement.remove()" class="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `).join('');
    },
    
    addAgendaItem: function() {
        const container = document.getElementById('event-agenda-list');
        const index = container.children.length;
        const div = document.createElement('div');
        div.className = 'agenda-item flex gap-3 items-start';
        div.dataset.index = index;
        div.innerHTML = `
            <div class="flex-1 grid grid-cols-4 gap-2">
                <input type="time" value="" data-field="start_time" class="w-28">
                <input type="time" value="" data-field="end_time" class="w-28">
                <input type="text" value="" data-field="title" placeholder="Título" class="flex-1">
                <input type="text" value="" data-field="speaker" placeholder="Ponente" class="flex-1">
            </div>
            <button onclick="this.parentElement.remove()" class="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg">
                <span class="material-symbols-outlined text-sm">delete</span>
            </button>
        `;
        container.appendChild(div);
    },
    
    saveEventAgenda: async function() {
        const eventId = this.currentEventId;
        const items = [];
        
        document.querySelectorAll('#event-agenda-list .agenda-item').forEach(div => {
            const item = {};
            div.querySelectorAll('input').forEach(input => {
                item[input.dataset.field] = input.value;
            });
            if (item.title) items.push(item);
        });
        
        try {
            await this.fetchAPI(`/events/${eventId}/agenda`, {
                method: 'PUT',
                body: JSON.stringify({ agenda_items: items })
            });
            alert('✓ Agenda guardada');
        } catch (e) { alert('Error al guardar agenda'); }
    },
    
    // --- CORE NAV V10.5 (SPA Routing) ---
    showView(viewName, clearSession = false) {
        
        // 0. Verificar sesión solo si no hay usuario en estado
        if (viewName !== 'login') {
            if (!this.state.user) {
                const savedUser = LS.get('user');
                if (!savedUser || savedUser === "undefined" || savedUser === "null") {
                    viewName = 'login';
                } else {
                    try {
                        this.state.user = JSON.parse(savedUser);
                    } catch(e) {
                        viewName = 'login';
                    }
                }
            }
        }
        
        // 1. Mostrar/Ocultar Contenedores Principales
        const isLogin = viewName === 'login';
        const loginEl = document.getElementById('view-login');
        const appEl = document.getElementById('app-container');
        
        if (isLogin) {
            // Solo limpiar sesión si es un logout explícito
            if (clearSession) {
                LS.remove('user');
                LS.remove('selected_event_id');
                LS.remove('selected_event_name');
                this.state.user = null;
                this.state.event = null;
            }
            
            // Mostrar login, ocultar app
            if (loginEl) { 
                loginEl.classList.remove('hidden'); 
                loginEl.style.display = 'flex'; 
            }
            if (appEl) { 
                appEl.classList.add('hidden'); 
                appEl.style.display = 'none'; 
            }
            return;
        } else {
            // Ocultar login, mostrar app
            if (loginEl) { loginEl.classList.add('hidden'); loginEl.style.display = 'none'; }
            if (appEl) { appEl.classList.remove('hidden'); appEl.style.display = 'flex'; }
        }

        // 2. Switchear vistas internas
        const viewIds = ["view-my-events", "view-admin", "view-admin-simple", "view-system", "view-system-simple", "view-groups", "view-legal", "view-account", "view-smtp"];
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
            App.loadProfileData();
        }
        if (viewName === 'groups') this.loadGroups();
        if (viewName === 'smtp') {
            const savedSection = LS.get('email_admin_section') || 'config';
            this.navigateEmailSection(savedSection);
        }
    },

    initRouter() {
        // Manejar navegación con el historial
        window.onpopstate = (e) => {
            const savedUser = LS.get('user');
            if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
                try {
                    const user = JSON.parse(savedUser);
                    if (user && (user.userId || user.token)) {
                        if (!this.state.user) {
                            this.state.user = user;
                        }
                        
                        if (e.state && e.state.view && e.state.view !== 'login') {
                            this.navigate(e.state.view, e.state.params || {}, false);
                            return;
                        }
                        
                        if (user.role === 'ADMIN') {
                            this.navigate('system', {}, false);
                            setTimeout(() => window.switchSystemTab('users'), 50);
                        } else {
                            this.navigate('my-events', {}, false);
                        }
                        return;
                    }
                } catch(e) {}
            }
            
            history.replaceState(null, '', '/');
            this.showView('login', true);
        };
        
    },

    // --- AUTH ---
    async fetchAPI(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.user) headers['x-user-id'] = this.state.user.userId;
        const url = `${this.constants.API_URL}${endpoint}`;
        console.log('[API] Request:', url, 'userId:', this.state.user?.userId);
        
        try {
            const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
            if (res.status === 401 || res.status === 403) throw new Error('Auth fail');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        } catch (e) {
            console.error('[API] Error:', url, e);
            if (e.message === 'Auth fail') this.logout();
            throw e;
        }
    },
    logout() {
        console.log("CHECK: Cerrando sesión segura.");
        LS.remove('user');
        LS.remove('selected_event_id');
        LS.remove('selected_event_name');
        this.state.user = null;
        this.state.event = null;
        // Remover app-shell si existe
        const appShell = document.getElementById('app-container');
        if (appShell) appShell.remove();
        this.showView('login', true);
    },
    
    // --- APP SHELL LOADER ---
    loadAppShell() {
        return new Promise((resolve, reject) => {
            console.log('[APP-SHELL] Cargando app-shell.html...');
            fetch('/app-shell.html')
                .then(res => res.text())
                .then(html => {
                    document.body.insertAdjacentHTML('beforeend', html);
                    console.log('[APP-SHELL] app-shell.html cargado exitosamente');
                    // Re-inicializar listeners después de cargar
                    this.attachAppListeners();
                    resolve();
                })
                .catch(err => {
                    console.error('[APP-SHELL] Error cargando app-shell:', err);
                    reject(err);
                });
        });
    },
    
    attachAppListeners() {
        // Re-attach critical listeners para elementos del app-shell
        const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
        const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        
        // Mostrar versión del servidor al cargar
        this.fetchAPI('/app-version').then(res => {
            const vd = document.getElementById('version-display');
            if (vd) vd.textContent = 'V' + res.version;
        }).catch(() => {});;
        
        // Navigation
        cl('sys-nav-users', () => window.switchSystemTab('users'));
        cl('sys-nav-legal', () => window.switchSystemTab('legal'));
        cl('sys-nav-account', () => window.switchSystemTab('account'));
        cl('sys-nav-events', () => this.loadEvents());
        
        // Legal modal
        cl('btn-open-policy', () => this.showLegalModal('policy'));
        cl('btn-open-terms', () => this.showLegalModal('terms'));
        cl('btn-close-legal', () => document.getElementById('modal-legal')?.classList.add('hidden'));
        
        // SMTP listeners
        cl('btn-test-smtp', async () => {
            alert('Función de prueba de conexión SMTP en desarrollo.');
        });
        
        // IMAP listeners
        cl('btn-test-imap', async () => {
            await this.testIMAPConnection();
        });
        sf('imap-form', async (e) => {
            e.preventDefault();
            await this.saveIMAPConfig();
        });
    },
    async loadAppVersion() {
        try {
            const d = await fetch('/api/app-version').then(r => r.json());
            this.state.version = d.version;
            document.querySelectorAll('.app-version-label').forEach(el => el.innerText = `Check Pro V${d.version}`);
            document.querySelectorAll('.app-version-text').forEach(el => el.innerText = `V${d.version}`);
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
            <div onclick="window.App.openEvent('${ev.id}')" class="glass-card p-6 rounded-[32px] hover:border-primary/40 transition-all border border-white/5 bg-slate-900/40 shadow-xl relative group cursor-pointer">
                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onclick="event.stopPropagation(); window.App.editEvent('${ev.id}')" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all" title="Editar">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="event.stopPropagation(); window.App.deleteEvent('${ev.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all" title="Eliminar">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
                <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-primary text-xl">event_available</span>
                </div>
                <h3 class="text-xl font-black mb-2 text-white font-display">${ev.name}</h3>
                <p class="text-slate-500 text-xs line-clamp-2 mb-4">${ev.description || 'Evento sin descripción.'}</p>
                <div class="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span class="material-symbols-outlined text-sm text-primary">location_on</span> ${ev.location || 'Consultar'}
                </div>
                <div class="mt-4 pt-4 border-t border-white/5">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] text-slate-500">${new Date(ev.date).toLocaleDateString('es-ES')}</span>
                        <button onclick="event.stopPropagation(); window.App.copyRegistrationLink('${ev.id}')" class="text-[10px] text-primary hover:text-primary/80 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">link</span> Link
                        </button>
                    </div>
                    <div class="flex gap-2 mt-2" onclick="event.stopPropagation()">
                        <button onclick="window.App.showUserSelectorForEvent('${ev.id}')" class="flex-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-sm">group_add</span> Personal
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Función para copiar link de registro
        window.App.copyRegistrationLink = (id) => {
            const link = `${window.location.origin}/registro.html?event=${id}`;
            navigator.clipboard.writeText(link).then(() => {
                alert('Link de registro copiado: ' + link);
            }).catch(() => {
                prompt('Copia este link:', link);
            });
        };
        
        window.App.editEvent = (id) => {
            const ev = this.state.events.find(e => String(e.id) === String(id));
            if (!ev) return;
            
            // Datos básicos
            document.getElementById('ev-id-hidden').value = ev.id;
            document.getElementById('ev-name').value = ev.name || '';
            document.getElementById('ev-location').value = ev.location || '';
            document.getElementById('ev-desc').value = ev.description || '';
            document.getElementById('ev-date').value = ev.date ? ev.date.slice(0, 16) : '';
            document.getElementById('ev-end-date').value = ev.end_date ? ev.end_date.slice(0, 16) : '';
            
            // Configuración de registro
            document.getElementById('ev-reg-title').value = ev.reg_title || '';
            document.getElementById('ev-reg-welcome').value = ev.reg_welcome_text || '';
            document.getElementById('ev-reg-success').value = ev.reg_success_message || '';
            document.getElementById('ev-reg-policy').value = ev.reg_policy || '';
            document.getElementById('ev-reg-phone').checked = ev.reg_show_phone !== 0;
            document.getElementById('ev-reg-org').checked = ev.reg_show_org !== 0;
            document.getElementById('ev-reg-position').checked = ev.reg_show_position === 1;
            document.getElementById('ev-reg-vegan').checked = ev.reg_show_vegan !== 0;
            document.getElementById('ev-reg-dietary').checked = ev.reg_show_dietary !== 0;
            document.getElementById('ev-reg-gender').checked = ev.reg_show_gender === 1;
            document.getElementById('ev-reg-agreement').checked = ev.reg_require_agreement !== 0;
            
            document.getElementById('modal-event')?.classList.remove('hidden');
        };
        
        window.App.deleteEvent = (id) => {
            if (!confirm('¿Eliminar este evento y todos sus datos?')) return;
            this.fetchAPI(`/events/${id}`, { method: 'DELETE' }).then(() => {
                this.loadEvents();
                alert('Evento eliminado');
            }).catch(e => alert('Error al eliminar: ' + e.message));
        };
    },
    async openEvent(id) {
        this.state.event = this.state.events.find(e => String(e.id) === String(id));
        if (!this.state.event) return console.error("Evento no encontrado:", id);

        // Persistir evento seleccionado
        LS.set('selected_event_id', String(id));
        LS.set('selected_event_name', this.state.event.name);

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
        const savedEventId = LS.get('selected_event_id');
        const savedEventName = LS.get('selected_event_name');
        
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
        
        const filterOrg = document.getElementById('filter-guest-org');
        if (filterOrg) {
            const orgs = [...new Set(this.state.guests.map(g => g.organization).filter(Boolean))];
            filterOrg.innerHTML = '<option value="">Todas las empresas</option>' + 
                orgs.map(o => `<option value="${o}">${o}</option>`).join('');
        }
        
        this.renderGuestsTarget(this.state.guests);
    },
    
    filterGuests() {
        const search = (document.getElementById('guest-search')?.value || '').toLowerCase();
        const org = document.getElementById('filter-guest-org')?.value || '';
        const status = document.getElementById('filter-guest-status')?.value || '';
        const gender = document.getElementById('filter-guest-gender')?.value || '';
        const vegan = document.getElementById('filter-guest-vegan')?.value || '';
        
        let filtered = this.state.guests.filter(g => {
            if (search) {
                const match = (g.name || '').toLowerCase().includes(search) ||
                    (g.email || '').toLowerCase().includes(search) ||
                    (g.phone || '').includes(search);
                if (!match) return false;
            }
            if (org && g.organization !== org) return false;
            if (status === 'acreditado' && !g.checked_in) return false;
            if (status === 'pendiente' && g.checked_in) return false;
            if (gender && g.gender !== gender) return false;
            if (vegan) {
                const isVegan = (g.dietary_notes || '').toLowerCase().includes('vegano');
                if (vegan === 'si' && !isVegan) return false;
                if (vegan === 'no' && isVegan) return false;
            }
            return true;
        });
        
        const countEl = document.getElementById('guest-count');
        if (countEl) countEl.textContent = `${filtered.length} invitados`;
        
        this.renderGuestsTarget(filtered);
    },
    
    renderGuestsTarget(list) {
        const tb = document.getElementById('guests-tbody');
        if (!tb) return;
        tb.innerHTML = list.map(g => {
            const isVegan = (g.dietary_notes || '').toLowerCase().includes('vegano');
            const hasAllergies = (g.dietary_notes || '').toLowerCase().includes('alergia');
            return `
            <tr class="hover:bg-white/2 transition-colors border-b border-white/5">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shadow-inner">
                            ${(g.name || 'I').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-sm text-white">${g.name || 'S/N'}</div>
                            <div class="text-[10px] text-slate-500">${g.email || '-'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-xs text-slate-400">${g.phone || '-'}</td>
                <td class="px-6 py-4 text-xs text-slate-400">${g.organization || '-'}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 rounded-lg text-[10px] font-black ${g.gender === 'M' ? 'bg-blue-500/20 text-blue-400' : g.gender === 'F' ? 'bg-pink-500/20 text-pink-400' : 'bg-slate-500/20 text-slate-400'}">${g.gender || '-'}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    ${isVegan ? '<span class="px-2 py-1 rounded-lg text-[10px] font-black bg-green-500/20 text-green-400">Sí</span>' : 
                    hasAllergies ? '<span class="px-2 py-1 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-400">Alergia</span>' : '-'}
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="window.App.toggleCheckin('${g.id}', ${g.checked_in})" class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${g.checked_in ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-slate-500 hover:text-white border border-white/10'}">
                        ${g.checked_in ? 'Acreditado' : 'Pendiente'}
                    </button>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-600 hover:text-white transition-all"><span class="material-symbols-outlined text-sm">edit</span></button>
                </td>
            </tr>`;
        }).join('');
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
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Helpers Críticos (Hoisting manual)
    const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    console.log('[DOM] DOMContentLoaded fired');
    
    // 0.5. QUITAR LOADING SCREEN
    const ls = document.getElementById('loading-screen');
    if (ls) ls.remove();

    // 1. RESTORE SESSION FIRST
    let savedUser = null;
    try {
        savedUser = LS.get('user');
    } catch(e) {
        console.warn("[AUTH] localStorage no disponible:", e);
    }
    console.log('[AUTH] savedUser:', savedUser ? 'EXISTS' : 'NULL', savedUser);
    
    if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
        try {
            const user = JSON.parse(savedUser);
            console.log('[AUTH] parsed user:', user);
            if (user && (user.userId || user.token)) {
                console.log('[AUTH] Valid session, loading app-shell for role:', user.role);
                window.App.state.user = user;
                
                // CARGAR APP-SHELL PRIMERO
                try {
                    await App.loadAppShell();
                } catch(err) {
                    console.error('[AUTH] Error cargando app-shell:', err);
                    App.showView('login');
                    return;
                }
                
                // Actualizar sidebar info
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                if (sbu) sbu.textContent = user.username || 'Usuario';
                if (sbr) sbr.textContent = user.role || 'Staff';
                
                // Ocultar login, mostrar app
                const loginEl = document.getElementById('view-login');
                if (loginEl) { loginEl.classList.add('hidden'); loginEl.style.display = 'none'; }
                
                if (user.role === 'ADMIN') {
                    App.showView('system');
                    App.updateUIPermissions();
                    App.updateRoleOptions();
                    setTimeout(() => window.switchSystemTab('users'), 100);
                } else {
                    App.loadEvents();
                }
            } else {
                console.log('[AUTH] No valid userId/token, showing login');
                App.showView('login');
            }
        } catch(e){ 
            console.warn("[AUTH] Error parseando usuario:", e);
            App.showView('login'); 
        }
    } else {
        console.log('[AUTH] No savedUser, showing login');
        App.showView('login');
    }

    // 2. Init router AFTER session restoration (no synthetic popstate)
    App.initRouter();

    // 2.5. Global click handler to close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#email-admin-dropdown')) {
            App.closeEmailAdminMenu();
        }
    });

    // 3. Sockets
    if (typeof io !== 'undefined') {
        window.App.state.socket = io();
        window.App.state.socket.on('update_stats', (id) => { if (App.state.event?.id === id) App.updateStats(); });
        window.App.state.socket.on('checkin_update', () => App.loadGuests());
    }

    // 4. Listeners System
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
        console.log("[LOGIN] Intentando login con:", u);
        try {
            const d = await App.fetchAPI('/login', { method: 'POST', body: JSON.stringify({username: u, password: p}) });
            console.log("[LOGIN] Respuesta:", d);
            if (d.success) { 
                App.state.user = d; LS.set('user', JSON.stringify(d));
                
                // CARGAR APP-SHELL PRIMERO
                try {
                    await App.loadAppShell();
                } catch(err) {
                    console.error('[LOGIN] Error cargando app-shell:', err);
                    alert('Error al cargar la aplicación.');
                    return;
                }
                
                // Actualizar sidebar info
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                if (sbu) sbu.textContent = d.username || 'Usuario';
                if (sbr) sbr.textContent = d.role || 'Staff';
                
                // Ocultar login, mostrar app
                const loginEl = document.getElementById('view-login');
                if (loginEl) { loginEl.classList.add('hidden'); loginEl.style.display = 'none'; }
                
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
        } catch (err) { 
            console.error("[LOGIN] Error:", err);
            alert('Error de conexión con el servidor.'); 
        }
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

    // Mailing - Abrir config de email del evento
    App.openMailing = () => {
        if (!App.state.event) return alert("Selecciona un evento primero.");
        document.getElementById('ev-id-hidden').value = App.state.event.id;
        App.openEventEmailConfig();
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
    
    // ------- V10.6: PERFIL -------
    sf('profile-form', async (e) => {
        e.preventDefault();
        const data = {
            display_name: document.getElementById('profile-display-name').value,
            phone: document.getElementById('profile-phone').value,
            group_id: document.getElementById('profile-company').value || null
        };
        await App.saveProfile(data);
    });
    
    // ------- V10.6: COMPANY -------
    cl('btn-create-group', () => App.openCompanyModal());
    sf('company-form', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('company-name').value,
            description: document.getElementById('company-description').value,
            email: document.getElementById('company-email').value,
            phone: document.getElementById('company-phone').value,
            status: document.getElementById('company-status').value
        };
        await App.saveCompany(data);
    });
    
    // ------- V10.6: SMTP -------
    sf('smtp-form', async (e) => {
        e.preventDefault();
        const data = {
            smtp_host: document.getElementById('smtp-host').value,
            smtp_port: parseInt(document.getElementById('smtp-port').value) || 587,
            smtp_user: document.getElementById('smtp-user').value,
            smtp_pass: document.getElementById('smtp-pass').value,
            smtp_secure: document.getElementById('smtp-secure').checked,
            from_name: document.getElementById('smtp-from-name').value,
            from_email: document.getElementById('smtp-from-email').value
        };
        try {
            await App.fetchAPI('/smtp-config', { method: 'PUT', body: JSON.stringify(data) });
            alert('✓ Configuración SMTP guardada');
        } catch (e) { alert('Error al guardar configuración'); }
    });
    
    cl('btn-test-smtp', async () => {
        alert('Función de prueba de conexión SMTP en desarrollo.');
    });
    
    // IMAP listeners
    cl('btn-test-imap', async () => {
        await App.testIMAPConnection();
    });
    
    sf('imap-form', async (e) => {
        e.preventDefault();
        await App.saveIMAPConfig();
    });

    // 6. Inicialización V10.5
    // Init removido - se usa DOMContentLoaded

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

    // Form de crear/editar evento
    sf('new-event-form', async (e) => {
        e.preventDefault();
        const eventId = document.getElementById('ev-id-hidden').value;
        
        if (eventId) {
            // Editar evento existente
            const data = {
                name: document.getElementById('ev-name').value,
                date: document.getElementById('ev-date').value,
                end_date: document.getElementById('ev-end-date').value,
                location: document.getElementById('ev-location').value,
                description: document.getElementById('ev-desc').value,
                reg_title: document.getElementById('ev-reg-title').value,
                reg_welcome_text: document.getElementById('ev-reg-welcome').value,
                reg_success_message: document.getElementById('ev-reg-success').value,
                reg_policy: document.getElementById('ev-reg-policy').value,
                reg_show_phone: document.getElementById('ev-reg-phone').checked,
                reg_show_org: document.getElementById('ev-reg-org').checked,
                reg_show_position: document.getElementById('ev-reg-position').checked,
                reg_show_vegan: document.getElementById('ev-reg-vegan').checked,
                reg_show_dietary: document.getElementById('ev-reg-dietary').checked,
                reg_show_gender: document.getElementById('ev-reg-gender').checked,
                reg_require_agreement: document.getElementById('ev-reg-agreement').checked
            };
            App.updateEvent(eventId, data);
        } else {
            // Crear nuevo evento
            const fd = new FormData();
            fd.append('name', document.getElementById('ev-name').value);
            fd.append('date', document.getElementById('ev-date').value);
            fd.append('end_date', document.getElementById('ev-end-date').value);
            fd.append('location', document.getElementById('ev-location').value);
            fd.append('description', document.getElementById('ev-desc').value);
            const logo = document.getElementById('ev-logo-file').files[0];
            if (logo) fd.append('logo', logo);
            App.createEvent(fd);
        }
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

    // Clocks
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

