import { LS, lazyLoad } from './src/frontend/utils.js';
import { API } from './src/frontend/api.js';

/**
 * MASTER SCRIPT
 * Version: V12.9.7
 * Author: Antigravity
 * 
 * Description: Sistema modular de gestión de asistencia con diseño Chrome Style.
 */
window.LS = LS;
window.lazyLoad = lazyLoad;
console.log('CHECK V12.9.7: Iniciando Sistema Modular...');
console.log('[INIT] Script loaded as ESM, LS available');

const App = window.App = {
    state: {
        event: null,
        events: [],
        guests: [],
        user: null,
        socket: null,
        chart: null,
        version: '12.9.7',
        groups: [],
        quillEditor: null,
        editingTemplate: null,
        emailTemplates: [],
        columnConfig: {
            name: { label: 'Nombre', visible: true, order: 0 },
            email: { label: 'Email', visible: true, order: 1 },
            organization: { label: 'Empresa', visible: true, order: 2 },
            phone: { label: 'Teléfono', visible: false, order: 3 },
            position: { label: 'Cargo', visible: false, order: 4 },
            status: { label: 'Estado', visible: true, order: 5 }
        },
        importSession: null,
    },
    constants: { API_URL: '/api' },
    fetchAPI(endpoint, options) { return API.fetchAPI(endpoint, options); },

    // --- NAVEGACIÓN CENTRALIZADA (MODERN PRO) ---
    
    _updateSidebarUI(viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('nav-btn-' + viewId);
        if (activeBtn) activeBtn.classList.add('active');
    },

    // ─── PERMISOS JERÁRQUICOS V10.5 ───
    canAccess(permission) {
        const role = this.state.user?.role;
        if (role === 'ADMIN') return true;
        if (role === 'PRODUCTOR') {
            const producerPerms = [
                'view_groups', 'create_group', 'edit_group',
                'view_events', 'create_event', 'edit_event', 'delete_event',
                'view_users', 'create_user', 'edit_user', 'delete_user',
                'export_data', 'delete_db', 'manage_roles'
            ];
            return producerPerms.includes(permission);
        }
        if (role === 'STAFF') {
            const staffPerms = [ 'view_events', 'view_guests', 'create_guest', 'edit_guest', 'delete_guest', 'export_guests' ];
            return staffPerms.includes(permission);
        }
        if (role === 'CLIENTE') {
            const clientPerms = ['view_events', 'view_guests'];
            return clientPerms.includes(permission);
        }
        return false;
    },

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

    // ─── TEMA OSCURO/CLARO MEJORADO ───
    
    // Obtener tema del sistema
    getSystemTheme: function() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    
    // Obtener tema guardado o del sistema
    getCurrentTheme: function() {
        const saved = LS.get('theme');
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
        return this.getSystemTheme();
    },
    
    // Aplicar transición suave al cambiar tema
    applyThemeTransition: function() {
        // Agregar clase de transición
        document.documentElement.classList.add('theme-transition');
        // Remover después de la transición
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    },
    
    // Cambiar entre temas oscuro/claro
    toggleTheme: function() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.applyThemeTransition();
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(newTheme);
        LS.set('theme', newTheme);
        
        // Actualizar todos los íconos de tema
        document.querySelectorAll('.theme-icon').forEach(icon => {
            icon.textContent = newTheme === 'dark' ? 'dark_mode' : 'light_mode';
        });
        
        // Emitir evento personalizado para que otros componentes reaccionen
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
        
        console.log(`Tema cambiado a: ${newTheme}`);
    },
    
    // Inicializar tema al cargar la aplicación
    initTheme: function() {
        const theme = this.getCurrentTheme();
        const icon = document.getElementById('theme-icon');
        
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        
        if (icon) {
            icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
        }
        
        // Actualizar todos los íconos de tema
        document.querySelectorAll('.theme-icon').forEach(icon => {
            icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
        });
        
        // Escuchar cambios en la preferencia del sistema (solo una vez)
        if (!window._themeListenerAdded) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Solo cambiar si no hay tema guardado explícitamente
                if (!LS.get('theme')) {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.classList.remove('dark', 'light');
                    document.documentElement.classList.add(newTheme);
                    document.querySelectorAll('.theme-icon').forEach(icon => {
                        icon.textContent = newTheme === 'dark' ? 'dark_mode' : 'light_mode';
                    });
                    console.log(`Tema cambiado por preferencia del sistema: ${newTheme}`);
                }
            });
            window._themeListenerAdded = true;
        }
        console.log(`Tema inicializado: ${theme}`);
    },
    
    // Verificar versión de la aplicación
    checkVersion: async function() {
        try {
        
            const res = await this.fetchAPI('/app-version');
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) {
                versionDisplay.textContent = 'V' + res.version;
            }
        } catch(e) {
            console.error('Error al verificar versión:', e);
        }
    },

    // ─── SIDEBAR COLAPSABLE (CHROME STYLE) ───
    toggleSidebar() {
        const sidebar = document.getElementById('global-sidebar');
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle('collapsed');
        LS.set('sidebarCollapsed', isCollapsed);
        
        // Cambiar icono del botón
        const btn = document.getElementById('btn-toggle-sidebar');
        if (btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = isCollapsed ? 'menu' : 'menu_open';
        }
    },

    initSidebar() {
        const isCollapsed = LS.get('sidebarCollapsed') === true;
        if (isCollapsed) {
            const sidebar = document.getElementById('global-sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
            
            const btn = document.getElementById('btn-toggle-sidebar');
            if (btn) {
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = 'menu';
            }
        }
    },

    // ──── NOTIFICACIONES PUSH (Web Push API) ────
    initPushNotifications: async function() {
        try {
            // Registrar service worker si no está registrado
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registrado:', registration);
            
            // Solicitar permiso para notificaciones
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Permiso para notificaciones denegado.');
                return false;
            }
            
            // Obtener clave pública VAPID del servidor
            const vapidPublicKey = await this.getVAPIDPublicKey();
            if (!vapidPublicKey) {
                console.error('No se pudo obtener la clave pública VAPID.');
                return false;
            }
            
            // Suscribir al usuario
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });
            
            // Enviar suscripción al servidor
            await this.sendPushSubscription(subscription);
            
            console.log('Usuario suscrito a notificaciones push:', subscription);
            return true;
        } catch (error) {
            console.error('Error al inicializar notificaciones push:', error);
            return false;
        }
    },
    
    getVAPIDPublicKey: async function() {
        try {
            const res = await this.fetchAPI('/push/vapid-public-key');
            if (!res.publicKey) return null;
            return res.publicKey;
        } catch (error) {
            return null;
        }
    },
    
    sendPushSubscription: async function(subscription) {
        try {
            await this.fetchAPI('/push/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription)
            });
            console.log('Suscripción enviada al servidor.');
        } catch (error) {
            console.error('Error al enviar suscripción:', error);
        }
    },
    
    removePushSubscription: async function() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                await this.fetchAPI('/push/unsubscribe', {
                    method: 'POST',
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
                console.log('Suscripción eliminada.');
            }
        } catch (error) {
            console.error('Error al eliminar suscripción:', error);
        }
    },
    
    urlBase64ToUint8Array: function(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },
    
    sendTestNotification: async function(title, body) {
        try {
            await this.fetchAPI('/push/send-test', {
                method: 'POST',
                body: JSON.stringify({ title, body })
            });
            console.log('Notificación de prueba enviada.');
        } catch (error) {
            console.error('Error al enviar notificación de prueba:', error);
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
    
    // Cargar empresas con usuarios y eventos
    loadGroups: async function() {
        if (!this.state.user || this.state.user.role !== 'ADMIN') return;
        try {
            const groups = await this.fetchAPI('/groups');
            const users = await this.fetchAPI('/users');
            const events = await this.fetchAPI('/events');
            if (!Array.isArray(groups) || !Array.isArray(users)) return;
            this.state.groups = groups;
            this.state.allUsers = users;
            this.state.allEvents = events;
            
            const tbody = document.getElementById('groups-tbody');
            if (tbody) {
                tbody.innerHTML = groups.map(g => {
                    const groupUsers = users.filter(u => u.group_id === g.id);
                    const userChips = groupUsers.map(u => `
                        <div class="inline-flex items-center gap-1 mt-1">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-hover)] text-[var(--text-main)] text-xs font-semibold rounded-md border border-[var(--border)] shadow-sm">
                                <span class="w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold">${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}</span>
                                ${u.display_name || u.username}
                            </span>
                            <button data-action="removeUserFromGroup" data-user-id="${u.id}" data-group-id="${g.id}" class="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors shadow-sm" title="Desvincular Usuario"><span class="material-symbols-outlined text-[14px]">close</span></button>
                        </div>`).join('');
                    
                    const groupEvents = events.filter(e => String(e.group_id) === String(g.id));
                    const eventChips = groupEvents.map(e => `
                        <div class="inline-flex items-center gap-1 mt-1">
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-semibold rounded-md text-[var(--text-main)] shadow-sm">
                                ${e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name}
                            </span>
                            <button data-action="removeEventFromCompany" data-event-id="${e.id}" data-group-id="${g.id}" class="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors shadow-sm" title="Desvincular Evento"><span class="material-symbols-outlined text-[14px]">close</span></button>
                        </div>`).join('');
                    
                    return `
                    <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)] last:border-none">
                        <td class="px-6 py-4">
                            <div class="font-bold text-sm text-[var(--text-main)]">${g.name}</div>
                            <div class="text-[11px] text-[var(--text-secondary)] mt-1">${g.description || 'Sin descripción'}</div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="text-[var(--text-main)] text-xs font-medium">${g.email || '-'}</div>
                            <div class="text-[var(--text-secondary)] text-[11px] mt-0.5">${g.phone || ''}</div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-wrap gap-1.5 max-w-[250px]">${eventChips || '<span class="text-xs text-[var(--text-secondary)] italic">Sin eventos</span>'}</div>
                            <button data-action="showEventSelectorForCompany" data-group-id="${g.id}" class="mt-2 text-[11px] font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Evento</button>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-wrap gap-1.5 max-w-[250px]">${userChips || '<span class="text-xs text-[var(--text-secondary)] italic">Sin usuarios</span>'}</div>
                            <button data-action="showUserSelectorForGroup" data-group-id="${g.id}" class="mt-2 text-[11px] font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Usuario</button>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="status-pill ${g.status === 'ACTIVE' ? 'status-active' : 'status-pending'}">
                                ${g.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button data-action="openCompanyModal" data-group-id="${g.id}" class="px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-main)] hover:bg-[var(--border)] rounded-lg text-xs font-bold transition-all">Editar</button>
                        </td>
                    </tr>`;
                }).join('');
            }
        } catch(e) { console.error('Error loading groups:', e); }
    },
    
    async removeUserFromGroup(userId, groupId) {
        if (await this._confirmAction('¿Quitar usuario de empresa?', 'El usuario perderá acceso a los recursos de esta empresa.')) {
            try {
                await this.fetchAPI(`/groups/${groupId}/users/${userId}`, { method: 'DELETE' });
                this.loadGroups();
                this.loadUsersTable();
            } catch(e) { console.error('Error removing user from group:', e); }
        }
    },
    
    async removeEventFromCompany(eventId, groupId) {
        if(eventId && typeof eventId === 'object') {
            const btn = eventId.target.closest('[data-action]');
            eventId = btn.dataset.eventId;
            groupId = btn.dataset.groupId;
        }
        if (await this._confirmAction('¿Desvincular evento?', 'El evento ya no estará asociado a esta empresa.')) {
            try {
                const events = (this.state.allEvents || []).filter(e => String(e.group_id) === String(groupId));
                const newEvents = events.filter(e => String(e.id) !== String(eventId)).map(e => e.id);
                await this.fetchAPI(`/groups/${groupId}/events`, { 
                    method: 'PUT', body: JSON.stringify({ events: newEvents })
                });
                this.loadGroups();
            } catch(e) { console.error('Error', e); }
        }
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
                    <button data-action="assignUserToGroupFromSelector" data-group-id="${groupId}" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Asignar</button>
                    <button data-action="closeUserSelectorGroup" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    assignUserToGroupFromSelector: async function(groupId) {
        const select = document.getElementById('assign-user-select');
        const userId = select ? select.value : null;
        if (!userId) {
            Swal.fire({ title: 'Error', text: 'Selecciona un usuario de la lista', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        try {
            const res = await this.fetchAPI(`/groups/${groupId}/users`, { 
                method: 'POST', 
                body: JSON.stringify({ userId, role_in_group: 'PRODUCTOR' }) 
            });
            if (res.success) {
                Swal.fire({ title: 'Éxito', text: 'Usuario asignado correctamente', icon: 'success', timer: 1500, showConfirmButton: false, background: '#0f172a', color: '#fff' });
                this.loadGroups();
                this.closeUserSelectorGroup();
            } else {
                Swal.fire('Error', res.error || 'No se pudo asignar el usuario', 'error');
            }
        } catch(e) { 
            console.error('Error assigning user to group:', e);
            Swal.fire('Error', 'Error de red al asignar usuario', 'error'); 
        }
    },
    
    closeUserSelectorGroup: function() {
        document.getElementById('modal-user-selector-group')?.remove();
    },

    showEventSelectorForCompany: async function(groupId) {
        if(groupId && typeof groupId === 'object') groupId = groupId.target?.closest('[data-action]')?.dataset.groupId;
        const groups = this.state.groups || [];
        const group = groups.find(g => String(g.id) === String(groupId));
        if(!group) return;
        
        const allEvents = this.state.allEvents || [];
        
        let html = '<div class="flex flex-col gap-2 text-left mt-4 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">';
        allEvents.forEach(e => {
            const isChecked = String(e.group_id) === String(groupId) ? 'checked' : '';
            html += `
                <label class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors glass-card">
                    <input type="checkbox" class="company-event-multi w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] bg-transparent" value="${e.id}" ${isChecked}>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-[var(--text-main)]">${e.name}</span>
                        <span class="text-[10px] text-[var(--text-secondary)]">${e.date}</span>
                    </div>
                </label>
            `;
        });
        html += '</div>';

        const { value: selectedEvents, isConfirmed } = await Swal.fire({
            title: '<span class="text-[var(--text-main)] font-black text-xl">Eventos de Empresa</span>',
            html: html,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonText: 'Guardar Configuración',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'border border-[var(--border)] rounded-2xl shadow-2xl glass-card',
                confirmButton: 'bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded-xl px-6 py-2 transition-colors inline-block',
                cancelButton: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold px-4 py-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors inline-block'
            },
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.company-event-multi');
                return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
            }
        });

        if (isConfirmed && selectedEvents) {
            try {
                const res = await this.fetchAPI(`/groups/${groupId}/events`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ events: selectedEvents }) 
                });
                if (res.success) {
                    Swal.fire({
                        icon: 'success', title: '¡Operación Exitosa!', text: 'Eventos asignados a la empresa.',
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: 'var(--bg-card)', color: 'var(--text-main)'
                    });
                    this.loadGroups();
                } else alert('Error: ' + res.error);
            } catch(e) { console.error(e); }
        }
    },
    
    // --- EVENT USER MANAGEMENT V10.6 & V12.5.1 ---
    
    // Checklist Modal para asignar Usuarios a un Evento
    showEventSelector: async function(userId) {
        if(userId && typeof userId === 'object') userId = userId.target?.closest('[data-action]')?.dataset.userId; // Fallback x Event
        const users = this.state.allUsers || [];
        const user = users.find(u => String(u.id) === String(userId));
        if(!user) return;
        const events = this.state.allEvents || [];
        const userEvents = user.events ? user.events.map(e=>String(e)) : [];
        
        let html = '<div class="flex flex-col gap-2 text-left mt-4 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">';
        events.forEach(e => {
            const isChecked = userEvents.includes(String(e.id)) ? 'checked' : '';
            html += `
                <label class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors glass-card">
                    <input type="checkbox" class="event-checkbox-multi w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] bg-transparent" value="${e.id}" ${isChecked}>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-[var(--text-main)]">${e.name}</span>
                        <span class="text-[10px] text-[var(--text-secondary)]">${e.date}</span>
                    </div>
                </label>
            `;
        });
        html += '</div>';

        const { value: selectedEvents, isConfirmed } = await Swal.fire({
            title: '<span class="text-[var(--text-main)] font-black text-xl">Asignar Eventos</span>',
            html: html,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonText: 'Guardar Configuración',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'border border-[var(--border)] rounded-2xl shadow-2xl glass-card',
                confirmButton: 'bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded-xl px-6 py-2 transition-colors inline-block',
                cancelButton: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold px-4 py-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors inline-block'
            },
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.event-checkbox-multi');
                return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
            }
        });

        if (isConfirmed && selectedEvents) {
            try {
                const res = await this.fetchAPI(`/users/${userId}/events`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ events: selectedEvents }) 
                });
                if (res.success) {
                    Swal.fire({
                        icon: 'success', title: '¡Operación Exitosa!', text: 'Los eventos han sido asignados correctamente.',
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: 'var(--bg-card)', color: 'var(--text-main)'
                    });
                    this.loadUsersTable();
                } else alert('Error: ' + res.error);
            } catch(e) { console.error(e); }
        }
    },

    showGroupSelector: async function(userId) {
        if(userId && typeof userId === 'object') userId = userId.target?.closest('[data-action]')?.dataset.userId; // Fallback
        const users = this.state.allUsers || [];
        const user = users.find(u => String(u.id) === String(userId));
        if(!user) return;
        const groups = this.state.allGroups || [];
        
        let html = '<div class="flex flex-col gap-2 text-left mt-4 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">';
        const isNoneChecked = !user.group_id ? 'checked' : '';
        html += `
            <label class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors glass-card">
                <input type="radio" name="group-radio-multi" class="w-5 h-5 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] bg-transparent cursor-pointer" value="" ${isNoneChecked}>
                <span class="text-sm font-bold text-[var(--text-muted)] italic">-- Sin Empresa Asignada --</span>
            </label>
        `;

        groups.forEach(g => {
            const isChecked = String(user.group_id) === String(g.id) ? 'checked' : '';
            html += `
                <label class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors glass-card">
                    <input type="radio" name="group-radio-multi" class="w-5 h-5 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] bg-transparent cursor-pointer" value="${g.id}" ${isChecked}>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-[var(--text-main)]">${g.name}</span>
                    </div>
                </label>
            `;
        });
        html += '</div>';

        const { value: selectedGroup, isConfirmed } = await Swal.fire({
            title: '<span class="text-[var(--text-main)] font-black text-xl">Asignar Empresa</span>',
            html: html,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonText: 'Guardar Configuración',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'border border-[var(--border)] rounded-2xl shadow-2xl glass-card',
                confirmButton: 'bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded-xl px-6 py-2 transition-colors inline-block',
                cancelButton: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold px-4 py-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors inline-block'
            },
            preConfirm: () => {
                const radio = document.querySelector('input[name="group-radio-multi"]:checked');
                return radio ? radio.value : null;
            }
        });

        if (isConfirmed) {
            try {
                if(user.group_id && user.group_id !== selectedGroup) {
                    await this.fetchAPI(`/groups/${user.group_id}/users/${userId}`, { method: 'DELETE' });
                }
                if(selectedGroup) {
                    await this.fetchAPI(`/groups/${selectedGroup}/users`, { 
                        method: 'POST', body: JSON.stringify({ userId, role_in_group: user.role })
                    });
                }
                Swal.fire({
                    icon: 'success', title: 'Empresa Actualizada', toast: true, position: 'top-end',
                    showConfirmButton: false, timer: 3000, background: 'var(--bg-card)', color: 'var(--text-main)'
                });
                this.loadUsersTable();
                this.loadGroups();
            } catch(e) { console.error(e); }
        }
    },
    
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
                    <button data-action="assignUserToEventFromSelector" data-event-id="${eventId}" class="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-all">Agregar</button>
                    <button data-action="closeUserSelectorEvent" class="px-6 py-3 bg-white/5 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    assignUserToEventFromSelector: async function(eventId) {
        const select = document.getElementById('assign-event-user-select');
        const userId = select ? select.value : null;
        if (!userId) {
             Swal.fire({ title: 'Error', text: 'Selecciona un usuario de la lista', icon: 'error', background: '#0f172a', color: '#fff' });
             return;
        }
        
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
                this._notifyAction('Éxito', 'Usuario agregado al evento', 'success');
            } else {
                this._notifyAction('Error', 'Error al agregar usuario al evento: ' + res.error, 'error');
            }
        } catch(e) { console.error('Error assigning user to event:', e); }
    },
    
    closeUserSelectorEvent: function() {
        document.getElementById('modal-user-selector-event')?.remove();
    },

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const eventId = this.state.event?.id;
        if (!eventId) {
            this._notifyAction('Atención', 'Selecciona un evento para importar.', 'info');
            return;
        }

        this._notifyAction('Procesando', 'Analizando archivo...', 'info');
    },

    async purgeDatabase() {
        if (await this._confirmAction('¿BORRAR TODO?', 'Esta acción eliminará TODOS los registros del sistema permanentemente.')) {
            try {
                await this.fetchAPI('/admin/purge', { method: 'POST' });
                this._notifyAction('Base de Datos Limpia', 'Se han borrado todos los datos.', 'success');
                location.reload();
            } catch (e) {
                this._notifyAction('Error', 'Falla en la purga: ' + e.message, 'error');
            }
        }
    },
    
    removeUserFromEvent: async function(userId, eventId) {
        if (!(await this._confirmAction('¿Quitar este usuario del evento?', 'Esta acción desvinculará al usuario del evento seleccionado.'))) return;
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
        
        // Sincronizar filtros de la interfaz
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
        
        // Gestión de solicitudes pendientes (Amber Style)
        const pending = users.filter(u => u.status === 'PENDING');
        const badge = document.getElementById('pending-badge');
        const pendingSection = document.getElementById('pending-requests-section');
        const pendingList = document.getElementById('pending-users-list');
        
        if (badge) badge.classList.toggle('hidden', pending.length === 0);
        if (pendingSection) pendingSection.classList.toggle('hidden', pending.length === 0);
        if (pendingList && pending.length > 0) {
            pendingList.innerHTML = pending.map(u => `
                <div class="flex items-center justify-between glass-card p-4 mb-3 border-amber-500/20 bg-amber-500/5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                            <span class="material-symbols-outlined">person_add</span>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-[var(--text-main)]">${u.display_name || u.username}</p>
                            <p class="text-[10px] text-[var(--text-secondary)] font-mono">${u.username}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button data-action="approveUser" data-user-id="${u.id}" data-status="APPROVED" class="px-4 py-2 bg-amber-500 text-white font-bold text-[10px] rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 transition-all">APROBAR ACCESO</button>
                    </div>
                </div>`).join('');
        }
        
        const tbody = document.getElementById('users-tbody');
        const isAdmin = this.state.user.role === 'ADMIN';
        const isProductor = this.state.user.role === 'PRODUCTOR';
        
        if (tbody) {
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-20 text-center text-[var(--text-muted)] font-bold uppercase tracking-widest opacity-50">No se encontraron colaboradores</td></tr>';
                return;
            }

            tbody.innerHTML = users.map((u) => {
                const canEdit = isAdmin || (isProductor && u.role !== 'ADMIN');
                const roleOptions = isAdmin ? 
                    ['ADMIN', 'PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS'] :
                    ['PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS'];
                
                // --- EVENTOS (Para Columna 1) ---
                const userEvents = events.filter(e => u.events && u.events.map(ev => String(ev)).includes(String(e.id)));
                const eventChips = userEvents.map(e => `
                    <div class="inline-flex items-center gap-1 mt-1">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-semibold rounded-md text-[var(--text-main)] shadow-sm">
                            ${e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name}
                        </span>
                        ${canEdit ? `<button data-action="removeUserFromEvent" data-user-id="${u.id}" data-event-id="${e.id}" class="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors shadow-sm" title="Desvincular Evento"><span class="material-symbols-outlined text-[14px]">close</span></button>` : ''}
                    </div>
                `).join('');

                // --- COLUMNA 1: COLABORADOR ---
                const col1 = `
                    <div class="font-bold text-[var(--text-main)] text-sm">${u.display_name || u.username}</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${u.username}</div>
                    <div class="flex flex-wrap gap-1 mt-1">${eventChips}</div>
                `;

                // --- COLUMNA 2: ROL / ACCESO (MULTITENANT) ---
                const groupDisplay = (u.groups && u.groups.length > 0) ? u.groups.map(userGroup => `
                    <div class="inline-flex items-center gap-1 mt-1 mb-1 mr-1">
                        <span class="px-2.5 py-1 inline-flex items-center gap-1.5 bg-[var(--bg-hover)] text-xs font-semibold rounded-md text-[var(--text-main)] border border-[var(--border)] shadow-sm">
                            <span class="material-symbols-outlined text-[14px] text-[var(--text-secondary)]">corporate_fare</span>
                            <span class="truncate max-w-[150px]" title="${userGroup.name}">${userGroup.name}</span>
                        </span>
                        ${canEdit ? `<button data-action="removeUserFromGroup" data-user-id="${u.id}" data-group-id="${userGroup.id}" class="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors shadow-sm" title="Desvincular Empresa"><span class="material-symbols-outlined text-[14px]">close</span></button>` : ''}
                    </div>
                `).join('') : `<span class="italic text-[var(--text-muted)] text-xs mt-1 mb-1 block">Sin Empresa</span>`;

                const roleSelect = canEdit ? `
                    <select data-action="changeUserRole" data-user-id="${u.id}" class="bg-[var(--bg-input)] text-[var(--text-main)] text-[11px] font-medium rounded px-2 py-1 border border-[var(--border)] outline-none w-[130px] focus:border-[var(--primary)] mt-1.5">
                        ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>` : `<div class="text-xs font-semibold mt-1.5">${u.role}</div>`;

                const col2 = `
                    <div class="text-[11px] font-medium text-[var(--text-main)] flex flex-wrap items-center gap-0.5">${groupDisplay}</div>
                    ${roleSelect}
                `;

                // --- COLUMNA 3: ESTADO ---
                const statusLabel = u.status === 'APPROVED' ? 'ACTIVO' : u.status === 'PENDING' ? 'PENDIENTE' : 'SUSPENDIDO';
                const statusClass = u.status === 'APPROVED' ? 'status-active' : u.status === 'PENDING' ? 'status-pending' : 'status-error';
                const col3 = `<span class="status-pill inline-block ${statusClass}">${statusLabel}</span>`;

                // --- COLUMNA 4: ACCIONES ---
                const actionAssignCompany = (isAdmin && canEdit) ? `<button data-action="showGroupSelector" data-user-id="${u.id}" class="text-[11px] font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Empresa</button>` : '';
                const actionAssignEvent = canEdit ? `<button data-action="showEventSelector" data-user-id="${u.id}" data-events='${JSON.stringify(u.events || [])}' class="text-[11px] font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Evento</button>` : '';
                
                const accessBtn = canEdit ? (u.status !== 'APPROVED' ? 
                    `<button data-action="approveUser" data-user-id="${u.id}" data-status="APPROVED" class="text-[11px] font-medium text-emerald-500 hover:text-emerald-400 transition-colors whitespace-nowrap">Activar</button>` : 
                    `<button data-action="approveUser" data-user-id="${u.id}" data-status="SUSPENDED" class="text-[11px] font-medium text-red-500 hover:text-red-400 transition-colors whitespace-nowrap">Suspender</button>`) : '';

                const col4 = `
                    <div class="flex flex-col items-end gap-2 text-right">
                        ${actionAssignCompany}
                        ${actionAssignEvent}
                        ${accessBtn}
                    </div>
                `;

                return `
                <tr class="hover:bg-[var(--bg-hover)] transition-colors">
                    <td class="px-5 py-4 align-top border-b border-[var(--border-light)]">${col1}</td>
                    <td class="px-5 py-4 align-top border-b border-[var(--border-light)]">${col2}</td>
                    <td class="px-5 py-4 align-top border-b border-[var(--border-light)] text-center">${col3}</td>
                    <td class="px-5 py-4 align-top border-b border-[var(--border-light)] text-right">${col4}</td>
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
    removeUserFromEvent: async function(userId, eventId) {
        if (await this._confirmAction('¿Quitar acceso al evento?', 'El usuario ya no podrá gestionar este evento.')) {
            try {
                const res = await this.fetchAPI(`/users/${userId}/events/${eventId}`, { method: 'DELETE' });
                if (res.success) {
                    Swal.fire({ title: 'Éxito', text: 'Acceso revocado', icon: 'success', timer: 1000, showConfirmButton: false });
                    this.loadUsersTable();
                } else {
                    Swal.fire('Error', res.error || 'No se pudo quitar el evento', 'error');
                }
            } catch { Swal.fire('Error', 'Error de red', 'error'); }
        }
    },
    
    // Mostrar selector de empresas para asignar (Multitenant V12.6.0)
    showGroupSelector: function(userId) {
        const groups = this.state.allGroups || [];
        const user = (this.state.allUsers || []).find(u => String(u.id) === String(userId));
        const currentGroupIds = user?.groups?.map(g => String(g.id)) || [];
        
        const options = groups.map(g => `
            <label class="flex items-center justify-between p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 cursor-pointer transition-all">
                <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-bold text-white">${g.name}</span>
                    <span class="text-[10px] text-slate-400 font-medium">${g.description || 'Productor asimilado'}</span>
                </div>
                <input type="checkbox" name="multi-group-select" value="${g.id}" ${currentGroupIds.includes(String(g.id)) ? 'checked' : ''} class="w-5 h-5 accent-primary rounded cursor-pointer border-white/10 bg-slate-900/50">
            </label>
        `).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-select-group';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300';
        modal.innerHTML = `
            <div class="glass-card p-8 w-full max-w-md border border-white/10 shadow-2xl scale-in-center">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                        <span class="material-symbols-outlined text-2xl">corporate_fare</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-white tracking-tight">Asignar Empresas</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Selección Múltiple</p>
                    </div>
                </div>
                
                <div class="space-y-2 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar" id="group-checkbox-list">
                    ${options || '<p class="text-xs text-slate-500 italic text-center py-4">No hay empresas creadas. Crea una primero.</p>'}
                </div>

                <div class="flex flex-col gap-3">
                    <button data-action="assignUserGroupFromSelector" data-user-id="${userId}" class="w-full py-4 bg-primary text-white font-black text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">Confirmar Asignación</button>
                    <div class="flex gap-3">
                        <button data-action="navigateToCreateGroup" data-user-id="${userId}" class="flex-1 py-4 bg-white/5 text-slate-400 hover:text-white font-bold text-[10px] rounded-2xl transition-all uppercase tracking-widest border border-white/5 hover:border-white/10">+ Nueva Empresa</button>
                        <button data-action="closeGroupSelector" class="flex-1 py-4 bg-white/5 text-slate-400 hover:text-white font-bold text-[10px] rounded-2xl transition-all uppercase tracking-widest border border-white/5 hover:border-white/10">Cancelar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },
    
    navigateToCreateGroup: function(userId) {
        this.closeGroupSelector();
        this.navigate('groups');
    },
    
    assignUserGroupFromSelector: async function(userId) {
        const checkboxes = document.querySelectorAll('input[name="multi-group-select"]:checked');
        const selectedGroupIds = Array.from(checkboxes).map(chk => chk.value);
        
        try {
            const res = await this.fetchAPI(`/users/${userId}/group`, { 
                method: 'PUT', 
                body: JSON.stringify({ group_id: selectedGroupIds }) 
            });
            if (res.success) {
                this.loadUsersTable();
                this.closeGroupSelector();
            }
        } catch(e) { console.error('Error assigning groups:', e); }
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
        const assignedIds = (currentEvents || []).map(id => String(id));
        const availableEvents = events.filter(e => !assignedIds.includes(String(e.id)));
        
        if (availableEvents.length === 0) {
            alert('No hay más eventos disponibles para asignar.');
            return;
        }
        
        const options = availableEvents.map(e => 
            `<option value="${e.id}">${e.name}</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-select-event';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300';
        modal.innerHTML = `
            <div class="glass-card p-8 w-full max-w-md border border-white/10 shadow-2xl scale-in-center">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                        <span class="material-symbols-outlined text-2xl">event_available</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-white tracking-tight">Agregar Evento</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Permisos de Producción</p>
                    </div>
                </div>
                
                <div class="space-y-4 mb-8">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Seleccionar Evento</label>
                        <select id="select-event-target" class="w-full bg-slate-900/50 text-white text-sm rounded-2xl px-5 py-4 border border-white/10 focus:border-primary/50 outline-none transition-all appearance-none cursor-pointer">
                            <option value="">-- Seleccionar --</option>
                            ${options}
                        </select>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
                    <button data-action="assignEventFromSelector" data-user-id="${userId}" class="w-full py-4 bg-primary text-white font-black text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">Vincular Evento</button>
                    <div class="flex gap-3">
                        <button data-action="navigateToCreateEvent" data-user-id="${userId}" class="flex-1 py-4 bg-white/5 text-slate-400 hover:text-white font-bold text-[10px] rounded-2xl transition-all uppercase tracking-widest border border-white/5 hover:border-white/10">+ Nuevo Evento</button>
                        <button data-action="closeEventSelector" class="flex-1 py-4 bg-white/5 text-slate-400 hover:text-white font-bold text-[10px] rounded-2xl transition-all uppercase tracking-widest border border-white/5 hover:border-white/10">Cancelar</button>
                    </div>
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
            if (config) {
                const h = document.getElementById('smtp-host');
                const p = document.getElementById('smtp-port');
                const u = document.getElementById('smtp-user');
                const ps = document.getElementById('smtp-pass');
                const s = document.getElementById('smtp-secure');
                const fn = document.getElementById('smtp-from-name');
                const fe = document.getElementById('smtp-from-email');

                if (h) h.value = config.smtp_host || '';
                if (p) p.value = config.smtp_port || 587;
                if (u) u.value = config.smtp_user || '';
                if (ps) ps.value = config.smtp_pass ? '***' : '';
                if (s) s.checked = config.smtp_secure == 1;
                if (fn) fn.value = config.from_name || 'Check';
                if (fe) fe.value = config.from_email || '';
            }
        } catch (e) { console.error('[SMTP] Error loading config:', e); }
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
        } else if (section === 'mailbox') {
            App.switchMailboxFolder('INBOX');
        } else if (section === 'mailing') {
            App.loadMailingTemplates();
            App.updateMailingStats();
            App.initDNSGuide();
        }
    },

    // ─── MAILING & MAILBOX LOGIC V11.1 ───
    
    switchMailboxFolder: function(folder) {
        document.querySelectorAll('.mail-folder-btn').forEach(b => b.classList.remove('active', 'bg-primary', 'text-white'));
        const btn = document.getElementById('mail-folder-' + folder.toLowerCase());
        if (btn) btn.classList.add('active', 'bg-primary', 'text-white');
        
        this.loadMailbox(folder);
    },

    loadMailbox: async function(folder) {
        const container = document.getElementById('email-mailbox-list');
        if (!container) return;
        
        container.innerHTML = '<div class="p-12 text-center animate-pulse"><span class="material-symbols-outlined text-4xl text-primary block mb-2">sync</span><p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Cargando buzón...</p></div>';
        
        try {
            const type = folder === 'INBOX' ? 'INBOX' : 'SENT';
            const logs = await this.fetchAPI(`/email-logs?type=${type}`);
            
            if (!logs || logs.length === 0) {
                container.innerHTML = `<div class="p-12 text-center text-slate-600"><span class="material-symbols-outlined text-4xl block mb-2">inbox</span><p class="text-sm font-bold">No hay mensajes en ${folder}</p></div>`;
                return;
            }

            container.innerHTML = logs.map(mail => {
                let dateStr = 'Fecha desconocida';
                try {
                    const d = new Date(mail.created_at);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    }
                } catch(e) {}

                // Limpiar HTML para el preview
                const previewText = mail.body_html ? mail.body_html.replace(/<[^>]*>?/gm, ' ').substring(0, 100) : '(Sin contenido)';

                return `
                <div data-action="viewMailDetail" data-mail-id="${mail.id}" class="group flex items-start gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-all">
                    <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-500 text-xs shadow-inner">
                        ${(mail.from_email || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-1">
                            <h5 class="text-sm font-bold text-slate-200 truncate pr-4">${mail.subject || '(Sin asunto)'}</h5>
                            <span class="text-[9px] font-black text-slate-500 uppercase shrink-0">${dateStr}</span>
                        </div>
                        <p class="text-[10px] text-slate-600 truncate mb-1">
                            <span class="text-slate-500">De:</span> ${mail.from_email || 'Sistema'}
                        </p>
                        <div class="text-[10px] text-slate-500/60 line-clamp-1 italic">${previewText}...</div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = `<div class="p-12 text-center text-red-500/60"><p class="text-sm font-bold">Error al cargar buzón: ${e.message}</p></div>`;
        }
    },

    viewMailDetail: async function(mailId) {
        try {
            // Reutilizar el log que ya tenemos en estado o buscarlo
            const logs = await this.fetchAPI(`/email-logs?id=${mailId}`);
            if (logs.length === 0) return alert('Correo no encontrado');
            const mail = logs[0];
            
            document.getElementById('mail-view-subject').textContent = mail.subject || '(Sin Asunto)';
            document.getElementById('mail-view-from').textContent = mail.from_email || '-';
            document.getElementById('mail-view-to').textContent = mail.to_email || '-';
            document.getElementById('mail-view-date').textContent = new Date(mail.created_at).toLocaleString();
            document.getElementById('mail-view-body').innerHTML = mail.body_html || '';
            
            document.getElementById('modal-mail-view').classList.remove('hidden');
        } catch (e) { alert('Error al cargar detalle: ' + e.message); }
    },

    closeMailView: function() {
        document.getElementById('modal-mail-view').classList.add('hidden');
    },

    closeModal: function() {
        document.getElementById('modal-event')?.classList.add('hidden');
    },

    openInviteModal: function() {
        document.getElementById('invite-user-form')?.reset();
        this.updateRoleOptions();
        document.getElementById('modal-invite')?.classList.remove('hidden');
    },

    closeInvite: function() {
        document.getElementById('modal-invite')?.classList.add('hidden');
    },

    closeSurveyEditor: function() {
        document.getElementById('modal-survey-editor')?.classList.add('hidden');
    },

    startScanner: function() {
        const video = document.getElementById('qr-video');
        const canvas = document.getElementById('qr-canvas');
        if (!video) return;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                video.srcObject = stream;
                video.play();
            })
            .catch(e => alert('Error al acceder a la cámara: ' + e.message));
    },

    stopScanner: function() {
        const video = document.getElementById('qr-video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        document.getElementById('modal-qr-scanner')?.classList.add('hidden');
    },

    manualCheckin: function() {
        const id = document.getElementById('manual-guest-id')?.value;
        if (id) App.processGuestCheckin(id);
    },

    syncEmails: async function() {
        if (typeof showLoading === 'function') showLoading('Sincronizando correos...');
        try {
            const res = await this.fetchAPI('/emails/sync', { method: 'POST' });
            if (res.success) {
                this.loadMailbox('INBOX');
                alert(`✓ Sincronización completada. Nuevos: ${res.newEmails || 0}`);
            } else {
                alert('Error al sincronizar: ' + (res.error || 'Error desconocido'));
            }
        } catch (e) {
            alert('Error de conexión: ' + e.message);
        } finally { if (typeof hideLoading === 'function') hideLoading(); }
    },

    loadIMAPConfig: async function() {
        try {
            const config = await this.fetchAPI('/imap-config');
            if (config) {
                const h = document.getElementById('imap-host');
                const p = document.getElementById('imap-port');
                const u = document.getElementById('imap-user');
                const ps = document.getElementById('imap-pass');
                const t = document.getElementById('imap-tls');
                
                if (h) h.value = config.imap_host || '';
                if (p) p.value = config.imap_port || 993;
                if (u) u.value = config.imap_user || '';
                if (ps) ps.value = config.imap_pass || '';
                if (t) t.checked = config.imap_tls == 1;
            }
        } catch (e) { console.error('[IMAP] Error loading config:', e); }
    },

    saveIMAPConfig: async function() {
        const data = {
            imap_host: document.getElementById('imap-host')?.value.trim() || '',
            imap_port: parseInt(document.getElementById('imap-port')?.value) || 993,
            imap_user: document.getElementById('imap-user')?.value.trim() || '',
            imap_pass: document.getElementById('imap-pass')?.value.trim() || '',
            imap_tls: document.getElementById('imap-tls')?.checked ? 1 : 0
        };

        if (!data.imap_host || !data.imap_user) return alert('Host y Usuario son obligatorios');

        try {
            await this.fetchAPI('/imap-config', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert('✓ Configuración IMAP guardada');
        } catch (e) { alert('Error al guardar: ' + e.message); }
    },

    testIMAPConnection: async function() {
        const data = {
            imap_host: document.getElementById('imap-host')?.value.trim() || '',
            imap_port: parseInt(document.getElementById('imap-port')?.value) || 993,
            imap_user: document.getElementById('imap-user')?.value.trim() || '',
            imap_pass: document.getElementById('imap-pass')?.value.trim() || '',
            imap_tls: document.getElementById('imap-tls')?.checked ? 1 : 0
        };

        if (!data.imap_host || !data.imap_user || !data.imap_pass) return alert('Completa los datos para probar');

        if (typeof showLoading === 'function') showLoading('Probando conexión IMAP...');
        try {
            const res = await this.fetchAPI('/imap-test', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            if (res.success) alert('✓ ¡Conexión exitosa!');
            else alert('Error: ' + (res.error || 'Fallo en la conexión'));
        } catch (e) {
            alert('Error de red: ' + e.message);
        } finally { if (typeof hideLoading === 'function') hideLoading(); }
    },

    switchEmailService: function(service) {
        // Toggle tabs
        document.querySelectorAll('.email-service-tab').forEach(btn => {
            btn.classList.remove('bg-primary', 'text-white', 'shadow-xl');
            btn.classList.add('bg-white/5', 'text-slate-400');
        });
        const activeTab = document.getElementById('tab-btn-' + service);
        if (activeTab) {
            activeTab.classList.remove('bg-white/5', 'text-slate-400');
            activeTab.classList.add('bg-primary', 'text-white', 'shadow-xl');
        }

        // Toggle forms
        document.querySelectorAll('.email-form').forEach(form => form.classList.add('hidden'));
        const activeForm = document.getElementById('form-' + service);
        if (activeForm) activeForm.classList.remove('hidden');

        // Load data
        if (service === 'smtp') this.loadSMTPConfig();
        if (service === 'imap') this.loadIMAPConfig();
    },

    testSMTPConnection: async function() {
        const data = {
            smtp_host: document.getElementById('smtp-host')?.value.trim() || '',
            smtp_port: parseInt(document.getElementById('smtp-port')?.value) || 587,
            smtp_user: document.getElementById('smtp-user')?.value.trim() || '',
            smtp_pass: document.getElementById('smtp-pass')?.value.trim() || '',
            smtp_secure: document.getElementById('smtp-secure')?.checked ? 1 : 0
        };

        if (!data.smtp_host || !data.smtp_user || !data.smtp_pass) return alert('Completa los datos para probar');

        if (typeof showLoading === 'function') showLoading('Probando conexión SMTP...');
        try {
            const res = await this.fetchAPI('/smtp-test', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            if (res.success) alert('✓ ¡Conexión SMTP exitosa!');
            else alert('Error: ' + (res.error || 'Fallo en la conexión'));
        } catch (e) {
            alert('Error de red: ' + e.message);
        } finally { if (typeof hideLoading === 'function') hideLoading(); }
    },

    saveSMTPConfig: async function() {
        const data = {
            smtp_host: document.getElementById('smtp-host')?.value.trim() || '',
            smtp_port: parseInt(document.getElementById('smtp-port')?.value) || 587,
            smtp_user: document.getElementById('smtp-user')?.value.trim() || '',
            smtp_pass: document.getElementById('smtp-pass')?.value.trim() || '',
            smtp_secure: document.getElementById('smtp-secure')?.checked ? 1 : 0,
            from_name: document.getElementById('smtp-from-name')?.value.trim() || 'Check',
            from_email: document.getElementById('smtp-from-email')?.value.trim() || ''
        };

        if (!data.smtp_host || !data.smtp_user) return alert('Host y Usuario son obligatorios');

        try {
            await this.fetchAPI('/smtp-config', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert('✓ Configuración SMTP guardada');
        } catch (e) { alert('Error al guardar: ' + e.message); }
    },

    loadMailingTemplates: async function() {
        try {
            const templates = await this.fetchAPI('/email-templates');
            const select = document.getElementById('mailing-template-select');
            if (select) {
                select.innerHTML = '<option value="">-- Selecciona una plantilla --</option>' + 
                    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
            this.state.emailTemplates = templates;
        } catch (e) { console.error('Error loading mailing templates:', e); }
    },

    previewMailingTemplate: async function() {
        const templateId = document.getElementById('mailing-template-select').value;
        const container = document.getElementById('mailing-preview-container');
        if (!templateId || !container) return;

        const template = this.state.emailTemplates.find(t => t.id === templateId);
        if (!template) return;

        // Set subject
        document.getElementById('mailing-subject').value = template.subject || '';

        // Simular previsualización con el primer invitado si existe
        let guest = this.state.guests?.[0] || { name: 'INVITADO DE PRUEBA', email: 'prueba@ejemplo.com', unsubscribe_token: 'test-token' };
        
        let body = template.body;
        body = body.replace(/{{guest_name}}/g, guest.name);
        body = body.replace(/{{guest_email}}/g, guest.email);
        body = body.replace(/{{unsubscribe_url}}/g, `${window.location.origin}/unsubscribe/${guest.unsubscribe_token || 'sample-token'}`);

        container.innerHTML = body;
    },

    refreshMailingPreview: function() {
        if (!this.state.guests || this.state.guests.length === 0) return;
        // Mezclar aleatoriamente y volver a previsualizar
        this.state.guests = [...this.state.guests].sort(() => Math.random() - 0.5);
        this.previewMailingTemplate();
    },

    startBroadcast: async function() {
        const templateId = document.getElementById('mailing-template-select').value;
        const subject = document.getElementById('mailing-subject').value;
        const container = document.getElementById('mailing-preview-container');
        
        if (!templateId || !subject) return alert('Selecciona una plantilla y asunto');
        if (!this.state.event) return alert('Selecciona un evento primero');

        if (!confirm('¿Estás seguro de iniciar el envío masivo a ' + (this.state.guests?.length || 0) + ' invitados?')) return;

        try {
            const body = container.innerHTML;
            await this.fetchAPI('/emails/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    event_id: this.state.event.id,
                    template_id: templateId,
                    subject: subject,
                    body: body
                })
            });
            
            alert('✓ Envío masivo iniciado. Revisa el progreso en la parte superior.');
            document.getElementById('mailing-progress-card').classList.remove('hidden');
            this.updateMailingStats();
            
            // Iniciar polling de progreso
            if (this._mailingPolling) clearInterval(this._mailingPolling);
            this._mailingPolling = setInterval(() => this.updateMailingStats(), 3000);

        } catch (e) { alert('Error al iniciar envío: ' + e.message); }
    },

    controlMailingQueue: async function(action) {
        try {
            const res = await this.fetchAPI('/emails/queue-control', {
                method: 'POST',
                body: JSON.stringify({ action })
            });
            
            if (action === 'pause') {
                document.getElementById('btn-pause-mailing').classList.add('hidden');
                document.getElementById('btn-resume-mailing').classList.remove('hidden');
            } else if (action === 'resume') {
                document.getElementById('btn-pause-mailing').classList.remove('hidden');
                document.getElementById('btn-resume-mailing').classList.add('hidden');
            } else if (action === 'stop') {
                document.getElementById('mailing-progress-card').classList.add('hidden');
                clearInterval(this._mailingPolling);
            }
        } catch (e) { alert('Error al controlar cola: ' + e.message); }
    },

    updateMailingStats: async function() {
        try {
            const stats = await this.fetchAPI('/emails/queue-stats');
            const total = stats.total || 0;
            const sent = stats.sent || 0;
            const pending = stats.pending || 0;
            const errors = stats.errors || 0;
            
            const percent = total > 0 ? Math.round((sent / total) * 100) : 0;
            
            const bar = document.getElementById('mailing-progress-bar');
            const countText = document.getElementById('mailing-count-text');
            const percentText = document.getElementById('mailing-percent-text');
            const card = document.getElementById('mailing-progress-card');

            if (bar) bar.style.width = percent + '%';
            if (countText) countText.textContent = `${sent} / ${total} enviados · ${errors} errores`;
            if (percentText) percentText.textContent = percent + '%';

            // Si hay algo pendiente, mostrar la tarjeta si no estaba
            if (pending > 0 || stats.sending > 0) {
                card?.classList.remove('hidden');
                if (!this._mailingPolling) {
                    this._mailingPolling = setInterval(() => this.updateMailingStats(), 3000);
                }
            } else if (total > 0 && pending === 0 && stats.sending === 0) {
                // Finalizado
                document.getElementById('mailing-status-text').textContent = 'Envío completado';
                clearInterval(this._mailingPolling);
                this._mailingPolling = null;
                setTimeout(() => card?.classList.add('hidden'), 10000); // Ocultar después de 10s
            }
        } catch (e) { console.error('Error updating mailing stats:', e); }
    },
    
    saveEmailTemplate: async function() {
        const name = document.getElementById('tpl-name').value;
        const subject = document.getElementById('tpl-subject').value;
        const body = this.state.quillEditor ? this.state.quillEditor.root.innerHTML : '';
        
        if (!name || !subject || !body) return alert('Completa todos los campos');

        try {
            const isEditing = this.state.editingTemplate;
            const endpoint = isEditing ? `/email-templates/${isEditing.id}` : '/email-templates';
            const method = isEditing ? 'PUT' : 'POST';
            
            await this.fetchAPI(endpoint, {
                method: method,
                body: JSON.stringify({ 
                    name, subject, body, 
                    event_id: isEditing?.event_id || (this.state._creatingEventType === 'event' ? this.state.event?.id : null) 
                })
            });
            
            alert('✓ Plantilla guardada correctamente');
            this.closeTemplateEditor();
            this.loadEmailTemplates();
            if (this.state.email_admin_section === 'mailing') {
                this.loadMailingTemplates();
                this.initDNSGuide();
            }
        } catch (e) { alert('Error al guardar: ' + e.message); }
    },

    initDNSGuide: function() {
        const isDismissed = localStorage.getItem('dns_guide_dismissed');
        const banner = document.getElementById('dns-guide-banner');
        if (banner) {
            if (isDismissed) banner.classList.add('hidden');
            else banner.classList.remove('hidden');
        }
    },

    dismissDNSGuide: function() {
        localStorage.setItem('dns_guide_dismissed', 'true');
        document.getElementById('dns-guide-banner')?.classList.add('hidden');
    },

    deleteEmailTemplate: async function(id) {
        if (!confirm('¿Seguro que quieres eliminar esta plantilla permanente?')) return;
        try {
            await this.fetchAPI(`/email-templates/${id}`, { method: 'DELETE' });
            this.loadEmailTemplates();
            if (this.state.email_admin_section === 'mailing') this.loadMailingTemplates();
        } catch (e) { alert('Error al eliminar: ' + e.message); }
    },

    showCreateTemplateModal: async function(type = 'global') {
        if (this._templateEditorOpening) return;
        this._templateEditorOpening = true;
        this.state.editingTemplate = null;
        this.state._creatingEventType = type; // 'global' o 'event'
        
        document.getElementById('template-editor-title').textContent = type === 'event' ? 'Nueva Plantilla de Evento' : 'Nueva Plantilla Global';
        document.getElementById('tpl-name').value = '';
        document.getElementById('tpl-subject').value = '';
        document.getElementById('modal-template-editor').classList.remove('hidden');
        await this._initTemplateEditor();
        this.switchTemplateEditorTab('visual');
        this._templateEditorOpening = false;
    },
    
    showTemplateEditor: async function(templateId, templateName) {
        if (this._templateEditorOpening) {
            console.log('[QUILL] Already opening, ignoring');
            return;
        }
        this._templateEditorOpening = true;
        
        const template = this.state.emailTemplates?.find(t => t.id === templateId);
        if (!template) {
            this._templateEditorOpening = false;
            return alert('Plantilla no encontrada. Recarga la página.');
        }
        this.state.editingTemplate = template;
        document.getElementById('template-editor-title').textContent = 'Editar: ' + (template.name || templateName);
        document.getElementById('tpl-name').value = template.name || '';
        document.getElementById('tpl-subject').value = template.subject || '';
        document.getElementById('modal-template-editor').classList.remove('hidden');
        await this._initTemplateEditor(template.body || '');
        this.switchTemplateEditorTab('visual');
        this._templateEditorOpening = false;
    },
    
    closeTemplateEditor: function() {
        document.getElementById('modal-template-editor')?.classList.add('hidden');
        if (this.state.quillEditor) {
            console.log('[QUILL] destroying editor on close');
            try { this.state.quillEditor.destroy(); } catch(e) { console.warn('[QUILL] Error destroying:', e); }
            this.state.quillEditor = null;
        }
    },
    
    _initTemplateEditor: async function(initialHtml) {
        if (this._quillInitializing) return;
        this._quillInitializing = true;
        console.log('[QUILL] initTemplateEditor called');
        
        // Lazy load Quill if not already loaded
        if (typeof window.Quill === 'undefined') {
            try {
                await window.lazyLoad?.loadQuill();
            } catch (err) {
                console.error('Failed to load Quill:', err);
                this._quillInitializing = false;
                return;
            }
        }
        
        // Limpiar el contenedor y ELIMINAR toolbars remanentes (Quill 2.0 puede dejarlas como hermanos)
        const container = document.getElementById('tpl-quill-editor');
        if (container) {
            const parent = container.parentElement;
            if (parent) {
                const toolbars = parent.querySelectorAll('.ql-toolbar');
                toolbars.forEach(t => t.remove());
            }
            container.innerHTML = '';
        }

        if (this.state.quillEditor) {
            console.log('[QUILL] destroying existing editor');
            try { this.state.quillEditor.destroy(); } catch(e) {}
            this.state.quillEditor = null;
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
            this.state.quillEditor.clipboard.dangerouslyPasteHTML(this._cleanHtmlForEditor(initialHtml));
        }
        
        this._loadVariablesPalette();
        this._quillInitializing = false;
    },

    _cleanHtmlForEditor: function(html) {
        if (!html) return '';
        let clean = html;
        // 1. Eliminar background-color de spans, p, div (excepto botones que suelen ser <a> con fondo)
        clean = clean.replace(/(<(span|p|div|h1|h2|h3)[^>]*style="[^"]*)background-color\s*:\s*[^;"]+;?/gi, '$1');
        clean = clean.replace(/(<(span|p|div|h1|h2|h3)[^>]*style="[^"]*)background\s*:\s*[^;"]+;?/gi, '$1');
        
        // 2. Cambiar colores de texto blancos/claros a 'inherit' en elementos de contenido
        // Quill inyecta color: rgb(255, 255, 255) o #ffffff que en modo claro son invisibles
        clean = clean.replace(/(<(span|p|div)[^>]*style="[^"]*)color\s*:\s*(#ffffff|white|#f8fafc|rgb\(255,\s*255,\s*255\));?/gi, '$1color: inherit;');
        
        // 3. Eliminar sombras de texto inline (causan el "resaltado blanco" en modo oscuro)
        clean = clean.replace(/(<[^>]*style="[^"]*)text-shadow\s*:\s*[^;"]+;?/gi, '$1');
        
        return clean;
    },
    
    _loadVariablesPalette: function() {
        const isEvent = this.state.editingTemplate?.event_id;
        const vars = isEvent 
            ? ['{{guest_name}}', '{{guest_email}}', '{{event_name}}', '{{event_date}}', '{{event_location}}', '{{agenda}}', '{{qr_code}}', '{{checkin_time}}']
            : ['{{user_name}}', '{{email}}', '{{password}}', '{{role}}', '{{company_name}}', '{{login_url}}', '{{reset_url}}', '{{reset_code}}'];
        
        const palette = document.getElementById('tpl-variables-palette');
        if (!palette) return;
        
        palette.innerHTML = vars.map(v => 
            `<button data-action="insertVariable" data-var-name="${v}" class="px-2 py-1 bg-slate-800/60 hover:bg-primary/20 hover:text-primary text-slate-400 rounded-lg text-[10px] font-mono font-bold border border-white/5 transition-all">${v}</button>`
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
        
        const prevTab = this.state.templateActiveTab || 'visual';
        this.state.templateActiveTab = tab;

        document.getElementById('editor-visual-container')?.classList.add('hidden');
        document.getElementById('editor-code-container')?.classList.add('hidden');
        document.getElementById('editor-preview-container')?.classList.add('hidden');
        
        if (tab === 'visual') {
            document.getElementById('editor-visual-container')?.classList.remove('hidden');
            // Sincronizar desde Código a Visual si venimos de allá
            if (prevTab === 'code' && this.state.quillEditor) {
                const codeContent = document.getElementById('tpl-code-editor').value;
                this.state.quillEditor.clipboard.dangerouslyPasteHTML(this._cleanHtmlForEditor(codeContent));
            }
            setTimeout(() => this.state.quillEditor?.focus(), 50);
        } else if (tab === 'code') {
            document.getElementById('editor-code-container')?.classList.remove('hidden');
            // Sincronizar desde Visual a Código
            const body = this.state.quillEditor ? this.state.quillEditor.root.innerHTML : (this.state.editingTemplate?.body || '');
            document.getElementById('tpl-code-editor').value = body;
            setTimeout(() => document.getElementById('tpl-code-editor')?.focus(), 50);
        } else if (tab === 'preview') {
            document.getElementById('editor-preview-container')?.classList.remove('hidden');
            // Sincronizar antes de previsualizar
            if (prevTab === 'visual') {
                document.getElementById('tpl-code-editor').value = this.state.quillEditor?.root.innerHTML || '';
            }
            this._updateTemplatePreview();
        }
    },
    
    _updateTemplatePreview: function() {
        const activeTab = this.state.templateActiveTab || 'visual';
        let body = '';
        if (activeTab === 'visual' && this.state.quillEditor) {
            body = this.state.quillEditor.root.innerHTML;
        } else {
            body = document.getElementById('tpl-code-editor')?.value || '';
        }
        const subject = document.getElementById('tpl-subject').value || 'Vista Previa';
        const name = document.getElementById('tpl-name').value || 'Plantilla';
        
        const isLight = document.documentElement.classList.contains('light');
        const textColor = isLight ? '#0f172a' : '#f8fafc';
        const preview = `<!DOCTYPE html><html><head><style>body{font-family:'Inter',Arial,sans-serif;padding:0;margin:0;background:transparent;overflow-y:auto;color:${textColor};} .preview-wrapper{padding:20px;display:flex;justify-content:center;} .preview-card{background:transparent;width:100%;max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);}</style></head><body><div class="preview-wrapper"><div class="preview-card">${body}</div></div></body></html>`;
        
        const iframe = document.getElementById('tpl-preview-frame');
        if (iframe) {
            iframe.srcdoc = preview;
        }
    },
    
    saveTemplate: async function() {
        const name = document.getElementById('tpl-name').value.trim();
        const subject = document.getElementById('tpl-subject').value.trim();
        
        const activeTab = this.state.templateActiveTab || 'visual';
        let body = '';
        if (activeTab === 'visual' && this.state.quillEditor) {
            body = this.state.quillEditor.root.innerHTML;
        } else {
            body = document.getElementById('tpl-code-editor')?.value || '';
        }
        
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
                            <div class="flex gap-2">
                                <button data-action="showTemplateEditor" data-template-id="${t.id}" data-template-name="${(t.name || '').replace(/'/g, "&apos;")}" class="flex-1 px-3 py-1.5 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg text-xs font-bold">Editar</button>
                                <button data-action="deleteEmailTemplate" data-template-id="${t.id}" class="w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Eliminar">
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
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
                                <textarea id="ev-tpl-body-${t.template_type}" rows="18" class="input-field bg-slate-800/50 text-xs resize-y">${t.body || ''}</textarea>
                            </div>
                            <div class="text-[10px] text-slate-500">
                                Variables: {{guest_name}}, {{guest_email}}, {{event_name}}, {{event_date}}, {{event_location}}, {{checkin_time}}, {{agenda}}, {{organization}}
                            </div>
                            <button data-action="saveEventEmailTemplate" data-template-type="${t.template_type}" class="w-full py-2 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg text-xs font-bold">Guardar Plantilla</button>
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
                <button data-action="removeParent" class="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg">
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
<button data-action="removeParent" class="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg">
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
        console.log('[VIEW] Mostrando:', viewName);
        
        // Mapear y mostrar
        let targetId = "view-" + viewName;
        if (['legal', 'account'].includes(viewName)) targetId = "view-system";
        
        // Si la vista objetivo ya está visible, no hacer nada
        const target = document.getElementById(targetId);
        if (target && !target.classList.contains('hidden')) {
            console.log('[VIEW] Ya visible:', viewName);
            return;
        }
        
        if (viewName === 'login') {
            document.getElementById('view-login')?.classList.remove('hidden');
            if (document.getElementById('view-login')) document.getElementById('view-login').style.display = 'flex';
            document.getElementById('app-container')?.classList.add('hidden');
            if (clearSession) { window.LS.remove('user'); this.state.user = null; }
            return;
        } else {
            document.getElementById('view-login')?.classList.add('hidden');
            document.getElementById('app-container')?.classList.remove('hidden');
            if (document.getElementById('app-container')) document.getElementById('app-container').style.display = 'flex';
        }

        // Ocultar todas las secciones del app-shell
        const viewIds = ["view-my-events", "view-admin", "view-system", "view-groups", "view-smtp", "view-pre-registrations", "view-survey-manager"];
        viewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        if (target) {
            target.classList.remove('hidden');
        }

        // UI Sidebar
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let btnId = 'nav-btn-' + viewName;
        if (viewName === 'system') btnId = 'nav-btn-system';
        if (viewName === 'legal') btnId = 'nav-btn-legal';
        if (viewName === 'account') btnId = 'nav-btn-account';
        if (viewName === 'smtp') btnId = 'nav-btn-smtp';
        
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');

        window.scrollTo(0, 0);
    },

    navigate(viewName, params = {}, push = true) {
        console.log('[NAV] Navegando a:', viewName, params);
        
        if (push) {
            this._isPushingState = true;
            let url = viewName === 'my-events' ? '/' : `/${viewName}`;
            if (viewName === 'admin' && params.id) url = `/admin/${params.id}`;
            history.pushState({ view: viewName, params }, '', url);
            setTimeout(() => { this._isPushingState = false; }, 100);
        }

        this.showView(viewName);
        
        // Lógica específica por vista (V12.6.0 Unified Hub)
        if (viewName === 'my-events') this.loadEvents();
        if (viewName === 'system') window.switchSystemTab(params.tab || 'users');
        
        // Redirecciones de compatibilidad para el Hub unificado
        if (viewName === 'groups') { this.navigate('system', { tab: 'groups' }); return; }
        if (viewName === 'legal') { this.navigate('system', { tab: 'legal' }); return; }
        if (viewName === 'account') { this.navigate('system', { tab: 'account' }); return; }
        if (viewName === 'smtp') { this.navigate('system', { tab: 'email' }); return; }
        
        if (viewName === 'admin') {
            const id = params.id || (this.state.event ? this.state.event.id : null);
            if (id) {
                if (!this.state.event || String(this.state.event.id) !== String(id)) {
                    this.state.event = this.state.events.find(e => String(e.id) === String(id));
                }
                if (this.state.event) {
                    const event = this.state.event;
                    document.getElementById('admin-event-title').textContent = event.name;
                    document.getElementById('admin-event-location').textContent = event.location || 'UBICACIÓN';
                    
                    const logoImg = document.getElementById('admin-event-logo');
                    const logoPlaceholder = document.getElementById('admin-event-logo-placeholder');
                    if (logoImg && logoPlaceholder) {
                        if (event.logo_url) {
                            logoImg.src = event.logo_url;
                            logoImg.classList.remove('hidden');
                            logoPlaceholder.classList.add('hidden');
                        } else {
                            logoImg.classList.add('hidden');
                            logoPlaceholder.classList.remove('hidden');
                        }
                    }

                    this.updateStats();
                    this.loadGuests();
                }
 else {
                    this.navigate('my-events');
                }
            } else {
                this.navigate('my-events');
            }
        }

        if (viewName === 'groups') this.loadGroups();
        if (viewName === 'pre-registrations') this.loadPreRegistrations();
        if (viewName === 'survey-manager') this.loadSurveyQuestions();
        
        if (viewName === 'smtp') {
            const section = params.section || 'config';
            const smtpView = document.getElementById('view-smtp');
            if (smtpView && !smtpView.classList.contains('hidden')) {
                this.navigateEmailSection(section);
            }
        }
    },

    initRouter() {
        // Manejar navegación con el historial
        window.onpopstate = (e) => {
            if (this._isPushingState) return;
            
            if (e.state && e.state.view) {
                this.navigate(e.state.view, e.state.params || {}, false);
            } else {
                this.handleInitialNavigation();
            }
        };
    },

    handleInitialNavigation() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        
        const view = parts[0] || 'my-events';
        const params = {};
        
        if (view === 'admin' && parts[1]) {
            params.id = parts[1];
        }

        // Si es ADMIN y no hay vista específica, o es la raíz, redirigir a lo apropiado
        const user = this.state.user;
        if (!user) {
            this.showView('login');
            return;
        }

        if (view === 'my-events' || view === '' || view === 'index.html') {
            this.navigate('my-events', {}, false);
        } else {

            this.navigate(view, params, false);
        }
    },

    // --- AUTH ---
    async fetchAPI(endpoint, options = {}) { return API.fetchAPI(endpoint, options); },
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
            fetch(`/app-shell.html?v=${this.state.version}`)
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
        // Click listeners para elementos del app-shell
        const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        const hideModal = (id) => { const m = document.getElementById(id); if (m) m.classList.add('hidden'); };
        
        // Mostrar versión del servidor al cargar
        this.fetchAPI('/app-version').then(res => {
            const vd = document.getElementById('version-display');
            if (vd) vd.textContent = 'V' + res.version;
        }).catch(() => {});

        // Actualizar tema después de cargar app-shell
        this.initTheme();
        this.initSidebar();
        
        // Navigation - Sidebar (Unified V12.6.0)
        cl('btn-toggle-sidebar', () => this.toggleSidebar());
        cl('nav-btn-system', () => this.navigate('system'));
        cl('nav-btn-my-events', () => this.navigate('my-events'));
        cl('nav-btn-my-events', () => this.navigate('my-events'));
        cl('nav-btn-admin', () => this.navigate('admin'));
        cl('nav-btn-pre-registrations', () => this.navigate('pre-registrations'));
        cl('nav-btn-survey-manager', () => this.navigate('survey-manager'));
        
        // Sidebar footer
        cl('btn-toggle-theme', () => this.toggleTheme());
        cl('btn-logout', () => this.logout());
        
        // Admin view - action buttons
        cl('btn-show-qr', () => this.showQR());
        cl('btn-export-excel', () => this.exportExcel());
        cl('btn-generate-pdf', () => this.generateGuestListPdf());
        cl('btn-create-event-open', () => this.openCreateEventModal());
        cl('btn-create-group', () => this.openCompanyModal());
        
        // System tabs (Unified 5-Tab Hub)
        cl('sys-nav-users', () => window.switchSystemTab('users'));
        cl('sys-nav-groups', () => window.switchSystemTab('groups'));
        cl('sys-nav-legal', () => window.switchSystemTab('legal'));
        cl('sys-nav-email', () => window.switchSystemTab('email'));
        cl('sys-nav-account', () => window.switchSystemTab('account'));
        
        cl('btn-open-invite', () => this.openInviteModal());
        
        // Profile Security Forms (Phase 5)
        const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
        sf('change-email-form', (e) => this.handleEmailChange(e));
        sf('change-pass-form', (e) => this.handlePasswordChange(e));
        
        // Event Tabs (Fase 3: Multi-Tab en Evento)
        cl('ev-nav-guests', () => window.switchEventTab('guests'));
        cl('ev-nav-staff', () => window.switchEventTab('staff'));
        cl('btn-ev-staff-exist', () => window.App.showUserSelectorForEvent(window.App.state.event.id));
        cl('btn-ev-staff-new', () => this.openInviteModal());
        
        // Email section tabs
        cl('email-nav-config', () => this.navigateEmailSection('config'));
        cl('email-nav-mailbox', () => this.navigateEmailSection('mailbox'));
        cl('email-nav-templates', () => this.navigateEmailSection('templates'));
        cl('email-nav-mailing', () => this.navigateEmailSection('mailing'));
        cl('btn-sync-emails', () => this.syncEmails());
        cl('mail-folder-inbox', () => this.switchMailboxFolder('INBOX'));
        cl('mail-folder-sent', () => this.switchMailboxFolder('SENT'));
        
        // Legal modal
        cl('btn-open-policy', () => this.showLegalModal('policy'));
        cl('btn-open-terms', () => this.showLegalModal('terms'));
        cl('btn-close-legal', () => hideModal('modal-legal'));
        cl('btn-save-policy', () => this.saveLegalText('policy'));
        cl('btn-save-terms', () => this.saveLegalText('terms'));
        
        // Modal close buttons
        cl('btn-close-mail-view', () => this.closeMailView());
        cl('btn-close-event-modal', () => hideModal('modal-event'));
        cl('btn-close-invite', () => hideModal('modal-invite'));
        cl('btn-close-company', () => hideModal('modal-company'));
        cl('btn-close-qr', () => hideModal('modal-qr'));
        cl('btn-close-ticket', () => hideModal('modal-ticket'));
        cl('btn-close-import-results', () => hideModal('modal-import-results'));
        cl('btn-close-import-results-2', () => hideModal('modal-import-results'));
        cl('btn-stop-scanner', () => this.stopScanner());
        cl('btn-start-scan', () => this.startScanner());
        cl('btn-manual-checkin', () => this.manualCheckin());
        cl('btn-close-template-editor', () => this.closeTemplateEditor());
        cl('btn-cancel-template', () => this.closeTemplateEditor());
        cl('btn-close-event-email', () => this.closeEventEmailConfig());
        cl('btn-cancel-event-email', () => this.closeEventEmailConfig());
        cl('btn-close-survey-editor', () => this.closeSurveyEditor());
        cl('btn-cancel-survey', () => this.closeSurveyEditor());
        cl('btn-confirm-import', () => this.confirmImport());
        cl('btn-save-event-email', () => this.saveEventEmailConfig());
        cl('btn-cancel-event', () => hideModal('modal-event'));
        cl('btn-cancel-invite', () => hideModal('modal-invite'));
        cl('btn-cancel-company', () => hideModal('modal-company'));

        // EVENT DELEGATION para botones dinámicos (reemplaza onclick inline violando CSP)
        // Los templates dinámicos usan data-action y data-params-* en lugar de onclick
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            const p = target.dataset; // shortcut to dataset
            const _App = window.App; // Garantizar acceso al objeto global
            
            try {
                switch(action) {
                    // Groups management
                    case 'removeUserFromGroup': _App.removeUserFromGroup(p.userId, p.groupId); break;
                    case 'showUserSelectorForGroup': _App.showUserSelectorForGroup(p.groupId); break;
                    case 'openCompanyModal': _App.openCompanyModal(p.groupId); break;
                    case 'assignUserToGroupFromSelector': _App.assignUserToGroupFromSelector(p.groupId); break;
                    case 'closeUserSelectorGroup': _App.closeUserSelectorGroup(); break;
                    case 'assignUserToEventFromSelector': _App.assignUserToEventFromSelector(p.eventId); break;
                    case 'closeUserSelectorEvent': _App.closeUserSelectorEvent(); break;
                    
                    // Users management
                    case 'approveUser': _App.approveUser(p.userId, p.status); break;
                    case 'removeUserGroup': _App.removeUserGroup(p.userId); break;
                    case 'showGroupSelector': _App.showGroupSelector(p.userId, p.groupId || ''); break;
                    case 'removeUserFromEvent': _App.removeUserFromEvent(p.userId, p.eventId); break;
                    case 'showEventSelector': 
                        let evs = [];
                        try { evs = JSON.parse(p.events || '[]'); } catch(e) { console.error("Error parsing events", e); }
                        _App.showEventSelector(p.userId, evs); 
                        break;
                    case 'assignUserGroupFromSelector': _App.assignUserGroupFromSelector(p.userId); break;
                    case 'navigateToCreateGroup': _App.navigateToCreateGroup(p.userId); break;
                    case 'closeGroupSelector': _App.closeGroupSelector(); break;
                    case 'assignEventFromSelector': _App.assignEventFromSelector(p.userId); break;
                    case 'navigateToCreateEvent': _App.navigateToCreateEvent(p.userId); break;
                    case 'closeEventSelector': _App.closeEventSelector(); break;
                    
                    // Email
                    case 'viewMailDetail': _App.viewMailDetail(p.mailId); break;
                    case 'insertVariable': _App.insertVariable(p.varName); break;
                    case 'showTemplateEditor': _App.showTemplateEditor(p.templateId, p.templateName); break;
                    case 'deleteEmailTemplate': _App.deleteEmailTemplate(p.templateId); break;
                    case 'saveEventEmailTemplate': _App.saveEventEmailTemplate(p.templateType); break;
                    case 'removeParent': e.target.closest('[data-index]')?.remove() || e.target.closest('.account-item')?.remove(); break;
                    
                    // Pre-reg
                    case 'updatePreRegStatus': _App.updatePreRegStatus(p.prId, p.status); break;
                    
                    // Survey
                    case 'openSurveyEditor': _App.openSurveyEditor(p.questionId); break;
                    case 'deleteSurveyQuestion': _App.deleteSurveyQuestion(p.questionId); break;
                    
                    // Events
                    case 'openEvent': _App.openEvent(p.eventId); break;
                    case 'editEvent': _App.editEvent(p.eventId); break;
                    case 'deleteEvent': _App.deleteEvent(p.eventId); break;
                    case 'copyRegistrationLink': _App.copyRegistrationLink(p.eventId); break;
                    case 'showUserSelectorForEvent': _App.showUserSelectorForEvent(p.eventId); break;
                    
                    // Guests
                    case 'generateCertificate': _App.generateCertificate(p.guestId); break;
                    case 'showTicket': _App.showTicket(p.guestId); break;
                    case 'editGuest': _App.editGuest(p.guestId); break;
                    case 'deleteGuest': _App.deleteGuest(p.guestId); break;
                }
            } catch(err) {
                console.error("[DELEGATION] Error executing action:", action, err);
            }
        });

        // EVENT DELEGATION para selects dinámicos (changeUserRole)
        document.body.addEventListener('change', (e) => {
            const select = e.target.closest('select[data-action]');
            if (!select) return;
            if (select.dataset.action === 'changeUserRole') {
                App.changeUserRole(select.dataset.userId, select.value);
            }
        });
    },
    
    openCreateEventModal: function() {
        document.getElementById('new-event-form')?.reset();
        document.getElementById('ev-id-hidden').value = '';
        document.getElementById('modal-event')?.classList.remove('hidden');
    },
    
    saveLegalText: async function(type) {
        const editorId = type === 'policy' ? 'editor-policy' : 'editor-terms';
        const content = document.getElementById(editorId)?.textContent || '';
        try {
            await this.fetchAPI('/settings/legal', {
                method: 'PUT',
                body: JSON.stringify({ type, content })
            });
            alert('✓ Configuración guardada.');
        } catch(e) { alert('Error al guardar.'); }
    },
    async loadAppVersion() {
        try {
            const d = await fetch('/api/app-version').then(r => r.json());
            this.state.version = d.version;
            document.querySelectorAll('.app-version-label').forEach(el => el.innerText = `Check Pro V${d.version}`);
            document.querySelectorAll('.app-version-text').forEach(el => el.innerText = `V${d.version}`);
        } catch(e) {}
    },

    // --- PRE-REGISTRATIONS (NUEVO V11.6) ---
    async loadPreRegistrations() {
        if (!this.state.event) return;
        const tbody = document.getElementById('pre-reg-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-500 font-bold">Cargando solicitudes...</td></tr>';
        
        try {
            const data = await this.fetchAPI(`/events/${this.state.event.id}/pre-registrations`);
            if (tbody) {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-500 font-bold">No hay pre-inscripciones pendientes</td></tr>';
                    return;
                }
                tbody.innerHTML = data.map(pr => `
                    <tr class="hover:bg-white/2 transition-colors">
                        <td class="px-6 py-4">
                            <div class="font-bold text-white">${pr.full_name}</div>
                            <div class="text-[10px] text-slate-500 font-mono">${pr.email}</div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="text-white text-xs">${pr.organization || '-'}</div>
                            <div class="text-[9px] text-slate-500 uppercase font-black">${pr.position || '-'}</div>
                        </td>
                        <td class="px-6 py-4 text-xs text-slate-400">
                            ${new Date(pr.created_at).toLocaleString()}
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="status-pill status-pending">Pendiente</span>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <div class="flex justify-end gap-2">
                                <button data-action="updatePreRegStatus" data-pr-id="${pr.id}" data-status="APPROVED" class="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all" title="Aprobar">
                                    <span class="material-symbols-outlined text-sm">check_circle</span>
                                </button>
                                <button data-action="updatePreRegStatus" data-pr-id="${pr.id}" data-status="REJECTED" class="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all" title="Rechazar">
                                    <span class="material-symbols-outlined text-sm">cancel</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) { console.error("Error al cargar pre-registros", e); }
    },

    async updatePreRegStatus(id, status) {
        if (!confirm(`¿Estás seguro de ${status === 'APPROVED' ? 'APROBAR' : 'RECHAZAR'} esta solicitud?`)) return;
        try {
            await this.fetchAPI(`/pre-registrations/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            this.loadPreRegistrations();
            if (status === 'APPROVED' && this.state.event) {
                this.updateStats();
            }
        } catch (e) { alert('Error al actualizar estado'); }
    },

    // --- SURVEYS (NUEVO V11.6) ---
    async loadSurveyQuestions() {
        if (!this.state.event) return;
        const list = document.getElementById('survey-questions-list');
        if (list) list.innerHTML = '<div class="p-10 text-center text-slate-500 font-bold">Cargando encuesta...</div>';
        
        try {
            const data = await this.fetchAPI(`/events/${this.state.event.id}/surveys`);
            if (list) {
                if (data.length === 0) {
                    list.innerHTML = `
                        <div class="glass-card p-12 rounded-[40px] border border-dashed border-white/10 text-center">
                            <span class="material-symbols-outlined text-6xl text-slate-800 mb-4">poll</span>
                            <p class="text-slate-500 font-bold">No has creado preguntas todavía.</p>
                            <p class="text-[10px] text-slate-600 uppercase mt-2">Personaliza la encuesta QR de tu evento</p>
                        </div>
                    `;
                } else {
                    list.innerHTML = data.map(q => `
                        <div class="glass-card p-6 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500">
                                    <span class="material-symbols-outlined text-sm">
                                        ${q.type === 'text' ? 'description' : q.type === 'binary' ? 'thumbs_up_down' : q.type === 'rating' ? 'stars' : 'list'}
                                    </span>
                                </div>
                                <div>
                                    <h5 class="text-sm font-bold text-white">${q.title}</h5>
                                    <p class="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                        Tipo: ${q.type === 'text' ? 'Abierta' : q.type === 'binary' ? 'Booleana' : q.type === 'rating' ? 'Calificación' : 'Opción Múltiple'}
                                    </p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button data-action="openSurveyEditor" data-question-id="${q.id}" class="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all">
                                    <span class="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button data-action="deleteSurveyQuestion" data-question-id="${q.id}" class="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }
            const resp = await this.fetchAPI(`/events/${this.state.event.id}/surveys/responses`);
            const cEl = document.getElementById('survey-response-count');
            if (cEl) cEl.innerText = resp.length;
        } catch (e) { console.error("Error al cargar encuesta", e); }
    },

    openSurveyEditor(questionId = null) {
        this.toggleSurveyOptions();
        const m = document.getElementById('modal-survey-editor');
        const f = document.getElementById('survey-question-form');
        f.reset();
        document.getElementById('survey-question-id').value = questionId || '';
        m.classList.remove('hidden');
    },

    toggleSurveyOptions() {
        const type = document.getElementById('survey-question-type').value;
        const container = document.getElementById('survey-options-container');
        if (container) container.classList.toggle('hidden', type !== 'multiple');
    },

    async saveSurveyQuestion() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        const data = {
            title: document.getElementById('survey-question-title').value,
            type: document.getElementById('survey-question-type').value,
            options: document.getElementById('survey-question-options').value
        };
        const id = document.getElementById('survey-question-id').value;
        try {
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `/surveys/${id}` : `/events/${eventId}/surveys`;
            await this.fetchAPI(endpoint, { method, body: JSON.stringify(data) });
            document.getElementById('modal-survey-editor').classList.add('hidden');
            this.loadSurveyQuestions();
        } catch (e) { alert('Error al guardar la pregunta'); }
    },

    async deleteSurveyQuestion(id) {
        if (!confirm('¿Eliminar esta pregunta?')) return;
        try {
            await this.fetchAPI(`/surveys/${id}`, { method: 'DELETE' });
            this.loadSurveyQuestions();
        } catch (e) { alert('Error al eliminar'); }
    },

    exportSurveyResponses() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        window.open(`${this.constants.API_URL}/events/${eventId}/surveys/responses/export?userId=${this.state.user.userId}`, '_blank');
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
            <div data-action="openEvent" data-event-id="${ev.id}" class="card p-7 hover:shadow-md transition-all relative group cursor-pointer border-[var(--border)]">
                <div class="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button data-action="editEvent" data-event-id="${ev.id}" class="w-9 h-9 rounded-full bg-[var(--bg-hover)] flex items-center justify-center hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-all">
                        <span class="material-symbols-outlined text-base">edit</span>
                    </button>
                </div>
                <div class="w-12 h-12 bg-[var(--primary-light)] text-[var(--primary)] rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                    <span class="material-symbols-outlined text-2xl font-variation-fill">event</span>
                </div>
                <h3 class="text-xl font-bold mb-2 text-[var(--text-main)]">${ev.name}</h3>
                <p class="text-[var(--text-secondary)] text-sm line-clamp-2 mb-5 leading-relaxed">${ev.description || 'Sin descripción adicional para este evento.'}</p>
                <div class="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.1em]">
                    <span class="material-symbols-outlined text-base text-[var(--primary)]">place</span> ${ev.location || 'Ubicación por confirmar'}
                </div>
                <div class="mt-6 pt-5 border-t border-[var(--border)] flex items-center justify-between">
                    <span class="text-[11px] font-bold text-[var(--text-secondary)]">${new Date(ev.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <div class="flex gap-3" onclick="event.stopPropagation()">
                        <button data-action="copyRegistrationLink" data-event-id="${ev.id}" class="text-[var(--primary)] hover:text-[var(--primary)]/80 text-[11px] font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">link</span> Link
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async copyRegistrationLink(id) {
        if(id && typeof id === 'object') id = id.target?.closest('[data-action]')?.dataset.eventId;
        const link = `${window.location.origin}/registro.html?event=${id}`;
        try {
            await navigator.clipboard.writeText(link);
            this._notifyAction('Enlace Copiado', 'El link de registro se ha copiado al portapapeles.', 'success');
        } catch (err) {
            prompt('Copia este link:', link);
        }
    },

    editEvent(id) {
        if(id && typeof id === 'object') id = id.target?.closest('[data-action]')?.dataset.eventId;
        const ev = this.state.events.find(e => String(e.id) === String(id));
        if (!ev) return;
        
        document.getElementById('ev-id-hidden').value = ev.id;
        document.getElementById('ev-name').value = ev.name || '';
        document.getElementById('ev-location').value = ev.location || '';
        document.getElementById('ev-desc').value = ev.description || '';
        document.getElementById('ev-date').value = ev.date ? ev.date.slice(0, 16) : '';
        document.getElementById('ev-end-date').value = ev.end_date ? ev.end_date.slice(0, 16) : '';
        
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
        
        document.getElementById('ev-qr-dark').value = ev.qr_color_dark || '#000000';
        document.getElementById('ev-qr-light').value = ev.qr_color_light || '#ffffff';
        document.getElementById('ev-qr-logo').value = ev.qr_logo_url || '';
        document.getElementById('ev-ticket-bg').value = ev.ticket_bg_url || '';
        document.getElementById('ev-ticket-accent').value = ev.ticket_accent_color || '#7c3aed';
        
        document.getElementById('ev-reg-whitelist').value = ev.reg_email_whitelist || '';
        document.getElementById('ev-reg-blacklist').value = ev.reg_email_blacklist || '';
        
        this.updateQRPreview();
        document.getElementById('modal-event')?.classList.remove('hidden');
    },

    async deleteEvent(id) {
        if(id && typeof id === 'object') id = id.target?.closest('[data-action]')?.dataset.eventId;
        if (await this._confirmAction('¿Eliminar evento?', 'Esta acción es irreversible y borrará todos los datos asociados.')) {
            try {
                await this.fetchAPI(`/events/${id}`, { method: 'DELETE' });
                this._notifyAction('Eliminado', 'Evento eliminado correctamente', 'success');
                this.loadEvents();
            } catch (e) { 
                this._notifyAction('Error', 'No se pudo eliminar: ' + e.message, 'error'); 
            }
        }
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
        const res = await this.fetchAPI(`/guests/${this.state.event.id}`);
        this.state.guests = Array.isArray(res) ? res : (res.data || []);
        
        const filterOrg = document.getElementById('filter-guest-org');
        if (filterOrg) {
            const orgs = [...new Set(this.state.guests.map(g => g.organization).filter(Boolean))];
            filterOrg.innerHTML = '<option value="">Todas las empresas</option>' + 
                orgs.map(o => `<option value="${o}">${o}</option>`).join('');
        }
        
        this.initColumnConfig(); // Asegurar columnas cargadas
        this.renderGuestsTarget(this.state.guests);
    },
    
    // --- COLUMNAS DINÁMICAS V12.1 ---
    initColumnConfig() {
        const saved = LS.get('column_config_' + (this.state.event?.id || 'default'));
        if (saved) {
            try { this.state.columnConfig = JSON.parse(saved); } catch(e) {}
        }
        this.renderColumnOptions();
    },
    
    toggleColumnConfig() {
        const menu = document.getElementById('column-config-menu');
        if (menu) menu.classList.toggle('hidden');
    },
    
    toggleColumn(id) {
        if (this.state.columnConfig[id]) {
            this.state.columnConfig[id].visible = !this.state.columnConfig[id].visible;
            LS.set('column_config_' + (this.state.event?.id || 'default'), JSON.stringify(this.state.columnConfig));
            this.renderColumnOptions();
            this.renderGuestsTarget(this.state.guests);
        }
    },
    
    renderColumnOptions() {
        const list = document.getElementById('column-options-list');
        if (!list) return;
        list.innerHTML = Object.entries(this.state.columnConfig).map(([id, cfg]) => `
            <label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/5 rounded-xl transition-colors">
                <input type="checkbox" ${cfg.visible ? 'checked' : ''} onchange="App.toggleColumn('${id}')" class="w-4 h-4 accent-primary">
                <span class="text-xs font-bold ${cfg.visible ? 'text-white' : 'text-slate-500'}">${cfg.label}</span>
            </label>
        `).join('');
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
        const tb = document.getElementById('guests-tbody-admin') || document.getElementById('guests-tbody');
        if (!tb) return;
        
        const cfg = this.state.columnConfig;
        
        // Actualizar visibilidad de headers
        const th_name = document.getElementById('th-name');
        const th_org = document.getElementById('th-org');
        const th_status = document.getElementById('th-status');
        
        if (th_name) th_name.style.display = cfg.name.visible ? '' : 'none';
        if (th_org) th_org.style.display = cfg.organization.visible ? '' : 'none';
        if (th_status) th_status.style.display = cfg.status.visible ? '' : 'none';

        tb.innerHTML = list.map(g => {
            const isChecked = g.checked_in;
            const healthAlert = (g.dietary_notes || '').length > 0;
            
            return `
            <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)] last:border-none group">
                <td class="px-6 py-4" style="display: ${cfg.name.visible ? '' : 'none'}">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full ${isChecked ? 'bg-[var(--primary)]' : 'bg-[var(--bg-hover)]'} flex items-center justify-center text-white relative shadow-sm">
                            <span class="material-symbols-outlined text-xl">${isChecked ? 'verified' : 'person'}</span>
                            ${healthAlert ? '<span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-card)]"></span>' : ''}
                        </div>
                        <div>
                            <p class="font-bold text-sm text-[var(--text-main)]">${g.name}</p>
                            <p class="text-[11px] text-[var(--text-secondary)] font-mono flex items-center gap-1">
                                ${g.email || 'S/E'}
                                ${cfg.phone.visible && g.phone ? ` <span class="mx-1 opacity-30">|</span> ${g.phone}` : ''}
                            </p>
                            ${cfg.position.visible && g.position ? `<p class="text-[10px] text-[var(--primary)] font-bold uppercase mt-1">${g.position}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4" style="display: ${cfg.organization.visible ? '' : 'none'}">
                    <div class="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-main)] transition-colors">${g.organization || '---'}</div>
                </td>
                <td class="px-6 py-4 text-center" style="display: ${cfg.status.visible ? '' : 'none'}">
                    <span class="status-pill ${isChecked ? 'status-active' : 'status-pending'}">
                        ${isChecked ? 'Acreditado' : 'Pendiente'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${isChecked ? `
                            <button data-action="generateCertificate" data-guest-id="${g.id}" class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center" title="Certificado">
                                <span class="material-symbols-outlined text-sm">workspace_premium</span>
                            </button>
                        ` : ''}
                        <button data-action="showTicket" data-guest-id="${g.id}" class="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all flex items-center justify-center" title="QR">
                            <span class="material-symbols-outlined text-sm">qr_code</span>
                        </button>
                        <button data-action="editGuest" data-guest-id="${g.id}" class="w-8 h-8 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button data-action="deleteGuest" data-guest-id="${g.id}" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
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
        try {
            const s = await this.fetchAPI(`/stats/${this.state.event.id}`);
            const sv = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            
            // KPIs Principales
            sv('stat-total', s.total);
            sv('stat-orgs', s.orgs);
            sv('stat-presence', s.total > 0 ? Math.round((s.checkedIn / s.total) * 100) + '%' : '0%');
            sv('stat-onsite', s.onsite || 0);
            
            // Restricciones dietéticas
            const dietaryRestrictions = s.dietaryDistribution?.reduce((sum, d) => 
                d.diet_type !== 'Sin restricciones' ? sum + d.count : sum, 0
            ) || 0;
            sv('stat-health', dietaryRestrictions);
            
            // Renderizar Dashboard de Analítica
            this.renderAnalyticsDashboard(s);
        } catch (e) { console.error('Error actualizando estadísticas:', e); }
    },

    renderAnalyticsDashboard(data) {
        if (typeof Chart === 'undefined') return;
        
        // Inicializar contenedor de gráficas si no existe
        if (!this.state.charts) this.state.charts = {};

        this.renderFlowChart(data.flowData);
        this.renderOrgChart(data.orgDistribution);
        this.renderStatusChart(data);
        this.renderMailingChart(data.mailingStats);
        this.renderGenderChart(data.genderDistribution);
        this.renderDietaryChart(data.dietaryDistribution);
    },

    renderFlowChart(flow) {
        const ctx = document.getElementById('flowChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.flow) this.state.charts.flow.destroy();
        
        this.state.charts.flow = new Chart(ctx, {
            type: 'line',
            data: {
                labels: (flow || []).map(d => d.hour + ':00'),
                datasets: [{
                    label: 'Registros',
                    data: (flow || []).map(d => d.count),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
                }
            }
        });
    },

    renderOrgChart(orgs) {
        const ctx = document.getElementById('orgChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.org) this.state.charts.org.destroy();
        
        this.state.charts.org = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: (orgs || []).map(o => o.organization),
                datasets: [{
                    data: (orgs || []).map(o => o.count),
                    backgroundColor: ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    },

    renderStatusChart(data) {
        const ctx = document.getElementById('statusChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.status) this.state.charts.status.destroy();
        
        const pending = data.total - data.checkedIn;
        
        this.state.charts.status = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Acreditados', 'Pendientes'],
                datasets: [{
                    data: [data.checkedIn, pending],
                    backgroundColor: ['#10b981', 'rgba(255,255,255,0.05)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11, weight: 'bold' } }
                    }
                }
            }
        });
    },

    renderMailingChart(stats) {
        const ctx = document.getElementById('mailingChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.mailing) this.state.charts.mailing.destroy();
        
        this.state.charts.mailing = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Enviados', 'Errores'],
                datasets: [{
                    data: [stats.sent, stats.errors],
                    backgroundColor: ['#7c3aed', '#ef4444'],
                    borderRadius: 8,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11, weight: 'bold' } } }
                }
            }
        });
    },

    renderGenderChart(genderDistribution) {
        const ctx = document.getElementById('genderChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.gender) this.state.charts.gender.destroy();
        
        // Mapear códigos de género a etiquetas
        const genderLabels = {
            'M': 'Masculino',
            'F': 'Femenino',
            'O': 'Otro'
        };
        
        const labels = (genderDistribution || []).map(g => genderLabels[g.gender] || g.gender);
        const data = (genderDistribution || []).map(g => g.count);
        
        this.state.charts.gender = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    },

    renderDietaryChart(dietaryDistribution) {
        const ctx = document.getElementById('dietaryChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.state.charts.dietary) this.state.charts.dietary.destroy();
        
        const labels = (dietaryDistribution || []).map(d => d.diet_type);
        const data = (dietaryDistribution || []).map(d => d.count);
        
        this.state.charts.dietary = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#10b981', '#f59e0b', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11, weight: 'bold' } }
                    }
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
        
        // Reset modales y barras
        document.getElementById('modal-import-progress').classList.remove('hidden');
        document.getElementById('import-success-actions').classList.add('hidden');
        document.getElementById('upload-bar').style.width = '0%';
        document.getElementById('upload-perc').innerText = '0%';
        document.getElementById('process-bar').style.width = '0%';
        document.getElementById('process-perc').innerText = '0%';
        document.getElementById('import-progress-status').innerText = 'Iniciando subida...';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('event_id', this.state.event.id);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/import-preview');
            if (this.state.user) xhr.setRequestHeader('x-user-id', this.state.user.userId);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const p = Math.round((e.loaded / e.total) * 100);
                    document.getElementById('upload-bar').style.width = p + '%';
                    document.getElementById('upload-perc').innerText = p + '%';
                }
            };

            xhr.onload = async () => {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    document.getElementById('modal-import-progress').classList.add('hidden');
                    this.state.importSession = data;
                    this.showImportMapping(data);
                } else {
                    alert("Error: " + data.error);
                    document.getElementById('modal-import-progress').classList.add('hidden');
                }
            };

            xhr.send(formData);
        } catch (e) { alert("Error de conexión al importar."); }
    },

    showImportMapping(data) {
        const modal = document.getElementById('modal-import-mapping');
        const tbody = document.getElementById('import-mapping-tbody');
        modal.classList.remove('hidden');

        const dbFields = [
            { id: 'name', label: 'Nombre Completo', keywords: ['nombre', 'name', 'invitado', 'full name'] },
            { id: 'email', label: 'Email / Correo', keywords: ['email', 'correo', 'mail', 'usuario'] },
            { id: 'organization', label: 'Empresa / Entidad', keywords: ['empresa', 'org', 'entidad', 'compan', 'company'] },
            { id: 'phone', label: 'Teléfono / Móvil', keywords: ['tel', 'cel', 'phone', 'movil'] },
            { id: 'gender', label: 'Género (M/F/O)', keywords: ['sexo', 'genero', 'gender'] },
            { id: 'position', label: 'Cargo', keywords: ['cargo', 'puesto', 'position', 'rol'] },
            { id: 'dietary_notes', label: 'Alergias / Dieta', keywords: ['alergia', 'dieta', 'salud', 'obs', 'coment'] }
        ];

        tbody.innerHTML = dbFields.map(field => {
            // Auto-detectar índice
            let detectedIdx = data.headers.findIndex(h => 
                field.keywords.some(k => h.toLowerCase().includes(k))
            );
            
            const options = data.headers.map((h, i) => 
                `<option value="${i}" ${i === detectedIdx ? 'selected' : ''}>${h}</option>`
            ).join('');

            const previewText = detectedIdx !== -1 && data.rows[0] ? data.rows[0][detectedIdx] : '---';

            return `
                <tr class="bg-white/2 rounded-xl group">
                    <td class="px-4 py-3 font-bold text-white text-xs">${field.label}</td>
                    <td class="px-4 py-3">
                        <select data-field="${field.id}" onchange="App.updateMappingPreview(this)" class="bg-slate-900 text-slate-300 text-[10px] font-bold rounded-lg px-3 py-2 border border-white/5 w-full">
                            <option value="">-- Ignorar campo --</option>
                            ${options}
                        </select>
                    </td>
                    <td id="preview-${field.id}" class="px-4 py-3 text-[10px] text-slate-500 font-mono italic">${previewText || '---'}</td>
                </tr>
            `;
        }).join('');
    },

    updateMappingPreview(select) {
        const field = select.dataset.field;
        const idx = select.value;
        const previewEl = document.getElementById(`preview-${field}`);
        if (previewEl) {
            previewEl.innerText = (idx !== "" && this.state.importSession.rows[0]) 
                ? this.state.importSession.rows[0][idx] 
                : '---';
        }
    },

    async confirmImport() {
        const selects = document.querySelectorAll('#import-mapping-tbody select');
        const mapping = {};
        selects.forEach(s => { if (s.value !== "") mapping[s.dataset.field] = parseInt(s.value); });

        document.getElementById('modal-import-mapping').classList.add('hidden');
        document.getElementById('modal-import-progress').classList.remove('hidden');
        document.getElementById('upload-bar-container').classList.add('opacity-30');
        document.getElementById('process-bar-container').classList.remove('opacity-30');
        document.getElementById('import-progress-icon').innerHTML = '<span class="material-symbols-outlined text-4xl text-emerald-500">sync</span>';
        document.getElementById('import-progress-title').innerText = 'Procesando Datos...';

        try {
            const res = await this.fetchAPI('/import-confirm', {
                method: 'POST',
                body: JSON.stringify({ event_id: this.state.event.id, mapping })
            });

            if (res.success) {
                document.getElementById('process-bar').style.width = '100%';
                document.getElementById('process-perc').innerText = '100%';
                document.getElementById('import-progress-status').innerText = `✓ ${res.count} invitados importados (${res.skipped} duplicados omitidos).`;
                document.getElementById('import-success-actions').classList.remove('hidden');
            } else {
                alert("Error: " + res.error);
                document.getElementById('modal-import-progress').classList.add('hidden');
            }
        } catch (e) { 
            alert("Error al confirmar importación.");
            document.getElementById('modal-import-progress').classList.add('hidden');
        }
    },

    closeImportProgress() {
        document.getElementById('modal-import-progress').classList.add('hidden');
        this.loadGuests();
        this.updateStats();
    },
    
    // --- PDF GENERATION (FASE 10) ---
    async generateCertificate(guestId) {
        const g = this.state.guests.find(x => x.id === guestId);
        if (!g || !this.state.event) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const accent = this.state.event.ticket_accent_color || '#7c3aed';
        
        // Fondo y Marco Premium
        doc.setFillColor(15, 23, 42); // bg-slate-900
        doc.rect(0, 0, 297, 210, 'F');
        
        doc.setDrawColor(accent);
        doc.setLineWidth(2);
        doc.rect(10, 10, 277, 190);
        doc.setLineWidth(0.5);
        doc.rect(13, 13, 271, 184);
        
        // Contenido
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(40);
        doc.text('CERTIFICADO', 148.5, 60, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(accent);
        doc.text('DE ASISTENCIA Y PARTICIPACIÓN', 148.5, 75, { align: 'center' });
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('Se otorga el presente reconocimiento a:', 148.5, 100, { align: 'center' });
        
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text(g.name.toUpperCase(), 148.5, 120, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`Por su valiosa participación en el evento:`, 148.5, 140, { align: 'center' });
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accent);
        doc.text(this.state.event.name, 148.5, 155, { align: 'center' });
        
        // Footer certificado
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date(this.state.event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`${this.state.event.location || 'S/L'} - ${dateStr}`, 148.5, 180, { align: 'center' });
        
        // Firma / Sello
        doc.setDrawColor(255, 255, 255, 0.2);
        doc.line(110, 175, 187, 175);
        
        doc.save(`Certificado_${g.name.replace(/\s+/g, '_')}.pdf`);
    },

    async generateEventReport() {
        if (!this.state.event) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const event = this.state.event;
        const stats = await this.fetchAPI(`/stats/${event.id}`);
        
        // Cabecera Reporte
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE EJECUTIVO DE ASISTENCIA', 15, 20);
        doc.setFontSize(10);
        doc.text(`CHECK APP v12.2 - ${new Date().toLocaleString()}`, 15, 30);
        
        // KPIs
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.text('RESUMEN DE MÉTRICAS', 15, 55);
        
        const kpis = [
            ['Total Invitados', stats.total.toString()],
            ['Acreditados', stats.checkedIn.toString()],
            ['Ausentes', (stats.total - stats.checkedIn).toString()],
            ['% de Asistencia', (stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0) + '%'],
            ['Acreditaciones On-site', (stats.onsite || 0).toString()]
        ];
        
        doc.autoTable({
            startY: 60,
            head: [['Indicador', 'Valor']],
            body: kpis,
            theme: 'striped',
            headStyles: { fillColor: [124, 58, 237] }
        });
        
        // Tabla de Invitados
        doc.text('LISTADO DETALLADO DE ASISTENCIA', 15, doc.lastAutoTable.finalY + 15);
        
        const guestsData = this.state.guests.map(g => [
            g.name,
            g.email || '---',
            g.organization || '---',
            g.checked_in ? 'SÍ' : 'NO',
            g.checkin_time ? new Date(g.checkin_time).toLocaleTimeString() : '---'
        ]);
        
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [['Nombre', 'Email', 'Empresa', 'Acreditado', 'Hora']],
            body: guestsData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [51, 65, 85] }
        });
        
        doc.save(`Reporte_Check_${event.name.replace(/\s+/g, '_')}.pdf`);
    },



    // ─── PDF MEJORADOS CON DISEÑOS PROFESIONALES ───
    
    // Asegurar que las librerías PDF estén cargadas
    async ensurePDFLibsLoaded() {
        if (typeof window.jspdf === 'undefined') {
            await this.loadJsPDF();
        }
        // Esperar un momento para que se registre autoTable
        await new Promise(resolve => setTimeout(resolve, 100));
    },

    // Cargar imagen para usar en PDF
    async loadImageForPDF(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = url;
        });
    },

    // Generar certificado mejorado con logo y plantillas
    async generateEnhancedCertificate(guestId, template = 'premium') {
        await this.ensurePDFLibsLoaded();
        const g = this.state.guests.find(x => x.id === guestId);
        if (!g || !this.state.event) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const event = this.state.event;
        const accent = event.ticket_accent_color || '#7c3aed';
        const logoUrl = event.logo_url;
        
        // Fondo según plantilla
        if (template === 'premium') {
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, 297, 210, 'F');
        } else if (template === 'light') {
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, 297, 210, 'F');
        } else if (template === 'corporate') {
            doc.setFillColor(240, 249, 255); // azul claro
            doc.rect(0, 0, 297, 210, 'F');
        }
        
        // Marco decorativo
        doc.setDrawColor(accent);
        doc.setLineWidth(2);
        doc.rect(10, 10, 277, 190);
        doc.setLineWidth(0.5);
        doc.rect(13, 13, 271, 184);
        
        // Logo del evento (si existe)
        if (logoUrl) {
            try {
                const logoData = await this.loadImageForPDF(logoUrl);
                doc.addImage(logoData, 'PNG', 20, 15, 30, 30);
            } catch (e) {
                console.warn('No se pudo cargar logo:', e);
            }
        }
        
        // Contenido principal
        doc.setTextColor(template === 'light' ? 15 : 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(40);
        doc.text('CERTIFICADO', 148.5, 60, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(accent);
        doc.text('DE ASISTENCIA Y PARTICIPACIÓN', 148.5, 75, { align: 'center' });
        
        doc.setTextColor(template === 'light' ? 51 : 255);
        doc.setFontSize(16);
        doc.text('Se otorga el presente reconocimiento a:', 148.5, 100, { align: 'center' });
        
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text(g.name.toUpperCase(), 148.5, 120, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`Por su valiosa participación en el evento:`, 148.5, 140, { align: 'center' });
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accent);
        doc.text(event.name, 148.5, 155, { align: 'center' });
        
        // Información del evento
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`${event.location || 'S/L'} - ${dateStr}`, 148.5, 180, { align: 'center' });
        
        // Código único
        doc.setFontSize(8);
        doc.text(`ID: ${g.id.substring(0, 8).toUpperCase()}`, 148.5, 190, { align: 'center' });
        
        doc.save(`Certificado_${event.name.replace(/\s+/g, '_')}_${g.name.replace(/\s+/g, '_')}.pdf`);
    },

    // Generar lista de invitados en PDF con filtros
    async generateGuestListPDF(filters = {}) {
        await this.ensurePDFLibsLoaded();
        if (!this.state.event) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const event = this.state.event;
        const logoUrl = event.logo_url;
        const accent = event.ticket_accent_color || '#7c3aed';
        
        // Cabecera con logo
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('LISTA DE INVITADOS', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(event.name, 105, 28, { align: 'center' });
        
        // Logo
        if (logoUrl) {
            try {
                const logoData = await this.loadImageForPDF(logoUrl);
                doc.addImage(logoData, 'PNG', 15, 5, 20, 20);
            } catch (e) {
                console.warn('No se pudo cargar logo:', e);
            }
        }
        
        // Información de generación
        doc.setFontSize(8);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 15, 38);
        
        // Estadísticas rápidas
        const stats = await this.fetchAPI(`/stats/${event.id}`);
        const statsText = `Total: ${stats.total} | Presentes: ${stats.checkedIn} | Ausentes: ${stats.total - stats.checkedIn}`;
        doc.setTextColor(accent);
        doc.setFontSize(10);
        doc.text(statsText, 105, 45, { align: 'center' });
        
        // Obtener invitados (con filtros si se proporcionan)
        let guests = this.state.guests;
        if (filters.status === 'checked_in') {
            guests = guests.filter(g => g.checked_in);
        } else if (filters.status === 'not_checked_in') {
            guests = guests.filter(g => !g.checked_in);
        }
        if (filters.search) {
            const search = filters.search.toLowerCase();
            guests = guests.filter(g => 
                g.name.toLowerCase().includes(search) ||
                g.email?.toLowerCase().includes(search) ||
                g.organization?.toLowerCase().includes(search)
            );
        }
        
        // Preparar datos para la tabla
        const tableData = guests.map(g => [
            g.name,
            g.email || '---',
            g.organization || '---',
            g.phone || '---',
            g.checked_in ? '✓  SÍ' : '× NO',
            g.checkin_time ? new Date(g.checkin_time).toLocaleTimeString() : '---'
        ]);
        
        // Generar tabla
        doc.autoTable({
            startY: 55,
            head: [['Nombre', 'Email', 'Empresa', 'Teléfono', 'Presente', 'Hora']],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            margin: { left: 10, right: 10 }
        });
        
        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
            doc.text(`Check Pro v${this.state.version}`, 105, 295, { align: 'center' });
        }
        
        doc.save(`Lista_Invitados_${event.name.replace(/\s+/g, '_')}.pdf`);
    },

    // Generar reporte ejecutivo mejorado con gráficos
    async generateEnhancedEventReport() {
        await this.ensurePDFLibsLoaded();
        if (!this.state.event) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const event = this.state.event;
        const logoUrl = event.logo_url;
        const accent = event.ticket_accent_color || '#7c3aed';
        const stats = await this.fetchAPI(`/stats/${event.id}`);
        
        // Portada
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE EJECUTIVO', 105, 120, { align: 'center' });
        doc.setFontSize(18);
        doc.text(event.name, 105, 140, { align: 'center' });
        
        if (logoUrl) {
            try {
                const logoData = await this.loadImageForPDF(logoUrl);
                doc.addImage(logoData, 'PNG', 75, 40, 60, 60);
            } catch (e) {
                console.warn('No se pudo cargar logo:', e);
            }
        }
        
        doc.setFontSize(12);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, 105, 160, { align: 'center' });
        doc.text(`Check Pro v${this.state.version}`, 105, 170, { align: 'center' });
        
        doc.addPage();
        
        // Resumen ejecutivo
        doc.setFillColor(accent);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('RESUMEN EJECUTIVO', 15, 20);
        doc.setFontSize(10);
        doc.text(`Evento: ${event.name}`, 15, 30);
        
        // KPIs en tarjetas
        const kpis = [
            { label: 'Total Invitados', value: stats.total, color: [124, 58, 237] },
            { label: 'Acreditados', value: stats.checkedIn, color: [34, 197, 94] },
            { label: 'Ausentes', value: stats.total - stats.checkedIn, color: [239, 68, 68] },
            { label: '% Asistencia', value: stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0, suffix: '%', color: [59, 130, 246] }
        ];
        
        let yPos = 55;
        kpis.forEach((kpi, i) => {
            const x = i % 2 === 0 ? 15 : 115;
            if (i % 2 === 0 && i > 0) yPos += 40;
            
            doc.setFillColor(...kpi.color);
            doc.roundedRect(x, yPos, 85, 30, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text(kpi.label, x + 42.5, yPos + 10, { align: 'center' });
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(`${kpi.value}${kpi.suffix || ''}`, x + 42.5, yPos + 22, { align: 'center' });
        });
        
        // Tabla de asistencia por hora (si hay datos)
        const checkinTimes = this.state.guests
            .filter(g => g.checkin_time)
            .map(g => new Date(g.checkin_time).getHours())
            .reduce((acc, hour) => {
                acc[hour] = (acc[hour] || 0) + 1;
                return acc;
            }, {});
        
        if (Object.keys(checkinTimes).length > 0) {
            doc.addPage();
            doc.setFillColor(accent);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.text('ANÁLISIS POR HORARIO', 15, 20);
            
            const hourData = Object.entries(checkinTimes)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([hour, count]) => [hour + ':00', count.toString()]);
            
            doc.autoTable({
                startY: 55,
                head: [['Hora', 'Acreditaciones']],
                body: hourData,
                headStyles: { fillColor: [51, 65, 85] }
            });
        }
        
        // Lista detallada (página separada)
        doc.addPage();
        doc.setFillColor(accent);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('LISTADO DETALLADO', 15, 20);
        
        const guestData = this.state.guests.map(g => [
            g.name,
            g.organization || '---',
            g.checked_in ? 'SÍ' : 'NO',
            g.checkin_time ? new Date(g.checkin_time).toLocaleTimeString() : '---'
        ]);
        
        doc.autoTable({
            startY: 55,
            head: [['Nombre', 'Empresa', 'Presente', 'Hora']],
            body: guestData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [51, 65, 85] },
            pageBreak: 'auto'
        });
        
        // Pie de página en todas las páginas
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Página ${i} de ${pageCount} - Check Pro v${this.state.version}`, 105, 290, { align: 'center' });
        }
        
        doc.save(`Reporte_Ejecutivo_${event.name.replace(/\s+/g, '_')}.pdf`);
    },

    // ─── FUNCIONES PUENTE PARA COMPATIBILIDAD ───
    
    // Generar lista de invitados en PDF (compatibilidad con botón existente)
    async generateGuestListPdf() {
        return this.generateGuestListPDF();
    },

    // Generar certificados para invitados
    async generateCertificates() {
        if (!this.state.event || this.state.guests.length === 0) {
            return alert('No hay invitados para generar certificados.');
        }
        
        const choice = confirm('¿Generar certificados para todos los invitados? (Cancelar para generar solo uno)');
        if (choice) {
            // Generar certificados en lote (podría ser pesado)
            alert('Generar certificados en lote está en desarrollo. Por ahora, genera certificados individuales desde la lista de invitados.');
        } else {
            // Mostrar selector de invitado
            const guestName = prompt('Ingresa el nombre del invitado para generar certificado:');
            if (!guestName) return;
            
            const guest = this.state.guests.find(g => 
                g.name.toLowerCase().includes(guestName.toLowerCase()) ||
                g.email?.toLowerCase().includes(guestName.toLowerCase())
            );
            
            if (guest) {
                await this.generateEnhancedCertificate(guest.id, 'premium');
            } else {
                alert('Invitado no encontrado.');
            }
        }
    },

    // Mejorar reporte de evento existente
    async generateEventReport() {
        // Usar la versión mejorada por defecto
        return this.generateEnhancedEventReport();
    },

    // Generar ticket PDF mejorado
    async generatePDFTicket(gId = null) {
        await this.ensurePDFLibsLoaded();
        const guestId = gId || this.state.ticketGuest?.id;
        const g = this.state.guests.find(x => x.id === guestId);
        if (!g || !this.state.event) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: [100, 150] });
        const event = this.state.event;
        const accent = event.ticket_accent_color || '#7c3aed';
        const ticketBgUrl = event.ticket_bg_url;
        
        // Fondo personalizado si existe
        if (ticketBgUrl) {
            try {
                const bgData = await this.loadImageForPDF(ticketBgUrl);
                doc.addImage(bgData, 'PNG', 0, 0, 100, 150);
            } catch (e) {
                console.warn('No se pudo cargar fondo de ticket:', e);
                doc.setFillColor(15, 23, 42);
                doc.rect(0, 0, 100, 150, 'F');
            }
        } else {
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 100, 150, 'F');
        }
        
        // Contenido del ticket
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(event.name, 50, 15, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setTextColor(accent);
        doc.text('BOLETO DIGITAL DE ACCESO', 50, 22, { align: 'center' });
        
        doc.setDrawColor(255, 255, 255, 0.1);
        doc.line(10, 28, 90, 28);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(g.name, 50, 40, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(g.organization || 'INVITADO ESPECIAL', 50, 45, { align: 'center' });
        
        // QR
        const qrEl = document.querySelector('#ticket-qr-container canvas');
        if (qrEl) {
            const qrData = qrEl.toDataURL('image/png');
            doc.addImage(qrData, 'PNG', 25, 55, 50, 50);
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(g.qr_token || '---', 50, 115, { align: 'center' });
        
        // Información adicional
        const dateStr = new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        doc.setFontSize(6);
        doc.setTextColor(200, 200, 200);
        doc.text(`Evento: ${dateStr} - ${event.location || 'S/L'}`, 50, 125, { align: 'center' });
        
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('Presente este QR en la entrada del evento.', 50, 135, { align: 'center' });
        doc.text(`Check Pro v${this.state.version}`, 50, 140, { align: 'center' });
        
        doc.save(`Ticket_${event.name.replace(/\s+/g, '_')}_${g.name.split(' ')[0]}.pdf`);
    },

    switchSystemTab(tabName) {
        console.log('[SYS] Switching to tab:', tabName);
        const ALL_SYS_IDS = ['sys-content-users', 'sys-content-groups', 'sys-content-legal', 'sys-content-email', 'sys-content-account'];
        
        // Ocultar todos los contenidos
        ALL_SYS_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Configuración de botones de sub-navegación (V12.6.1)
        const subNavContainer = document.querySelector('#view-system .sub-nav-container');
        if (subNavContainer) {
            const btns = subNavContainer.querySelectorAll('.sub-nav-btn');
            btns.forEach(b => b.classList.remove('active'));
            // Intentar encontrar el botón por su onclick o posición si no tiene ID
            const targetBtn = Array.from(btns).find(b => b.getAttribute('onclick')?.includes(`'${tabName}'`));
            if (targetBtn) targetBtn.classList.add('active');
        }

        // Mostrar panel activo
        const panel = document.getElementById('sys-content-' + tabName);
        if (panel) panel.classList.remove('hidden');

        // Carga de datos específicos
        if (tabName === 'users') this.loadUsersTable();
        if (tabName === 'groups') this.loadGroups();
        if (tabName === 'legal') this.loadLegalTexts();
        if (tabName === 'email') this.navigateEmailSection('config');
        if (tabName === 'account') this.loadUserProfile();
    },

    // ─── PESTAÑAS DE EVENTO (Fase 3: CRUD Personal) ───
    switchEventTab(tabName) {
        console.log('[EVENT] Switching to tab:', tabName);
        const ALL_EVENT_IDS = ['ev-content-guests', 'ev-content-staff']; // Updated to match actual IDs
        ALL_EVENT_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Update sub-navigation buttons (V12.6.1)
        const subNav = document.querySelector('#view-admin .sub-nav-container');
        if (subNav) {
            subNav.querySelectorAll('.sub-nav-btn').forEach(b => {
                b.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl');
                b.classList.add('text-slate-400', 'bg-white/5'); // Reset to default state
                if (b.id === `ev-nav-${tabName}`) { // Check by ID for consistency
                    b.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl');
                    b.classList.remove('text-slate-400', 'bg-white/5');
                }
            });
        }

        const panel = document.getElementById('ev-content-' + tabName); // Updated to match actual IDs
        if (panel) panel.classList.remove('hidden');

        // Load specific data
        if (tabName === 'guests') this.loadGuests(); // Assuming loadGuests handles event.id
        if (tabName === 'staff') this.loadEventStaff(this.state.event?.id);
    },

    async loadEventStaff(eventId) {
        try {
            const users = await this.fetchAPI(`/events/${eventId}/users`);
            const tbody = document.getElementById('ev-staff-tbody');
            if (!tbody) return;
            
            if (!users || users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-[var(--text-muted)] italic text-sm">No hay personal asignado a este evento.</td></tr>`;
                return;
            }
            
            const isAdmin = this.state.user?.role === 'ADMIN';
            const canEdit = isAdmin || this.state.user?.role === 'PRODUCTOR';
            
            tbody.innerHTML = users.map(u => `
                <tr class="hover:bg-[var(--bg-hover)] transition-colors group">
                    <td class="px-5 py-4">
                        <div class="font-bold text-[var(--text-main)] text-sm">${u.display_name || u.username}</div>
                        <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${u.username}</div>
                    </td>
                    <td class="px-5 py-4 text-center">
                        <span class="px-2.5 py-1 inline-flex text-[11px] font-semibold rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-main)] shadow-sm">
                            ${u.role}
                        </span>
                    </td>
                    <td class="px-5 py-4 text-right">
                        ${canEdit ? `<button data-action="removeEventStaff" data-user-id="${u.id}" class="w-8 h-8 inline-flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm ml-auto opacity-70 group-hover:opacity-100" title="Desvincular del Evento"><span class="material-symbols-outlined text-[16px]">close</span></button>` : ''}
                    </td>
                </tr>
            `).join('');
            
        } catch(e) { console.error('Error loading event staff:', e); }
    },

    async removeEventStaff(userId) {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        const result = await Swal.fire({
            title: '¿Desvincular Personal?',
            text: 'El colaborador perderá acceso inmediato a este evento.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, remover',
            cancelButtonText: 'Cancelar',
            background: '#0f172a',
            color: '#fff'
        });

        if (result.isConfirmed) {
            try {
                await this.fetchAPI(`/events/${eventId}/users/${userId}`, { method: 'DELETE' });
                this.loadEventStaff(eventId);
            } catch(e) { console.error('Error:', e); }
        }
    },

    showUserSelectorForEvent(eventId) {
        const allSystemUsers = this.state.allUsers || [];
        const options = allSystemUsers.map(u => 
            `<option value="${u.id}">${u.display_name || u.username} (${u.role})</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.id = 'modal-select-event-staff';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300';
        modal.innerHTML = `
            <div class="glass-card p-8 w-full max-w-md border border-white/10 shadow-2xl scale-in-center">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                        <span class="material-symbols-outlined text-2xl">person_add</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-white tracking-tight">Vincular Staff</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Asignación Rápida</p>
                    </div>
                </div>
                
                <div class="space-y-4 mb-8">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Seleccionar Colaborador</label>
                        <select id="select-staff-target" class="w-full bg-slate-900/50 text-white text-sm rounded-2xl px-5 py-4 border border-white/10 focus:border-primary/50 outline-none transition-all appearance-none cursor-pointer">
                            <option value="">-- Seleccionar --</option>
                            ${options}
                        </select>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
                    <button id="btn-confirm-staff-assign" class="w-full py-4 bg-primary text-white font-black text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">Añadir al Evento</button>
                    <button id="btn-close-staff-selector" class="w-full py-4 bg-white/5 text-slate-400 hover:text-white font-bold text-[10px] rounded-2xl transition-all uppercase tracking-widest border border-white/5 hover:border-white/10">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        
        document.getElementById('btn-close-staff-selector').onclick = () => document.body.removeChild(modal);
        document.getElementById('btn-confirm-staff-assign').onclick = async () => {
            const userId = document.getElementById('select-staff-target').value;
            if (!userId) return;
            try {
                const res = await this.fetchAPI(`/events/${eventId}/users`, { 
                    method: 'POST', body: JSON.stringify({ userId }) 
                });
                if (res.success) {
                    document.body.removeChild(modal);
                    this.loadEventStaff(eventId);
                }
            } catch(e) { console.error(e); }
        };
    },

    // --- PERFIL Y SEGURIDAD (FASE 5) ---
    async loadUserProfile() {
        try {
            const user = await this.fetchAPI('/me');
            if (user) {
                this.state.user = { ...this.state.user, ...user };
                const fn = document.getElementById('profile-full-name');
                const rb = document.getElementById('profile-role-badge');
                const dn = document.getElementById('profile-display-name');
                const ph = document.getElementById('profile-phone');
                const em = document.getElementById('profile-email');
                
                if (fn) fn.textContent = user.name || 'Usuario';
                if (rb) rb.textContent = user.role || 'GUEST';
                if (dn) dn.value = user.name || '';
                if (ph) ph.value = user.phone || '';
                if (em) em.value = user.email || '';
            }
        } catch(e) { console.error('Error loading profile:', e); }
    },

    async handleEmailChange(e) {
        e.preventDefault();
        const newEmail = document.getElementById('profile-email').value;
        if (!newEmail) return;
        
        const { isConfirmed } = await Swal.fire({
            title: '¿Cambiar Email?',
            text: "Se cerrará la sesión actual y deberás ingresar con el nuevo correo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            try {
                const res = await this.fetchAPI('/me/email', {
                    method: 'PUT',
                    body: JSON.stringify({ email: newEmail })
                });
                if (res.success) {
                    Swal.fire('Actualizado', 'Correo cambiado con éxito.', 'success')
                        .then(() => this.logout());
                }
            } catch(err) { Swal.fire('Error', 'No se pudo cambiar el correo.', 'error'); }
        }
    },

    async handlePasswordChange(e) {
        e.preventDefault();
        const p1 = document.getElementById('new-pass-1').value;
        const p2 = document.getElementById('new-pass-2').value;
        
        if (!p1 || p1 !== p2) {
            return Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
        }

        try {
            const res = await this.fetchAPI('/me/password', {
                method: 'PUT',
                body: JSON.stringify({ password: p1 })
            });
            if (res.success) {
                Swal.fire('✓ Éxito', 'Contraseña actualizada correctamente.', 'success');
                e.target.reset();
            }
        } catch(err) { Swal.fire('Error', 'Error al actualizar contraseña.', 'error'); }
    },

    async testIMAP() {
        const host = document.getElementById('imap-host').value;
        const user = document.getElementById('imap-user').value;
        if (!host || !user) return Swal.fire('Error', 'Completa host y usuario', 'warning');

        Swal.fire({ title: 'Probando...', text: 'Conectando con servidor IMAP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const res = await this.fetchAPI('/imap/test', {
                method: 'POST',
                body: JSON.stringify({ host, user, port: document.getElementById('imap-port').value, pass: document.getElementById('imap-pass').value })
            });
            if (res.success) Swal.fire('Conectado', 'La configuración IMAP es correcta', 'success');
            else Swal.fire('Error', res.error || 'Fallo de conexión', 'error');
        } catch { Swal.fire('Error', 'Error de red', 'error'); }
    },

    // Utilidad privada para confirmaciones Premium (V12.6.1)
    async _confirmAction(title, text, confirmText = 'Sí, eliminar') {
        const result = await Swal.fire({
            title,
            text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#1a73e8',
            cancelButtonColor: '#3c4043',
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancelar',
            background: '#292a2d',
            color: '#e8eaed'
        });
        return result.isConfirmed;
    },

    // Utilidad para notificaciones Premium (V12.7.0)
    async _notifyAction(title, text, icon = 'info', timer = 3000) {
        return Swal.fire({
            title,
            text,
            icon,
            background: '#292a2d',
            color: '#e8eaed',
            confirmButtonColor: '#1a73e8',
            timer,
            showConfirmButton: timer === 0
        });
    },

    // --- EMAIL Y ENVÍO MASIVO (FASE 6) ---
    async navigateEmailSection(section) {
        document.querySelectorAll('.email-content').forEach(c => c.classList.add('hidden'));
        
        // Actualizar botones de sub-navegación (V12.6.1)
        const subNav = document.querySelector('#sys-content-email .sub-nav-container');
        if (subNav) {
            subNav.querySelectorAll('.sub-nav-btn').forEach(b => {
                b.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl');
                b.classList.add('text-slate-400', 'bg-white/5'); // Reset to default state
                if (b.id === `email-nav-${section}`) {
                    b.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl');
                    b.classList.remove('text-slate-400', 'bg-white/5');
                }
            });
        }

        const panel = document.getElementById('email-content-' + section);
        if (panel) panel.classList.remove('hidden');

        if (section === 'templates') this.loadEmailTemplates();
        if (section === 'mailing') this.loadMailingData();
        if (section === 'mailbox') this.loadMailbox();
    },

    async loadEmailTemplates() {
        const grid = document.getElementById('email-templates-grid');
        if (!grid) return;
        try {
            const templates = await this.fetchAPI('/email-templates');
            this.state.emailTemplates = templates;
            grid.innerHTML = templates.map(t => `
                <div class="card p-6 rounded-xl border border-white/5 hover:border-[var(--primary)] transition-all group relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10 flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span class="material-symbols-outlined">mail</span>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-sm font-bold text-white">${t.name}</h4>
                            <p class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider truncate">${t.subject || 'Sin Asunto'}</p>
                        </div>
                    </div>
                    <div class="relative z-10 pt-4 border-t border-white/5 flex gap-2">
                        <button onclick="App.selectTemplateFromLibrary('${t.id}')" class="btn-primary !py-1.5 !px-3 text-[10px] flex-1">
                            <span class="material-symbols-outlined text-xs">send</span> USAR PARA ENVÍO
                        </button>
                    </div>
                </div>
            `).join('');
        } catch(e) { console.error('Error templates:', e); }
    },

    async selectTemplateFromLibrary(id) {
        await this.navigateEmailSection('mailing');
        setTimeout(() => {
            const selector = document.getElementById('mailing-template-selector');
            if (selector) {
                selector.value = id;
                this.onTemplateChange();
                this._notifyAction('Plantilla Cargada', 'Lista para envío masivo.', 'success');
            }
        }, 100);
    },

    async loadMailbox() {
        const list = document.getElementById('inbox-list');
        if (!list) return;
        try {
            const res = await this.fetchAPI('/email-logs?type=INBOX');
            const logs = res.data || []; // V12.8.1 Fix: Backend returns {data: []}
            list.innerHTML = logs.map(l => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="px-4 py-3 text-xs text-white font-medium">${l.sender || 'Sistema'}</td>
                    <td class="px-4 py-3 text-xs text-slate-300 truncate max-w-xs">${l.subject}</td>
                    <td class="px-4 py-3 text-[10px] text-slate-500">${new Date(l.created_at).toLocaleString()}</td>
                    <td class="px-4 py-3 text-right">
                        <button class="text-[var(--primary)] hover:underline text-[10px] font-bold">Ver DETALLES</button>
                    </td>
                </tr>
            `).join('');
        } catch(e) { console.error('Error mailbox:', e); }
    },

    async syncIMAP() {
        Swal.fire({ title: 'Sincronizando...', text: 'Conectando con IMAP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await this.fetchAPI('/imap/sync');
            if (res.success) {
                Swal.fire('✓ Sincronizado', 'Correos actualizados correctamente.', 'success');
                this.loadMailbox();
            }
        } catch(e) { Swal.fire('Error', 'Falla en sincronización IMAP', 'error'); }
    },

    async loadMailingData() {
        console.log('[MAIL] Loading mailing data...');
        try {
            const events = await this.fetchAPI('/events');
            const eventSelector = document.getElementById('mailing-event-selector');
            if (eventSelector) {
                eventSelector.innerHTML = '<option value="">-- Seleccionar Evento --</option>' + 
                    events.map(ev => `<option value="${ev.id}">${ev.name}</option>`).join('');
            }

            const templates = await this.fetchAPI('/email-templates');
            this.state.emailTemplates = templates;
            const tempSelector = document.getElementById('mailing-template-selector');
            if (tempSelector) {
                tempSelector.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>' + 
                    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }

            // Initialize recipients state if empty
            if (!this.state.mailingGuests) this.state.mailingGuests = [];
        } catch(e) { console.error('Error mailing data:', e); }
    },

    async onMailingEventChange() {
        const eventId = document.getElementById('mailing-event-selector').value;
        if (!eventId) {
            // Si limpian el evento, dejamos solo los manuales
            this.state.mailingGuests = (this.state.mailingGuests || []).filter(g => g.manual);
            return this.filterMailingGuests();
        }
        try {
            const guests = await this.fetchAPI(`/events/${eventId}/guests`);
            const manualOnes = (this.state.mailingGuests || []).filter(g => g.manual);
            // Inicializar propiedad selected para persistencia
            const formattedGuests = guests.map(g => ({ ...g, selected: true }));
            this.state.mailingGuests = [...manualOnes, ...formattedGuests];
            this.filterMailingGuests();
        } catch(e) { console.error('[MAIL] Error fetch guests:', e); }
    },

    addDirectRecipient() {
        const input = document.getElementById('direct-email-input');
        const email = input.value.trim();
        if (!email || !email.includes('@')) return Swal.fire('Error', 'Ingresa un correo válido.', 'error');

        const newGuest = {
            id: 'manual-' + Date.now(),
            name: email.split('@')[0],
            email: email,
            organization: 'Directo',
            manual: true,
            selected: true
        };

        if (!this.state.mailingGuests) this.state.mailingGuests = [];
        
        // Prevent duplicates
        if (this.state.mailingGuests.find(g => g.email === email)) {
            return Swal.fire('Atención', 'Este correo ya está en la lista.', 'info');
        }

        this.state.mailingGuests.unshift(newGuest);
        this.filterMailingGuests();
        input.value = '';
        this._notifyAction('Añadido', `${email} agregado a la lista.`, 'success');
    },

    onTemplateChange() {
        const templateId = document.getElementById('mailing-template-selector').value;
        const template = (this.state.emailTemplates || []).find(t => t.id == templateId);
        if (template) {
            const previewArea = document.getElementById('email-preview-area');
            if (previewArea) {
                const body = template.body || ''; 
                // Fix V12.9.0: Clear and expand
                previewArea.innerHTML = `<iframe srcdoc="${body.replace(/"/g, '&quot;')}" class="w-full border-none animate-fade-in" style="min-height: 600px; height: 600px;" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 20) + 'px';"></iframe>`;
            }
        }
    },

    renderMailingRecipients(guests) {
        this.state.mailingGuests = guests; // Cache for filtering
        this.filterMailingGuests();
    },

    filterMailingGuests() {
        const searchInput = document.getElementById('mailing-search');
        if (!searchInput) return;
        
        const query = searchInput.value.toLowerCase().trim();
        const guests = this.state.mailingGuests || [];
        
        const filtered = guests.filter(g => {
            const name = (g.name || '').toLowerCase();
            const email = (g.email || '').toLowerCase();
            const org = (g.organization || '').toLowerCase();
            const pos = (g.position || '').toLowerCase();
            const city = (g.city || '').toLowerCase();
            
            return name.includes(query) || email.includes(query) || org.includes(query) || pos.includes(query) || city.includes(query);
        });

        // Cache filtered result for toggle action
        this.state.lastFilteredRecipients = filtered;

        const list = document.getElementById('mailing-recipients-list');
        const count = document.getElementById('mailing-count');
        if (!list) return;

        const totalSelected = (this.state.mailingGuests || []).filter(g => g.selected).length;
        count.innerHTML = `${filtered.length} <span class="text-[var(--text-secondary)] opacity-50 mx-1">/</span> <span class="text-[var(--primary)]">${totalSelected} seleccionados</span>`;
        
        if (filtered.length === 0) {
            list.innerHTML = `<div class="text-center py-6">
                <span class="material-symbols-outlined text-slate-600 text-3xl mb-2 opacity-20">search_off</span>
                <p class="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Sin resultados para "${query}"</p>
            </div>`;
            return;
        }

        list.innerHTML = filtered.map(g => `
            <label class="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-white/5">
                <input type="checkbox" class="mailing-check w-4 h-4 rounded-md accent-primary border-white/10 bg-slate-900/50" 
                    value="${g.email}" ${g.selected ? 'checked' : ''} 
                    onchange="App.updateGuestSelection('${g.id}', this.checked)"
                    data-name="${g.name}">
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-[11px] font-bold text-white group-hover:text-primary transition-colors truncate">${g.name}</span>
                    <span class="text-[9px] text-slate-500 truncate font-medium">${g.email} • ${g.organization || 'S/E'} ${g.manual ? '• (Manual)' : ''}</span>
                </div>
            </label>
        `).join('');
    },

    updateGuestSelection(guestId, isChecked) {
        const guest = (this.state.mailingGuests || []).find(g => g.id == guestId);
        if (guest) {
            guest.selected = isChecked;
            this.filterMailingGuests(); // Actualizar contador
        }
    },

    clearMailingSearch() {
        const input = document.getElementById('mailing-search');
        if (input) {
            input.value = '';
            this.filterMailingGuests();
            input.focus();
        }
    },

    showSelectionSummary() {
        const selected = (this.state.mailingGuests || []).filter(g => g.selected);
        if (selected.length === 0) return Swal.fire('Lista Vacía', 'No hay destinatarios seleccionados.', 'info');

        const html = `
            <div class="max-h-64 overflow-y-auto text-left space-y-2 pr-2 custom-scrollbar">
                ${selected.map(g => `
                    <div class="flex flex-col p-2 bg-white/5 rounded-lg border border-white/5">
                        <span class="text-[11px] font-bold text-white">${g.name}</span>
                        <span class="text-[9px] text-slate-500">${g.email}</span>
                    </div>
                `).join('')}
            </div>
        `;

        Swal.fire({
            title: `<span class="text-lg font-bold">Resumen de Selección</span>`,
            html: html,
            width: '400px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            showConfirmButton: true,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: 'var(--primary)',
            customClass: { popup: 'rounded-2xl border border-white/10 shadow-2xl' }
        });
    },

    toggleAllRecipients() {
        const filtered = this.state.lastFilteredRecipients || [];
        if (filtered.length === 0) return;
        
        // Determinar si activar o desactivar basándonos en el primero
        const newState = !filtered[0].selected;
        filtered.forEach(g => g.selected = newState);
        
        // Re-renderizar respetando el filtro actual
        this.filterMailingGuests();
    },

    async sendMassEmail() {
        const eventId = document.getElementById('mailing-event-selector').value;
        const templateId = document.getElementById('mailing-template-selector').value;
        const recipients = (this.state.mailingGuests || [])
            .filter(g => g.selected)
            .map(g => ({ email: g.email, name: g.name }));
        
        if (await this._confirmAction('¿Lanzar Campaña?', `Se enviarán ${recipients.length} correos.`, 'Sí, iniciar')) {
            try {
                const res = await this.fetchAPI('/send-mass', {
                    method: 'POST',
                    body: JSON.stringify({ templateId, recipients, eventId })
                });
                if (res.success) {
                    document.getElementById('mailing-progress-container').classList.remove('hidden');
                    this.startQueuePolling();
                }
            } catch(e) { this._notifyAction('Error', 'No se pudo iniciar la campaña.', 'error'); }
        }
    },

    startQueuePolling() {
        if (this.queuePolling) clearInterval(this.queuePolling);
        this.updateQueueStats();
        this.queuePolling = setInterval(() => this.updateQueueStats(), 3000);
        
        // Show controls
        document.getElementById('btn-send-mass-email').classList.add('hidden');
        document.getElementById('btn-pause-mailing').classList.remove('hidden');
        document.getElementById('btn-stop-mailing').classList.remove('hidden');
    },

    async updateQueueStats() {
        try {
            const stats = await this.fetchAPI('/email-queue/stats');
            const percent = stats.total > 0 ? Math.round(((stats.total - stats.pending) / stats.total) * 100) : 0;
            
            document.getElementById('mailing-percentage').textContent = percent + '%';
            document.getElementById('mailing-progress-bar').style.width = percent + '%';
            document.getElementById('mailing-sent-count').textContent = stats.sent;
            document.getElementById('mailing-error-count').textContent = stats.errors;
            document.getElementById('mailing-total-count').textContent = stats.total;

            if (stats.pending === 0 && stats.total > 0) {
                clearInterval(this.queuePolling);
                this._notifyAction('Campaña Finalizada', 'Todos los correos han sido procesados.', 'success');
                this.resetQueueUI();
            }
            
            // UI state based on backend queue status
            if (stats.status === 'PAUSED') {
                document.getElementById('btn-pause-mailing').classList.add('hidden');
                document.getElementById('btn-resume-mailing').classList.remove('hidden');
                document.getElementById('mailing-status-text').classList.remove('animate-pulse');
                document.getElementById('mailing-status-text').textContent = 'Campaña Pausada';
            } else {
                document.getElementById('btn-pause-mailing').classList.remove('hidden');
                document.getElementById('btn-resume-mailing').classList.add('hidden');
                document.getElementById('mailing-status-text').classList.add('animate-pulse');
                document.getElementById('mailing-status-text').textContent = 'Procesando...';
            }

        } catch(e) { console.error('Polling error:', e); }
    },

    async controlQueue(action) {
        try {
            await this.fetchAPI(`/email-queue/${action}`, { method: 'POST' });
            this.updateQueueStats();
            if (action === 'stop') {
                clearInterval(this.queuePolling);
                this.resetQueueUI();
            }
        } catch(e) { console.error('Control error:', e); }
    },

    resetQueueUI() {
        document.getElementById('btn-send-mass-email').classList.remove('hidden');
        document.getElementById('btn-pause-mailing').classList.add('hidden');
        document.getElementById('btn-resume-mailing').classList.add('hidden');
        document.getElementById('btn-stop-mailing').classList.add('hidden');
        document.getElementById('mailing-progress-container').classList.add('hidden');
    },

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const eventId = this.state.event?.id;
        if (!eventId) {
            this._notifyAction('Atención', 'Selecciona un evento para importar.', 'info');
            return;
        }
        this._notifyAction('Procesando', 'Analizando archivo...', 'info');
        this.handleImport(file);
    },

    async purgeDatabase() {
        if (await this._confirmAction('¿BORRAR TODO?', 'Esta acción eliminará TODOS los registros del sistema permanentemente.')) {
            try {
                await this.fetchAPI('/admin/purge', { method: 'POST' });
                this._notifyAction('Base de Datos Limpia', 'Se han borrado todos los datos.', 'success');
                location.reload();
            } catch (e) {
                this._notifyAction('Error', 'Falla en la purga: ' + e.message, 'error');
            }
        }
    },

    // --- AUTENTICACIÓN (RESTAURADO V12.7.3) ---
    async login(username, password) {
        console.log("[AUTH] Intentando login:", username);
        try {
            const data = await this.fetchAPI('/login', { 
                method: 'POST', 
                body: JSON.stringify({ username, password }) 
            });
            
            if (data.success) {
                this.state.user = data;
                LS.set('user', JSON.stringify(data));
                
                // Inicializar push
                this.initPushNotifications().catch(err => console.error('Push error:', err));
                
                // Cargar interfaz
                await this.loadAppShell();
                
                // Actualizar Sidebar
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                if (sbu) sbu.textContent = data.username || 'Usuario';
                if (sbr) sbr.textContent = data.role || 'Staff';
                
                // UI transition
                const loginEl = document.getElementById('view-login');
                if (loginEl) { loginEl.classList.add('hidden'); loginEl.style.display = 'none'; }
                
                this.updateUIPermissions();
                this.updateRoleOptions();
                this.handleInitialNavigation();
                this.initAppShell();
                
                return { success: true };
            } else {
                this._notifyAction('Error de Acceso', data.message || 'Credenciales inválidas.', 'error');
                return { success: false, message: data.message };
            }
        } catch (err) {
            console.error("[AUTH] Error fatal:", err);
            this._notifyAction('Fallo de Conexión', 'No se pudo contactar con el servidor.', 'error');
            return { success: false, error: err };
        }
    },
};

window.switchSystemTab = App.switchSystemTab.bind(App);
window.switchEventTab = App.switchEventTab.bind(App);

window.switchAdminTab = function(tabName) {
    console.log('CHECK V12.3.2.2: switchAdminTab ->', tabName || 'dashboard');
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

// --- DOM READY BOOTSTRAP V12.3.2.2 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Helpers Críticos (Hoisting manual)
    const sf = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    console.log('[DOM] DOMContentLoaded fired');
    
    // 0. Lazy Loading init (Performance)
    window.lazyLoad?.init();
    window.lazyLoad?.observeAll();
    
    // 0.5. QUITAR LOADING SCREEN
    const ls = document.getElementById('loading-screen');
    if (ls) ls.remove();

    // 0.6. INICIALIZAR TEMA OSCURO/CLARO
    App.initTheme();

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
                // Inicializar notificaciones push
                window.App.initPushNotifications().catch(err => console.error('Error inicializando push:', err));
                
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
                    App.updateUIPermissions();
                    App.updateRoleOptions();
                }
                
                // Cargar eventos inicialmente para tener la lista lista
                await App.loadEvents();
                
                // Ruteo inteligente inicial
                App.handleInitialNavigation();
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
        window.App.state.socket.on('email_queue_progress', () => App.updateMailingStats());
    }

    // Listeners System (Se maneja en attachAppListeners para evitar duplicación)
    // Se mantienen solo los que no están en app-shell o son globales fuera del shell
    
    document.getElementById('nav-tab-dashboard')?.addEventListener('click', () => switchAdminTab(null));

    // 5. Listeners generales

    // Login Form
    sf('form-login', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-email').value; 
        const p = document.getElementById('login-password').value;
        await App.login(u, p);
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
            if (d.success) App._notifyAction('✓ Solicitud enviada', 'Un administrador debe aprobar tu acceso.', 'success', 0);
            else App._notifyAction('Error', d.error || 'No se pudo enviar la solicitud.', 'error');
            document.getElementById('signup-form')?.classList.add('hidden');
            document.getElementById('login-form')?.classList.remove('hidden');
        } catch(err) { App._notifyAction('Error', 'Error de conexión.', 'error'); }
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
        if (await App._confirmAction(`¿Seguro que deseas ELIMINAR el evento "${App.state.event.name}"?`, 'Esta acción es irreversible y borrará todos los datos asociados.')) {
            try {
                const res = await App.fetchAPI(`/events/${App.state.event.id}`, { method: 'DELETE' });
                if (res.success) {
                    App._notifyAction('✓ Evento eliminado.', 'El evento ha sido eliminado correctamente.', 'success');
                    App.state.event = null;
                    App.navigate('my-events');
                } else {
                    App._notifyAction('Error', res.error || 'No se pudo eliminar el evento.', 'error');
                }
            } catch { App._notifyAction('Error', 'No se pudo eliminar el evento debido a un error de conexión.', 'error'); }
        }
    };

    // Admin Actions
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
    cl('btn-scan-qr', () => document.getElementById('modal-qr-scanner').classList.remove('hidden'));
    cl('btn-bulk-tickets', () => App.generateBulkTickets());

    App.showQR = async () => {
        if (!App.state.event) return alert("Selecciona un evento primero.");
        const url = `${window.location.origin}/register.html?event=${App.state.event.id}`;
        const qrEl = document.getElementById('qr-display');
        
        // Colores personalizados V11.6
        const dark = App.state.event.qr_color_dark || '#000000';
        const light = App.state.event.qr_color_light || '#ffffff';

        if (qrEl && typeof qrcode !== 'undefined') {
            const qrDataUrl = await qrcode.toDataURL(url, { 
                width: 400, 
                margin: 2,
                color: { dark, light }
            });
            qrEl.src = qrDataUrl;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        } else if (qrEl) {
            // Fallback: generar QR con Canvas API simple
            qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=${dark.replace('#','')}&bgcolor=${light.replace('#','')}`;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        }
    };

    // --- BOLETO DIGITAL PREMIUM V11.6 ---
    App.renderDigitalTicket = async (guestId) => {
        const guest = App.state.guests.find(g => String(g.id) === String(guestId));
        const event = App.state.event;
        if (!guest || !event) return alert("Error: Datos insuficientes para generar boleto.");

        const modal = document.getElementById('modal-ticket');
        const card = modal.querySelector('.ticket-card');
        
        // Datos Textuales
        document.getElementById('ticket-event-name').textContent = event.name;
        document.getElementById('ticket-guest-name').textContent = guest.name;
        document.getElementById('ticket-date').textContent = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('ticket-location').textContent = event.location;
        
        // Personalización Visual
        const accent = event.ticket_accent_color || '#7c3aed';
        modal.querySelectorAll('.ticket-accent').forEach(el => el.style.color = accent);
        if (card) {
            if (event.ticket_bg_url) {
                card.style.backgroundImage = `url('${event.ticket_bg_url}')`;
                card.style.backgroundSize = 'cover';
                card.style.backgroundPosition = 'center';
            } else {
                card.style.backgroundImage = 'none';
                card.style.backgroundColor = '#0f172a';
            }
        }

        // Logo del evento (Cabecera)
        const logoEl = document.getElementById('ticket-logo');
        if (logoEl) logoEl.src = event.logo_url || 'https://via.placeholder.com/80/7c3aed/ffffff?text=EVENTO';

        // Generar QR para el boleto
        const qrContent = JSON.stringify({ g: guest.id, e: event.id });
        const ticketQrEl = document.getElementById('ticket-qr');
        if (ticketQrEl && typeof qrcode !== 'undefined') {
            const dark = event.qr_color_dark || '#000000';
            const light = event.qr_color_light || '#ffffff';
            const logoUrl = event.qr_logo_url;

            const qrDataUrl = await qrcode.toDataURL(qrContent, { 
                width: 600, 
                margin: 1,
                color: { dark, light },
                errorCorrectionLevel: logoUrl ? 'H' : 'M'
            });

            if (logoUrl) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const qrImg = new Image();
                qrImg.onload = () => {
                    canvas.width = qrImg.width;
                    canvas.height = qrImg.height;
                    ctx.drawImage(qrImg, 0, 0);
                    const logoImg = new Image();
                    logoImg.crossOrigin = "Anonymous";
                    logoImg.onload = () => {
                        const s = canvas.width * 0.2;
                        const x = (canvas.width - s) / 2;
                        const y = (canvas.height - s) / 2;
                        ctx.fillStyle = light;
                        ctx.fillRect(x-5, y-5, s+10, s+10);
                        ctx.drawImage(logoImg, x, y, s, s);
                        ticketQrEl.src = canvas.toDataURL();
                    };
                    logoImg.src = logoUrl;
                };
                qrImg.src = qrDataUrl;
            } else {
                ticketQrEl.src = qrDataUrl;
            }
        }

        modal.classList.remove('hidden');
        App.state.currentTicketGuest = guest;
    };

    App.downloadTicket = async () => {
        const card = document.querySelector('#modal-ticket .ticket-card');
        if (!card || typeof html2canvas === 'undefined') return alert("Error: Motor de captura no disponible.");
        
        try {
            const canvas = await html2canvas(card, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                logging: false
            });
            const link = document.createElement('a');
            const guestName = App.state.currentTicketGuest?.name?.replace(/\s+/g, '_') || 'ticket';
            link.download = `Boleto_Check_${guestName}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error(e);
            alert("Error al generar la imagen del boleto.");
        }
    };

    App.shareTicketWhatsApp = () => {
        const guest = App.state.currentTicketGuest;
        if (!guest) return;
        const url = `${window.location.origin}/ticket.html?g=${guest.id}&e=${App.state.event.id}`;
        const text = encodeURIComponent(`¡Hola ${guest.name}! Aquí tienes tu boleto para ${App.state.event.name}: ${url}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    // QR Scanner V12.2.2
    App.qrScanner = {
        videoStream: null,
        scanning: false,
        interval: null,
        async start() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Tu navegador no soporta acceso a cámara.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                this.videoStream = stream;
                const video = document.getElementById('qr-video');
                video.srcObject = stream;
                await video.play();
                this.scanning = true;
                this.startScanning();
                document.getElementById('btn-start-scan').disabled = true;
                document.getElementById('btn-stop-scan').disabled = false;
            } catch (err) {
                console.error('Error al acceder a la cámara:', err);
                alert('No se pudo acceder a la cámara. Asegúrate de permitir los permisos.');
            }
        },
        stop() {
            if (this.interval) clearInterval(this.interval);
            if (this.videoStream) {
                this.videoStream.getTracks().forEach(track => track.stop());
                this.videoStream = null;
            }
            const video = document.getElementById('qr-video');
            video.srcObject = null;
            this.scanning = false;
            document.getElementById('btn-start-scan').disabled = false;
            document.getElementById('btn-stop-scan').disabled = true;
        },
        async startScanning() {
            const video = document.getElementById('qr-video');
            const canvas = document.getElementById('qr-canvas');
            const ctx = canvas.getContext('2d');
            this.interval = setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    // Load jsQR dynamically
                    if (typeof jsQR === 'undefined') {
                        this.loadJsQR().then(() => this.processQR(imageData));
                    } else {
                        this.processQR(imageData);
                    }
                }
            }, 500);
        },
        async loadJsQR() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        },
        processQR(imageData) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });
            if (code) {
                this.onQRDetected(code.data);
            }
        },
        async onQRDetected(data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.g && parsed.e) {
                    this.stop();
                    this.showResult('Escaneando ticket...', 'info');
                    const res = await App.fetchAPI(`/guests/checkin/${parsed.g}`, { method: 'POST' });
                    if (res.success) {
                        const guest = App.state.guests.find(g => String(g.id) === String(parsed.g));
                        const name = guest ? guest.name : 'Invitado';
                        this.showResult(`Check-in exitoso para ${name}.`, 'success');
                        App.loadGuests(); // Refresh list
                    } else {
                        this.showResult('Error al registrar check-in.', 'error');
                    }
                } else {
                    this.showResult('QR no válido.', 'error');
                }
            } catch (e) {
                // If not JSON, maybe it's a guest ID directly
                if (data.length === 36 || data.length === 32) { // UUID-like
                    const res = await App.fetchAPI(`/guests/checkin/${data}`, { method: 'POST' });
                    if (res.success) {
                        this.showResult('Check-in exitoso.', 'success');
                        App.loadGuests();
                    } else {
                        this.showResult('Invitado no encontrado.', 'error');
                    }
                } else {
                    this.showResult('QR no reconocido.', 'error');
                }
            }
        },
        showResult(message, type) {
            const resultEl = document.getElementById('scan-result');
            const errorEl = document.getElementById('scan-error');
            const resultMsg = document.getElementById('result-message');
            const errorMsg = document.getElementById('error-message');
            if (type === 'success') {
                resultMsg.textContent = message;
                resultEl.classList.remove('hidden');
                errorEl.classList.add('hidden');
            } else if (type === 'error') {
                errorMsg.textContent = message;
                errorEl.classList.remove('hidden');
                resultEl.classList.add('hidden');
            } else {
                // info
                resultMsg.textContent = message;
                resultEl.classList.remove('hidden');
                errorEl.classList.add('hidden');
            }
        }
    };

    App.generateBulkTickets = async () => {
        if (!App.state.event) return alert('Selecciona un evento primero.');
        if (!App.state.guests.length) return alert('No hay invitados para generar tickets.');
        
        // Load required libraries dynamically
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        if (typeof saveAs === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
        }
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js');
        }
        
        const zip = new JSZip();
        const total = App.state.guests.length;
        let processed = 0;
        
        // Show progress
        const modal = document.getElementById('modal-bulk-tickets');
        if (modal) modal.classList.remove('hidden');
        const progressEl = document.getElementById('bulk-progress');
        const progressText = document.getElementById('bulk-progress-text');
        
        for (const guest of App.state.guests) {
            // Render ticket for each guest
            const canvas = await App.renderTicketCanvas(guest);
            if (canvas) {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
                const fileName = `ticket_${guest.name.replace(/[^a-z0-9]/gi, '_')}_${guest.id.substring(0, 8)}.png`;
                zip.file(fileName, blob);
            }
            processed++;
            if (progressEl) progressEl.style.width = `${(processed / total) * 100}%`;
            if (progressText) progressText.textContent = `${processed}/${total}`;
            // Yield to UI
            await new Promise(r => setTimeout(r, 50));
        }
        
        // Generate ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `tickets_${App.state.event.name.replace(/[^a-z0-9]/gi, '_')}.zip`);
        
        // Hide progress
        if (modal) modal.classList.add('hidden');
        alert(`✓ Generados ${processed} tickets en ZIP.`);
    };

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    App.renderTicketCanvas = async (guest) => {
        // Create a temporary ticket card similar to modal-ticket
        // For simplicity, reuse existing modal-ticket rendering
        // We'll temporarily set currentTicketGuest and use html2canvas on ticket-card
        // But we need to ensure the modal is visible? We can clone the ticket-card and style it.
        // Alternative: use the same function as downloadTicket but for a specific guest.
        // Since time is limited, we'll use the existing modal-ticket but hide it.
        // We'll set App.state.currentTicketGuest = guest, call App.renderDigitalTicket(guest.id)
        // wait for QR to render, then capture .ticket-card
        // This is hacky but works.
        
        const originalGuest = App.state.currentTicketGuest;
        App.state.currentTicketGuest = guest;
        await App.renderDigitalTicket(guest.id);
        await new Promise(r => setTimeout(r, 500)); // wait for QR
        const card = document.querySelector('#modal-ticket .ticket-card');
        if (!card || typeof html2canvas === 'undefined') return null;
        const canvas = await html2canvas(card, {
            useCORS: true,
            scale: 2,
            backgroundColor: null,
            logging: false
        });
        // Restore
        App.state.currentTicketGuest = originalGuest;
        document.getElementById('modal-ticket').classList.add('hidden');
        return canvas;
    };
 
    // QR Scanner listeners
    cl('btn-start-scan', () => App.qrScanner.start());
    cl('btn-stop-scan', () => App.qrScanner.stop());
    cl('btn-manual-checkin', () => {
        const guestId = document.getElementById('manual-guest-id').value.trim();
        if (!guestId) return alert('Ingresa un ID de invitado.');
        App.fetchAPI(`/guests/checkin/${guestId}`, { method: 'POST' })
            .then(res => {
                if (res.success) {
                    alert('Check-in manual exitoso.');
                    App.loadGuests();
                    document.getElementById('manual-guest-id').value = '';
                } else {
                    alert('Error: ' + (res.message || 'Invitado no encontrado.'));
                }
            })
            .catch(err => alert('Error de red.'));
    });

    cl('btn-download-ticket', () => App.downloadTicket());
    cl('btn-share-whatsapp', () => App.shareTicketWhatsApp());
    cl('btn-close-ticket', () => document.getElementById('modal-ticket').classList.add('hidden'));

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

    // ------- V11: TEXTOS LEGALES (MÓDULO PREMIUM) -------
    App.initQuill = async () => {
        if (App.quillPolicy) return;
        
        // Lazy load Quill if not already loaded
        if (typeof window.Quill === 'undefined') {
            try {
                await window.lazyLoad?.loadQuill();
            } catch (err) {
                console.error('Failed to load Quill:', err);
                return;
            }
        }
        
        const toolbarOptions = [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'clean']
        ];
        App.quillPolicy = new Quill('#editor-policy', { theme: 'snow', modules: { toolbar: toolbarOptions } });
        App.quillTerms = new Quill('#editor-terms', { theme: 'snow', modules: { toolbar: toolbarOptions } });
    };

    App.loadLegalTexts = async () => {
        await App.initQuill();
        try {
            // Usar App.fetchAPI para mayor consistencia y control
            const s = await App.fetchAPI('/settings');
            
            const defaultPolicy = `<h2>Política de Protección de Datos Personales</h2>
<p>De conformidad con la <b>Ley 1581 de 2012</b> y el <b>Decreto 1377 de 2013</b> de la República de Colombia (Habeas Data), el titular de los datos personales acepta mediante su registro que la información suministrada sea incorporada en las bases de datos de <b>Check Pro</b> y/o el organizador del evento.</p>
<p><b>Finalidades:</b></p>
<ul>
  <li>Gestión administrativa, logística y control de acceso al evento.</li>
  <li>Envío de información sobre la agenda, cambios de último momento y materiales post-evento.</li>
  <li>Generación de estadísticas, reportes de asistencia y certificados de participación.</li>
</ul>
<p><b>Derechos del Titular:</b> Usted tiene derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos personales. Para ejercer estos derechos, puede dirigirse al contacto oficial del evento.</p>`;
            
            const defaultTerms = `<h2>Términos y Condiciones de Uso</h2>
<p>El acceso y uso de la plataforma de registro <b>Check Pro</b> implica la aceptación de los siguientes términos:</p>
<ol>
  <li><b>Veracidad:</b> El usuario garantiza que la información proporcionada es veraz, completa y actualizada.</li>
  <li><b>Uso del Código:</b> El código QR o link de acceso generado es personal e intransferible.</li>
  <li><b>Responsabilidad:</b> El organizador del evento se reserva el derecho de admisión y permanencia según los protocolos establecidos.</li>
  <li><b>Privacidad:</b> Sus datos serán tratados bajo estrictos protocolos de seguridad industrial.</li>
</ol>
<p>El uso indebido de la plataforma podrá resultar en la cancelación del registro.</p>`;
            
            // Usar clipboard para asegurar que el HTML se interprete correctamente en Quill
            if (App.quillPolicy) App.quillPolicy.clipboard.dangerouslyPasteHTML(s.policy_data || defaultPolicy);
            if (App.quillTerms) App.quillTerms.clipboard.dangerouslyPasteHTML(s.terms_conditions || defaultTerms);

            // V12.2.2: Sincronizar checkbox de visibilidad
            const chk = document.getElementById('check-show-legal-login');
            if (chk) chk.checked = s.show_legal_login !== '0';
            
            App.applyUISettings(s);
        } catch (e) {
            console.error('[LEGAL] Error al cargar textos:', e);
        }
    };

    App.applyUISettings = (settings) => {
        const links = document.getElementById('login-legal-links');
        if (links) {
            links.classList.toggle('hidden', settings.show_legal_login === '0');
        }
    };

    cl('btn-save-policy', async () => {
        const html = App.quillPolicy.root.innerHTML;
        const show = document.getElementById('check-show-legal-login')?.checked ? '1' : '0';
        await App.fetchAPI('/settings', { method: 'PUT', body: JSON.stringify({ policy_data: html, show_legal_login: show }) });
        alert('✓ Política de datos guardada exitosamente.');
    });

    cl('btn-save-terms', async () => {
        const html = App.quillTerms.root.innerHTML;
        const show = document.getElementById('check-show-legal-login')?.checked ? '1' : '0';
        await App.fetchAPI('/settings', { method: 'PUT', body: JSON.stringify({ terms_conditions: html, show_legal_login: show }) });
        alert('✓ Términos y Condiciones guardados exitosamente.');
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
        await App.saveSMTPConfig();
    });
    
    cl('btn-test-smtp', async () => {
        await App.testSMTPConnection();
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
            reg_show_phone: document.getElementById('ev-reg-phone').checked ? 1 : 0,
            reg_show_org: document.getElementById('ev-reg-org').checked ? 1 : 0,
            reg_show_position: document.getElementById('ev-reg-position').checked ? 1 : 0,
            reg_show_vegan: document.getElementById('ev-reg-vegan').checked ? 1 : 0,
            reg_show_dietary: document.getElementById('ev-reg-dietary').checked ? 1 : 0,
            reg_show_gender: document.getElementById('ev-reg-gender').checked ? 1 : 0,
            reg_require_agreement: document.getElementById('ev-reg-agreement').checked ? 1 : 0,
            // --- DISEÑO V11.6 ---
            qr_color_dark: document.getElementById('ev-qr-dark').value,
            qr_color_light: document.getElementById('ev-qr-light').value,
            qr_logo_url: document.getElementById('ev-qr-logo').value,
            ticket_bg_url: document.getElementById('ev-ticket-bg').value,
            ticket_accent_color: document.getElementById('ev-ticket-accent').value,
            // FILTROS DE DOMINIO V11.6.2
            reg_email_whitelist: document.getElementById('ev-reg-whitelist').value.trim(),
            reg_email_blacklist: document.getElementById('ev-reg-blacklist').value.trim()
        };

        if (eventId) {
            App.updateEvent(eventId, data);
        } else {
            // Para creación, convertimos a FormData si hay logo, o enviamos JSON
            const logo = document.getElementById('ev-logo-file').files[0];
            if (logo) {
                const fd = new FormData();
                for (const key in data) fd.append(key, data[key]);
                fd.append('logo', logo);
                App.createEvent(fd);
            } else {
                // Si no hay logo, enviamos como JSON para consistencia
                fetch(`${App.constants.API_URL}/events`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-user-id': App.state.user.userId 
                    },
                    body: JSON.stringify(data)
                }).then(r => r.json()).then(d => {
                    if (d.success) {
                        alert("✓ Evento creado.");
                        document.getElementById('modal-event').classList.add('hidden');
                        App.loadEvents();
                    } else alert("Error: " + d.error);
                }).catch(() => alert("Error al crear evento."));
            }
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

    // Survey form
    sf('survey-form', async (e) => {
        e.preventDefault();
        await App.saveSurveyQuestion();
    });

    cl('btn-create-survey', () => App.openSurveyEditor());

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
    
    // ─── DISEÑO PREMIUM V11.6.1 Live Preview ───
    App.updateQRPreview = async () => {
        const img = document.getElementById('ev-qr-preview-img');
        const logo = document.getElementById('ev-qr-preview-logo');
        if (!img) return;
        
        try {
            const dark = document.getElementById('ev-qr-dark').value;
            const light = document.getElementById('ev-qr-light').value;
            const logoUrl = document.getElementById('ev-qr-logo').value;
            
            // Sync Hex Inputs
            document.getElementById('ev-qr-dark-hex').value = dark.toUpperCase();
            document.getElementById('ev-qr-light-hex').value = light.toUpperCase();
            document.getElementById('ev-ticket-accent-hex').value = document.getElementById('ev-ticket-accent').value.toUpperCase();

            const qrDataUrl = await qrcode.toDataURL('CheckProPreview', {
                width: 400,
                margin: 1,
                color: { dark, light },
                errorCorrectionLevel: logoUrl ? 'H' : 'M'
            });
            img.src = qrDataUrl;
            
            if (logoUrl) {
                logo.src = logoUrl;
                logo.classList.remove('hidden');
            } else {
                logo.classList.add('hidden');
            }
        } catch (e) { console.warn('QR Preview Error:', e); }
    };

    ['ev-qr-dark', 'ev-qr-light', 'ev-qr-logo', 'ev-ticket-accent', 'ev-ticket-bg'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => App.updateQRPreview());
    });

    cl('btn-create-event-open', () => {
        document.getElementById('ev-id-hidden').value = '';
        document.getElementById('new-event-form').reset();
        App.updateQRPreview();
        document.getElementById('modal-event')?.classList.remove('hidden');
    });

    // --- DELEGACIÓN GLOBAL DE ACCIONES (V12.6.0) ---
    document.addEventListener('change', async (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        
        if (action === 'changeUserRole') {
            const userId = actionEl.dataset.userId;
            const newRole = actionEl.value;
            if (!userId) return;
            
            // SweetAlert Confirm
            const result = await Swal.fire({
                title: '¿Confirmar Cambio de Rol?',
                text: `Estás a punto de reasignar los permisos de este usuario a ${newRole}.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#7c3aed',
                cancelButtonColor: '#ef4444',
                confirmButtonText: 'Sí, cambiar rol',
                cancelButtonText: 'Cancelar',
                background: '#0f172a',
                color: '#fff'
            });

            if (result.isConfirmed) {
                try {
                    const res = await App.fetchAPI(`/users/${userId}/role`, { 
                        method: 'PUT', 
                        body: JSON.stringify({ role: newRole }) 
                    });
                    if (res.success) {
                        Swal.fire({ title: 'Actualizado', text: 'El rol ha sido cambiado exitosamente.', icon: 'success', background: '#0f172a', color: '#fff', timer: 1500, showConfirmButton: false });
                        App.loadUsersTable();
                    } else {
                        Swal.fire('Error', res.error || 'No se pudo cambiar el rol', 'error');
                        App.loadUsersTable(); // Revertir select visual
                    }
                } catch (e) { 
                    Swal.fire('Error', 'Error de red', 'error');
                    App.loadUsersTable();
                }
            } else {
                App.loadUsersTable(); // Revertir visualmente el select
            }
        }
    });

    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        
        if (typeof App[action] === 'function') {
            const userId = actionEl.dataset.userId;
            const groupId = actionEl.dataset.groupId;
            const eventId = actionEl.dataset.eventId;
            const status = actionEl.dataset.status;
            
            // Call the matched App function with arguments
            if (action === 'removeUserFromEvent') App.removeUserFromEvent(userId, eventId);
            else if (action === 'removeUserFromGroup') App.removeUserFromGroup(userId, groupId);
            else if (action === 'removeEventStaff') App.removeEventStaff(userId);
            else if (action === 'removeEventFromCompany') App.removeEventFromCompany(eventId, groupId);
            else if (action === 'showEventSelectorForCompany' || action === 'showUserSelectorForGroup' || action === 'showGroupSelector' || action === 'showEventSelector' || action === 'approveUser' || action === 'openCompanyModal') {
                // If the function triggers a modal or standard call
                if (action === 'showEventSelectorForCompany') App.showEventSelectorForCompany(groupId);
                else if (action === 'showUserSelectorForGroup') App.showUserSelectorForGroup(groupId);
                else if (action === 'showGroupSelector') App.showGroupSelector(userId, groupId);
                else if (action === 'showEventSelector') App.showEventSelector(userId, JSON.parse(actionEl.dataset.events || '[]'));
                else if (action === 'approveUser') App.approveUser(userId, status);
                else if (action === 'openCompanyModal') App.openCompanyModal(groupId);
            }
        }
    });

});

// Retrocompatibilidad
window.showView = (v) => App.showView(v);
window.logout = () => App.logout();

