import { LS, lazyLoad } from './src/frontend/utils.js';
import { API } from './src/frontend/api.js';

// Imports de nuevos módulos (Fase 1-5 + Form + Dropdown - COMPLETO)
import { Config } from './modules/core/Config.js?v=12.44.441';
import { AppStateManager } from './modules/core/State.js?v=12.44.441';
import { Constants } from './modules/utils/Constants.js?v=12.44.441';
import { RouterManager } from './modules/navigation/Router.js?v=12.44.441';
import { PersistenceManager } from './modules/navigation/Persistence.js?v=12.44.441';
import { ToastManager } from './modules/components/Toast.js?v=12.44.441';
import { ModalManager, hideModal } from './modules/components/Modal.js?v=12.44.441';
import { TableManager } from './modules/components/Table.js?v=12.44.441';
import { SidebarManager } from './modules/components/Sidebar.js?v=12.44.441';
import { FormManager } from './modules/components/Form.js?v=12.44.441';
import { DropdownManager } from './modules/components/Dropdown.js?v=12.44.441';
import { ViewManagerInstance } from './modules/views/ViewManager.js?v=12.44.441';
import { MyEventsViewInstance } from './modules/views/MyEvents.js?v=12.44.441';
import { AdminViewInstance } from './modules/views/Admin.js?v=12.44.441';
import { EventConfigViewInstance } from './modules/views/EventConfig.js?v=12.44.441';
import { SystemViewInstance } from './modules/views/System.js?v=12.44.441';
import { ApiServiceInstance } from './modules/services/ApiService.js?v=12.44.441';
import { AuthServiceInstance } from './modules/services/AuthService.js?v=12.44.441';
import { EventServiceInstance } from './modules/services/EventService.js?v=12.44.441';
import { GuestServiceInstance } from './modules/services/GuestService.js?v=12.44.441';

// DEBUG V12.44.364 - Si ves esto, el código nuevo se cargó
console.log('[INIT] app.js version 12.44.364 loaded');
console.log('[MODULES] Todos los módulos cargados (incl. Form, Dropdown)');

/**
 * MASTER SCRIPT
 * Version: V12.44.363 (Neutral Dark)
 * Author: Carlos
 * 
 * Description: Sistema modular de gestión de asistencia con diseño Chrome Style.
 * 
 * Feature V12.18.20: Sistema de notificaciones push implementado:
 * - _showEmailSection() - versión antigua eliminada
 * - loadIMAPConfig() - versión antigua eliminada  
 * - showUserSelectorForEvent() - versión antigua eliminada
 */
window.LS = LS;
window.lazyLoad = lazyLoad;
const VERSION = '12.44.366';
console.log(`CHECK V${VERSION}: Iniciando Sistema Modular...`);

// --- VERIFICACIÓN INMEDIATA DE VERSIÓN CARGADA (SIMPLIFICADA) ---
// Desactivado temporalmente para diagnosticar problemas de carga
(function checkVersion() {
    console.log(`[VERSION] Script cargado: V${VERSION}`);
    
    // Solo verificación básica sin redirecciones automáticas
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
        const scriptUrl = new URL(currentScript.src, window.location.origin);
        const versionParam = scriptUrl.searchParams.get('v');
        
        if (versionParam && versionParam !== VERSION) {
            console.warn(`[VERSION WARNING] Script cargado con versión ${versionParam}, pero VERSION constante es ${VERSION}`);
            console.warn(`[VERSION WARNING] Posible problema de caché. Presiona Ctrl+F5 para recarga forzada.`);
        }
    }
})();

// --- AUTO-UPDATE CACHE V12.16.2 ---
if ('caches' in window) {
    const v = LS.get('check_app_version');
    if (v !== VERSION) {
        caches.keys().then(names => {
            for (let name of names) caches.delete(name);
        }).then(() => {
            // SANEAMIENTO RADICAL V12.37.23
            console.log(`[VERSION] Saneamiento radical: Borrando localStorage...`);
            localStorage.clear(); 
            sessionStorage.clear();
            LS.set('check_app_version', VERSION);
            console.log(`[VERSION] Cache borrada por actualización a V${VERSION}`);
            
            // Forzar reload inmediato
            window.location.reload(true); 
        });
    }
}


const App = window.App = {
    // Referencia al State Manager (módulos)
    stateManager: AppStateManager,
    
    // Estado legacy (compatibilidad) - migrate gradually
    state: {
        event: null,
        events: [],
        guests: [],
        user: null,
        socket: null,
        chart: null,
        version: Config.VERSION,
        groups: [],
        _navigating: false,
        quillEditor: null,
        editingTemplate: null,
        emailTemplates: [],
        columnConfig: Constants.COLUMNS,
        importSession: null,
        eventsViewMode: 'grid', // 'grid' o 'list'
    },
    // Usar constants del módulo
    constants: { API_URL: Config.API_URL },
    fetchAPI(endpoint, options) { return API.fetchAPI(endpoint, options); },
    
    // Referencia a nuevos módulos (Fase 2 + 3 + 4 + 5 - COMPLETO)
    router: RouterManager,
    persistence: PersistenceManager,
    toast: ToastManager,
    modal: ModalManager,
    table: TableManager,
    sidebar: SidebarManager,
    form: FormManager,
    dropdown: DropdownManager,
    views: ViewManagerInstance,
    myEventsView: MyEventsViewInstance,
    adminView: AdminViewInstance,
    eventConfigView: EventConfigViewInstance,
    systemView: SystemViewInstance,
    api: ApiServiceInstance,
    auth: AuthServiceInstance,
    events: EventServiceInstance,
    guests: GuestServiceInstance,
    
    // --- NAVEGACIÓN CENTRALIZADA (MODERN PRO) ---
    _isPushingState: false,
    _hasHandledInitialNav: false,
    
    _updateSidebarUI(viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('nav-btn-' + viewId);
        if (activeBtn) activeBtn.classList.add('active');
    },

    // ─── NAVEGACIÓN V12.16.3 (MANTENIDA PARA COMPATIBILIDAD) ───
    navigate(viewId) {
        // Redirigir a la función navigate() completa con parámetros por defecto
        this.navigate(viewId, {}, true);
    },

    // ─── PERSISTENCIA Y NAVEGACIÓN POR ROL (v12.34.96) ───
    
    // Obtener vista por defecto según rol
    getDefaultViewByRole(role) {
        // Todos los usuarios van a "Mis Eventos" después de login
        return { view: 'my-events', tab: null };
    },

    // Validar permisos para una vista
    hasPermissionForView(role, view, tab) {
        // ADMIN tiene acceso completo
        if (role === 'ADMIN') return true;
        
        // Todos pueden ver Mis Eventos
        if (view === 'my-events') return true;
        
        // PRODUCTOR puede ver Sistema (con restricciones ya implementadas)
        if (view === 'system' && role === 'PRODUCTOR') return true;
        
        // Otros roles no pueden ver Sistema
        return false;
    },

    // Guardar estado de navegación en sessionStorage
    saveViewState(view, params = {}, role = null) {
        try {
            
            // DEBUG: Registrar si params no tiene 'tab' pero estamos en vista 'system'
            if (view === 'system' && (!params || !params.tab)) {
                console.warn('[PERSISTENCE WARNING] Saving system view without tab parameter! Stack:', new Error().stack);
            }
            
            const state = {
                view: view,
                params: params || {},
                role: role || this.state.user?.role,
                timestamp: Date.now()
            };
            
            // Si estamos en una vista de evento, guardar información adicional
            if (view === 'admin' || view === 'event-config') {
                // Guardar ID del evento actual si existe
                if (this.state.event?.id) {
                    state.eventId = this.state.event.id;
                }
                // Si tenemos ID en params, también guardarlo
                else if (params.id) {
                    state.eventId = params.id;
                }
                
                // Guardar pestaña activa dentro del evento (usando sessionStorage para independencia entre pestañas)
                if (view === 'event-config') {
                    const activeConfigTab = sessionStorage.getItem('active_config_tab');
                    if (activeConfigTab) {
                        state.eventTab = activeConfigTab;
                        state.eventTabType = 'config';
                    }
                } else if (view === 'admin') {
                    const activeEventTab = sessionStorage.getItem('active_event_tab');
                    if (activeEventTab) {
                        state.eventTab = activeEventTab;
                        state.eventTabType = 'admin';
                    }
                }
            }
            
            sessionStorage.setItem('check_current_view', JSON.stringify(state));
            console.log('[PERSISTENCE] Saved view state:', state);
        } catch (e) {
            console.warn('[PERSISTENCE] Error saving view state:', e);
        }
    },

    // Cargar estado de navegación desde sessionStorage
    loadViewState() {
        try {
            const sessionData = sessionStorage.getItem('check_current_view');
            if (!sessionData) return null;
            
            const state = JSON.parse(sessionData);
            console.log('[PERSISTENCE] Loaded view state:', state);
            
            // DEBUG: Registrar si el estado cargado no tiene 'tab' pero es vista 'system'
            if (state.view === 'system' && (!state.params || !state.params.tab)) {
                console.warn('[PERSISTENCE WARNING] Loaded system view without tab parameter!');
            }
            
            // Validar que el estado no sea demasiado viejo (24 horas)
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas
            if (Date.now() - state.timestamp > maxAge) {
                console.log('[PERSISTENCE] State too old, discarding');
                return null;
            }
            
            return state;
        } catch (e) {
            console.warn('[PERSISTENCE] Error loading view state:', e);
            return null;
        }
    },

    // Limpiar estado de navegación
    clearViewState() {
        try {
            sessionStorage.removeItem('check_current_view');
            sessionStorage.removeItem('check_current_url');
            sessionStorage.removeItem('active_config_tab');
            sessionStorage.removeItem('active_event_tab');
            console.log('[PERSISTENCE] Cleared view state and event tabs');
        } catch (e) {
            console.warn('[PERSISTENCE] Error clearing view state:', e);
        }
    },

    // ─── UI PREMIUM UTILS (v12.32.0) ───
    
    // Notificación Toast Premium
    showPremiumToast(title, message, type = 'success', duration = 4000) {
        const container = document.getElementById('premium-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `premium-toast ${type}`;
        
        const icons = {
            success: 'check_circle',
            error: 'cancel',
            warning: 'warning',
            info: 'info'
        };

        toast.innerHTML = `
            <div class="premium-toast-icon">
                <span class="material-symbols-outlined">${icons[type] || 'notifications'}</span>
            </div>
            <div class="premium-toast-content">
                <div class="premium-toast-title">${title}</div>
                <div class="premium-toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);
        this.playPremiumSound(type);

        // Auto-remover
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    },

    // Audio Feedback (Sintetizado para evitar assets externos)
    playPremiumSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            
            if (type === 'success') {
                // Soft Double Chime
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'error') {
                // Low Dull Thud
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
        } catch (e) { console.warn('Audio not supported or blocked'); }
    },

    // Reemplazo de la función antigua de notificación - usar ToastManager
    _notifyAction(title, message, type = 'success', duration = 4000) {
        if (typeof ToastManager !== 'undefined') {
            ToastManager.show(title, message, type, duration);
        } else {
            // Fallback
            this.showPremiumToast(title, message, type, duration);
        }
    },

    navigateToCreateEvent: function(type = 'short') {
        console.log('[NAVIGATE TO CREATE EVENT] Iniciando tipo:', type);
        
        // No navegar si ya estamos en una vista permitida (my-events, dashboard)
        const currentView = LS.get('current_view');
        if (currentView !== 'my-events' && currentView !== 'dashboard') {
            this.navigate('my-events');
        }

        // Preparar y abrir el modal
        setTimeout(async () => {
            const form = document.getElementById('new-event-form');
            if (form) {
                form.reset();
                document.getElementById('ev-id-hidden').value = '';
                
                // Poblar selector de clientes
                const clientSelect = document.getElementById('ev-client');
                if (clientSelect) {
                    // Asegurar que los clientes estén cargados en el estado
                    if (!this.state.clients || this.state.clients.length === 0) {
                        try {
                            const clientsRes = await this.fetchAPI('/clients');
                            this.state.clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes.data || []);
                        } catch(e) { console.error('Error cargando clientes:', e); }
                    }
                    
                    const clients = this.state.clients || [];
                    clientSelect.innerHTML = '<option value="">Seleccionar cliente</option>' + 
                        clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                }

                // Asegurar listener único
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.saveEventShort(e);
                };
            }
            
            const modal = document.getElementById('modal-event');
            if (modal) {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                modal.removeAttribute('aria-hidden');
            } else {
                console.error('[NAVIGATE TO CREATE EVENT] Modal no encontrado');
                this._notifyAction('Error', 'No se pudo abrir el modal', 'error');
            }
        }, 100);
    },

    saveEventShort: async function(e) {
        console.log('[SAVE EVENT SHORT] Procesando guardado...');
        try {
            const name = document.getElementById('ev-name')?.value;
            const location = document.getElementById('ev-location')?.value;
            const date = document.getElementById('ev-date')?.value;
            const description = document.getElementById('ev-desc')?.value;
            const clientId = document.getElementById('ev-client')?.value;

            if (!name) return this._notifyAction('⚠️ Error', 'El nombre es obligatorio', 'warning');

            this._notifyAction('Guardando...', 'Creando evento', 'info', 0);

            const res = await this.fetchAPI('/events', {
                method: 'POST',
                body: JSON.stringify({ 
                    name, 
                    location: location || '', 
                    date: date || new Date().toISOString(),
                    description: description || '',
                    client_id: clientId || null,
                    status: 'PUBLISHED'
                })
            });

            if (res && (res.id || res.success)) {
                const modal = document.getElementById('modal-event');
                if (modal) modal.classList.add('hidden');
                
                this._notifyAction('✓ Éxito', 'Evento creado', 'success');
                
                this._lastEventsLoad = 0;
                await this.loadEvents();
                
                if (LS.get('current_view') === 'my-events') {
                    this.renderEventsTable();
                }
            } else {
                throw new Error(res?.error || 'Error al guardar');
            }
        } catch (err) {
            console.error('[SAVE EVENT SHORT] Error:', err);
            this._notifyAction('Error', 'No se pudo guardar: ' + err.message, 'error');
        }
    },

    switchEventTab(tabId) {
        console.log(`[NAV] Event Tab: ${tabId}`);
        document.querySelectorAll('[id^="ev-content-"]').forEach(el => el.classList.add('hidden'));
        document.getElementById(`ev-content-${tabId}`)?.classList.remove('hidden');

        document.querySelectorAll('#view-admin .sub-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tabTarget === `ev-content-${tabId}`) btn.classList.add('active');
        });
        
        // Cargar datos según el tab seleccionado
        const eventId = this.state.event?.id || this.currentEventId;
        if (eventId) {
            if (tabId === 'agenda') {
                this.loadEventAgenda(eventId);
            }
        }
    },

    navigateToCreateUser() { 
        this._openUserModalFromSelector = true;
        this.openInviteModal(); 
    },
    // Abrir carrusel de edición de staff (botón "Edición")
    openUserEditCarousel: async function() {
        const selectedUsers = this.state.selectedUsers || [];
        if (selectedUsers.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        // Asegurar que los datos estén cargados
        if (!this.state.allUsers?.length || !this.state.groups?.length) {
            await this.loadUsersTable();
        }
        if (!this.state.clients?.length) {
            try {
                const clientsRes = await this.fetchAPI('/clients');
                this.state.clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes.data || []);
            } catch(e) { this.state.clients = []; }
        }
        this.editSelectedUsers(selectedUsers);
    },
    navigateToCreateGroup: function() {
        // Cerrar modal de SweetAlert2 si está abierto
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
        this._openCompanyModalFromSelector = true;
        this.openCompanyModal();
    },

    // ─── IMPORTAR / EXPORTAR DATOS V12.44.38 ───
    openImportModal: function(type) {
        this._importType = type; // 'groups' o 'staff'
        this._importData = null;
        
        // Resetear UI
        const progressContainer = document.getElementById('import-progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
        document.getElementById('import-new-count').textContent = '0';
        document.getElementById('import-update-count').textContent = '0';
        document.getElementById('import-error-count').textContent = '0';
        document.getElementById('import-status').textContent = 'Procesando...';
        document.getElementById('import-progress-fill').style.width = '0%';
        document.getElementById('btn-confirm-import').disabled = true;
        
        const modal = document.getElementById('modal-import');
        if (modal) modal.classList.remove('hidden');
    },

    openExportModal: function(type) {
        this._exportType = type; // 'groups', 'staff', 'clients', 'all'
        document.getElementById('export-progress-container').classList.add('hidden');
        const modal = document.getElementById('modal-export');
        if (modal) modal.classList.remove('hidden');
    },

    // Abrir modal de exportación para toda la base de datos (DB)
    openExportDBModal: function() {
        this.openExportModal('all');
    },

    downloadImportTemplate: async function() {
        try {
            // Obtener token igual que API.fetchAPI
            let token = window.App?.state?.user?.token;
            if (!token) {
                const userStr = LS.get('user');
                const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
                token = user.token || LS.get('token');
            }
            
            const response = await fetch('/api/import/template', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error en respuesta');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_importacion_check.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Descarga iniciada', text: 'Revisa tu carpeta de descargas', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
            }
        } catch(e) {
            console.error('Error descargando plantilla:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar la plantilla' });
            }
        }
    },

    initImportHandlers: function() {
        const modal = document.getElementById('modal-import');
        if (!modal) return;

        // Cerrar modal
        document.getElementById('btn-close-import')?.addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('btn-cancel-import')?.addEventListener('click', () => modal.classList.add('hidden'));

        // Drop zone
        const dropZone = document.getElementById('import-drop-zone');
        const fileInput = document.getElementById('import-file-input');

        dropZone?.addEventListener('click', () => fileInput?.click());
        
        dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-[var(--primary)]'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('border-[var(--primary)]'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-[var(--primary)]');
            const file = e.dataTransfer.files[0];
            if (file) this.processImportFile(file);
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processImportFile(file);
        });

        // Confirmar importación
        document.getElementById('btn-confirm-import')?.addEventListener('click', () => this.executeImport());
    },

    processImportFile: async function(file) {
        // Obtener token igual que API.fetchAPI
        let token = window.App?.state?.user?.token;
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
        }
        
        // Convertir archivo a base64
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1]; // Remover data:...base64,
            
            try {
                const response = await fetch('/api/import/validate', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        file: base64,
                        filename: file.name,
                        type: this._importType 
                    })
                });
                const data = await response.json();
            
            if (data.success) {
                this._importData = data.data;
                this._importStats = data.stats;
                
                // Mostrar progreso
                document.getElementById('import-progress-container').classList.remove('hidden');
                document.getElementById('import-new-count').textContent = data.stats.new || 0;
                document.getElementById('import-update-count').textContent = data.stats.update || 0;
                document.getElementById('import-error-count').textContent = data.stats.errors || 0;
                document.getElementById('import-status').textContent = data.stats.message || 'Datos válidos';
                document.getElementById('import-progress-fill').style.width = '100%';
                document.getElementById('btn-confirm-import').disabled = false;
                
                // Mostrar detalles si hay errores
                if (data.errors && data.errors.length > 0) {
                    const details = document.getElementById('import-details');
                    details.classList.remove('hidden');
                    details.innerHTML = data.errors.slice(0, 10).map(e => `<p class="text-red-400">• ${e}</p>`).join('');
                    if (data.errors.length > 10) {
                        details.innerHTML += `<p class="text-[var(--text-muted)]">... y ${data.errors.length - 10} más</p>`;
                    }
                }
            } else {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Error validando archivo' });
                }
            }
            } catch(e) {
                console.error('Error procesando archivo:', e);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al procesar el archivo' });
                }
            }
        };
        reader.onerror = () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error leyendo archivo' });
            }
        };
        reader.readAsDataURL(file);
    },

    executeImport: async function() {
        if (!this._importData) return;
        
        // Obtener token igual que API.fetchAPI
        let token = window.App?.state?.user?.token;
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
        }
        
        const btn = document.getElementById('btn-confirm-import');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Importando...';

        try {
            const response = await fetch('/api/import/execute', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: this._importType, data: this._importData })
            });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('import-status').textContent = `Importación completada: ${result.imported} registros`;
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'success', title: 'Importación exitosa', text: `${result.imported} registros importados, ${result.updated} actualizados`, timer: 3000, toast: true, position: 'top-end' });
                }
                
                // Recargar datos según tipo
                if (this._importType === 'groups') window.App.loadGroups();
                else if (this._importType === 'staff') window.App.loadUsersTable();
                else if (this._importType === 'clients') window.App.loadClients();
                else {
                    window.App.loadGroups();
                    window.App.loadUsersTable();
                    window.App.loadClients();
                }
                
                setTimeout(() => document.getElementById('modal-import')?.classList.add('hidden'), 1500);
            }
        } catch(e) {
            console.error('Error en importación:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error durante la importación' });
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">system_update</span> Importar Datos';
        }
    },

    initExportHandlers: function() {
        const modal = document.getElementById('modal-export');
        if (!modal) return;

        // Cerrar modal
        document.getElementById('btn-close-export')?.addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('btn-cancel-export')?.addEventListener('click', () => modal.classList.add('hidden'));

        // Confirmar exportación
        document.getElementById('btn-confirm-export')?.addEventListener('click', () => this.executeExport());
    },

    executeExport: async function() {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'excel';
        
        const btn = document.getElementById('btn-confirm-export');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Generando...';
        document.getElementById('export-progress-container').classList.remove('hidden');

        try {
            // Obtener token igual que API.fetchAPI
            let token = window.App?.state?.user?.token;
            if (!token) {
                const userStr = LS.get('user');
                const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
                token = user.token || LS.get('token');
            }
            
            const response = await fetch(`/api/export/${this._exportType}?format=${format}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (format === 'excel') {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${this._exportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${this._exportType}_${new Date().toISOString().split('T')[0]}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Exportación completada', text: 'Revisa tu carpeta de descargas', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
            }
            
            setTimeout(() => document.getElementById('modal-export').classList.add('hidden'), 1000);
        } catch(e) {
            console.error('Error en exportación:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar el archivo' });
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">download</span> Exportar';
        }
    },

    closeGroupSelector: function() {
        // Cerrar modal de SweetAlert2 si está abierto
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
    },

    selectEvent: async function(id) {
        try {
            const event = await this.fetchAPI(`/events/${id}`);
            this.state.event = event;
            this.navigate('admin', { id: id });
            
            // Actualizar UI del panel de control
            document.getElementById('admin-event-title').textContent = event.name;
            document.getElementById('admin-event-location').textContent = event.location || 'Sin ubicación';
            
            // Cargar invitados
            this.loadGuests();
        } catch(e) { console.error('Error selecting event:', e); }
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
        if (!roleSelect) return;
        
        const role = this.state.user?.role;
        
        if (role === 'ADMIN') {
            roleSelect.innerHTML = `
                <option value="ADMIN">ADMIN (Super Administrador)</option>
                <option value="PRODUCTOR" selected>PRODUCTOR (Gestión de Eventos)</option>
                <option value="LOGISTICO">LOGISTICO (Logística)</option>
                <option value="STAFF">STAFF (Check-in en Sitio)</option>
                <option value="CLIENTE">CLIENTE (Acceso de Cliente)</option>`;
        } else if (role === 'PRODUCTOR') {
            roleSelect.innerHTML = `
                <option value="PRODUCTOR" selected>PRODUCTOR (Gestión de Eventos)</option>
                <option value="LOGISTICO">LOGISTICO (Logística)</option>
                <option value="STAFF">STAFF (Check-in en Sitio)</option>
                <option value="CLIENTE">CLIENTE (Acceso de Cliente)</option>`;
        } else {
            // Otros roles: solo STAFF y CLIENTE
            roleSelect.innerHTML = `
                <option value="STAFF" selected>STAFF (Check-in en Sitio)</option>
                <option value="CLIENTE">CLIENTE (Acceso de Cliente)</option>`;
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
        // Usar función unificada loadAppVersion()
        await this.loadAppVersion();
    },

    // ─── SIDEBAR COLAPSABLE (CHROME STYLE) ───
    toggleSidebar() {
        const sidebar = document.getElementById('global-sidebar');
        if (!sidebar) {
            console.warn('[SIDEBAR] sidebar no encontrado!');
            return;
        }
        const isCollapsed = sidebar.classList.toggle('collapsed');
        LS.set('sidebarCollapsed', isCollapsed);
        
        // Cambiar icono del botón
        const btn = document.getElementById('btn-toggle-sidebar');
        if (btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isCollapsed ? 'menu' : 'menu_open';
            }
        }
    },

    // ─── ACTUALIZAR VISIBILIDAD DEL SIDEBAR ───
    updateSidebarVisibility() {
        const hasSelectedEvent = !!this.state.event?.id;
        const isAdmin = this.state.user?.role === 'ADMIN';
        
        // Panel Admin - solo visible si es ADMIN Y hay evento seleccionado
        const btnAdmin = document.getElementById('nav-btn-admin');
        if (btnAdmin) {
            const shouldShow = isAdmin && hasSelectedEvent;
            btnAdmin.classList.toggle('hidden', !shouldShow);
            btnAdmin.style.display = shouldShow ? '' : 'none';
        }
        
        // Config. Evento - solo visible si hay evento seleccionado
        const btnEventConfig = document.getElementById('nav-btn-event-config');
        if (btnEventConfig) {
            btnEventConfig.classList.toggle('hidden', !hasSelectedEvent);
            btnEventConfig.style.display = hasSelectedEvent ? '' : 'none';
        }
    },

    initSidebar() {
        
        // FORZAR sidebar expandido al inicio (temporalmente para debugging)
        // const isCollapsed = LS.get('sidebarCollapsed') === true;
        const isCollapsed = false; // Forzar expandido
        
        if (isCollapsed) {
            const sidebar = document.getElementById('global-sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
            }
            
            const btn = document.getElementById('btn-toggle-sidebar');
            if (btn) {
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = 'menu';
            }
        } else {
            // Asegurarse de que NO tenga clase collapsed
            const sidebar = document.getElementById('global-sidebar');
            if (sidebar) {
                sidebar.classList.remove('collapsed');
            }
        }
    },

    // ──── NOTIFICACIONES PUSH (Web Push API) ────
    initPushNotifications: async function() {
        try {
            // Registrar service worker si no está registrado
            const registration = await navigator.serviceWorker.register('/js/sw.js');
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
                console.warn('[PUSH] VAPID keys no configuradas en servidor. Notificaciones push deshabilitadas.');
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
            console.warn('[PUSH] Error al inicializar notificaciones push (no crítico):', error.message);
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
    
    // Activar notificaciones push desde botón manual
    enablePushNotifications: async function() {
        const btn = document.getElementById('btn-enable-push');
        const statusText = document.getElementById('push-status-text');
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">sync</span> Activando...';
            }
            
            const result = await this.initPushNotifications();
            
            if (result) {
                if (statusText) statusText.textContent = '✅ Estado: Activo';
                if (btn) {
                    btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">check</span> Activado';
                    btn.classList.add('!bg-green-600');
                }
                alert('✅ Notificaciones push activadas correctamente');
            } else {
                if (statusText) statusText.textContent = '❌ Estado: Error al activar';
                alert('⚠️ No se pudieron activar las notificaciones. Verifica que las VAPID keys estén configuradas en el servidor.');
            }
        } catch(e) {
            console.error('[PUSH] Error:', e);
            if (statusText) statusText.textContent = '❌ Estado: Error - ' + e.message;
            alert('❌ Error: ' + e.message);
        } finally {
            if (btn) btn.disabled = false;
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
        console.log('===== loadGroups LLAMADA =====');
        if (!this.state.user || this.state.user.role !== 'ADMIN') return;
        try {
            const groups = await this.fetchAPI('/groups');
            const users = await this.fetchAPI('/users');
            const events = await this.fetchAPI('/events');
            const clients = await this.fetchAPI('/clients');
            console.log('loadGroups: groups received:', groups?.length);
            if (!Array.isArray(groups) || !Array.isArray(users)) return;
            this.state.groups = groups;
            this.state.allUsers = users;
            this.state.allEvents = events;
            this.state.clients = clients;
            
            // Poblar filtros
            this.populateGroupFilters();
            
            const tbody = document.getElementById('groups-tbody');
            if (tbody) {
                tbody.innerHTML = groups.map(g => {
                    const groupUsers = users.filter(u => u.groups && u.groups.some(gp => String(gp.id) === String(g.id)));
                    const userRows = groupUsers.length > 0 ? groupUsers.map(u => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${u.display_name || u.username}</span>
                        </div>
                    `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-[var(--text-muted)] italic">Sin staff</span></div>`;
                    
                    const groupEvents = events.filter(e => String(e.group_id) === String(g.id));
                    const eventRows = groupEvents.length > 0 ? groupEvents.map(e => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #ec4899; background: rgba(236,72,153,0.15); border-radius: 6px;">event</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name}</span>
                        </div>
                    `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">event</span><span class="text-xs text-[var(--text-muted)] italic">Sin eventos</span></div>`;
                    
                    const groupClients = clients.filter(c => String(c.group_id) === String(g.id));
                    const clientRows = groupClients.length > 0 ? groupClients.map(c => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #10b981; background: rgba(16,185,129,0.15); border-radius: 6px;">person</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name}</span>
                        </div>
                    `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-[var(--text-muted)] italic">Sin clientes</span></div>`;
                    
                    return `
                    <tr class="user-row-premium">
                        <td class="px-2 py-3 align-middle" style="width: 40px;">
                            <input type="checkbox" class="group-checkbox" data-group-id="${g.id}" style="width: 16px; height: 16px; cursor: pointer;" onchange="App.toggleGroupSelection('${g.id}')">
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #7c3aed; background: rgba(124,58,237,0.15); border-radius: 6px;">business</span>
                                <div class="flex flex-col">
                                    <div class="font-bold text-sm text-[var(--text-main)]">${g.name}</div>
                                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${g.email || '-'}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex flex-col max-w-[200px]">${clientRows}</div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex flex-col max-w-[200px]">${userRows}</div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex flex-col max-w-[200px]">${eventRows}</div>
                        </td>
                        <td class="px-2 py-3 align-middle text-left">
                            <span class="status-pill ${g.status === 'ACTIVE' ? 'status-active' : 'status-pending'}">
                                ${g.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                    </tr>`;
                }).join('');
            }
        } catch(e) { console.error('Error loading groups:', e); }
    },

    // Cargar clientes con eventos y staff
    loadClients: async function() {
        if (!this.state.user) return;
        try {
            const clients = await this.fetchAPI('/clients');
            const events = await this.fetchAPI('/events');
            const users = await this.fetchAPI('/users');
            const groups = await this.fetchAPI('/groups');
            
            if (!Array.isArray(clients)) return;
            this.state.clients = clients;
            this.state.allEvents = events;
            this.state.allUsers = users;
            this.state.groups = groups;
            
            // Poblar filtros
            this.populateClientFilters();
            
            const tbody = document.getElementById('clients-tbody');
            if (tbody) {
                tbody.innerHTML = clients.map(c => {
                    // Eventos del cliente con iconos
                    const clientEvents = c.events || [];
                    const eventRows = clientEvents.length > 0 ? clientEvents.map(e => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #ec4899; background: rgba(236,72,153,0.15); border-radius: 6px;">event</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name}</span>
                        </div>
                    `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">event</span><span class="text-xs text-slate-500 italic">Sin eventos</span></div>`;
                    
                    // Staff asignado al cliente con iconos
                    const clientStaff = c.staff || [];
                    const staffRows = clientStaff.length > 0 ? clientStaff.map(u => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">badge</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${u.display_name || u.username}</span>
                        </div>
                    `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">badge</span><span class="text-xs text-slate-500 italic">Sin staff</span></div>`;
                    
                    return `
                    <tr class="user-row-premium">
                        <td class="px-2 py-3 align-middle" style="width: 40px;">
                            <input type="checkbox" class="client-checkbox" data-client-id="${c.id}" style="width: 16px; height: 16px; cursor: pointer;" onchange="App.toggleClientSelection('${c.id}')">
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #10b981; background: rgba(16,185,129,0.15); border-radius: 6px;">person</span>
                                <div>
                                    <div class="font-bold text-sm text-[var(--text-main)]">${c.name}</div>
                                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${c.email || '-'}</div>
                                    ${c.phone ? `<div class="text-[10px] text-[var(--text-muted)]">${c.phone}</div>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                                <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #7c3aed; background: rgba(124,58,237,0.15); border-radius: 6px;">domain</span>
                                <span class="text-xs font-medium text-[var(--text-main)]">${c.company_name || 'Sin empresa'}</span>
                            </div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex flex-col max-w-[200px]">${staffRows}</div>
                        </td>
                        <td class="px-2 py-3 align-middle">
                            <div class="flex flex-col max-w-[200px]">${eventRows}</div>
                        </td>
                        <td class="px-2 py-3 align-middle text-left">
                            <span class="status-pill ${c.status === 'ACTIVE' ? 'status-active' : 'status-pending'}">
                                ${c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                    </tr>`;
                }).join('');
            }
        } catch(e) { console.error('Error loading clients:', e); }
    },

    // Poblar filtros de clientes
    populateClientFilters: function() {
        const companySelect = document.getElementById('filter-client-company');
        const staffSelect = document.getElementById('filter-client-staff');
        const eventSelect = document.getElementById('filter-client-event');
        
        if (companySelect && this.state.groups) {
            const currentVal = companySelect.value;
            companySelect.innerHTML = '<option value="">Empresa</option>';
            this.state.groups.forEach(g => {
                companySelect.innerHTML += `<option value="${g.id}">${g.name}</option>`;
            });
            companySelect.value = currentVal;
        }
        
        if (staffSelect && this.state.allUsers) {
            const currentVal = staffSelect.value;
            staffSelect.innerHTML = '<option value="">Staff</option>';
            this.state.allUsers.forEach(u => {
                staffSelect.innerHTML += `<option value="${u.id}">${u.display_name || u.username}</option>`;
            });
            staffSelect.value = currentVal;
        }
        
        if (eventSelect && this.state.events) {
            const currentVal = eventSelect.value;
            eventSelect.innerHTML = '<option value="">Evento</option>';
            this.state.events.forEach(e => {
                eventSelect.innerHTML += `<option value="${e.id}">${e.name}</option>`;
            });
            eventSelect.value = currentVal;
        }
    },

    // Filtrar clientes
    filterClients: function() {
        if (!this.state.clients) return;
        const searchTerm = document.getElementById('client-search')?.value.toLowerCase() || '';
        const companyFilter = document.getElementById('filter-client-company')?.value || '';
        const staffFilter = document.getElementById('filter-client-staff')?.value || '';
        const eventFilter = document.getElementById('filter-client-event')?.value || '';
        
        let filtered = this.state.clients;
        
        if (searchTerm) {
            filtered = filtered.filter(c => 
                c.name?.toLowerCase().includes(searchTerm) ||
                c.email?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (companyFilter) {
            filtered = filtered.filter(c => c.group_id === companyFilter);
        }
        
        if (staffFilter) {
            filtered = filtered.filter(c => 
                c.staff && c.staff.some(s => s.id === staffFilter)
            );
        }
        
        if (eventFilter) {
            filtered = filtered.filter(c => 
                c.events && c.events.some(e => e.id === eventFilter)
            );
        }
        
        // Re-renderizar tabla con filtered
        const tbody = document.getElementById('clients-tbody');
        if (tbody) {
            tbody.innerHTML = filtered.map(c => {
                const clientEvents = c.events || [];
                const eventChips = clientEvents.map(e => `
                    <span class="block text-xs font-medium mb-1 text-[var(--text-main)]">
                        ${e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name}
                    </span>
                `).join('');
                
                const clientStaff = c.staff || [];
                const staffChips = clientStaff.map(u => `
                    <span class="block text-xs font-medium mb-1 text-[var(--text-main)]">
                        ${u.display_name || u.username}
                    </span>
                `).join('');
                
                return `
                <tr class="user-row-premium">
                    <td class="px-2 py-3 align-middle" style="width: 40px;">
                        <input type="checkbox" class="client-checkbox" data-client-id="${c.id}" style="width: 16px; height: 16px; cursor: pointer;" onchange="App.toggleClientSelection('${c.id}')">
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #10b981; background: rgba(16,185,129,0.15); border-radius: 6px;">person</span>
                            <div class="flex flex-col">
                                <div class="font-bold text-sm text-[var(--text-main)]">${c.name}</div>
                                <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${c.email || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-3 align-middle">
                        ${c.company_name ? `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #7c3aed; background: rgba(124,58,237,0.15); border-radius: 6px;">corporate_fare</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${c.company_name.length > 15 ? c.company_name.substring(0, 15) + '...' : c.company_name}</span>
                        </div>` : `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">corporate_fare</span>
                            <span class="text-xs text-slate-500 italic">Sin empresa</span>
                        </div>`}
                    </td>
                    <td class="px-2 py-3 align-middle">
                        ${clientStaff.length > 0 ? clientStaff.map(u => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${(u.display_name || u.username).length > 15 ? (u.display_name || u.username).substring(0, 15) + '...' : (u.display_name || u.username)}</span>
                        </div>`).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-slate-500 italic">Sin staff</span></div>`}
                    </td>
                    <td class="px-2 py-3 align-middle">
                        ${clientEvents.length > 0 ? clientEvents.map(e => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #ec4899; background: rgba(236,72,153,0.15); border-radius: 6px;">event</span>
                            <span class="text-xs font-medium text-[var(--text-main)]">${e.name.length > 15 ? e.name.substring(0, 15) + '...' : e.name}</span>
                        </div>`).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">event</span><span class="text-xs text-slate-500 italic">Sin eventos</span></div>`}
                    </td>
                    <td class="px-2 py-3 align-middle text-left">
                        <span class="status-pill ${c.status === 'ACTIVE' ? 'status-active' : 'status-pending'}">
                            ${c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                </tr>`;
            }).join('');
        }
    },

    // Toggle selección de cliente
    // Selección de empresas
    toggleGroupSelection: function(groupId) {
        if (!this.state.selectedGroups) this.state.selectedGroups = [];
        const idx = this.state.selectedGroups.indexOf(groupId);
        if (idx > -1) {
            this.state.selectedGroups.splice(idx, 1);
        } else {
            // Selección única: limpiar anteriores y seleccionar solo esta
            this.state.selectedGroups = [groupId];
        }
        // Sincronizar checkboxes visuales
        document.querySelectorAll('.group-checkbox').forEach(cb => {
            cb.checked = this.state.selectedGroups.includes(cb.dataset.groupId);
        });
    },

    // Limpiar selección de grupos
    clearGroupSelection: function() {
        this.state.selectedGroups = [];
        document.querySelectorAll('.group-checkbox').forEach(cb => cb.checked = false);
    },

    // Seleccionar/deseleccionar todas las empresas
    toggleSelectAllGroups: function() {
        const selectAll = document.getElementById('select-all-groups');
        const checkboxes = document.querySelectorAll('.group-checkbox');
        if (selectAll.checked) {
            checkboxes.forEach(cb => cb.checked = true);
            this.state.selectedGroups = Array.from(checkboxes).map(cb => cb.dataset.groupId);
        } else {
            checkboxes.forEach(cb => cb.checked = false);
            this.state.selectedGroups = [];
        }
    },

    // Normalizar texto: quita acentos, minúsculas, espacios extra
    _normalize: function(text) {
        if (!text) return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
    },

    // Mostrar sugerencias de búsqueda para empresas
    showGroupSuggestions: function() {
        const raw = document.getElementById('group-search')?.value || '';
        const term = this._normalize(raw);
        const container = document.getElementById('group-suggestions');
        if (!container) return;

        if (term.length < 2) {
            this.hideGroupSuggestions();
            return;
        }

        const groups = this.state.groups || [];
        const clients = this.state.clients || [];
        const users = this.state.allUsers || [];
        const events = this.state.allEvents || [];
        const searchWords = term.split(' ').filter(w => w.length > 0);

        // Recolectar sugerencias con puntuación de relevancia
        const suggestions = [];

        groups.forEach(g => {
            const gName = this._normalize(g.name);
            const gEmail = this._normalize(g.email);
            let score = 0;
            let matchType = '';

            // Coincidencia exacta al inicio = mayor score
            if (gName.startsWith(term)) { score = 100; matchType = 'empresa'; }
            else if (searchWords.every(w => gName.includes(w))) { score = 80; matchType = 'empresa'; }
            else if (gEmail && searchWords.every(w => gEmail.includes(w))) { score = 60; matchType = 'email'; }

            if (score > 0) {
                // Resaltar coincidencia
                const icon = matchType === 'empresa' ? 'corporate_fare' : 'mail';
                const color = matchType === 'empresa' ? '#7c3aed' : '#64748b';
                suggestions.push({ score, text: g.name, subtext: g.email || '', icon, color, type: matchType });
            }
        });

        // Clientes asignados a empresas
        clients.forEach(c => {
            const cName = this._normalize(c.name);
            if (searchWords.every(w => cName.includes(w))) {
                const group = groups.find(g => String(g.group_id) === String(c.id));
                suggestions.push({
                    score: 70,
                    text: c.name,
                    subtext: group ? `Cliente → ${group.name}` : 'Cliente sin empresa',
                    icon: 'person',
                    color: '#10b981',
                    type: 'cliente'
                });
            }
        });

        // Staff
        users.forEach(u => {
            const uName = this._normalize(u.display_name || u.username);
            if (searchWords.every(w => uName.includes(w))) {
                suggestions.push({
                    score: 65,
                    text: u.display_name || u.username,
                    subtext: u.role || 'Staff',
                    icon: 'badge',
                    color: '#3b82f6',
                    type: 'staff'
                });
            }
        });

        // Eventos
        events.forEach(e => {
            const eName = this._normalize(e.name);
            if (searchWords.every(w => eName.includes(w))) {
                suggestions.push({
                    score: 60,
                    text: e.name,
                    subtext: e.date || e.location || 'Evento',
                    icon: 'event',
                    color: '#ec4899',
                    type: 'evento'
                });
            }
        });

        // Ordenar por score y limitar a 8
        suggestions.sort((a, b) => b.score - a.score);
        const top = suggestions.slice(0, 8);

        if (top.length === 0) {
            this.hideGroupSuggestions();
            return;
        }

        container.innerHTML = top.map((s, i) => `
            <div onclick="App.selectSuggestion('${s.text.replace(/'/g, "\\'")}')" 
                 class="group-suggestion-item" 
                 style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); ${i === top.length - 1 ? 'border-bottom: none;' : ''}"
                 onmouseover="this.style.background='rgba(124,58,237,0.15)'" 
                 onmouseout="this.style.background='transparent'">
                <span class="material-symbols-outlined" style="font-size: 18px; color: ${s.color}; flex-shrink: 0;">${s.icon}</span>
                <div class="flex-1 min-w-0">
                    <div style="font-size: 13px; font-weight: 500; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this._highlightMatch(s.text, raw)}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${s.subtext}</div>
                </div>
                <span style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 600; flex-shrink: 0;">${s.type}</span>
            </div>
        `).join('');

        container.classList.remove('hidden');
    },

    // Resaltar coincidencia en el texto
    _highlightMatch: function(text, raw) {
        if (!raw) return text;
        const normalized = this._normalize(text);
        const searchNorm = this._normalize(raw);
        const words = searchNorm.split(' ').filter(w => w.length > 0);
        let result = text;
        words.forEach(word => {
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            // Buscar en texto normalizado
            const normText = this._normalize(result);
            const idx = normText.indexOf(word);
            if (idx >= 0) {
                const original = result.substring(idx, idx + word.length);
                result = result.replace(original, `<mark style="background: rgba(124,58,237,0.3); color: #c4b5fd; border-radius: 2px; padding: 0 2px;">${original}</mark>`);
            }
        });
        return result;
    },

    // Seleccionar sugerencia
    selectSuggestion: function(text) {
        const input = document.getElementById('group-search');
        if (input) {
            input.value = text;
            this.filterGroups();
        }
        this.hideGroupSuggestions();
    },

    // Ocultar sugerencias
    hideGroupSuggestions: function() {
        const container = document.getElementById('group-suggestions');
        if (container) container.classList.add('hidden');
    },

    // Filtrar empresas por búsqueda y filtros
    filterGroups: function() {
        if (!this.state.groups) return;
        const searchTermRaw = document.getElementById('group-search')?.value || '';
        const term = this._normalize(searchTermRaw);
        const clientFilter = document.getElementById('filter-group-client')?.value || '';
        const userFilter = document.getElementById('filter-group-user')?.value || '';
        const eventFilter = document.getElementById('filter-group-event')?.value || '';
        const statusFilter = document.getElementById('filter-group-status')?.value || '';

        const users = this.state.allUsers || [];
        const events = this.state.allEvents || [];
        const clients = this.state.clients || [];

        let filtered = this.state.groups;

        // Búsqueda global flexible: normaliza acentos y busca por palabras separadas
        if (term) {
            const searchWords = term.split(' ').filter(w => w.length > 0);
            filtered = filtered.filter(g => {
                // Normalizar campos de la empresa
                const gName = this._normalize(g.name);
                const gEmail = this._normalize(g.email);
                // Buscar empresa: TODAS las palabras deben coincidir en algún campo
                const matchCompany = searchWords.every(w => gName.includes(w) || gEmail.includes(w));
                if (matchCompany) return true;
                // Buscar en clientes asignados
                const groupClients = clients.filter(c => String(c.group_id) === String(g.id));
                if (groupClients.some(c => searchWords.every(w => this._normalize(c.name).includes(w) || this._normalize(c.email).includes(w)))) return true;
                // Buscar en staff asignado
                const groupUsers = users.filter(u => u.groups && u.groups.some(gp => String(gp.id) === String(g.id)));
                if (groupUsers.some(u => searchWords.every(w => this._normalize(u.display_name).includes(w) || this._normalize(u.username).includes(w)))) return true;
                // Buscar en eventos asignados
                const groupEvents = events.filter(e => String(e.group_id) === String(g.id));
                if (groupEvents.some(e => searchWords.every(w => this._normalize(e.name).includes(w) || this._normalize(e.location).includes(w)))) return true;
                return false;
            });
        }

        if (clientFilter) {
            filtered = filtered.filter(g => clients.some(c => String(c.group_id) === String(g.id) && String(c.id) === String(clientFilter)));
        }

        if (userFilter) {
            filtered = filtered.filter(g => users.some(u => u.groups && u.groups.some(gp => String(gp.id) === String(g.id)) && String(u.id) === String(userFilter)));
        }

        if (eventFilter) {
            filtered = filtered.filter(g => events.some(e => String(e.group_id) === String(g.id) && String(e.id) === String(eventFilter)));
        }

        if (statusFilter) {
            filtered = filtered.filter(g => g.status === statusFilter);
        }

        // Ocultar sugerencias después de filtrar
        this.hideGroupSuggestions();

        // Re-renderizar tabla con filtered
        const tbody = document.getElementById('groups-tbody');
        if (tbody) {
            const users = this.state.allUsers || [];
            const events = this.state.allEvents || [];
            const clients = this.state.clients || [];

            tbody.innerHTML = filtered.map(g => {
                const groupUsers = users.filter(u => u.groups && u.groups.some(gp => String(gp.id) === String(g.id)));
                const userRows = groupUsers.length > 0 ? groupUsers.map(u => `
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${u.display_name || u.username}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-[var(--text-muted)] italic">Sin staff</span></div>`;

                const groupEvents = events.filter(e => String(e.group_id) === String(g.id));
                const eventRows = groupEvents.length > 0 ? groupEvents.map(e => `
                        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #ec4899; background: rgba(236,72,153,0.15); border-radius: 6px;">event</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">event</span><span class="text-xs text-[var(--text-muted)] italic">Sin eventos</span></div>`;

                const groupClients = clients.filter(c => String(c.group_id) === String(g.id));
                const clientRows = groupClients.length > 0 ? groupClients.map(c => `
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #10b981; background: rgba(16,185,129,0.15); border-radius: 6px;">person</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-[var(--text-muted)] italic">Sin clientes</span></div>`;

                return `
                <tr class="user-row-premium">
                    <td class="px-2 py-3 align-middle" style="width: 40px;">
                        <input type="checkbox" class="group-checkbox" data-group-id="${g.id}" style="width: 16px; height: 16px; cursor: pointer;" onchange="App.toggleGroupSelection('${g.id}')">
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #7c3aed; background: rgba(124,58,237,0.15); border-radius: 6px;">business</span>
                            <div class="flex flex-col">
                                <div class="font-bold text-sm text-[var(--text-main)]">${g.name}</div>
                                <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${g.email || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex flex-col max-w-[200px]">${clientRows}</div>
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex flex-col max-w-[200px]">${userRows}</div>
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex flex-col max-w-[200px]">${eventRows}</div>
                    </td>
                    <td class="px-2 py-3 align-middle text-left">
                        <span class="status-pill ${g.status === 'ACTIVE' ? 'status-active' : 'status-pending'}">
                            ${g.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                </tr>`;
            }).join('');
        }
    },

    // Búsqueda por voz (Web Speech API)
    _voiceRecognition: null,
    _voiceActive: false,

    toggleVoiceSearch: function(section) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ title: '⚠️ No soportado', text: 'Tu navegador no soporta búsqueda por voz. Usa Chrome o Edge.', icon: 'warning', background: '#0f172a', color: '#fff' });
            }
            return;
        }

        // Si ya está activo, detener
        if (this._voiceActive && this._voiceRecognition) {
            this._voiceRecognition.abort();
            this._voiceRecognition = null;
            this._voiceActive = false;
            const micBtn = document.getElementById(`${section}-voice-btn`);
            if (micBtn) { micBtn.style.color = '#64748b'; micBtn.textContent = 'mic'; }
            this._hideVoiceToast();
            return;
        }

        const micBtn = document.getElementById(`${section}-voice-btn`);
        this._voiceActive = true;
        let finalTranscript = '';
        let restartCount = 0;
        const maxRestarts = 5;

        const startRecognition = () => {
            if (!this._voiceActive) return;

            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.continuous = false;

            this._voiceRecognition = recognition;

            recognition.onstart = () => {
                restartCount = 0;
                if (micBtn) {
                    micBtn.style.color = '#ef4444';
                    micBtn.textContent = 'mic_off';
                }
                this._showVoiceToast('🎤 Escuchando... Habla ahora', 'listening');
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                finalTranscript += transcript;
                this._showVoiceToast(`🎤 "${transcript}"`, 'listening');
            };

            recognition.onend = () => {
                // Si no hay resultado y no excedimos reintentos, reiniciar
                if (!finalTranscript && restartCount < maxRestarts && this._voiceActive) {
                    restartCount++;
                    setTimeout(() => startRecognition(), 300);
                    return;
                }

                this._voiceActive = false;
                this._voiceRecognition = null;
                if (micBtn) {
                    micBtn.style.color = '#64748b';
                    micBtn.textContent = 'mic';
                }

                if (finalTranscript.trim()) {
                    // Limpiar: quitar punto final y puntuación extra que agrega Chrome
                    const cleanText = finalTranscript.trim().replace(/[.\s]+$/, '').toLowerCase();
                    const searchInput = document.getElementById(`${section}-search`);
                    if (searchInput) {
                        searchInput.value = cleanText;
                        this._showVoiceToast(`✅ "${cleanText}"`, 'result');
                        if (section === 'group') this.filterGroups();
                        if (section === 'user') this.filterUsers();
                        if (section === 'client') this.filterClients();
                        if (section === 'event') this.filterEvents();
                    }
                    setTimeout(() => this._hideVoiceToast(), 3000);
                } else {
                    this._showVoiceToast('🎤 No se detectó voz. Intenta de nuevo.', 'timeout');
                    setTimeout(() => this._hideVoiceToast(), 2000);
                }
            };

            recognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    this._voiceActive = false;
                    this._voiceRecognition = null;
                    if (micBtn) { micBtn.style.color = '#64748b'; micBtn.textContent = 'mic'; }
                    this._showMicPermissionHelp();
                } else if (event.error === 'no-speech') {
                    // No hace nada, onend manejará el reintento
                } else if (event.error === 'network') {
                    this._voiceActive = false;
                    this._voiceRecognition = null;
                    if (micBtn) { micBtn.style.color = '#64748b'; micBtn.textContent = 'mic'; }
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ title: '🌐 Error de red', text: 'La búsqueda por voz requiere conexión a internet.', icon: 'warning', background: '#0f172a', color: '#fff' });
                    }
                }
            };

            try {
                recognition.start();
            } catch (e) {
                console.warn('Error iniciando reconocimiento:', e);
                this._voiceActive = false;
            }
        };

        startRecognition();
    },

    // Mostrar ayuda para habilitar micrófono
    _showMicPermissionHelp: function() {
        if (typeof Swal === 'undefined') return;
        Swal.fire({
            title: '🎤 Permiso de micrófono requerido',
            html: `
                <div style="text-align: left; font-size: 13px; color: #94a3b8;">
                    <p style="margin-bottom: 12px;">El navegador bloqueó el acceso al micrófono. Para habilitarlo:</p>
                    <ol style="padding-left: 20px; line-height: 1.8;">
                        <li>Haz clic en el <b style="color: #e2e8f0;">ícono de candado 🔒</b> a la izquierda de la URL</li>
                        <li>Busca <b style="color: #e2e8f0;">"Micrófono"</b> en la lista</li>
                        <li>Cambia a <b style="color: #22c55e;">"Permitir"</b></li>
                        <li><b style="color: #e2e8f0;">Recarga la página</b> (F5)</li>
                    </ol>
                    <p style="margin-top: 12px; font-size: 11px; color: #64748b;">
                        O ve a <b style="color: #e2e8f0;">chrome://settings/content/microphone</b> y verifica que el sitio no esté bloqueado.
                    </p>
                </div>
            `,
            icon: 'warning',
            confirmButtonText: 'Entendido',
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#10b981'
        });
    },

    // Toast animado de búsqueda por voz
    _showVoiceToast: function(message, type) {
        let toast = document.getElementById('voice-toast');
        const isNew = !toast;

        if (isNew) {
            toast = document.createElement('div');
            toast.id = 'voice-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                z-index: 9999999;
                border-radius: 16px;
                padding: 14px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                max-width: 90vw;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            `;
            document.body.appendChild(toast);
        }

        const isListening = type === 'listening';
        const isResult = type === 'result';
        const isTimeout = type === 'timeout';

        toast.style.background = isResult ? 'rgba(34, 197, 94, 0.2)' : isTimeout ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        toast.style.border = `1px solid ${isResult ? 'rgba(34, 197, 94, 0.4)' : isTimeout ? 'rgba(251, 191, 36, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`;

        const wavesHTML = isListening ? `
            <div class="voice-waves" style="display: flex; align-items: center; gap: 3px; height: 24px;">
                <div class="voice-wave-bar" style="width: 3px; height: 8px; background: #ef4444; border-radius: 2px; animation: voicePulse 0.8s ease-in-out infinite;"></div>
                <div class="voice-wave-bar" style="width: 3px; height: 16px; background: #ef4444; border-radius: 2px; animation: voicePulse 0.8s ease-in-out 0.1s infinite;"></div>
                <div class="voice-wave-bar" style="width: 3px; height: 24px; background: #ef4444; border-radius: 2px; animation: voicePulse 0.8s ease-in-out 0.2s infinite;"></div>
                <div class="voice-wave-bar" style="width: 3px; height: 16px; background: #ef4444; border-radius: 2px; animation: voicePulse 0.8s ease-in-out 0.3s infinite;"></div>
                <div class="voice-wave-bar" style="width: 3px; height: 8px; background: #ef4444; border-radius: 2px; animation: voicePulse 0.8s ease-in-out 0.4s infinite;"></div>
            </div>
        ` : '';

        toast.innerHTML = `
            ${wavesHTML}
            <span style="color: #f1f5f9; font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${message}</span>
        `;

        if (isNew) {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
        }

        // Auto-ocultar resultado (2s) y timeout (1.5s)
        if (isResult) {
            setTimeout(() => this._hideVoiceToast(), 2000);
        } else if (isTimeout) {
            setTimeout(() => this._hideVoiceToast(), 1500);
        }
    },

    _hideVoiceToast: function() {
        const existing = document.getElementById('voice-toast');
        if (existing) {
            existing.style.opacity = '0';
            existing.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => existing.remove(), 400);
        }
    },

    // Seleccionar todos los clientes
    toggleSelectAllClients: function() {
        const selectAll = document.getElementById('select-all-clients');
        const checkboxes = document.querySelectorAll('.client-checkbox');
        if (selectAll.checked) {
            checkboxes.forEach(cb => cb.checked = true);
            this.state.selectedClients = Array.from(checkboxes).map(cb => cb.dataset.clientId);
        } else {
            checkboxes.forEach(cb => cb.checked = false);
            this.state.selectedClients = [];
        }
    },

    // Toggle selección individual de cliente
    toggleClientSelection: function(clientId) {
        if (!this.state.selectedClients) this.state.selectedClients = [];
        const idx = this.state.selectedClients.indexOf(clientId);
        if (idx > -1) {
            this.state.selectedClients.splice(idx, 1);
        } else {
            // Selección única: limpiar anteriores y seleccionar solo esta
            this.state.selectedClients = [clientId];
        }
        // Sincronizar checkboxes visuales
        document.querySelectorAll('.client-checkbox').forEach(cb => {
            cb.checked = this.state.selectedClients.includes(cb.dataset.clientId);
        });
    },

    // Limpiar selección de clientes
    clearClientSelection: function() {
        this.state.selectedClients = [];
        document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = false);
    },

    // Mostrar sugerencias de búsqueda para clientes
    showClientSuggestions: function() {
        const raw = document.getElementById('client-search')?.value || '';
        const term = this._normalize(raw);
        const container = document.getElementById('client-suggestions');
        if (!container) return;

        if (term.length < 2) {
            this.hideClientSuggestions();
            return;
        }

        const clients = this.state.clients || [];
        const groups = this.state.groups || [];
        const users = this.state.allUsers || [];
        const events = this.state.allEvents || [];
        const searchWords = term.split(' ').filter(w => w.length > 0);

        // Recolectar sugerencias con puntuación de relevancia
        const suggestions = [];

        // Clientes
        clients.forEach(c => {
            const cName = this._normalize(c.name);
            const cEmail = this._normalize(c.email);
            let score = 0;
            let matchType = '';

            if (cName.startsWith(term)) { score = 100; matchType = 'cliente'; }
            else if (searchWords.every(w => cName.includes(w))) { score = 80; matchType = 'cliente'; }
            else if (cEmail && searchWords.every(w => cEmail.includes(w))) { score = 60; matchType = 'email'; }

            if (score > 0) {
                const group = groups.find(g => String(g.id) === String(c.group_id));
                suggestions.push({
                    score,
                    text: c.name,
                    subtext: group ? `Cliente → ${group.name}` : 'Cliente sin empresa',
                    icon: 'person',
                    color: '#10b981',
                    type: matchType
                });
            }
        });

        // Empresas
        groups.forEach(g => {
            const gName = this._normalize(g.name);
            if (searchWords.every(w => gName.includes(w))) {
                suggestions.push({
                    score: 70,
                    text: g.name,
                    subtext: g.email || 'Empresa',
                    icon: 'corporate_fare',
                    color: '#7c3aed',
                    type: 'empresa'
                });
            }
        });

        // Staff
        users.forEach(u => {
            const uName = this._normalize(u.display_name || u.username);
            if (searchWords.every(w => uName.includes(w))) {
                suggestions.push({
                    score: 65,
                    text: u.display_name || u.username,
                    subtext: u.role || 'Staff',
                    icon: 'badge',
                    color: '#3b82f6',
                    type: 'staff'
                });
            }
        });

        // Eventos
        events.forEach(e => {
            const eName = this._normalize(e.name);
            if (searchWords.every(w => eName.includes(w))) {
                suggestions.push({
                    score: 60,
                    text: e.name,
                    subtext: e.date || e.location || 'Evento',
                    icon: 'event',
                    color: '#ec4899',
                    type: 'evento'
                });
            }
        });

        // Ordenar por score y limitar a 8
        suggestions.sort((a, b) => b.score - a.score);
        const top = suggestions.slice(0, 8);

        if (top.length === 0) {
            this.hideClientSuggestions();
            return;
        }

        container.innerHTML = top.map((s, i) => `
            <div onclick="App.selectClientSuggestion('${s.text.replace(/'/g, "\\'")}')" 
                 class="client-suggestion-item" 
                 style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); ${i === top.length - 1 ? 'border-bottom: none;' : ''}"
                 onmouseover="this.style.background='rgba(16,185,129,0.15)'" 
                 onmouseout="this.style.background='transparent'">
                <span class="material-symbols-outlined" style="font-size: 18px; color: ${s.color}; flex-shrink: 0;">${s.icon}</span>
                <div class="flex-1 min-w-0">
                    <div style="font-size: 13px; font-weight: 500; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this._highlightMatch(s.text, raw)}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${s.subtext}</div>
                </div>
            </div>
        `).join('');

        container.classList.remove('hidden');
    },

    // Ocultar sugerencias de clientes
    hideClientSuggestions: function() {
        const container = document.getElementById('client-suggestions');
        if (container) container.classList.add('hidden');
    },

    // Seleccionar sugerencia de cliente
    selectClientSuggestion: function(text) {
        const searchInput = document.getElementById('client-search');
        if (searchInput) {
            searchInput.value = text;
            this.filterClients();
        }
        this.hideClientSuggestions();
    },

    // Abrir carrusel de edición de clientes (botón directo "Edición")
    openClientEditCarousel: function() {
        const selectedClients = this.state.selectedClients || [];
        if (selectedClients.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un cliente con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        this.editSelectedClients(selectedClients);
    },

    // Carrusel de edición de clientes (5 botones)
    editSelectedClients: function(clientIds) {
        // Si hay solo 1 cliente, ir directo a edición inline
        const ids = Array.isArray(clientIds) ? clientIds : (clientIds ? [clientIds] : []);
        if (ids.length === 1) {
            this.editSingleClient(ids);
            return;
        }
        
        this._lastClientCarouselContext = 'edit';
        this._savedSelectedClients = [...ids];
        const clients = this.state.clients || [];
        const selectedClients = ids ? clients.filter(c => ids.includes(c.id)) : [];
        if (selectedClients.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un cliente', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const subtitleText = selectedClients.length === 1 ? `${selectedClients[0].name}` : `${selectedClients.length} clientes seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 5 botones -->
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <!-- Título + botón crear -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Cliente</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                    <button onclick="App.navigateToCreateClient()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <!-- Lista de clientes seleccionados -->
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${selectedClients.map(c => {
                        const statusColor = c.status === 'ACTIVE' ? '#22c55e' : '#94a3b8';
                        return `<div class="flex items-center gap-4 p-4 rounded-2xl mb-2" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style="background: rgba(16,185,129,0.2); color: #10b981;">${(c.name || 'C').charAt(0).toUpperCase()}</div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${c.name}</div>
                                <div class="text-[11px]" style="color: ${textSecondary};">${c.email || 'Sin email'} • <span style="color: ${statusColor};">${c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    // Editar un solo cliente - versión inline
    editSingleClient: function(clientIds) {
        const ids = Array.isArray(clientIds) ? clientIds : [clientIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona un solo cliente para editar', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (ids.length > 1) { Swal.fire({ title: '⚠️ Atención', text: 'Solo puedes editar un cliente a la vez', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        const clientId = ids[0];
        const client = this.state.clients?.find(c => c.id === clientId);
        if (!client) { Swal.fire({ title: '⚠️ Error', text: 'Cliente no encontrado', icon: 'error', background: '#0f172a', color: '#fff' }); return; }
        
        this._lastClientCarouselContext = 'edit';
        this._savedSelectedClients = [clientId];
        this._editingClientId = clientId;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 5 botones -->
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <!-- Título + Guardar -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Cliente</span>
                        <span class="text-xs" style="color: ${textMain};">${client.name}</span>
                    </div>
                    <button onclick="App.saveClientEditInline()" class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105" style="background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">
                        <span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar
                    </button>
                </div>
                <!-- Campos edit inline -->
                <div class="p-4 rounded-2xl" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                    <div class="space-y-5">
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nombre</label>
                            <input id="edit-client-name-${client.id}" type="text" value="${client.name || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nombre del cliente">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Email</label>
                            <input id="edit-client-email-${client.id}" type="email" value="${client.email || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Email del cliente">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Teléfono</label>
                            <input id="edit-client-phone-${client.id}" type="text" value="${client.phone || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Teléfono del cliente">
                        </div>
                    </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    // Guardar edición inline de cliente
    saveClientEditInline: async function() {
        const clientId = this._editingClientId;
        if (!clientId) return;
        
        const nameInput = document.getElementById(`edit-client-name-${clientId}`);
        const emailInput = document.getElementById(`edit-client-email-${clientId}`);
        const phoneInput = document.getElementById(`edit-client-phone-${clientId}`);
        
        if (!nameInput || !emailInput) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput?.value.trim() || '';
        
        if (!name || !email) {
            Swal.fire({ title: '⚠️ Error', text: 'Nombre y email son obligatorios', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const saveBtn = document.querySelector('[onclick="App.saveClientEditInline()"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin align-middle mr-1">sync</span> Guardando...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.pointerEvents = 'none';
        }
        
        try {
            const result = await this.fetchAPI(`/clients/${clientId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, phone })
            });
            
            if (result?.client || result?.id) {
                const clientIndex = this.state.clients?.findIndex(c => c.id === clientId);
                if (clientIndex !== -1) {
                    this.state.clients[clientIndex] = { ...this.state.clients[clientIndex], name, email, phone };
                }
                
                Swal.fire({ title: '✅ Guardado', text: 'Cliente actualizado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
                this.editSingleClient([clientId]);
            } else {
                throw new Error(result?.message || 'Error al guardar');
            }
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
        }
    },

    // Gestionar cliente (Activar/Desactivar/Eliminar)
    showManageClientAction: function(clientIds) {
        const ids = Array.isArray(clientIds) ? clientIds : [clientIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un cliente', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedClients = [...ids];
        
        const clients = this.state.clients || [];
        const selectedClients = clients.filter(c => ids.includes(c.id));
        const subtitleText = selectedClients.length === 1 ? `${selectedClients[0].name}` : `${selectedClients.length} clientes seleccionados`;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <!-- Título debajo de la barra -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Gestionar Cliente</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <div class="space-y-3">
                <div onclick="App.handleBulkClientActionDirect('activate')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(34,197,94,0.2); color: #22c55e;"><span class="material-symbols-outlined">play_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #22c55e;">Activar</div><div class="text-[11px]" style="color: ${textSecondary};">Activar ${ids.length} cliente(s)</div></div>
                </div>
                <div onclick="App.handleBulkClientActionDirect('deactivate')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">pause_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #f59e0b;">Desactivar</div><div class="text-[11px]" style="color: ${textSecondary};">Desactivar ${ids.length} cliente(s)</div></div>
                </div>
                <div onclick="App.handleBulkClientActionDirect('delete')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(239,68,68,0.2); color: #ef4444;"><span class="material-symbols-outlined">delete</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #ef4444;">Eliminar</div><div class="text-[11px]" style="color: ${textSecondary};">Eliminar ${ids.length} cliente(s)</div></div>
                </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    // Acciones masivas directas de clientes
    handleBulkClientActionDirect: async function(action) {
        const clientIds = this.state.selectedClients || [];
        if (clientIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un cliente', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (action === 'activate') {
            if (await this._confirmAction('¿Activar cliente(s)?', `¿Activar ${clientIds.length} cliente(s)?`, 'Sí, activar')) {
                await this.bulkUpdateClientStatus(clientIds, 'ACTIVE');
                this.editSelectedClients(clientIds);
            }
        } else if (action === 'deactivate') {
            if (await this._confirmAction('¿Desactivar cliente(s)?', `¿Desactivar ${clientIds.length} cliente(s)?`, 'Sí, desactivar')) {
                await this.bulkUpdateClientStatus(clientIds, 'INACTIVE');
                this.editSelectedClients(clientIds);
            }
        } else if (action === 'delete') {
            if (await this._confirmAction('¿Eliminar cliente(s)?', `¿Eliminar ${clientIds.length} cliente(s)? Esta acción no se puede deshacer.`)) {
                await this.bulkDeleteClients(clientIds);
            } else {
                this.editSelectedClients(clientIds);
            }
        }
    },

    // Actualizar estado de múltiples clientes
    bulkUpdateClientStatus: async function(clientIds, status) {
        for (const id of clientIds) {
            await this.fetchAPI(`/clients/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
        }
        await this.loadClients();
    },

    // Eliminar múltiples clientes
    bulkDeleteClients: async function(clientIds) {
        for (const id of clientIds) {
            await this.fetchAPI(`/clients/${id}`, { method: 'DELETE' });
        }
        await this.loadClients();
    },

    // Asignar empresa a clientes
    showCompanySelectorForClients: function(clientIds) {
        this._lastClientCarouselContext = 'company';
        this._savedSelectedClients = [...(clientIds || [])];
        const groups = this.state.groups || [];
        const clients = this.state.clients || [];
        const selectedClients = clientIds ? clients.filter(c => clientIds.includes(c.id)) : [];
        if (groups.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay empresas disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#7c3aed';
        const primaryLight = isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.15)';
        const subtitleText = selectedClients.length === 1 ? `${selectedClients[0].name}` : `${selectedClients.length} clientes seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Empresa a Cliente</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateGroupFromClientCarousel()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar empresa..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${groups.map(g => {
                        const isAssigned = selectedClients.some(c => String(c.group_id) === String(g.id));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignCompanyToClientsFromModal('${g.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">corporate_fare</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${g.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${g.email || 'Sin email'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignCompanyToClientsFromModal: async function(groupId, isAssigned) {
        const clientIds = this.state.selectedClients || [];
        if (clientIds.length === 0) return;
        try {
            if (isAssigned) {
                await this.fetchAPI(`/clients/unassign-from-company`, { method: 'PUT', body: JSON.stringify({ client_ids: clientIds }) });
            } else {
                await this.fetchAPI(`/clients/assign-to-company`, { method: 'PUT', body: JSON.stringify({ client_ids: clientIds, group_id: groupId }) });
            }
            await this.loadClients();
            this.showCompanySelectorForClients(clientIds);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar empresa', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    // Abrir crear empresa desde carrusel de clientes (sin cerrar carrusel)
    openCreateGroupFromClientCarousel: function() {
        this._lastClientCarouselContext = 'company';
        this._savedSelectedClients = [...(this.state.selectedClients || [])];
        this._openCompanyModalFromSelector = true;
        // NO cerrar SweetAlert - el modal HTML se abre encima y se restaurará al cerrar
        this.openCompanyModal();
    },

    // Abrir crear staff desde carrusel de clientes (sin cerrar carrusel)
    openCreateStaffFromClientCarousel: function() {
        this._lastClientCarouselContext = 'staff';
        this._savedSelectedClients = [...(this.state.selectedClients || [])];
        this._openStaffModalFromSelector = true;
        // NO cerrar SweetAlert - el modal HTML se abre encima y se restaurará al cerrar
        this.openCreateStaffModal();
    },

    // Abrir crear evento desde carrusel de clientes (sin cerrar carrusel)
    openCreateEventFromClientCarousel: function() {
        this._lastClientCarouselContext = 'event';
        this._savedSelectedClients = [...(this.state.selectedClients || [])];
        this._openEventModalFromSelector = true;
        // NO cerrar SweetAlert - el modal HTML se abre encima y se restaurará al cerrar
        this.openCreateEventModal();
    },

    // Restaurar carrusel de clientes desde modal de crear
    _restoreClientCarouselFromCreate: function() {
        if (!this._lastClientCarouselContext) return;
        const ctx = this._lastClientCarouselContext;
        this._lastClientCarouselContext = null;
        const savedClients = this._savedSelectedClients || [];
        this._savedSelectedClients = null;

        if (savedClients.length === 0) return;

        if (ctx === 'company') {
            this.showCompanySelectorForClients(savedClients);
        } else if (ctx === 'staff') {
            this.showStaffSelectorForClients(savedClients);
        } else if (ctx === 'event') {
            this.showEventSelectorForClients(savedClients);
        } else if (ctx === 'edit') {
            this.editSelectedClients(savedClients);
        }
    },

    // Asignar staff a clientes
    showStaffSelectorForClients: function(clientIds) {
        this._lastClientCarouselContext = 'staff';
        this._savedSelectedClients = [...(clientIds || [])];
        const users = this.state.allUsers || [];
        const clients = this.state.clients || [];
        const selectedClients = clientIds ? clients.filter(c => clientIds.includes(c.id)) : [];
        if (users.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay staff disponible', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#10b981';
        const primaryLight = isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)';
        const subtitleText = selectedClients.length === 1 ? `${selectedClients[0].name}` : `${selectedClients.length} clientes seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Staff a Cliente</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateStaffFromClientCarousel()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar staff..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${users.map(u => {
                        const isAssigned = selectedClients.some(c => c.staff && c.staff.some(s => String(s.id) === String(u.id)));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignStaffToClientsFromModal('${u.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">badge</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${u.display_name || u.username}</div><div class="text-[11px]" style="color: ${textSecondary};">${u.role || 'Staff'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignStaffToClientsFromModal: async function(userId, isAssigned) {
        const clientIds = this.state.selectedClients || [];
        if (clientIds.length === 0) return;
        try {
            for (const clientId of clientIds) {
                if (isAssigned) {
                    await this.fetchAPI(`/clients/${clientId}/staff/${userId}`, { method: 'DELETE' });
                } else {
                    await this.fetchAPI(`/clients/${clientId}/staff`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
                }
            }
            await this.loadClients();
            this.showStaffSelectorForClients(clientIds);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar staff', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    // Asignar evento a clientes
    showEventSelectorForClients: function(clientIds) {
        this._lastClientCarouselContext = 'event';
        this._savedSelectedClients = [...(clientIds || [])];
        const events = this.state.allEvents || [];
        const clients = this.state.clients || [];
        const selectedClients = clientIds ? clients.filter(c => clientIds.includes(c.id)) : [];
        if (events.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay eventos disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#ec4899';
        const primaryLight = isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)';
        const subtitleText = selectedClients.length === 1 ? `${selectedClients[0].name}` : `${selectedClients.length} clientes seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleClient(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageClientAction(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showStaffSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForClients(App._savedSelectedClients)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Evento a Cliente</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateEventFromClientCarousel()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar evento..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${events.map(e => {
                        const isAssigned = selectedClients.some(c => c.events && c.events.some(ev => String(ev.id) === String(e.id)));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignEventToClientsFromModal('${e.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">event</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${e.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${e.date || 'Sin fecha'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignEventToClientsFromModal: async function(eventId, isAssigned) {
        const clientIds = this.state.selectedClients || [];
        if (clientIds.length === 0) return;
        try {
            for (const clientId of clientIds) {
                if (isAssigned) {
                    await this.fetchAPI(`/clients/${clientId}/events/${eventId}`, { method: 'DELETE' });
                } else {
                    await this.fetchAPI(`/clients/${clientId}/events`, { method: 'POST', body: JSON.stringify({ event_id: eventId }) });
                }
            }
            await this.loadClients();
            this.showEventSelectorForClients(clientIds);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar evento', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    // Abrir modal para editar cliente (ya existe pero necesitamos referenciarla)
    openEditClientModal: function(client) {
        // Esta función ya existe en el código original
        // Se llama desde handleBulkClientAction cuando action === 'edit'
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
        
        Swal.fire({
            title: 'Editar Cliente',
            html: `<div class="space-y-4 text-left">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider mb-1" style="color: ${textSecondary};">Nombre *</label>
                    <input id="edit-client-name" type="text" value="${client.name || ''}" class="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider mb-1" style="color: ${textSecondary};">Email</label>
                    <input id="edit-client-email" type="email" value="${client.email || ''}" class="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider mb-1" style="color: ${textSecondary};">Teléfono</label>
                    <input id="edit-client-phone" type="text" value="${client.phone || ''}" class="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider mb-1" style="color: ${textSecondary};">Estado</label>
                    <select id="edit-client-status" class="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                        <option value="ACTIVE" ${client.status === 'ACTIVE' ? 'selected' : ''}>Activo</option>
                        <option value="INACTIVE" ${client.status === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
            </div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            background: bgMain,
            color: textMain,
            customClass: { popup: 'rounded-2xl' },
            preConfirm: async () => {
                const name = document.getElementById('edit-client-name').value.trim();
                const email = document.getElementById('edit-client-email').value.trim();
                const phone = document.getElementById('edit-client-phone').value.trim();
                const status = document.getElementById('edit-client-status').value;
                if (!name) { Swal.showValidationMessage('Nombre requerido'); return false; }
                try {
                    await this.fetchAPI(`/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ name, email, phone, status }) });
                    await this.loadClients();
                    Swal.fire('✓ Guardado', 'Cliente actualizado', 'success');
                } catch (e) { Swal.showValidationMessage('Error: ' + e.message); }
            }
        });
    },

    // Acciones masivas de clientes
    handleBulkClientAction: async function() {
        const action = document.getElementById('bulk-client-action')?.value;
        if (!action || !this.state.selectedClients?.length) return;
        
        if (action === 'delete') {
            if (!confirm(`¿Eliminar ${this.state.selectedClients.length} cliente(s)?`)) return;
            for (const id of this.state.selectedClients) {
                await this.fetchAPI(`/clients/${id}`, { method: 'DELETE' });
            }
            this.loadClients();
        } else if (action === 'activate' || action === 'deactivate') {
            const status = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
            for (const id of this.state.selectedClients) {
                await this.fetchAPI(`/clients/${id}`, { 
                    method: 'PUT',
                    body: JSON.stringify({ status })
                });
            }
            this.loadClients();
        } else if (action === 'edit') {
            // Por ahora mostrar modal de edición del primero seleccionado
            const client = this.state.clients.find(c => c.id === this.state.selectedClients[0]);
            if (client) this.openEditClientModal(client);
        }
        
        document.getElementById('bulk-client-action').value = '';
    },

    // Abrir modal para crear cliente
    navigateToCreateClient: function() {
        this.openCreateClientModal();
    },

    // Modal crear cliente
    // Abrir modal para crear cliente (diseño igual al de empresa)
    openCreateClientModal: function() {
        // If coming from user carousel, save context
        if (this._lastUserCarouselContext) {
            this._savedSelectedUsers = [...(this.state.selectedUsers || [])];
        }
        this._lastCarouselContext = 'client';
        const groups = this.state.groups || [];
        const select = document.getElementById('create-client-company');
        if (select) {
            select.innerHTML = '<option value="">Sin empresa</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        }
        document.getElementById('create-client-name').value = '';
        document.getElementById('create-client-email').value = '';
        document.getElementById('create-client-phone').value = '';
        const modal = document.getElementById('modal-create-client');
        if (modal) modal.classList.remove('hidden');
    },

    // Abrir modal para crear staff (diseño igual al de empresa)
    openCreateStaffModal: function() {
        // If coming from user carousel, save context
        if (this._lastUserCarouselContext) {
            this._savedSelectedUsers = [...(this.state.selectedUsers || [])];
        }
        this._lastCarouselContext = 'staff';
        const groups = this.state.groups || [];
        const select = document.getElementById('create-staff-company');
        if (select) {
            select.innerHTML = '<option value="">Sin empresa</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        }
        document.getElementById('create-staff-name').value = '';
        document.getElementById('create-staff-email').value = '';
        document.getElementById('create-staff-password').value = '';
        document.getElementById('create-staff-role').value = 'STAFF';
        const modal = document.getElementById('modal-create-staff');
        if (modal) modal.classList.remove('hidden');
    },

    // Abrir modal para crear evento (diseño igual al de empresa)
    openCreateEventModal: function() {
        // If coming from user carousel, save context
        if (this._lastUserCarouselContext) {
            this._savedSelectedUsers = [...(this.state.selectedUsers || [])];
        }
        this._lastCarouselContext = 'event';
        document.getElementById('create-event-name').value = '';
        document.getElementById('create-event-date').value = '';
        document.getElementById('create-event-location').value = '';
        document.getElementById('create-event-description').value = '';
        const modal = document.getElementById('modal-create-event');
        if (modal) modal.classList.remove('hidden');
    },

    // Cerrar modales de creación y restaurar carrusel
    closeCreateClientModal: function() {
        document.getElementById('modal-create-client')?.classList.add('hidden');
        this._restoreCarouselContext();
        this._restoreUserCarouselContext();
    },
    closeCreateStaffModal: function() {
        document.getElementById('modal-create-staff')?.classList.add('hidden');
        this._restoreCarouselContext();
        this._restoreUserCarouselContext();
    },
    closeCreateEventModal: function() {
        document.getElementById('modal-create-event')?.classList.add('hidden');
        this._restoreCarouselContext();
        this._restoreUserCarouselContext();
    },

    // Restaurar el carrusel que estaba abierto antes de crear
    _restoreCarouselContext: function() {
        if (!this._lastCarouselContext) return;
        const ctx = this._lastCarouselContext;
        this._lastCarouselContext = null;
        const savedGroups = this._savedSelectedGroups || [];
        this._savedSelectedGroups = null;

        if (savedGroups.length === 0) return;

        if (ctx === 'client') {
            this.openAssignClientToGroupModal(savedGroups);
        } else if (ctx === 'staff') {
            this.showUserSelectorForBulkGroups(savedGroups);
        } else if (ctx === 'event') {
            this.showEventSelectorForBulkGroups(savedGroups);
        }
    },

    // Restaurar carrusel de staff al cerrar modal de crear
    _restoreUserCarouselContext: function() {
        if (!this._lastUserCarouselContext) return;
        const ctx = this._lastUserCarouselContext;
        this._lastUserCarouselContext = null;
        const savedUsers = this._savedSelectedUsers || [];
        this._savedSelectedUsers = null;

        if (savedUsers.length === 0) return;

        if (ctx === 'company') {
            this.showCompanySelectorForUsers(savedUsers);
        } else if (ctx === 'client') {
            this.showClientSelectorForUsers(savedUsers);
        } else if (ctx === 'event') {
            this.showEventSelectorForUsers(savedUsers);
        } else if (ctx === 'role') {
            this.showRoleSelectorForUsers(savedUsers);
        } else if (ctx === 'edit') {
            this.editSelectedUsers(savedUsers);
        }
    },

    // Modal asignar eventos a cliente
    openAssignEventToClientModal: function() {
        if (!this.state.selectedClients?.length) {
            Swal.fire('Selecciona clientes', 'Selecciona al menos un cliente para asignar eventos', 'warning');
            return;
        }
        
        const events = this.state.allEvents || [];
        const eventOptions = events.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        
        Swal.fire({
            title: 'Asignar Eventos a Clientes',
            html: `
                <div class="space-y-4 text-left">
                    <p class="text-sm text-[var(--text-secondary)]">Clientes seleccionados: ${this.state.selectedClients.length}</p>
                    <div>
                        <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Eventos *</label>
                        <select id="assign-events-select" class="swal2-input" multiple size="6" style="height: auto;">
                            ${eventOptions}
                        </select>
                        <small class="text-[var(--text-muted)]">Mantén Ctrl/Cmd presionado para seleccionar varios</small>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Asignar',
            cancelButtonText: 'Cancelar',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            customClass: { popup: 'rounded-2xl' },
            preConfirm: async () => {
                const select = document.getElementById('assign-events-select');
                const selectedEvents = Array.from(select.selectedOptions).map(o => o.value);
                
                if (selectedEvents.length === 0) {
                    Swal.showValidationMessage('Selecciona al menos un evento');
                    return false;
                }
                
                try {
                    for (const clientId of this.state.selectedClients) {
                        await this.fetchAPI(`/clients/${clientId}/events`, {
                            method: 'PUT',
                            body: JSON.stringify({ events: selectedEvents })
                        });
                    }
                    this.loadClients();
                    Swal.fire('Éxito', 'Eventos asignados correctamente', 'success');
                    return true;
                } catch (e) {
                    Swal.showValidationMessage(e.message || 'Error al asignar eventos');
                    return false;
                }
            }
        });
    },

    // Modal asignar staff a cliente
    openAssignStaffToClientModal: function() {
        if (!this.state.selectedClients?.length) {
            Swal.fire('Selecciona clientes', 'Selecciona al menos un cliente para asignar staff', 'warning');
            return;
        }
        
        const users = this.state.allUsers || [];
        const userOptions = users.map(u => `<option value="${u.id}">${u.display_name || u.username} (${u.role})</option>`).join('');
        
        Swal.fire({
            title: 'Asignar Staff a Clientes',
            html: `
                <div class="space-y-4 text-left">
                    <p class="text-sm text-[var(--text-secondary)]">Clientes seleccionados: ${this.state.selectedClients.length}</p>
                    <div>
                        <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Staff *</label>
                        <select id="assign-staff-select" class="swal2-input" multiple size="6" style="height: auto;">
                            ${userOptions}
                        </select>
                        <small class="text-[var(--text-muted)]">Mantén Ctrl/Cmd presionado para seleccionar varios</small>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Asignar',
            cancelButtonText: 'Cancelar',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            customClass: { popup: 'rounded-2xl' },
            preConfirm: async () => {
                const select = document.getElementById('assign-staff-select');
                const selectedUsers = Array.from(select.selectedOptions).map(o => o.value);
                
                if (selectedUsers.length === 0) {
                    Swal.showValidationMessage('Selecciona al menos un miembro de staff');
                    return false;
                }
                
                try {
                    for (const clientId of this.state.selectedClients) {
                        await this.fetchAPI(`/clients/${clientId}/staff`, {
                            method: 'PUT',
                            body: JSON.stringify({ users: selectedUsers })
                        });
                    }
                    this.loadClients();
                    Swal.fire('Éxito', 'Staff asignado correctamente', 'success');
                    return true;
                } catch (e) {
                    Swal.showValidationMessage(e.message || 'Error al asignar staff');
                    return false;
                }
            }
        });
    },

    // Poblar filtros de empresas
    populateGroupFilters: function() {
        const eventSelect = document.getElementById('filter-group-event');
        const userSelect = document.getElementById('filter-group-user');
        const clientSelect = document.getElementById('filter-group-client');
        
        if (eventSelect && this.state.allEvents) {
            const currentVal = eventSelect.value;
            eventSelect.innerHTML = '<option value="">Eventos</option>';
            this.state.allEvents.forEach(e => {
                eventSelect.innerHTML += `<option value="${e.id}">${e.name}</option>`;
            });
            eventSelect.value = currentVal;
        }
        
        if (userSelect && this.state.allUsers) {
            const currentVal = userSelect.value;
            userSelect.innerHTML = '<option value="">Staff</option>';
            this.state.allUsers.forEach(u => {
                userSelect.innerHTML += `<option value="${u.id}">${u.display_name || u.username}</option>`;
            });
            userSelect.value = currentVal;
        }
        
        if (clientSelect && this.state.clients) {
            const currentVal = clientSelect.value;
            clientSelect.innerHTML = '<option value="">Clientes</option>';
            this.state.clients.forEach(c => {
                clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
            clientSelect.value = currentVal;
        }
    },

    // Modal asignar cliente a empresa
    openAssignClientToGroupModal: function(groupIds) {
        const clients = this.state.clients || [];
        
        // Usar el parámetro groupIds si viene, si no usar selectedGroups
        if (!groupIds || groupIds.length === 0) {
            groupIds = this.state.selectedGroups || [];
        }
        
        if (clients.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'No hay clientes disponibles', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Detectar tema actual
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#10b981';
        const primaryLight = isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)';
        
        // Obtener empresas seleccionadas
        const selectedGroups = this.state.groups?.filter(g => groupIds.includes(g.id)) || [];
        
        // Calcular cuántas empresas tienen cada cliente asignado
        const getGroupClientCount = (groupId) => {
            return clients.filter(c => String(c.group_id) === String(groupId)).length;
        };
        
        // Construir texto del título
        let subtitleText = '';
        if (selectedGroups.length === 1) {
            const group = selectedGroups[0];
            const clientCount = getGroupClientCount(group.id);
            subtitleText = `${group.name} - ${clientCount} Clientes`;
        } else {
            subtitleText = `${selectedGroups.length} empresas seleccionadas`;
        }
        
        const getCurrentGroupIds = `App.state.selectedGroups.length > 0 ? App.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId)`;
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSelectedGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="App.showManageGroupAction(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar">
                        <span class="material-symbols-outlined text-sm">settings</span>
                    </button>
                    <button onclick="App.openAssignClientToGroupModal(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente">
                        <span class="material-symbols-outlined text-sm">person</span>
                    </button>
                    <button onclick="App.showUserSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Staff">
                        <span class="material-symbols-outlined text-sm">badge</span>
                    </button>
                    <button onclick="App.showEventSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento">
                        <span class="material-symbols-outlined text-sm">event</span>
                    </button>
                </div>

                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Cliente a Empresa${selectedGroups.length > 1 ? 's' : ''}</span>
                        <span class="text-xs" style="color: ${textMain};">${selectedGroups.length === 1 ? selectedGroups[0].name : selectedGroups.length + ' empresas seleccionadas'}</span>
                    </div>
                    <button onclick="App.openCreateClientModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">add</span> Crear
                    </button>
                </div>

                <div class="relative group mt-6 mb-6">
                    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span>
                    <input type="text" placeholder="Buscar cliente..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;">
                </div>

                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${clients.map(c => {
                        const isAssigned = groupIds.some(gid => String(c.group_id) === String(gid));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignClientToGroupsFromModal('${groupIds.join(',')}', '${c.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">person</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${c.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${c.email || 'Sin email'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0,
            didClose: () => { this.clearGroupSelection(); }
        });
    },

    assignClientToGroupsFromModal: async function(groupIdsStr, clientId, isAssigned) {
        const groupIds = groupIdsStr.split(',').filter(id => id && id.trim() !== '');
        if (groupIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        try {
            if (isAssigned) {
                await this.fetchAPI('/clients/unassign-from-company', {
                    method: 'PUT',
                    body: JSON.stringify({ client_ids: [clientId] })
                });
            } else {
                await this.fetchAPI('/clients/assign-to-company', {
                    method: 'PUT',
                    body: JSON.stringify({ client_ids: [clientId], group_id: groupIds[0] })
                });
            }
            await this.loadGroups();
            await this.loadUsersTable();
            this.loadClients();
            this.openAssignClientToGroupModal(this.state.selectedGroups);
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al asignar cliente', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    // Abrir carrusel de edición de empresas (botón directo "Edición")
    openGroupEditCarousel: function() {
        const selectedGroups = this.state.selectedGroups || [];
        if (selectedGroups.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        // Abrir el carrusel de edición directamente
        this.editSelectedGroups(selectedGroups);
    },

    // Modal editar empresa (con campos inline, sin segundo modal)
    editSelectedGroups: function(groupIds) {
        const groups = this.state.groups || [];
        const selectedGroups = groupIds ? groups.filter(g => groupIds.includes(g.id)) : [];
        if (selectedGroups.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
        const getCurrentGroupIds = `App.state.selectedGroups.length > 0 ? App.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId)`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSelectedGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="App.showManageGroupAction(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar">
                        <span class="material-symbols-outlined text-sm">settings</span>
                    </button>
                    <button onclick="App.openAssignClientToGroupModal(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente">
                        <span class="material-symbols-outlined text-sm">person</span>
                    </button>
                    <button onclick="App.showUserSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Staff">
                        <span class="material-symbols-outlined text-sm">badge</span>
                    </button>
                    <button onclick="App.showEventSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento">
                        <span class="material-symbols-outlined text-sm">event</span>
                    </button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Empresa${selectedGroups.length > 1 ? 's' : ''}</span>
                        <span class="text-xs" style="color: ${textMain};">${selectedGroups.length === 1 ? selectedGroups[0].name : selectedGroups.length + ' empresas seleccionadas'}</span>
                        <span id="group-edit-msg" class="hidden text-xs font-bold mt-1"></span>
                    </div>
                    <button onclick="App.saveGroupEditInline()" class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105" style="background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">
                        <span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar
                    </button>
                </div>
                <div class="max-h-96 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${selectedGroups.map(g => `
                        <div class="p-4 rounded-2xl mb-3" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">corporate_fare</span></div>
                                <div class="flex-1">
                                    <div class="text-sm font-bold" style="color: ${textMain};">${g.name}</div>
                                    <div class="text-[11px]" style="color: ${textSecondary};">${g.email || 'Sin email'} • ${g.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</div>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nombre</label>
                                    <input id="edit-group-name-${g.id}" type="text" value="${g.name}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nombre de la empresa">
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Email</label>
                                    <input id="edit-group-email-${g.id}" type="email" value="${g.email || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Email de contacto">
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Descripción</label>
                                    <textarea id="edit-group-desc-${g.id}" rows="2" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all resize-none" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Descripción (opcional)">${g.description || ''}</textarea>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0,
            didClose: () => { this.clearGroupSelection(); }
        });
    },

    // Guardar edición de empresa inline (sin cerrar modal)
    saveGroupEditInline: async function() {
        const inputs = document.querySelectorAll('[id^="edit-group-name-"]');
        if (!inputs.length) return;

        // Declarar originalHTML fuera del if para que sea accesible en catch
        let originalHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';

        // Mostrar indicador de carga inline
        const saveBtn = document.querySelector('[onclick="App.saveGroupEditInline()"]');
        if (saveBtn) {
            originalHTML = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin align-middle mr-1">sync</span> Guardando...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.pointerEvents = 'none';
        }

        try {
            for (const input of inputs) {
                const id = input.id.replace('edit-group-name-', '');
                const name = input.value.trim();
                const email = document.getElementById(`edit-group-email-${id}`)?.value.trim() || '';
                const description = document.getElementById(`edit-group-desc-${id}`)?.value.trim() || '';
                if (!name) {
                    // Restaurar botón y mostrar error inline
                    if (saveBtn) { saveBtn.innerHTML = originalHTML; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }
                    const msgEl = document.getElementById('group-edit-msg');
                    if (msgEl) { msgEl.textContent = '⚠️ El nombre es requerido'; msgEl.style.color = '#f59e0b'; msgEl.classList.remove('hidden'); setTimeout(() => { msgEl.classList.add('hidden'); }, 3000); }
                    return;
                }
                await this.fetchAPI(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name, email, description }) });
            }
            await this.loadGroups();

            // Mostrar mensaje de éxito inline (sin cerrar modal)
            const msgEl = document.getElementById('group-edit-msg');
            if (msgEl) { msgEl.textContent = '✓ Guardado correctamente'; msgEl.style.color = '#22c55e'; msgEl.classList.remove('hidden'); setTimeout(() => { msgEl.classList.add('hidden'); }, 2000); }

            // Restaurar botón
            if (saveBtn) { saveBtn.innerHTML = originalHTML; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }
        } catch (e) {
            const msgEl = document.getElementById('group-edit-msg');
            if (msgEl) { msgEl.textContent = '⚠️ Error: ' + e.message; msgEl.style.color = '#ef4444'; msgEl.classList.remove('hidden'); setTimeout(() => { msgEl.classList.add('hidden'); }, 3000); }
            if (saveBtn) { saveBtn.innerHTML = originalHTML; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }
        }
    },

    openEditSingleGroupModal: function(groupId) {
        const group = this.state.groups?.find(g => g.id === groupId);
        if (!group) return;
        Swal.fire({
            title: 'Editar Empresa',
            html: `<div class="space-y-4 text-left">
                <div><label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nombre *</label><input id="edit-group-name" type="text" class="swal2-input" value="${group.name}" required></div>
                <div><label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Email</label><input id="edit-group-email" type="email" class="swal2-input" value="${group.email || ''}"></div>
                <div><label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Descripción</label><textarea id="edit-group-desc" class="swal2-input" rows="3">${group.description || ''}</textarea></div>
            </div>`,
            showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', background: 'var(--bg-card)', color: 'var(--text-main)', customClass: { popup: 'rounded-2xl' },
            preConfirm: async () => {
                const name = document.getElementById('edit-group-name').value.trim();
                const email = document.getElementById('edit-group-email').value.trim();
                const description = document.getElementById('edit-group-desc').value.trim();
                if (!name) { Swal.showValidationMessage('Nombre requerido'); return false; }
                try {
                    await this.fetchAPI(`/groups/${groupId}`, { method: 'PUT', body: JSON.stringify({ name, email, description }) });
                    this.loadGroups();
                    Swal.fire('✓ Guardado', 'Empresa actualizada', 'success');
                } catch (e) { Swal.showValidationMessage('Error: ' + e.message); }
            }
        });
    },

    // Modal gestionar empresa
    showManageGroupAction: function(groupIds) {
        const groups = this.state.groups || [];
        const selectedGroups = groupIds ? groups.filter(g => groupIds.includes(g.id)) : [];
        if (selectedGroups.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const getCurrentGroupIds = `App.state.selectedGroups.length > 0 ? App.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId)`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="App.editSelectedGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="App.showManageGroupAction(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar">
                        <span class="material-symbols-outlined text-sm">settings</span>
                    </button>
                    <button onclick="App.openAssignClientToGroupModal(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente">
                        <span class="material-symbols-outlined text-sm">person</span>
                    </button>
                    <button onclick="App.showUserSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Staff">
                        <span class="material-symbols-outlined text-sm">badge</span>
                    </button>
                    <button onclick="App.showEventSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento">
                        <span class="material-symbols-outlined text-sm">event</span>
                    </button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Gestionar Empresa${selectedGroups.length > 1 ? 's' : ''}</span>
                        <span class="text-xs" style="color: ${textMain};">${selectedGroups.length === 1 ? selectedGroups[0].name : selectedGroups.length + ' empresas seleccionadas'}</span>
                    </div>
                </div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    <div onclick="App.handleBulkGroupActionDirect('activate')" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: rgba(34,197,94,0.2); color: #22c55e;"><span class="material-symbols-outlined">play_circle</span></div>
                        <div class="flex-1"><div class="text-sm font-bold" style="color: #22c55e;">Activar</div><div class="text-[11px]" style="color: ${textSecondary};">Activar ${selectedGroups.length} empresa(s)</div></div>
                    </div>
                    <div onclick="App.handleBulkGroupActionDirect('deactivate')" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">pause_circle</span></div>
                        <div class="flex-1"><div class="text-sm font-bold" style="color: #f59e0b;">Desactivar</div><div class="text-[11px]" style="color: ${textSecondary};">Desactivar ${selectedGroups.length} empresa(s)</div></div>
                    </div>
                    <div onclick="App.handleBulkGroupActionDirect('delete')" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: rgba(239,68,68,0.2); color: #ef4444;"><span class="material-symbols-outlined">delete</span></div>
                        <div class="flex-1"><div class="text-sm font-bold" style="color: #ef4444;">Eliminar</div><div class="text-[11px]" style="color: ${textSecondary};">Eliminar ${selectedGroups.length} empresa(s)</div></div>
                    </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0,
            didClose: () => { this.clearGroupSelection(); }
        });
    },

    handleBulkGroupActionDirect: async function(action) {
        const groupIds = this.state.selectedGroups.length > 0 ? this.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId);
        if (!groupIds || groupIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (action === 'delete') {
            if (!confirm(`¿Eliminar ${groupIds.length} empresa(s)?`)) return;
            for (const id of groupIds) { await this.fetchAPI(`/groups/${id}`, { method: 'DELETE' }); }
            await this.loadGroups();
        } else if (action === 'activate' || action === 'deactivate') {
            const status = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
            for (const id of groupIds) { await this.fetchAPI(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); }
            await this.loadGroups();
        }
        this.showManageGroupAction(this.state.selectedGroups);
    },

    handleBulkGroupAction: async function() {
        const action = document.getElementById('bulk-group-action')?.value;
        if (!action) return;
        if (!this.state.selectedGroups) this.state.selectedGroups = [];
        const groupIds = this.state.selectedGroups.length > 0 ? this.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId);
        if (action === 'edit') { this.editSelectedGroups(groupIds); }
        else if (action === 'assign-client') { if (!groupIds?.length) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); } else { this.openAssignClientToGroupModal(groupIds); } }
        else if (action === 'assign-staff') { if (!groupIds?.length) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); } else { this.showUserSelectorForBulkGroups(groupIds); } }
        else if (action === 'assign-event') { if (!groupIds?.length) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); } else { this.showEventSelectorForBulkGroups(groupIds); } }
        else if (action === 'activate' || action === 'deactivate') { if (groupIds?.length) { this.handleBulkGroupActionDirect(action); } }
        else if (action === 'delete') { if (groupIds?.length) { this.handleBulkGroupActionDirect('delete'); } }
        document.getElementById('bulk-group-action').value = '';
    },

    // Mostrar selector de eventos para empresas
    showEventSelectorForBulkGroups: function(groupIds) {
        const events = this.state.allEvents || [];
        const groups = this.state.groups || [];
        const selectedGroups = groupIds ? groups.filter(g => groupIds.includes(g.id)) : [];
        if (events.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay eventos disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#ec4899';
        const primaryLight = isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)';
        const subtitleText = selectedGroups.length === 1 ? `${selectedGroups[0].name}` : `${selectedGroups.length} empresas seleccionadas`;
        const getCurrentGroupIds = `App.state.selectedGroups.length > 0 ? App.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId)`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSelectedGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageGroupAction(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.openAssignClientToGroupModal(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showUserSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Evento a Empresas</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateEventModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar evento..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${events.map(e => {
                        const isAssigned = groupIds.some(gid => String(e.group_id) === String(gid));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignEventToGroupsFromModal('${groupIds.join(',')}', '${e.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">event</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${e.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${e.date || 'Sin fecha'} ${e.location ? '• ' + e.location : ''}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0,
            didClose: () => { this.clearGroupSelection(); }
        });
    },

    assignEventToGroupsFromModal: async function(groupIdsStr, eventId, isAssigned) {
        const groupIds = groupIdsStr.split(',').filter(id => id && id.trim() !== '');
        if (groupIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        try {
            if (isAssigned) {
                await this.fetchAPI(`/events/${eventId}`, { method: 'PUT', body: JSON.stringify({ group_id: null }) });
            } else {
                await this.fetchAPI(`/events/${eventId}`, { method: 'PUT', body: JSON.stringify({ group_id: groupIds[0] }) });
            }
            await this.loadGroups();
            await this.loadUsersTable();
            this.showEventSelectorForBulkGroups(this.state.selectedGroups);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar evento', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    // Modal crear staff
    openCreateUserModal: function() {
        this.openCreateStaffModal();
    },

    // Mostrar selector de staff para empresas
    showUserSelectorForBulkGroups: function(groupIds) {
        const users = this.state.allUsers || [];
        const groups = this.state.groups || [];
        const selectedGroups = groupIds ? groups.filter(g => groupIds.includes(g.id)) : [];
        if (users.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay staff disponible', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#3b82f6';
        const primaryLight = isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)';
        const subtitleText = selectedGroups.length === 1 ? `${selectedGroups[0].name}` : `${selectedGroups.length} empresas seleccionadas`;
        const getCurrentGroupIds = `App.state.selectedGroups.length > 0 ? App.state.selectedGroups : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId)`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSelectedGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageGroupAction(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.openAssignClientToGroupModal(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showUserSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Staff"><span class="material-symbols-outlined text-sm">badge</span></button>
                    <button onclick="App.showEventSelectorForBulkGroups(${getCurrentGroupIds})" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Staff a Empresas</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateUserModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar staff..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${users.map(u => {
                        const isAssigned = u.groups && u.groups.some(g => groupIds.includes(g.id));
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignUserToGroupsFromModal('${groupIds.join(',')}', '${u.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};">${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}</div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${u.display_name || u.username}</div><div class="text-[11px]" style="color: ${textSecondary};">${u.role || 'STAFF'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0,
            didClose: () => { this.clearGroupSelection(); }
        });
    },

    assignUserToGroupsFromModal: async function(groupIdsStr, userId, isAssigned) {
        const groupIds = groupIdsStr.split(',').filter(id => id && id.trim() !== '');
        if (groupIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        try {
            if (isAssigned) {
                for (const groupId of groupIds) { await this.fetchAPI(`/groups/${groupId}/users/${userId}`, { method: 'DELETE' }); }
            } else {
                for (const groupId of groupIds) { await this.fetchAPI(`/groups/${groupId}/users`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }); }
            }
            await this.loadGroups();
            await this.loadUsersTable();
            this.showUserSelectorForBulkGroups(this.state.selectedGroups);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar staff', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    async removeUserFromGroup(userId, groupId) {
        // Solo ADMIN puede desvincular usuarios de empresas
        if (this.state.user?.role !== 'ADMIN') {
            alert('Solo el Administrador puede desvincular usuarios de empresas.');
            return;
        }
        
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

    // --- PERFIL Y CONFIGURACIÓN RESTAURADA ---

    async toggleEventToUser(userId, eventId, isSelected) {
        try {
            const user = (this.state.allUsers || []).find(u => String(u.id) === String(userId));
            let currentEvents = user ? (user.events || []) : [];
            currentEvents = currentEvents.map(String);
            let newEvents = isSelected ? currentEvents.filter(id => id !== String(eventId)) : [...currentEvents, String(eventId)];

            const res = await this.fetchAPI(`/users/${userId}/events`, {
                method: 'PUT', body: JSON.stringify({ events: newEvents })
            });

            if (res.success) {
                if (user) user.events = newEvents;
                this.showEventSelector(userId, newEvents);
                await this.refreshAllTables();
            }
        } catch(e) { console.error(e); }
    },

    async showEventSelector(userId, selectedEventIds = []) {
        let events = [];
        try { events = await this.fetchAPI('/events'); } catch(e) { console.error(e); }

        const html = `
            <div class="space-y-6 text-left">
                <div class="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vincular a Evento</span>
                        <span class="text-xs text-slate-400">Selecciona el evento para este colaborador</span>
                    </div>
                    <button onclick="App.navigateToCreateEvent()" class="btn-primary !py-2 !px-4 !text-xs">
                        + NUEVO EVENTO
                    </button>
                </div>
                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${events.map(e => `
                        <div onclick="App.toggleEventToUser('${userId}', '${e.id}', ${selectedEventIds.includes(String(e.id))})" class="selector-item flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all cursor-pointer group shadow-sm ${selectedEventIds.includes(String(e.id)) ? 'ring-1 ring-orange-500/50 bg-orange-500/10' : ''}">
                            <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 text-sm font-bold group-hover:scale-105 transition-transform">
                                <span class="material-symbols-outlined">event</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold text-white transition-colors">${e.name}</div>
                                <div class="text-[10px] text-slate-500 uppercase tracking-tighter">${e.location || 'Ubicación remota'}</div>
                            </div>
                            <div class="w-6 h-6 rounded-lg border-2 border-white/10 flex items-center justify-center transition-colors">
                                <span class="material-symbols-outlined text-xs text-orange-500 ${selectedEventIds.includes(String(e.id)) ? 'opacity-100' : 'opacity-0'}">check</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        Swal.fire({
            html, width: '450px', background: 'var(--bg-card)', color: 'var(--text-main)',
            showConfirmButton: false, showCloseButton: true,
            customClass: { popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl' }
        });
    },

    // --- PERFIL Y CONFIGURACIÓN RESTAURADA (funciones duplicadas eliminadas - ver línea ~1195) ---

    // --- FUNCIONES DE SELECCIÓN REUBICADAS Y MODERNIZADAS (V12.16.0) ---

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
                await this.fetchAPI('/settings/purge', { method: 'POST' });
                this._notifyAction('Base de Datos Limpia', 'Se han borrado todos los datos.', 'success');
                location.reload();
            } catch (e) {
                this._notifyAction('Error', 'Falla en la purga: ' + e.message, 'error');
            }
        }
    },

    // --- FUNCIÓN GLOBAL PARA OCULTAR MODALES (Accessibility) ---
    hideModal(id) {
        const m = document.getElementById(id);
        if (m) {
            // Quitar foco de todos los elementos interactivos antes de cerrar
            const focusableElements = m.querySelectorAll('input, button, select, textarea, a[href]');
            focusableElements?.forEach(el => {
                el.blur();
                el.setAttribute('tabindex', '-1');
            });
            // Quitar foco del body
            document.body.focus();
            // Ocultar modal - clase hidden Y limpiar style display
            m.classList.add('hidden');
            m.style.display = '';
            m.removeAttribute('aria-hidden');
        }
    },
    
    // --- FUNCIONES GLOBALES DEFINIDAS AL INICIO ---
    loadUsersTable: async function() {
        if (!this.state.user || !['ADMIN', 'PRODUCTOR'].includes(this.state.user.role)) return;
        try {
            const [usersRes, groupsRes, eventsRes] = await Promise.all([
                this.fetchAPI('/users'),
                this.fetchAPI('/groups'),
                this.fetchAPI('/events')
            ]);
            
            // Verificar que las respuestas sean arrays válidos
            const users = Array.isArray(usersRes) ? usersRes : (usersRes.data || []);
            const groups = Array.isArray(groupsRes) ? groupsRes : (groupsRes.data || []);
            const events = Array.isArray(eventsRes) ? eventsRes : (eventsRes.data || []);
            
            // Guardar datos para filtros
            this.state.allUsers = users;
            this.state.allEvents = events;
            this.state.allGroups = groups;
            this.state.groups = groups;
            this.renderUsersTable(users, groups, events);
        } catch (error) {
            console.error('Error loading users table:', error);
        }
    },

    // Actualizar TODAS las tablas después de cualquier cambio en modales
    refreshAllTables: async function() {
        console.log('===== refreshAllTables LLAMADA =====');
        try {
            // Cargar todos los datos en paralelo
            const [usersRes, groupsRes, eventsRes, clientsRes] = await Promise.all([
                this.fetchAPI('/users'),
                this.fetchAPI('/groups'),
                this.fetchAPI('/events'),
                this.fetchAPI('/clients')
            ]);
            
            const users = Array.isArray(usersRes) ? usersRes : (usersRes.data || []);
            const groups = Array.isArray(groupsRes) ? groupsRes : (groupsRes.data || []);
            const events = Array.isArray(eventsRes) ? eventsRes : (eventsRes.data || []);
            const clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes.data || []);
            
            // Actualizar estado global
            this.state.allUsers = users;
            this.state.allGroups = groups;
            this.state.allEvents = events;
            this.state.clients = clients;
            
            // Siempre actualizar todas las tablas relevantes (sin verificar si están visibles)
            const currentView = this.state.currentView;
            console.log('[REFRESH] currentView:', currentView);
            
            if (currentView === 'system') {
                // Siempre actualizar todas las tablas
                this.loadUsersTable();
                this.loadGroups();
                this.loadClients();
            } else if (currentView === 'my-events' || currentView === 'event-config') {
                this.loadEvents();
            }
            
            console.log('[REFRESH] Tablas actualizadas');
        } catch (error) {
            console.error('Error refreshAllTables:', error);
        }
    },

    renderUsersTable: function(users, groups, events) {
        if (!this.state.user) return;
        
        const filterGroup = document.getElementById('filter-user-group');
        const filterClient = document.getElementById('filter-user-client');
        const filterEvent = document.getElementById('filter-user-event');
        
        if (filterGroup && groups.length > 0) {
            const currentVal = filterGroup.value;
            filterGroup.innerHTML = '<option value="">Empresas</option>' + 
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            filterGroup.value = currentVal;
        }
        
        if (filterClient) {
            const clients = this.state.clients || [];
            const currentVal = filterClient.value;
            filterClient.innerHTML = '<option value="">Clientes</option>' + 
                clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            filterClient.value = currentVal;
        }
        
        if (filterEvent && events.length > 0) {
            const currentVal = filterEvent.value;
            filterEvent.innerHTML = '<option value="">Eventos</option>' + 
                events.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
            filterEvent.value = currentVal;
        }
        
        // FILTRO: PRODUCTOR no ve usuarios ADMIN
        const isAdmin = this.state.user.role === 'ADMIN';
        const isProductor = this.state.user.role === 'PRODUCTOR';
        
        if (isProductor) {
            // PRODUCTOR no ve usuarios ADMIN
            users = users.filter(u => u.role !== 'ADMIN');
        }
        
        // Obtener eventos y grupos del usuario actual
        const userGroupId = this.state.user.group_id;
        const userEvents = this.state.allEvents?.filter(e => e.user_id === this.state.user.userId) || [];
        const userGroupIds = this.state.allGroups?.filter(g => {
            // Usuarios pertenece a este grupo
            return groups.some(ug => ug.user_id === this.state.user.userId && ug.group_id === g.id);
        })?.map(g => g.id) || [];
        
        // PRODUCTOR solo ve usuarios de su empresa
        if (isProductor && userGroupId) {
            users = users.filter(u => {
                const userGroups = u.groups || [];
                return userGroups.some(ug => ug.id === userGroupId);
            });
        }
        
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
                        <button data-action="approveUser" data-user-id="${u.id}" data-status="APPROVED" class="action-btn-pill btn-success-soft">
                            <span class="material-symbols-outlined">check_circle</span>
                            APROBAR ACCESO
                        </button>
                    </div>
                </div>`).join('');
        }
        
        const tbody = document.getElementById('users-tbody');
        
        if (tbody) {
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-20 text-center text-[var(--text-muted)] font-bold uppercase tracking-widest opacity-50">No se encontraron colaboradores</td></tr>';
                return;
            }

            tbody.innerHTML = users.map((u) => {
                const isSelf = u.id === this.state.user?.userId;
                const canEdit = isAdmin || (isProductor && u.role !== 'ADMIN');
                const canRemoveGroup = isAdmin;
                const canRemoveEvent = isAdmin || (isProductor && u.role !== 'ADMIN');
                
                // --- CHECKBOX DE SELECCIÓN ---
                const checkbox = `<input type="checkbox" class="user-checkbox" data-user-id="${u.id}" style="width: 18px; height: 18px; cursor: pointer;" onchange="App.toggleUserSelection('${u.id}')" ${this.state.selectedUsers?.includes(u.id) ? 'checked' : ''}>`;
                
                // --- COLUMNA 1: STAFF ---
                const colStaff = `
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                        <div class="flex flex-col gap-0.5">
                            <div class="font-bold text-sm text-[var(--text-main)]">${u.display_name || 'Sin nombre'}</div>
                            <div class="text-xs text-[var(--text-secondary)] font-mono">${u.username}</div>
                        </div>
                    </div>
                `;

                // --- COLUMNA 2: EMPRESA ---
                const groupDisplay = (u.groups && u.groups.length > 0) ? u.groups.map(userGroup => `
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #7c3aed; background: rgba(124,58,237,0.15); border-radius: 6px;">corporate_fare</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${userGroup.name.length > 15 ? userGroup.name.substring(0, 15) + '...' : userGroup.name}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">corporate_fare</span><span class="text-xs text-slate-500 italic">Sin empresa</span></div>`;
                const colEmpresa = `<div class="flex flex-col max-w-[200px]">${groupDisplay}</div>`;

                // --- COLUMNA 3: CLIENTES ---
                const userClients = (u.clients && u.clients.length > 0) ? u.clients.map(client => `
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #10b981; background: rgba(16,185,129,0.15); border-radius: 6px;">person</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">person</span><span class="text-xs text-[var(--text-muted)] italic">Sin clientes</span></div>`;
                const colClientes = `<div class="flex flex-col max-w-[200px]">${userClients}</div>`;

                // --- COLUMNA 4: EVENTOS ---
                const userEvents = events.filter(e => u.events && u.events.map(ev => String(ev)).includes(String(e.id)));
                const eventRows = userEvents.length > 0 ? userEvents.map(e => `
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5 mb-1">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #ec4899; background: rgba(236,72,153,0.15); border-radius: 6px;">event</span>
                        <span class="text-xs font-medium text-[var(--text-main)]">${e.name.length > 15 ? e.name.substring(0, 15) + '...' : e.name}</span>
                    </div>
                `).join('') : `<div class="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"><span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #475569; background: rgba(71,85,105,0.15); border-radius: 6px;">event</span><span class="text-xs text-[var(--text-muted)] italic">Sin eventos</span></div>`;
                const colEventos = `<div class="flex flex-col max-w-[200px]">${eventRows}</div>`;

                // --- COLUMNA 5: ROL ---
                const roleColors = { ADMIN: '#ef4444', PRODUCTOR: '#f59e0b', LOGISTICO: '#3b82f6', STAFF: '#10b981', CLIENTE: '#8b5cf6' };
                const roleColor = roleColors[u.role] || '#64748b';
                const colRol = `<span class="text-xs font-bold" style="color: ${roleColor}; background: ${roleColor}22; border-radius: 6px; padding: 2px 8px;">${u.role}</span>`;

                // --- COLUMNA 6: ESTADO ---
                const statusLabel = u.status === 'APPROVED' ? 'Activo' : u.status === 'PENDING' ? 'Pendiente' : 'Suspendido';
                const statusClass = u.status === 'APPROVED' ? 'active' : u.status === 'PENDING' ? 'pending' : 'suspended';
                const colEstado = `<span class="status-pill ${statusClass}">${statusLabel}</span>`;

                return `
                <tr class="user-row-premium">
                    <td class="px-2 py-3 align-middle">${checkbox}</td>
                    <td class="px-2 py-3 align-middle">${colStaff}</td>
                    <td class="px-2 py-3 align-middle">${colEmpresa}</td>
                    <td class="px-2 py-3 align-middle">${colClientes}</td>
                    <td class="px-2 py-3 align-middle">${colEventos}</td>
                    <td class="px-2 py-3 align-middle text-left">${colRol}</td>
                    <td class="px-2 py-3 align-middle text-left">${colEstado}</td>
                </tr>`;
            }).join('');
        }
    },

    
    // Filtrar usuarios
    filterUsers: function() {
        if (!this.state.user) return;
        const searchTermRaw = document.getElementById('user-search')?.value || '';
        const searchTerm = this._normalize(searchTermRaw);
        const groupFilter = document.getElementById('filter-user-group')?.value || '';
        const clientFilter = document.getElementById('filter-user-client')?.value || '';
        const eventFilter = document.getElementById('filter-user-event')?.value || '';
        const roleFilter = document.getElementById('filter-user-role')?.value || '';
        const statusFilter = document.getElementById('filter-user-status')?.value || '';
        
        let filtered = this.state.allUsers || [];
        const clients = this.state.clients || [];
        const events = this.state.allEvents || [];
        
        // Búsqueda flexible: normaliza acentos y busca por palabras separadas
        if (searchTerm) {
            const searchWords = searchTerm.split(' ').filter(w => w.length > 0);
            filtered = filtered.filter(u => {
                const displayName = this._normalize(u.display_name);
                const username = this._normalize(u.username);
                const role = this._normalize(u.role);
                const groupName = this._normalize(u.group_name);
                const groups = u.groups && Array.isArray(u.groups) ? u.groups.map(g => this._normalize(g.name)).join(' ') : '';
                const userEvents = u.events && Array.isArray(u.events) ? events.filter(e => u.events.includes(e.id)).map(e => this._normalize(e.name)).join(' ') : '';
                // Buscar en campos básicos
                const basicText = `${displayName} ${username} ${role} ${groupName} ${groups} ${userEvents}`;
                if (searchWords.every(w => basicText.includes(w))) return true;
                // Buscar en clientes asignados (si el usuario es cliente)
                const userClients = clients.filter(c => String(c.user_id) === String(u.id));
                if (userClients.some(c => searchWords.every(w => this._normalize(c.name).includes(w)))) return true;
                return false;
            });
        }
        
        // Filtro por empresa
        if (groupFilter) {
            filtered = filtered.filter(u => {
                if (u.groups && Array.isArray(u.groups)) {
                    return u.groups.some(g => String(g.id) === String(groupFilter));
                }
                return false;
            });
        }
        
        // Filtro por cliente
        if (clientFilter) {
            filtered = filtered.filter(u => {
                const userClients = clients.filter(c => String(c.user_id) === String(u.id));
                return userClients.some(c => String(c.id) === String(clientFilter));
            });
        }
        
        // Filtro por evento
        if (eventFilter) {
            filtered = filtered.filter(u => u.events && u.events.includes(eventFilter));
        }
        
        // Filtro por rol
        if (roleFilter) {
            filtered = filtered.filter(u => u.role === roleFilter);
        }
        
        // Filtro por estado
        if (statusFilter) {
            filtered = filtered.filter(u => u.status === statusFilter);
        }
        
        this.renderUsersTable(filtered, this.state.allGroups || [], this.state.allEvents || []);
    },

    // Mostrar sugerencias de búsqueda para staff
    showUserSuggestions: function() {
        const raw = document.getElementById('user-search')?.value || '';
        const term = this._normalize(raw);
        const container = document.getElementById('user-suggestions');
        if (!container) return;

        if (term.length < 2) { this.hideUserSuggestions(); return; }

        const users = this.state.allUsers || [];
        const groups = this.state.groups || [];
        const events = this.state.allEvents || [];
        const clients = this.state.clients || [];
        const searchWords = term.split(' ').filter(w => w.length > 0);
        const suggestions = [];

        users.forEach(u => {
            const uName = this._normalize(u.display_name || u.username);
            if (searchWords.every(w => uName.includes(w))) {
                suggestions.push({ score: 100, text: u.display_name || u.username, subtext: u.role || 'Staff', icon: 'badge', color: '#3b82f6', type: 'staff' });
            }
        });
        groups.forEach(g => {
            const gName = this._normalize(g.name);
            if (searchWords.every(w => gName.includes(w))) {
                suggestions.push({ score: 90, text: g.name, subtext: g.email || 'Empresa', icon: 'corporate_fare', color: '#7c3aed', type: 'empresa' });
            }
        });
        events.forEach(e => {
            const eName = this._normalize(e.name);
            if (searchWords.every(w => eName.includes(w))) {
                suggestions.push({ score: 80, text: e.name, subtext: e.date || e.location || 'Evento', icon: 'event', color: '#ec4899', type: 'evento' });
            }
        });
        clients.forEach(c => {
            const cName = this._normalize(c.name);
            if (searchWords.every(w => cName.includes(w))) {
                suggestions.push({ score: 70, text: c.name, subtext: c.email || 'Cliente', icon: 'person', color: '#10b981', type: 'cliente' });
            }
        });

        suggestions.sort((a, b) => b.score - a.score);
        const top = suggestions.slice(0, 8);
        if (top.length === 0) { this.hideUserSuggestions(); return; }

        container.innerHTML = top.map((s, i) => `
            <div onclick="App.selectUserSuggestion('${s.text.replace(/'/g, "\\'")}')" 
                 style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); ${i === top.length - 1 ? 'border-bottom: none;' : ''}"
                 onmouseover="this.style.background='rgba(59,130,246,0.15)'" 
                 onmouseout="this.style.background='transparent'">
                <span class="material-symbols-outlined" style="font-size: 18px; color: ${s.color}; flex-shrink: 0;">${s.icon}</span>
                <div class="flex-1 min-w-0">
                    <div style="font-size: 13px; font-weight: 500; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.text}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${s.subtext}</div>
                </div>
                <span style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 600; flex-shrink: 0;">${s.type}</span>
            </div>
        `).join('');
        container.classList.remove('hidden');
    },

    selectUserSuggestion: function(text) {
        const input = document.getElementById('user-search');
        if (input) { input.value = text; this.filterUsers(); }
        this.hideUserSuggestions();
    },

    hideUserSuggestions: function() {
        const container = document.getElementById('user-suggestions');
        if (container) container.classList.add('hidden');
    },

    // Toggle seleccionar todos los usuarios
    toggleSelectAllUsers: function() {
        const selectAll = document.getElementById('select-all-users');
        const checkboxes = document.querySelectorAll('.user-checkbox');
        
        if (selectAll.checked) {
            // Seleccionar todos los usuarios visibles
            this.state.selectedUsers = Array.from(checkboxes).map(cb => cb.dataset.userId);
            checkboxes.forEach(cb => cb.checked = true);
        } else {
            // Deseleccionar todos
            this.state.selectedUsers = [];
            checkboxes.forEach(cb => cb.checked = false);
        }
    },

    // Manejar cambio de checkbox individual
    toggleUserSelection: function(userId) {
        if (!this.state.selectedUsers) this.state.selectedUsers = [];
        
        const index = this.state.selectedUsers.indexOf(userId);
        if (index > -1) {
            this.state.selectedUsers.splice(index, 1);
        } else {
            this.state.selectedUsers.push(userId);
        }
        
        // Actualizar estado del checkbox "seleccionar todos"
        const selectAll = document.getElementById('select-all-users');
        const checkboxes = document.querySelectorAll('.user-checkbox');
        selectAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    },

    // Manejar acciones en lote
    handleBulkAction: async function() {
        const actionSelect = document.getElementById('bulk-action');
        const action = actionSelect.value;
        
        if (!action) return;
        
        // Obtener usuarios seleccionados
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.userId);
        
        if (selectedIds.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un usuario', icon: 'warning', background: '#0f172a', color: '#fff' });
            actionSelect.value = '';
            return;
        }
        
        switch (action) {
            case 'edit':
                await this.editSelectedUsers(selectedIds);
                break;
            case 'activate':
                await this.bulkUpdateStatus(selectedIds, 'APPROVED');
                break;
            case 'suspend':
                await this.bulkUpdateStatus(selectedIds, 'SUSPENDED');
                break;
            case 'delete':
                if (!(await this._confirmAction('¿Eliminar usuarios?', `¿Estás seguro de eliminar ${selectedIds.length} usuario(s)? Esta acción no se puede deshacer.`))) {
                    actionSelect.value = '';
                    return;
                }
                await this.bulkDeleteUsers(selectedIds);
                break;
            case 'assign-company':
                // Mostrar selector de empresa
                this.showGroupSelectorForBulk(selectedIds);
                break;
            case 'assign-client':
                // Mostrar selector de cliente
                this.showClientSelectorForBulkUsers(selectedIds);
                break;
            case 'assign-event':
                // Mostrar selector de evento
                this.showEventSelectorForBulk(selectedIds);
                break;
        }
        
        actionSelect.value = '';
    },

    // Cambiar rol de múltiples usuarios
    handleBulkRoleChange: async function() {
        const roleSelect = document.getElementById('bulk-role');
        const newRole = roleSelect.value;
        
        if (!newRole) return;
        
        // Obtener usuarios seleccionados
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.userId);
        
        if (selectedIds.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un usuario', icon: 'warning', background: '#0f172a', color: '#fff' });
            roleSelect.value = '';
            return;
        }
        
        if (!(await this._confirmAction('¿Cambiar rol?', `¿Cambiar el rol a ${newRole} para ${selectedIds.length} usuario(s)?`))) {
            roleSelect.value = '';
            return;
        }
        
        try {
            const promises = selectedIds.map(userId => 
                this.fetchAPI(`/users/${userId}/role`, {
                    method: 'PUT',
                    body: JSON.stringify({ role: newRole })
                })
            );
            
            await Promise.all(promises);
            
            Swal.fire({ 
                title: '✓ Rol actualizado', 
                text: `Rol cambiado a ${newRole} para ${selectedIds.length} usuario(s)`, 
                icon: 'success', 
                background: '#0f172a', 
                color: '#fff', 
                timer: 1500, 
                showConfirmButton: false 
            });
            
            this.state.selectedUsers = [];
            this.loadUsersTable();
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al cambiar rol', icon: 'error', background: '#0f172a', color: '#fff' });
        }
        
        roleSelect.value = '';
    },

    // Actualizar estado de múltiples usuarios
    bulkUpdateStatus: async function(userIds, status) {
        try {
            const promises = userIds.map(userId => 
                this.fetchAPI(`/users/${userId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status })
                })
            );
            
            await Promise.all(promises);
            
            Swal.fire({ 
                title: '✓ Actualizado', 
                text: `${userIds.length} usuario(s) ${status === 'APPROVED' ? 'activados' : 'suspendidos'}`, 
                icon: 'success', 
                background: '#0f172a', 
                color: '#fff', 
                timer: 1500, 
                showConfirmButton: false 
            });
            
            this.state.selectedUsers = [];
            this.loadUsersTable();
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al actualizar usuarios', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    // Eliminar múltiples usuarios
    bulkDeleteUsers: async function(userIds) {
        try {
            const promises = userIds.map(userId => 
                this.fetchAPI(`/users/${userId}`, { method: 'DELETE' })
            );
            
            await Promise.all(promises);
            
            Swal.fire({ 
                title: '✓ Eliminado', 
                text: `${userIds.length} usuario(s) eliminado(s)`, 
                icon: 'success', 
                background: '#0f172a', 
                color: '#fff', 
                timer: 1500, 
                showConfirmButton: false 
            });
            
            this.state.selectedUsers = [];
            this.loadUsersTable();
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al eliminar usuarios', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    // Carrusel de edición de staff (6 botones)
    editSelectedUsers: function(userIds) {
        // Si hay solo 1 usuario, ir directo a edición inline
        const ids = Array.isArray(userIds) ? userIds : (userIds ? [userIds] : []);
        if (ids.length === 1) {
            this.editSingleUser(ids);
            return;
        }
        
        // Si hay múltiples usuarios, mostrar la lista
        this._lastUserCarouselContext = 'edit';
        this._savedSelectedUsers = [...ids];
        const users = this.state.allUsers || [];
        const selectedUsers = ids ? users.filter(u => ids.some(id => String(id) === String(u.id))) : [];
        if (selectedUsers.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 6 botones -->
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título + botón crear -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                    <button onclick="App.openCreateStaffModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <!-- Lista de staff seleccionado -->
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${selectedUsers.map(u => {
                        const roleColors = { ADMIN: '#ef4444', PRODUCTOR: '#f59e0b', LOGISTICO: '#3b82f6', STAFF: '#10b981', CLIENTE: '#8b5cf6' };
                        const roleColor = roleColors[u.role] || '#64748b';
                        return `<div class="flex items-center gap-4 p-4 rounded-2xl mb-2" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style="background: rgba(59,130,246,0.2); color: #3b82f6;">${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}</div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${u.display_name || u.username}</div>
                                <div class="text-[11px]" style="color: ${textSecondary};">${u.username} • <span style="color: ${roleColor};">${u.role}</span></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    // Editar un solo usuario - versión inline en el carrusel
    editSingleUser: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona un solo staff para editar', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (ids.length > 1) { Swal.fire({ title: '⚠️ Atención', text: 'Solo puedes editar un staff a la vez', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        const userId = ids[0];
        const user = this.state.allUsers?.find(u => u.id === userId);
        if (!user) { Swal.fire({ title: '⚠️ Error', text: 'Staff no encontrado', icon: 'error', background: '#0f172a', color: '#fff' }); return; }
        
        this._lastUserCarouselContext = 'edit';
        this._savedSelectedUsers = [userId];
        this._editingUserId = userId;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
        
        const roleOptions = ['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF', 'CLIENTE'].map(r => 
            `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`
        ).join('');
        
        // Determinar si es contexto de configuración de evento (solo 4 botones)
        const isConfigContext = this._isConfigEventContext === true;
        
        let navButtons;
        if (isConfigContext) {
            // Solo 4 botones para configuración del evento
            navButtons = `
                <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
            `;
        } else {
            // 6 botones para sistema normal
            navButtons = `
                <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
            `;
        }
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación -->
                <div class="flex items-center justify-${isConfigContext ? 'center gap-3' : 'between'} p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    ${navButtons}
                </div>
                <!-- Título + Guardar -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${user.display_name || user.username}</span>
                    </div>
                    <button onclick="App.saveUserEditInline()" class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105" style="background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">
                        <span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar
                    </button>
                </div>
                <!-- Campos编辑 inline -->
                <div class="p-4 rounded-2xl" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                    <div class="space-y-5">
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nombre</label>
                            <input id="edit-user-name-${user.id}" type="text" value="${user.display_name || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nombre del staff">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Email</label>
                            <input id="edit-user-email-${user.id}" type="email" value="${user.username || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Email del staff">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nueva Contraseña <span class="normal-case font-normal">(dejar vacío para mantener)</span></label>
                            <input id="edit-user-password-${user.id}" type="password" value="" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nueva contraseña">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Rol</label>
                            <select id="edit-user-role-${user.id}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                                ${roleOptions}
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    // Guardar edición inline de staff
    saveUserEditInline: async function() {
        const userId = this._editingUserId;
        if (!userId) return;
        
        const nameInput = document.getElementById(`edit-user-name-${userId}`);
        const emailInput = document.getElementById(`edit-user-email-${userId}`);
        const passwordInput = document.getElementById(`edit-user-password-${userId}`);
        const roleSelect = document.getElementById(`edit-user-role-${userId}`);
        
        if (!nameInput || !emailInput || !roleSelect) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const role = roleSelect.value;
        
        if (!name || !email) {
            Swal.fire({ title: '⚠️ Error', text: 'Nombre y email son obligatorios', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const saveBtn = document.querySelector('[onclick="App.saveUserEditInline()"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin align-middle mr-1">sync</span> Guardando...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.pointerEvents = 'none';
        }
        
        try {
            const updateData = { display_name: name, username: email, role };
            if (password) updateData.password = password;
            
            const result = await this.fetchAPI(`/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            if (result?.user || result?.id) {
                // Actualizar en el estado
                const userIndex = this.state.allUsers?.findIndex(u => u.id === userId);
                if (userIndex !== -1) {
                    this.state.allUsers[userIndex] = { ...this.state.allUsers[userIndex], ...updateData };
                }
                
                Swal.fire({ title: '✅ Guardado', text: 'Staff actualizado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
                
                // Recargar el carrusel
                this.editSingleUser([userId]);
            } else {
                throw new Error(result?.message || 'Error al guardar');
            }
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
        }
    },

    // Gestionar staff (Activar/Desactivar/Eliminar)
    showManageUserAction: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedUsers = [...ids];
        
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => ids.some(id => String(id) === String(u.id)));
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título debajo de la barra -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Gestionar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <div class="space-y-3">
                <div onclick="App.handleBulkUserActionDirect('activate')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(34,197,94,0.2); color: #22c55e;"><span class="material-symbols-outlined">play_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #22c55e;">Activar</div><div class="text-[11px]" style="color: ${textSecondary};">Activar ${ids.length} staff</div></div>
                </div>
                <div onclick="App.handleBulkUserActionDirect('suspend')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">pause_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #f59e0b;">Suspender</div><div class="text-[11px]" style="color: ${textSecondary};">Suspender ${ids.length} staff</div></div>
                </div>
                <div onclick="App.handleBulkUserActionDirect('delete')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(239,68,68,0.2); color: #ef4444;"><span class="material-symbols-outlined">delete</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #ef4444;">Eliminar</div><div class="text-[11px]" style="color: ${textSecondary};">Eliminar ${ids.length} staff</div></div>
                </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    handleBulkUserActionDirect: async function(action) {
        const userIds = this.state.selectedUsers || [];
        if (userIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (action === 'activate') {
            if (await this._confirmAction('¿Activar staff?', `¿Activar ${userIds.length} staff?`, 'Sí, activar')) {
                await this.bulkUpdateStatus(userIds, 'APPROVED');
                this.editSelectedUsers(userIds);
            }
        } else if (action === 'suspend') {
            if (await this._confirmAction('¿Suspender staff?', `¿Suspender ${userIds.length} staff?`, 'Sí, suspender')) {
                await this.bulkUpdateStatus(userIds, 'SUSPENDED');
                this.editSelectedUsers(userIds);
            }
        } else if (action === 'delete') {
            if (await this._confirmAction('¿Eliminar staff?', `¿Eliminar ${userIds.length} staff? Esta acción no se puede deshacer.`)) {
                await this.bulkDeleteUsers(userIds);
            } else {
                this.editSelectedUsers(userIds);
            }
        }
    },

    // Asignar empresa a staff
    showCompanySelectorForUsers: function(userIds) {
        this._lastUserCarouselContext = 'company';
        this._savedSelectedUsers = [...(userIds || [])];
        const groups = this.state.groups || [];
        const users = this.state.allUsers || [];
        const selectedUsers = userIds ? users.filter(u => userIds.some(uid => String(uid) === String(u.id))) : [];
        if (groups.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay empresas disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#7c3aed';
        const primaryLight = isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.15)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Empresa a Staff</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateGroupFromUserCarousel()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar empresa..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${groups.map(g => {
                        const isAssigned = userIds.some(uid => { const user = users.find(u => u.id === uid); return user && user.groups && user.groups.some(gp => String(gp.id) === String(g.id)); });
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignCompanyToUsersFromModal('${g.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">corporate_fare</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${g.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${g.email || 'Sin email'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignCompanyToUsersFromModal: async function(groupId, isAssigned) {
        const userIds = this.state.selectedUsers || [];
        if (userIds.length === 0) return;
        try {
            for (const userId of userIds) {
                if (isAssigned) {
                    await this.fetchAPI(`/groups/${groupId}/users/${userId}`, { method: 'DELETE' });
                } else {
                    await this.fetchAPI(`/groups/${groupId}/users`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
                }
            }
            await this.loadUsersTable();
            this.showCompanySelectorForUsers(userIds);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al asignar empresa', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    // Asignar cliente a staff
    showClientSelectorForUsers: function(userIds) {
        this._lastUserCarouselContext = 'client';
        this._savedSelectedUsers = [...(userIds || [])];
        const clients = this.state.clients || [];
        const users = this.state.allUsers || [];
        const selectedUsers = userIds ? users.filter(u => userIds.some(uid => String(uid) === String(u.id))) : [];
        if (clients.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay clientes disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#10b981';
        const primaryLight = isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Cliente a Staff</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateClientModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar cliente..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${clients.map(c => {
                        const isAssigned = userIds.some(uid => { const user = users.find(u => u.id === uid); return user && user.clients && user.clients.some(cl => String(cl.id) === String(c.id)); });
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `<div onclick="App.assignClientToUsersFromModal('${userIds.join(',')}', '${c.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">person</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${c.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${c.email || 'Sin email'}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignClientToUsersFromModal: async function(userIdsStr, clientId, isAssigned) {
        const userIds = userIdsStr.split(',').filter(id => id && id.trim() !== '');
        if (userIds.length === 0) return;
        try {
            if (isAssigned) {
                // Desasignar: quitar cada user del cliente
                for (const userId of userIds) {
                    await this.fetchAPI(`/clients/${clientId}/staff/${userId}`, { method: 'DELETE' });
                }
            } else {
                // Asignar: obtener staff actual y agregar los nuevos
                const clientRes = await this.fetchAPI(`/clients/${clientId}`);
                const currentStaff = (clientRes.staff || []).map(s => String(s.id || s.user_id));
                const newStaff = [...new Set([...currentStaff, ...userIds.map(String)])];
                await this.fetchAPI(`/clients/${clientId}/staff`, { method: 'PUT', body: JSON.stringify({ users: newStaff }) });
            }
            await this.loadUsersTable();
            await this.loadClients();
            // Reabrir el modal con los mismos userIds
            this.showClientSelectorForUsers(userIds);
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al asignar cliente: ' + e.message, icon: 'error', background: '#0f172a', color: '#fff' });
            this.showClientSelectorForUsers(userIds);
        }
    },

    // Asignar evento a staff
    showEventSelectorForUsers: function(userIds) {
        this._lastUserCarouselContext = 'event';
        this._savedSelectedUsers = [...(userIds || [])];
        const events = this.state.allEvents || [];
        const users = this.state.allUsers || [];
        const selectedUsers = userIds ? users.filter(u => userIds.some(uid => String(uid) === String(u.id))) : [];
        if (events.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'No hay eventos disponibles', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#ec4899';
        const primaryLight = isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1"><span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Evento a Staff</span><span class="text-xs" style="color: ${textMain};">${subtitleText}</span></div>
                    <button onclick="App.openCreateEventModal()" class="btn-primary !px-3 !py-2 text-xs flex items-center gap-1"><span class="material-symbols-outlined text-sm">add</span> Crear</button>
                </div>
                <div class="relative group mt-6 mb-6"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span><input type="text" placeholder="Buscar evento..." oninput="App.filterSelectorItems(this, '.selector-item')" style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;"></div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;" id="event-selector-items">
                    ${events.map(e => {
                        const isAssigned = userIds.some(uid => {
                            const user = users.find(u => String(u.id) === String(uid));
                            if (!user || !user.events) return false;
                            const result = user.events.some(ev => {
                                const evId = typeof ev === 'object' ? (ev.id || ev.event_id) : ev;
                                return String(evId) === String(e.id);
                            });
                            return result;
                        });
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBorder = isAssigned ? primaryColor : borderColor;
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        const userIdsJoined = Array.isArray(userIds) ? userIds.join(',') : userIds;
                        return `<div data-event-id="${e.id}" data-is-assigned="${isAssigned}" onclick="App.assignEventToUsersFromModal('${userIdsJoined}', '${e.id}', ${isAssigned})" class="event-selector-item selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};"><span class="material-symbols-outlined">event</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${textMain};">${e.name}</div><div class="text-[11px]" style="color: ${textSecondary};">${e.date || 'Sin fecha'} ${e.location ? '• ' + e.location : ''}</div></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};"><span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignEventToUsersFromModal: async function(userIdsStr, eventId, isAssigned) {
        console.log('[EVENT ASSIGN] userIdsStr:', userIdsStr, 'eventId:', eventId, 'isAssigned:', isAssigned);
        const userIds = userIdsStr.split(',').filter(id => id && id.trim() !== '');
        if (userIds.length === 0) { console.warn('[EVENT ASSIGN] No userIds'); return; }
        try {
            for (const userId of userIds) {
                if (isAssigned) {
                    console.log('[EVENT ASSIGN] DELETE /events/', eventId, '/users/', userId);
                    await this.fetchAPI(`/events/${eventId}/users/${userId}`, { method: 'DELETE' });
                } else {
                    console.log('[EVENT ASSIGN] POST /events/', eventId, '/users with user_id:', userId);
                    const res = await this.fetchAPI(`/events/${eventId}/users`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
                    console.log('[EVENT ASSIGN] POST response:', res);
                }
            }
            console.log('[EVENT ASSIGN] Success, reloading...');
            await this.loadUsersTable();
            // Debug: verificar que el usuario tiene el evento después de recargar
            const reloadedUser = this.state.allUsers?.find(u => String(u.id) === String(userIds[0]));
            console.log('[EVENT ASSIGN] After reload - user.events:', JSON.stringify(reloadedUser?.events));
            console.log('[EVENT ASSIGN] After reload - allEvents:', this.state.allEvents?.map(e => e.id));
            this.showEventSelectorForUsers(userIds);
        } catch (e) {
            console.error('[EVENT ASSIGN] Error:', e);
            Swal.fire({ title: '⚠️ Error', text: 'Error al asignar evento: ' + e.message, icon: 'error', background: '#0f172a', color: '#fff' });
            this.showEventSelectorForUsers(userIds);
        }
    },


    // Asignar rol a staff (NUEVO)
    showRoleSelectorForUsers: function(userIds) {
        this._lastUserCarouselContext = 'role';
        this._savedSelectedUsers = [...(userIds || [])];
        const users = this.state.allUsers || [];
        const selectedUsers = userIds ? users.filter(u => userIds.some(uid => String(uid) === String(u.id))) : [];
        const roles = [
            { value: 'ADMIN', label: 'ADMIN', color: '#ef4444', icon: 'admin_panel_settings' },
            { value: 'PRODUCTOR', label: 'PRODUCTOR', color: '#f59e0b', icon: 'work' },
            { value: 'LOGISTICO', label: 'LOGÍSTICO', color: '#3b82f6', icon: 'local_shipping' },
            { value: 'STAFF', label: 'STAFF', color: '#10b981', icon: 'badge' },
            { value: 'CLIENTE', label: 'CLIENTE', color: '#8b5cf6', icon: 'person' }
        ];
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        const savedIds = App._savedSelectedUsers || [];
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUser(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserAction(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showCompanySelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #7c3aed;" title="Asignar Empresa"><span class="material-symbols-outlined text-sm">corporate_fare</span></button>
                    <button onclick="App.showClientSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #10b981;" title="Asignar Cliente"><span class="material-symbols-outlined text-sm">person</span></button>
                    <button onclick="App.showEventSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsers(App._savedSelectedUsers)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Rol a Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${roles.map(r => `
                        <div onclick="App.assignRoleToUsersFromModal('${r.value}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${r.color}11; border: 1px solid ${r.color}44;">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${r.color}22; color: ${r.color};"><span class="material-symbols-outlined">${r.icon}</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: ${r.color};">${r.label}</div></div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    assignRoleToUsersFromModal: async function(newRole) {
        const userIds = this.state.selectedUsers || [];
        if (userIds.length === 0) return;
        const roleNames = { ADMIN: 'ADMIN', PRODUCTOR: 'PRODUCTOR', LOGISTICO: 'LOGÍSTICO', STAFF: 'STAFF', CLIENTE: 'CLIENTE' };
        const roleName = roleNames[newRole] || newRole;
        const result = await Swal.fire({
            title: '¿Cambiar rol?',
            text: `¿Cambiar rol a ${roleName} para ${userIds.length} staff?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#475569',
            background: '#0f172a',
            color: '#fff'
        });
        if (!result.isConfirmed) return;
        try {
            for (const userId of userIds) {
                await this.fetchAPI(`/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
            }
            await this.loadUsersTable();
            this.showRoleSelectorForUsers(userIds);
        } catch (e) { Swal.fire({ title: '⚠️ Error', text: 'Error al cambiar rol', icon: 'error', background: '#0f172a', color: '#fff' }); }
    },

    openCreateGroupFromUserCarousel: function() {
        this._lastUserCarouselContext = 'company';
        this._savedSelectedUsers = [...(this.state.selectedUsers || [])];
        this._openCompanyModalFromSelector = true;
        // NO cerrar SweetAlert - el modal HTML se abre encima y se restaurará al cerrar
        this.openCompanyModal();
    },

    // Editar empresa seleccionada desde dropdown (con validación de permisos)
    editGroupFromDropdown: async function(groupIds) {
        if (!groupIds || groupIds.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos una empresa', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Validar que solo se edite una empresa a la vez
        if (groupIds.length > 1) {
            Swal.fire({ 
                title: '⚠️ Atención', 
                text: 'Solo puedes editar una empresa a la vez. Por favor, selecciona solo una empresa.', 
                icon: 'warning', 
                background: '#0f172a', 
                color: '#fff' 
            });
            return;
        }
        
        const groupId = groupIds[0];
        const group = this.state.groups?.find(g => g.id === groupId);
        
        if (!group) {
            Swal.fire({ title: '⚠️ Error', text: 'Empresa no encontrada', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Validar permisos
        const currentUser = this.state.user;
        if (!currentUser) return;
        
        const isAdmin = currentUser.role === 'ADMIN';
        const isProductor = currentUser.role === 'PRODUCTOR';
        
        // ADMIN puede editar cualquier empresa
        // PRODUCTOR solo puede editar su propia empresa
        if (!isAdmin && !isProductor) {
            Swal.fire({ 
                title: '⚠️ Permiso denegado', 
                text: 'No tienes permisos para editar empresas', 
                icon: 'error', 
                background: '#0f172a', 
                color: '#fff' 
            });
            return;
        }
        
        if (isProductor) {
            // PRODUCTOR solo puede editar su propia empresa
            const userGroupId = currentUser.group_id;
            if (!userGroupId || String(userGroupId) !== String(groupId)) {
                Swal.fire({ 
                    title: '⚠️ Permiso denegado', 
                    text: 'Solo puedes editar tu propia empresa', 
                    icon: 'error', 
                    background: '#0f172a', 
                    color: '#fff' 
                });
                return;
            }
        }
        
        // Llamar a la función para editar grupo
        this.editGroup(groupId);
    },

    // Editar empresa (grupo)
    editGroup: async function(groupId) {
        const group = this.state.groups?.find(g => g.id === groupId);
        if (!group) {
            Swal.fire({ title: '⚠️ Error', text: 'Empresa no encontrada', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Usar SweetAlert2 para un modal más profesional
        Swal.fire({
            title: 'Editar Empresa',
            html: `
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Nombre de la empresa</label>
                        <input id="edit-group-name" type="text" value="${group.name || ''}" 
                               class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#0ba5ec]">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Email de contacto</label>
                        <input id="edit-group-email" type="email" value="${group.email || ''}" 
                               class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#0ba5ec]">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Estado</label>
                        <select id="edit-group-status" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#0ba5ec]">
                            <option value="ACTIVE" ${group.status === 'ACTIVE' ? 'selected' : ''}>Activo</option>
                            <option value="INACTIVE" ${group.status === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar Cambios',
            cancelButtonText: 'Cancelar',
            background: '#0f172a',
            color: '#fff',
            preConfirm: () => {
                const name = document.getElementById('edit-group-name').value.trim();
                const email = document.getElementById('edit-group-email').value.trim();
                const status = document.getElementById('edit-group-status').value;
                
                if (!name) {
                    Swal.showValidationMessage('El nombre de la empresa es requerido');
                    return false;
                }
                
                return { name, email, status };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const { name, email, status } = result.value;
                    
                    await this.fetchAPI(`/groups/${groupId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ name, email, status })
                    });
                    
                    Swal.fire({ 
                        title: '✓ Actualizado', 
                        text: 'Empresa actualizada exitosamente', 
                        icon: 'success', 
                        background: '#0f172a', 
                        color: '#fff', 
                        timer: 1500, 
                        showConfirmButton: false 
                    });
                    
                    // Recargar la tabla de empresas
                    this.loadGroups();
                    
                } catch (error) {
                    Swal.fire({ 
                        title: '⚠️ Error', 
                        text: 'Error al actualizar la empresa', 
                        icon: 'error', 
                        background: '#0f172a', 
                        color: '#fff' 
                    });
                }
            }
        });
    },

    // Mostrar selector de cliente para bulk de usuarios (Asignar Cliente en Equipo)
    showClientSelectorForBulkUsers: async function(userIds) {
        // Cargar clientes si no están cargados
        if (!this.state.clients || this.state.clients.length === 0) {
            try {
                const clients = await this.fetchAPI('/clients');
                this.state.clients = clients;
            } catch (e) {
                Swal.fire({ title: '⚠️ Error', text: 'No se pudieron cargar los clientes', icon: 'error', background: '#0f172a', color: '#fff' });
                return;
            }
        }
        
        const clients = this.state.clients || [];
        const users = this.state.allUsers || [];
        
        if (clients.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'No hay clientes disponibles', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Detectar tema actual
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#10b981';
        const primaryLight = isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)';
        
        // Calcular usuarios seleccionados y sus clientes
        const selectedUsers = users.filter(u => userIds.some(uid => String(uid) === String(u.id)));
        
        // Para cada usuario, saber cuántos clientes tiene asignados
        const getUserClientCount = (userId) => {
            const user = users.find(u => u.id === userId);
            if (!user || !user.clients) return 0;
            return user.clients.length || 0;
        };
        
        // Construir texto del título
        let subtitleText = '';
        if (selectedUsers.length === 1) {
            const user = selectedUsers[0];
            const userName = user.display_name || user.username || 'Usuario';
            const clientCount = getUserClientCount(user.id);
            subtitleText = `${userName} - ${clientCount} Clientes`;
        } else {
            subtitleText = `${selectedUsers.length} usuarios seleccionados`;
        }
        
        // Verificar si un cliente está asignado a TODOS los usuarios seleccionados
        const isClientAssignedToAll = (clientId) => {
            return selectedUsers.every(user => {
                if (!user.clients) return false;
                return user.clients.some(c => String(c.id) === String(clientId));
            });
        };
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Cliente</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                    <button onclick="App.openCreateClientModal()" class="btn-primary !py-2 !px-4 !text-xs shadow-lg">
                        <span class="material-symbols-outlined text-xs">person_add</span> CREAR
                    </button>
                </div>

                <div class="relative group mt-6 mb-6">
                    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span>
                    <input type="text" placeholder="Buscar cliente..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;">
                </div>

                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${clients.map(c => {
                        const isAssigned = isClientAssignedToAll(c.id);
                        const icon = isAssigned ? 'check' : 'add';
                        const itemBg = isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        return `
                        <div onclick="App.toggleClientForUsersFromModal('${userIds.join(',')}', '${c.id}', ${isAssigned})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};">
                                <span class="material-symbols-outlined">person</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${c.name}</div>
                                <div class="text-[11px]" style="color: ${textSecondary};">${c.email || 'Sin email'}</div>
                            </div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssigned ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssigned ? primaryColor : borderColor};">
                                <span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '460px',
            background: bgMain,
            color: textMain,
            showConfirmButton: false,
            showCloseButton: false,
            customClass: { 
                popup: 'modal-left-aligned'
            }
        });
    },
    
    // Toggle cliente para usuarios (asignar/desasignar)
    toggleClientForUsersFromModal: async function(userIdsStr, clientId, currentlyAssigned) {
        const userIds = userIdsStr.split(',');
        try {
            if (currentlyAssigned) {
                // Desasignar: DELETE
                for (const userId of userIds) {
                    await this.fetchAPI(`/clients/${clientId}/staff/${userId}`, {
                        method: 'DELETE'
                    });
                }
                Swal.fire({ 
                    toast: true,
                    title: '✓ Desasignado', 
                    icon: 'success',
                    background: '#0f172a', 
                    color: '#fff',
                    timer: 1500, 
                    showConfirmButton: false 
                });
            } else {
                // Asignar: POST
                for (const userId of userIds) {
                    await this.fetchAPI(`/clients/${clientId}/staff`, {
                        method: 'POST',
                        body: JSON.stringify({ user_id: userId })
                    });
                }
                Swal.fire({ 
                    toast: true,
                    title: '✓ Asignado', 
                    icon: 'success',
                    background: '#0f172a', 
                    color: '#fff',
                    timer: 1500, 
                    showConfirmButton: false 
                });
            }
            
            // Recargar TODAS las tablas
            await this.refreshAllTables();
            
            // Volver a mostrar el modal con datos actualizados
            this.showClientSelectorForBulkUsers(userIds);
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al ' + (currentlyAssigned ? 'desasignar' : 'asignar') + ' cliente', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    // Mostrar selector de empresa para bulk
    showGroupSelectorForBulk: function(userIds) {
        const groups = this.state.allGroups || [];
        const users = this.state.allUsers || [];
        
        if (groups.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'No hay empresas disponibles', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Calcular cuántos de los usuarios seleccionados tienen cada empresa
        const selectedUsers = users.filter(u => userIds.some(uid => String(uid) === String(u.id)));
        const getAssignedCount = (groupId) => {
            return selectedUsers.filter(u => {
                const userGroups = u.groups || [];
                return userGroups.some(g => String(g.id) === String(groupId));
            }).length;
        };
        
        const html = `
            <div class="space-y-6">
                <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-widest">Asignar Empresa</span>
                        <span class="text-xs text-slate-400">Selecciona empresa para ${userIds.length} usuario(s)</span>
                    </div>
                    <button onclick="App.navigateToCreateGroup()" class="btn-primary !py-2 !px-4 !text-xs shadow-lg">
                        <span class="material-symbols-outlined text-xs">add_business</span> NUEVA
                    </button>
                </div>

                <div class="relative group">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors text-sm">search</span>
                    <input type="text" placeholder="Buscar empresa..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600">
                </div>

                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${groups.map(g => {
                        const assignedCount = getAssignedCount(g.id);
                        const isAssignedToAll = assignedCount === userIds.length;
                        const isAssignedToSome = assignedCount > 0 && assignedCount < userIds.length;
                        const statusClass = isAssignedToAll ? 'ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-500/30' : isAssignedToSome ? 'ring-1 ring-blue-500/30 bg-blue-500/5 border-blue-500/20' : '';
                        const icon = isAssignedToAll ? 'check' : 'add';
                        return `
                        <div onclick="App.bulkToggleCompanyForUsers('${userIds.join(',')}', '${g.id}', ${isAssignedToAll ? 'true' : 'false'})" class="selector-item flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all cursor-pointer group shadow-sm ${statusClass}">
                            <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-sm font-bold group-hover:scale-105 transition-transform">
                                <span class="material-symbols-outlined">corporate_fare</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">${g.name}</div>
                                <div class="text-[11px] ${isAssignedToAll ? 'text-blue-400 font-semibold' : 'text-slate-500 uppercase tracking-tighter'}">
                                    ${isAssignedToAll ? '✓ Asignada a todos' : isAssignedToSome ? `${assignedCount} de ${userIds.length} usuarios` : g.email || 'Sin email'}
                                </div>
                            </div>
                            <div class="w-7 h-7 rounded-lg ${isAssignedToAll ? 'bg-blue-500/20 border-2 border-blue-500/50' : 'bg-white/5 border border-white/10'} flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                                <span class="material-symbols-outlined text-xs ${isAssignedToAll ? 'text-blue-400' : 'text-blue-500 opacity-0 group-hover:opacity-100'} transition-opacity">${icon}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '450px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { 
                popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl',
                closeButton: 'hover:text-red-500 transition-colors'
            }
        });
    },
    
    // Toggle empresa para usuarios seleccionados (asignar o desasignar)
    bulkToggleCompanyForUsers: async function(userIdsStr, groupId, currentlyAssigned) {
        const userIds = userIdsStr.split(',');
        try {
            let promises;
            if (currentlyAssigned) {
                // Desasignar empresa (enviar null)
                promises = userIds.map(userId => 
                    this.fetchAPI(`/users/${userId}/group`, {
                        method: 'PUT',
                        body: JSON.stringify({ group_id: null })
                    })
                );
            } else {
                // Asignar empresa
                promises = userIds.map(userId => 
                    this.fetchAPI(`/users/${userId}/group`, {
                        method: 'PUT',
                        body: JSON.stringify({ group_id: groupId })
                    })
                );
            }
            
            await Promise.all(promises);
            
            // Recargar modal para mostrar nuevo estado
            this.showGroupSelectorForBulk(userIds);
            this.loadUsersTable();
            this.loadGroups();
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al actualizar empresa', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },
    
    bulkAssignCompanyFromModal: async function(userIdsStr, groupId) {
        const userIds = userIdsStr.split(',');
        try {
            const promises = userIds.map(userId => 
                this.fetchAPI(`/users/${userId}/group`, {
                    method: 'PUT',
                    body: JSON.stringify({ group_id: groupId })
                })
            );
            
            await Promise.all(promises);
            
            Swal.fire({ 
                title: '✓ Asignado', 
                text: `Empresa asignada a ${userIds.length} usuario(s)`, 
                icon: 'success', 
                background: '#0f172a', 
                color: '#fff',
                timer: 1500, 
                showConfirmButton: false 
            });
            
            this.state.selectedUsers = [];
            this.loadUsersTable();
            this.loadGroups();
            Swal.close();
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al asignar empresa', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    // Mostrar selector de evento para bulk
    showEventSelectorForBulk: function(userIds) {
        const events = this.state.allEvents || [];
        const users = this.state.allUsers || [];
        
        if (events.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'No hay eventos disponibles', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Detectar tema actual
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const bgInput = isDark ? '#334155' : '#e2e8f0';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const primaryColor = '#8b5cf6';
        const primaryLight = isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)';
        
        // Calcular cuántos de los usuarios seleccionados tienen cada evento
        const selectedUsers = users.filter(u => userIds.some(uid => String(uid) === String(u.id)));
        const getAssignedCount = (eventId) => {
            return selectedUsers.filter(u => {
                const userEvents = u.events || [];
                return userEvents.some(ev => String(ev) === String(eventId));
            }).length;
        };
        
        // Construir texto del título
        let subtitleText = '';
        if (selectedUsers.length === 1) {
            const user = selectedUsers[0];
            const userName = user.display_name || user.username || 'Usuario';
            const eventCount = (user.events || []).length;
            subtitleText = `${userName} - ${eventCount} Eventos`;
        } else {
            subtitleText = `${selectedUsers.length} usuarios seleccionados`;
        }
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Evento</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                    <button onclick="App.navigateToCreateEvent()" class="btn-primary !py-2 !px-4 !text-xs shadow-lg">
                        <span class="material-symbols-outlined text-xs">event</span> NUEVO
                    </button>
                </div>

                <div class="relative group mt-6 mb-6">
                    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm" style="color: ${textSecondary};">search</span>
                    <input type="text" placeholder="Buscar evento..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        style="width: 100%; padding: 10px 16px 10px 44px; border-radius: 12px; background: ${bgInput}; border: 1px solid ${borderColor}; font-size: 14px; color: ${textMain}; outline: none;">
                </div>

                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${events.map(e => {
                        const assignedCount = getAssignedCount(e.id);
                        const isAssignedToAll = assignedCount === userIds.length;
                        const isAssignedToSome = assignedCount > 0 && assignedCount < userIds.length;
                        const itemBorder = isAssignedToAll ? primaryColor : isAssignedToSome ? 'rgba(139,92,246,0.3)' : borderColor;
                        const itemBg = isAssignedToAll ? primaryLight : isAssignedToSome ? (isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc');
                        const icon = isAssignedToAll ? 'check' : 'add';
                        return `
                        <div onclick="App.bulkToggleEventForUsers('${userIds.join(',')}', '${e.id}', ${isAssignedToAll ? 'true' : 'false'})" class="selector-item flex items-center gap-4 p-4 rounded-2xl cursor-pointer group shadow-sm mb-2" style="background: ${itemBg}; border: 1px solid ${itemBorder};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style="background: ${primaryLight}; color: ${primaryColor};">
                                <span class="material-symbols-outlined">event</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${e.name}</div>
                                <div class="text-[11px]" style="color: ${isAssignedToAll ? primaryColor : textSecondary};">
                                    ${isAssignedToAll ? '✓ Asignado a todos' : isAssignedToSome ? `${assignedCount} de ${userIds.length} usuarios` : (e.date || 'Sin fecha') + (e.location ? ' • ' + e.location : '')}
                                </div>
                            </div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${isAssignedToAll ? primaryLight : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}; border: 2px solid ${isAssignedToAll ? primaryColor : borderColor};">
                                <span class="material-symbols-outlined text-sm" style="color: ${primaryColor};">${icon}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '460px',
            background: bgMain,
            color: textMain,
            showConfirmButton: false,
            showCloseButton: false,
            customClass: { 
                popup: 'modal-left-aligned',
                closeButton: 'hover:text-red-500 transition-colors'
            }
        });
    },
    
    // Toggle evento para usuarios seleccionados (asignar o desasignar)
    bulkToggleEventForUsers: async function(userIdsStr, eventId, currentlyAssigned) {
        const userIds = userIdsStr.split(',');
        console.log('[BULK TOGGLE EVENT] userIds:', userIds, 'eventId:', eventId, 'currentlyAssigned:', currentlyAssigned);
        try {
            const promises = userIds.map(async (userId) => {
                const user = this.state.allUsers?.find(u => String(u.id) === String(userId));
                const currentEvents = user?.events || [];
                console.log('[BULK TOGGLE EVENT] User:', userId, 'currentEvents:', currentEvents);
                let newEvents;
                
                if (currentlyAssigned) {
                    // Desasignar: remover el evento
                    newEvents = currentEvents.filter(ev => String(ev) !== String(eventId));
                } else {
                    // Asignar: agregar el evento si no existe
                    if (!currentEvents.some(ev => String(ev) === String(eventId))) {
                        newEvents = [...currentEvents, eventId];
                    } else {
                        return { success: true }; // Ya está asignado
                    }
                }
                
                console.log('[BULK TOGGLE EVENT] PUT /users/' + userId + '/events', JSON.stringify({ events: newEvents }));
                const result = await this.fetchAPI(`/users/${userId}/events`, {
                    method: 'PUT',
                    body: JSON.stringify({ events: newEvents })
                });
                console.log('[BULK TOGGLE EVENT] Response:', result);
                return result;
            });
            
            await Promise.all(promises);
            
            // Limpiar cache y recargar datos
            this.state.users = null;
            this.state.allEvents = null;
            this.loadUsersTable();
            this.loadEvents();
            
            // Mostrar notificación
            Swal.fire({ 
                toast: true,
                title: currentlyAssigned ? '✓ Desasignado' : '✓ Asignado', 
                icon: 'success',
                background: '#0f172a', 
                color: '#fff',
                timer: 1000,
                showConfirmButton: false,
                position: 'top-end'
            });
            
            // Reabrir modal después de un brevedelay
            setTimeout(() => {
                if (Swal.isVisible()) {
                    this.showEventSelectorForBulk(userIds);
                }
            }, 200);
        } catch (e) {
            console.error('Error bulkToggleEventForUsers:', e);
            Swal.fire({ title: '⚠️ Error', text: 'Error al actualizar evento', icon: 'error', background: '#0f172a', color: '#fff' });
        }
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
                body: JSON.stringify({ name: name.trim(), date }) 
            });
            if (res.success) { 
                alert('✓ Evento creado exitosamente');
                this.loadEvents();
            } else {
                alert('Error: ' + res.error);
            }
        } catch { alert('Error de conexión'); }
    },

    // Guardar evento (formulario corto) - Creación y Edición
    saveEventShort: async function(e) {
        console.log('[EVENT CREATE] saveEventShort called, event:', e);
        
        if (e && e.preventDefault) e.preventDefault();
        
        const form = document.getElementById('new-event-form');
        if (!form) return;
        
        const name = form.querySelector('#ev-name')?.value?.trim();
        const date = form.querySelector('#ev-date')?.value?.trim();
        
        if (!name || !date) {
            alert('Por favor completa los campos obligatorios: Nombre del Evento y Fecha de Inicio');
            return;
        }
        
        const fd = new FormData(form);
        const data = {};
        
        fd.forEach((v, k) => {
            const el = form.elements[k];
            if (el && el.type === 'checkbox') {
                data[k] = el.checked ? 1 : 0;
            } else {
                data[k] = v === null || v === undefined || v === 'null' ? '' : v;
            }
        });
        
        const evName = form.querySelector('#ev-name')?.value?.trim();
        const evDate = form.querySelector('#ev-date')?.value?.trim();
        const evLocation = form.querySelector('#ev-location')?.value?.trim();
        const evDesc = form.querySelector('#ev-desc')?.value?.trim();
        const evGroup = form.querySelector('#ev-group')?.value?.trim();
        const evEmailTemplate = form.querySelector('#ev-email-template')?.value?.trim();
        
        if (evName) data.name = evName;
        if (evDate) data.date = evDate;
        if (evLocation) data.location = evLocation;
        if (evDesc) data.description = evDesc;
        if (evGroup) data.group_id = evGroup;
        if (evEmailTemplate && evEmailTemplate !== '') {
            data.email_template_id = evEmailTemplate;
        }
        
        if (!data.group_id) data.group_id = '';
        if (!data.qr_color_dark) data.qr_color_dark = '#000000';
        if (!data.qr_color_light) data.qr_color_light = '#ffffff';
        if (!data.ticket_accent_color) data.ticket_accent_color = '#7c3aed';
        
        console.log('[EVENT CREATE SHORT] Data to send:', data);
        
        try {
            if (data.email_template_id) {
                const processedData = await App.saveEventWithTemplate(data);
                Object.assign(data, processedData);
            }
            
            const eventId = form.querySelector('#ev-id-hidden')?.value?.trim();
            
            let res;
            if (eventId) {
                res = await this.fetchAPI(`/events/${eventId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            } else {
                res = await this.fetchAPI('/events', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            }
            
            if (res && res.success === false) {
                await this._notifyAction('Error', res.error || 'No se pudo guardar el evento.', 'error', 0);
                return;
            }
            
            hideModal('modal-event');
            await this.loadEvents(true);
            
            if (eventId) {
                await this._notifyAction('✓ Actualizado', 'Evento actualizado correctamente.', 'success');
            } else {
                await this._notifyAction('✓ Guardado', 'Evento creado correctamente.', 'success');
            }
        } catch (err) {
            console.error('[saveEventShort] Error:', err);
            await this._notifyAction('Error', 'Error al guardar el evento: ' + err.message, 'error', 0);
        }
    },
     
    async updateEvent(id, data) {
        try {
            const res = await this.fetchAPI(`/events/${id}`, { 
                method: 'PUT', 
                body: JSON.stringify(data)
            });
            if (res.success) {
                alert("✓ Evento actualizado.");
                hideModal('modal-event');
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
        modal?.removeAttribute('aria-hidden');
    },
    
    closeCompanyModal: function() {
        const modal = document.getElementById('modal-company');
        
        // Quitar foco de TODOS los elementos del modal antes de cerrar
        const focusableElements = modal?.querySelectorAll('input, button, select, textarea');
        focusableElements?.forEach(el => {
            el.blur();
        });
        
        // Quitar foco del body para asegurar
        document.body.focus();
        
        modal?.classList.add('hidden');
        modal?.setAttribute('aria-hidden', 'true');
        
        // Restaurar carrusel de staff si viene del selector
        this._restoreUserCarouselContext();
    },
    
    saveCompany: async function(data) {
        const groupId = document.getElementById('company-id-hidden').value;
        const pendingUserId = this.state._pendingGroupUserId;
        
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
            
            if (pendingUserId) {
                this._openCompanyModalFromSelector = false;
                delete this.state._pendingGroupUserId;
                await this.loadGroups();
                this.showGroupSelector(pendingUserId);
            } else if (this._openCompanyModalFromSelector && this._lastUserCarouselContext === 'company') {
                // Reabrir el carrusel de asignar empresa a staff
                this._openCompanyModalFromSelector = false;
                await this.loadGroups();
                const savedUsers = this._savedSelectedUsers || [];
                if (savedUsers.length > 0) {
                    this.showCompanySelectorForUsers(savedUsers);
                }
            } else {
                this.loadGroups();
            }
        } catch (e) { 
            console.error('Error saving company:', e);
            alert('Error al guardar empresa'); 
        }
    },
    
    // --- PROFILE V10.6 ---
    loadProfileData: async function() {
        if (!this.state.user) return;
        
        // Obtener datos actualizados del usuario desde la API /users/:id
        let currentUser = this.state.user;
        try {
            const userData = await this.fetchAPI(`/users/${this.state.user.userId}`);
            if (userData && userData.id) {
                // Actualizar con datos del servidor
                currentUser = { ...currentUser, ...userData };
                this.state.user = currentUser;
                // Actualizar localStorage
                LS.set('user', JSON.stringify(currentUser));
            }
        } catch (e) {
            console.error('Error fetching user data:', e);
        }
        
        document.getElementById('profile-name').value = currentUser.display_name || currentUser.name || '';
        document.getElementById('profile-phone').value = currentUser.phone || '';
        document.getElementById('profile-email').value = currentUser.username || currentUser.email || '';
        
        // Cargar empresas disponibles y seleccionar la asignada
        try {
            const groups = await this.fetchAPI('/groups');
            this.state.allGroups = groups;
            const select = document.getElementById('profile-company');
            if (select) {
                // Usar group_id o el primer grupo del array groups
                const assignedGroupId = currentUser.group_id || (currentUser.groups && currentUser.groups.length > 0 ? currentUser.groups[0].id : null);
                select.innerHTML = '<option value="">-- Sin empresa asignada --</option>' + 
                    groups.map(g => `<option value="${g.id}" ${String(g.id) === String(assignedGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');
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
    


    async loadMailbox() {
        const list = document.getElementById('inbox-list');
        if (!list) return;
        try {
            const res = await this.fetchAPI('/email/email-logs?type=INBOX');
            const logs = res.data || []; 
            list.innerHTML = logs.map(l => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="px-4 py-3 text-xs text-[var(--text-main)] font-medium">${l.sender || 'Sistema'}</td>
                    <td class="px-4 py-3 text-xs text-[var(--text-secondary)] truncate max-w-xs">${l.subject}</td>
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
            const res = await this.fetchAPI('/email/imap/sync');
            if (res.success) {
                Swal.fire('✓ Sincronizado', 'Correos actualizados correctamente.', 'success');
                this.loadMailbox();
            }
        } catch(e) { Swal.fire('Error', 'Falla en sincronización IMAP', 'error'); }
    },

    async loadMailingData() {
        console.log('[MAIL] Loading mailing data...');
        try {
            const eventsRes = await this.fetchAPI('/events');
            const events = Array.isArray(eventsRes) ? eventsRes : (eventsRes.data || []);
            const eventSelector = document.getElementById('mailing-event-selector');
            if (eventSelector) {
                eventSelector.innerHTML = '<option value="">-- Seleccionar Evento --</option>' + 
                    events.map(ev => `<option value="${ev.id}">${ev.name}</option>`).join('');
            }

            const templatesRes = await this.fetchAPI('/email/templates');
            const templates = Array.isArray(templatesRes) ? templatesRes : (templatesRes.data || []);
            this.state.emailTemplates = templates;
            const tempSelector = document.getElementById('mailing-template-selector');
            if (tempSelector) {
                tempSelector.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>' + 
                    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }

            if (!this.state.mailingGuests) this.state.mailingGuests = [];
        } catch(e) { console.error('Error mailing data:', e); }
    },

    async onMailingEventChange() {
        const eventId = document.getElementById('mailing-event-selector').value;
        if (!eventId) {
            this.state.mailingGuests = (this.state.mailingGuests || []).filter(g => g.manual);
            return this.filterMailingGuests();
        }
        try {
            const guests = await this.fetchAPI(`/events/${eventId}/guests`);
            const manualOnes = (this.state.mailingGuests || []).filter(g => g.manual);
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
                previewArea.innerHTML = `<iframe srcdoc="${body.replace(/"/g, '&quot;')}" class="w-full border-none animate-fade-in" style="min-height: 600px; height: 600px;" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 20) + 'px';"></iframe>`;
            }
        }
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
            return name.includes(query) || email.includes(query) || org.includes(query);
        });

        this.state.lastFilteredRecipients = filtered;

        const list = document.getElementById('mailing-recipients-list');
        const count = document.getElementById('mailing-count');
        if (!list) return;

        const totalSelected = (this.state.mailingGuests || []).filter(g => g.selected).length;
        if (count) count.innerHTML = `${filtered.length} / ${totalSelected} seleccionados`;
        
        // this.updateMailingSummaryUI(); // Temporarily disabled
        
        if (filtered.length === 0) {
            list.innerHTML = `<div class="text-center py-6 text-slate-500">Sin resultados</div>`;
            return;
        }

        list.innerHTML = filtered.map(g => `
            <label class="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-all">
                <input type="checkbox" class="mailing-check w-4 h-4 rounded-md accent-primary" 
                    value="${g.email}" ${g.selected ? 'checked' : ''} 
                    onchange="App.updateGuestSelection('${g.id}', this.checked)">
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-[11px] font-bold text-white truncate">${g.name}</span>
                    <span class="text-[9px] text-slate-500 truncate">${g.email}</span>
                </div>
            </label>
        `).join('');
    },

    updateGuestSelection(guestId, isChecked) {
        const guest = (this.state.mailingGuests || []).find(g => g.id == guestId);
        if (guest) {
            guest.selected = isChecked;
            this.filterMailingGuests();
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

    showScheduleModal() {
        Swal.fire({
            title: 'Programar Campaña',
            html: `<input type="datetime-local" id="schedule-datetime" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white">`,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            confirmButtonText: 'Programar Ahora',
            showCancelButton: true,
            confirmButtonColor: 'var(--primary)',
            preConfirm: () => {
                const date = document.getElementById('schedule-datetime').value;
                if (!date) return Swal.showValidationMessage('Debes seleccionar una fecha y hora');
                return date;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.state.scheduledMailingDate = result.value;
                Swal.fire('Programado', `La campaña iniciará el ${new Date(result.value).toLocaleString()}`, 'success');
            }
        });
    },

    closeModal: function() {
        hideModal('modal-event');
    },

    openInviteModal: function() {
        document.getElementById('invite-user-form')?.reset();
        this.updateRoleOptions();
        const modal = document.getElementById('modal-invite');
        modal?.classList.remove('hidden');
        modal?.setAttribute('aria-hidden', 'false');
    },

    closeInvite: function() {
        const modal = document.getElementById('modal-invite');
        modal?.classList.add('hidden');
        modal?.setAttribute('aria-hidden', 'true');
    },

    // Editar usuario (colaborador)
    editUser: async function(userId) {
        const user = this.state.allUsers?.find(u => u.id === userId);
        if (!user) {
            this._notifyAction('Error', 'Usuario no encontrado', 'error');
            return;
        }
        
        // Abrir modal de invitación en modo edición
        document.getElementById('invite-user-form')?.reset();
        
        // Llenar datos del usuario
        document.getElementById('invite-display-name').value = user.display_name || '';
        document.getElementById('invite-username').value = user.username || '';
        
        // Seleccionar rol - Ocultar ADMIN para PRODUCTOR
        const roleSelect = document.getElementById('invite-role');
        if (roleSelect) {
            const currentUserRole = this.state.user?.role;
            const isProductor = currentUserRole === 'PRODUCTOR';
            
            // Filtrar opciones de rol si es PRODUCTOR
            const options = roleSelect.querySelectorAll('option');
            options.forEach(opt => {
                if (isProductor && opt.value === 'ADMIN') {
                    opt.classList.add('hidden');
                } else {
                    opt.classList.remove('hidden');
                }
            });
            
            // Si el usuario actual es ADMIN, mostrar todas las opciones
            // Si el usuario actual es PRODUCTOR, asegurar que no se muestre ADMIN
            if (isProductor && user.role === 'ADMIN') {
                // No debería poder editar admins, pero si lo hace, asignar por defecto
                roleSelect.value = 'PRODUCTOR';
            } else {
                roleSelect.value = user.role || 'STAFF';
            }
        }
        
        // Guardar ID del usuario que se está editando
        this.state.editingUserId = userId;
        
        // Cambiar título del modal
        const modalTitle = document.querySelector('#modal-invite h3');
        if (modalTitle) modalTitle.textContent = 'Editar Colaborador';
        
        // Cambiar texto del botón
        const submitBtn = document.querySelector('#modal-invite button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
        
        // Hacer password opcional en modo edición
        document.getElementById('invite-password').required = false;
        
        const modal = document.getElementById('modal-invite');
        modal?.classList.remove('hidden');
        modal?.setAttribute('aria-hidden', 'false');
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

    async login(username, password) {
        console.log("[AUTH] Intentando login:", username);
        try {
            console.log("[AUTH DEBUG] Llamando a fetchAPI con endpoint:", '/login');
            console.log("[AUTH DEBUG] API object exists:", typeof API !== 'undefined');
            console.log("[AUTH DEBUG] API.BASE_URL:", API?.BASE_URL);
            const data = await this.fetchAPI('/login', { 
                method: 'POST', 
                body: JSON.stringify({ username, password }) 
            });
            
            if (data.success) {
                this.state.user = data;
                LS.set('user', JSON.stringify(data));
                // Notificaciones push: disponible manualmente desde Mi Perfil
                // this.initPushNotifications().catch(err => console.error('Push error:', err));
                await this.loadAppShell();
                
                const sbu = document.getElementById('sidebar-username');
                const sbr = document.getElementById('sidebar-role');
                // Mostrar nombre si existe, si no mostrar email (username)
                if (sbu) sbu.textContent = data.display_name || data.username || 'Usuario';
                if (sbr) sbr.textContent = data.role || 'Staff';
                
                const loginEl = document.getElementById('view-login');
                if (loginEl) { 
                    loginEl.classList.add('hidden'); 
                    loginEl.style.display = 'none';
                }
                
                this.updateUIPermissions();
                this.updateRoleOptions();
                
                // Cargar eventos antes de navegar
                try {
                    // Limpiar estado guardado para que todos vayan a "Mis Eventos" después de login
                    sessionStorage.removeItem('app-view-state');
                    await this.loadEvents();
                    await this.handleInitialNavigation();
                } catch (err) {
                    console.warn('[AUTH] Error loading events, navigating to my-events:', err);
                    this.navigate('my-events');
                }

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

    // Agenda
    loadEventAgenda: async function(eventId) {
        try {
            const agenda = await this.fetchAPI(`/events/${eventId}/agenda`);
            // Verificar que agenda sea un array válido
            if (!Array.isArray(agenda)) {
                console.warn('Agenda response is not an array:', agenda);
                this.state.eventAgenda = [];
                this.renderEventAgenda([]);
                return;
            }
            this.state.eventAgenda = agenda;
            this.renderEventAgenda(agenda);
        } catch (e) { 
            console.error('Error loading agenda:', e); 
            this.state.eventAgenda = [];
            this.renderEventAgenda([]);
        }
    },
    
    renderEventAgenda: function(agenda) {
        const container = document.getElementById('config-agenda-list');
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
        const container = document.getElementById('config-agenda-list');
        if (!container) {
            console.warn('[addAgendaItem] Container not found');
            return;
        }
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
        
        document.querySelectorAll('#config-agenda-list .agenda-item').forEach(div => {
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
        console.log('[VIEW] showView llamado:', viewName);
        
        // PREVENIR ejecuciones múltiples
        if (this._showingView === viewName) {
            return;
        }
        this._showingView = viewName;
        
        // Mapear y mostrar
        let targetId = "view-" + viewName;
        if (['legal', 'account'].includes(viewName)) targetId = "view-system";
        
        // Si la vista objetivo ya está visible, no hacer nada
        const target = document.getElementById(targetId);
        if (target && !target.classList.contains('hidden')) {
            this._showingView = null;
            return;
        }
        
        if (viewName === 'login') {
            const loginEl = document.getElementById('view-login');
            if (loginEl) {
                loginEl.classList.remove('hidden');
                loginEl.style.display = 'flex';
            }
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.classList.add('hidden');
                appContainer.style.display = 'none';
            }
            if (clearSession) { window.LS.remove('user'); this.state.user = null; }
            return;
        } else {
            const loginEl = document.getElementById('view-login');
            const appContainer = document.getElementById('app-container');
            
            
            if (loginEl) {
                loginEl.classList.add('hidden');
                loginEl.style.display = 'none';
            }
            
            if (appContainer) {
                appContainer.classList.remove('hidden');
                appContainer.style.display = 'flex';
            } else {
                console.error('[VIEW] ERROR: app-container no encontrado!');
            }
        }

        // Ocultar todas las secciones del app-shell
        const viewIds = ["view-my-events", "view-admin", "view-event-config", "view-system", "view-groups", "view-smtp", "view-pre-registrations", "view-survey-manager"];
        viewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        // Mostrar la vista objetivo, o my-events por defecto
        let viewToShow = target;
        if (!viewToShow) {
            console.warn(`[VIEW] Vista "${viewName}" no encontrada, mostrando "my-events" por defecto`);
            viewToShow = document.getElementById('view-my-events');
        }
        
        if (viewToShow) {
            viewToShow.classList.remove('hidden');
            console.log(`[VIEW] Mostrando: ${viewToShow.id}`);
            
            // V12.44.363: Si es admin o event-config, cargar attendance
            if ((viewName === 'admin' || viewName === 'event-config') && this.state.event && this.state.event.id) {
                console.log('[VIEW] EVENT DETECTED - loading attendance for:', this.state.event.id);
                if (typeof this.loadAttendance === 'function') {
                    this.loadAttendance(this.state.event.id);
                }
            }
        } else {
            console.error('[VIEW] ERROR: No se pudo encontrar ninguna vista para mostrar!');
        }

        // OCULTAR SIDEBAR DE EVENTO si no es admin o event-config
        if (viewName !== 'admin' && viewName !== 'event-config') {
            const navSectionEvent = document.getElementById('nav-section-event');
            if (navSectionEvent) navSectionEvent.classList.add('hidden');
        }

        // UI Sidebar - actualizar estado activo para sub-nav-btns
        document.querySelectorAll('#global-sidebar .sub-nav-btn').forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-view') === viewName || b.getAttribute('data-tab') === viewName) {
                b.classList.add('active');
            }
        });

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let btnId = 'nav-btn-' + viewName;
        if (viewName === 'system') btnId = 'nav-btn-system';
        if (viewName === 'legal') btnId = 'nav-btn-legal';
        if (viewName === 'account') btnId = 'nav-btn-account';
        if (viewName === 'smtp') btnId = 'nav-btn-smtp';
        if (viewName === 'event-config') btnId = 'nav-btn-event-config';
        if (viewName === 'my-events') btnId = 'nav-btn-my-events';
        
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');

        window.scrollTo(0, 0);
        
        // Resetear flag de navegación después de un breve delay
        setTimeout(() => {
            this._showingView = null;
        }, 100);
    },

    navigate(viewName, params = {}, push = true) {
        
        // Prevenir navegación múltiple simultánea
        if (this._navigating) {
            return;
        }
        
        try {
            this._navigating = true;
        
        // Resetear bandera de navegación inicial cuando navegamos manualmente
        if (viewName !== 'login') {
            this._hasHandledInitialNav = true;
        }
        
        if (push) {
            this._isPushingState = true;
            let url = viewName === 'my-events' ? '/' : `/${viewName}`;
            if (viewName === 'admin' && params.id) url = `/admin/${params.id}`;
            if (viewName === 'system' && params.tab) url = `/system/${params.tab}`;
            if (viewName === 'event-config' && params.id) url = `/event-config/${params.id}`;
            
            // Si estamos en system y no hay tab en params pero la URL actual tiene tab,
            // usar el tab de la URL actual
            if (viewName === 'system' && !params.tab && window.location.pathname.startsWith('/system/')) {
                const tabFromUrl = window.location.pathname.split('/')[2];
                if (tabFromUrl && ['users', 'groups', 'legal', 'email', 'account'].includes(tabFromUrl)) {
                    url = `/system/${tabFromUrl}`;
                    params.tab = tabFromUrl; // Actualizar params también
                    console.log('[NAV] Updated URL and params from current path:', tabFromUrl);
                }
            }
            
            history.pushState({ view: viewName, params }, '', url);
            setTimeout(() => { this._isPushingState = false; }, 100);
        }

        this.showView(viewName);
        
        // Guardar en AMBOS localStorage y sessionStorage para persistencia en refresh
        LS.set('active_view', viewName);
        // Usar nuestra nueva función saveViewState que incluye el rol del usuario
        this.saveViewState(viewName, params);
        
        // Guardar evento actual si estamos en admin o event-config
        if ((viewName === 'admin' || viewName === 'event-config') && this.state.event?.id) {
            LS.set('active_event_id', this.state.event.id);
            console.log('[NAV] Saved active event id:', this.state.event.id);
        }
        
        // Lógica específica por vista (V12.6.0 Unified Hub)
        if (viewName === 'my-events') this.loadEvents(false); // false = usar cache si está disponible
        if (viewName === 'system') {
            // Ocultar pestañas.restringidas después de un pequeño delay para asegurar DOM listo
            setTimeout(() => {
                this.hideRestrictedSystemTabs();
            }, 100);
            
            // Determinar qué pestaña mostrar:
            // 1. Primero, usar el parámetro 'tab' si existe
            // 2. Si no, extraer de la URL actual (/system/email, /system/legal, etc.)
            // 3. Si no hay nada, usar 'users' por defecto
            let tabToShow = params.tab;
            
            if (!tabToShow && window.location.pathname.startsWith('/system/')) {
                const tabFromUrl = window.location.pathname.split('/')[2];
                if (tabFromUrl && ['users', 'groups', 'legal', 'email', 'account'].includes(tabFromUrl)) {
                    tabToShow = tabFromUrl;
                    console.log('[NAV] Extracted tab from URL for system view:', tabToShow);
                }
            }
            
            window.switchSystemTab(tabToShow || 'users');
        }
        
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

                    // MOSTRAR SIDEBAR DE EVENTO
                    const navSectionEvent = document.getElementById('nav-section-event');
                    if (navSectionEvent) {
                        navSectionEvent.classList.remove('hidden');
                        const navEventName = document.getElementById('nav-event-name');
                        if (navEventName) navEventName.textContent = event.name;
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
        
        // Event Config View - Similar to admin but focused on settings
        if (viewName === 'event-config') {
            
            const id = params.id || (this.state.event ? this.state.event.id : null);
            if (id) {
                console.log('[NAV] Looking for event with id:', id);
                
                // Buscar el evento si no está establecido o si es diferente
                if (!this.state.event || String(this.state.event.id) !== String(id)) {
                    console.log('[NAV] Event not set or different, searching in events list');
                    if (this.state.events && Array.isArray(this.state.events)) {
                        const foundEvent = this.state.events.find(e => String(e.id) === String(id));
                        if (foundEvent) {
                            console.log('[NAV] Event found in list:', foundEvent.name);
                            this.state.event = foundEvent;
                        } else {
                            console.warn('[NAV] Event not found in events list, redirecting to my-events');
                            this.navigate('my-events');
                            return;
                        }
                    } else {
                        console.warn('[NAV] Events list not available, redirecting to my-events');
                        this.navigate('my-events');
                        return;
                    }
                }
                
                // A este punto, this.state.event debería estar establecido
                if (this.state.event) {
                    const event = this.state.event;
                    console.log('[NAV] Setting up event-config for event:', event.name);
                    
                    // Actualizar título del evento
                    const titleEl = document.getElementById('config-event-title');
                    if (titleEl) titleEl.textContent = event.name;
                    
                    // Actualizar fecha del evento
                    const dateEl = document.getElementById('config-event-date');
                    if (dateEl && event.date) {
                        const eventDate = new Date(event.date);
                        const formattedDate = eventDate.toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                        });
                        dateEl.textContent = formattedDate;
                    }
                    
                    // Actualizar logo
                    const logoImg = document.getElementById('config-event-logo');
                    const logoPlaceholder = document.getElementById('config-event-logo-placeholder');
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
                    
                    // MOSTRAR SIDEBAR DE EVENTO
                    const navSectionEvent = document.getElementById('nav-section-event');
                    if (navSectionEvent) {
                        navSectionEvent.classList.remove('hidden');
                        const navEventName = document.getElementById('nav-event-name');
                        if (navEventName) navEventName.textContent = event.name;
                    }
                    
                    // Cargar pestaña activa guardada
                    const activeTab = sessionStorage.getItem('active_config_tab') || 'staff';
                    console.log('[NAV] Restoring active config tab:', activeTab);
                    this.switchConfigTab(activeTab);
                } else {
                    console.error('[NAV] Critical: this.state.event is null after search, redirecting to my-events');
                    this.navigate('my-events');
                }
            } else {
                console.warn('[NAV] No event id provided for event-config, redirecting to my-events');
                this.navigate('my-events');
            }
        }

        if (viewName === 'groups') this.loadGroups();
        if (viewName === 'pre-registrations') this.loadPreRegistrations();
        if (viewName === 'survey-manager') this.loadSurveyQuestions();
        

        
        } finally {
            // Resetear bandera de navegación SIEMPRE
            this._navigating = false;
        }
    },

    initRouter() {
        console.log('[ROUTER] initRouter called');
        
        // Resetear bandera cuando se inicializa el router
        this._hasHandledInitialNav = false;
        
        // Manejar navegación con el historial
        window.onpopstate = async (e) => {
            console.log('[ROUTER] onpopstate triggered', 'e.state:', e.state, 'this._isPushingState:', this._isPushingState);
            
            // Ignorar si estamos en medio de un pushState
            if (this._isPushingState) return;
            
            // Si hay estado en el historial, usarlo
            if (e.state && e.state.view) {
                console.log('[ROUTER] Navigating from history state:', e.state.view);
                this.navigate(e.state.view, e.state.params || {}, false);
            } 
            // DESACTIVAR navegación inicial automática - ya se maneja en initApp
            else if (!this._hasHandledInitialNav) {
                console.log('[ROUTER] Navegación inicial desactivada (ya se maneja en initApp)');
                // this.handleInitialNavigation(); // Desactivado
                this._hasHandledInitialNav = true; // Marcar como manejado
            }
            // Si ya manejamos la navegación inicial pero no hay estado, usar la URL actual
            else {
                console.log('[ROUTER] Already handled initial nav, parsing current URL');
                await this.handleInitialNavigation();
            }
        };
        
        // Algunos navegadores disparan popstate al cargar la página
        // Esperar un momento antes de permitir handleInitialNavigation desde popstate
        setTimeout(() => {
            console.log('[ROUTER] Router initialization complete');
        }, 100);
    },

    async handleInitialNavigation() {
        // Evitar múltiples llamadas
        if (this._hasHandledInitialNav) {
            console.log('[ROUTER] handleInitialNavigation already called, skipping');
            return;
        }
        
        console.log('[ROUTER] handleInitialNavigation called');
        
        const path = window.location.pathname;
        
        // Verificar autenticación
        const user = this.state.user;
        if (!user) {
            console.log('[ROUTER] No user, showing login');
            this.showView('login');
            return;
        }
        
        const userRole = user.role;
        console.log('[ROUTER] User role:', userRole);
        
        // Cargar eventos si no están cargados (necesario para restaurar vistas de evento)
        if (!this.state.events || this.state.events.length === 0) {
            console.log('[ROUTER] Loading events for navigation...');
            try {
                await this.loadEvents(true); // true = forzar recarga
                console.log('[ROUTER] Events loaded successfully, count:', this.state.events?.length || 0);
            } catch (e) {
                console.warn('[ROUTER] Error loading events:', e);
                // Si falla la carga, intentar usar cache
                if (this._eventsCache && Array.isArray(this._eventsCache)) {
                    console.log('[ROUTER] Using cached events as fallback');
                    this.state.events = this._eventsCache;
                } else {
                    console.warn('[ROUTER] No cached events available, using empty array');
                    this.state.events = [];
                }
            }
        } else {
            console.log('[ROUTER] Events already loaded, count:', this.state.events.length);
        }
        
        // ESTRATEGIA MEJORADA: Prioridad de restauración con validación de permisos
        // 1. Intentar restaurar desde sessionStorage (con validación de rol)
        // 2. Si no hay o no es válido, usar vista por defecto según rol
        
        let targetView = null;
        let targetParams = {};
        let useDefaultView = false;
        
        // 1. Intentar desde sessionStorage (nuevo sistema con validación de rol)
        const savedState = this.loadViewState();
        if (savedState) {
            console.log('[ROUTER] Found saved state:', savedState);
            
            // Validar que el rol guardado coincida con el rol actual
            if (savedState.role && savedState.role !== userRole) {
                console.log('[ROUTER] Role changed, discarding saved state');
                this.clearViewState();
                useDefaultView = true;
            }
            // Validar permisos para la vista guardada
            const hasPermission = this.hasPermissionForView(userRole, savedState.view, savedState.params?.tab);
            if (!hasPermission) {
                console.log('[ROUTER] No permission for saved view:', savedState.view);
                useDefaultView = true;
            }
            // Solo usar sessionStorage si la URL es raíz o compatible
            // Para vistas de evento, también permitir URLs como /event-config/123 o /admin/456
            // Para vistas del sistema, permitir URLs como /system/email, /system/legal, etc.
            const isRootOrViewPath = path === '/' || path === '/' + savedState.view;
            const isEventViewPath = (savedState.view === 'event-config' && path.startsWith('/event-config/')) ||
                                   (savedState.view === 'admin' && path.startsWith('/admin/'));
            const isSystemViewPath = (savedState.view === 'system' && path.startsWith('/system/'));
            
            if (isRootOrViewPath || isEventViewPath || isSystemViewPath) {
                targetView = savedState.view;
                targetParams = savedState.params || {};
                
                // CRÍTICO: Si estamos en system y la URL tiene un tab diferente al guardado,
                // usar el tab de la URL y actualizar el estado guardado
                if (savedState.view === 'system' && path.startsWith('/system/')) {
                    const tabFromUrl = path.split('/')[2]; // Obtener "email", "legal", etc.
                    if (tabFromUrl && ['users', 'groups', 'legal', 'email', 'account'].includes(tabFromUrl)) {
                        // Si el tab de la URL es diferente al guardado, usar el de la URL
                        if (savedState.params?.tab !== tabFromUrl) {
                            console.log('[ROUTER] URL tab differs from saved tab. URL:', tabFromUrl, 'Saved:', savedState.params?.tab);
                            console.log('[ROUTER] Using URL tab and updating saved state');
                            targetParams.tab = tabFromUrl;
                            
                            // Actualizar inmediatamente el estado guardado para sincronizar
                            setTimeout(() => {
                                this.saveViewState('system', { tab: tabFromUrl });
                            }, 100);
                        } else {
                            console.log('[ROUTER] URL tab matches saved tab:', tabFromUrl);
                            targetParams.tab = tabFromUrl;
                        }
                    }
                }
                
                console.log('[ROUTER] Using saved state from sessionStorage');
            } else {
                console.log('[ROUTER] URL mismatch, not using saved state. Path:', path, 'saved view:', savedState.view);
                useDefaultView = true;
            }
        } else {
            console.log('[ROUTER] No saved state found');
            useDefaultView = true;
        }
        
        // 2. Si necesitamos vista por defecto, obtener según rol
        if (useDefaultView || !targetView || targetView === 'login') {
            const defaultView = this.getDefaultViewByRole(userRole);
            targetView = defaultView.view;
            targetParams = defaultView.tab ? { tab: defaultView.tab } : {};
            console.log('[ROUTER] Using default view for role', userRole, ':', targetView);
        }
        
        // 3. Validación final de permisos (seguridad extra)
        if (!this.hasPermissionForView(userRole, targetView, targetParams?.tab)) {
            console.warn('[ROUTER] Security check failed, falling back to safe view');
            const safeView = this.getDefaultViewByRole(userRole);
            targetView = safeView.view;
            targetParams = safeView.tab ? { tab: safeView.tab } : {};
        }
        
        console.log('[ROUTER] Final target - view:', targetView, 'params:', targetParams, 'role:', userRole);
        
        // PREPARACIÓN ESPECIAL PARA VISTAS DE EVENTO
        // Si estamos restaurando una vista de evento, necesitamos cargar el evento primero
        if ((targetView === 'admin' || targetView === 'event-config') && savedState?.eventId) {
            console.log('[ROUTER] Preparing to restore event view with eventId:', savedState.eventId);
            
            // Buscar el evento en la lista de eventos del usuario
            const eventId = savedState.eventId;
            let event = null;
            
            if (this.state.events && Array.isArray(this.state.events)) {
                event = this.state.events.find(e => String(e.id) === String(eventId));
            }
            
            if (event) {
                console.log('[ROUTER] Event found, setting as current event:', event.name);
                this.state.event = event;
                
                // Si hay pestaña de evento guardada, agregarla a los params
                if (savedState.eventTab && savedState.eventTabType) {
                    console.log('[ROUTER] Restoring event tab:', savedState.eventTab, 'type:', savedState.eventTabType);
                    
                    // Para event-config, guardar la pestaña activa en sessionStorage
                    if (savedState.eventTabType === 'config') {
                        sessionStorage.setItem('active_config_tab', savedState.eventTab);
                    }
                    // Para admin, guardar la pestaña activa en sessionStorage
                    else if (savedState.eventTabType === 'admin') {
                        sessionStorage.setItem('active_event_tab', savedState.eventTab);
                    }
                }
                
                // Asegurar que el ID del evento esté en los params
                if (!targetParams.id) {
                    targetParams.id = eventId;
                }
                
                console.log('[ROUTER] Event restoration complete, params:', targetParams);
            } else {
                console.warn('[ROUTER] Event not found in user events list, eventId:', eventId);
                console.warn('[ROUTER] Falling back to default view');
                // Si el evento no existe, usar vista por defecto
                const defaultView = this.getDefaultViewByRole(userRole);
                targetView = defaultView.view;
                targetParams = defaultView.tab ? { tab: defaultView.tab } : {};
            }
        }
        
        // Navegar a la vista determinada
        this.navigate(targetView, targetParams, false);
        this._hasHandledInitialNav = true;
    },

    // --- AUTH ---
    async fetchAPI(endpoint, options = {}) { return API.fetchAPI(endpoint, options); },
    logout() {
        console.log("CHECK: Cerrando sesión segura.");
        LS.remove('user');
        LS.remove('selected_event_id');
        LS.remove('selected_event_name');
        // Limpiar sessionStorage usando nuestra función
        this.clearViewState();
        this.state.user = null;
        this.state.event = null;
        // Remover app-shell si existe
        const appShell = document.getElementById('app-container');
        if (appShell) appShell.remove();
        this.showView('login', true);
    },
    
    // --- APP SHELL LOADER ---
    loadAppShell() {
        console.log('[APP-SHELL] Cargando app-shell.html...');
        // Forzar carga fresca con timestamp para evitar caché
        const timestamp = new Date().getTime();
        return fetch(`/html/app-shell.html?t=${timestamp}&v=${VERSION}`)
            .then(r => r.text())
            .then(html => {
                console.log('[APP-SHELL] HTML recibido, longitud:', html.length);
                document.body.insertAdjacentHTML('beforeend', html);
                console.log('[APP-SHELL] app-shell.html cargado exitosamente (oculto)');
                
                // Verificar que los elementos críticos existen
                const appContainer = document.getElementById('app-container');
                const sidebar = document.getElementById('global-sidebar');
                console.log('[APP-SHELL] app-container encontrado:', !!appContainer);
                console.log('[APP-SHELL] sidebar encontrado:', !!sidebar);
                
                this.initTheme();
                this.initSidebar();
                this.attachAppListeners(); // ¡IMPORTANTE! Configurar event listeners
                console.log('[APP-SHELL] Listeners adjuntados correctamente');
            })
            .catch(e => console.error('[APP-SHELL] Error cargando app-shell:', e));
    },
    
    attachAppListeners() {
        // Helpers
        const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        const sf = (id, fn) => { 
            const el = document.getElementById(id); 
            console.log(`[EVENT LISTENER] Registering submit listener for form: ${id}, element found: ${!!el}`);
            if (el) {
                // Solo permitir submit si el formulario está dentro de un modal visible
                const submitHandler = (e) => { 
                    const modal = el.closest('.modal-container, [id^="modal-"]');
                    const isModalVisible = modal && !modal.classList.contains('hidden');
                    
                    console.log(`[FORM SUBMIT] Form ${id} submitted`);
                    console.log(`[FORM SUBMIT] Submitter:`, e.submitter);
                    console.log(`[FORM SUBMIT] Modal visible:`, isModalVisible);
                    console.log(`[FORM SUBMIT] Modal element:`, modal);
                    console.log(`[FORM SUBMIT] Modal classes:`, modal?.classList);
                    console.log(`[FORM SUBMIT] Modal id:`, modal?.id);
                    
                    e.preventDefault(); 
                    
                    // Solo procesar si el modal está visible
                    if (isModalVisible) {
                        fn(e);
                    } else {
                        console.error(`[FORM SUBMIT] Form ${id} is inside hidden modal, ignoring submit`);
                    }
                };
                
                el.addEventListener('submit', submitHandler); 
            }
        };
        const hideModal = (id) => { 
            const m = document.getElementById(id); 
            if (m) { 
                // Quitar foco de todos los elementos interactivos antes de cerrar
                const focusableElements = m.querySelectorAll('input, button, select, textarea, a[href]');
                focusableElements?.forEach(el => {
                    el.blur();
                    el.setAttribute('tabindex', '-1');
                });
                // Quitar foco del body
                document.body.focus();
                // Ocultar modal - clase hidden Y limpiar style display
                m.classList.add('hidden');
                m.style.display = '';
                m.removeAttribute('aria-hidden');
            } 
        };
        
        // Mostrar versión del servidor al cargar (usar función unificada)
        this.loadAppVersion();

        // Inicializar handlers de Importar/Exportar (V12.44.38)
        this.initImportHandlers();
        this.initExportHandlers();

        // Actualizar tema después de cargar app-shell
        this.initTheme();
        // initSidebar() ya se llama en loadAppShell()
        
        // Navigation - Sidebar (Unified V12.6.0)
        cl('btn-toggle-sidebar', () => this.toggleSidebar());
        cl('nav-btn-my-events', () => this.navigate('my-events'));
        cl('nav-btn-admin', () => {
            const eventId = this.state.event?.id;
            if (eventId) {
                this.navigate('admin', { id: eventId });
            } else {
                this.navigate('my-events');
            }
        });
        cl('nav-btn-event-config', () => {
            const eventId = this.state.event?.id;
            if (eventId) {
                this.navigate('event-config', { id: eventId });
            } else {
                this.navigate('my-events');
            }
        });
        cl('nav-btn-system', () => this.navigate('system', { tab: 'users' }));
        
        // Sidebar footer
        cl('btn-toggle-theme', () => this.toggleTheme());
        cl('btn-logout', () => this.logout());
        
        // Mis Eventos - Acciones
        cl('btn-new-event-full', () => this.navigateToCreateEvent('full'));
        cl('btn-new-event-full-empty', () => this.navigateToCreateEvent('full'));
        
        // Cerrar sugerencias al hacer click fuera
        document.addEventListener('click', (e) => {
            const suggestions = document.getElementById('event-suggestions');
            const searchInput = document.getElementById('event-search');
            if (suggestions && !suggestions.contains(e.target) && e.target !== searchInput) {
                this.hideEventSuggestions();
            }
        });
        
        // Event Config view - action buttons
        cl('btn-config-show-qr', () => this.showQR());
        cl('btn-config-export-excel', () => this.exportExcel());
        cl('btn-create-event-open', () => this.openCreateEventModal());
        cl('btn-create-group', () => this.openCompanyModal());
        
        // Link de registro en Ajustes
        cl('btn-copy-reg-link', () => {
            const link = document.getElementById('evs-registration-link')?.value;
            if (link) {
                navigator.clipboard.writeText(link).then(() => {
                    this._notifyAction('Copiado', 'Link copiado al portapapeles', 'success');
                });
            }
        });
        cl('btn-open-reg-link', () => {
            const link = document.getElementById('evs-registration-link')?.value;
            if (link) window.open(link, '_blank');
        });
        
        // System tabs (Unified 5-Tab Hub)
        cl('sys-nav-users', () => window.switchSystemTab('users'));
        cl('sys-nav-groups', () => window.switchSystemTab('groups'));
        cl('sys-nav-legal', () => window.switchSystemTab('legal'));
        cl('sys-nav-email', () => window.switchSystemTab('email'));
        cl('sys-nav-account', () => window.switchSystemTab('account'));
        cl('sys-nav-db', () => window.switchSystemTab('db'));
        
        cl('btn-open-invite', () => this.openInviteModal());
        
        // Event Creation (Full Form) - NO registrar listener aquí, se registrará cuando se abra el modal
        
        // Profile Security Forms (Phase 5)
        sf('profile-form', (e) => this.handleEmailChange(e));
        sf('password-form', (e) => this.handlePasswordChange(e));
        sf('invite-user-form', (e) => this.handleInviteSubmit(e));
        sf('company-form', (e) => this.handleCompanySubmit(e));
        
        // Modales de creación (diseño igual al de empresa)
        cl('btn-close-create-client', () => this.closeCreateClientModal());
        sf('create-client-form', (e) => this.handleCreateClientSubmit(e));
        
        cl('btn-close-create-staff', () => this.closeCreateStaffModal());
        sf('create-staff-form', (e) => this.handleCreateStaffSubmit(e));
        
        cl('btn-close-create-event', () => this.closeCreateEventModal());
        sf('create-event-form', (e) => this.handleCreateEventSubmit(e));
        
        // Event Tabs (Panel de Control - solo Invitados)
        cl('ev-nav-guests', () => window.switchEventTab('guests'));
        // Personal, Email y Agenda ahora en Configuración del Evento
        cl('btn-ev-staff-exist', () => window.App.showUserSelectorForEvent(window.App.state.event.id));
        cl('btn-ev-staff-new', () => this.openInviteModal());
        
        // Event Config Tabs
        cl('config-nav-staff', () => this.switchConfigTab('staff'));
        cl('config-nav-email', () => this.switchConfigTab('email'));
        cl('config-nav-agenda', () => this.switchConfigTab('agenda'));
        cl('config-nav-wheel', () => this.switchConfigTab('wheel'));
        cl('config-nav-pre-registrations', () => this.switchConfigTab('pre-registrations'));
        cl('config-nav-surveys', () => this.switchConfigTab('surveys'));
        cl('config-nav-settings', () => this.switchConfigTab('settings'));
        cl('btn-config-save-settings', () => this.saveConfigSettings());
        
        // Wizard de campañas - eventos
        document.querySelectorAll('input[name="wizard-send-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const scheduleContainer = document.getElementById('wizard-schedule-container');
                if (scheduleContainer) {
                    if (e.target.value === 'scheduled') {
                        scheduleContainer.classList.remove('hidden');
                    } else {
                        scheduleContainer.classList.add('hidden');
                    }
                }
                this.updateWizardSummary();
            });
        });
        
        document.querySelectorAll('input[name="wizard-recipient-type"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateWizardSummary());
        });
        
        document.getElementById('wizard-campaign-name')?.addEventListener('input', () => this.updateWizardSummary());
        document.getElementById('wizard-email-subject')?.addEventListener('input', () => this.updateWizardSummary());
        
        // Ruleta de Sorteos - botones
        cl('btn-new-wheel', () => this.createNewWheel()); // Unificado (antes btn-create-wheel)
        cl('btn-back-to-wheels', () => this.backToWheelsList());
        cl('btn-save-wheel', () => this.saveWheel());
        cl('btn-delete-wheel', () => this.deleteWheel());
        cl('btn-add-from-guests', () => this.showAddParticipantsModal());
        cl('btn-add-from-checkedin', () => this.showAddParticipantsModal());
        cl('btn-add-from-preregistered', () => this.showAddParticipantsModal());
        cl('btn-add-manual', () => this.showManualParticipantsModal());
        cl('btn-preview-wheel', () => this.previewWheel());
        cl('btn-copy-wheel-url', () => {
            const url = document.getElementById('wheel-share-url')?.value;
            if (url) {
                navigator.clipboard.writeText(url).then(() => {
                    this._notifyAction('Copiado', 'URL copiada al portapapeles', 'success');
                });
            }
        });
        cl('btn-delete-all-results', () => this.deleteAllWheelResults());
        
        // Pre-registros
        cl('btn-import-pre-registrations', () => {
            const input = document.getElementById('input-import-file-prereg');
            if (input) input.click();
            else {
                // Fallback al input general si no existe el específico
                document.getElementById('input-import-file')?.click();
            }
        });

        // Encuestas
        cl('btn-create-survey', () => this.openSurveyEditor());

        // Agenda
        cl('btn-add-agenda-item', () => this.addAgendaItem());
        
        // Event Config botones (Staff)
        cl('btn-config-staff-exist', () => this.showUserSelectorForEvent(this.state.event?.id));
        cl('btn-config-staff-new', () => this.openInviteModal());
        
        // Toggle password visibility
        cl('btn-toggle-password', () => {
            const pwd = document.getElementById('invite-password');
            const btn = document.getElementById('btn-toggle-password');
            if (pwd.type === 'password') {
                pwd.type = 'text';
                btn.innerHTML = '<span class="material-symbols-outlined text-sm">visibility_off</span>';
            } else {
                pwd.type = 'password';
                btn.innerHTML = '<span class="material-symbols-outlined text-sm">visibility</span>';
            }
        });

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
        cl('btn-close-company', () => this.closeCompanyModal());
        cl('btn-close-create-client', () => this.closeCreateClientModal());
        cl('btn-close-create-staff', () => this.closeCreateStaffModal());
        cl('btn-close-create-event', () => this.closeCreateEventModal());
        cl('btn-close-qr', () => hideModal('modal-qr'));
        cl('btn-close-ticket', () => hideModal('modal-ticket'));
        cl('btn-close-import-results', () => hideModal('modal-import-results'));
        cl('btn-close-import-results-2', () => hideModal('modal-import-results'));
        cl('btn-stop-scanner', () => this.stopScanner());
        cl('btn-start-scan', () => this.startScanner());
        cl('btn-manual-checkin', () => this.manualCheckin());
        cl('btn-close-template-editor', () => this.closeTemplateEditor());
        cl('btn-cancel-template', () => this.closeTemplateEditor());
        cl('btn-close-survey-editor', () => this.closeSurveyEditor());
        cl('btn-cancel-survey', () => this.closeSurveyEditor());
        cl('btn-confirm-import', () => this.executeImport());
        cl('btn-cancel-event', () => hideModal('modal-event'));
        cl('btn-close-event-full-modal', () => hideModal('modal-event-full'));
        cl('btn-cancel-event-full', () => hideModal('modal-event-full'));
        cl('btn-cancel-invite', () => hideModal('modal-invite'));
        cl('btn-cancel-company', () => this.closeCompanyModal());
        cl('btn-visual-editor', () => this.switchTemplateEditorTab('visual'));
        cl('btn-html-editor', () => this.switchTemplateEditorTab('code'));

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
                    case 'insertVariable': _App.insertVariable(p.varName); break;
                    // Users management
                    case 'approveUser': _App.approveUser(p.userId, p.status); break;
                    case 'editUser': _App.editUser(p.userId); break;
                    case 'deleteUser': _App.deleteUser(p.userId, p.userName); break;
                    case 'removeUserGroup': _App.removeUserGroup(p.userId); break;
                    case 'showGroupSelector': _App.showGroupSelector(p.userId, p.groupId || ''); break;
                    case 'removeUserFromEvent': _App.removeUserFromEvent(p.userId, p.eventId); break;
                    case 'showEventSelector': 
                        let evs = [];
                        try { evs = JSON.parse(p.events || '[]'); } catch(e) { console.error("Error parsing events", e); }
                        _App.showEventSelector(p.userId, evs); 
                        break;
                    case 'assignUserGroupFromSelector': _App.assignUserGroupFromSelector(p.userId); break;
                    case 'editAccount': _App.openAccountEditor(p.accountId); break;
                    case 'deleteAccount': _App.deleteAccount(p.accountId, p.accountName); break;
                    case 'testAccountSMTP': _App.testAccountSMTP(p.accountId); break;
                    case 'navigateToCreateGroup': _App.navigateToCreateGroup(); break;
                    case 'closeGroupSelector': _App.closeGroupSelector(); break;
                    case 'navigateToCreateEvent': _App.navigateToCreateEvent(p.userId); break;
                    
                    // Email
                    case 'viewMailDetail': _App.viewMailDetail(p.mailId); break;
                    case 'insertVariable': _App.insertVariable(p.varName); break;
                    case 'showTemplateEditor': _App.showTemplateEditor(p.templateId, p.templateName); break;
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
                    case 'openRegistrationLink': _App.openRegistrationLink(p.eventId); break;
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
        
        // Poblar selector de empresa
        const groupSelect = document.getElementById('ev-group');
        if (groupSelect && this.state.allGroups) {
            const currentVal = groupSelect.value;
            groupSelect.innerHTML = '<option value="">Seleccionar empresa</option>' + 
                this.state.allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            groupSelect.value = currentVal;
        }
        
        const modal = document.getElementById('modal-event');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.removeAttribute('aria-hidden');
        }
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
            
            // Actualizar por clase (sistema nuevo)
            document.querySelectorAll('.app-version-label').forEach(el => el.innerText = `Check Pro V${d.version}`);
            document.querySelectorAll('.app-version-text').forEach(el => el.innerText = `V${d.version}`);
            
            // Actualizar por ID (backward compatibility)
            const versionDisplay = document.getElementById('version-display');
            if (versionDisplay) versionDisplay.textContent = `V${d.version}`;
            
            const loginVersionDisplay = document.getElementById('login-version-display');
            if (loginVersionDisplay) loginVersionDisplay.textContent = `v${d.version}`;
            
            // Actualizar versión en sidebar
            const appVersionDisplay = document.getElementById('app-version-display');
            if (appVersionDisplay) appVersionDisplay.textContent = `v${d.version}`;
            
            console.log(`[VERSION] Aplicación actualizada a V${d.version}`);
        } catch(e) {
            console.warn('[VERSION] Error al cargar versión:', e);
        }
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
            await this.fetchAPI(`/events/pre-registrations/${id}/status`, {
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
            const endpoint = id ? `/events/surveys/${id}` : `/events/${eventId}/surveys`;
            await this.fetchAPI(endpoint, { method, body: JSON.stringify(data) });
            document.getElementById('modal-survey-editor').classList.add('hidden');
            this.loadSurveyQuestions();
        } catch (e) { alert('Error al guardar la pregunta'); }
    },

    async deleteSurveyQuestion(id) {
        if (!confirm('¿Eliminar esta pregunta?')) return;
        try {
            await this.fetchAPI(`/events/surveys/${id}`, { method: 'DELETE' });
            this.loadSurveyQuestions();
        } catch (e) { alert('Error al eliminar'); }
    },

    exportSurveyResponses() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        window.open(`${this.constants.API_URL}/events/${eventId}/surveys/responses/export?userId=${this.state.user.userId}`, '_blank');
    },


    // --- DATA LOADERS ---
    _lastEventsLoad: 0,
    _eventsCache: null,
    _countdownInterval: null,
    _eventsFiltered: [],
    _selectedEvents: new Set(),
    
    async loadEvents(force = false) {
        const now = Date.now();
        const CACHE_DURATION = 30000;
        
        if (!force && this._eventsCache && (now - this._lastEventsLoad) < CACHE_DURATION) {
            this.state.events = this._eventsCache;
            this.renderEventsTable();
            this.updateSidebarVisibility();
            return;
        }
        
        try {
            const [eventsRes, clientsRes, groupsRes] = await Promise.all([
                this.fetchAPI('/events'),
                this.fetchAPI('/clients').catch(() => []),
                this.fetchAPI('/groups').catch(() => [])
            ]);
            
            if (Array.isArray(eventsRes)) {
                this.state.events = eventsRes;
                this._eventsCache = eventsRes;
                this._lastEventsLoad = now;
            } else {
                if (!this._eventsCache || !Array.isArray(this._eventsCache)) {
                    this._eventsCache = [];
                }
                this.state.events = this._eventsCache;
            }
            
            this.state.clients = Array.isArray(clientsRes) ? clientsRes : [];
            this.state.allGroups = Array.isArray(groupsRes) ? groupsRes : [];
            
            const btnAdminNav = document.getElementById('nav-btn-admin');
            if (btnAdminNav) {
                btnAdminNav.classList.toggle('hidden', !this.state.user || this.state.user.role !== 'ADMIN');
            }
            
            this.renderEventsTable();
            this.updateSidebarVisibility();
            this.startCountdownTimers();
        } catch (e) { 
            console.warn('[EVENTS] Error cargando eventos:', e);
            if (!this._eventsCache || !Array.isArray(this._eventsCache)) {
                this._eventsCache = [];
            }
            this.state.events = this._eventsCache;
            this.renderEventsTable();
        }
    },

    sortEventsTable(column) {
        const currentColumn = this.state.eventsSortColumn || null;
        const currentDirection = this.state.eventsSortDirection || 'asc';
        
        let direction = 'asc';
        if (column === currentColumn) {
            direction = currentDirection === 'asc' ? 'desc' : 'asc';
        }
        
        this.state.eventsSortColumn = column;
        this.state.eventsSortDirection = direction;
        
        document.querySelectorAll('#view-my-events th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            th.querySelector('.sort-icon').textContent = '⇅';
            th.querySelector('.sort-icon').classList.remove('opacity-100');
            th.querySelector('.sort-icon').classList.add('opacity-40');
        });
        
        const currentTh = document.querySelector(`#view-my-events th[data-sort="${column}"]`);
        if (currentTh) {
            currentTh.classList.add(direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
            currentTh.querySelector('.sort-icon').textContent = direction === 'asc' ? '↑' : '↓';
            currentTh.querySelector('.sort-icon').classList.remove('opacity-40');
            currentTh.querySelector('.sort-icon').classList.add('opacity-100');
        }
        
        if (!this._eventsFiltered) return;
        
        const statusOrder = { 'active': 1, 'upcoming': 2, 'completed': 3, 'draft': 4, 'cancelled': 5, 'inactive': 6 };
        
        this._eventsFiltered.sort((a, b) => {
            let valA, valB;
            
            switch (column) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                
                case 'date':
                    valA = new Date(a.date || 0).getTime();
                    valB = new Date(b.date || 0).getTime();
                    return direction === 'asc' ? valA - valB : valB - valA;
                
                case 'client':
                    valA = (a.client_names || '').toLowerCase();
                    valB = (b.client_names || '').toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                
                case 'location':
                    valA = (a.location || '').toLowerCase();
                    valB = (b.location || '').toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                
                case 'guests':
                    valA = a.total_guests || 0;
                    valB = b.total_guests || 0;
                    return direction === 'asc' ? valA - valB : valB - valA;
                
                case 'status':
                    const statusA = this._getEventStatus(a);
                    const statusB = this._getEventStatus(b);
                    valA = statusOrder[statusA] || 99;
                    valB = statusOrder[statusB] || 99;
                    return direction === 'asc' ? valA - valB : valB - valA;
                
                default:
                    return 0;
            }
        });
        
        const tbody = document.getElementById('events-tbody');
        if (!tbody) return;
        
        const userRole = this.state.user?.role;
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        const groupsMap = {};
        (this.state.allGroups || []).forEach(g => { groupsMap[g.id] = g.name; });
        
        tbody.innerHTML = this._eventsFiltered.map(ev => {
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const total = ev.total_guests || 0;
            const attended = ev.attended_guests || 0;
            const clientNames = ev.client_names ? ev.client_names.split(',').map(n => n.trim()).join(', ') : '—';
            const clientIds = ev.client_ids ? ev.client_ids.split(',').map(id => id.trim()) : [];
            const companyName = ev.group_id ? (groupsMap[ev.group_id] || '—') : '—';
            const location = ev.location || '—';
            const status = this._getEventStatus(ev);
            const statusBadge = this._getEventStatusBadge(status);
            const isChecked = this._selectedEvents.has(String(ev.id));
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors group/event" data-event-id="${ev.id}" data-client-ids="${clientIds.join(',')}">
                    <td class="!py-3 !px-3">
                        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleEventSelection('${ev.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-lg bg-gradient-to-br from-[#0ba5ec] to-blue-500/20 flex items-center justify-center flex-shrink-0 border border-[#0ba5ec]">
                                <span class="material-symbols-outlined text-[10px] text-[#0ba5ec]">event</span>
                            </div>
                            <div class="min-w-0">
                                <a href="#" onclick="event.preventDefault(); App.openEvent('${ev.id}')" class="text-sm font-bold text-white hover:text-[#0ba5ec] transition-colors truncate block">${ev.name}</a>
                                <span class="text-[10px] text-slate-500">${companyName !== '—' ? companyName : ''}</span>
                            </div>
                        </div>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs text-slate-300">${dateStr} <span class="text-slate-500">${timeStr}</span></div>
                        <div class="text-[10px] font-mono countdown-timer" data-event-date="${ev.date}" style="color: #a78bfa;">--</div>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-300">${clientNames}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-400 truncate block max-w-[150px]">${location}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs">
                            <span class="font-bold text-[#0ba5ec]">${total}</span><span class="text-slate-500"> / </span>
                            <span class="font-bold text-emerald-400">${attended}</span>
                        </div>
                        <div class="text-[10px] text-slate-500">Reg. / Asist.</div>
                    </td>
                    <td class="!py-3 !px-3">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Wrapper para usar el nuevo módulo TableManager
    renderEventsTable() {
        // Usar el nuevo módulo TableManager si está disponible
        if (typeof TableManager !== 'undefined') {
            let events = Array.isArray(this.state.events) ? this.state.events : [];
            
            // FILTRO: PRODUCTOR solo ve sus eventos
            if (this.state.user?.role === 'PRODUCTOR') {
                events = events.filter(e => e.user_id === this.state.user.userId);
            }
            
            // Actualizar filtros y subtítulo (código original)
            this._populateEventFilters(events);
            this._updateEventsSubtitle(events);
            
            // Usar el nuevo módulo para renderizar
            TableManager.renderEventsTable(events, 'events-table-container');
            return;
        }
        
        // Fallback al código original si TableManager no está disponible
        const tbody = document.getElementById('events-tbody');
        const emptyState = document.getElementById('events-empty-state');
        const tableContainer = document.querySelector('#view-my-events .card');
        
        if (!tbody) return;
        
        let events = Array.isArray(this.state.events) ? this.state.events : [];
        
        // FILTRO: PRODUCTOR solo ve sus eventos
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
        }
        
        // Guardar eventos filtrados para búsqueda
        this._eventsFiltered = [...events];
        
        // Actualizar selects de filtros
        this._populateEventFilters(events);
        
        // Actualizar subtítulo con info del usuario
        this._updateEventsSubtitle(events);
        
        // Mostrar/ocultar estado vacío
        if (events.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            if (emptyState) emptyState.style.display = 'flex';
            if (tableContainer) tableContainer.classList.add('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        if (emptyState) emptyState.style.display = 'none';
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        const userRole = this.state.user?.role;
        const canDelete = userRole === 'ADMIN' || userRole === 'PRODUCTOR';
        
        // Mapear clientes y grupos para lookup
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        const groupsMap = {};
        (this.state.allGroups || []).forEach(g => { groupsMap[g.id] = g.name; });
        
        tbody.innerHTML = events.map(ev => {
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const total = ev.total_guests || 0;
            const attended = ev.attended_guests || 0;
            // Clientes: ahora vienen como string comma-separated (client_ids, client_names)
            const clientNames = ev.client_names ? ev.client_names.split(',').map(n => n.trim()).join(', ') : '—';
            const clientIds = ev.client_ids ? ev.client_ids.split(',').map(id => id.trim()) : [];
            
            const companyName = ev.group_id ? (groupsMap[ev.group_id] || '—') : '—';
            const location = ev.location || '—';
            const status = this._getEventStatus(ev);
            const statusBadge = this._getEventStatusBadge(status);
            const isChecked = this._selectedEvents.has(String(ev.id));
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors group/event" data-event-id="${ev.id}" data-client-ids="${clientIds.join(',')}">
                    <td class="!py-3 !px-3">
                        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleEventSelection('${ev.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-lg bg-gradient-to-br from-[#0ba5ec] to-blue-500/20 flex items-center justify-center flex-shrink-0 border border-[#0ba5ec]">
                                <span class="material-symbols-outlined text-[10px] text-[#0ba5ec]">event</span>
                            </div>
                            <div class="min-w-0">
                                <a href="#" onclick="event.preventDefault(); App.openEvent('${ev.id}')" class="text-sm font-bold text-white hover:text-[#0ba5ec] transition-colors truncate block">${ev.name}</a>
                                <span class="text-[10px] text-slate-500">${companyName !== '—' ? companyName : ''}</span>
                            </div>
                        </div>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs text-slate-300">${dateStr} <span class="text-slate-500">${timeStr}</span></div>
                        <div class="text-[10px] font-mono countdown-timer" data-event-date="${ev.date}" style="color: #a78bfa;">--</div>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-300">${clientNames}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-400 truncate block max-w-[150px]">${location}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs">
                            <span class="font-bold text-[#0ba5ec]">${total}</span><span class="text-slate-500"> / </span>
                            <span class="font-bold text-emerald-400">${attended}</span>
                        </div>
                        <div class="text-[10px] text-slate-500">Reg. / Asist.</div>
                    </td>
                    <td class="!py-3 !px-3">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        }).join('');
    },

    _populateEventFilters(events) {
        // Filtro Cliente
        const clientFilter = document.getElementById('filter-event-client');
        if (clientFilter) {
            const clients = this.state.clients || [];
            const currentVal = clientFilter.value;
            clientFilter.innerHTML = '<option value="">Cliente</option>' + 
                clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            clientFilter.value = currentVal;
        }
        
        // Filtro Empresa
        const companyFilter = document.getElementById('filter-event-company');
        if (companyFilter) {
            const groups = this.state.allGroups || [];
            const currentVal = companyFilter.value;
            companyFilter.innerHTML = '<option value="">Empresa</option>' + 
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            companyFilter.value = currentVal;
        }
    },

    _updateEventsSubtitle(events) {
        const subtitle = document.getElementById('my-events-subtitle');
        if (!subtitle) return;
        
        const userRole = this.state.user?.role || '';
        const userName = this.state.user?.name || this.state.user?.email || '';
        
        if (this.state.user?.role === 'PRODUCTOR') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else if (this.state.user?.role === 'STAFF') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} asignado${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else if (this.state.user?.role === 'CLIENTE') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} en total — ${userName} (${userRole})`;
        }
    },

    _getEventStatus(ev) {
        const now = new Date();
        const eventDate = new Date(ev.date);
        const endDate = ev.end_date ? new Date(ev.end_date) : new Date(eventDate.getTime() + 8 * 60 * 60 * 1000);
        
        if (ev.status === 'cancelled') return 'cancelled';
        if (ev.status === 'draft') return 'draft';
        if (now > endDate) return 'completed';
        if (now >= eventDate && now <= endDate) return 'active';
        return 'upcoming';
    },

    _getEventStatusBadge(status) {
        const badges = {
            active: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Activo</span>',
            upcoming: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20"><span class="material-symbols-outlined text-[10px]">schedule</span>Próximo</span>',
            completed: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20"><span class="material-symbols-outlined text-[10px]">check_circle</span>Finalizado</span>',
            draft: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="material-symbols-outlined text-[10px]">edit_note</span>Borrador</span>',
            cancelled: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"><span class="material-symbols-outlined text-[10px]">cancel</span>Cancelado</span>'
        };
        return badges[status] || badges.draft;
    },

    startCountdownTimers() {
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
        }
        
        this._countdownInterval = setInterval(() => {
            const timers = document.querySelectorAll('.countdown-timer');
            const now = new Date();
            
            timers.forEach(timer => {
                const eventDate = new Date(timer.dataset.eventDate);
                const diff = eventDate - now;
                
                if (diff <= 0) {
                    timer.textContent = '🔴 En vivo';
                    timer.style.color = '#ef4444';
                    return;
                }
                
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (days > 0) {
                    timer.textContent = `⏳ ${days}d ${hours}h ${mins}m`;
                } else if (hours > 0) {
                    timer.textContent = `⏳ ${hours}h ${mins}m`;
                } else {
                    timer.textContent = `⏳ ${mins}m`;
                    timer.style.color = '#f59e0b';
                }
            });
        }, 30000); // Actualizar cada 30 segundos (sin segundos)
        
        // Ejecutar inmediatamente
        setTimeout(() => {
            const timers = document.querySelectorAll('.countdown-timer');
            const now = new Date();
            timers.forEach(timer => {
                const eventDate = new Date(timer.dataset.eventDate);
                const diff = eventDate - now;
                if (diff <= 0) {
                    timer.textContent = '🔴 En vivo';
                    timer.style.color = '#ef4444';
                } else {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    if (days > 0) {
                        timer.textContent = `⏳ ${days}d ${hours}h ${mins}m`;
                    } else if (hours > 0) {
                        timer.textContent = `⏳ ${hours}h ${mins}m`;
                    } else {
                        timer.textContent = `⏳ ${mins}m`;
                        timer.style.color = '#f59e0b';
                    }
                }
            });
        }, 100);
    },

    // ─── FILTRADO DE EVENTOS ───
    filterEvents() {
        const searchInput = document.getElementById('event-search');
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();
        const clientFilter = document.getElementById('filter-event-client')?.value || '';
        const statusFilter = document.getElementById('filter-event-status')?.value || '';
        let events = Array.isArray(this.state.events) ? [...this.state.events] : [];
        
        // Debug
        console.log('[filterEvents] searchTerm:', searchTerm, 'clientFilter:', clientFilter, 'statusFilter:', statusFilter, 'total events:', events.length);
        
        // FILTRO: PRODUCTOR solo ve sus eventos
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
            console.log('[filterEvents] after PRODUCTOR filter:', events.length);
        }
        
        // Filtro por búsqueda con normalización de texto (manejo de acentos)
        if (searchTerm) {
            // Normalizar: quitar acentos y convertir a lowercase
            const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const normalizedTerm = normalize(searchTerm);
            
            events = events.filter(ev => {
                const clientNames = ev.client_names || '';
                const groupName = (this.state.allGroups || []).find(g => g.id === ev.group_id)?.name || '';
                const searchable = normalize(`${ev.name} ${ev.location || ''} ${ev.description || ''} ${clientNames} ${groupName}`);
                return searchable.includes(normalizedTerm);
            });
            console.log('[filterEvents] after search filter:', events.length);
        }
        
        // Filtro por cliente
        if (clientFilter) {
            events = events.filter(ev => {
                const ids = ev.client_ids ? ev.client_ids.split(',').map(id => id.trim()) : [];
                return ids.some(id => String(id) === String(clientFilter));
            });
            console.log('[filterEvents] after client filter:', events.length);
        }
        
        // Filtro por estado
        if (statusFilter) {
            events = events.filter(ev => this._getEventStatus(ev) === statusFilter);
            console.log('[filterEvents] after status filter:', events.length);
        }
        
        console.log('[filterEvents] final events:', events.length);
        
        this._eventsFiltered = events;
        this._renderFilteredEvents(events);
    },

    _renderFilteredEvents(events) {
        const tbody = document.getElementById('events-tbody');
        const emptyState = document.getElementById('events-empty-state');
        const tableContainer = document.querySelector('#view-my-events .card');
        
        if (!tbody) return;
        
        if (events.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) { emptyState.classList.remove('hidden'); emptyState.style.display = 'flex'; }
            if (tableContainer) tableContainer.classList.add('hidden');
            return;
        }
        
        if (emptyState) { emptyState.classList.add('hidden'); emptyState.style.display = 'none'; }
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        const groupsMap = {};
        (this.state.allGroups || []).forEach(g => { groupsMap[g.id] = g.name; });
        
        tbody.innerHTML = events.map(ev => {
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const total = ev.total_guests || 0;
            const attended = ev.attended_guests || 0;
            const clientName = ev.client_id ? (clientsMap[ev.client_id] || '—') : '—';
            const clientNames = ev.client_names ? ev.client_names.split(',').map(n => n.trim()).join(', ') : '—';
            const location = ev.location || '—';
            const status = this._getEventStatus(ev);
            const statusBadge = this._getEventStatusBadge(status);
            const isChecked = this._selectedEvents.has(String(ev.id));
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors" data-event-id="${ev.id}">
                    <td class="!py-3 !px-3">
                        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleEventSelection('${ev.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-lg bg-gradient-to-br from-[#0ba5ec] to-blue-500/20 flex items-center justify-center flex-shrink-0 border border-[#0ba5ec]">
                                <span class="material-symbols-outlined text-[10px] text-[#0ba5ec]">event</span>
                            </div>
                            <div class="min-w-0">
                                <a href="#" onclick="event.preventDefault(); App.openEvent('${ev.id}')" class="text-sm font-bold text-white hover:text-[#0ba5ec] transition-colors truncate block">${ev.name}</a>
                            </div>
                        </div>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs text-slate-300">${dateStr} <span class="text-slate-500">${timeStr}</span></div>
                        <div class="text-[10px] font-mono countdown-timer" data-event-date="${ev.date}" style="color: #a78bfa;">--</div>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-300">${clientNames}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-400 truncate block max-w-[150px]">${location}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs">
                            <span class="font-bold text-[#0ba5ec]">${total}</span><span class="text-slate-500"> / </span>
                            <span class="font-bold text-emerald-400">${attended}</span>
                        </div>
                        <div class="text-[10px] text-slate-500">Reg. / Asist.</div>
                    </td>
                    <td class="!py-3 !px-3">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        }).join('');
    },

    // ─── SUGERENCIAS DEL BUSCADOR ───
    showEventSuggestions() {
        const input = document.getElementById('event-search');
        const dropdown = document.getElementById('event-suggestions');
        if (!input || !dropdown) return;
        
        const term = input.value.toLowerCase().trim();
        if (!term) { this.hideEventSuggestions(); return; }
        
        let events = Array.isArray(this.state.events) ? this.state.events : [];
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
        }
        
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        
        const suggestions = [];
        
        events.forEach(ev => {
            const clientName = ev.client_names || '';
            let score = 0;
            let matchType = '';
            
            if (ev.name.toLowerCase().includes(term)) { score = 100; matchType = 'Evento'; }
            else if (clientName.toLowerCase().includes(term)) { score = 80; matchType = 'Cliente'; }
            else if ((ev.location || '').toLowerCase().includes(term)) { score = 60; matchType = 'Locación'; }
            
            if (score > 0) {
                suggestions.push({ event: ev, score, matchType, clientName });
            }
        });
        
        suggestions.sort((a, b) => b.score - a.score);
        const top = suggestions.slice(0, 8);
        
        if (top.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-xs text-slate-500">Sin resultados</div>';
            dropdown.classList.remove('hidden');
            return;
        }
        
        dropdown.innerHTML = top.map(s => {
            const status = this._getEventStatus(s.event);
            const statusColor = status === 'active' ? 'text-emerald-400' : status === 'upcoming' ? 'text-blue-400' : 'text-slate-400';
            return `
                <div class="px-4 py-2.5 hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors" onclick="App.openEvent('${s.event.id}'); App.hideEventSuggestions();">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="material-symbols-outlined text-[#0ba5ec] text-sm flex-shrink-0">event</span>
                        <div class="min-w-0">
                            <div class="text-xs font-bold text-white truncate">${this._highlightText(s.event.name, term)}</div>
                            <div class="text-[10px] text-slate-500">${s.matchType}${s.clientName ? ' · ' + s.clientName : ''}</div>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold ${statusColor} flex-shrink-0 ml-2">${status === 'active' ? 'Activo' : status === 'upcoming' ? 'Próximo' : 'Finalizado'}</span>
                </div>
            `;
        }).join('');
        
        dropdown.classList.remove('hidden');
    },

    hideEventSuggestions() {
        const dropdown = document.getElementById('event-suggestions');
        if (dropdown) dropdown.classList.add('hidden');
    },

    clearEventSearch() {
        const searchInput = document.getElementById('event-search');
        const clientFilter = document.getElementById('filter-event-client');
        const statusFilter = document.getElementById('filter-event-status');
        
        if (searchInput) searchInput.value = '';
        if (clientFilter) clientFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        
        this.filterEvents();
        this.hideEventSuggestions();
    },

    _highlightText(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="text-[#0ba5ec] font-bold">$1</span>');
    },

    // ─── SELECCIÓN MÚLTIPLE DE EVENTOS ───
    toggleSelectAllEvents() {
        const checkbox = document.getElementById('select-all-events');
        const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
        
        if (checkbox.checked) {
            events.forEach(ev => this._selectedEvents.add(String(ev.id)));
        } else {
            this._selectedEvents.clear();
        }
        
        document.querySelectorAll('.event-checkbox').forEach(cb => {
            cb.checked = checkbox.checked;
        });
    },

    toggleEventSelection(eventId) {
        const id = String(eventId);
        if (this._selectedEvents.has(id)) {
            this._selectedEvents.delete(id);
        } else {
            this._selectedEvents.add(id);
        }
        
        // Actualizar select-all
        const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
        const allSelected = events.length > 0 && events.every(ev => this._selectedEvents.has(String(ev.id)));
        const selectAllCheckbox = document.getElementById('select-all-events');
        if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;
    },

    // ─── ACCIÓN DE EDICIÓN DE EVENTOS (CARRUSEL CON BARRA DE NAVEGACIÓN) ───
    openEventEditAction() {
        const selected = Array.from(this._selectedEvents);
        
        if (selected.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un evento con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
            }
            return;
        }
        
        // Abrir carrusel unificado con Editar + Gestionar
        this.openEventEditCarousel(selected);
    },

    // Carrusel unificado: Editar + Gestionar con barra de navegación
    openEventEditCarousel: async function(selectedIds) {
        // Asegurar que los datos de grupos y clientes estén cargados
        if (!this.state.allGroups?.length) {
            await this.loadGroups();
        }
        if (!this.state.clients?.length) {
            try {
                const clientsRes = await this.fetchAPI('/clients');
                this.state.clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes.data || []);
            } catch(e) { 
                console.error('[EVENT CAROUSEL] Error loading clients:', e);
                this.state.clients = []; 
            }
        }

        const events = selectedIds.map(id => this.state.events.find(e => String(e.id) === String(id))).filter(Boolean);
        if (events.length === 0) return;
        
        // Guardar estado del carrusel para navegación
        this._eventCarouselState = { 
            events, 
            currentIndex: 0, 
            currentTab: 0 
        };

        const renderCarousel = (notif = null) => {
            if (!this._eventCarouselState) return;
            
            const state = this._eventCarouselState;
            const ev = state.events[state.currentIndex];
            const activeTab = state.currentTab;
            
            const isDark = document.documentElement.classList.contains('dark');
            const bgMain = isDark ? '#0f172a' : '#f1f5f9';
            const bgCard = isDark ? '#1e293b' : '#ffffff';
            const textMain = isDark ? '#f8fafc' : '#1e293b';
            const textSecondary = isDark ? '#94a3b8' : '#475569';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
            
            const eventClientIds = ev.client_ids ? String(ev.client_ids).split(',') : [];
            const selectedClientId = eventClientIds.length > 0 ? eventClientIds[0] : '';
            const clientsOptions = (this.state.clients || []).map(c => 
                `<option value="${c.id}" ${String(selectedClientId) === String(c.id) ? 'selected' : ''}>${c.name}</option>`
            ).join('');

            const navButtons = `
                <button onclick="App.showEventTabInCarousel(${state.currentIndex}, 0)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${activeTab === 0 ? '#f59e0b' : textSecondary};" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                <button onclick="App.showEventTabInCarousel(${state.currentIndex}, 1)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: ${activeTab === 1 ? '#ef4444' : textSecondary};" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
            `;
            
            let tabContent = '';
            let titleText = '';
            let saveButton = '';
            
            if (activeTab === 0) {
                titleText = 'Editar Evento';
                const formatDate = (d) => {
                    if (!d) return '';
                    const date = new Date(d);
                    const offset = date.getTimezoneOffset();
                    const local = new Date(date.getTime() - offset * 60000);
                    return local.toISOString().slice(0, 16);
                };
                saveButton = `<button onclick="App.saveEventFromCarouselNow('${ev.id}')" class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105" style="background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">
                    <span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar
                </button>`;
                
                tabContent = `
                    <div class="p-4 rounded-2xl" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                        <div class="space-y-5">
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nombre del Evento</label>
                                <input id="ev-edit-name-${ev.id}" type="text" value="${ev.name || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nombre del evento">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Ubicación</label>
                                <input id="ev-edit-location-${ev.id}" type="text" value="${ev.location || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Ubicación del evento">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Cliente</label>
                                <select id="ev-edit-client-${ev.id}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                                    <option value="">Seleccionar cliente</option>
                                    ${clientsOptions}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Fecha Inicio</label>
                                <input id="ev-edit-date-${ev.id}" type="datetime-local" value="${formatDate(ev.date)}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Fecha Fin</label>
                                <input id="ev-edit-end-date-${ev.id}" type="datetime-local" value="${formatDate(ev.end_date)}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Descripción</label>
                                <textarea id="ev-edit-desc-${ev.id}" rows="2" class="w-full px-4 py-6 rounded-lg text-sm outline-none resize-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">${ev.description || ''}</textarea>
                            </div>
                        </div>
                    </div>`;
            } else {
                titleText = 'Gestionar Evento';
                saveButton = '';
                tabContent = `
                    <div class="space-y-3">
                        <div onclick="App.updateEventStatusInCarousel('${ev.id}', 'active')" 
                             class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${ev.status === 'ACTIVE' ? 'ring-2 ring-emerald-500' : ''}" 
                             style="background: ${ev.status === 'ACTIVE' ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)'}; border: 1px solid rgba(34,197,94,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(34,197,94,0.2); color: #22c55e;"><span class="material-symbols-outlined">play_circle</span></div>
                            <div class="flex-1">
                                <div class="text-sm font-bold flex items-center gap-2" style="color: #22c55e;">
                                    Activar 
                                    ${ev.status === 'ACTIVE' ? '<span class="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500 text-white">ACTUAL</span>' : ''}
                                </div>
                                <div class="text-[11px]" style="color: ${textSecondary};">Marcar evento como activo</div>
                            </div>
                        </div>
                        <div onclick="App.updateEventStatusInCarousel('${ev.id}', 'inactive')" 
                             class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${ev.status === 'INACTIVE' ? 'ring-2 ring-amber-500' : ''}" 
                             style="background: ${ev.status === 'INACTIVE' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)'}; border: 1px solid rgba(245,158,11,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">pause_circle</span></div>
                            <div class="flex-1">
                                <div class="text-sm font-bold flex items-center gap-2" style="color: #f59e0b;">
                                    Desactivar
                                    ${ev.status === 'INACTIVE' ? '<span class="px-2 py-0.5 rounded-full text-[9px] bg-amber-500 text-white">ACTUAL</span>' : ''}
                                </div>
                                <div class="text-[11px]" style="color: ${textSecondary};">Marcar evento como inactivo</div>
                            </div>
                        </div>
                        <div onclick="App.updateEventStatusInCarousel('${ev.id}', 'completed')" 
                             class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${ev.status === 'COMPLETED' ? 'ring-2 ring-blue-500' : ''}" 
                             style="background: ${ev.status === 'COMPLETED' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}; border: 1px solid rgba(59,130,246,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(59,130,246,0.2); color: #3b82f6;"><span class="material-symbols-outlined">check_circle</span></div>
                            <div class="flex-1">
                                <div class="text-sm font-bold flex items-center gap-2" style="color: #3b82f6;">
                                    Finalizar
                                    ${ev.status === 'COMPLETED' ? '<span class="px-2 py-0.5 rounded-full text-[9px] bg-blue-500 text-white">ACTUAL</span>' : ''}
                                </div>
                                <div class="text-[11px]" style="color: ${textSecondary};">Marcar evento como completado</div>
                            </div>
                        </div>
                        <div onclick="App.updateEventStatusInCarousel('${ev.id}', 'cancelled')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-colors" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(239,68,68,0.2); color: #ef4444;"><span class="material-symbols-outlined">cancel</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: #ef4444;">Cancelar</div><div class="text-[11px]" style="color: ${textSecondary};">Cancelar el evento (INACTIVO)</div></div>
                        </div>
                        <div onclick="App.rescheduleEventInCarousel('${ev.id}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-colors" style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(168,85,247,0.2); color: #a855f7;"><span class="material-symbols-outlined">schedule</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: #a855f7;">Aplazar</div><div class="text-[11px]" style="color: ${textSecondary};">Cambiar fecha del evento</div></div>
                        </div>
                        <div onclick="App.deleteEventInCarousel('${ev.id}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-colors" style="background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3);">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(220,38,38,0.2); color: #dc2626;"><span class="material-symbols-outlined">delete</span></div>
                            <div class="flex-1"><div class="text-sm font-bold" style="color: #dc2626;">Eliminar</div><div class="text-[11px]" style="color: ${textSecondary};">Eliminar evento permanentemente</div></div>
                        </div>
                    </div>`;
            }
            
            let notifHtml = '';
            if (notif) {
                const notifColor = notif.icon === 'success' ? '#22c55e' : (notif.icon === 'error' ? '#ef4444' : '#f59e0b');
                const notifBg = notif.icon === 'success' ? 'rgba(34,197,94,0.1)' : (notif.icon === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)');
                notifHtml = `
                    <div class="flex items-center gap-3 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300" style="background: ${notifBg}; border: 1px solid ${notifColor}33;">
                        <span class="material-symbols-outlined text-sm" style="color: ${notifColor};">${notif.icon === 'success' ? 'check_circle' : (notif.icon === 'error' ? 'error' : 'warning')}</span>
                        <span class="text-[11px] font-bold" style="color: ${notifColor};">${notif.text}</span>
                    </div>`;
            }

            const html = `
                <div class="space-y-5" style="padding-right: 8px;">
                    <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                        ${navButtons}
                    </div>
                    <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                        <div class="flex flex-col flex-1">
                            <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">${titleText}</span>
                            <span class="text-xs" style="color: ${textMain};">${ev.name} (${state.currentIndex + 1}/${state.events.length})</span>
                        </div>
                        ${saveButton}
                    </div>
                    ${notifHtml}
                    ${tabContent}
                </div>`;
            
            if (Swal.isVisible()) {
                Swal.update({ html, background: bgMain, color: textMain });
            } else {
                Swal.fire({
                    title: '', html, width: '460px', background: bgMain, color: textMain,
                    showConfirmButton: false, showCloseButton: false, 
                    customClass: { popup: 'modal-left-aligned' },
                    showClass: { popup: '', container: '', backdrop: '' },
                    hideClass: { popup: '', container: '', backdrop: '' },
                    didOpen: () => { this._eventCarouselModalOpen = true; },
                    willClose: () => { this._eventCarouselModalOpen = false; },
                    didClose: () => {
                        if (this._eventCarouselState && this._eventCarouselState.currentTab === 0) {
                            this.saveEventFromCarousel(ev.id);
                        }
                    }
                });
            }
        };

        this._eventCarouselState.renderCarousel = renderCarousel;
        this._eventCarouselModalOpen = false;
        renderCarousel();
    },

    // Cambiar pestaña en el carrusel (Editar <-> Gestionar)
    showEventTabInCarousel: function(index, tab) {
        console.log('[showEventTabInCarousel] Cambiando a tab:', tab);
        if (!this._eventCarouselState) {
            console.log('[showEventTabInCarousel] No _eventCarouselState');
            return;
        }
        if (!this._eventCarouselModalOpen) {
            console.log('[showEventTabInCarousel] Modal cerrado');
            return;
        }
        
        this._eventCarouselState.currentIndex = index;
        this._eventCarouselState.currentTab = tab;
        console.log('[showEventTabInCarousel] state antes:', this._eventCarouselState.currentTab);
        this._eventCarouselState.renderCarousel();
        console.log('[showEventTabInCarousel] state después:', this._eventCarouselState.currentTab);
    },

    // Guardar evento desde el carrusel (cuando se cierra el modal)
    saveEventFromCarousel: async function(eventId) {
        // No guardar si el modal ya está cerrado
        if (!this._eventCarouselModalOpen) {
            console.log('[saveEventFromCarousel] Modal cerrado, no guardar');
            return;
        }
        
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) return;
        
        const name = document.getElementById(`ev-edit-name-${eventId}`)?.value?.trim();
        const location = document.getElementById(`ev-edit-location-${eventId}`)?.value?.trim();
        const date = document.getElementById(`ev-edit-date-${eventId}`)?.value?.trim();
        const end_date = document.getElementById(`ev-edit-end-date-${eventId}`)?.value?.trim();
        const description = document.getElementById(`ev-edit-desc-${eventId}`)?.value?.trim();
        
        if (!name || !date) {
            console.log('[saveEventFromCarousel] Name or date missing');
            return;
        }
        
        try {
            await this.fetchAPI(`/events/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, location, date, end_date, description })
            });
            console.log('[saveEventFromCarousel] Event updated:', eventId);
            await this.loadEvents();
        } catch (err) {
            console.error('[saveEventFromCarousel] Error:', err);
        }
    },

    // Guardar evento inmediatamente desde el botón guardar
    saveEventFromCarouselNow: async function(eventId) {
        const saveBtn = document.querySelector(`[onclick="App.saveEventFromCarouselNow('${eventId}')"]`);
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin align-middle mr-1">sync</span> Guardando...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.pointerEvents = 'none';
        }
        
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) {
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
            return;
        }
        
        const name = document.getElementById(`ev-edit-name-${eventId}`)?.value?.trim();
        const location = document.getElementById(`ev-edit-location-${eventId}`)?.value?.trim();
        const client_id = document.getElementById(`ev-edit-client-${eventId}`)?.value?.trim() || null;
        const group_id = ev.group_id; 
        const date = document.getElementById(`ev-edit-date-${eventId}`)?.value?.trim();
        const end_date = document.getElementById(`ev-edit-end-date-${eventId}`)?.value?.trim();
        const description = document.getElementById(`ev-edit-desc-${eventId}`)?.value?.trim();
        
        if (!name || !date) {
            Swal.fire({ 
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4000,
                title: '⚠️ Error', 
                text: 'Nombre y fecha son obligatorios', 
                icon: 'error', 
                background: '#0f172a', 
                color: '#fff' 
            });
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
            return;
        }
        
        try {
            const result = await this.fetchAPI(`/events/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, location, group_id, client_id, date, end_date, description })
            });
            
            if (result?.success || result?.event || result?.id) {
                // Actualizar en el estado local
                const eventIndex = this.state.events?.findIndex(e => String(e.id) === String(eventId));
                if (eventIndex !== -1) {
                    const selectedClient = (this.state.clients || []).find(c => String(c.id) === String(client_id));
                    this.state.events[eventIndex] = { 
                        ...this.state.events[eventIndex], 
                        name, location, group_id, date, end_date, description,
                        client_ids: client_id,
                        client_names: selectedClient ? selectedClient.name : ''
                    };
                }
                
                if (this._eventCarouselState) {
                    this._eventCarouselState.renderCarousel({ text: 'Evento guardado', icon: 'success' });
                    setTimeout(() => {
                        if (this._eventCarouselState && this._eventCarouselModalOpen) {
                            this._eventCarouselState.renderCarousel();
                        }
                    }, 3000);
                }
                
                // REFRESCAR TABLA AUTOMÁTICAMENTE
                if (typeof this.filterEvents === 'function') {
                    this.filterEvents();
                } else if (typeof this.loadEvents === 'function') {
                    this.loadEvents();
                }

                // Actualizar el nombre en el título del modal
                const titleSpan = document.querySelector('.text-xs[style*="color:"]');
                if (titleSpan) {
                    const currentIndex = this._eventCarouselState?.currentIndex || 0;
                    const totalEvents = this._eventCarouselState?.events?.length || 0;
                    titleSpan.textContent = `${name} (${currentIndex + 1}/${totalEvents})`;
                }
            } else {
                throw new Error(result?.message || 'Error al guardar');
            }
        } catch (e) {
            if (this._eventCarouselState) {
                this._eventCarouselState.renderCarousel({ text: e.message || 'Error al guardar', icon: 'error' });
            }
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
        }
    },

    // Actualizar estado del evento desde el carrusel
    updateEventStatusInCarousel: async function(eventId, status) {
        // Mapear estados del carrusel a estados de la base de datos
        const statusMap = {
            'active': 'ACTIVE',
            'inactive': 'INACTIVE', 
            'completed': 'COMPLETED',
            'cancelled': 'INACTIVE' // 'cancelled' se mapea a 'INACTIVE'
        };
        
        const dbStatus = statusMap[status];
        if (!dbStatus) {
            Swal.fire({ title: '✗ Error', text: `Estado no válido: ${status}`, icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        try {
            await this.fetchAPI(`/events/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: dbStatus })
            });
            await this.loadEvents();
            
            // Actualizar el objeto local del carrusel antes de re-renderizar
            if (this._eventCarouselState && this._eventCarouselState.events) {
                const localEv = this._eventCarouselState.events.find(e => String(e.id) === String(eventId));
                if (localEv) localEv.status = dbStatus;
                
                // Notificación interna (v12.44.290)
                this._eventCarouselState.renderCarousel({ text: 'Estado actualizado', icon: 'success' });
                
                setTimeout(() => {
                    if (this._eventCarouselState && this._eventCarouselModalOpen) {
                        this._eventCarouselState.renderCarousel();
                    }
                }, 3000);
            }
        } catch(e) {
            if (this._eventCarouselState) {
                this._eventCarouselState.renderCarousel({ text: e.message, icon: 'error' });
            }
        }
    },

    // Aplazar evento desde el carrusel
    rescheduleEventInCarousel: async function(eventId) {
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) return;
        
        const { value: newDate } = await Swal.fire({
            title: 'Aplazar Evento',
            html: `<input type="datetime-local" id="new-event-date" class="swal2-input" value="${new Date(ev.date).toISOString().slice(0,16)}">`,
            preConfirm: () => document.getElementById('new-event-date').value
        });
        
        if (newDate) {
            try {
                await this.fetchAPI(`/events/${eventId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ date: newDate })
                });
                await this.loadEvents();
                // Actualizar el objeto local del carrusel antes de re-renderizar
                if (this._eventCarouselState && this._eventCarouselState.events) {
                    const localEv = this._eventCarouselState.events.find(e => String(e.id) === String(eventId));
                    if (localEv) localEv.date = newDate;
                    
                    this._eventCarouselState.renderCarousel({ text: 'Evento aplazado', icon: 'success' });
                    
                    setTimeout(() => {
                        if (this._eventCarouselState && this._eventCarouselModalOpen) {
                            this._eventCarouselState.renderCarousel();
                        }
                    }, 3000);
                }
            } catch(e) {
                if (this._eventCarouselState) {
                    this._eventCarouselState.renderCarousel({ text: e.message, icon: 'error' });
                }
            }
        }
    },

    // Eliminar evento desde el carrusel
    deleteEventInCarousel: async function(eventId) {
        if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
        
        try {
            await this.fetchAPI(`/events/${eventId}`, { method: 'DELETE' });
            await this.loadEvents();
            
            // Actualizar lista local del carrusel
            if (this._eventCarouselState && this._eventCarouselState.events) {
                const indexToRemove = this._eventCarouselState.events.findIndex(e => String(e.id) === String(eventId));
                if (indexToRemove !== -1) {
                    this._eventCarouselState.events.splice(indexToRemove, 1);
                    
                    if (this._eventCarouselState.events.length === 0) {
                        Swal.close();
                    } else {
                        // Ajustar índice si era el último
                        if (this._eventCarouselState.currentIndex >= this._eventCarouselState.events.length) {
                            this._eventCarouselState.currentIndex = Math.max(0, this._eventCarouselState.events.length - 1);
                        }
                        this._eventCarouselState.renderCarousel();
                    }
                }
            }

            this._eventCarouselState.renderCarousel({ text: 'Evento eliminado', icon: 'success' });
            setTimeout(() => {
                if (this._eventCarouselState && this._eventCarouselModalOpen) {
                    this._eventCarouselState.renderCarousel();
                }
            }, 3000);
        } catch(e) {
            if (this._eventCarouselState) {
                this._eventCarouselState.renderCarousel({ text: e.message, icon: 'error' });
            }
        }
    },

    // Funciones legacy (no usadas, mantenidas por compatibilidad)
    updateEventStatus: async function(eventId, status) {
        if (!await this._confirmAction('¿Cambiar estado del evento?', `El evento pasará a estado: ${status}`)) return;
        
        try {
            await this.fetchAPI(`/events/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            await this.loadEvents();
            Swal.fire({ title: '✓ Listo', text: 'Estado actualizado', icon: 'success', background: '#0f172a', color: '#fff' });
        } catch(e) {
            Swal.fire({ title: '✗ Error', text: e.message, icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    rescheduleEvent: async function(eventId) {
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) return;
        
        const { value: newDate } = await Swal.fire({
            title: 'Aplazar Evento',
            html: `<input type="datetime-local" id="new-event-date" class="swal2-input" value="${new Date(ev.date).toISOString().slice(0,16)}">`,
            preConfirm: () => {
                return document.getElementById('new-event-date').value;
            }
        });
        
        if (newDate) {
            try {
                await this.fetchAPI(`/events/${eventId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ date: newDate })
                });
                await this.loadEvents();
                Swal.fire({ title: '✓ Listo', text: 'Evento aplazado', icon: 'success', background: '#0f172a', color: '#fff' });
            } catch(e) {
                Swal.fire({ title: '✗ Error', text: e.message, icon: 'error', background: '#0f172a', color: '#fff' });
            }
        }
    },

    deleteEvent: async function(eventId) {
        if (!await this._confirmAction('¿Eliminar evento?', 'Esta acción no se puede deshacer.')) return;
        
        try {
            await this.fetchAPI(`/events/${eventId}`, { method: 'DELETE' });
            await this.loadEvents();
            Swal.fire({ title: '✓ Listo', text: 'Evento eliminado', icon: 'success', background: '#0f172a', color: '#fff' });
        } catch(e) {
            Swal.fire({ title: '✗ Error', text: e.message, icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    _confirmAction: async function(title, text) {
        if (typeof Swal === 'undefined') return confirm(text);
        const result = await Swal.fire({ title, text, icon: 'warning', background: '#0f172a', color: '#fff', showCancelButton: true });
        return result.isConfirmed;
    },

    openEventEditModal(eventId) {
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) return;
        
        document.getElementById('modal-event-title').textContent = 'Editar Evento';
        document.getElementById('ev-id-hidden').value = ev.id;
        document.getElementById('ev-name').value = ev.name || '';
        document.getElementById('ev-location').value = ev.location || '';
        
        // Poblar selector de empresa
        const groupSelect = document.getElementById('ev-group');
        if (groupSelect && this.state.allGroups) {
            groupSelect.innerHTML = '<option value="">Seleccionar empresa</option>' + 
                this.state.allGroups.map(g => `<option value="${g.id}" ${String(ev.group_id) === String(g.id) ? 'selected' : ''}>${g.name}</option>`).join('');
        }
        
        // Formatear fechas para datetime-local
        const formatDate = (d) => {
            if (!d) return '';
            const date = new Date(d);
            const offset = date.getTimezoneOffset();
            const local = new Date(date.getTime() - offset * 60000);
            return local.toISOString().slice(0, 16);
        };
        
        document.getElementById('ev-date').value = formatDate(ev.date);
        document.getElementById('ev-end-date').value = formatDate(ev.end_date);
        document.getElementById('ev-desc').value = ev.description || '';
        
        // Cargar estado de base de datos propia
        const hasOwnDbCheck = document.getElementById('ev-has-own-db');
        if (hasOwnDbCheck) {
            hasOwnDbCheck.checked = Boolean(ev.has_own_db);
        }
        
        const form = document.getElementById('new-event-form');
        if (form) {
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEventShort(e);
            });
        }
        
        const modal = document.getElementById('modal-event');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    },


    // ─── EXPORTAR EVENTOS ───
    exportEvents: async function() {
        try {
            const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
            if (events.length === 0) {
                this._notifyAction('⚠️ Sin datos', 'No hay eventos para exportar', 'warning');
                return;
            }
            
            const clientsMap = {};
            (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
            
            const csvContent = [
                ['ID', 'Nombre', 'Fecha', 'Ubicación', 'Cliente', 'Total Registrados', 'Asistentes', 'Estado'].join(','),
                ...events.map(ev => [
                    ev.id,
                    `"${(ev.name || '').replace(/"/g, '""')}"`,
                    new Date(ev.date).toLocaleDateString('es-ES'),
                    `"${(ev.location || '').replace(/"/g, '""')}"`,
                    `"${(ev.client_names || '').replace(/"/g, '""')}"`,
                    ev.total_guests || 0,
                    ev.attended_guests || 0,
                    this._getEventStatus(ev)
                ].join(','))
            ].join('\n');
            
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eventos_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this._notifyAction('✓ Exportado', `${events.length} eventos exportados a CSV`, 'success');
        } catch (e) {
            this._notifyAction('Error', 'No se pudo exportar: ' + e.message, 'error');
        }
    },

    renderEventsTable() {
        const tbody = document.getElementById('events-tbody');
        const emptyState = document.getElementById('events-empty-state');
        const tableContainer = document.querySelector('#view-my-events .card');
        
        if (!tbody) return;
        
        let events = Array.isArray(this.state.events) ? this.state.events : [];
        
        // FILTRO: PRODUCTOR solo ve sus eventos
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
        }
        
        // Guardar eventos filtrados para búsqueda
        this._eventsFiltered = [...events];
        
        // Actualizar selects de filtros
        this._populateEventFilters(events);
        
        // Actualizar subtítulo con info del usuario
        this._updateEventsSubtitle(events);
        
        // Mostrar/ocultar estado vacío
        if (events.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            if (emptyState) emptyState.style.display = 'flex';
            if (tableContainer) tableContainer.classList.add('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        if (emptyState) emptyState.style.display = 'none';
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        const userRole = this.state.user?.role;
        const canDelete = userRole === 'ADMIN' || userRole === 'PRODUCTOR';
        
        // Mapear clientes y grupos para lookup
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        const groupsMap = {};
        (this.state.allGroups || []).forEach(g => { groupsMap[g.id] = g.name; });
        
        tbody.innerHTML = events.map(ev => {
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const total = ev.total_guests || 0;
            const attended = ev.attended_guests || 0;
            // Clientes: ahora vienen como string comma-separated (client_ids, client_names)
            const clientNames = ev.client_names ? ev.client_names.split(',').map(n => n.trim()).join(', ') : '—';
            const clientIds = ev.client_ids ? ev.client_ids.split(',').map(id => id.trim()) : [];
            
            const companyName = ev.group_id ? (groupsMap[ev.group_id] || '—') : '—';
            const location = ev.location || '—';
            const status = this._getEventStatus(ev);
            const statusBadge = this._getEventStatusBadge(status);
            const isChecked = this._selectedEvents.has(String(ev.id));
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors group/event" data-event-id="${ev.id}" data-client-ids="${clientIds.join(',')}">
                    <td class="!py-3 !px-3">
                        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleEventSelection('${ev.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-lg bg-gradient-to-br from-[#0ba5ec] to-blue-500/20 flex items-center justify-center flex-shrink-0 border border-[#0ba5ec]">
                                <span class="material-symbols-outlined text-[10px] text-[#0ba5ec]">event</span>
                            </div>
                            <div class="min-w-0">
                                <a href="#" onclick="event.preventDefault(); App.openEvent('${ev.id}')" class="text-sm font-bold text-white hover:text-[#0ba5ec] transition-colors truncate block">${ev.name}</a>
                                <span class="text-[10px] text-slate-500">${companyName !== '—' ? companyName : ''}</span>
                            </div>
                        </div>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs text-slate-300">${dateStr} <span class="text-slate-500">${timeStr}</span></div>
                        <div class="text-[10px] font-mono countdown-timer" data-event-date="${ev.date}" style="color: #a78bfa;">--</div>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-300">${clientNames}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-400 truncate block max-w-[150px]">${location}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs">
                            <span class="font-bold text-[#0ba5ec]">${total}</span><span class="text-slate-500"> / </span>
                            <span class="font-bold text-emerald-400">${attended}</span>
                        </div>
                        <div class="text-[10px] text-slate-500">Reg. / Asist.</div>
                    </td>
                    <td class="!py-3 !px-3">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        }).join('');
    },

    _populateEventFilters(events) {
        // Filtro Cliente
        const clientFilter = document.getElementById('filter-event-client');
        if (clientFilter) {
            const clients = this.state.clients || [];
            const currentVal = clientFilter.value;
            clientFilter.innerHTML = '<option value="">Cliente</option>' + 
                clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            clientFilter.value = currentVal;
        }
        
        // Filtro Empresa
        const companyFilter = document.getElementById('filter-event-company');
        if (companyFilter) {
            const groups = this.state.allGroups || [];
            const currentVal = companyFilter.value;
            companyFilter.innerHTML = '<option value="">Empresa</option>' + 
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            companyFilter.value = currentVal;
        }
    },

    _updateEventsSubtitle(events) {
        const subtitle = document.getElementById('my-events-subtitle');
        if (!subtitle) return;
        
        const userRole = this.state.user?.role || '';
        const userName = this.state.user?.name || this.state.user?.email || '';
        
        if (this.state.user?.role === 'PRODUCTOR') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else if (this.state.user?.role === 'STAFF') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} asignado${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else if (this.state.user?.role === 'CLIENTE') {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} — ${userName}`;
        } else {
            subtitle.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''} en total — ${userName} (${userRole})`;
        }
    },

    _getEventStatus(ev) {
        const now = new Date();
        const eventDate = new Date(ev.date);
        const endDate = ev.end_date ? new Date(ev.end_date) : new Date(eventDate.getTime() + 8 * 60 * 60 * 1000);
        
        if (ev.status === 'cancelled') return 'cancelled';
        if (ev.status === 'draft') return 'draft';
        if (now > endDate) return 'completed';
        if (now >= eventDate && now <= endDate) return 'active';
        return 'upcoming';
    },

    _getEventStatusBadge(status) {
        const badges = {
            active: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Activo</span>',
            upcoming: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20"><span class="material-symbols-outlined text-[10px]">schedule</span>Próximo</span>',
            completed: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20"><span class="material-symbols-outlined text-[10px]">check_circle</span>Finalizado</span>',
            draft: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="material-symbols-outlined text-[10px]">edit_note</span>Borrador</span>',
            cancelled: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"><span class="material-symbols-outlined text-[10px]">cancel</span>Cancelado</span>'
        };
        return badges[status] || badges.draft;
    },

    startCountdownTimers() {
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
        }
        
        this._countdownInterval = setInterval(() => {
            const timers = document.querySelectorAll('.countdown-timer');
            const now = new Date();
            
            timers.forEach(timer => {
                const eventDate = new Date(timer.dataset.eventDate);
                const diff = eventDate - now;
                
                if (diff <= 0) {
                    timer.textContent = '🔴 En vivo';
                    timer.style.color = '#ef4444';
                    return;
                }
                
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (days > 0) {
                    timer.textContent = `⏳ ${days}d ${hours}h ${mins}m`;
                } else if (hours > 0) {
                    timer.textContent = `⏳ ${hours}h ${mins}m`;
                } else {
                    timer.textContent = `⏳ ${mins}m`;
                    timer.style.color = '#f59e0b';
                }
            });
        }, 30000); // Actualizar cada 30 segundos (sin segundos)
        
        // Ejecutar inmediatamente
        setTimeout(() => {
            const timers = document.querySelectorAll('.countdown-timer');
            const now = new Date();
            timers.forEach(timer => {
                const eventDate = new Date(timer.dataset.eventDate);
                const diff = eventDate - now;
                if (diff <= 0) {
                    timer.textContent = '🔴 En vivo';
                    timer.style.color = '#ef4444';
                } else {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    if (days > 0) {
                        timer.textContent = `⏳ ${days}d ${hours}h ${mins}m`;
                    } else if (hours > 0) {
                        timer.textContent = `⏳ ${hours}h ${mins}m`;
                    } else {
                        timer.textContent = `⏳ ${mins}m`;
                        timer.style.color = '#f59e0b';
                    }
                }
            });
        }, 100);
    },

    // ─── FILTRADO DE EVENTOS ───
    filterEvents() {
        const searchInput = document.getElementById('event-search');
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();
        const clientFilter = document.getElementById('filter-event-client')?.value || '';
        const statusFilter = document.getElementById('filter-event-status')?.value || '';
        let events = Array.isArray(this.state.events) ? [...this.state.events] : [];
        
        // FILTRO: PRODUCTOR solo ve sus eventos
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
        }
        
        // Filtro por búsqueda
        if (searchTerm) {
            events = events.filter(ev => {
                const clientNames = ev.client_names || '';
                const groupName = (this.state.allGroups || []).find(g => g.id === ev.group_id)?.name || '';
                const searchable = `${ev.name} ${ev.location || ''} ${ev.description || ''} ${clientNames} ${groupName}`.toLowerCase();
                return searchable.includes(searchTerm);
            });
        }
        
        // Filtro por cliente
        if (clientFilter) {
            events = events.filter(ev => {
                const ids = ev.client_ids ? ev.client_ids.split(',').map(id => id.trim()) : [];
                return ids.some(id => String(id) === String(clientFilter));
            });
        }
        
        // Filtro por estado
        if (statusFilter) {
            events = events.filter(ev => this._getEventStatus(ev) === statusFilter);
        }
        
        console.log('[filterEvents] final events:', events.length);
        
        this._eventsFiltered = events;
        this._renderFilteredEvents(events);
    },

    _renderFilteredEvents(events) {
        const tbody = document.getElementById('events-tbody');
        const emptyState = document.getElementById('events-empty-state');
        const tableContainer = document.querySelector('#view-my-events .card');
        
        if (!tbody) return;
        
        if (events.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) { emptyState.classList.remove('hidden'); emptyState.style.display = 'flex'; }
            if (tableContainer) tableContainer.classList.add('hidden');
            return;
        }
        
        if (emptyState) { emptyState.classList.add('hidden'); emptyState.style.display = 'none'; }
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        const groupsMap = {};
        (this.state.allGroups || []).forEach(g => { groupsMap[g.id] = g.name; });
        
        tbody.innerHTML = events.map(ev => {
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const total = ev.total_guests || 0;
            const attended = ev.attended_guests || 0;
            const clientName = ev.client_id ? (clientsMap[ev.client_id] || '—') : '—';
            const clientNames = ev.client_names ? ev.client_names.split(',').map(n => n.trim()).join(', ') : '—';
            const location = ev.location || '—';
            const status = this._getEventStatus(ev);
            const statusBadge = this._getEventStatusBadge(status);
            const isChecked = this._selectedEvents.has(String(ev.id));
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors" data-event-id="${ev.id}">
                    <td class="!py-3 !px-3">
                        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleEventSelection('${ev.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-lg bg-gradient-to-br from-[#0ba5ec] to-blue-500/20 flex items-center justify-center flex-shrink-0 border border-[#0ba5ec]">
                                <span class="material-symbols-outlined text-[10px] text-[#0ba5ec]">event</span>
                            </div>
                            <div class="min-w-0">
                                <a href="#" onclick="event.preventDefault(); App.openEvent('${ev.id}')" class="text-sm font-bold text-white hover:text-[#0ba5ec] transition-colors truncate block">${ev.name}</a>
                            </div>
                        </div>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs text-slate-300">${dateStr} <span class="text-slate-500">${timeStr}</span></div>
                        <div class="text-[10px] font-mono countdown-timer" data-event-date="${ev.date}" style="color: #a78bfa;">--</div>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-300">${clientNames}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <span class="text-xs text-slate-400 truncate block max-w-[150px]">${location}</span>
                    </td>
                    <td class="!py-3 !px-3">
                        <div class="text-xs">
                            <span class="font-bold text-[#0ba5ec]">${total}</span><span class="text-slate-500"> / </span>
                            <span class="font-bold text-emerald-400">${attended}</span>
                        </div>
                        <div class="text-[10px] text-slate-500">Reg. / Asist.</div>
                    </td>
                    <td class="!py-3 !px-3">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        }).join('');
    },

    // ─── SUGERENCIAS DEL BUSCADOR ───
    showEventSuggestions() {
        const input = document.getElementById('event-search');
        const dropdown = document.getElementById('event-suggestions');
        if (!input || !dropdown) return;
        
        const term = input.value.toLowerCase().trim();
        if (!term) { this.hideEventSuggestions(); return; }
        
        let events = Array.isArray(this.state.events) ? this.state.events : [];
        if (this.state.user?.role === 'PRODUCTOR') {
            events = events.filter(e => e.user_id === this.state.user.userId);
        }
        
        const clientsMap = {};
        (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
        
        const suggestions = [];
        
        events.forEach(ev => {
            const clientName = ev.client_names || '';
            let score = 0;
            let matchType = '';
            
            if (ev.name.toLowerCase().includes(term)) { score = 100; matchType = 'Evento'; }
            else if (clientName.toLowerCase().includes(term)) { score = 80; matchType = 'Cliente'; }
            else if ((ev.location || '').toLowerCase().includes(term)) { score = 60; matchType = 'Locación'; }
            
            if (score > 0) {
                suggestions.push({ event: ev, score, matchType, clientName });
            }
        });
        
        suggestions.sort((a, b) => b.score - a.score);
        const top = suggestions.slice(0, 8);
        
        if (top.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-xs text-slate-500">Sin resultados</div>';
            dropdown.classList.remove('hidden');
            return;
        }
        
        dropdown.innerHTML = top.map(s => {
            const status = this._getEventStatus(s.event);
            const statusColor = status === 'active' ? 'text-emerald-400' : status === 'upcoming' ? 'text-blue-400' : 'text-slate-400';
            return `
                <div class="px-4 py-2.5 hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors" onclick="App.openEvent('${s.event.id}'); App.hideEventSuggestions();">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="material-symbols-outlined text-[#0ba5ec] text-sm flex-shrink-0">event</span>
                        <div class="min-w-0">
                            <div class="text-xs font-bold text-white truncate">${this._highlightText(s.event.name, term)}</div>
                            <div class="text-[10px] text-slate-500">${s.matchType}${s.clientName ? ' · ' + s.clientName : ''}</div>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold ${statusColor} flex-shrink-0 ml-2">${status === 'active' ? 'Activo' : status === 'upcoming' ? 'Próximo' : 'Finalizado'}</span>
                </div>
            `;
        }).join('');
        
        dropdown.classList.remove('hidden');
    },

    hideEventSuggestions() {
        const dropdown = document.getElementById('event-suggestions');
        if (dropdown) dropdown.classList.add('hidden');
    },

    _highlightText(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="text-[#0ba5ec] font-bold">$1</span>');
    },

    // ─── SELECCIÓN MÚLTIPLE DE EVENTOS ───
    toggleSelectAllEvents() {
        const checkbox = document.getElementById('select-all-events');
        const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
        
        if (checkbox.checked) {
            events.forEach(ev => this._selectedEvents.add(String(ev.id)));
        } else {
            this._selectedEvents.clear();
        }
        
        document.querySelectorAll('.event-checkbox').forEach(cb => {
            cb.checked = checkbox.checked;
        });
    },

    toggleEventSelection(eventId) {
        const id = String(eventId);
        if (this._selectedEvents.has(id)) {
            this._selectedEvents.delete(id);
        } else {
            this._selectedEvents.add(id);
        }
        
        // Actualizar select-all
        const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
        const allSelected = events.length > 0 && events.every(ev => this._selectedEvents.has(String(ev.id)));
        const selectAllCheckbox = document.getElementById('select-all-events');
        if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;
    },

    // ─── ACCIÓN DE EDICIÓN DE EVENTOS ───

    // ─── EXPORTAR EVENTOS ───
    exportEvents: async function() {
        try {
            const events = this._eventsFiltered.length > 0 ? this._eventsFiltered : (Array.isArray(this.state.events) ? this.state.events : []);
            if (events.length === 0) {
                this._notifyAction('⚠️ Sin datos', 'No hay eventos para exportar', 'warning');
                return;
            }
            
            const clientsMap = {};
            (this.state.clients || []).forEach(c => { clientsMap[c.id] = c.name; });
            
            const csvContent = [
                ['ID', 'Nombre', 'Fecha', 'Ubicación', 'Cliente', 'Total Registrados', 'Asistentes', 'Estado'].join(','),
                ...events.map(ev => [
                    ev.id,
                    `"${(ev.name || '').replace(/"/g, '""')}"`,
                    new Date(ev.date).toLocaleDateString('es-ES'),
                    `"${(ev.location || '').replace(/"/g, '""')}"`,
                    `"${(ev.client_names || '').replace(/"/g, '""')}"`,
                    ev.total_guests || 0,
                    ev.attended_guests || 0,
                    this._getEventStatus(ev)
                ].join(','))
            ].join('\n');
            
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eventos_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this._notifyAction('✓ Exportado', `${events.length} eventos exportados a CSV`, 'success');
        } catch (e) {
            this._notifyAction('Error', 'No se pudo exportar: ' + e.message, 'error');
        }
    },

    openRegistrationLink(id) {
        if(id && typeof id === 'object') id = id.target?.closest('[data-action]')?.dataset.eventId;
        const link = `${window.location.origin}/registro.html?event=${id}`;
        window.open(link, '_blank');
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
        
        // Función auxiliar para establecer valor solo si el elemento existe
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        
        const setChecked = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked;
        };
        
        // Usar formulario completo (modal-event-full) con prefijo evf-
        setValue('evf-id-hidden', ev.id);
        setValue('evf-name', ev.name || '');
        setValue('evf-location', ev.location || '');
        setValue('evf-desc', ev.description || '');
        setValue('evf-date', ev.date ? ev.date.slice(0, 16) : '');
        setValue('evf-end-date', ev.end_date ? ev.end_date.slice(0, 16) : '');
        
        setValue('evf-reg-title', ev.reg_title || '');
        setValue('evf-reg-welcome', ev.reg_welcome_text || '');
        setValue('evf-reg-success', ev.reg_success_message || '');
        setValue('evf-reg-policy', ev.reg_policy || '');
        setChecked('evf-reg-phone', ev.reg_show_phone !== 0);
        setChecked('evf-reg-org', ev.reg_show_org !== 0);
        setChecked('evf-reg-position', ev.reg_show_position === 1);
        setChecked('evf-reg-vegan', ev.reg_show_vegan !== 0);
        setChecked('evf-reg-dietary', ev.reg_show_dietary !== 0);
        setChecked('evf-reg-gender', ev.reg_show_gender === 1);
        setChecked('evf-reg-agreement', ev.reg_require_agreement !== 0);
        
        setValue('evf-qr-dark', ev.qr_color_dark || '#000000');
        setValue('evf-qr-light', ev.qr_color_light || '#ffffff');
        setValue('evf-qr-logo', ev.qr_logo_url || '');
        setValue('evf-ticket-bg', ev.ticket_bg_url || '');
        setValue('evf-ticket-accent', ev.ticket_accent_color || '#7c3aed');
        
        setValue('evf-reg-whitelist', ev.reg_email_whitelist || '');
        setValue('evf-reg-blacklist', ev.reg_email_blacklist || '');
        
        // Link de Registro en Modal (NUEVO v12.31.29)
        const linkStr = `${window.location.origin}/registro.html?event=${ev.id}`;
        ['evf-registration-link', 'evf-registration-link-modal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = linkStr;
        });
        
        // Actualizar título del modal para indicar que es edición
        const modalTitle = document.getElementById('modal-event-full-title');
        if (modalTitle) {
            modalTitle.textContent = 'Editar Evento - Configuración Completa';
        }
        
        this.updateQRPreview();
        
        // AGREGAR event listener para guardar cambios editados (igual que en crear evento)
        const form = document.getElementById('new-event-full-form');
        if (form) {
            // REMOVER cualquier listener previo (para evitar duplicados)
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            // AGREGAR listener para guardar
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('[FORM SUBMIT EDIT] Guardando evento editado');
                this.saveEventFull(e);
            });
        }
        
        const modal = document.getElementById('modal-event-full');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.removeAttribute('aria-hidden');
        }
    },

    // ── GUARDAR FORMULARIO COMPLETO DE EVENTO (v12.31.46) ──


    // ── ACTUALIZAR EVENTO vía API (v12.31.46) ──
    async updateEvent(id, data) {
        return this.fetchAPI(`/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteEvent(id) {
        if(id && typeof id === 'object') id = id.target?.closest('[data-action]')?.dataset.eventId;
        
        // Verificar permisos: solo ADMIN y PRODUCTOR pueden eliminar
        const userRole = this.state.user?.role;
        if (userRole !== 'ADMIN' && userRole !== 'PRODUCTOR') {
            Swal.fire('Error', 'No tienes permisos para eliminar eventos', 'error');
            return;
        }
        
        console.log('[DELETE EVENT] Intentando eliminar evento:', id);
        
        if (await this._confirmAction('¿Eliminar evento?', 'Esta acción es irreversible y borrará todos los datos asociados.')) {
            try {
                // Guardar referencia al evento antes de eliminar
                const eventToDelete = this.state.events?.find(e => String(e.id) === String(id));
                console.log('[DELETE EVENT] Evento a eliminar:', eventToDelete);
                
                // Eliminar del estado local PRIMERO (optimista)
                const previousEvents = [...(this.state.events || [])];
                const previousCache = [...(this._eventsCache || [])];
                
                this.state.events = (this.state.events || []).filter(e => String(e.id) !== String(id));
                this._eventsCache = (this._eventsCache || []).filter(e => String(e.id) !== String(id));
                this._lastEventsLoad = 0;
                
                // Renderizar inmediatamente
                this.renderEventsTable();
                this._notifyAction('Eliminando...', 'Procesando eliminación', 'info', 2000);
                
                // Llamar al servidor
                const res = await this.fetchAPI(`/events/${id}`, { method: 'DELETE' });
                console.log('[DELETE EVENT] Response del servidor:', res);
                
                // Verificar respuesta del servidor
                if (!res) {
                    console.warn('[DELETE EVENT] Sin respuesta del servidor, revirtiendo cambios locales');
                    this.state.events = previousEvents;
                    this._eventsCache = previousCache;
                    this.renderEventsTable();
                    this._notifyAction('Error', 'No se recibió respuesta del servidor', 'error');
                    return;
                }
                
                if (res.success === false) {
                    console.warn('[DELETE EVENT] Error del servidor, revirtiendo:', res.error);
                    this.state.events = previousEvents;
                    this._eventsCache = previousCache;
                    this.renderEventsTable();
                    const errorMsg = res?.error || 'El evento no puede ser eliminado.';
                    this._notifyAction('Error', errorMsg, 'error');
                    return;
                }
                
                // Eliminación exitosa
                console.log('[DELETE EVENT] Eliminado correctamente del servidor');
                this._notifyAction('Eliminado', 'Evento eliminado correctamente', 'success');
                
            } catch (e) { 
                console.error('[DELETE EVENT] Error:', e);
                // Revirtir cambios locales en caso de error
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
        
        // Actualizar visibilidad del sidebar
        this.updateSidebarVisibility();
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
                // Actualizar visibilidad del sidebar
                this.updateSidebarVisibility();
                return true;
            }
        }
        return false;
    },
    async loadGuests() {
        if (!this.state.event) return;
        
        // Usar el nuevo endpoint de attendance
        const res = await this.fetchAPI(`/events/${this.state.event.id}/attendance`);
        this.state.guests = Array.isArray(res) ? res : [];
        
        this.renderGuestsTarget(this.state.guests);
        
        // Actualizar contador
        const countEl = document.getElementById('guest-count');
        if (countEl) countEl.textContent = `${this.state.guests.length} invitados`;
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
        const tb = document.getElementById('guests-tbody');
        if (!tb) return;
        
        tb.innerHTML = list.map(g => {
            const isValidated = g.validated === 1;
            const isVegan = (g.vegano || 'NO').toUpperCase() === 'SI' || g.vegano === 'YES';
            
            // Estados disponibles: PENDING, CONFIRMED, ATTENDED, CANCELLED
            const statusColors = {
                'PENDING': { bg: 'bg-amber-500/20', text: 'text-amber-500', label: 'Pendiente' },
                'CONFIRMED': { bg: 'bg-blue-500/20', text: 'text-blue-500', label: 'Confirmado' },
                'ATTENDED': { bg: 'bg-emerald-500/20', text: 'text-emerald-500', label: 'Asistió' },
                'CANCELLED': { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Cancelado' }
            };
            const statusStyle = statusColors[g.status] || statusColors['PENDING'];
            
            return `
            <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)] last:border-none group">
                <!-- Checkbox -->
                <td class="!py-3 !px-3">
                    <input type="checkbox" class="w-4 h-4 rounded border-slate-600 bg-transparent cursor-pointer accent-[var(--primary)]">
                </td>
                
                <!-- Asistente (nombre, email, teléfono) -->
                <td class="!py-3 !px-3">
                    <div class="flex items-center gap-3">
                        <div class="w-7 h-7 rounded-lg ${isValidated ? 'bg-emerald-500/20' : 'bg-[var(--bg-hover)]'} flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm ${isValidated ? 'text-emerald-500' : 'text-slate-500'}">${isValidated ? 'check_circle' : 'person'}</span>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-[var(--text-main)]">${g.client_name || 'Sin nombre'}</p>
                            <p class="text-[11px] text-[var(--text-secondary)] font-mono">${g.client_email || 'S/E'}</p>
                            <p class="text-[10px] text-slate-500">${g.client_phone || 'S/T'}</p>
                        </div>
                    </div>
                </td>
                
                <!-- Organización -->
                <td class="!py-3 !px-3">
                    <span class="text-xs text-[var(--text-secondary)]">${g.group_name || g.organization || '---'}</span>
                </td>
                
                <!-- Cargo -->
                <td class="!py-3 !px-3">
                    <span class="text-xs text-[var(--text-secondary)]">${g.cargo || '---'}</span>
                </td>
                
                <!-- Vegano -->
                <td class="!py-3 !px-3 text-center">
                    <span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold ${isVegan ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-500/20 text-slate-400'}">
                        ${isVegan ? 'Sí' : 'No'}
                    </span>
                </td>
                
                <!-- Restricciones -->
                <td class="!py-3 !px-3">
                    <span class="text-xs text-[var(--text-secondary)]">${g.restricciones || '---'}</span>
                </td>
                
                <!-- Estado -->
                <td class="!py-3 !px-3 text-center">
                    <span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}">
                        ${statusStyle.label}
                    </span>
                </td>
                
                <!-- Validar (botón interruptor) -->
                <td class="!py-3 !px-3 text-center">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" 
                            ${isValidated ? 'checked' : ''} 
                            onchange="App.toggleAttendance('${g.event_id}', '${g.client_id}', this.checked)">
                        <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </td>
            </tr>`;
        }).join('');
    },
    
    // Toggle asistencia (validar)
    async toggleAttendance(eventId, clientId, validated) {
        try {
            await this.fetchAPI(`/events/${eventId}/attendance/${clientId}`, {
                method: 'PUT',
                body: JSON.stringify({ validated: validated ? 1 : 0 })
            });
            this.loadGuests();
        } catch (e) {
            console.error('[ATTENDANCE] Error toggling:', e);
        }
    },
    async toggleCheckin(gId, status) {
        await this.fetchAPI(`/guests/checkin/${gId}`, { method: 'POST', body: JSON.stringify({ status: !status }) });
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
                    <td class="px-4 py-3 font-bold text-[var(--text-main)] text-xs">${field.label}</td>
                    <td class="px-4 py-3">
                        <select data-field="${field.id}" onchange="App.updateMappingPreview(this)" class="bg-[var(--bg-input)] text-[var(--text-main)] text-[10px] font-bold rounded-lg px-3 py-2 border border-[var(--border)] w-full">
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

    // Exportar datos a Excel (CSV formato compatible con Excel)
    async exportExcel() {
        if (!this.state.event) {
            return alert('Selecciona un evento primero.');
        }
        
        if (!this.state.guests || this.state.guests.length === 0) {
            return alert('No hay invitados para exportar.');
        }
        
        try {
            const eventName = this.state.event.name || 'evento';
            const guests = this.state.guests;
            
            // Crear contenido CSV
            let csvContent = '\uFEFF'; // BOM para UTF-8
            csvContent += 'Nombre,Email,Teléfono,Organización,Cargo,Estado,Fecha de Registro\n';
            
            guests.forEach(guest => {
                const name = (guest.name || '').replace(/,/g, ';');
                const email = (guest.email || '').replace(/,/g, ';');
                const phone = (guest.phone || '').replace(/,/g, ';');
                const org = (guest.organization || '').replace(/,/g, ';');
                const position = (guest.position || '').replace(/,/g, ';');
                const status = (guest.status || '').replace(/,/g, ';');
                const date = (guest.created_at || '').replace(/,/g, ';');
                
                csvContent += `${name},${email},${phone},${org},${position},${status},${date}\n`;
            });
            
            // Crear blob y descargar
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_invitados_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(`✓ Exportados ${guests.length} invitados a Excel (CSV)`);
        } catch(e) {
            console.error('Error exportando a Excel:', e);
            alert('Error al exportar: ' + e.message);
        }
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
        
        // Obtener rol del usuario
        const userRole = this.state.user?.role || 'PRODUCTOR';
        const isAdmin = userRole === 'ADMIN';
        
        
        // Pestañas que solo ADMIN puede ver
        const adminOnlyTabs = ['groups', 'legal', 'email', 'db'];
        
        // Verificar acceso - si no es ADMIN y la pestaña es restringida, redirigir
        if (!isAdmin && adminOnlyTabs.includes(tabName)) {
            this.switchSystemTab('users');
            return;
        }
        
        // Asegurar que las pestañas restringidas estén ocultas para no ADMIN
        if (!isAdmin) {
            this.hideRestrictedSystemTabs();
        }
        
        // Guardar tab activo
        LS.set('active_system_tab', tabName);
        
        // Actualizar estado guardado en sessionStorage si estamos en la vista 'system'
        try {
            const currentState = this.loadViewState();
            if (currentState && currentState.view === 'system') {
                // Actualizar solo el parámetro 'tab' manteniendo el resto del estado
                const updatedParams = { ...(currentState.params || {}), tab: tabName };
                this.saveViewState('system', updatedParams);
            }
        } catch (e) {
            console.warn('[SYS] Error updating saved state:', e);
        }
        
        // Obtener todos los tabs
        const ALL_SYS_IDS = ['sys-content-users', 'sys-content-groups', 'sys-content-clients', 'sys-content-legal', 'sys-content-email', 'sys-content-account', 'sys-content-db'];
        
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

        // También activar los botones principales de navegación del sistema
        const mainNavBtns = document.querySelectorAll('#view-system > div:first-child .sub-nav-btn');
        mainNavBtns.forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-tab') === tabName) {
                b.classList.add('active');
            }
        });

        // Mostrar panel activo
        const panel = document.getElementById('sys-content-' + tabName);
        if (panel) panel.classList.remove('hidden');

        // Carga de datos específicos
        if (tabName === 'users') this.loadUsersTable();
        if (tabName === 'groups') this.loadGroups();
        if (tabName === 'clients') this.loadClients();
        if (tabName === 'legal') this.loadLegalTexts();
        // if (tabName === 'email') this.loadEmailModuleData(); // Eliminado: función no definida en v12.44.340


        if (tabName === 'account') this.loadUserProfile();
    },

    // Ocultar pestañas restringidas según el rol del usuario
    hideRestrictedSystemTabs: function() {
        const userRole = this.state.user?.role;
        const isAdmin = userRole === 'ADMIN';
        
        // Si es ADMIN, mostrar todo
        if (isAdmin) {
            return;
        }
        
        // Pestañas que solo ADMIN puede ver
        const tabsToHide = ['groups', 'legal', 'email'];
        
        const subNavContainer = document.querySelector('#view-system .sub-nav-container');
        
        if (subNavContainer) {
            const btns = subNavContainer.querySelectorAll('.sub-nav-btn');
            
            btns.forEach(btn => {
                const onclick = btn.getAttribute('onclick') || '';
                const btnText = btn.textContent.trim().toLowerCase();
                
                // Verificar por onclick o por texto del botón
                const shouldHide = tabsToHide.some(tab => {
                    // Buscar por onclick: puede tener 'groups', "groups", o en formato {tab: 'groups'}
                    const hasTabInOnclick = onclick.includes(tab) || onclick.includes(`'${tab}'`) || onclick.includes(`"${tab}"`);
                    // Buscar por texto del botón
                    const hasTabInText = btnText.includes(tab);
                    return hasTabInOnclick || hasTabInText;
                });
                
                if (shouldHide) {
                    // Usar clase hidden de Tailwind + style en línea para asegurar
                    btn.classList.add('hidden');
                    btn.style.display = 'none';
                }
            });
        }
        
        // Ocultar secciones de contenido restringidas
        tabsToHide.forEach(tab => {
            const contentEl = document.getElementById(`sys-content-${tab}`);
            if (contentEl) {
                contentEl.classList.add('hidden');
                contentEl.style.display = 'none';
            }
        });
        
    },

    // ─── PESTAÑAS DE EVENTO (Fase 3: CRUD Personal) ───
    
    // ─── PESTAÑAS DE CONFIGURACIÓN DEL EVENTO ───
    switchConfigTab(tabName) {
        console.log('[CONFIG] Switching to tab:', tabName, 'current event:', this.state.event?.id);
        const ALL_CONFIG_IDS = ['config-content-staff', 'config-content-email', 'config-content-agenda', 'config-content-wheel', 'config-content-pre-registrations', 'config-content-surveys', 'config-content-settings'];
        ALL_CONFIG_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Update config navigation buttons - buscar por data-tab
        const configNavContainer = document.querySelector('#view-event-config');
        if (configNavContainer) {
            configNavContainer.querySelectorAll('.sub-nav-btn').forEach(b => {
                // Remover todas las clases de estado activo
                b.classList.remove('active');
                
                // Agregar clase de estado activo al botón correspondiente por data-tab
                if (b.getAttribute('data-tab') === tabName) {
                    b.classList.add('active');
                }
            });
        }

        const panel = document.getElementById('config-content-' + tabName);
        if (panel) panel.classList.remove('hidden');

        // Guardar pestaña activa en sessionStorage
        sessionStorage.setItem('active_config_tab', tabName);
        console.log('[CONFIG] Saved active tab:', tabName);
        
        // Actualizar estado guardado en sessionStorage si estamos en la vista 'event-config'
        try {
            const currentState = this.loadViewState();
            if (currentState && currentState.view === 'event-config') {
                // Actualizar el eventTab manteniendo el resto del estado
                currentState.eventTab = tabName;
                currentState.eventTabType = 'config';
                currentState.timestamp = Date.now();
                sessionStorage.setItem('check_current_view', JSON.stringify(currentState));
                console.log('[CONFIG] Updated saved state with event tab:', tabName);
            }
        } catch (e) {
            console.warn('[CONFIG] Error updating saved state:', e);
        }
        
        // Load specific data
        if (tabName === 'staff') this.loadConfigStaff();
        if (tabName === 'email') this.loadMailingData();
        if (tabName === 'agenda') this.loadConfigAgenda();
        if (tabName === 'wheel') this.loadWheels();
        if (tabName === 'pre-registrations') this.loadPreRegistrations();
        if (tabName === 'surveys') this.loadSurveys();
        if (tabName === 'settings') this.loadConfigSettings();
    },
    
    // Cargar encuestas (v12.34.2)
    loadSurveys() {
        if (typeof this.loadSurveyQuestions === 'function') {
            this.loadSurveyQuestions();
        } else {
            console.warn('[CONFIG] loadSurveyQuestions not available');
        }
    },
    
    // Cargar staff en config view
    loadConfigStaff() {
        const eventId = this.state.event?.id;
        console.log('[CONFIG STAFF] loadConfigStaff called, eventId:', eventId);
        if (!eventId) {
            console.warn('[CONFIG STAFF] No eventId, returning');
            return;
        }
        
        // Llamar loadEventStaff que ahora escribe directamente en config-staff-tbody
        this.loadEventStaff(eventId).catch(err => {
            console.error('[CONFIG STAFF] Error:', err);
        });
    },
    
    // Cargar agenda en config view
    loadConfigAgenda() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        this.loadEventAgenda(eventId).then(() => {
            // Copiar del view-admin al view-config
            const evList = document.getElementById('config-agenda-list');
            const configList = document.getElementById('config-agenda-list');
            if (evList && configList) {
                configList.innerHTML = evList.innerHTML;
            }
        });
    },

    // Cargar configuración del evento en formulario
    loadConfigSettings() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        // Buscar el evento en la lista de eventos
        const ev = this.state.events.find(e => String(e.id) === String(eventId));
        if (!ev) return;
        
        // Llenar el formulario con los datos del evento
        // Ahora usamos prefijo evs- para evitar conflictos con evf- del formulario completo
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

        setVal('evs-id-hidden', ev.id);
        if (document.getElementById('evs-name')) document.getElementById('evs-name').value = ev.name || '';
        if (document.getElementById('evs-location')) document.getElementById('evs-location').value = ev.location || '';
        if (document.getElementById('evs-desc')) document.getElementById('evs-desc').value = ev.description || '';
        if (document.getElementById('evs-date')) document.getElementById('evs-date').value = ev.date ? ev.date.slice(0, 16) : '';
        if (document.getElementById('evs-end-date')) document.getElementById('evs-end-date').value = ev.end_date ? ev.end_date.slice(0, 16) : '';
        
        // Link de registro
        const regLink = `${window.location.origin}/registro.html?event=${ev.id}`;
        setVal('evs-registration-link', regLink);
        
        setVal('evs-reg-title', ev.reg_title);
        setVal('evs-reg-welcome', ev.reg_welcome_text);
        setVal('evs-reg-success', ev.reg_success_message);
        setVal('evs-reg-policy', ev.reg_policy);
        
        setCheck('evs-reg-phone', ev.reg_show_phone !== 0);
        setCheck('evs-reg-org', ev.reg_show_org !== 0);
        setCheck('evs-reg-position', ev.reg_show_position === 1);
        setCheck('evs-reg-vegan', ev.reg_show_vegan !== 0);
        setCheck('evs-reg-dietary', ev.reg_show_dietary !== 0);
        setCheck('evs-reg-gender', ev.reg_show_gender === 1);
        setCheck('evs-reg-agreement', ev.reg_require_agreement !== 0);
        
        setVal('evs-qr-dark', ev.qr_color_dark || '#000000');
        setVal('evs-qr-light', ev.qr_color_light || '#ffffff');
        setVal('evs-qr-logo', ev.qr_logo_url);
        setVal('evs-ticket-bg', ev.ticket_bg_url);
        setVal('evs-ticket-accent', ev.ticket_accent_color || '#7c3aed');
        
        setVal('evs-reg-whitelist', ev.reg_email_whitelist);
        setVal('evs-reg-blacklist', ev.reg_email_blacklist);
        
        // Actualizar vista previa QR
        if (typeof this.updateQRPreview === 'function') this.updateQRPreview();
    },
    
    // Guardar configuración del evento desde Ajustes
    saveConfigSettings: async function() {
        const eventId = this.state.event?.id;
        if (!eventId) {
            this._notifyAction('Error', 'No hay evento seleccionado', 'error');
            return;
        }
        
        const getVal = (id) => document.getElementById(id)?.value || '';
        const getCheck = (id) => document.getElementById(id)?.checked || false;
        
        const data = {
            name: getVal('evs-name'),
            location: getVal('evs-location'),
            description: getVal('evs-desc'),
            date: getVal('evs-date'),
            end_date: getVal('evs-end-date'),
            reg_title: getVal('evs-reg-title'),
            reg_welcome_text: getVal('evs-reg-welcome'),
            reg_success_message: getVal('evs-reg-success'),
            reg_policy: getVal('evs-reg-policy'),
            reg_show_phone: getCheck('evs-reg-phone') ? 1 : 0,
            reg_show_org: getCheck('evs-reg-org') ? 1 : 0,
            reg_show_position: getCheck('evs-reg-position') ? 1 : 0,
            reg_show_vegan: getCheck('evs-reg-vegan') ? 1 : 0,
            reg_show_dietary: getCheck('evs-reg-dietary') ? 1 : 0,
            reg_show_gender: getCheck('evs-reg-gender') ? 1 : 0,
            reg_require_agreement: getCheck('evs-reg-agreement') ? 1 : 0,
            qr_color_dark: getVal('evs-qr-dark'),
            qr_color_light: getVal('evs-qr-light'),
            qr_logo_url: getVal('evs-qr-logo'),
            ticket_bg_url: getVal('evs-ticket-bg'),
            ticket_accent_color: getVal('evs-ticket-accent'),
            reg_email_whitelist: getVal('evs-reg-whitelist'),
            reg_email_blacklist: getVal('evs-reg-blacklist')
        };
        
        try {
            const res = await this.fetchAPI(`/events/${eventId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            if (res && (res.success || res.id)) {
                // Actualizar el evento en el estado local
                const idx = this.state.events.findIndex(e => String(e.id) === String(eventId));
                if (idx !== -1) {
                    this.state.events[idx] = { ...this.state.events[idx], ...data };
                }
                this._notifyAction('Guardado', 'Configuración guardada correctamente', 'success');
            } else {
                this._notifyAction('Error', res?.error || 'No se pudo guardar', 'error');
            }
        } catch (e) {
            console.error('[saveConfigSettings] Error:', e);
            this._notifyAction('Error', 'Error al guardar: ' + e.message, 'error');
        }
    },


    // ==================== RULETA DE SORTEOS (FASE 1) ====================
    currentWheel: null,
    wheelParticipants: [],
    
    // Cambiar a pestaña de ruleta
    switchConfigWheelTab(tabName) {
        const ALL_WHEEL_IDS = ['config-content-staff', 'config-content-email', 'config-content-agenda', 'config-content-wheel'];
        ALL_WHEEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Update sub-navigation buttons
        const subNav = document.querySelector('#view-event-config .sub-nav-container');
        if (subNav) {
            subNav.querySelectorAll('.sub-nav-btn').forEach(b => {
                b.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl');
                b.classList.add('text-slate-400', 'bg-white/5');
                if (b.id === `config-nav-${tabName}`) {
                    b.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl');
                    b.classList.remove('text-slate-400', 'bg-white/5');
                }
            });
        }

        const panel = document.getElementById('config-content-' + tabName);
        if (panel) panel.classList.remove('hidden');

        // Load specific data
        if (tabName === 'wheel') this.loadWheels();
    },
    
    // Cargar ruletas del evento
    async loadWheels() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        try {
            const wheels = await this.fetchAPI(`/events/${eventId}/wheels`);
            this.renderWheelsList(wheels);
        } catch (e) {
            console.error('Error loading wheels:', e);
            document.getElementById('wheels-list').innerHTML = '<p class="text-red-500">Error al cargar ruletas</p>';
        }
    },
    
    // Renderizar lista de ruletas
    renderWheelsList(wheels) {
        const container = document.getElementById('wheels-list');
        if (!container) return;
        
        if (!wheels || wheels.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm py-4">No hay ruletas. Crea una nueva para comenzar.</p>';
            return;
        }
        
        container.innerHTML = wheels.map(w => `
            <div class="flex items-center justify-between p-4 bg-[var(--bg-hover)] rounded-xl hover:bg-[var(--bg-active)] cursor-pointer transition-colors" data-wheel-id="${w.id}">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-[var(--primary)] text-2xl">casino</span>
                    <div>
                        <p class="font-bold">${w.name}</p>
                        <p class="text-xs text-slate-500">${new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs font-bold rounded ${w.is_active ? 'bg-green-500/20 text-green-500' : 'bg-slate-500/20 text-slate-500'}">
                        ${w.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <button class="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" onclick="event.stopPropagation(); App.deleteWheel('${w.id}')">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <button class="p-2 hover:bg-[var(--bg-card)] rounded-lg" onclick="event.stopPropagation(); App.editWheel('${w.id}')">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Agregar event listeners
        container.querySelectorAll('[data-wheel-id]').forEach(el => {
            el.addEventListener('click', () => this.editWheel(el.dataset.wheelId));
        });
    },
    
    // Editar ruleta
    async editWheel(wheelId) {
        // Validación: wheelId debe ser un UUID válido (no null, undefined, "null", "undefined" o vacío)
        if (!wheelId || typeof wheelId !== 'string' || wheelId === 'null' || wheelId === 'undefined' || wheelId.trim() === '') {
            console.error('editWheel called with invalid wheelId:', wheelId);
            this._notifyAction('Error', 'Selecciona una ruleta válida', 'error');
            return;
        }
        
        try {
            const wheel = await this.fetchAPI(`/events/wheels/${wheelId}`);
            this.currentWheel = wheel;
            
            // Mostrar editor, ocultar lista
            const wheelsListEl = document.getElementById('wheels-list');
            const wheelEditorEl = document.getElementById('wheel-editor');
            if (wheelsListEl) wheelsListEl.closest('.card')?.classList.add('hidden');
            if (wheelEditorEl) wheelEditorEl.classList.remove('hidden');
            
            // Llenar datos
            const wheelNameEl = document.getElementById('wheel-name');
            const wheelColor1El = document.getElementById('wheel-color-1');
            const wheelColor2El = document.getElementById('wheel-color-2');
            const wheelTextColorEl = document.getElementById('wheel-text-color');
            const wheelPointerColorEl = document.getElementById('wheel-pointer-color');
            const wheelSoundEl = document.getElementById('wheel-sound');
            const wheelConfettiEl = document.getElementById('wheel-confetti');
            const wheelShareUrlEl = document.getElementById('wheel-share-url');
            
            if (wheelNameEl) wheelNameEl.value = wheel.name || '';
            
            // Cargar configuración visual
            const config = wheel.config || {};
            if (config.visual) {
                if (wheelColor1El) wheelColor1El.value = config.visual.wheel_colors?.[0] || '#FF6B6B';
                if (wheelColor2El) wheelColor2El.value = config.visual.wheel_colors?.[1] || '#4ECDC4';
                if (wheelTextColorEl) wheelTextColorEl.value = config.visual.wheel_text_color || '#FFFFFF';
                if (wheelPointerColorEl) wheelPointerColorEl.value = config.visual.pointer_color || '#FF0000';
                if (wheelSoundEl) wheelSoundEl.checked = config.visual.sound_enabled !== false;
                if (wheelConfettiEl) wheelConfettiEl.checked = config.visual.confetti_on_win !== false;
            }
            
            // Cargar participantes
            await this.loadWheelParticipants(wheelId);
            
            // Cargar resultados guardados
            await this.loadWheelResults(wheelId);
            
            // Generar URL pública
            const eventName = (this.state.event?.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const shareUrl = `/${eventName}/wheel/${wheel.id}/public`;
            if (wheelShareUrlEl) wheelShareUrlEl.value = window.location.origin + shareUrl;
            
        } catch (e) {
            console.error('Error loading wheel:', e);
            this._notifyAction('Error', 'No se pudo cargar la ruleta', 'error');
        }
    },
    
    // Cargar participantes de una ruleta
    async loadWheelParticipants(wheelId) {
        // Validación: wheelId debe ser un UUID válido (no null, undefined, "null", "undefined" o vacío)
        if (!wheelId || typeof wheelId !== 'string' || wheelId === 'null' || wheelId === 'undefined' || wheelId.trim() === '') {
            console.error('loadWheelParticipants called with invalid wheelId:', wheelId);
            this.wheelParticipants = [];
            this.renderWheelParticipants();
            return;
        }
        
        try {
            const participants = await this.fetchAPI(`/events/wheels/${wheelId}/participants`);
            this.wheelParticipants = participants || [];
            this.renderWheelParticipants();
        } catch (e) {
            console.error('Error loading participants:', e);
        }
    },
    
    // Renderizar tabla de participantes
    renderWheelParticipants() {
        const tbody = document.getElementById('wheel-participants-tbody');
        if (!tbody) return;
        
        if (this.wheelParticipants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">No hay participantes</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.wheelParticipants.map(p => `
            <tr class="hover:bg-[var(--bg-hover)]">
                <td class="py-3">${p.name}</td>
                <td class="py-3 text-slate-500">${p.email || '-'}</td>
                <td class="py-3"><span class="px-2 py-1 text-xs rounded bg-[var(--bg-card)]">${p.source}</span></td>
                <td class="py-3 text-right">
                    <button data-id="${p.id}" class="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" onclick="App.removeWheelParticipant('${p.id}')">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    // Agregar participantes desde guests - muestra modal de selección
    async showAddParticipantsModal() {
        console.log('[DEBUG] showAddParticipantsModal INICIADO', { currentWheel: this.currentWheel });
        
        if (!this.currentWheel || !this.currentWheel.id || this.currentWheel.id === 'null' || this.currentWheel.id === 'undefined') {
            console.error('[DEBUG] currentWheel inválido');
            this._notifyAction('Error', 'Primero guarda la ruleta', 'error');
            return;
        }

        const eventId = this.state.event?.id;
        if (!eventId) {
            console.error('[DEBUG] No hay eventId');
            this._notifyAction('Error', 'No hay evento seleccionado', 'error');
            return;
        }

        // Consultar guests del evento para ver qué hay disponible
        let guestsCount = { all: 0, checked_in: 0, pre_registered: 0 };
        try {
            const guests = await this.fetchAPI(`/events/${eventId}/guests`) || [];
            guestsCount.all = guests.length;
            guestsCount.checked_in = guests.filter(g => g.status === 'checked_in' || g.check_in_time).length;
            guestsCount.pre_registered = guests.filter(g => g.status === 'pre_registered' || g.registered_at).length;
        } catch (e) {
            console.error('Error fetching guests:', e);
        }

        // Construir opciones del modal
        const options = [
            {
                id: 'all',
                label: 'Todos los invitados',
                count: guestsCount.all,
                icon: 'group'
            },
            {
                id: 'checked_in',
                label: 'Asistentes (check-in)',
                count: guestsCount.checked_in,
                icon: 'check_circle'
            },
            {
                id: 'pre_registered',
                label: 'Pre-registrados',
                count: guestsCount.pre_registered,
                icon: 'person_add'
            }
        ];

        const optionsHtml = options.map((opt, idx) => `
            <div class="opt-participant flex items-center justify-between p-4 rounded-xl ${opt.count === 0 ? 'opacity-50 bg-slate-500/10' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] cursor-pointer'}" 
                 data-filter="${opt.id}"
                 style="${opt.count === 0 ? 'cursor: not-allowed;' : ''}">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-xl">${opt.icon}</span>
                    <span>${opt.label}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-sm ${opt.count > 0 ? 'text-green-500' : 'text-slate-500'}">${opt.count} disponibles</span>
                    ${opt.count > 0 ? '<span class="material-symbols-outlined text-green-500">arrow_forward</span>' : '<span class="text-xs text-slate-500">Sin datos</span>'}
                </div>
            </div>
        `).join('');

        // Agregar opción de entrada manual
        const manualHtml = `
            <div id="btn-manual-entry" class="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] cursor-pointer">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-xl">edit_note</span>
                    <span>Entrada manual</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-slate-500">Pegar datos</span>
                    <span class="material-symbols-outlined text-slate-400">arrow_forward</span>
                </div>
            </div>
        `;

        await Swal.fire({
            title: 'Agregar participantes',
            text: 'Selecciona la fuente de participantes',
            html: `<div class="space-y-3 text-left">${optionsHtml}${manualHtml}</div>`,
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#6b7280',
            width: '450px',
            customClass: {
                popup: 'rounded-[1.5rem] border border-white/10',
                confirmButton: 'btn-secondary !px-6 !py-3'
            },
            didOpen: () => {
                // Listener para opción manual
                document.getElementById('btn-manual-entry').addEventListener('click', () => {
                    Swal.close();
                    setTimeout(() => this.showManualParticipantsModal(), 150);
                });
                
                // Listener para opciones de participantes
                document.querySelectorAll('.opt-participant').forEach(el => {
                    el.addEventListener('click', () => {
                        const filter = el.dataset.filter;
                        if (filter) {
                            Swal.close();
                            setTimeout(() => this.addParticipantsFromGuests(filter), 150);
                        }
                    });
                });
            }
        });
    },

    // Agregar participantes desde guests (llamado desde modal)
    async addParticipantsFromGuests(filter = 'all') {
        if (!this.currentWheel || !this.currentWheel.id || this.currentWheel.id === 'null' || this.currentWheel.id === 'undefined') {
            this._notifyAction('Error', 'Primero guarda la ruleta', 'error');
            return;
        }

        try {
            Swal.close();
            const result = await this.fetchAPI(`/events/wheels/${this.currentWheel.id}/participants/from-guests`, {
                method: 'POST',
                body: JSON.stringify({ filter })
            });
            
            this._notifyAction('Éxito', `${result.added} participantes agregados`, 'success');
            await this.loadWheelParticipants(this.currentWheel.id);
        } catch (e) {
            console.error('Error adding participants:', e);
            this._notifyAction('Error', 'No se pudieron agregar participantes', 'error');
        }
    },

    // Modal para entrada manual de participantes
    async showManualParticipantsModal() {
        console.log('[DEBUG] showManualParticipantsModal llamado', {
            currentWheel: this.currentWheel,
            wheelId: this.currentWheel?.id
        });
        
        if (!this.currentWheel || !this.currentWheel.id || this.currentWheel.id === 'null' || this.currentWheel.id === 'undefined') {
            console.error('[DEBUG] currentWheel inválido');
            this._notifyAction('Error', 'Primero guarda la ruleta', 'error');
            return;
        }

        console.log('[DEBUG] Abriendo modal Swal');

        const { value: text, isConfirmed } = await Swal.fire({
            title: 'Entrada manual de participantes',
            text: 'Ingresa los datos (uno por línea): Nombre, Email, Teléfono',
            input: 'textarea',
            inputPlaceholder: 'Juan Pérez, juan@email.com, +1234567890\nMaría López, maria@email.com, +0987654321',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            confirmButtonText: 'Agregar',
            confirmButtonColor: '#7c3aed',
            cancelButtonText: 'Cancelar',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'Ingresa al menos un participante';
            },
            customClass: {
                popup: 'rounded-[1.5rem] border border-white/10',
                confirmButton: 'btn-primary !px-6 !py-3',
                cancelButton: 'btn-secondary !px-6 !py-3'
            }
        });

        if (!isConfirmed || !text) {
            console.log('Modal cancelado o texto vacío', { isConfirmed, text });
            return;
        }

        // Parsear datos
        const lines = text.trim().split('\n').filter(l => l.trim());
        const participants = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            return {
                name: parts[0] || '',
                email: parts[1] || '',
                phone: parts[2] || ''
            };
        }).filter(p => p.name);

        if (participants.length === 0) {
            this._notifyAction('Error', 'No se pudieron parsear los datos', 'error');
            return;
        }

        console.log('Agregando participantes:', participants);

        try {
            const result = await this.fetchAPI(`/events/wheels/${this.currentWheel.id}/participants`, {
                method: 'POST',
                body: JSON.stringify({ 
                    participants: participants.map(p => ({ ...p, source: 'manual' }))
                })
            });
            
            console.log('Resultado:', result);
            this._notifyAction('Éxito', `${participants.length} participantes agregados`, 'success');
            await this.loadWheelParticipants(this.currentWheel.id);
        } catch (e) {
            console.error('Error adding manual participants:', e);
            this._notifyAction('Error', 'No se pudieron agregar participantes', 'error');
        }
    },
    
    // Remover participante
    async removeWheelParticipant(participantId) {
        if (!this.currentWheel || !this.currentWheel.id || this.currentWheel.id === 'null' || this.currentWheel.id === 'undefined') return;
        
        try {
            await this.fetchAPI(`/events/wheels/${this.currentWheel.id}/participants/${participantId}`, {
                method: 'DELETE'
            });
            await this.loadWheelParticipants(this.currentWheel.id);
        } catch (e) {
            console.error('Error removing participant:', e);
        }
    },
    
    // Guardar ruleta
    async saveWheel() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        const wheelNameEl = document.getElementById('wheel-name');
        const wheelColor1El = document.getElementById('wheel-color-1');
        const wheelColor2El = document.getElementById('wheel-color-2');
        const wheelTextColorEl = document.getElementById('wheel-text-color');
        const wheelPointerColorEl = document.getElementById('wheel-pointer-color');
        const wheelSoundEl = document.getElementById('wheel-sound');
        const wheelConfettiEl = document.getElementById('wheel-confetti');
        const wheelShareUrlEl = document.getElementById('wheel-share-url');
        
        const name = wheelNameEl?.value;
        if (!name) {
            this._notifyAction('Error', 'El nombre es requerido', 'error');
            return;
        }
        
        const config = {
            visual: {
                wheel_colors: [
                    wheelColor1El?.value || '#FF6B6B',
                    wheelColor2El?.value || '#4ECDC4'
                ],
                wheel_text_color: wheelTextColorEl?.value || '#FFFFFF',
                pointer_color: wheelPointerColorEl?.value || '#FF0000',
                sound_enabled: wheelSoundEl?.checked || false,
                confetti_on_win: wheelConfettiEl?.checked || false
            }
        };
        
        try {
            let wheel;
            if (this.currentWheel) {
                // Actualizar
                wheel = await this.fetchAPI(`/events/wheels/${this.currentWheel.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, config })
                });
            } else {
                // Crear nueva
                wheel = await this.fetchAPI(`/events/${eventId}/wheels`, {
                    method: 'POST',
                    body: JSON.stringify({ name, config })
                });
            }
            
            this.currentWheel = wheel;
            
            // Generar URL pública con nombre del evento
            if (wheel.id) {
                const eventName = (this.state.event?.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const shareUrl = `/${eventName}/wheel/${wheel.id}/public`;
                if (wheelShareUrlEl) wheelShareUrlEl.value = window.location.origin + shareUrl;
            }
            
            this._notifyAction('Éxito', 'Ruleta guardada', 'success');
            await this.loadWheels();
            
        } catch (e) {
            console.error('Error saving wheel:', e);
            this._notifyAction('Error', 'No se pudo guardar la ruleta', 'error');
        }
    },
    
    // Cargar resultados de una ruleta
    async loadWheelResults(wheelId) {
        if (!wheelId || typeof wheelId !== 'string' || wheelId === 'null' || wheelId === 'undefined' || wheelId.trim() === '') {
            document.getElementById('wheel-results-list').innerHTML = '<p class="text-slate-500 text-sm">No hay resultados</p>';
            return;
        }
        
        try {
            const results = await this.fetchAPI(`/events/wheels/${wheelId}/results`);
            this.renderWheelResults(results);
        } catch (e) {
            console.error('Error loading wheel results:', e);
            document.getElementById('wheel-results-list').innerHTML = '<p class="text-red-500 text-sm">Error al cargar</p>';
        }
    },
    
    // Renderizar lista de resultados
    renderWheelResults(results) {
        const container = document.getElementById('wheel-results-list');
        if (!container) return;
        
        if (!results || results.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm">No hay resultados guardados</p>';
            return;
        }
        
        container.innerHTML = results.map(r => {
            const winners = r.winners || [];
            const showAll = winners.length <= 5; // Mostrar todos si son 5 o menos
            const visibleWinners = showAll ? winners : winners.slice(0, 3);
            const hiddenCount = winners.length - visibleWinners.length;
            const resultId = `result-${r.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            
            return `
                <div class="result-item p-3 bg-[var(--bg-hover)] rounded-lg" data-result-id="${r.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex-1">
                            <p class="font-bold text-sm">${r.name}</p>
                            <p class="text-xs text-slate-500">${new Date(r.created_at).toLocaleString()}</p>
                            <p class="text-xs text-emerald-400 mt-1">${winners.length} ganador(es)</p>
                        </div>
                        <button data-id="${r.id}" class="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" onclick="App.deleteWheelResult('${r.id}')">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                    
                    <!-- Lista de ganadores -->
                    <div class="winner-list mt-2 space-y-1" id="${resultId}-list">
                        ${winners.map((winner, index) => `
                            <div class="flex items-center gap-2 text-sm pl-2 ${index >= 3 && !showAll ? 'hidden' : ''}">
                                <span class="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">${index + 1}</span>
                                <span class="text-white break-words min-w-0">${winner}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${winners.length > 3 ? `
                        <div class="mt-2 pt-2 border-t border-white/10">
                            <button class="toggle-winners text-xs text-primary hover:underline flex items-center gap-1" 
                                    onclick="App.toggleWinnersList('${resultId}')"
                                    data-expanded="false">
                                <span class="material-symbols-outlined text-sm transition-transform">expand_more</span>
                                ${winners.length > 5 ? `Ver todos (${winners.length})` : 'Ver más'}
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Agregar event listeners para los botones de toggle
        setTimeout(() => {
            document.querySelectorAll('.toggle-winners').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const resultItem = this.closest('.result-item');
                    const listId = this.getAttribute('onclick').match(/'([^']+)'/)[1] + '-list';
                    const winnerList = document.getElementById(listId);
                    const isExpanded = this.getAttribute('data-expanded') === 'true';
                    
                    if (isExpanded) {
                        // Colapsar: mostrar solo primeros 3
                        winnerList.querySelectorAll('.flex.items-center').forEach((item, index) => {
                            if (index >= 3) item.classList.add('hidden');
                        });
                        this.querySelector('.material-symbols-outlined').style.transform = 'rotate(0deg)';
                        this.setAttribute('data-expanded', 'false');
                        this.innerHTML = this.innerHTML.replace('Ver menos', 'Ver más');
                    } else {
                        // Expandir: mostrar todos
                        winnerList.querySelectorAll('.flex.items-center').forEach(item => {
                            item.classList.remove('hidden');
                        });
                        this.querySelector('.material-symbols-outlined').style.transform = 'rotate(180deg)';
                        this.setAttribute('data-expanded', 'true');
                        this.innerHTML = this.innerHTML.replace('Ver más', 'Ver menos');
                    }
                });
            });
        }, 100);
    },
    
    // Alternar visibilidad de lista de ganadores
    toggleWinnersList(resultId) {
        const listId = `${resultId}-list`;
        const winnerList = document.getElementById(listId);
        const toggleBtn = document.querySelector(`[onclick*="${resultId}"]`);
        
        if (!winnerList || !toggleBtn) return;
        
        const isExpanded = toggleBtn.getAttribute('data-expanded') === 'true';
        const icon = toggleBtn.querySelector('.material-symbols-outlined');
        
        if (isExpanded) {
            // Colapsar: mostrar solo primeros 3
            winnerList.querySelectorAll('.flex.items-center').forEach((item, index) => {
                if (index >= 3) item.classList.add('hidden');
            });
            if (icon) icon.style.transform = 'rotate(0deg)';
            toggleBtn.setAttribute('data-expanded', 'false');
            toggleBtn.innerHTML = toggleBtn.innerHTML.replace('Ver menos', 'Ver más');
        } else {
            // Expandir: mostrar todos
            winnerList.querySelectorAll('.flex.items-center').forEach(item => {
                item.classList.remove('hidden');
            });
            if (icon) icon.style.transform = 'rotate(180deg)';
            toggleBtn.setAttribute('data-expanded', 'true');
            toggleBtn.innerHTML = toggleBtn.innerHTML.replace('Ver más', 'Ver menos');
        }
    },
    
    // Eliminar un resultado
    async deleteWheelResult(resultId) {
        if (!this.currentWheel?.id) return;
        
        if (!confirm('¿Eliminar este resultado?')) return;
        
        try {
            await this.fetchAPI(`/events/wheels/${this.currentWheel.id}/results/${resultId}`, { method: 'DELETE' });
            this._notifyAction('Éxito', 'Resultado eliminado', 'success');
            await this.loadWheelResults(this.currentWheel.id);
        } catch (e) {
            console.error('Error deleting wheel result:', e);
            this._notifyAction('Error', 'No se pudo eliminar', 'error');
        }
    },
    
    // Eliminar todos los resultados
    async deleteAllWheelResults() {
        if (!this.currentWheel?.id) return;
        
        if (!confirm('¿Eliminar TODOS los resultados?')) return;
        
        try {
            await this.fetchAPI(`/events/wheels/${this.currentWheel.id}/results`, { method: 'DELETE' });
            this._notifyAction('Éxito', 'Resultados eliminados', 'success');
            await this.loadWheelResults(this.currentWheel.id);
        } catch (e) {
            console.error('Error deleting all wheel results:', e);
            this._notifyAction('Error', 'No se pudieron eliminar', 'error');
        }
    },
    
    // Crear nueva ruleta
    async createNewWheel() {
        const eventId = this.state.event?.id;
        if (!eventId) {
            this._notifyAction('Error', 'No hay evento seleccionado', 'error');
            return;
        }

        // Pedir nombre con modal
        const { value: name, isConfirmed } = await Swal.fire({
            title: 'Nueva Ruleta',
            text: 'Ingresa el nombre para esta ruleta',
            input: 'text',
            inputPlaceholder: 'Ej: Sorteo Principal',
            inputValue: '',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            confirmButtonText: 'Crear',
            confirmButtonColor: '#7c3aed',
            cancelButtonText: 'Cancelar',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'El nombre es requerido';
                }
            },
            customClass: {
                popup: 'rounded-[1.5rem] border border-white/10',
                confirmButton: 'btn-primary !px-6 !py-3',
                cancelButton: 'btn-secondary !px-6 !py-3'
            }
        });

        if (!isConfirmed || !name) return;

        try {
            // Guardar ruleta inmediatamente con el nombre
            const config = {
                visual: {
                    wheel_colors: ['#FF6B6B', '#4ECDC4'],
                    wheel_text_color: '#FFFFFF',
                    pointer_color: '#FF0000',
                    sound_enabled: true,
                    confetti_on_win: true
                }
            };

            const wheel = await this.fetchAPI(`/events/${eventId}/wheels`, {
                method: 'POST',
                body: JSON.stringify({ name: name.trim(), config })
            });

            if (!wheel || !wheel.id) {
                throw new Error('No se pudo crear la ruleta');
            }

            this.currentWheel = wheel;
            
            // Limpiar formulario y establecer valores
            const wheelNameEl = document.getElementById('wheel-name');
            const wheelColor1El = document.getElementById('wheel-color-1');
            const wheelColor2El = document.getElementById('wheel-color-2');
            const wheelTextColorEl = document.getElementById('wheel-text-color');
            const wheelPointerColorEl = document.getElementById('wheel-pointer-color');
            const wheelSoundEl = document.getElementById('wheel-sound');
            const wheelConfettiEl = document.getElementById('wheel-confetti');
            const wheelShareUrlEl = document.getElementById('wheel-share-url');
            const wheelParticipantsTbodyEl = document.getElementById('wheel-participants-tbody');
            const wheelsListEl = document.getElementById('wheels-list');
            const wheelEditorEl = document.getElementById('wheel-editor');
            
            if (wheelNameEl) wheelNameEl.value = wheel.name || name;
            if (wheelColor1El) wheelColor1El.value = '#FF6B6B';
            if (wheelColor2El) wheelColor2El.value = '#4ECDC4';
            if (wheelTextColorEl) wheelTextColorEl.value = '#FFFFFF';
            if (wheelPointerColorEl) wheelPointerColorEl.value = '#FF0000';
            if (wheelSoundEl) wheelSoundEl.checked = true;
            if (wheelConfettiEl) wheelConfettiEl.checked = true;
            
            // Generar URL pública
            const eventName = (this.state.event?.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const shareUrl = `/${eventName}/wheel/${wheel.id}/public`;
            if (wheelShareUrlEl) wheelShareUrlEl.value = window.location.origin + shareUrl;
            
            // Limpiar participantes
            this.wheelParticipants = [];
            if (wheelParticipantsTbodyEl) wheelParticipantsTbodyEl.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">No hay participantes</td></tr>';
            
            // Mostrar editor, ocultar lista
            if (wheelsListEl) wheelsListEl.closest('.card')?.classList.add('hidden');
            if (wheelEditorEl) wheelEditorEl.classList.remove('hidden');
            
            // Recargar lista de ruletas
            await this.loadWheels();
            
            this._notifyAction('Éxito', 'Ruleta creada', 'success');
            
        } catch (e) {
            console.error('Error creating wheel:', e);
            this._notifyAction('Error', 'No se pudo crear la ruleta', 'error');
        }
    },
    
    // Volver a lista de ruletas
    backToWheelsList() {
        const wheelsListEl = document.getElementById('wheels-list');
        const wheelEditorEl = document.getElementById('wheel-editor');
        if (wheelsListEl) wheelsListEl.closest('.card')?.classList.remove('hidden');
        if (wheelEditorEl) wheelEditorEl.classList.add('hidden');
        this.currentWheel = null;
        this.loadWheels();
    },

    // Eliminar ruleta
    async deleteWheel(wheelId) {
        if (!wheelId || wheelId === 'null' || wheelId === 'undefined') {
            this._notifyAction('Error', 'ID de ruleta inválido', 'error');
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar ruleta?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            confirmButtonText: 'Eliminar',
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            showCancelButton: true,
            customClass: {
                popup: 'rounded-[1.5rem] border border-white/10',
                confirmButton: 'btn-primary !px-6 !py-3',
                cancelButton: 'btn-secondary !px-6 !py-3'
            }
        });

        if (!isConfirmed) return;

        try {
            await this.fetchAPI(`/events/wheels/${wheelId}`, { method: 'DELETE' });
            this._notifyAction('Éxito', 'Ruleta eliminada', 'success');
            this.currentWheel = null;
            await this.loadWheels();
        } catch (e) {
            console.error('Error deleting wheel:', e);
            this._notifyAction('Error', 'No se pudo eliminar la ruleta', 'error');
        }
    },

    // Copiar URL de la ruleta
    copyWheelUrl() {
        const urlInput = document.getElementById('wheel-share-url');
        if (!urlInput || !urlInput.value) {
            this._notifyAction('Error', 'Primero guarda la ruleta', 'error');
            return;
        }
        
        navigator.clipboard.writeText(urlInput.value).then(() => {
            this._notifyAction('Éxito', 'URL copiada al portapapeles', 'success');
        }).catch(() => {
            // Fallback para navegadores antiguos
            urlInput.select();
            document.execCommand('copy');
            this._notifyAction('Éxito', 'URL copiada', 'success');
        });
    },

    // Vista previa de la ruleta
    previewWheel() {
        const urlInput = document.getElementById('wheel-share-url');
        if (!urlInput || !urlInput.value) {
            this._notifyAction('Error', 'Primero guarda la ruleta', 'error');
            return;
        }
        window.open(urlInput.value, '_blank');
    },

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

        // Guardar pestaña activa en sessionStorage
        sessionStorage.setItem('active_event_tab', tabName);
        console.log('[EVENT] Saved active tab:', tabName);
        
        // Actualizar estado guardado en sessionStorage si estamos en la vista 'admin'
        try {
            const currentState = this.loadViewState();
            if (currentState && currentState.view === 'admin') {
                // Actualizar el eventTab manteniendo el resto del estado
                currentState.eventTab = tabName;
                currentState.eventTabType = 'admin';
                currentState.timestamp = Date.now();
                sessionStorage.setItem('check_current_view', JSON.stringify(currentState));
                console.log('[EVENT] Updated saved state with event tab:', tabName);
            }
        } catch (e) {
            console.warn('[EVENT] Error updating saved state:', e);
        }

        // Load specific data
        if (tabName === 'guests') this.loadGuests(); // Assuming loadGuests handles event.id
        if (tabName === 'staff') this.loadEventStaff(this.state.event?.id);
    },

    async loadEventStaff(eventId) {
        console.log('[LOAD EVENT STAFF] Called with eventId:', eventId);
        try {
            const users = await this.fetchAPI(`/events/${eventId}/users`);
            console.log('[LOAD EVENT STAFF] API returned:', users);
            
            // Guardar usuarios para filtrado
            this.state.configStaffUsers = users;
            
            // Buscar el tbody correcto - config-staff-tbody para vista de configuración, ev-staff-tbody para admin
            let tbody = document.getElementById('config-staff-tbody');
            if (!tbody) tbody = document.getElementById('ev-staff-tbody');
            
            console.log('[LOAD EVENT STAFF] tbody found:', !!tbody);
            if (!tbody) return;
            
            if (!users || users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-[var(--text-muted)] italic text-sm">No hay personal asignado a este evento.</td></tr>`;
                return;
            }
            
            tbody.innerHTML = users.map(u => `
                <tr class="user-row-premium">
                    <td class="px-2 py-3 align-middle" style="width: 40px;">
                        <input type="checkbox" class="config-staff-checkbox" data-user-id="${u.id}" style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                            <div class="flex flex-col">
                                <div class="font-bold text-sm text-[var(--text-main)]">${u.display_name || u.username}</div>
                                <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${u.username}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-3 align-middle">
                        <span class="text-xs font-bold" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px; padding: 2px 8px;">${u.role}</span>
                    </td>
                </tr>
            `).join('');
            
        } catch(e) { console.error('Error loading event staff:', e); }
    },
    
    // Abrir carrusel de edición de staff desde configuración del evento
    openStaffCarouselFromConfig: async function() {
        // Obtener checkboxes marcados en la tabla de config-staff
        const checkboxes = document.querySelectorAll('#config-staff-tbody .config-staff-checkbox:checked');
        const selectedUserIds = Array.from(checkboxes).map(cb => cb.dataset.userId);
        
        if (selectedUserIds.length === 0) {
            Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
            return;
        }
        
        // Guardar seleccionados para el carrusel
        this.state.selectedUsers = selectedUserIds;
        
        // Asegurar que los datos estén cargados
        if (!this.state.allUsers?.length || !this.state.groups?.length) {
            await this.loadUsersTable();
        }
        if (!this.state.clients?.length) {
            try {
                const clientsRes = await this.fetchAPI('/clients');
                this.state.clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes.data || []);
            } catch(e) { this.state.clients = []; }
        }
        
        // Abrir el carrusel independiente de configuración
        this.editSelectedUsersConfig(selectedUserIds);
    },
    
    // ==================================================
    // CARRUSEL INDEPENDIENTE PARA PERSONAL (CONFIGURACIÓN)
    // ==================================================
    
    // Carrusel principal de Personal - 4 botones independientes
    editSelectedUsersConfig: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : (userIds ? [userIds] : []);
        if (ids.length === 1) {
            this.editSingleUserConfig(ids);
            return;
        }
        
        this._savedSelectedUsersConfig = [...ids];
        const users = this.state.allUsers || [];
        const selectedUsers = ids ? users.filter(u => ids.some(id => String(id) === String(u.id))) : [];
        if (selectedUsers.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 4 botones - INDEPENDIENTE -->
                <div class="flex items-center justify-center gap-3 p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUserConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserActionConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showEventSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título -->
                <div class="flex items-center p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <!-- Lista de staff seleccionado -->
                <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${selectedUsers.map(u => {
                        const roleColors = { ADMIN: '#ef4444', PRODUCTOR: '#f59e0b', LOGISTICO: '#3b82f6', STAFF: '#10b981', CLIENTE: '#8b5cf6' };
                        const roleColor = roleColors[u.role] || '#64748b';
                        return `<div class="flex items-center gap-4 p-4 rounded-2xl mb-2" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style="background: rgba(59,130,246,0.2); color: #3b82f6;">${(u.display_name || u.username || 'U').charAt(0).toUpperCase()}</div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${u.display_name || u.username}</div>
                                <div class="text-[11px]" style="color: ${textSecondary};">${u.username} • <span style="color: ${roleColor};">${u.role}</span></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },
    
    // Edición inline de un solo usuario - INDEPENDIENTE para Personal
    editSingleUserConfig: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona un solo staff para editar', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        if (ids.length > 1) { Swal.fire({ title: '⚠️ Atención', text: 'Solo puedes editar un staff a la vez', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        const userId = ids[0];
        const user = this.state.allUsers?.find(u => u.id === userId);
        if (!user) { Swal.fire({ title: '⚠️ Error', text: 'Staff no encontrado', icon: 'error', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedUsersConfig = [userId];
        this._editingUserIdConfig = userId;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)';
        
        const roleOptions = ['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF', 'CLIENTE'].map(r => 
            `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`
        ).join('');
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 4 botones - INDEPENDIENTE -->
                <div class="flex items-center justify-center gap-3 p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUserConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserActionConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showEventSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título + Guardar -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${user.display_name || user.username}</span>
                    </div>
                    <button onclick="App.saveUserEditInlineConfig()" class="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105" style="background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">
                        <span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar
                    </button>
                </div>
                <!-- Campos编辑 inline -->
                <div class="p-4 rounded-2xl" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                    <div class="space-y-5">
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nombre</label>
                            <input id="edit-user-name-config-${user.id}" type="text" value="${user.display_name || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nombre del staff">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Email</label>
                            <input id="edit-user-email-config-${user.id}" type="email" value="${user.username || ''}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Email del staff">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Nueva Contraseña <span class="normal-case font-normal">(dejar vacío para mantener)</span></label>
                            <input id="edit-user-password-config-${user.id}" type="password" value="" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};" placeholder="Nueva contraseña">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: ${textSecondary};">Rol</label>
                            <select id="edit-user-role-config-${user.id}" class="w-full px-4 py-6 rounded-lg text-sm outline-none transition-all" style="background: ${inputBg}; border: 1px solid ${borderColor}; color: ${textMain};">
                                ${roleOptions}
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },
    
    // Guardar edición inline de staff - INDEPENDIENTE para Personal
    saveUserEditInlineConfig: async function() {
        const userId = this._editingUserIdConfig;
        if (!userId) return;
        
        const nameInput = document.getElementById(`edit-user-name-config-${userId}`);
        const emailInput = document.getElementById(`edit-user-email-config-${userId}`);
        const passwordInput = document.getElementById(`edit-user-password-config-${userId}`);
        const roleSelect = document.getElementById(`edit-user-role-config-${userId}`);
        
        if (!nameInput || !emailInput || !roleSelect) {
            Swal.fire({ title: '⚠️ Error', text: 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput?.value || '';
        const role = roleSelect.value;
        
        if (!name || !email) {
            Swal.fire({ title: '⚠️ Error', text: 'Nombre y email son obligatorios', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        const saveBtn = document.querySelector('[onclick="App.saveUserEditInlineConfig()"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin align-middle mr-1">sync</span> Guardando...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.pointerEvents = 'none';
        }
        
        try {
            const updateData = { display_name: name, username: email, role };
            if (password) updateData.password = password;
            
            const result = await this.fetchAPI(`/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            if (result?.user || result?.id) {
                // Actualizar en el estado
                const userIndex = this.state.allUsers?.findIndex(u => u.id === userId);
                if (userIndex !== -1) {
                    this.state.allUsers[userIndex] = { ...this.state.allUsers[userIndex], ...updateData };
                }
                
                Swal.fire({ title: '✅ Guardado', text: 'Staff actualizado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
                
                // Recargar el carrusel independiente
                this.editSingleUserConfig([userId]);
            } else {
                throw new Error(result?.message || 'Error al guardar');
            }
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al guardar', icon: 'error', background: '#0f172a', color: '#fff' });
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle mr-1">save</span> Guardar';
                saveBtn.style.opacity = '1';
                saveBtn.style.pointerEvents = 'auto';
            }
        }
    },
    
    // Gestionar staff (Activar/Desactivar/Eliminar) - INDEPENDIENTE para Personal
    showManageUserActionConfig: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedUsersConfig = [...ids];
        
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => ids.some(id => String(id) === String(u.id)));
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 4 botones - INDEPENDIENTE -->
                <div class="flex items-center justify-center gap-3 p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUserConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserActionConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showEventSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título debajo de la barra -->
                <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Gestionar Staff</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <div class="space-y-3">
                <div onclick="App.handleBulkUserActionConfig('activate', '${ids.join(',')}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(34,197,94,0.2); color: #22c55e;"><span class="material-symbols-outlined">play_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #22c55e;">Activar</div><div class="text-[11px]" style="color: ${textSecondary};">Activar ${ids.length} staff</div></div>
                </div>
                <div onclick="App.handleBulkUserActionConfig('suspend', '${ids.join(',')}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(245,158,11,0.2); color: #f59e0b;"><span class="material-symbols-outlined">pause_circle</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #f59e0b;">Suspender</div><div class="text-[11px]" style="color: ${textSecondary};">Suspender ${ids.length} staff</div></div>
                </div>
                <div onclick="App.handleBulkUserActionConfig('delete', '${ids.join(',')}')" class="flex items-center gap-4 p-4 rounded-2xl cursor-pointer" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(239,68,68,0.2); color: #ef4444;"><span class="material-symbols-outlined">delete</span></div>
                    <div class="flex-1"><div class="text-sm font-bold" style="color: #ef4444;">Eliminar</div><div class="text-[11px]" style="color: ${textSecondary};">Eliminar ${ids.length} staff</div></div>
                </div>
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },

    handleBulkUserActionConfig: async function(action, userIdsStr) {
        const userIds = userIdsStr.split(',');
        if (userIds.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        try {
            if (action === 'activate') {
                if (await this._confirmAction('¿Activar staff?', `¿Activar ${userIds.length} staff?`, 'Sí, activar')) {
                    await this.bulkUpdateStatusConfig(userIds, 'APPROVED');
                    this.editSelectedUsersConfig(userIds);
                }
            } else if (action === 'suspend') {
                if (await this._confirmAction('¿Suspender staff?', `¿Suspender ${userIds.length} staff?`, 'Sí, suspender')) {
                    await this.bulkUpdateStatusConfig(userIds, 'SUSPENDED');
                    this.editSelectedUsersConfig(userIds);
                }
            } else if (action === 'delete') {
                if (await this._confirmAction('¿Eliminar staff?', `¿Eliminar ${userIds.length} staff? Esta acción no se puede deshacer.`)) {
                    await this.bulkDeleteUsersConfig(userIds);
                }
            }
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error en la acción', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },

    bulkUpdateStatusConfig: async function(userIds, status) {
        for (const userId of userIds) {
            await this.fetchAPI(`/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
        }
        await this.loadUsersTable();
    },

    bulkDeleteUsersConfig: async function(userIds) {
        for (const userId of userIds) {
            await this.fetchAPI(`/users/${userId}`, { method: 'DELETE' });
        }
        await this.loadUsersTable();
        Swal.fire({ title: '✅ Eliminado', text: `${userIds.length} staff eliminado(s)`, icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
        Swal.close();
    },
    
    // Toggle estado de usuario - INDEPENDIENTE para Personal
    toggleUserStatusConfig: async function(userIdsStr) {
        const userIds = userIdsStr.split(',');
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => userIds.some(uid => String(uid) === String(u.id)));
        
        const allActive = selectedUsers.every(u => u.status === 'ACTIVE');
        const newStatus = allActive ? 'INACTIVE' : 'ACTIVE';
        const action = allActive ? 'desactivar' : 'activar';
        
        const result = await Swal.fire({
            title: `¿${allActive ? 'Desactivar' : 'Activar'} Staff?`,
            text: `Se ${action}rán ${selectedUsers.length} staff(s).`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: allActive ? '#ef4444' : '#10b981',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            background: '#0f172a',
            color: '#fff'
        });
        
        if (result.isConfirmed) {
            try {
                for (const userId of userIds) {
                    await this.fetchAPI(`/users/${userId}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: newStatus })
                    });
                }
                
                // Recargar datos
                await this.loadUsersTable();
                await this.loadConfigStaff();
                
                Swal.fire({ title: '✅ Listo', text: `Staff ${allActive ? 'desactivado' : 'activado'} correctamente`, icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
                
                // Recargar carrusel
                this.showManageUserActionConfig(userIds);
            } catch (e) {
                Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al cambiar estado', icon: 'error', background: '#0f172a', color: '#fff' });
            }
        }
    },
    
    // Eliminar usuario - INDEPENDIENTE para Personal
    deleteUserConfig: async function(userIdsStr) {
        const userIds = userIdsStr.split(',');
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => userIds.some(uid => String(uid) === String(u.id)));
        
        const result = await Swal.fire({
            title: '¿Eliminar Staff?',
            text: `Se eliminarán ${selectedUsers.length} staff(s) PERMANENTEMENTE.`,
            icon: 'danger',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: '#0f172a',
            color: '#fff'
        });
        
        if (result.isConfirmed) {
            try {
                for (const userId of userIds) {
                    await this.fetchAPI(`/users/${userId}`, { method: 'DELETE' });
                }
                
                // Recargar datos
                await this.loadUsersTable();
                await this.loadConfigStaff();
                
                Swal.fire({ title: '✅ Eliminado', text: 'Staff eliminado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
                
                // Cerrar modal
                Swal.close();
            } catch (e) {
                Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al eliminar', icon: 'error', background: '#0f172a', color: '#fff' });
            }
        }
    },
    
    // Asignar Evento a usuarios - INDEPENDIENTE para Personal
    showEventSelectorForUsersConfig: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedUsersConfig = [...ids];
        
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => ids.some(id => String(id) === String(u.id)));
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        
        // Obtener eventos disponibles
        const events = this.state.events || [];
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 4 botones - INDEPENDIENTE -->
                <div class="flex items-center justify-center gap-3 p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUserConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserActionConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showEventSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ec4899;" title="Asignar Evento"><span class="material-symbols-outlined text-sm">event</span></button>
                    <button onclick="App.showRoleSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título -->
                <div class="flex items-center p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Evento</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <!-- Lista de eventos -->
                <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${events.length === 0 ? `<div class="text-center py-8 text-sm" style="color: ${textSecondary};">No hay eventos disponibles</div>` : events.map(e => `
                        <div onclick="App.assignEventToUsersConfig('${ids.join(',')}', '${e.id}')" class="flex items-center gap-4 p-4 rounded-2xl mb-2 cursor-pointer hover:scale-[1.02] transition-all" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: rgba(236,72,153,0.2); color: #ec4899;">
                                <span class="material-symbols-outlined text-sm">event</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${e.name}</div>
                                <div class="text-[11px]" style="color: ${textSecondary};">${e.location || 'Sin ubicación'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },
    
    // Asignar evento a usuarios - INDEPENDIENTE para Personal
    assignEventToUsersConfig: async function(userIdsStr, eventId) {
        const userIds = userIdsStr.split(',');
        
        try {
            // Obtener evento
            const event = this.state.events?.find(e => e.id === eventId);
            
            for (const userId of userIds) {
                await this.fetchAPI(`/events/${eventId}/users`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: userId })
                });
            }
            
            Swal.fire({ title: '✅ Asignado', text: `Staff asignado al evento "${event?.name || 'Evento'}"`, icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
            
            // Recargar carrusel
            this.showEventSelectorForUsersConfig(userIds);
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al asignar', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },
    
    // Asignar Rol a usuarios - INDEPENDIENTE para Personal
    showRoleSelectorForUsersConfig: function(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) { Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un staff', icon: 'warning', background: '#0f172a', color: '#fff' }); return; }
        
        this._savedSelectedUsersConfig = [...ids];
        
        const users = this.state.allUsers || [];
        const selectedUsers = users.filter(u => ids.some(id => String(id) === String(u.id)));
        const subtitleText = selectedUsers.length === 1 ? `${selectedUsers[0].display_name || selectedUsers[0].username}` : `${selectedUsers.length} staff seleccionados`;
        
        const isDark = document.documentElement.classList.contains('dark');
        const bgMain = isDark ? '#0f172a' : '#f1f5f9';
        const bgCard = isDark ? '#1e293b' : '#ffffff';
        const textMain = isDark ? '#f8fafc' : '#1e293b';
        const textSecondary = isDark ? '#94a3b8' : '#475569';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        
        const roles = ['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF', 'CLIENTE'];
        
        const html = `
            <div class="space-y-5" style="padding-right: 8px;">
                <!-- Barra de navegación 3 botones - SOLO EDITAR/GESTIONAR/ROL -->
                <div class="flex items-center justify-center gap-3 p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <button onclick="App.editSingleUserConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                    <button onclick="App.showManageUserActionConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
                    <button onclick="App.showRoleSelectorForUsersConfig(App._savedSelectedUsersConfig)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #3b82f6;" title="Asignar Rol"><span class="material-symbols-outlined text-sm">badge</span></button>
                </div>
                <!-- Título -->
                <div class="flex items-center p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                    <div class="flex flex-col flex-1">
                        <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Asignar Rol</span>
                        <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                    </div>
                </div>
                <!-- Lista de roles -->
                <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                    ${roles.map(role => {
                        const roleColors = { ADMIN: '#ef4444', PRODUCTOR: '#f59e0b', LOGISTICO: '#3b82f6', STAFF: '#10b981', CLIENTE: '#8b5cf6' };
                        const roleColor = roleColors[role] || '#64748b';
                        const roleIcons = { ADMIN: 'admin_panel_settings', PRODUCTOR: 'movie', LOGISTICO: 'inventory', STAFF: 'person', CLIENTE: 'person' };
                        return `
                        <div onclick="App.assignRoleToUsersConfig('${ids.join(',')}', '${role}')" class="flex items-center gap-4 p-4 rounded-2xl mb-2 cursor-pointer hover:scale-[1.02] transition-all" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: ${roleColor}20; color: ${roleColor};">
                                <span class="material-symbols-outlined text-sm">${roleIcons[role]}</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold" style="color: ${textMain};">${role}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        Swal.fire({ 
            title: '', 
            html, 
            width: '460px', 
            background: bgMain, 
            color: textMain, 
            showConfirmButton: false, 
            showCloseButton: false, 
            customClass: { popup: 'modal-left-aligned' }, 
            showClass: { popup: '', container: '', backdrop: '' }, 
            hideClass: { popup: '', container: '', backdrop: '' },
            timer: 0
        });
    },
    
    // Asignar rol a usuarios - INDEPENDIENTE para Personal
    assignRoleToUsersConfig: async function(userIdsStr, role) {
        const userIds = userIdsStr.split(',');
        
        try {
            for (const userId of userIds) {
                // Usar el endpoint correcto para cambiar rol
                await this.fetchAPI(`/users/${userId}/role`, {
                    method: 'PUT',
                    body: JSON.stringify({ role })
                });
            }
            
            // Recargar datos
            await this.loadUsersTable();
            
            Swal.fire({ title: '✅ Rol Asignado', text: `Nuevo rol: ${role}`, icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
            
            // Recargar carrusel
            this.showRoleSelectorForUsersConfig(userIds);
        } catch (e) {
            Swal.fire({ title: '⚠️ Error', text: e.message || 'Error al asignar rol', icon: 'error', background: '#0f172a', color: '#fff' });
        }
    },
    
    // Registro rápido de staff desde configuración del evento
    quickRegisterStaff: function() {
        // Usar el modal de invitación existente
        document.getElementById('invite-user-form')?.reset();
        this.state.editingUserId = null;
        
        const modalTitle = document.querySelector('#modal-invite h3');
        if (modalTitle) modalTitle.textContent = 'Añadir Colaborador';
        
        const submitBtn = document.querySelector('#modal-invite button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Crear';
        
        document.getElementById('invite-password').required = true;
        
        const modal = document.getElementById('modal-invite');
        modal?.classList.remove('hidden');
        modal?.setAttribute('aria-hidden', 'false');
    },

    // Filtrar staff del evento
    filterConfigStaff: function() {
        const searchTerm = document.getElementById('config-staff-search')?.value.toLowerCase() || '';
        const users = this.state.configStaffUsers || [];
        
        let tbody = document.getElementById('config-staff-tbody');
        if (!tbody) return;
        
        const filtered = users.filter(u => 
            (u.display_name && u.display_name.toLowerCase().includes(searchTerm)) ||
            (u.username && u.username.toLowerCase().includes(searchTerm)) ||
            (u.email && u.email.toLowerCase().includes(searchTerm)) ||
            (u.role && u.role.toLowerCase().includes(searchTerm))
        );
        
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-[var(--text-muted)] italic text-sm">${searchTerm ? 'No se encontraron resultados.' : 'No hay personal asignado a este evento.'}</td></tr>`;
            return;
        }
        
        tbody.innerHTML = filtered.map(u => `
            <tr class="user-row-premium">
                <td class="px-2 py-3 align-middle" style="width: 40px;">
                    <input type="checkbox" class="config-staff-checkbox" data-user-id="${u.id}" style="width: 16px; height: 16px; cursor: pointer;">
                </td>
                <td class="px-2 py-3 align-middle">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[10px] w-3 h-3 flex items-center justify-center flex-shrink-0" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px;">person</span>
                        <div class="flex flex-col">
                            <div class="font-bold text-sm text-[var(--text-main)]">${u.display_name || u.username}</div>
                            <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">${u.username}</div>
                        </div>
                    </div>
                </td>
                <td class="px-2 py-3 align-middle">
                    <span class="text-xs font-bold" style="color: #3b82f6; background: rgba(59,130,246,0.15); border-radius: 6px; padding: 2px 8px;">${u.role}</span>
                </td>
            </tr>
        `).join('');
    },
    
    // Seleccionar todos los checkboxes de staff en config
    toggleAllConfigStaff: function(checked) {
        document.querySelectorAll('#config-staff-tbody .config-staff-checkbox').forEach(cb => {
            cb.checked = checked;
        });
    },

    // Editar staff desde el panel de configuración del evento
    editStaff: function(userId, username, displayName, role) {
        // Usar la función editUser existente
        this.editUser(userId);
    },

    async removeEventStaff(userId) {
        console.log('[removeEventStaff] Called with userId:', userId);
        const eventId = this.state.event?.id;
        console.log('[removeEventStaff] eventId:', eventId);
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

    // --- PERFIL Y SEGURIDAD (FASE 5) ---
    async loadUserProfile() {
        try {
            const res = await this.fetchAPI('/me');
            if (res && res.success !== false) {
                const user = res;
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
            } else {
                console.warn('[PROFILE] No se pudo cargar el perfil:', res.error);
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

    async handleInviteSubmit(e) {
        e.preventDefault();
        const displayName = document.getElementById('invite-display-name')?.value;
        const username = document.getElementById('invite-username')?.value;
        const password = document.getElementById('invite-password')?.value;
        const role = document.getElementById('invite-role')?.value;
        
        const editingUserId = this.state.editingUserId;
        
        // Validación diferente para crear vs editar
        if (editingUserId) {
            // Modo edición - solo requiere nombre
            if (!displayName) {
                this._notifyAction('Error', 'El nombre es requerido', 'error');
                return;
            }
        } else {
            // Modo creación - requiere todos los campos
            if (!displayName || !username || !password) {
                this._notifyAction('Error', 'Completa todos los campos requeridos', 'error');
                return;
            }
        }
        
        // Si es PRODUCTOR y está en un evento, asignar automáticamente event_id y group_id
        const isProductor = this.state.user?.role === 'PRODUCTOR';
        const currentEvent = this.state.event;
        
        console.log('[INVITE] isProductor:', isProductor);
        console.log('[INVITE] currentEvent:', currentEvent);
        console.log('[INVITE] state.event:', this.state.event);
        
        // Obtener group_id del evento actual (no del usuario)
        const currentGroupId = currentEvent?.group_id;
        
        const userData = {
            display_name: displayName,
            username,
            password,
            role
        };
        
        // SIEMPRE asignar event_id si estamos en un evento (asignar al evento aunque no tenga empresa)
        if (isProductor && currentEvent) {
            userData.event_id = currentEvent.id;
            if (currentGroupId) {
                userData.group_id = currentGroupId;
            }
            console.log('[INVITE] Asignando event_id:', currentEvent.id, 'group_id:', currentGroupId);
        }
        
        try {
            if (editingUserId) {
                // Editar usuario existente - puede editar todos los campos incluyendo rol
                const updateData = { display_name: displayName };
                
                // Si hay role, incluirlo (el backend validará permisos)
                if (role) {
                    updateData.role = role;
                }
                
                await this.fetchAPI(`/users/${editingUserId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });
                this._notifyAction('✓ Actualizado', 'Colaborador actualizado correctamente', 'success');
                delete this.state.editingUserId;
            } else {
                // Crear nuevo usuario con group_id y event_id automáticos
                const res = await this.fetchAPI('/users', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                // Si se creó y hay event_id, asignar al evento
                if (res.success && userData.event_id) {
                    // El backend debería asignar automáticamente, pero verificamos
                    console.log('[INVITE] Usuario creado con ID:', res.userId);
                }
                
                this._notifyAction('✓ Creado', 'Colaborador creado correctamente', 'success');
            }
            
            this.closeInvite();
            this.loadUsersTable();
            // Restaurar carrusel de staff si venimos de ahí
            if (this._savedSelectedUsers?.length) {
                setTimeout(() => this._restoreUserCarouselContext(), 300);
            }
        } catch(err) {
            this._notifyAction('Error', err.message || 'Error al guardar colaborador', 'error');
        }
    },

    async handleCompanySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('company-name')?.value;
        const description = document.getElementById('company-description')?.value;
        const email = document.getElementById('company-email')?.value;
        const phone = document.getElementById('company-phone')?.value;
        const status = document.getElementById('company-status')?.value;
        
        if (!name) {
            this._notifyAction('Error', 'El nombre de la empresa es requerido', 'error');
            return;
        }
        
        const groupId = document.getElementById('company-id-hidden')?.value;
        
        try {
            const data = { name, description, email, phone, status };
            
            if (groupId) {
                // Editar empresa existente
                await this.fetchAPI(`/groups/${groupId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                this._notifyAction('✓ Actualizado', 'Empresa actualizada correctamente', 'success');
            } else {
                // Crear nueva empresa
                await this.fetchAPI('/groups', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                this._notifyAction('✓ Creado', 'Empresa creada correctamente', 'success');
            }
            
            this.closeCompanyModal();
            this.loadGroups();
        } catch(err) {
            this._notifyAction('Error', err.message || 'Error al guardar empresa', 'error');
        }
    },

    // Crear cliente desde modal dedicado
    async handleCreateClientSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('create-client-name')?.value?.trim();
        const email = document.getElementById('create-client-email')?.value?.trim();
        const phone = document.getElementById('create-client-phone')?.value?.trim();
        const group_id = document.getElementById('create-client-company')?.value || null;
        
        if (!name) {
            this._notifyAction('Error', 'El nombre del cliente es requerido', 'error');
            return;
        }
        
        try {
            await this.fetchAPI('/clients', {
                method: 'POST',
                body: JSON.stringify({ name, email, phone, group_id, status: 'ACTIVE' })
            });
            this._notifyAction('✓ Creado', 'Cliente creado correctamente', 'success');
            this.closeCreateClientModal();
            this.loadClients();
            this.loadGroups();
        } catch(err) {
            this._notifyAction('Error', err.message || 'Error al crear cliente', 'error');
        }
    },

    // Crear staff desde modal dedicado
    async handleCreateStaffSubmit(e) {
        e.preventDefault();
        const display_name = document.getElementById('create-staff-name')?.value?.trim();
        const username = document.getElementById('create-staff-email')?.value?.trim();
        const password = document.getElementById('create-staff-password')?.value?.trim();
        const role = document.getElementById('create-staff-role')?.value || 'STAFF';
        const group_id = document.getElementById('create-staff-company')?.value || null;
        
        if (!display_name || !username || !password) {
            this._notifyAction('Error', 'Nombre, email y contraseña son requeridos', 'error');
            return;
        }
        if (password.length < 6) {
            this._notifyAction('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        try {
            await this.fetchAPI('/users', {
                method: 'POST',
                body: JSON.stringify({ display_name, username, password, role, group_id })
            });
            this._notifyAction('✓ Creado', 'Staff creado correctamente', 'success');
            this.closeCreateStaffModal();
            this.loadUsersTable();
            this.loadGroups();
        } catch(err) {
            this._notifyAction('Error', err.message || 'Error al crear staff', 'error');
        }
    },

    // Crear evento desde modal dedicado
    async handleCreateEventSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('create-event-name')?.value?.trim();
        const date = document.getElementById('create-event-date')?.value || null;
        const location = document.getElementById('create-event-location')?.value?.trim();
        const description = document.getElementById('create-event-description')?.value?.trim();
        
        if (!name) {
            this._notifyAction('Error', 'El nombre del evento es requerido', 'error');
            return;
        }
        
        try {
            await this.fetchAPI('/events', {
                method: 'POST',
                body: JSON.stringify({ name, date, location, description, status: 'ACTIVE' })
            });
            this._notifyAction('✓ Creado', 'Evento creado correctamente', 'success');
            this.closeCreateEventModal();
            this.loadEvents();
            this.loadGroups();
        } catch(err) {
            this._notifyAction('Error', err.message || 'Error al crear evento', 'error');
        }
    },

    async testIMAP() {
        const host = document.getElementById('imap-host').value;
        const user = document.getElementById('imap-user').value;
        if (!host || !user) return Swal.fire('Error', 'Completa host y usuario', 'warning');

        Swal.fire({ title: 'Probando...', text: 'Conectando con servidor IMAP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const res = await this.fetchAPI('/email/imap/test', {
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
            confirmButtonColor: '#7c3aed',
            cancelButtonColor: '#475569',
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancelar',
            background: '#0f172a',
            color: '#fff',
            backdrop: 'rgba(0,0,0,0.7)'
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

    // --- MODALES DE SELECCIÓN PREMIUM "FORMULARIO OK" (V12.16.0) ---
    
    async showUserSelectorForGroup(groupId) {
        this.state._pendingUserGroupId = groupId;
        let users = [];
        try { users = await this.fetchAPI('/users'); } catch(e) { console.error(e); }
        
        // Calcular usuarios ya asignados a este grupo para mostrar checkmarks
        const currentUsers = users.filter(u => u.groups && u.groups.some(g => String(g.id) === String(groupId)));
        const selectedIds = currentUsers.map(u => String(u.id));
        
        const html = `
            <div class="space-y-6">
                <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-widest">Asignar a Empresa</span>
                        <span class="text-xs text-slate-400">Selecciona los usuarios para vincular</span>
                    </div>
                    <button onclick="App.navigateToCreateUser()" class="btn-primary !py-2 !px-4 !text-xs shadow-lg">
                        <span class="material-symbols-outlined text-xs">person_add</span> NUEVO USUARIO
                    </button>
                </div>

                <div class="relative group">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors text-sm">search</span>
                    <input type="text" placeholder="Buscar usuario..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600">
                </div>

                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${users.map(u => `
                        <div onclick="App.assignUserToGroup('${groupId}', '${u.id}', ${selectedIds.includes(String(u.id))})" class="selector-item flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group shadow-sm ${selectedIds.includes(String(u.id)) ? 'ring-1 ring-primary/50 bg-primary/10' : ''}">
                            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold group-hover:scale-105 transition-transform">
                                ${u.username[0].toUpperCase()}
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold text-white group-hover:text-primary transition-colors">${u.username}</div>
                                <div class="text-[11px] text-slate-500 uppercase tracking-tighter">${u.role}</div>
                            </div>
                            <div class="w-6 h-6 rounded-lg border-2 ${selectedIds.includes(String(u.id)) ? 'bg-primary border-primary' : 'border-white/10'} flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <span class="material-symbols-outlined text-xs text-white ${selectedIds.includes(String(u.id)) ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity">check</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '450px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { 
                popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl',
                closeButton: 'hover:text-red-500 transition-colors'
            }
        });
    },

    async showUserSelectorForEvent(eventId) {
        this.state._pendingUserEventId = eventId;
        let users = [];
        try { users = await this.fetchAPI('/users'); } catch(e) { console.error(e); }

        const html = `
            <div class="space-y-6">
                <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-widest">Asignar Staff al Evento</span>
                        <span class="text-xs text-slate-400">Busca y selecciona colaboradores</span>
                    </div>
                    <button onclick="App.navigateToCreateUser()" class="btn-primary !py-2 !px-4 !text-[11px] shadow-lg">
                        <span class="material-symbols-outlined text-xs">person_add</span> NUEVO STAFF
                    </button>
                </div>

                <div class="relative group">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors text-sm">search</span>
                    <input type="text" placeholder="Filtrar por nombre o rol..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600">
                </div>

                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${users.map(u => `
                        <div onclick="App.assignUserToEvent('${u.id}', '${eventId}')" class="selector-item flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer group shadow-sm">
                            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-sm font-bold group-hover:scale-105 transition-transform">
                                ${u.username[0].toUpperCase()}
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">${u.username}</div>
                                <div class="text-[11px] text-slate-500 uppercase tracking-tighter">${u.role}</div>
                            </div>
                            <div class="w-6 h-6 rounded-lg border-2 border-white/10 flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                                <span class="material-symbols-outlined text-xs text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">check</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '450px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { 
                popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl',
                closeButton: 'hover:text-red-500 transition-colors'
            }
        });
    },

    async assignUserToGroup(groupId, userId, isSelected) {
        try {
            let res;
            if (isSelected) {
                // Quitar usuario del grupo
                res = await this.fetchAPI(`/groups/${groupId}/users/${userId}`, { method: 'DELETE' });
            } else {
                // Agregar usuario al grupo
                res = await this.fetchAPI(`/groups/${groupId}/users`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: userId })
                });
            }
            if (res.success) {
                this._notifyAction('Éxito', isSelected ? 'Usuario desvinculado.' : 'Usuario asignado.', 'success');
                this.loadGroups();
                this.loadUsersTable();
                // Recargar modal con estado actualizado
                this.showUserSelectorForGroup(groupId);
            } else {
                Swal.fire('Error', res.error || 'No se pudo asignar.', 'error');
            }
        } catch(e) { console.error(e); }
    },

    async assignUserToEvent(userId, eventId) {
        try {
            const res = await this.fetchAPI(`/events/${eventId}/users`, {
                method: 'POST',
                body: JSON.stringify({ userId }) // userId es correcto aquí
            });
            if (res.success) {
                this._notifyAction('Asignado', 'Staff añadido al evento.', 'success');
                this.loadEventStaff(eventId);
                this.loadEvents(); 
                this.loadUsersTable();
                Swal.close();
            } else {
                Swal.fire('Error', res.error || 'No se pudo asignar.', 'error');
            }
        } catch(e) { console.error(e); }
    },


    async showGroupSelector(userId) {
        let groups = [];
        let users = [];
        try { 
            groups = await this.fetchAPI('/groups');
            // Delay para evitar rate limit
            await new Promise(r => setTimeout(r, 100));
            users = await this.fetchAPI('/users');
        } catch(e) { 
            console.error('Error loading data:', e); 
            Swal.fire('Error', 'No se pudo cargar la información.', 'error');
            return;
        }
        
        // Validar que tenemos arrays
        if (!Array.isArray(users) || !Array.isArray(groups)) {
            console.error('API no regresó arrays:', { users, groups });
            Swal.fire('Error', 'Error al obtener datos del servidor.', 'error');
            return;
        }
        
        const user = users.find(u => String(u.id) === String(userId));
        const currentGroupIds = user?.groups?.map(g => String(g.id)) || [];

        const html = `
            <div class="space-y-6">
                <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-widest">Asignar Empresa</span>
                        <span class="text-xs text-slate-400">Vincular usuario a organización</span>
                    </div>
                    <button onclick="App.navigateToCreateGroup()" class="btn-primary !py-2 !px-4 !text-xs shadow-lg">
                        <span class="material-symbols-outlined text-xs">add_business</span> NUEVA EMPRESA
                    </button>
                </div>

                <div class="relative group">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors text-sm">search</span>
                    <input type="text" placeholder="Buscar empresa..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600">
                </div>

                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${groups.map(g => `
                        <div onclick="App.assignGroupToUser('${userId}', '${g.id}')" class="selector-item flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all cursor-pointer group shadow-sm ${currentGroupIds.includes(String(g.id)) ? 'ring-1 ring-blue-500/50 bg-blue-500/10' : ''}">
                            <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-sm font-bold group-hover:scale-105 transition-transform">
                                <span class="material-symbols-outlined">corporate_fare</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">${g.name}</div>
                                <div class="text-[11px] text-slate-500 uppercase tracking-tighter">${g.email || 'Sin contacto'}</div>
                            </div>
                            <div class="w-6 h-6 rounded-lg border-2 border-white/10 flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                                <span class="material-symbols-outlined text-xs text-blue-500 ${currentGroupIds.includes(String(g.id)) ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity">check</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '450px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { 
                popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl',
                closeButton: 'hover:text-red-500 transition-colors'
            }
        });
    },

    async assignGroupToUser(userId, groupId) {
        try {
            // Obtener grupos actuales del usuario
            const users = await this.fetchAPI('/users');
            
            // Validar que es array
            if (!Array.isArray(users)) {
                console.error('API no regresó array de usuarios:', users);
                Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error');
                return;
            }
            
            const user = users.find(u => String(u.id) === String(userId));
            const currentGroupIds = user?.groups?.map(g => String(g.id)) || [];
            
            // Agregar el nuevo grupo si no existe
            if (!currentGroupIds.includes(String(groupId))) {
                currentGroupIds.push(String(groupId));
            } else {
                // Si ya existe, quitarlo (toggle)
                const idx = currentGroupIds.indexOf(String(groupId));
                currentGroupIds.splice(idx, 1);
            }
            
            // Enviar todos los grupos al backend
            const res = await this.fetchAPI(`/users/${userId}/group`, {
                method: 'PUT',
                body: JSON.stringify({ group_id: currentGroupIds }) 
            });
            if (res.success) {
                this._notifyAction('Éxito', 'Empresa asignada correctamente.', 'success');
                await this.refreshAllTables();
                // Recargar modal con estado actualizado
                this.showGroupSelector(userId);
            } else {
                Swal.fire('Error', res.error || 'No se pudo asignar.', 'error');
            }
        } catch(e) { console.error(e); }
    },

    async showEventSelectorForCompany(groupId) {
        let events = [];
        try { events = await this.fetchAPI('/events'); } catch(e) { console.error(e); }
        
        // Obtener eventos actuales de la empresa
        const currentEvents = events.filter(e => String(e.group_id) === String(groupId));
        const selectedIds = currentEvents.map(e => String(e.id));

        const html = `
            <div class="space-y-6">
                <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-widest">Asignar Eventos a Empresa</span>
                        <span class="text-xs text-slate-400">Vincular eventos propiedad de esta organización</span>
                    </div>
                    <button onclick="App.navigateToCreateEvent()" class="btn-primary !py-2 !px-4 !text-xs">
                        + NUEVO EVENTO
                    </button>
                </div>
                <div class="relative group">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors text-sm">search</span>
                    <input type="text" placeholder="Buscar evento..." oninput="App.filterSelectorItems(this, '.selector-item')" 
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600">
                </div>
                <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${events.map(e => `
                        <div onclick="App.toggleEventToCompany('${groupId}', '${e.id}', ${selectedIds.includes(String(e.id))})" class="selector-item flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer group shadow-sm">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 text-sm font-bold group-hover:scale-105 transition-transform">
                                    <span class="material-symbols-outlined">event</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">${e.name}</span>
                                    <span class="text-[10px] text-slate-500">${e.location || 'Sin ubicación'}</span>
                                </div>
                            </div>
                            <div class="w-6 h-6 rounded-lg border-2 ${selectedIds.includes(String(e.id)) ? 'bg-purple-500 border-purple-500' : 'border-white/10'} flex items-center justify-center group-hover:border-purple-500/50 transition-colors">
                                <span class="material-symbols-outlined text-xs text-white ${selectedIds.includes(String(e.id)) ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity">check</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        Swal.fire({
            title: '',
            html,
            width: '450px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { popup: 'rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl' }
        });
    },

    async toggleEventToCompany(groupId, eventId, isSelected) {
        try {
            // Obtener eventos actuales del estado para recalcular el array
            const events = await this.fetchAPI('/events');
            const companyEvents = events.filter(e => String(e.group_id) === String(groupId));
            let newIds = companyEvents.map(e => String(e.id));
            
            if (isSelected) {
                newIds = newIds.filter(id => id !== String(eventId));
            } else {
                newIds.push(String(eventId));
            }

            const res = await this.fetchAPI(`/groups/${groupId}/events`, {
                method: 'PUT',
                body: JSON.stringify({ events: newIds })
            });

            if (res.success) {
                this.showEventSelectorForCompany(groupId);
                await this.refreshAllTables();
            }
        } catch(e) { console.error(e); }
    },

    async removeUserFromEvent(userId, eventId) {
        if (!(await this._confirmAction('¿Quitar este usuario del evento?', 'Esta acción desvinculará al usuario del evento seleccionado.'))) return;
        try {
            await this.fetchAPI(`/users/${userId}/events/${eventId}`, { method: 'DELETE' });
            await this.refreshAllTables();
        } catch(e) { console.error(e); }
    },

    // ─── LEGAL Y QUILL (v12.31.22) ───
    async initQuill() {
        if (this.quillPolicy) return;
        if (typeof window.Quill === 'undefined') {
            try { await window.lazyLoad?.loadQuill(); } catch (err) { console.error('Quill load error:', err); return; }
        }
        const toolbar = [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'clean']];
        this.quillPolicy = new Quill('#editor-policy', { theme: 'snow', modules: { toolbar } });
        this.quillTerms = new Quill('#editor-terms', { theme: 'snow', modules: { toolbar } });
    },

    async loadLegalTexts() {
        await this.initQuill();
        try {
            const s = await this.fetchAPI('/settings');
            const defaultPolicy = `<h2>Protección de Datos</h2><p>Habeas Data (Colombia). Sus datos se usarán para logística del evento.</p>`;
            const defaultTerms = `<h2>Términos y Condiciones</h2><p>El uso de Check Pro implica aceptación de términos de veracidad y privacidad.</p>`;
            if (this.quillPolicy) this.quillPolicy.clipboard.dangerouslyPasteHTML(s.policy_data || defaultPolicy);
            if (this.quillTerms) this.quillTerms.clipboard.dangerouslyPasteHTML(s.terms_conditions || defaultTerms);
            const chk = document.getElementById('check-show-legal-login');
            if (chk) chk.checked = s.show_legal_login !== '0';
        } catch (e) { console.error('[LEGAL] Load error:', e); }
    },

    applyUISettings(settings) {
        const links = document.getElementById('login-legal-links');
        if (links) links.classList.toggle('hidden', settings.show_legal_login === '0');
    },

    // ─── HANDLERS DE FORMULARIOS (v12.31.22) ───
    async handleCreateEvent(e) {
        const id = document.getElementById('ev-id-hidden').value;
        const data = {
            name: document.getElementById('ev-name').value,
            date: document.getElementById('ev-date').value,
            location: document.getElementById('ev-location').value
        };
        try {
            if (id) await this.updateEvent(id, data);
            else await this.fetchAPI('/events', { method: 'POST', body: JSON.stringify(data) });
            this.hideModal('modal-event');
            this.loadEvents();
        } catch(err) { alert("Error: " + err.message); }
    },

    async handleSaveEventFull(e) {
        const id = document.getElementById('evf-id-hidden').value;
        const data = {
            name: document.getElementById('evf-name').value,
            date: document.getElementById('evf-date').value,
            location: document.getElementById('evf-location').value,
            description: document.getElementById('evf-desc').value,
            reg_title: document.getElementById('evf-reg-title').value,
            // ... otros campos ya mapeados en initApp pero que ahora centralizamos
        };
        // Para simplificar esta migración masiva, seguiremos usando App.updateEvent
        if (id) this.updateEvent(id, data);
        else this.fetchAPI('/events', { method: 'POST', body: JSON.stringify(data) });
    },

    async showQR() {
        if (!this.state.event) return alert("Selecciona un evento primero.");
        const url = `${window.location.origin}/register.html?event=${this.state.event.id}`;
        const qrEl = document.getElementById('qr-display');
        const dark = this.state.event.qr_color_dark || '#000000';
        const light = this.state.event.qr_color_light || '#ffffff';
        if (qrEl && typeof qrcode !== 'undefined') {
            qrEl.src = await qrcode.toDataURL(url, { width: 400, margin: 2, color: { dark, light } });
            document.getElementById('modal-qr')?.classList.remove('hidden');
        } else if (qrEl) {
            qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=${dark.replace('#','')}&bgcolor=${light.replace('#','')}`;
            document.getElementById('modal-qr')?.classList.remove('hidden');
        }
    },

    async renderDigitalTicket(guestId) {
        const guest = this.state.guests.find(g => String(g.id) === String(guestId));
        const event = this.state.event;
        if (!guest || !event) return;
        const modal = document.getElementById('modal-ticket');
        document.getElementById('ticket-event-name').textContent = event.name;
        document.getElementById('ticket-guest-name').textContent = guest.name;
        document.getElementById('ticket-date').textContent = new Date(event.date).toLocaleDateString();
        document.getElementById('ticket-location').textContent = event.location;
        const accent = event.ticket_accent_color || '#7c3aed';
        modal.querySelectorAll('.ticket-accent').forEach(el => el.style.color = accent);
        const qrContent = JSON.stringify({ g: guest.id, e: event.id });
        const ticketQrEl = document.getElementById('ticket-qr');
        if (ticketQrEl && typeof qrcode !== 'undefined') {
            ticketQrEl.src = await qrcode.toDataURL(qrContent, { width: 600, margin: 1, color: { dark: event.qr_color_dark || '#000000', light: event.qr_color_light || '#ffffff' } });
        }
        modal.classList.remove('hidden');
        this.state.currentTicketGuest = guest;
    },

    async downloadTicket() {
        const card = document.querySelector('#modal-ticket .ticket-card');
        if (!card || typeof html2canvas === 'undefined') return alert("Error: html2canvas no detectado.");
        const canvas = await html2canvas(card, { useCORS: true, scale: 2 });
        const link = document.createElement('a');
        link.download = `Ticket_${this.state.currentTicketGuest?.name || 'check'}.png`;
        link.href = canvas.toDataURL();
        link.click();
    },

    shareTicketWhatsApp() {
        const g = this.state.currentTicketGuest;
        if (!g) return;
        const text = encodeURIComponent(`Hola ${g.name}, tu boleto aquí: ${window.location.origin}/ticket.html?g=${g.id}&e=${this.state.event.id}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    },

    qrScanner: {
        videoStream: null,
        async start() {
            try {
                this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const video = document.getElementById('qr-video');
                video.srcObject = this.videoStream;
                video.play();
                document.getElementById('btn-start-scan').disabled = true;
                document.getElementById('btn-stop-scan').disabled = false;
            } catch (err) { alert('No se pudo acceder a la cámara.'); }
        },
        stop() {
            if (this.videoStream) this.videoStream.getTracks().forEach(t => t.stop());
            document.getElementById('btn-start-scan').disabled = false;
            document.getElementById('btn-stop-scan').disabled = true;
        }
    }
};

window.switchSystemTab = App.switchSystemTab.bind(App);
window.switchEventTab = App.switchEventTab.bind(App);
window.App.switchConfigTab = App.switchConfigTab.bind(App);

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
    
    // V12.44.361: FORZAR CARGAR ATTENDANCE cuando se muestra cualquier tab del evento
    if (this.state.event && this.state.event.id) {
        console.log('[TAB-CHANGE] Forzando carga de attendance para evento:', this.state.event.id);
        if (typeof this.loadAttendance === 'function') {
            this.loadAttendance(this.state.event.id);
        }
    }
};

// --- DOM READY BOOTSTRAP V12.3.2.2 ---
console.log('[DEBUG] Antes de DOMContentLoaded listener, readyState:', document.readyState);

async function initApp() {
    // Guardia de Página Pública (Fase 11) - Detener SPA en registro.html
    if (window.location.pathname.includes('registro.html') || window.location.search.includes('event=')) {
        return;
    }
    try {
    // 0. Helpers Críticos (Hoisting manual)
    const sf = (id, fn) => { 
        const el = document.getElementById(id); 
        console.log(`[DOM DEBUG] sf: buscando elemento con id "${id}", encontrado:`, !!el);
        if (el) el.addEventListener('submit', fn); 
    };
    const cl = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    
    console.log('[DOM] Inicializando aplicación, readyState:', document.readyState);
    
    // 0.1. ASEGURAR QUE TODOS LOS MODALES ESTÉN OCULTOS AL INICIAR
    document.querySelectorAll('[id^="modal-"]').forEach(modal => {
        if (!modal.classList.contains('hidden')) {
            console.log(`[INIT] Modal ${modal.id} estaba visible, ocultándolo`);
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    });
    
    // 0. Lazy Loading init (Performance)
    window.lazyLoad?.init();
    window.lazyLoad?.observeAll();
    
    // 0.5. QUITAR LOADING SCREEN
    const ls = document.getElementById('loading-screen');
    if (ls) ls.remove();

    // 0.6. INICIALIZAR TEMA OSCURO/CLARO
    App.initTheme();

    // 0.7. ESCUCHAR EVENTOS DE AUTENTICACIÓN
    window.addEventListener('auth:unauthorized', () => {
        App.logout();
    });

    // 0.8. CARGAR VERSIÓN DE LA APLICACIÓN (AUTOMÁTICO)
    App.loadAppVersion();

    // 1. RESTORE SESSION FIRST
    let savedUser = null;
    try {
        savedUser = LS.get('user');
    } catch(e) {
        console.warn("[AUTH] localStorage no disponible:", e);
    }
    
    if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
        try {
            const user = JSON.parse(savedUser);
            if (user && (user.userId || user.token)) {
                window.App.state.user = user;
                // Notificaciones push deshabilitadas - solo se activan manualmente
                // window.App.initPushNotifications().catch(err => console.error('Error inicializando push:', err));
                
                // OCULTAR LOGIN INMEDIATAMENTE (si está visible)
                const loginEl = document.getElementById('view-login');
                if (loginEl) { 
                    loginEl.classList.add('hidden'); 
                    loginEl.style.display = 'none'; 
                }
                
                // CARGAR APP-SHELL
                try {
                    await App.loadAppShell();
                    // Inicializar estado del sidebar (v12.32.0)
                    App.initSidebar();
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
                
                if (user.role === 'ADMIN') {
                    App.updateUIPermissions();
                    App.updateRoleOptions();
                }
                
                // Ocultar pestañas restringidas para PRODUCTOR
                if (user.role === 'PRODUCTOR') {
                    App.hideRestrictedSystemTabs();
                }
                
                // Cargar eventos inicialmente para tener la lista lista
                await App.loadEvents();
                
                // Restaurar vista guardada o navegar según URL
                await App.handleInitialNavigation();
            } else {
                App.showView('login');
            }
        } catch(e){ 
            console.warn("[AUTH] Error parseando usuario:", e);
            App.showView('login'); 
        }
    } else {
        App.showView('login');
    }

    // 2. Init router AFTER session restoration (no synthetic popstate)
    App.initRouter();

    // Handler de Escape para cerrar modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            console.log('[MODAL] Escape presionado, cerrando modales...');
            // Cerrar todos los modales visibles
            document.querySelectorAll('[id^="modal-"]:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
            });
        }
    });

    // 3. Sockets
    if (typeof io !== 'undefined') {
        window.App.state.socket = io();
        window.App.state.socket.on('update_stats', (id) => { if (App.state.event?.id === id) App.updateStats(); });
        window.App.state.socket.on('checkin_update', () => App.loadGuests());
    }

    // Listeners System (Se maneja en attachAppListeners para evitar duplicación)
    // Se mantienen solo los que no están en app-shell o son globales fuera del shell
    
    document.getElementById('nav-tab-dashboard')?.addEventListener('click', () => switchAdminTab(null));

    // 5. Listeners generales

    // Marcar app como cargada (anti-FOUC)
    document.body.classList.add('app-loaded');

    // Login Form
    
    // Función centralizada de login
    async function handleLoginSubmit(e) {
        if (e) e.preventDefault();
        const u = document.getElementById('login-email')?.value; 
        const p = document.getElementById('login-password')?.value;
        if (!u || !p) {
            console.error('[DOM DEBUG] Email o password vacíos');
            return;
        }
        await App.login(u, p);
    }
    
    // Método 1: Submit del formulario
    sf('form-login', handleLoginSubmit);
    
    // Método 2: Click directo en el botón (fallback)
    const loginBtn = document.querySelector('#form-login button[type="submit"]');
    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            await handleLoginSubmit(e);
        });
    }
    
    // Método 3: Delegación de eventos en document (último recurso)
    document.addEventListener('submit', async (e) => {
        if (e.target && e.target.id === 'form-login') {
            await handleLoginSubmit(e);
        }
    }, true); // capture phase

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
            let content = settings[key] || '<p>Contenido no disponible.</p>';
            
            // ELIMINAR completamente todos los atributos style del HTML
            content = content.replace(/\s*style\s*=\s*"[^"]*"/gi, '');
            content = content.replace(/\s*style\s*=\s*'[^']*'/gi, '');
            // Eliminar atributos bgcolor
            content = content.replace(/\s*bgcolor\s*=\s*"[^"]*"/gi, '');
            content = content.replace(/\s*bgcolor\s*=\s*'[^']*'/gi, '');
            
            document.getElementById('modal-legal-content').innerHTML = content;
            modal?.classList.remove('hidden');
        } catch(e) { alert('No se pudo cargar el texto legal.'); }
    }
    cl('btn-open-policy', () => openLegalModal('policy_data', 'Política de Tratamiento de Datos'));
    cl('btn-open-terms', () => openLegalModal('terms_conditions', 'Términos y Condiciones'));
    cl('btn-close-legal', () => document.getElementById('modal-legal')?.classList.add('hidden'));
    cl('btn-close-legal-footer', () => document.getElementById('modal-legal')?.classList.add('hidden'));

    // Logout
    cl('btn-logout', () => App.logout());

    // Sidebar Toggle (v12.32.0)
    cl('btn-toggle-sidebar', () => App.toggleSidebar());

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





    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }




    // 6. Inicialización V10.5
    // Init removido - se usa DOMContentLoaded

    // --- EVENT LISTERS FALTANTES (AGREGADOS V10.5.3) ---
    // Modal de Invitación


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

    // cl('btn-create-event-open', ...) duplicado eliminado

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
        console.log('[CLICK] action detected:', action, 'element:', actionEl);
        
        if (typeof App[action] === 'function') {
            const userId = actionEl.dataset.userId;
            const groupId = actionEl.dataset.groupId;
            const eventId = actionEl.dataset.eventId;
            const status = actionEl.dataset.status;
            
            // Call the matched App function with arguments
            if (action === 'removeUserFromEvent') App.removeUserFromEvent(userId, eventId);
            else if (action === 'removeUserFromGroup') App.removeUserFromGroup(userId, groupId);
            else if (action === 'removeEventStaff') App.removeEventStaff(userId);
            else if (action === 'editStaff') {
                const username = actionEl.dataset.userUsername;
                const displayName = actionEl.dataset.userDisplay;
                const role = actionEl.dataset.userRole;
                App.editStaff(userId, username, displayName, role);
            }
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

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        const groupSearch = document.getElementById('group-search');
        const groupSuggestions = document.getElementById('group-suggestions');
        if (groupSuggestions && !groupSuggestions.classList.contains('hidden')) {
            if (groupSearch && !groupSearch.contains(e.target) && !groupSuggestions.contains(e.target)) {
                App.hideGroupSuggestions();
            }
        }
        const userSearch = document.getElementById('user-search');
        const userSuggestions = document.getElementById('user-suggestions');
        if (userSuggestions && !userSuggestions.classList.contains('hidden')) {
            if (userSearch && !userSearch.contains(e.target) && !userSuggestions.contains(e.target)) {
                App.hideUserSuggestions();
            }
        }
    });

    // --- UTILIDADES ---
    App.filterSelectorItems = function(input, selector) {
        const term = input.value.toLowerCase();
        document.querySelectorAll(selector).forEach(el => {
            const text = el.innerText.toLowerCase();
            el.classList.toggle('hidden', !text.includes(term));
        });
    };

    } catch (error) {
        console.error('[DOM CRITICAL ERROR] Error en inicialización:', error);
        console.error('[DOM CRITICAL ERROR] Stack:', error.stack);
    }
}

// Ejecutar initApp dependiendo del estado del DOM
if (document.readyState === 'loading') {
    // El DOM todavía no está listo, esperar al evento
    console.log('[DOM] Esperando DOMContentLoaded (readyState: loading)');
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // El DOM ya está listo, ejecutar inmediatamente
    console.log('[DOM] DOM ya está listo (readyState:', document.readyState, '), ejecutando initApp inmediatamente');
    initApp();
}

// Retrocompatibilidad
window.showView = (v) => App.showView(v);
window.logout = () => App.logout();
window.copyTemplateVar = (varName) => {
    navigator.clipboard.writeText(varName).then(() => {
        App._notifyAction('Copiado', varName + ' copiado al portapapeles', 'success');
    }).catch(() => alert('No se pudo copiar'));
};

// Función global hideModal expuesta para onclick en HTML
window.hideModal = function(id) { App.hideModal(id); };

// ============================================================
// ASISTENCIA AL EVENTO (ATTENDANCE) - V12.44.250
// ============================================================

App._attendanceLoaded = false;
App._selectedAttendance = [];

App.loadAttendance = async function(eventId) {
    if (!eventId) {
        const pathParts = window.location.pathname.split('/');
        eventId = pathParts[pathParts.length - 1] || this.state.currentEventId;
    }
    if (!eventId) return;
    
    console.log('[FRONTEND] loadAttendance llamado, eventId:', eventId);
    
    try {
        const res = await this.fetchAPI(`/events/${eventId}/attendance`);
        console.log('[FRONTEND] Respuesta attendance:', res);
        this.state.attendance = Array.isArray(res) ? res : (res.data || []);
        console.log('[FRONTEND] state.attendance:', this.state.attendance.length);
        this._attendanceLoaded = true;
        this.populateAttendanceFilters();
        this.filterAttendance();
    } catch(e) {
        console.error('[FRONTEND ATTENDANCE] Error cargando:', e.message);
        this.state.attendance = [];
    }
},

App.populateAttendanceFilters = function() {
    const attendance = this.state.attendance || [];
    
    // Extraer organizaciones únicas
    const orgs = [...new Set(attendance.map(a => a.organization).filter(o => o))];
    const orgSelect = document.getElementById('filter-attendance-org');
    if (orgSelect) {
        orgSelect.innerHTML = '<option value="">Organización</option>' + 
            orgs.map(o => `<option value="${o}">${o}</option>`).join('');
    }
    
    // Extraer cargos únicos
    const cargos = [...new Set(attendance.map(a => a.cargo).filter(c => c))];
    const cargoSelect = document.getElementById('filter-attendance-cargo');
    if (cargoSelect) {
        cargoSelect.innerHTML = '<option value="">Cargo</option>' + 
            cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
},

App.clearAttendanceDatabase = async function() {
    const eventId = this.state.event?.id || this.state.currentEventId;
    if (!eventId) return;

    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción borrará TODOS los asistentes registrados para este evento. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar todo',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#ffffff'
    });

    if (isConfirmed) {
        try {
            Swal.fire({
                title: 'Borrando...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const result = await this.fetchAPI(`/guests/clear/${eventId}`, { method: 'POST' });
            if (result.success) {
                await Swal.fire({ icon: 'success', title: 'Completado', text: 'Base de datos de asistentes limpia.', timer: 1500 });
                this.loadAttendance(eventId);
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: result.error || 'No se pudo limpiar la base de datos' });
            }
        } catch (err) {
            console.error('[CLEAR] Error:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Error de conexión con el servidor' });
        }
    }
},

App.filterAttendance = function() {
    const search = (document.getElementById('attendance-search')?.value || '').toLowerCase();
    const orgFilter = document.getElementById('filter-attendance-org')?.value || '';
    const cargoFilter = document.getElementById('filter-attendance-cargo')?.value || '';
    const veganoFilter = document.getElementById('filter-attendance-vegano')?.value || '';
    const statusFilter = document.getElementById('filter-attendance-status')?.value || '';
    
    let filtered = this.state.attendance || [];
    
    // Filtro de búsqueda
    if (search) {
        const words = search.split(' ').filter(w => w.length > 0);
        filtered = filtered.filter(a => {
            const text = `${a.client_name || ''} ${a.client_email || ''} ${a.client_phone || ''} ${a.organization || ''} ${a.cargo || ''}`.toLowerCase();
            return words.every(w => text.includes(w));
        });
    }
    
    // Filtros
    if (orgFilter) filtered = filtered.filter(a => a.organization === orgFilter);
    if (cargoFilter) filtered = filtered.filter(a => a.cargo === cargoFilter);
    if (veganoFilter) filtered = filtered.filter(a => a.vegano === veganoFilter);
    if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
    
    // Actualizar contador visual dual (Total / Presentes) (V12.44.368)
    const badge = document.getElementById('attendance-total-badge');
    if (badge) {
        const total = filtered.length;
        const present = filtered.filter(a => a.validated === 1).length;
        badge.textContent = `${total} / ${present}`;
    }

    this.renderAttendanceTable(filtered);
},

App.renderAttendanceTable = function(attendance) {
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody) return;
    
    if (!attendance || attendance.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500">No hay asistentes registrados</td></tr>`;
        return;
    }
    
    const selectedIds = this._selectedAttendance || [];
    
    tbody.innerHTML = attendance.map(a => {
        const isSelected = selectedIds.includes(a.client_id);
        const statusColors = { PENDIENTE: '#f59e0b', CONFIRMADO: '#10b981', CANCELADO: '#ef4444' };
        const statusColor = statusColors[a.status] || '#64748b';
        const veganoBadge = a.vegano === 'SI' 
            ? `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400">Sí</span>`
            : `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400">No</span>`;
        
        return `<tr class="hover:bg-white/[0.02] transition-colors">
            <td class="!py-3 !px-3">
                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                    onchange="App.toggleAttendance('${a.client_id}')" 
                    style="width: 16px; height: 16px; cursor: pointer;">
            </td>
            <td class="!py-3 !px-3">
                <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0" style="background: rgba(99,102,241,0.2); color: #6366f1;">
                        ${(a.client_name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-white">${a.client_name || 'Sin nombre'}</div>
                        <div class="text-[11px] text-slate-400">${a.client_email || ''}</div>
                        <div class="text-[11px] text-slate-500">${a.client_phone || ''}</div>
                    </div>
                </div>
            </td>
            <td class="!py-3 !px-3 text-slate-300">${a.organization || '-'}</td>
            <td class="!py-3 !px-3 text-slate-300">${a.cargo || '-'}</td>
            <td class="!py-3 !px-3">${veganoBadge}</td>
            <td class="!py-3 !px-3 text-slate-300 text-xs">${a.restricciones || '-'}</td>
            <td class="!py-3 !px-3">
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase" 
                    style="background: ${statusColor}20; color: ${statusColor};">
                    ${a.status || 'PENDIENTE'}
                </span>
            </td>
            <td class="!py-3 !px-3 text-center">
                <div onclick="App.toggleValidateAttendance('${a.client_id}')" 
                    title="${a.validated ? 'Marcar como ausente' : 'Marcar como presente'}"
                    class="attendance-switch mx-auto ${a.validated ? 'validated' : ''}">
                </div>
            </td>
        </tr>`;
    }).join('');
},

App.toggleSelectAllAttendance = function() {
    const checkbox = document.getElementById('select-all-attendance');
    const attendance = this.state.attendance || [];
    if (checkbox.checked) {
        this._selectedAttendance = attendance.map(a => a.client_id);
    } else {
        this._selectedAttendance = [];
    }
    this.filterAttendance();
},

App.toggleAttendance = function(clientId) {
    const idx = this._selectedAttendance.indexOf(clientId);
    if (idx > -1) {
        this._selectedAttendance.splice(idx, 1);
    } else {
        this._selectedAttendance.push(clientId);
    }
    this.filterAttendance();
},

App.toggleValidateAttendance = async function(clientId) {
    const eventId = this.state.currentEventId || this.state.event?.id;
    if (!eventId || !clientId) {
        console.error('[ATTENDANCE] Error: IDs faltantes para validación', { eventId, clientId });
        return;
    }
    
    const token = this.state.user?.token;
    const attendance = this.state.attendance || [];
    const current = attendance.find(a => a.client_id === clientId);
    if (!current) return;
    
    const newValidated = current.validated ? 0 : 1;
    
    try {
        // Optimismo UI: cambiar estado localmente antes de la petición
        current.validated = newValidated;
        this.filterAttendance();

        const response = await fetch(`/api/events/${eventId}/attendance/${clientId}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ validated: newValidated })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Error en servidor');
        
        console.log(`[ATTENDANCE] Estado de validación actualizado para ${clientId}: ${newValidated}`);
    } catch(e) {
        console.error('[ATTENDANCE] Fallo al validar:', e.message);
        // Revertir cambio en caso de error
        current.validated = newValidated ? 0 : 1;
        this.filterAttendance();
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar la asistencia: ' + e.message });
    }
},

App.showAttendanceSuggestions = function() {
    const input = document.getElementById('attendance-search');
    const container = document.getElementById('attendance-suggestions');
    if (!input || !container) return;
    
    const term = input.value.toLowerCase();
    if (term.length < 2) {
        container.classList.add('hidden');
        return;
    }
    
    const attendance = this.state.attendance || [];
    const matches = attendance.filter(a => 
        (a.client_name || '').toLowerCase().includes(term) ||
        (a.client_email || '').toLowerCase().includes(term) ||
        (a.organization || '').toLowerCase().includes(term)
    ).slice(0, 8);
    
    if (matches.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.innerHTML = matches.map(a => `
        <div class="p-3 hover:bg-white/10 cursor-pointer border-b border-white/5" onclick="App.selectAttendanceSuggestion('${a.client_id}')">
            <div class="text-sm font-bold text-white">${a.client_name}</div>
            <div class="text-[11px] text-slate-400">${a.client_email}</div>
        </div>
    `).join('');
    
    container.classList.remove('hidden');
},

App.hideAttendanceSuggestions = function() {
    const container = document.getElementById('attendance-suggestions');
    if (container) container.classList.add('hidden');
},

App.selectAttendanceSuggestion = function(clientId) {
    const input = document.getElementById('attendance-search');
    const attendance = this.state.attendance || [];
    const a = attendance.find(x => x.client_id === clientId);
    if (a && input) {
        input.value = a.client_name || '';
        this.filterAttendance();
    }
    this.hideAttendanceSuggestions();
},

App.openAddAssistantModal = function() {
    // Limpiar formulario
    document.getElementById('add-attendance-name').value = '';
    document.getElementById('add-attendance-email').value = '';
    document.getElementById('add-attendance-phone').value = '';
    document.getElementById('add-attendance-organization').value = '';
    document.getElementById('add-attendance-cargo').value = '';
    document.getElementById('add-attendance-vegano').value = 'NO';
    document.getElementById('add-attendance-restricciones').value = '';
    
    document.getElementById('modal-add-attendance').classList.remove('hidden');
},

App.openAttendanceCarousel = function() {
    const selected = this._selectedAttendance || [];
    if (selected.length === 0) {
        Swal.fire({ title: '⚠️ Atención', text: 'Selecciona al menos un asistente con el checkbox', icon: 'warning', background: '#0f172a', color: '#fff' });
        return;
    }
    
    // Mostrar carousel similar al de staff
    const isDark = document.documentElement.classList.contains('dark');
    const bgMain = isDark ? '#0f172a' : '#f1f5f9';
    const bgCard = isDark ? '#1e293b' : '#ffffff';
    const textMain = isDark ? '#f8fafc' : '#1e293b';
    const textSecondary = isDark ? '#94a3b8' : '#475569';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    
    const attendance = this.state.attendance || [];
    const selectedAssistants = attendance.filter(a => selected.includes(a.client_id));
    const subtitleText = selectedAssistants.length === 1 
        ? `${selectedAssistants[0].client_name}` 
        : `${selectedAssistants.length} asistentes seleccionados`;
    
    const html = `
        <div class="space-y-5" style="padding-right: 8px;">
            <!-- Barra de navegación 2 botones -->
            <div class="flex items-center justify-between p-3 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                <button onclick="App.editAttendance(App._selectedAttendance)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #f59e0b;" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
                <button onclick="App.manageAttendance(App._selectedAttendance)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style="color: #ef4444;" title="Gestionar"><span class="material-symbols-outlined text-sm">settings</span></button>
            </div>
            <!-- Título -->
            <div class="flex items-center justify-between p-4 rounded-xl" style="background: ${bgCard}; border: 1px solid ${borderColor};">
                <div class="flex flex-col flex-1">
                    <span class="text-[11px] font-black uppercase tracking-widest" style="color: ${textSecondary};">Editar Asistentes</span>
                    <span class="text-xs" style="color: ${textMain};">${subtitleText}</span>
                </div>
            </div>
            <!-- Lista de asistentes seleccionados -->
            <div class="max-h-72 overflow-y-auto pr-2 custom-scrollbar" style="margin: 0 -8px; padding: 0 8px;">
                ${selectedAssistants.map(a => {
                    const statusColors = { PENDIENTE: '#f59e0b', CONFIRMADO: '#10b981', CANCELADO: '#ef4444' };
                    const statusColor = statusColors[a.status] || '#64748b';
                    return `<div class="flex items-center gap-4 p-4 rounded-2xl mb-2" style="background: rgba(255,255,255,0.05); border: 1px solid ${borderColor};">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style="background: rgba(99,102,241,0.2); color: #6366f1;">${(a.client_name || 'A').charAt(0).toUpperCase()}</div>
                        <div class="flex-1">
                            <div class="text-sm font-bold" style="color: ${textMain};">${a.client_name}</div>
                            <div class="text-[11px]" style="color: ${textSecondary};">${a.client_email}</div>
                            <div class="text-[11px]" style="color: ${statusColor};">${a.status}</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    
    Swal.fire({ 
        title: '', 
        html, 
        width: '460px', 
        background: bgMain, 
        color: textMain, 
        showConfirmButton: false, 
        showCloseButton: false, 
        customClass: { popup: 'modal-left-aligned' }, 
        showClass: { popup: '', container: '', backdrop: '' }, 
        hideClass: { popup: '', container: '', backdrop: '' },
        timer: 0
    });
},

App.editAttendance = function(clientIds) {
    // Por implementar: editar asistente(s)
    Swal.fire({ title: '✏️ Editar', text: 'Funcionalidad en desarrollo', icon: 'info', background: '#0f172a', color: '#fff' });
},

App.manageAttendance = function(clientIds) {
    // Por implementar: gestionar asistentes (cambiar estado, eliminar)
    Swal.fire({ title: '⚙️ Gestionar', text: 'Funcionalidad en desarrollo', icon: 'info', background: '#0f172a', color: '#fff' });
},

App.openImportAttendanceModal = function() {
    // Limpiar modal
    document.getElementById('import-attendance-file-input').value = '';
    document.getElementById('import-attendance-progress-container').classList.add('hidden');
    document.getElementById('btn-confirm-import-attendance').disabled = true;
    document.getElementById('import-attendance-new-count').textContent = '0';
    document.getElementById('import-attendance-update-count').textContent = '0';
    document.getElementById('import-attendance-error-count').textContent = '0';
    document.getElementById('import-attendance-progress-fill').style.width = '0%';
    
    // Configurar event listeners para drop zone si no existen
    this.initAttendanceImportHandlers();
    
    document.getElementById('modal-import-attendance').classList.remove('hidden');
},

App.initAttendanceImportHandlers = function() {
    const dropZone = document.getElementById('import-attendance-drop-zone');
    const fileInput = document.getElementById('import-attendance-file-input');
    const btnConfirm = document.getElementById('btn-confirm-import-attendance');
    
    // Click en drop zone abre el file input
    dropZone?.addEventListener('click', () => fileInput?.click());
    
    // Drag over
    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-[var(--primary)]');
    });
    
    // Drag leave
    dropZone?.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-[var(--primary)]');
    });
    
    // Drop
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[var(--primary)]');
        const file = e.dataTransfer.files[0];
        if (file) this.processAttendanceImportFile(file);
    });
    
    // File input change
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.processAttendanceImportFile(file);
    });
    
    // Botón confirmar importación
    btnConfirm?.addEventListener('click', () => this.executeAttendanceImport());
},

App.processAttendanceImportFile = async function(file) {
    // Obtener token
    let token = window.App?.state?.user?.token;
    if (!token) {
        const userStr = LS.get('user');
        const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
        token = user.token || LS.get('token');
    }
    
    // Guardar nombre de archivo
    this._importFilename = file.name;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        this._importBase64 = e.target.result.split(',')[1];
        
        try {
            const response = await fetch('/api/import/validate', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    file: this._importBase64,
                    filename: file.name,
                    type: 'attendance',
                    eventId: this.state.currentEventId
                })
            });
            const data = await response.json();
            
            if (data.success) {
                    this._availableColumns = data.availableColumns || [];
                    this._importStats = data.stats || {}; // Guardar stats reales del servidor
                    
                    // 1. Mostrar progreso/stats iniciales
                    document.getElementById('import-attendance-progress-container').classList.remove('hidden');
                document.getElementById('import-attendance-status').textContent = data.stats.message || 'Archivo procesado';
                document.getElementById('import-attendance-progress-fill').style.width = '100%';
                
                // 2. Gestionar Mapeo (V12.44.298)
                if (data.isMappingRequired && this._availableColumns.length > 0) {
                    const mappingContainer = document.getElementById('import-attendance-mapping-container');
                    const fieldsList = document.getElementById('mapping-fields-list');
                    mappingContainer.classList.remove('hidden');
                    
                    const fields = [
                        { id: 'att-map-name', label: 'Nombre Completo *', key: 'name', icon: 'person', required: true },
                        { id: 'att-map-email', label: 'Email *', key: 'email', icon: 'mail', required: true },
                        { id: 'att-map-phone', label: 'Teléfono', key: 'phone', icon: 'phone' },
                        { id: 'att-map-org', label: 'Organización', key: 'organization', icon: 'corporate_fare' },
                        { id: 'att-map-position', label: 'Cargo', key: 'cargo', icon: 'badge' },
                        { id: 'att-map-dietary', label: 'Restricciones/Dieta', key: 'restricciones', icon: 'restaurant' },
                        { id: 'att-map-vegano', label: 'Vegano (Sí/No)', key: 'vegano', icon: 'leaf' }
                    ];
                    
                    fieldsList.innerHTML = fields.map(f => `
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">${f.icon}</span> ${f.label}
                            </label>
                            <select id="${f.id}" class="premium-select !bg-[var(--bg-main)] !py-2 !text-xs">
                                <option value="">-- No importar --</option>
                                ${this._availableColumns.map(col => {
                                    const lowerName = col.name.toLowerCase();
                                    const lowerLabel = f.label.toLowerCase();
                                    const isSelected = lowerName.includes(f.key) || lowerName.includes(f.label.toLowerCase().split(' ')[0]) ? 'selected' : '';
                                    return `<option value="${col.index}" ${isSelected}>${col.name}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `).join('');

                    // Habilitar botón si hay mapeo básico
                    document.getElementById('btn-confirm-import-attendance').disabled = false;

                    // --- V12.44.304: Listeners para actualizar estadísticas en tiempo real ---
                    const selectors = ['att-map-name', 'att-map-email', 'att-map-phone', 'att-map-org', 'att-map-position', 'att-map-dietary', 'att-map-vegano'];
                    selectors.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.addEventListener('change', () => this.updateAttendanceImportStats(data.availableColumns, data.previewRows, data.stats));
                        }
                    });

                    // Carga inicial de estadísticas (usando data.stats del backend)
                    this.updateAttendanceImportStats(data.availableColumns, data.previewRows, data.stats);
                }
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Error validando archivo' });
            }
        } catch(err) {
            console.error('[IMPORT] Error:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Error al procesar el archivo' });
        }
    };
    reader.readAsDataURL(file);
},

App.updateAttendanceImportStats = function(availableColumns, previewRows, stats) {
    const emailColIndex = document.getElementById('att-map-email')?.value;
    const totalFound = stats?.totalRows || 0;
    
    // Actualizar el mensaje de cabecera del modal para mostrar el TOTAL real
    const statsDetail = document.getElementById('import-attendance-stats-detail');
    if (statsDetail) {
        statsDetail.innerHTML = `<span class="text-[#0ba5ec] font-bold">${totalFound}</span> registros detectados en el archivo.`;
    }

    // Si tenemos estadísticas reales del servidor en el objeto 'stats', usarlas
    // El servidor ahora calcula esto en el /validate (V12.44.309)
    let newCount = stats?.new || 0;
    let updateCount = stats?.update || 0;
    
    // Si el usuario cambia el mapeo, las estadísticas de la muestra pueden variar
    // pero para la versión estable actual, confiamos en el pre-análisis del servidor
    if (emailColIndex && previewRows) {
        const emailIdx = parseInt(emailColIndex);
        let sampleNew = 0;
        let sampleUpdate = 0;
        const currentEmails = new Set((this.state.attendance || []).map(a => (a.client_email || '').toLowerCase()));

        previewRows.forEach(row => {
            const email = (row[emailIdx] || '').toString().trim().toLowerCase();
            if (email && email.includes('@')) {
                if (currentEmails.has(email)) sampleUpdate++;
                else sampleNew++;
            }
        });
        
        // Si no hay stats del servidor (archivo pequeño), usar la muestra
        if (newCount === 0 && updateCount === 0) {
            newCount = sampleNew;
            updateCount = sampleUpdate;
        }
    }

    document.getElementById('import-attendance-new-count').textContent = newCount;
    document.getElementById('import-attendance-update-count').textContent = updateCount;
    document.getElementById('import-attendance-error-count').textContent = '0';
    
    console.log(`[IMPORT STATS] Total: ${totalFound}, Server Stats - New: ${newCount}, Update: ${updateCount}`);
};

App.executeAttendanceImport = async function() {
    if (!this._importBase64) return;
    
    // Obtener token
    let token = window.App?.state?.user?.token;
    if (!token) {
        const userStr = LS.get('user');
        const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
        token = user.token || LS.get('token');
    }
    
    // Recolectar mapeo de los selectores del DOM
    const mapping = {
        name: document.getElementById('att-map-name')?.value,
        email: document.getElementById('att-map-email')?.value,
        phone: document.getElementById('att-map-phone')?.value,
        organization: document.getElementById('att-map-org')?.value,
        cargo: document.getElementById('att-map-position')?.value,
        restricciones: document.getElementById('att-map-dietary')?.value,
        vegano: document.getElementById('att-map-vegano')?.value
    };

    if (!mapping.name || !mapping.email) {
        Swal.fire({ icon: 'warning', title: 'Atención', text: 'Debes mapear al menos Nombre y Email para importar.' });
        return;
    }
    
    const btn = document.getElementById('btn-confirm-import-attendance');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Procesando...';

    try {
        // Obtener eventId
        let eventId = this.state.currentEventId;
        if (!eventId) {
            const urlParts = window.location.pathname.split('/');
            eventId = urlParts[urlParts.length - 1];
        }
        
        const response = await fetch('/api/import/execute', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                type: 'attendance', 
                file: this._importBase64, 
                filename: this._importFilename,
                mapping: mapping,
                eventId: eventId
            })
        });
        const result = await response.json();
        
        if (result.success) {
            Swal.fire({ 
                icon: 'success', 
                title: 'Importación Completada', 
                text: `${result.imported} registros nuevos, ${result.updated} actualizados`,
                timer: 4000,
                toast: true,
                position: 'top-end'
            });
            
            // Cerrar modal y limpiar UI
            document.getElementById('modal-import-attendance').classList.add('hidden');
            document.getElementById('import-attendance-mapping-container').classList.add('hidden');
            document.getElementById('import-attendance-progress-container').classList.add('hidden');
            this._importBase64 = null;
            
            // Recargar datos del dashboard
            if (typeof this.loadAttendance === 'function') {
                await this.loadAttendance(eventId);
            } else if (typeof this.loadGuests === 'function') {
                await this.loadGuests();
            }
        } else {
            throw new Error(result.message || 'Error en el servidor');
        }
    } catch(e) {
        console.error('[IMPORT EXECUTE] Error:', e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo completar la importación: ' + e.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
},

App.exportAttendance = function() {
    document.getElementById('modal-export-attendance').classList.remove('hidden');
},

App.confirmExportAttendance = async function() {
    const format = document.querySelector('input[name="export-attendance-format"]:checked')?.value || 'excel';
    const eventId = this.state.currentEventId;
    const attendance = this.state.attendance || [];
    
    if (attendance.length === 0) {
        Swal.fire({ title: '⚠️ Atención', text: 'No hay asistentes para exportar', icon: 'warning', background: '#0f172a', color: '#fff' });
        return;
    }
    
    try {
        if (format === 'excel') {
            await this.exportAttendanceExcel(attendance);
        } else if (format === 'csv') {
            this.exportAttendanceCSV(attendance);
        } else if (format === 'pdf') {
            await this.exportAttendancePDF(attendance);
        }
        document.getElementById('modal-export-attendance').classList.add('hidden');
    } catch(e) {
        console.error('[EXPORT] Error:', e);
    }
},

App.exportAttendanceExcel = async function(attendance) {
    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asistentes');
    
    ws.columns = [
        { header: 'Nombre', key: 'name', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'phone', width: 15 },
        { header: 'Organización', key: 'org', width: 20 },
        { header: 'Cargo', key: 'cargo', width: 20 },
        { header: 'Vegano', key: 'vegano', width: 10 },
        { header: 'Restricciones', key: 'restricciones', width: 25 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Validado', key: 'validated', width: 10 }
    ];
    
    attendance.forEach(a => {
        ws.addRow({
            name: a.client_name || '',
            email: a.client_email || '',
            phone: a.client_phone || '',
            org: a.organization || '',
            cargo: a.cargo || '',
            vegano: a.vegano || 'NO',
            restricciones: a.restricciones || '',
            status: a.status || 'PENDIENTE',
            validated: a.validated ? 'Sí' : 'No'
        });
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistentes_evento_${this.state.currentEventId}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
},

App.exportAttendanceCSV = function(attendance) {
    const headers = ['Nombre', 'Email', 'Teléfono', 'Organización', 'Cargo', 'Vegano', 'Restricciones', 'Estado', 'Validado'];
    const rows = attendance.map(a => [
        a.client_name || '',
        a.client_email || '',
        a.client_phone || '',
        a.organization || '',
        a.cargo || '',
        a.vegano || 'NO',
        a.restricciones || '',
        a.status || 'PENDIENTE',
        a.validated ? 'Sí' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistentes_evento_${this.state.currentEventId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
},

App.exportAttendancePDF = async function(attendance) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Lista de Asistentes', 14, 20);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const headers = [['Nombre', 'Email', 'Org', 'Estado', 'Validado']];
    const data = attendance.map(a => [
        (a.client_name || '').substring(0, 20),
        (a.client_email || '').substring(0, 25),
        (a.organization || '').substring(0, 15),
        a.status || 'PENDIENTE',
        a.validated ? 'Sí' : 'No'
    ]);
    
    doc.autoTable({ head: headers, body: data, startY: 35, styles: { fontSize: 8 } });
    doc.save(`asistentes_evento_${this.state.currentEventId}_${Date.now()}.pdf`);
};

App.editAttendance = function(clientIds) {
    Swal.close();
    const ids = Array.isArray(clientIds) ? clientIds : [clientIds];
    if (ids.length !== 1) {
        Swal.fire({ title: '⚠️ Atención', text: 'Selecciona un solo asistente para editar', icon: 'warning', background: '#0f172a', color: '#fff' });
        return;
    }
    
    const clientId = ids[0];
    const attendance = this.state.attendance || [];
    const a = attendance.find(x => x.client_id === clientId);
    if (!a) {
        Swal.fire({ title: '⚠️ Error', text: 'Asistente no encontrado', icon: 'error', background: '#0f172a', color: '#fff' });
        return;
    }
    
    // Llenar formulario
    document.getElementById('edit-attendance-client-id').value = clientId;
    document.getElementById('edit-attendance-name').value = a.client_name || '';
    document.getElementById('edit-attendance-email').value = a.client_email || '';
    document.getElementById('edit-attendance-phone').value = a.client_phone || '';
    document.getElementById('edit-attendance-organization').value = a.organization || '';
    document.getElementById('edit-attendance-cargo').value = a.cargo || '';
    document.getElementById('edit-attendance-vegano').value = a.vegano || 'NO';
    document.getElementById('edit-attendance-restricciones').value = a.restricciones || '';
    document.getElementById('edit-attendance-status').value = a.status || 'PENDIENTE';
    
    document.getElementById('modal-edit-attendance').classList.remove('hidden');
};

App.saveEditAttendance = async function() {
    const clientId = document.getElementById('edit-attendance-client-id').value;
    const eventId = this.state.currentEventId;
    
    const data = {
        organization: document.getElementById('edit-attendance-organization').value,
        cargo: document.getElementById('edit-attendance-cargo').value,
        vegano: document.getElementById('edit-attendance-vegano').value,
        restricciones: document.getElementById('edit-attendance-restricciones').value,
        status: document.getElementById('edit-attendance-status').value
    };
    
    try {
        await this.fetchAPI(`/events/${eventId}/attendance/${clientId}`, 'PUT', data);
        document.getElementById('modal-edit-attendance').classList.add('hidden');
        await this.loadAttendance(eventId);
        Swal.fire({ title: '✅ Guardado', text: 'Asistente actualizado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
    } catch(e) {
        Swal.fire({ title: '❌ Error', text: 'No se pudo guardar', icon: 'error', background: '#0f172a', color: '#fff' });
    }
};

App.manageAttendance = function(clientIds) {
    Swal.close();
    const ids = Array.isArray(clientIds) ? clientIds : [clientIds];
    if (ids.length !== 1) {
        Swal.fire({ title: '⚠️ Atención', text: 'Selecciona un solo asistente para gestionar', icon: 'warning', background: '#0f172a', color: '#fff' });
        return;
    }
    
    const clientId = ids[0];
    const attendance = this.state.attendance || [];
    const a = attendance.find(x => x.client_id === clientId);
    if (!a) {
        Swal.fire({ title: '⚠️ Error', text: 'Asistente no encontrado', icon: 'error', background: '#0f172a', color: '#fff' });
        return;
    }
    
    // Llenar info
    document.getElementById('manage-attendance-client-id').value = clientId;
    document.getElementById('manage-attendance-name').textContent = a.client_name || '-';
    document.getElementById('manage-attendance-email').textContent = a.client_email || '-';
    
    // Seleccionar estado actual
    const statusRadios = document.getElementsByName('manage-attendance-status');
    for (let r of statusRadios) {
        r.checked = r.value === (a.status || 'PENDIENTE');
    }
    
    document.getElementById('modal-manage-attendance').classList.remove('hidden');
};

App.saveManageAttendance = async function() {
    const clientId = document.getElementById('manage-attendance-client-id').value;
    const eventId = this.state.currentEventId;
    const newStatus = document.querySelector('input[name="manage-attendance-status"]:checked')?.value || 'PENDIENTE';
    
    try {
        await this.fetchAPI(`/events/${eventId}/attendance/${clientId}`, 'PUT', { status: newStatus });
        document.getElementById('modal-manage-attendance').classList.add('hidden');
        await this.loadAttendance(eventId);
        Swal.fire({ title: '✅ Guardado', text: 'Estado actualizado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
    } catch(e) {
        Swal.fire({ title: '❌ Error', text: 'No se pudo guardar', icon: 'error', background: '#0f172a', color: '#fff' });
    }
};

App.deleteAttendance = async function() {
    const clientId = document.getElementById('manage-attendance-client-id').value;
    const eventId = this.state.currentEventId;
    
    const result = await Swal.fire({
        title: '⚠️ Confirmar',
        text: '¿Estás seguro de eliminar este asistente?',
        icon: 'warning',
        background: '#0f172a',
        color: '#fff',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        await this.fetchAPI(`/events/${eventId}/attendance/${clientId}`, 'DELETE');
        document.getElementById('modal-manage-attendance').classList.add('hidden');
        await this.loadAttendance(eventId);
        Swal.fire({ title: '✅ Eliminado', text: 'Asistente eliminado', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
    } catch(e) {
        Swal.fire({ title: '❌ Error', text: 'No se pudo eliminar', icon: 'error', background: '#0f172a', color: '#fff' });
    }
};

App.searchClientsForAttendance = async function(term) {
    const container = document.getElementById('add-attendance-client-suggestions');
    if (!term || term.length < 2) {
        container.classList.add('hidden');
        return;
    }
    
    try {
        const clients = await this.fetchAPI('/clients');
        const matches = (clients || []).filter(c => 
            (c.name || '').toLowerCase().includes(term.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(term.toLowerCase())
        ).slice(0, 8);
        
        if (matches.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.innerHTML = matches.map(c => `
            <div class="p-3 hover:bg-[var(--bg-hover)] cursor-pointer border-b border-[var(--border)]" onclick="App.selectAttendanceClient('${c.id}', '${c.name}', '${c.email}')">
                <div class="text-sm font-medium text-white">${c.name}</div>
                <div class="text-xs text-[var(--text-muted)]">${c.email}</div>
            </div>
        `).join('');
        
        container.classList.remove('hidden');
    } catch(e) {
        console.error('[SEARCH] Error:', e);
    }
};

App.selectAttendanceClient = function(clientId, name, email) {
    document.getElementById('add-attendance-client-id').value = clientId;
    document.getElementById('add-attendance-client-search').value = name;
    document.getElementById('add-attendance-client-name').textContent = name;
    document.getElementById('add-attendance-client-email').textContent = email;
    document.getElementById('add-attendance-client-initial').textContent = name.charAt(0).toUpperCase();
    document.getElementById('add-attendance-client-info').classList.remove('hidden');
    document.getElementById('add-attendance-client-suggestions').classList.add('hidden');
};

App.clearSelectedAttendanceClient = function() {
    document.getElementById('add-attendance-client-id').value = '';
    document.getElementById('add-attendance-client-search').value = '';
    document.getElementById('add-attendance-client-info').classList.add('hidden');
};

App.saveAddAttendance = async function() {
    const name = document.getElementById('add-attendance-name').value.trim();
    const email = document.getElementById('add-attendance-email').value.trim();
    const phone = document.getElementById('add-attendance-phone').value.trim();
    const eventId = this.state.currentEventId;
    
    if (!name) {
        Swal.fire({ title: '⚠️ Atención', text: 'El nombre es requerido', icon: 'warning', background: '#0f172a', color: '#fff' });
        return;
    }
    
    // Buscar cliente existente o crear nuevo
    let clientId = null;
    
    try {
        // Buscar cliente por email
        const clients = await this.fetchAPI('/clients');
        const existingClient = (clients || []).find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        
        if (existingClient) {
            clientId = existingClient.id;
        } else if (email) {
            // Crear nuevo cliente
            const newClient = await this.fetchAPI('/clients', 'POST', {
                name: name,
                email: email,
                phone: phone
            });
            clientId = newClient.id;
        }
        
        // Agregar a asistencia
        const data = {
            client_id: clientId,
            organization: document.getElementById('add-attendance-organization').value,
            cargo: document.getElementById('add-attendance-cargo').value,
            vegano: document.getElementById('add-attendance-vegano').value,
            restricciones: document.getElementById('add-attendance-restricciones').value,
            status: 'PENDIENTE'
        };
        
        await this.fetchAPI(`/events/${eventId}/attendance`, 'POST', data);
        document.getElementById('modal-add-attendance').classList.add('hidden');
        await this.loadAttendance(eventId);
        Swal.fire({ title: '✅ Agregado', text: 'Asistente agregado correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
        
    } catch(e) {
        console.error('[ADD ATTENDANCE] Error:', e);
        Swal.fire({ title: '❌ Error', text: e.message || 'No se pudo agregar', icon: 'error', background: '#0f172a', color: '#fff' });
    }
};

App.downloadAttendanceTemplate = function() {
    try {
        // Obtener token igual que downloadImportTemplate
        let token = window.App?.state?.user?.token;
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
        }
        
        fetch('/api/import/template/attendance', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) throw new Error('Error en respuesta');
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_asistentes.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            Swal.fire({ title: '✅ Descargado', text: 'Plantilla descargada correctamente', icon: 'success', background: '#0f172a', color: '#fff', timer: 2000 });
        })
        .catch(err => {
            console.error('[TEMPLATE] Error:', err);
            Swal.fire({ title: '❌ Error', text: 'No se pudo descargar la plantilla', icon: 'error', background: '#0f172a', color: '#fff' });
        });
    } catch(e) {
        console.error('[TEMPLATE] Error:', e);
        Swal.fire({ title: '❌ Error', text: 'Error al descargar plantilla', icon: 'error', background: '#0f172a', color: '#fff' });
    }
};

// Click outside para sugerencias de attendance
document.addEventListener('click', (e) => {
    const attendanceSearch = document.getElementById('attendance-search');
    const attendanceSuggestions = document.getElementById('attendance-suggestions');
    if (attendanceSuggestions && !attendanceSuggestions.classList.contains('hidden')) {
        if (attendanceSearch && !attendanceSearch.contains(e.target) && !attendanceSuggestions.contains(e.target)) {
            App.hideAttendanceSuggestions();
        }
    }
});

