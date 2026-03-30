import { LS, lazyLoad } from './src/frontend/utils.js';
import { API } from './src/frontend/api.js';

/**
 * MASTER SCRIPT
 * Version: V12.34.2 (Neutral Dark)
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
const VERSION = '12.34.38';
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
            LS.set('check_app_version', VERSION);
            console.log(`[VERSION] Cache borrada por actualización a V${VERSION}`);
            
            // Forzar reload si la versión en localStorage es diferente
            if (v && v !== VERSION) {
                console.log(`[VERSION] Versión anterior ${v} ≠ nueva ${VERSION}, forzando reload...`);
                // Pequeño delay para asegurar que todo está listo
                setTimeout(() => {
                    window.location.reload(true); // true = forzar carga desde servidor
                }, 500);
            }
        });
    }
}

console.log('[INIT] Script loaded as ESM, LS available');

const App = window.App = {
    state: {
        event: null,
        events: [],
        guests: [],
        user: null,
        socket: null,
        chart: null,
        version: '12.28.18',
        groups: [],
        _navigating: false,
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
        eventsViewMode: 'grid', // 'grid' o 'list'
    },
    constants: { API_URL: '/api' },
    fetchAPI(endpoint, options) { return API.fetchAPI(endpoint, options); },

    // --- NAVEGACIÓN CENTRALIZADA (MODERN PRO) ---
    _isPushingState: false,
    _hasHandledInitialNav: false,
    
    _updateSidebarUI(viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('nav-btn-' + viewId);
        if (activeBtn) activeBtn.classList.add('active');
    },

    // ─── NAVEGACIÓN V12.16.3 ───
    navigate(viewId) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        const activeView = document.getElementById('view-' + viewId);
        if (activeView) {
            activeView.classList.remove('hidden');
            this._updateSidebarUI(viewId);
            
            // Inicialización por vista
            if (viewId === 'system') this.switchSystemTab('users');
            if (viewId === 'my-events') this.loadEvents();
            if (viewId === 'admin') this.switchEventTab('guests');

            // Scroll al inicio
            const mainContent = document.getElementById('app-main-content');
            if (mainContent) mainContent.scrollTop = 0;
            
            // Auto-collapse sidebar en móvil tras navegar
            if (window.innerWidth < 1024) {
                document.getElementById('global-sidebar')?.classList.add('collapsed');
            }
        }
        LS.set('last_view', viewId);
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

    // Smart Sidebar Toggle
    toggleSidebar() {
        const sidebar = document.getElementById('global-sidebar');
        if (!sidebar) return;
        
        const isCollapsed = sidebar.classList.toggle('collapsed');
        LS.set('sidebar_collapsed', isCollapsed);
        
        // Actualizar icono del botón si existe
        const btnIcon = document.querySelector('#btn-toggle-sidebar .material-symbols-outlined');
        if (btnIcon) {
            btnIcon.textContent = isCollapsed ? 'menu' : 'menu_open';
        }
    },

    // Iniciar estado del sidebar
    initSidebar() {
        const sidebar = document.getElementById('global-sidebar');
        if (!sidebar) return;
        
        const wasCollapsed = LS.get('sidebar_collapsed') === true;
        if (wasCollapsed) {
            sidebar.classList.add('collapsed');
            const btnIcon = document.querySelector('#btn-toggle-sidebar .material-symbols-outlined');
            if (btnIcon) btnIcon.textContent = 'menu';
        }
    },

    // Reemplazo de la función antigua de notificación
    _notifyAction(title, message, type = 'success') {
        this.showPremiumToast(title, message, type);
    },

    navigateToCreateEvent(type = 'short') {
        console.log('[NAVIGATE TO CREATE EVENT] Type:', type);
        
        // Cerrar cualquier SweetAlert abierto de forma agresiva
        if (Swal && Swal.close) {
            Swal.close();
        }
        // Remover cualquier overlay de SweetAlert que pueda estar bloqueando
        const swalOverlay = document.querySelector('.swal2-container');
        if (swalOverlay) {
            swalOverlay.remove();
        }
        
        // Siempre abrir el formulario corto (modal-event) para crear eventos
        {
            // Abrir formulario corto (Equipo/Empresa) - navegar a system si no estamos ya ahí
            const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
            const isInSystem = currentView && currentView.id === 'view-system';
            
            if (!isInSystem) {
                this.navigate('system');
            }
            
            setTimeout(() => {
                console.log('[NAVIGATE TO CREATE EVENT] Opening short form modal');
                document.getElementById('ev-id-hidden').value = '';
                const form = document.getElementById('new-event-form');
                if (form) {
                    form.reset();
                    
                    // REMOVER cualquier listener previo (para evitar duplicados)
                    const newForm = form.cloneNode(true);
                    form.parentNode.replaceChild(newForm, form);
                    
                    // AGREGAR listener SOLO AHORA que el usuario va a usar el formulario
                    newForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        console.log('[FORM SUBMIT SHORT] Formulario corto enviado por usuario');
                        this.saveEventShort(e);
                    });
                }
                if (typeof this.updateQRPreview === 'function') this.updateQRPreview();
                
                const modal = document.getElementById('modal-event');
                console.log('[NAVIGATE TO CREATE EVENT] Modal element:', modal);
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.style.display = 'flex';
                    console.log('[NAVIGATE TO CREATE EVENT] Modal should be visible now, classes:', modal.className);
                } else {
                    console.error('[NAVIGATE TO CREATE EVENT] Modal not found!');
                }
            }, 150);
        }
    },

    // Toggle dropdown de emails - usa MODAL/PORTAL para evitar recorte
    toggleEmailDropdown() {
        console.log('[DROPDOWN] toggleEmailDropdown called');
        const modal = document.getElementById('email-menu-modal');
        const modalMenu = document.getElementById('email-modal-menu');
        const mainBtn = document.getElementById('email-main-btn');
        
        if (!modal || !mainBtn) {
            console.error('[DROPDOWN] Modal or button not found!');
            return;
        }
        
        if (modal.classList.contains('show')) {
            console.log('[DROPDOWN] Closing modal');
            this.closeEmailModal();
        } else {
            console.log('[DROPDOWN] Opening modal');
            
            // Calcular posición exacta del botón
            const btnRect = mainBtn.getBoundingClientRect();
            
            // Posicionar el menú debajo del botón
            const top = btnRect.bottom + 4;
            const left = btnRect.left;
            
            modalMenu.style.top = top + 'px';
            modalMenu.style.left = left + 'px';
            
            // Mostrar modal
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            modal.classList.add('show');
            
            // Agregar event listeners a los items del modal
            const modalItems = modal.querySelectorAll('.email-modal-item');
            modalItems.forEach(item => {
                item.onclick = (e) => {
                    const tab = item.getAttribute('data-tab');
                    console.log('[DROPDOWN] Modal item clicked:', tab);
                    this.closeEmailModal();
                    // Pequeño delay para que se cierre el modal antes de navegar
                    setTimeout(() => {
                        this.switchEmailTab(tab);
                    }, 50);
                };
            });
            
            // Cerrar al hacer clic en el backdrop
            const backdrop = document.getElementById('email-modal-backdrop');
            if (backdrop) {
                setTimeout(() => {
                    backdrop.onclick = () => {
                        console.log('[DROPDOWN] Backdrop clicked, closing modal');
                        this.closeEmailModal();
                    };
                }, 10);
            }
        }
    },
    
    // Cerrar el modal de email
    closeEmailModal() {
        const modal = document.getElementById('email-menu-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    },

    // --- ALIASES PARA FUNCIONES DE EMAIL ---
    
    // Alias for email config (calls both SMTP and IMAP config)
    loadEmailConfig: async function() {
        console.log('[EMAIL] Loading email config...');
        if (typeof this.loadSMTPConfig === 'function') {
            await this.loadSMTPConfig();
        }
        if (typeof this.loadIMAPConfig === 'function') {
            await this.loadIMAPConfig();
        }
    },
    
    // Alias for campaigns (loadCampaigns existe)
    loadEmailCampaigns: async function() {
        console.log('[EMAIL] Loading email campaigns...');
        if (typeof this.loadCampaigns === 'function') {
            await this.loadCampaigns();
        }
    },
    
    // Alias for mailing (loadMailingData existe)
    loadMailing: async function() {
        console.log('[EMAIL] Loading mailing...');
        if (typeof this.loadMailingData === 'function') {
            await this.loadMailingData();
        }
    },
    
    // Alias for templates (loadMailingTemplates existe)
    loadEmailTemplates: async function() {
        console.log('[EMAIL] Loading email templates...');
        if (typeof this.loadMailingTemplates === 'function') {
            await this.loadMailingTemplates();
        }
    },

    // Función interna para mostrar sección de email (para compatibilidad)
    _showEmailSection(tabName) {
        this._showEmailTab(tabName);
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
            if (tabId === 'email') {
                this.loadEventEmailConfig(eventId);
                this.loadEventEmailTemplates(eventId);
            } else if (tabId === 'agenda') {
                this.loadEventAgenda(eventId);
            }
        }
    },

    navigateToCreateUser() { 
        this._openUserModalFromSelector = true;
        this.openInviteModal(); 
    },
    navigateToCreateGroup: function() {
        // Cerrar modal de SweetAlert2 si está abierto
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
        this._openCompanyModalFromSelector = true;
        this.openCompanyModal();
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
            this.navigate('admin');
            
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
        console.log('[SIDEBAR] toggleSidebar llamado');
        const sidebar = document.getElementById('global-sidebar');
        console.log('[SIDEBAR] sidebar element:', sidebar);
        if (!sidebar) {
            console.warn('[SIDEBAR] sidebar no encontrado!');
            return;
        }
        const isCollapsed = sidebar.classList.toggle('collapsed');
        console.log('[SIDEBAR] isCollapsed después de toggle:', isCollapsed);
        LS.set('sidebarCollapsed', isCollapsed);
        
        // Cambiar icono del botón
        const btn = document.getElementById('btn-toggle-sidebar');
        if (btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isCollapsed ? 'menu' : 'menu_open';
                console.log('[SIDEBAR] icono actualizado a:', icon.textContent);
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
            // Usar style.display directamente para mayor compatibilidad
            btnAdmin.style.display = shouldShow ? '' : 'none';
            console.log('[SIDEBAR] Panel Admin - visible:', shouldShow, '(isAdmin:', isAdmin, 'hasEvent:', hasSelectedEvent, ')');
        }
        
        // Config. Evento - solo visible si hay evento seleccionado
        const btnEventConfig = document.getElementById('nav-btn-event-config');
        if (btnEventConfig) {
            // Usar style.display directamente para mayor compatibilidad
            btnEventConfig.style.display = hasSelectedEvent ? '' : 'none';
            console.log('[SIDEBAR] Config Evento - visible:', hasSelectedEvent);
        }
    },

    initSidebar() {
        console.log('[SIDEBAR] Inicializando sidebar...');
        
        // FORZAR sidebar expandido al inicio (temporalmente para debugging)
        // const isCollapsed = LS.get('sidebarCollapsed') === true;
        const isCollapsed = false; // Forzar expandido
        console.log('[SIDEBAR] isCollapsed (forzado expandido):', isCollapsed);
        
        if (isCollapsed) {
            const sidebar = document.getElementById('global-sidebar');
            console.log('[SIDEBAR] sidebar element:', sidebar);
            if (sidebar) {
                sidebar.classList.add('collapsed');
                console.log('[SIDEBAR] sidebar colapsado');
            }
            
            const btn = document.getElementById('btn-toggle-sidebar');
            if (btn) {
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = 'menu';
                console.log('[SIDEBAR] botón actualizado a icono "menu"');
            }
        } else {
            console.log('[SIDEBAR] sidebar NO colapsado (expandido)');
            // Asegurarse de que NO tenga clase collapsed
            const sidebar = document.getElementById('global-sidebar');
            if (sidebar) {
                sidebar.classList.remove('collapsed');
                console.log('[SIDEBAR] sidebar expandido (clase collapsed removida)');
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
                    const groupUsers = users.filter(u => u.groups && u.groups.some(gp => String(gp.id) === String(g.id)));
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
                            <button data-action="showEventSelectorForCompany" data-group-id="${g.id}" class="mt-2 text-xs font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Evento</button>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-wrap gap-1.5 max-w-[250px]">${userChips || '<span class="text-xs text-[var(--text-secondary)] italic">Sin usuarios</span>'}</div>
                            <button data-action="showUserSelectorForGroup" data-group-id="${g.id}" class="mt-2 text-xs font-medium text-[var(--text-main)] hover:text-[var(--primary)] transition-colors whitespace-nowrap">+ Usuario</button>
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
                this.loadUsersTable();
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
            this.renderUsersTable(users, groups, events);
        } catch (error) {
            console.error('Error loading users table:', error);
        }
    },

    renderUsersTable: function(users, groups, events) {
        if (!this.state.user) return;
        
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
                const canEdit = isAdmin || (isProductor && u.role !== 'ADMIN');
                const canRemoveGroup = isAdmin;
                const canRemoveEvent = isAdmin || (isProductor && u.role !== 'ADMIN');
                // PRODUCTOR puede eliminar usuarios (pero no ADMIN)
                // ADMIN y PRODUCTOR pueden eliminar usuarios del sistema (pero no admins)
                const canRemoveUser = (isAdmin || isProductor) && u.role !== 'ADMIN';
                const roleOptions = isAdmin ? 
                    ['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF', 'CLIENTE'] :
                    ['PRODUCTOR', 'LOGISTICO', 'STAFF', 'CLIENTE'];
                
                // --- EVENTOS (Premium Chips) ---
                const userEvents = events.filter(e => u.events && u.events.map(ev => String(ev)).includes(String(e.id)));
                const eventChips = userEvents.map(e => `
                    <div class="action-chip-premium mt-1 mr-1">
                        <span class="material-symbols-outlined text-[14px] text-primary">event</span>
                        <span>${e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name}</span>
                        ${canEdit ? `<div data-action="removeUserFromEvent" data-user-id="${u.id}" data-event-id="${e.id}" class="btn-unlink" title="Desvincular Evento"><span class="material-symbols-outlined text-[14px]">close</span></div>` : ''}
                    </div>
                `).join('');

                // --- COLUMNA 1: COLABORADOR ---
                const col1 = `
                    <div class="flex flex-col gap-1">
                        <div class="font-bold text-[var(--text-main)] text-sm tracking-tight">${u.display_name || u.username}</div>
                        <div class="text-[10px] text-[var(--text-secondary)] font-mono opacity-60">${u.username}</div>
                        <div class="flex flex-wrap gap-1 mt-1">${eventChips}</div>
                    </div>
                `;

                // --- COLUMNA 2: ROL / EMPRESA ---
                const groupDisplay = (u.groups && u.groups.length > 0) ? u.groups.map(userGroup => `
                    <div class="action-chip-premium mt-1 mr-1">
                        <span class="material-symbols-outlined text-[14px] text-slate-400">corporate_fare</span>
                        <span class="truncate max-w-[120px]" title="${userGroup.name}">${userGroup.name}</span>
                        ${canRemoveGroup ? `<div data-action="removeUserFromGroup" data-user-id="${u.id}" data-group-id="${userGroup.id}" class="btn-unlink" title="Desvincular Empresa"><span class="material-symbols-outlined text-[14px]">close</span></div>` : ''}
                    </div>
                `).join('') : `<span class="italic text-[var(--text-muted)] text-[10px] mt-1 opacity-50 block">Sin Empresa Asignada</span>`;

                const roleSelect = canEdit ? `
                    <select data-action="changeUserRole" data-user-id="${u.id}" class="bg-slate-800/40 text-[var(--text-main)] text-[10px] font-bold uppercase rounded-lg px-2 py-1.5 border border-white/5 outline-none w-[120px] focus:border-primary mt-2 cursor-pointer transition-all">
                        ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>` : `<div class="text-[10px] font-black tracking-widest uppercase text-primary mt-2">${u.role}</div>`;

                const col2 = `
                    <div class="flex flex-col">
                        <div class="flex flex-wrap items-center gap-1">${groupDisplay}</div>
                        ${roleSelect}
                    </div>
                `;

                // --- COLUMNA 3: ESTADO ---
                const statusLabel = u.status === 'APPROVED' ? 'Activo' : u.status === 'PENDING' ? 'Pendiente' : 'Suspendido';
                const statusClass = u.status === 'APPROVED' ? 'active' : u.status === 'PENDING' ? 'pending' : 'suspended';
                const col3 = `<div class="status-indicator-premium ${statusClass}">${statusLabel}</div>`;

                // --- COLUMNA 4: ACCIONES ---
                const actionAssignCompany = (isAdmin && canEdit) ? `
                    <button data-action="showGroupSelector" data-user-id="${u.id}" class="action-btn-pill">
                        <span class="material-symbols-outlined">add_business</span>
                        Empresa
                    </button>` : '';

                const actionAssignEvent = canEdit ? `
                    <button data-action="showEventSelector" data-user-id="${u.id}" data-events='${JSON.stringify(u.events || [])}' class="action-btn-pill">
                        <span class="material-symbols-outlined">event_note</span>
                        Evento
                    </button>` : '';
                
                const accessBtn = canEdit ? (u.status !== 'APPROVED' ? 
                    `<button data-action="approveUser" data-user-id="${u.id}" data-status="APPROVED" class="action-btn-pill btn-success-soft">
                        <span class="material-symbols-outlined">lock_open</span>
                        Activar
                    </button>` : 
                    `<button data-action="approveUser" data-user-id="${u.id}" data-status="SUSPENDED" class="action-btn-pill btn-danger-soft">
                        <span class="material-symbols-outlined">lock</span>
                        Suspender
                    </button>`) : '';
                
                const editBtn = canEdit ? `
                    <button data-action="editUser" data-user-id="${u.id}" class="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-lg" title="Editar Perfil">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>` : '';
                
                const deleteBtn = canRemoveUser ? `
                    <button data-action="deleteUser" data-user-id="${u.id}" data-user-name="${u.display_name || u.username}" class="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg" title="Eliminar Usuario">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>` : '';
                
                const col4 = `
                    <div class="flex items-center justify-end gap-2">
                        <div class="flex flex-col gap-1.5">
                            ${actionAssignCompany}
                            ${actionAssignEvent}
                        </div>
                        <div class="flex flex-col gap-1.5">
                            ${accessBtn}
                            ${editBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                `;

                return `
                <tr class="user-row-premium">
                    <td class="px-5 py-5 align-top">${col1}</td>
                    <td class="px-5 py-5 align-top">${col2}</td>
                    <td class="px-5 py-5 align-top text-center">${col3}</td>
                    <td class="px-5 py-5 align-top text-right">${col4}</td>
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
    
    // Eliminar usuario completamente
    deleteUser: async function(userId, userName) {
        const currentUserId = this.state.user?.userId;
        const currentUserRole = this.state.user?.role;
        
        // Validaciones de seguridad
        if (userId === currentUserId) {
            Swal.fire('Error', 'No puedes eliminarte a ti mismo', 'error');
            return;
        }
        
        // PRODUCTOR no puede eliminar ADMIN
        if (currentUserRole === 'PRODUCTOR') {
            Swal.fire('Error', 'No tienes permisos para eliminar usuarios', 'error');
            return;
        }
        
        if (!confirm(`¿Estás seguro de eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) return;
        
        try {
            const res = await this.fetchAPI(`/users/${userId}`, { method: 'DELETE' });
            if (res.success) {
                Swal.fire({ title: 'Éxito', text: 'Usuario eliminado', icon: 'success', timer: 1000, showConfirmButton: false });
                this.loadUsersTable();
            } else {
                Swal.fire('Error', res.error || 'No se pudo eliminar el usuario', 'error');
            }
        } catch { Swal.fire('Error', 'Error de red', 'error'); }
    },
    
    // openCreateGroupModal - ver versión en línea ~5632 (showGroupSelector)
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
    
    // Versiones obsoletas eliminadas para unificación V12.16.0
    
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
                hideModal('modal-event');
                document.getElementById('new-event-form').reset();
                this.loadEvents();
            } else {
                alert("Error: " + d.error);
            }
        } catch (e) { alert("Error al crear evento."); }
    },
    
    saveEventFull: async function(e) {
        console.log('[EVENT CREATE] saveEventFull called (FormData version), event:', e);
        
        // Siempre prevenir el comportamiento por defecto
        if (e && e.preventDefault) e.preventDefault();
        
        const f = document.getElementById('new-event-full-form');
        console.log('[EVENT CREATE] Form element found:', f);
        if (!f) {
            console.error('[EVENT CREATE] Form not found!');
            return;
        }
        
        // Validar campos obligatorios antes de procesar - buscar dentro del formulario específico
        const name = f.querySelector('#evf-name')?.value?.trim();
        const date = f.querySelector('#evf-date')?.value?.trim();
        
        console.log('[EVENT CREATE] Validating fields - name:', name, 'date:', date);
        
        if (!name || !date) {
            console.error('[EVENT CREATE] Required fields are empty, aborting');
            alert('Por favor completa los campos obligatorios: Nombre del Evento y Fecha de Inicio');
            return;
        }
        
        const fd = new FormData(f);
        const data = {};
        
        // Debug: mostrar todos los campos del formulario
        console.log('[EVENT CREATE DEBUG] Form elements:');
        for (let el of f.elements) {
            if (el.name) {
                console.log(`  ${el.name}: type=${el.type}, value="${el.value}", checked=${el.checked}, required=${el.required}`);
            }
        }
        
        // El formulario ya tiene los 'name' correctos que coinciden con el esquema Zod
        fd.forEach((v, k) => {
            const el = f.elements[k];
            console.log(`[EVENT CREATE DEBUG] Processing field ${k}: value="${v}", type=${el?.type}`);
            if (el && el.type === 'checkbox') {
                // Convertir boolean a 1/0 para compatibilidad con backend
                data[k] = el.checked ? 1 : 0;
            } else {
                // Convertir null/undefined a string vacío para Zod
                data[k] = v === null || v === undefined || v === 'null' ? '' : v;
            }
        });
        
        // Asegurar que group_id esté presente (campo requerido por esquema pero opcional)
        if (!data.group_id) data.group_id = '';
        
        // Asegurar valores por defecto para campos de color
        if (!data.qr_color_dark) data.qr_color_dark = '#000000';
        if (!data.qr_color_light) data.qr_color_light = '#ffffff';
        if (!data.ticket_accent_color) data.ticket_accent_color = '#7c3aed';
        
        // Debug: mostrar datos que se enviarán
        console.log('[EVENT CREATE FRONTEND] Data to send:', data);
        
        try {
            let res;
            const eventId = document.getElementById('evf-id-hidden')?.value;
            
            if (eventId) {
                // Actualizar evento existente
                res = await this.fetchAPI(`/events/${eventId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            } else {
                // Crear nuevo evento
                res = await this.fetchAPI('/events', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            }
            
            if (res && res.success === false) {
                await this._notifyAction('Error', res.error || 'No se pudo guardar el evento.', 'error', 0);
                return;
            }

            // Actualizar estado local si editamos el evento activo
            if (eventId && this.state.event && String(this.state.event.id) === String(eventId)) {
                Object.assign(this.state.event, data);
            }

            document.getElementById('modal-event-full')?.classList.add('hidden');
            await this.loadEvents();
            await this._notifyAction('✓ Guardado', eventId ? 'Evento actualizado correctamente.' : 'Evento creado correctamente.', 'success');
        } catch (err) {
            console.error('[saveEventFull] Error:', err);
            await this._notifyAction('Error', 'Error al guardar el evento: ' + err.message, 'error', 0);
        }
    },
    
    saveEventShort: async function(e) {
        console.log('[EVENT CREATE] saveEventShort called, event:', e);
        
        // Siempre prevenir el comportamiento por defecto
        if (e && e.preventDefault) e.preventDefault();
        
        const form = document.getElementById('new-event-form');
        console.log('[EVENT CREATE] Short form element found:', form);
        if (!form) {
            console.error('[EVENT CREATE] Short form not found!');
            return;
        }
        
        // Validar campos obligatorios - buscar dentro del formulario específico
        const name = form.querySelector('#ev-name')?.value?.trim();
        const date = form.querySelector('#ev-date')?.value?.trim();
        
        console.log('[EVENT CREATE] Validating short fields - name:', name, 'date:', date);
        
        if (!name || !date) {
            console.error('[EVENT CREATE] Required fields are empty, aborting');
            alert('Por favor completa los campos obligatorios: Nombre del Evento y Fecha de Inicio');
            return;
        }
        
        const fd = new FormData(form);
        const data = {};
        
        // Convertir FormData a objeto
        fd.forEach((v, k) => {
            const el = form.elements[k];
            if (el && el.type === 'checkbox') {
                data[k] = el.checked ? 1 : 0;
            } else {
                data[k] = v === null || v === undefined || v === 'null' ? '' : v;
            }
        });
        
        //También obtener campos por ID para el formulario corto
        const evName = form.querySelector('#ev-name')?.value?.trim();
        const evDate = form.querySelector('#ev-date')?.value?.trim();
        const evLocation = form.querySelector('#ev-location')?.value?.trim();
        const evDesc = form.querySelector('#ev-desc')?.value?.trim();
        
        if (evName) data.name = evName;
        if (evDate) data.date = evDate;
        if (evLocation) data.location = evLocation;
        if (evDesc) data.description = evDesc;
        
        // Valores por defecto para el formulario corto
        if (!data.group_id) data.group_id = '';
        if (!data.qr_color_dark) data.qr_color_dark = '#000000';
        if (!data.qr_color_light) data.qr_color_light = '#ffffff';
        if (!data.ticket_accent_color) data.ticket_accent_color = '#7c3aed';
        
        console.log('[EVENT CREATE SHORT] Data to send:', data);
        
        try {
            const res = await this.fetchAPI('/events', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (res && res.success === false) {
                await this._notifyAction('Error', res.error || 'No se pudo crear el evento.', 'error', 0);
                return;
            }
            
            hideModal('modal-event');
            await this.loadEvents(true); // true = forzar recarga desde el servidor
            await this._notifyAction('✓ Guardado', 'Evento creado correctamente.', 'success');
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
    
    // --- SMTP CONFIG V10.6 ---
    loadSMTPConfig: async function() {
        try {
            const config = await this.fetchAPI('/email/smtp-config');
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
    
    switchEmailTab: function(tabId, element) {
        console.log('[EMAIL] Switching to internal tab:', tabId);
        
        // 1. Actualizar estado visual de la sidebar interna
        const sidebarItems = document.querySelectorAll('.inner-sidebar-item');
        sidebarItems.forEach(item => item.classList.remove('active'));
        
        if (element) {
            element.classList.add('active');
        } else {
            const target = document.querySelector(`.inner-sidebar-item[onclick*="'${tabId}'"]`);
            if (target) target.classList.add('active');
        }

        // 2. Ejecutar lógica de carga y visualización
        this._showEmailSection(tabId);
    },

    navigateEmailSection: function(section) {
        // En la versión V12.16.x, Email es una pestaña de System
        // No forzamos this.navigate('smtp') si ya estamos en system
        this._showEmailSection(section);
    },
    
    _showEmailSection: function(section) {
        // Ocultar todos los contenidos de email
        document.querySelectorAll('.email-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('#sys-content-email .sub-nav-btn').forEach(el => {
            el.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl');
            el.classList.add('bg-white/5', 'text-slate-400');
        });
        
        // Mostrar el contenido seleccionado
        const content = document.getElementById('email-content-' + section);
        const navBtn = document.getElementById('email-nav-' + section);
        const sidebarItem = document.querySelector(`.inner-sidebar-item[onclick*="'${section}'"]`);

        if (content) content.classList.remove('hidden');
        
        // Actualizar botones legacy si existen
        if (navBtn) {
            navBtn.classList.remove('bg-white/5', 'text-slate-400');
            navBtn.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl');
        }

        // Actualizar nueva sidebar interna
        if (sidebarItem) {
            const allSidebarItems = document.querySelectorAll('.inner-sidebar-item');
            allSidebarItems.forEach(i => i.classList.remove('active'));
            sidebarItem.classList.add('active');
        }
        
        // Guardar preferencia en localStorage
        LS.set('active_email_tab', section);
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
            App.loadMailingData();  // Carga eventos y plantillas
            App.updateMailingStats();
            App.loadEmailAccounts(); // Cargar cuentas para selector
        } else if (section === 'campaigns') {
            App.loadCampaigns();  // Cargar campañas
        } else if (section === 'accounts') {
            App.loadEmailAccounts(); // Cargar cuentas
        }
    },

    // ─── MAILING & MAILBOX LOGIC V11.1 ───
    
    async loadEmailTemplates() {
        const grid = document.getElementById('templates-grid');
        if (!grid) return;
        try {
            const response = await this.fetchAPI('/email/email-templates');
            const templates = Array.isArray(response) ? response : (response.data || []);
            this.state.emailTemplates = templates;
            grid.innerHTML = `
                <div onclick="App.openTemplateEditor()" class="card p-6 rounded-xl border border-dashed border-white/20 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[180px]">
                    <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                        <span class="material-symbols-outlined text-2xl">add</span>
                    </div>
                    <span class="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--primary)]">NUEVA PLANTILLA</span>
                </div>
            ` + templates.map(t => `
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
                        <button onclick="App.openTemplateEditor('${t.id}')" class="btn-secondary !py-1.5 !px-3 text-[10px] flex-1">
                            <span class="material-symbols-outlined text-xs">edit</span> EDITAR
                        </button>
                        <button onclick="App.deleteEmailTemplate('${t.id}')" class="btn-secondary !py-1.5 !px-2 !text-red-500 hover:!bg-red-500/10">
                            <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch(e) { console.error('Error templates:', e); }
    },

    async openTemplateEditor(id = null) {
        console.log('[TEMPLATES] Abriendo editor:', id || 'Nueva');
        const modal = document.getElementById('modal-template-editor');
        if (!modal) return;

        // Limpiar campos
        document.getElementById('tpl-name').value = '';
        document.getElementById('tpl-subject').value = '';
        if (this.quillTemplate) this.quillTemplate.setContents([]);
        window.active_template_id = id;

        if (id) {
            const t = this.state.emailTemplates?.find(x => String(x.id) === String(id));
            if (t) {
                document.getElementById('tpl-name').value = t.name;
                document.getElementById('tpl-subject').value = t.subject;
                if (this.quillTemplate) this.quillTemplate.clipboard.dangerouslyPasteHTML(t.body || '');
            }
        }

        modal.classList.remove('hidden');
        
        // Inicializar Quill si no existe
        if (!this.quillTemplate) {
            const selector = '#tpl-quill-editor';
            if (document.querySelector(selector)) {
                this.quillTemplate = new Quill(selector, {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'clean']
                        ]
                    }
                });
            }
        }
    },

    async saveEmailTemplate() {
        const id = window.active_template_id;
        const data = {
            name: document.getElementById('tpl-name').value,
            subject: document.getElementById('tpl-subject').value,
            body: this.quillTemplate ? this.quillTemplate.root.innerHTML : ''
        };

        if (!data.name) return Swal.fire('Atención', 'El nombre de la plantilla es obligatorio.', 'warning');

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/email/email-templates/${id}` : '/email/email-templates';
            const res = await this.fetchAPI(url, { method, body: JSON.stringify(data) });
            
            if (res.success) {
                this._notifyAction('Guardado', 'Plantilla actualizada correctamente.', 'success');
                document.getElementById('modal-template-editor').classList.add('hidden');
                this.loadEmailTemplates();
                this.loadMailingData(); 
            } else {
                Swal.fire('Error', res.error || 'No se pudo guardar la plantilla.', 'error');
            }
        } catch(e) { console.error('Error saving template:', e); }
    },

    async deleteEmailTemplate(id) {
        if (await this._confirmAction('¿Eliminar Plantilla?', 'Esta acción no se puede deshacer.')) {
            try {
                const res = await this.fetchAPI(`/email/email-templates/${id}`, { method: 'DELETE' });
                if (res.success) {
                    this._notifyAction('Eliminada', 'La plantilla ha sido borrada.', 'success');
                    this.loadEmailTemplates();
                    this.loadMailingData();
                }
            } catch(e) { console.error('Error deleting template:', e); }
        }
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
            const res = await this.fetchAPI('/email/email-logs?type=INBOX');
            const logs = res.data || []; 
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

            const templatesRes = await this.fetchAPI('/email/email-templates');
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
            const response = await this.fetchAPI(`/email/email-logs?type=${type}`);
            
            // La API devuelve {data: [], pagination: {}} 
            const logs = response.data || response;
            
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
            const logs = await this.fetchAPI(`/email/email-logs?id=${mailId}`);
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

    syncEmails: async function() {
        if (typeof showLoading === 'function') showLoading('Sincronizando correos...');
        try {
            const res = await this.fetchAPI('/email/imap/sync');
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
            const config = await this.fetchAPI('/email/imap-config');
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
            await this.fetchAPI('/email/imap-config', {
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
            const res = await this.fetchAPI('/email/imap-test', {
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
                if (sbu) sbu.textContent = data.username || 'Usuario';
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
                    await this.loadEvents();
                    this.handleInitialNavigation();
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
            const res = await this.fetchAPI('/email/smtp-test', {
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
            await this.fetchAPI('/email/smtp-config', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert('✓ Configuración SMTP guardada');
        } catch (e) { alert('Error al guardar: ' + e.message); }
    },

    loadMailingTemplates: async function() {
        try {
            const templates = await this.fetchAPI('/email/email-templates');
            const select = document.getElementById('mailing-template-selector');
            if (select) {
                select.innerHTML = '<option value="">-- Selecciona una plantilla --</option>' + 
                    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
            this.state.emailTemplates = templates;
        } catch (e) { console.error('Error loading mailing templates:', e); }
    },

    previewMailingTemplate: async function() {
        const templateSelect = document.getElementById('mailing-template-selector');
        const templateId = templateSelect?.value;
        const container = document.getElementById('mailing-preview-container');
        const subjectInput = document.getElementById('mailing-subject');
        
        if (!templateId) {
            alert('Selecciona una plantilla primero');
            return;
        }
        
        if (!container) return;

        // Buscar en las plantillas guardadas en estado
        const templates = this.state.emailTemplates || [];
        const template = templates.find(t => String(t.id) === String(templateId));
        
        if (!template) {
            // Si no está en estado, buscar en el select
            const option = templateSelect?.options?.[templateSelect.selectedIndex];
            const subject = option?.dataset?.subject || '';
            const body = option?.dataset?.body || '';
            
            if (subjectInput) subjectInput.value = subject;
            
            // Preview simple
            container.innerHTML = body || '<p class="text-slate-500">Sin contenido</p>';
            return;
        }

        // Set subject
        if (subjectInput) subjectInput.value = template.subject || '';

        // Simular previsualización con el primer invitado si existe
        const guests = this.state.mailingGuests || [];
        let guest = guests.find(g => g.selected) || guests[0] || { name: 'INVITADO DE PRUEBA', email: 'prueba@ejemplo.com', unsubscribe_token: 'test-token' };
        
        let body = template.body || '';
        body = body.replace(/{{guest_name}}/g, guest.name || 'Invitado');
        body = body.replace(/{{guest_email}}/g, guest.email || 'email@ejemplo.com');
        body = body.replace(/{{name}}/g, guest.name || 'Invitado');
        body = body.replace(/{{event_name}}/g, this.state.event?.name || 'Evento');
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
        const templateId = document.getElementById('mailing-template-selector')?.value;
        const subject = document.getElementById('mailing-subject')?.value;
        const container = document.getElementById('mailing-preview-container');
        
        if (!templateId || !subject) return alert('Selecciona una plantilla y escribe un asunto');
        
        const eventId = document.getElementById('mailing-event-selector')?.value;
        const selectedGuests = (this.state.mailingGuests || []).filter(g => g.selected);
        
        if (!eventId || selectedGuests.length === 0) return alert('Selecciona un evento y destinatarios');

        if (!confirm('¿Estás seguro de iniciar el envío masivo a ' + selectedGuests.length + ' invitados?')) return;

        try {
            const body = container.innerHTML;
            const recipients = selectedGuests.map(g => ({ email: g.email, name: g.name, organization: g.organization }));
            
            await this.fetchAPI('/email/send-mass', {
                method: 'POST',
                body: JSON.stringify({
                    event_id: eventId,
                    templateId: templateId,
                    recipients: recipients,
                    subject: subject
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

    sendTestEmail: async function() {
        const testEmail = document.getElementById('test-email-input')?.value?.trim();
        if (!testEmail || !testEmail.includes('@')) {
            return alert('Ingresa un email válido para la prueba');
        }
        
        const subject = document.getElementById('mailing-subject')?.value;
        const body = document.getElementById('mailing-preview-container')?.innerHTML;
        
        if (!subject || !body) {
            return alert('Selecciona una plantilla y genera el preview primero');
        }
        
        try {
            const res = await this.fetchAPI('/email/send-test', {
                method: 'POST',
                body: JSON.stringify({
                    to_email: testEmail,
                    subject: subject,
                    body_html: body
                })
            });
            
            if (res.success) {
                this._notifyAction('✓ Enviado', 'Email de prueba enviado a ' + testEmail, 'success');
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error al enviar: ' + e.message);
        }
    },

    // ─── EMAIL ACCOUNTS MANAGEMENT ───
    
    loadEmailAccounts: async function() {
        const container = document.getElementById('accounts-list');
        if (!container) return;
        
        container.innerHTML = '<div class="p-8 text-center animate-pulse">Cargando cuentas...</div>';
        
        try {
            const accounts = await this.fetchAPI('/email/accounts');
            const selector = document.getElementById('mailing-account-selector');
            
            // Actualizar selector en Mailing
            if (selector) {
                selector.innerHTML = '<option value="">-- Cuenta Principal --</option>' + 
                    accounts.map(a => `<option value="${a.id}" data-host="${a.smtp_host}" data-email="${a.from_email}" data-used="${a.used_today}" data-limit="${a.daily_limit}">${a.name} (${a.from_email})</option>`).join('');
            }
            
            if (!accounts || accounts.length === 0) {
                container.innerHTML = `
                    <div class="card p-8 text-center">
                        <span class="material-symbols-outlined text-5xl text-slate-600 block mb-4">mail</span>
                        <h3 class="text-lg font-bold text-slate-400 mb-2">No hay cuentas adicionales</h3>
                        <p class="text-sm text-slate-500 mb-4">Agrega cuentas adicionales para enviar desde diferentes emails</p>
                        <button onclick="App.openAccountEditor()" class="btn-primary">Agregar Cuenta</button>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = accounts.map(a => `
                <div class="card p-4 border-l-4 ${a.is_default ? 'border-l-green-500' : 'border-l-primary'}">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-white">${a.name}</h3>
                                ${a.is_default ? '<span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">Default</span>' : ''}
                            </div>
                            <p class="text-xs text-slate-400">${a.smtp_host} • ${a.from_email}</p>
                            <p class="text-xs text-slate-500 mt-1">Límite: ${a.used_today || 0}/${a.daily_limit} emails hoy</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="App.testEmailAccount('${a.id}')" class="btn-secondary !py-1 !px-2 text-xs">🧪 Probar</button>
                            <button onclick="App.openAccountEditor('${a.id}')" class="btn-secondary !py-1 !px-2 text-xs">✏️</button>
                            <button onclick="App.deleteEmailAccount('${a.id}')" class="btn-secondary !py-1 !px-2 text-xs !text-red-400">🗑️</button>
                        </div>
                    </div>
                </div>
            `).join('');
            
        } catch (e) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Error: ${e.message}</div>`;
        }
    },
    
    openAccountEditor: async function(accountId = null) {
        const modal = document.getElementById('modal-account-editor');
        
        if (accountId) {
            try {
                const account = await this.fetchAPI(`/email/accounts/${accountId}`);
                document.getElementById('account-id').value = account.id;
                document.getElementById('account-name').value = account.name;
                document.getElementById('account-host').value = account.smtp_host;
                document.getElementById('account-port').value = account.smtp_port;
                document.getElementById('account-user').value = account.smtp_user;
                document.getElementById('account-pass').value = '';
                document.getElementById('account-from-name').value = account.from_name || '';
                document.getElementById('account-from-email').value = account.from_email;
                document.getElementById('account-secure').checked = account.smtp_secure == 1;
                document.getElementById('account-default').checked = account.is_default == 1;
                document.getElementById('account-limit').value = account.daily_limit;
            } catch (e) {
                alert('Error al cargar cuenta: ' + e.message);
                return;
            }
        } else {
            document.getElementById('account-id').value = '';
            document.getElementById('account-name').value = '';
            document.getElementById('account-host').value = '';
            document.getElementById('account-port').value = '587';
            document.getElementById('account-user').value = '';
            document.getElementById('account-pass').value = '';
            document.getElementById('account-from-name').value = '';
            document.getElementById('account-from-email').value = '';
            document.getElementById('account-secure').checked = false;
            document.getElementById('account-default').checked = false;
            document.getElementById('account-limit').value = '500';
        }
        
        modal.classList.remove('hidden');
    },
    
    saveEmailAccount: async function() {
        const id = document.getElementById('account-id').value;
        const data = {
            name: document.getElementById('account-name').value,
            smtp_host: document.getElementById('account-host').value,
            smtp_port: parseInt(document.getElementById('account-port').value) || 587,
            smtp_user: document.getElementById('account-user').value,
            smtp_pass: document.getElementById('account-pass').value,
            smtp_secure: document.getElementById('account-secure').checked,
            from_name: document.getElementById('account-from-name').value,
            from_email: document.getElementById('account-from-email').value,
            is_default: document.getElementById('account-default').checked,
            daily_limit: parseInt(document.getElementById('account-limit').value) || 500
        };
        
        if (!data.name || !data.smtp_host || !data.smtp_user || !data.from_email) {
            return alert('Completa los campos requeridos');
        }
        
        if (!id && !data.smtp_pass) {
            return alert('Ingresa la contraseña SMTP');
        }
        
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/email/accounts/${id}` : '/email/accounts';
            const res = await this.fetchAPI(url, { method, body: JSON.stringify(data) });
            
            if (res.success) {
                this._notifyAction('✓ Guardado', 'Cuenta de email guardada', 'success');
                document.getElementById('modal-account-editor').classList.add('hidden');
                this.loadEmailAccounts();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    },
    
    deleteEmailAccount: async function(id) {
        if (!confirm('¿Eliminar esta cuenta de email?')) return;
        try {
            await this.fetchAPI(`/email/accounts/${id}`, { method: 'DELETE' });
            this._notifyAction('✓ Eliminada', 'Cuenta eliminada', 'success');
            this.loadEmailAccounts();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    },
    
    testEmailAccount: async function(id) {
        try {
            const res = await this.fetchAPI(`/email/accounts/${id}/test`, { method: 'POST' });
            if (res.success) {
                this._notifyAction('✓ Conexión exitosa', 'La cuenta está funcionando correctamente', 'success');
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    },

    controlMailingQueue: async function(action) {
        try {
            const res = await this.fetchAPI('/email/email-queue/' + action, {
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
            const stats = await this.fetchAPI('/email/email-queue/stats');
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
        const id = window.active_template_id;
        const name = document.getElementById('tpl-name').value;
        const subject = document.getElementById('tpl-subject').value;
        const body = this.quillTemplate ? this.quillTemplate.root.innerHTML : document.getElementById('tpl-quill-editor')?.innerHTML || '';
        
        if (!name || !subject) return alert('Completa el nombre y asunto');

        try {
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `/email/email-templates/${id}` : '/email/email-templates';
            
            const res = await this.fetchAPI(endpoint, {
                method: method,
                body: JSON.stringify({ name, subject, body })
            });
            
            if (res.success || res.id) {
                this._notifyAction('Guardado', 'Plantilla guardada correctamente', 'success');
                document.getElementById('modal-template-editor').classList.add('hidden');
                this.loadEmailTemplates();
                if (this.state.email_admin_section === 'mailing') {
                    this.loadMailingData();
                }
            } else {
                alert('Error: ' + (res.error || 'No se pudo guardar'));
            }
        } catch (e) { 
            console.error('Error saving template:', e);
            alert('Error al guardar: ' + e.message); 
        }
    },

    initDNSGuide: function() {
        const isDismissed = LS.get('dns_guide_dismissed');
        const banner = document.getElementById('dns-guide-banner');
        if (banner) {
            if (isDismissed) banner.classList.add('hidden');
            else banner.classList.remove('hidden');
        }
    },

    dismissDNSGuide: function() {
        LS.set('dns_guide_dismissed', 'true');
        document.getElementById('dns-guide-banner')?.classList.add('hidden');
    },

    deleteEmailTemplate: async function(id) {
        if (!confirm('¿Seguro que quieres eliminar esta plantilla permanente?')) return;
        try {
            await this.fetchAPI(`/email/email-templates/${id}`, { method: 'DELETE' });
            this.loadEmailTemplates();
            if (this.state.email_admin_section === 'mailing') this.loadMailingTemplates();
        } catch (e) { alert('Error al eliminar: ' + e.message); }
    },

    // ─── CAMPAIGNS MANAGEMENT ───
    
    loadCampaigns: async function() {
        const container = document.getElementById('campaigns-list');
        if (!container) return;
        
        container.innerHTML = '<div class="p-8 text-center animate-pulse">Cargando campañas...</div>';
        
        try {
            const campaigns = await this.fetchAPI('/email/campaigns');
            
            if (!campaigns || campaigns.length === 0) {
                container.innerHTML = `
                    <div class="card p-8 text-center">
                        <span class="material-symbols-outlined text-5xl text-slate-600 block mb-4">campaign</span>
                        <h3 class="text-lg font-bold text-slate-400 mb-2">No hay campañas</h3>
                        <p class="text-sm text-slate-500 mb-4">Crea tu primera campaña de email masivo</p>
                        <button onclick="App.openCampaignEditor()" class="btn-primary">Crear Campaña</button>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = campaigns.map(c => {
                const statusColors = {
                    'DRAFT': 'bg-slate-500',
                    'SCHEDULED': 'bg-yellow-500',
                    'RUNNING': 'bg-green-500',
                    'PAUSED': 'bg-orange-500',
                    'COMPLETED': 'bg-blue-500',
                    'CANCELLED': 'bg-red-500'
                };
                const statusLabels = {
                    'DRAFT': 'Borrador',
                    'SCHEDULED': 'Programada',
                    'RUNNING': 'Enviando',
                    'PAUSED': 'Pausada',
                    'COMPLETED': 'Completada',
                    'CANCELLED': 'Cancelada'
                };
                
                const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
                
                return `
                <div class="card p-4 border-l-4 ${c.status === 'RUNNING' ? 'border-l-green-500' : 'border-l-primary'}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-white">${c.name}</h3>
                            <p class="text-xs text-slate-400">${c.event_name || 'Sin evento'} · ${c.template_name || 'Sin plantilla'}</p>
                        </div>
                        <span class="px-2 py-1 rounded-full text-[10px] font-bold text-white ${statusColors[c.status]}">${statusLabels[c.status]}</span>
                    </div>
                    
                    <div class="flex items-center gap-4 text-xs text-slate-400 mb-3">
                        <span>📧 ${c.total_recipients} destinatarios</span>
                        <span>✓ ${c.sent_count} enviados</span>
                        <span class="${c.error_count > 0 ? 'text-red-400' : ''}">❌ ${c.error_count} errores</span>
                    </div>
                    
                    ${c.status === 'RUNNING' || c.status === 'PAUSED' ? `
                    <div class="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                        <div class="h-full bg-gradient-to-r from-primary to-green-500 transition-all" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-xs text-center text-slate-500 mb-3">${progress}% completado</div>
                    ` : ''}
                    
                    <div class="flex gap-2">
                        ${c.status === 'DRAFT' ? `<button onclick="App.editCampaign('${c.id}')" class="btn-secondary !py-1 !px-2 text-xs">✏️ Editar</button>` : ''}
                        ${c.status === 'DRAFT' ? `<button onclick="App.startCampaign('${c.id}')" class="btn-primary !py-1 !px-2 text-xs">▶️ Iniciar</button>` : ''}
                        ${c.status === 'RUNNING' ? `<button onclick="App.pauseCampaign('${c.id}')" class="btn-secondary !py-1 !px-2 text-xs">⏸️ Pausar</button>` : ''}
                        ${c.status === 'PAUSED' ? `<button onclick="App.resumeCampaign('${c.id}')" class="btn-primary !py-1 !px-2 text-xs">▶️ Reanudar</button>` : ''}
                        ${c.status === 'RUNNING' || c.status === 'PAUSED' ? `<button onclick="App.cancelCampaign('${c.id}')" class="btn-secondary !py-1 !px-2 text-xs !text-red-400">⏹️ Cancelar</button>` : ''}
                        ${c.status === 'COMPLETED' ? `<button onclick="App.viewCampaignReport('${c.id}')" class="btn-secondary !py-1 !px-2 text-xs">📊 Reporte</button>` : ''}
                        <button onclick="App.deleteCampaign('${c.id}')" class="btn-secondary !py-1 !px-2 text-xs !text-red-400">🗑️</button>
                    </div>
                </div>
                `;
            }).join('');
            
        } catch (e) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Error al cargar: ${e.message}</div>`;
        }
    },
    
    openCampaignEditor: async function(campaignId = null) {
        const modal = document.getElementById('modal-campaign-editor');
        
        // Cargar eventos y plantillas
        try {
            const [events, templates] = await Promise.all([
                this.fetchAPI('/events'),
                this.fetchAPI('/email/email-templates')
            ]);
            
            document.getElementById('campaign-event-select').innerHTML = '<option value="">-- Sin evento específico (todos) --</option>' + 
                events.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
            
            document.getElementById('campaign-template-select').innerHTML = '<option value="">-- Seleccionar plantilla --</option>' + 
                templates.map(t => `<option value="${t.id}" data-subject="${t.subject}" data-body="${t.body}">${t.name}</option>`).join('');
            
            if (campaignId) {
                const campaign = await this.fetchAPI(`/email/campaigns/${campaignId}`);
                document.getElementById('campaign-id').value = campaign.id;
                document.getElementById('campaign-name').value = campaign.name;
                document.getElementById('campaign-event-select').value = campaign.event_id || '';
                document.getElementById('campaign-subject').value = campaign.subject || '';
                document.getElementById('campaign-body').value = campaign.body_html || '';
                
                if (campaign.filters) {
                    const f = typeof campaign.filters === 'string' ? JSON.parse(campaign.filters) : campaign.filters;
                    document.getElementById('campaign-filter-search').value = f.search || '';
                    document.getElementById('campaign-filter-gender').value = f.gender || '';
                    document.getElementById('campaign-filter-checkedin').value = f.checked_in === null ? '' : (f.checked_in ? '1' : '0');
                }
            } else {
                document.getElementById('campaign-id').value = '';
                document.getElementById('campaign-name').value = '';
                document.getElementById('campaign-subject').value = '';
                document.getElementById('campaign-body').value = '';
            }
            
            modal.classList.remove('hidden');
            
        } catch (e) {
            alert('Error al cargar datos: ' + e.message);
        }
    },
    
    saveCampaign: async function() {
        const id = document.getElementById('campaign-id').value;
        const data = {
            name: document.getElementById('campaign-name').value,
            event_id: document.getElementById('campaign-event-select').value || null,
            template_id: document.getElementById('campaign-template-select').value || null,
            subject: document.getElementById('campaign-subject').value,
            body_html: document.getElementById('campaign-body').value,
            filters: JSON.stringify({
                search: document.getElementById('campaign-filter-search').value,
                gender: document.getElementById('campaign-filter-gender').value,
                checked_in: document.getElementById('campaign-filter-checkedin').value === '' ? null : (document.getElementById('campaign-filter-checkedin').value === '1')
            })
        };
        
        if (!data.name) return alert('El nombre es requerido');
        
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/email/campaigns/${id}` : '/email/campaigns';
            const res = await this.fetchAPI(url, { method, body: JSON.stringify(data) });
            
            if (res.success) {
                alert(id ? '✓ Campaña actualizada' : `✓ Campaña creada con ${res.recipients} destinatarios`);
                document.getElementById('modal-campaign-editor').classList.add('hidden');
                this.loadCampaigns();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error al guardar: ' + e.message);
        }
    },
    
    startCampaign: async function(id) {
        if (!confirm('¿Iniciar esta campaña? Se comenzará a enviar inmediatamente.')) return;
        try {
            const res = await this.fetchAPI(`/email/campaigns/${id}/start`, { method: 'POST' });
            if (res.success) {
                alert(`✓ Campaña iniciada. ${res.queued} emails encolados.`);
                this.loadCampaigns();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) { alert('Error: ' + e.message); }
    },
    
    pauseCampaign: async function(id) {
        try {
            await this.fetchAPI(`/email/campaigns/${id}/pause`, { method: 'POST' });
            this.loadCampaigns();
        } catch (e) { alert('Error: ' + e.message); }
    },
    
    resumeCampaign: async function(id) {
        try {
            await this.fetchAPI(`/email/campaigns/${id}/resume`, { method: 'POST' });
            this.loadCampaigns();
        } catch (e) { alert('Error: ' + e.message); }
    },
    
    cancelCampaign: async function(id) {
        if (!confirm('¿Cancelar esta campaña? Los emails ya enviados no se recuperan.')) return;
        try {
            await this.fetchAPI(`/email/campaigns/${id}/cancel`, { method: 'POST' });
            this.loadCampaigns();
        } catch (e) { alert('Error: ' + e.message); }
    },
    
    deleteCampaign: async function(id) {
        if (!confirm('¿Eliminar esta campaña permanentemente?')) return;
        try {
            await this.fetchAPI(`/email/campaigns/${id}`, { method: 'DELETE' });
            this.loadCampaigns();
        } catch (e) { alert('Error: ' + e.message); }
    },
    
    viewCampaignReport: async function(id) {
        try {
            const report = await this.fetchAPI(`/email/campaigns/${id}/report`);
            
            const html = `
            <div class="space-y-4">
                <div class="grid grid-cols-4 gap-4 text-center">
                    <div class="p-4 bg-blue-500/20 rounded-lg">
                        <div class="text-2xl font-bold text-blue-400">${report.stats.total}</div>
                        <div class="text-xs text-slate-400">Total</div>
                    </div>
                    <div class="p-4 bg-green-500/20 rounded-lg">
                        <div class="text-2xl font-bold text-green-400">${report.stats.sent}</div>
                        <div class="text-xs text-slate-400">Enviados</div>
                    </div>
                    <div class="p-4 bg-yellow-500/20 rounded-lg">
                        <div class="text-2xl font-bold text-yellow-400">${report.stats.pending}</div>
                        <div class="text-xs text-slate-400">Pendientes</div>
                    </div>
                    <div class="p-4 bg-red-500/20 rounded-lg">
                        <div class="text-2xl font-bold text-red-400">${report.stats.errors}</div>
                        <div class="text-xs text-slate-400">Errores</div>
                    </div>
                </div>
                ${report.stats.errors > 0 ? `
                <div class="mt-4">
                    <h4 class="font-bold text-red-400 mb-2">Últimos Errores</h4>
                    <div class="space-y-2 max-h-[200px] overflow-y-auto">
                        ${report.recentErrors.map(e => `
                            <div class="p-2 bg-red-500/10 rounded text-xs">
                                <span class="text-red-400">${e.to_email}</span>: ${e.error_message || 'Error desconocido'}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            `;
            
            document.getElementById('campaign-report-content').innerHTML = html;
            document.getElementById('modal-campaign-report').classList.remove('hidden');
            
        } catch (e) {
            alert('Error al cargar reporte: ' + e.message);
        }
    },
    
    onCampaignTemplateChange: function() {
        const select = document.getElementById('campaign-template-select');
        const option = select.options[select.selectedIndex];
        if (option) {
            document.getElementById('campaign-subject').value = option.dataset.subject || '';
            document.getElementById('campaign-body').value = option.dataset.body || '';
        }
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
        console.log('[EMAIL] Switching to tab:', tab);
        
        // Primero, asegurarnos de que estamos en la vista de sistema
        if (!document.getElementById('view-system') || document.getElementById('view-system').classList.contains('hidden')) {
            console.log('[EMAIL] Not in system view, navigating first...');
            this.navigate('system', { tab: 'email' }, true);
            // Esperar un momento para que la navegación se complete
            setTimeout(() => {
                this._showEmailTab(tab);
            }, 100);
            return;
        }
        
        // Si ya estamos en system view, mostrar la pestaña
        this._showEmailTab(tab);
    },
    
    _showEmailTab: function(tab) {
        console.log('[EMAIL] Showing tab:', tab);
        
        // Ocultar todos los contenidos de email
        document.querySelectorAll('.email-content').forEach(c => {
            c.classList.add('hidden');
            c.style.display = 'none';
            c.style.visibility = 'hidden';
            c.style.opacity = '0';
        });
        
        // Mostrar el contenido seleccionado
        const contentId = 'email-content-' + tab;
        const contentEl = document.getElementById(contentId);
        if (contentEl) {
            contentEl.classList.remove('hidden');
            contentEl.style.display = 'block';
            contentEl.style.visibility = 'visible';
            contentEl.style.opacity = '1';
            console.log('[EMAIL] Showing content:', contentId);
        } else {
            console.error('[EMAIL] Content not found:', contentId);
        }
        
        // Actualizar título de la sección
        const titles = {
            'config': 'Configuración',
            'accounts': 'Cuentas',
            'campaigns': 'Campañas',
            'mailbox': 'Buzón',
            'mailing': 'Mailing',
            'templates': 'Plantillas'
        };
        
        const titleEl = document.getElementById('email-section-title');
        const descEl = document.getElementById('email-section-description');
        
        if (titleEl) {
            titleEl.innerHTML = `⚙️ <span class="text-[var(--primary)]">${titles[tab] || tab}</span> de Email`;
        }
        
        if (descEl) {
            const descriptions = {
                'config': 'Configura los servidores SMTP/IMAP para el envío y recepción de emails.',
                'accounts': 'Gestiona las cuentas de email configuradas en el sistema.',
                'campaigns': 'Crea y gestiona campañas de email marketing.',
                'mailbox': 'Revisa y gestiona los emails recibidos en el buzón.',
                'mailing': 'Envía emails masivos a listas de contactos.',
                'templates': 'Crea y gestiona plantillas de email reutilizables.'
            };
            descEl.textContent = descriptions[tab] || 'Gestión de email';
        }
        
        // Cerrar el dropdown si está abierto
        const dropdown = document.getElementById('email-dropdown-menu');
        if (dropdown && dropdown.classList.contains('show')) {
            this.toggleEmailDropdown();
        }
    },
    
    loadEventEmailConfig: async function(eventId) {
        try {
            const config = await this.fetchAPI(`/events/${eventId}/email-config`);
            if (!config) return;
            
            // Verificar existencia de elementos antes de configurarlos
            const el = (id) => document.getElementById(id);
            
            if (el('ev-smtp-enabled')) el('ev-smtp-enabled').checked = config.enabled == 1;
            if (el('ev-smtp-host')) el('ev-smtp-host').value = config.smtp_host || '';
            if (el('ev-smtp-port')) el('ev-smtp-port').value = config.smtp_port || 587;
            if (el('ev-smtp-secure')) el('ev-smtp-secure').checked = config.smtp_secure == 1;
            if (el('ev-smtp-user')) el('ev-smtp-user').value = config.smtp_user || '';
            if (el('ev-smtp-pass')) el('ev-smtp-pass').value = config.smtp_pass || '';
            if (el('ev-smtp-from-name')) el('ev-smtp-from-name').value = config.from_name || '';
            if (el('ev-smtp-from-email')) el('ev-smtp-from-email').value = config.from_email || '';
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
        console.log('[VIEW] Mostrando:', viewName);
        
        // PREVENIR ejecuciones múltiples
        if (this._showingView === viewName) {
            console.log('[VIEW] Ya en proceso de mostrar:', viewName);
            return;
        }
        this._showingView = viewName;
        
        // Mapear y mostrar
        let targetId = "view-" + viewName;
        if (['legal', 'account'].includes(viewName)) targetId = "view-system";
        
        // Si la vista objetivo ya está visible, no hacer nada
        const target = document.getElementById(targetId);
        if (target && !target.classList.contains('hidden')) {
            console.log('[VIEW] Ya visible:', viewName);
            this._showingView = null;
            return;
        }
        
        if (viewName === 'login') {
            console.log('[VIEW] Mostrando login, ocultando app-container');
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
            console.log('[VIEW] Mostrando vista no-login, mostrando app-container');
            const loginEl = document.getElementById('view-login');
            const appContainer = document.getElementById('app-container');
            
            console.log('[VIEW] loginEl:', loginEl);
            console.log('[VIEW] appContainer:', appContainer);
            
            if (loginEl) {
                loginEl.classList.add('hidden');
                loginEl.style.display = 'none';
                console.log('[VIEW] Login ocultado');
            }
            
            if (appContainer) {
                appContainer.classList.remove('hidden');
                appContainer.style.display = 'flex';
                console.log('[VIEW] app-container mostrado (clase hidden removida)');
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
        } else {
            console.error('[VIEW] ERROR: No se pudo encontrar ninguna vista para mostrar!');
        }

        // OCULTAR SIDEBAR DE EVENTO si no es admin o event-config
        if (viewName !== 'admin' && viewName !== 'event-config') {
            const navSectionEvent = document.getElementById('nav-section-event');
            if (navSectionEvent) navSectionEvent.classList.add('hidden');
        }

        // UI Sidebar
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let btnId = 'nav-btn-' + viewName;
        if (viewName === 'system') btnId = 'nav-btn-system';
        if (viewName === 'legal') btnId = 'nav-btn-legal';
        if (viewName === 'account') btnId = 'nav-btn-account';
        if (viewName === 'smtp') btnId = 'nav-btn-smtp';
        if (viewName === 'event-config') btnId = 'nav-btn-event-config';
        
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');

        window.scrollTo(0, 0);
        
        // Resetear flag de navegación después de un breve delay
        setTimeout(() => {
            this._showingView = null;
        }, 100);
    },

    navigate(viewName, params = {}, push = true) {
        console.log('[NAV DEBUG] Navegando a:', viewName, params, 'push:', push);
        
        // Prevenir navegación múltiple simultánea
        if (this._navigating) {
            console.log('[NAV DEBUG] Ya navegando, ignorando solicitud adicional');
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
            history.pushState({ view: viewName, params }, '', url);
            setTimeout(() => { this._isPushingState = false; }, 100);
        }

        this.showView(viewName);
        
        // Guardar en AMBOS localStorage y sessionStorage para persistencia en refresh
        LS.set('active_view', viewName);
        try {
            sessionStorage.setItem('check_current_view', JSON.stringify({ view: viewName, params: params }));
            sessionStorage.setItem('check_current_url', window.location.pathname);
        } catch (e) { console.warn('[NAV] sessionStorage not available'); }
        
        // Guardar evento actual si estamos en admin o event-config
        if ((viewName === 'admin' || viewName === 'event-config') && this.state.event?.id) {
            LS.set('active_event_id', this.state.event.id);
            console.log('[NAV] Saved active event id:', this.state.event.id);
        }
        
        // Lógica específica por vista (V12.6.0 Unified Hub)
        if (viewName === 'my-events') this.loadEvents(false); // false = usar cache si está disponible
        if (viewName === 'system') {
            this.hideRestrictedSystemTabs();
            window.switchSystemTab(params.tab || 'users');
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
                if (!this.state.event || String(this.state.event.id) !== String(id)) {
                    this.state.event = this.state.events.find(e => String(e.id) === String(id));
                }
                if (this.state.event) {
                    const event = this.state.event;
                    document.getElementById('config-event-title').textContent = event.name;
                    
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
                    const activeTab = LS.get('active_config_tab') || 'staff';
                    console.log('[NAV] Restoring active config tab:', activeTab);
                    this.switchConfigTab(activeTab);
                } else {
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
        
        } finally {
            // Resetear bandera de navegación SIEMPRE
            this._navigating = false;
            console.log('[NAV DEBUG] Bandera de navegación reseteada (finally)');
        }
    },

    initRouter() {
        console.log('[ROUTER] initRouter called');
        
        // Resetear bandera cuando se inicializa el router
        this._hasHandledInitialNav = false;
        
        // Manejar navegación con el historial
        window.onpopstate = (e) => {
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
                this.handleInitialNavigation();
            }
        };
        
        // Algunos navegadores disparan popstate al cargar la página
        // Esperar un momento antes de permitir handleInitialNavigation desde popstate
        setTimeout(() => {
            console.log('[ROUTER] Router initialization complete');
        }, 100);
    },

    handleInitialNavigation() {
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
        
        // NUEVA ESTRATEGIA: Prioridad de restauración
        // 1. Primero: sessionStorage ( survives refresh)
        // 2. Segundo: localStorage (persistente)
        // 3. Tercero: URL actual
        
        let targetView = null;
        let targetParams = {};
        
        // 1. Intentar desde sessionStorage
        try {
            const sessionData = sessionStorage.getItem('check_current_view');
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                console.log('[ROUTER] Found sessionStorage data:', parsed);
                
                // Solo usar sessionStorage si la URL es raíz o my-events
                if (path === '/' || path === '/my-events') {
                    targetView = parsed.view;
                    targetParams = parsed.params || {};
                }
            }
        } catch (e) { console.warn('[ROUTER] sessionStorage parse error:', e); }
        
        // 2. Si no hay sessionStorage, usar localStorage
        if (!targetView || targetView === 'login') {
            const lsView = LS.get('active_view');
            if (lsView && lsView !== 'login') {
                targetView = lsView;
                const lsTab = LS.get('active_system_tab');
                const lsEventId = LS.get('active_event_id');
                
                if (lsView === 'system' && lsTab) {
                    targetParams = { tab: lsTab };
                } else if ((lsView === 'admin' || lsView === 'event-config') && lsEventId) {
                    targetParams = { id: lsEventId };
                }
                console.log('[ROUTER] Using localStorage data:', targetView);
            }
        }
        
        // 3. Si nada funciona, usar la URL actual
        if (!targetView || targetView === 'login') {
            const parts = path.split('/').filter(p => p);
            targetView = parts[0] || 'my-events';
            
            // Si la vista es 'system', cambiar a 'my-events' como vista por defecto
            if (targetView === 'system') {
                targetView = 'my-events';
            }
            
            if (targetView === 'admin' && parts[1]) targetParams = { id: parts[1] };
            if (targetView === 'system' && parts[1]) targetParams = { tab: parts[1] };
            if (targetView === 'event-config' && parts[1]) targetParams = { id: parts[1] };
            
            console.log('[ROUTER] Using URL data:', targetView);
        }
        
        // Si después de todo es 'system', cambiar a 'my-events'
        if (targetView === 'system') {
            targetView = 'my-events';
        }
        
        console.log('[ROUTER] Final target - view:', targetView, 'params:', targetParams);
        
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
        // Limpiar sessionStorage también
        try {
            sessionStorage.removeItem('check_current_view');
            sessionStorage.removeItem('check_current_url');
        } catch (e) {}
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

        // Actualizar tema después de cargar app-shell
        this.initTheme();
        // initSidebar() ya se llama en loadAppShell()
        
        // Navigation - Sidebar (Unified V12.6.0)
        cl('btn-toggle-sidebar', () => this.toggleSidebar());
        cl('nav-btn-my-events', () => this.navigate('my-events'));
        cl('nav-btn-admin', () => this.navigate('admin'));
        cl('nav-btn-event-config', () => {
            const eventId = this.state.event?.id;
            if (eventId) {
                this.navigate('event-config', { id: eventId });
            } else {
                this.navigate('my-events');
            }
        });
        cl('nav-btn-system', () => this.navigate('system'));
        
        // Sidebar footer
        cl('btn-toggle-theme', () => this.toggleTheme());
        cl('btn-logout', () => this.logout());
        
        // Mis Eventos - Acciones
        cl('btn-new-event-full', () => this.navigateToCreateEvent('full'));
        cl('btn-new-event-full-empty', () => this.navigateToCreateEvent('full'));
        cl('btn-events-view-grid', () => this.toggleEventsView());
        cl('btn-events-view-list', () => this.toggleEventsView());
        
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
        
        cl('btn-open-invite', () => this.openInviteModal());
        
        // Event Creation (Full Form) - NO registrar listener aquí, se registrará cuando se abra el modal
        
        // Profile Security Forms (Phase 5)
        sf('change-email-form', (e) => this.handleEmailChange(e));
        sf('change-email-form', (e) => this.handleEmailChange(e));
        sf('change-pass-form', (e) => this.handlePasswordChange(e));
        sf('invite-user-form', (e) => this.handleInviteSubmit(e));
        sf('company-form', (e) => this.handleCompanySubmit(e));
        
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

        // Nuevos botones de Email y Agenda
        cl('btn-save-event-email-config', () => this.saveEventEmailConfig());
        cl('btn-add-email-template', () => this.openEmailTemplateEditor());
        cl('btn-send-test-email', () => this.sendEventTestEmail());
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
                btn.innerHTML = '<span class="material-symbols-outlined text-lg">visibility_off</span>';
            } else {
                pwd.type = 'password';
                btn.innerHTML = '<span class="material-symbols-outlined text-lg">visibility</span>';
            }
        });

        // Email section tabs
        // Los listeners de email-nav-* ya no son necesarios porque usamos dropdown
        // Se manejan a través de los botones del dropdown
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
        cl('btn-close-event-full-modal', () => hideModal('modal-event-full'));
        cl('btn-cancel-event-full', () => hideModal('modal-event-full'));
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
                    case 'navigateToCreateGroup': _App.navigateToCreateGroup(); break;
                    case 'closeGroupSelector': _App.closeGroupSelector(); break;
                    case 'navigateToCreateEvent': _App.navigateToCreateEvent(p.userId); break;
                    
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
    
    async loadEvents(force = false) {
        // Cache de 30 segundos para evitar múltiples cargas seguidas
        const now = Date.now();
        const CACHE_DURATION = 30000; // 30 segundos
        
        // Si hay datos en caché y no se fuerza recarga, usarlos
        if (!force && this._eventsCache && (now - this._lastEventsLoad) < CACHE_DURATION) {
            console.log('[EVENTS] Usando cache de eventos, tiempo restante:', Math.round((CACHE_DURATION - (now - this._lastEventsLoad)) / 1000), 's');
            this.state.events = this._eventsCache;
            this.renderEventsGrid();
            this.updateSidebarVisibility();
            return;
        }
        
        try {
            const response = await this.fetchAPI('/events');
            
            // Validar que la respuesta sea un array válido
            if (Array.isArray(response)) {
                this.state.events = response;
                this._eventsCache = response;
                this._lastEventsLoad = now;
                console.log('[EVENTS] Eventos cargados y guardados en cache');
            } else if (response && response.success === false) {
                // Si hay error (rate limit, etc), mantener eventos anteriores si existen
                console.warn('[EVENTS] Error del servidor:', response.error);
                if (!this._eventsCache || !Array.isArray(this._eventsCache)) {
                    this._eventsCache = [];
                }
                this.state.events = this._eventsCache;
            } else {
                // Respuesta inválida, mantener eventos anteriores o vacío
                console.warn('[EVENTS] Respuesta inválida, manteniendo eventos anteriores');
                if (!this._eventsCache || !Array.isArray(this._eventsCache)) {
                    this._eventsCache = [];
                }
                this.state.events = this._eventsCache;
            }
            
            const btnAdminNav = document.getElementById('nav-btn-admin');
            if (btnAdminNav) {
                btnAdminNav.classList.toggle('hidden', !this.state.user || this.state.user.role !== 'ADMIN');
            }
            
            // Cargar preferencia de vista desde localStorage
            const savedViewMode = LS.get('events_view_mode');
            if (savedViewMode === 'list' || savedViewMode === 'grid') {
                this.state.eventsViewMode = savedViewMode;
            }
            
            // Actualizar estado de botones de toggle
            const gridBtn = document.getElementById('btn-events-view-grid');
            const listBtn = document.getElementById('btn-events-view-list');
            
            if (gridBtn && listBtn) {
                if (this.state.eventsViewMode === 'grid') {
                    gridBtn.classList.add('active');
                    listBtn.classList.remove('active');
                } else {
                    listBtn.classList.add('active');
                    gridBtn.classList.remove('active');
                }
            }
            
            this.renderEventsGrid();
            // Actualizar visibilidad del sidebar basada en evento seleccionado
            this.updateSidebarVisibility();
        } catch (e) { 
            console.warn('[EVENTS] Error cargando eventos:', e);
            // Mantener eventos anteriores si existen
            if (!this._eventsCache || !Array.isArray(this._eventsCache)) {
                this._eventsCache = [];
            }
            this.state.events = this._eventsCache;
            this.renderEventsGrid();
        }
    },

    toggleEventsView() {
        // Cambiar entre modos grid/list
        this.state.eventsViewMode = this.state.eventsViewMode === 'grid' ? 'list' : 'grid';
        
        // Actualizar botones de toggle
        const gridBtn = document.getElementById('btn-events-view-grid');
        const listBtn = document.getElementById('btn-events-view-list');
        
        if (gridBtn && listBtn) {
            if (this.state.eventsViewMode === 'grid') {
                gridBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                gridBtn.classList.remove('active');
            }
        }
        
        // Guardar preferencia en localStorage
        LS.set('events_view_mode', this.state.eventsViewMode);
        
        // Re-renderizar eventos
        this.renderEventsGrid();
    },
    
    renderEventsGrid() {
        const c = document.getElementById('events-list-container');
        if (!c) return;
        
        const events = Array.isArray(this.state.events) ? this.state.events : [];
        
        // Verificar permisos para mostrar botón de eliminar
        const userRole = this.state.user?.role;
        const canDelete = userRole === 'ADMIN' || userRole === 'PRODUCTOR';
        
        if (this.state.eventsViewMode === 'list') {
            c.className = 'space-y-2';
            c.innerHTML = events.map(ev => {
                const dateStr = new Date(ev.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                const total = ev.total_guests || 0;
                const attended = ev.attended_guests || 0;
                
                const deleteBtn = canDelete ? `
                    <button data-action="deleteEvent" data-event-id="${ev.id}" onclick="event.stopPropagation(); App.deleteEvent('${ev.id}')" class="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" title="Eliminar Evento">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                ` : '';
                
                return `
                    <div data-action="openEvent" data-event-id="${ev.id}" class="flex items-center gap-3 bg-[var(--bg-card)] border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-violet-500/50 hover:bg-white/[0.03] transition-all">
                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] text-white flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-base font-variation-fill">event</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-sm font-bold text-[var(--text-main)] truncate">${ev.name}</h3>
                            <p class="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">calendar_month</span> ${dateStr}
                            </p>
                        </div>
                        <div class="flex items-center gap-4 text-xs">
                            <span><span class="font-bold text-violet-400">${total}</span> <span class="text-slate-400">Reg.</span></span>
                            <span><span class="font-bold text-emerald-400">${attended}</span> <span class="text-slate-400">Asist.</span></span>
                        </div>
                        ${deleteBtn}
                    </div>
                `;
            }).join('');
        } else {
            c.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
            c.innerHTML = events.map(ev => {
                const dateStr = new Date(ev.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                const total = ev.total_guests || 0;
                const attended = ev.attended_guests || 0;
                
                const deleteBtn = canDelete ? `
                    <button data-action="deleteEvent" data-event-id="${ev.id}" onclick="event.stopPropagation(); App.deleteEvent('${ev.id}')" class="absolute top-2 right-2 p-2 hover:bg-red-500/20 text-red-500 rounded-lg" title="Eliminar Evento">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                ` : '';
                
                return `
                    <div data-action="openEvent" data-event-id="${ev.id}" class="bg-[var(--bg-card)] border border-white/10 rounded-xl p-3 cursor-pointer hover:border-violet-500/50 hover:bg-white/[0.03] transition-all relative">
                        ${deleteBtn}
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] text-white flex items-center justify-center flex-shrink-0">
                                <span class="material-symbols-outlined text-base font-variation-fill">event</span>
                            </div>
                            <div class="min-w-0 flex-1 overflow-hidden">
                                <h3 class="text-sm font-bold text-[var(--text-main)] truncate leading-tight">${ev.name}</h3>
                                <p class="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1">
                                    <span class="material-symbols-outlined text-xs">calendar_month</span> ${dateStr}
                                </p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-4 mt-3 pt-2 border-t border-white/5">
                            <span class="text-xs"><span class="font-bold text-violet-400">${total}</span> <span class="text-slate-400">Reg.</span></span>
                            <span class="text-xs"><span class="font-bold text-emerald-400">${attended}</span> <span class="text-slate-400">Asist.</span></span>
                        </div>
                    </div>
                `;
            }).join('');
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
                this.renderEventsGrid();
                this._notifyAction('Eliminando...', 'Procesando eliminación', 'info', 2000);
                
                // Llamar al servidor
                const res = await this.fetchAPI(`/events/${id}`, { method: 'DELETE' });
                console.log('[DELETE EVENT] Response del servidor:', res);
                
                // Verificar respuesta del servidor
                if (!res) {
                    console.warn('[DELETE EVENT] Sin respuesta del servidor, revirtiendo cambios locales');
                    this.state.events = previousEvents;
                    this._eventsCache = previousCache;
                    this.renderEventsGrid();
                    this._notifyAction('Error', 'No se recibió respuesta del servidor', 'error');
                    return;
                }
                
                if (res.success === false) {
                    console.warn('[DELETE EVENT] Error del servidor, revirtiendo:', res.error);
                    this.state.events = previousEvents;
                    this._eventsCache = previousCache;
                    this.renderEventsGrid();
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
        console.log('[SYS] Switching to tab:', tabName);
        
        // Restringir acceso para rol PRODUCTOR
        const isProductor = this.state.user?.role === 'PRODUCTOR';
        const restrictedTabs = ['groups', 'legal', 'email'];
        if (isProductor && restrictedTabs.includes(tabName)) {
            alert('No tienes acceso a esta sección');
            this.switchSystemTab('users');
            return;
        }
        
        LS.set('active_system_tab', tabName); // Persistencia V12.16.0
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

    // Ocultar pestañas restringidas para rol PRODUCTOR
    hideRestrictedSystemTabs: function() {
        const isProductor = this.state.user?.role === 'PRODUCTOR';
        if (!isProductor) return;
        
        // Ocultar botones de pestañas restringidas
        const subNavContainer = document.querySelector('#view-system .sub-nav-container');
        if (subNavContainer) {
            const tabsToHide = ['groups', 'legal', 'email'];
            const btns = subNavContainer.querySelectorAll('.sub-nav-btn');
            btns.forEach(btn => {
                const onclick = btn.getAttribute('onclick') || '';
                tabsToHide.forEach(tab => {
                    if (onclick.includes(`'${tab}'`)) {
                        btn.classList.add('hidden');
                    }
                });
            });
        }
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

        // Update config navigation buttons (nueva estructura HTML unificada V12.28.13)
        const configNavContainer = document.querySelector('#view-event-config .sub-nav-container');
        if (configNavContainer) {
            configNavContainer.querySelectorAll('.sub-nav-btn').forEach(b => {
                // Remover todas las clases de estado activo
                b.classList.remove('active');
                
                // Agregar clase de estado activo al botón correspondiente
                if (b.id === `config-nav-${tabName}`) {
                    b.classList.add('active');
                }
            });
        }

        const panel = document.getElementById('config-content-' + tabName);
        if (panel) panel.classList.remove('hidden');

        // Guardar pestaña activa
        LS.set('active_config_tab', tabName);
        console.log('[CONFIG] Saved active tab:', tabName);
        
        // Load specific data
        if (tabName === 'staff') this.loadConfigStaff();
        if (tabName === 'email') this.loadConfigEmail();
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
    
    // Cargar email config en config view
    loadConfigEmail() {
        const eventId = this.state.event?.id;
        if (!eventId) return;
        
        this.loadEventEmailConfig(eventId).then(() => {
            // Copiar del view-admin al view-config
            const fields = ['enabled', 'smtp-host', 'smtp-port', 'smtp-user', 'smtp-pass', 'from-name', 'from-email'];
            fields.forEach(field => {
                const source = document.getElementById('ev-email-' + field);
                const target = document.getElementById('config-email-' + field);
                if (source && target) {
                    if (source.type === 'checkbox') {
                        target.checked = source.checked;
                    } else {
                        target.value = source.value;
                    }
                }
            });
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
        this.updateQRPreview();
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
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                    <button class="p-2 hover:bg-[var(--bg-card)] rounded-lg" onclick="event.stopPropagation(); App.editWheel('${w.id}')">
                        <span class="material-symbols-outlined text-lg">edit</span>
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
                        <span class="material-symbols-outlined text-lg">delete</span>
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
                            <span class="material-symbols-outlined text-lg">delete</span>
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

        // Load specific data
        if (tabName === 'guests') this.loadGuests(); // Assuming loadGuests handles event.id
        if (tabName === 'staff') this.loadEventStaff(this.state.event?.id);
    },

    async loadEventStaff(eventId) {
        console.log('[LOAD EVENT STAFF] Called with eventId:', eventId);
        try {
            const users = await this.fetchAPI(`/events/${eventId}/users`);
            console.log('[LOAD EVENT STAFF] API returned:', users);
            
            // Buscar el tbody correcto - config-staff-tbody para vista de configuración, ev-staff-tbody para admin
            let tbody = document.getElementById('config-staff-tbody');
            if (!tbody) tbody = document.getElementById('ev-staff-tbody');
            
            console.log('[LOAD EVENT STAFF] tbody found:', !!tbody);
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
                        <div class="flex items-center justify-end gap-2">
                            ${canEdit ? `<button data-action="editStaff" data-user-id="${u.id}" data-user-username="${u.username}" data-user-display="${u.display_name || ''}" data-user-role="${u.role}" class="w-8 h-8 inline-flex items-center justify-center bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Editar"><span class="material-symbols-outlined text-[16px]">edit</span></button>` : ''}
                            ${canEdit ? `<button data-action="removeEventStaff" data-user-id="${u.id}" class="w-8 h-8 inline-flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Desvincular del Evento"><span class="material-symbols-outlined text-[16px]">close</span></button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
            
        } catch(e) { console.error('Error loading event staff:', e); }
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
                // Editar usuario existente
                await this.fetchAPI(`/users/${editingUserId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ display_name: displayName, role })
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
                this.loadUsersTable();
                this.loadGroups();
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
                this.loadGroups();
            }
        } catch(e) { console.error(e); }
    },

    async removeUserFromEvent(userId, eventId) {
        if (!(await this._confirmAction('¿Quitar este usuario del evento?', 'Esta acción desvinculará al usuario del evento seleccionado.'))) return;
        try {
            await this.fetchAPI(`/users/${userId}/events/${eventId}`, { method: 'DELETE' });
            this.loadUsersTable();
            this.loadEvents();
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
};

// --- DOM READY BOOTSTRAP V12.3.2.2 ---
console.log('[DEBUG] Antes de DOMContentLoaded listener, readyState:', document.readyState);

async function initApp() {
    // Guardia de Página Pública (Fase 11) - Detener SPA en registro.html
    if (window.location.pathname.includes('registro.html') || window.location.search.includes('event=')) {
        console.log('[INIT] Página pública detectada, omitiendo flujo de SPA');
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
    console.log('[INIT] Asegurando que todos los modales estén ocultos...');
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
        console.log('[AUTH] Evento auth:unauthorized recibido, haciendo logout...');
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
    console.log('[AUTH] savedUser:', savedUser ? 'EXISTS' : 'NULL', savedUser);
    
    if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
        try {
            const user = JSON.parse(savedUser);
            console.log('[AUTH] parsed user:', user);
            if (user && (user.userId || user.token)) {
                console.log('[AUTH] Valid session, loading app-shell for role:', user.role);
                window.App.state.user = user;
                // Notificaciones push deshabilitadas - solo se activan manualmente
                // window.App.initPushNotifications().catch(err => console.error('Error inicializando push:', err));
                
                // OCULTAR LOGIN INMEDIATAMENTE (si está visible)
                const loginEl = document.getElementById('view-login');
                if (loginEl) { 
                    loginEl.classList.add('hidden'); 
                    loginEl.style.display = 'none'; 
                    console.log('[AUTH] Login oculto inmediatamente');
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
                console.log('[INIT] Restaurando vista guardada o navegación desde URL');
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
        window.App.state.socket.on('email_queue_progress', () => App.updateMailingStats());
    }

    // Listeners System (Se maneja en attachAppListeners para evitar duplicación)
    // Se mantienen solo los que no están en app-shell o son globales fuera del shell
    
    document.getElementById('nav-tab-dashboard')?.addEventListener('click', () => switchAdminTab(null));

    // 5. Listeners generales

    // Login Form
    console.log('[DOM DEBUG] Configurando event listener para form-login');
    sf('form-login', async (e) => {
        console.log('[DOM DEBUG] Formulario login enviado, previniendo default');
        e.preventDefault();
        const u = document.getElementById('login-email').value; 
        const p = document.getElementById('login-password').value;
        console.log('[DOM DEBUG] Valores obtenidos:', { u, p });
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
window.testSMTP = () => App.testSMTPConnection();
window.testIMAP = () => App.testIMAPConnection();
window.copyTemplateVar = (varName) => {
    navigator.clipboard.writeText(varName).then(() => {
        App._notifyAction('Copiado', varName + ' copiado al portapapeles', 'success');
    }).catch(() => alert('No se pudo copiar'));
};

// Función global hideModal expuesta para onclick en HTML
window.hideModal = function(id) { App.hideModal(id); };

