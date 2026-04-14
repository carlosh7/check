/**
 * modules/views/Admin.js
 * Panel de administración
 */

import { AppStateManager } from '../core/State.js';
import { ToastManager } from '../components/Toast.js';

class AdminView {
    constructor() {
        this.viewId = 'admin';
        this.tabs = [
            'guests',
            'staff',
            'companies',
            'groups',
            'reports',
            'checkin'
        ];
        this.currentTab = 'guests';
        this.currentEventId = null;
    }
    
    // Inicializar
    init() {
        console.log('[ADMIN] Inicializado');
        this.bindEvents();
    }
    
    // Bind events
    bindEvents() {
        // Tabs de navegación
        document.querySelectorAll('#view-admin .nav-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });
    }
    
    // Mostrar vista
    show(eventId) {
        this.currentEventId = eventId || AppStateManager.get('event')?.id;
        
        if (!this.currentEventId) {
            ToastManager.warning('Atención', 'Selecciona un evento primero');
            return;
        }
        
        this.loadEventData();
        this.render();
    }
    
    // Ocultar vista
    hide() {
        // Cleanup
    }
    
    // Cambiar pestaña
    switchTab(tabName) {
        if (!this.tabs.includes(tabName)) {
            console.warn(`[ADMIN] Tab no válido: ${tabName}`);
            return;
        }
        
        // Actualizar UI
        document.querySelectorAll('#view-admin .nav-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-primary/20', 'text-primary');
        });
        
        const activeBtn = document.querySelector(`#view-admin [data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/20', 'text-primary');
        }
        
        this.currentTab = tabName;
        
        // Cargar contenido de la pestaña
        this.loadTabContent(tabName);
    }
    
    // Cargar datos del evento
    async loadEventData() {
        try {
            const eventId = this.currentEventId;
            
            // Cargar guests
            const guestsRes = await fetch(`/api/events/${eventId}/guests`);
            if (guestsRes.ok) {
                const guests = await guestsRes.json();
                AppStateManager.set('guests', guests);
            }
            
            console.log(`[ADMIN] Datos cargados para evento: ${eventId}`);
        } catch (error) {
            console.error('[ADMIN] Error cargando datos:', error);
            ToastManager.error('Error', 'No se pudieron cargar los datos');
        }
    }
    
    // Cargar contenido de pestaña
    loadTabContent(tabName) {
        switch (tabName) {
            case 'guests':
                this.renderGuests();
                break;
            case 'staff':
                this.renderStaff();
                break;
            case 'companies':
                this.renderCompanies();
                break;
            case 'groups':
                this.renderGroups();
                break;
            case 'reports':
                this.renderReports();
                break;
            case 'checkin':
                this.renderCheckin();
                break;
            default:
                console.warn(`[ADMIN] Contenido no implementado: ${tabName}`);
        }
    }
    
    // Renderizar guests
    renderGuests() {
        const container = document.getElementById('admin-guests-content');
        if (!container) return;
        
        const guests = AppStateManager.get('guests') || [];
        
        if (guests.length === 0) {
            container.innerHTML = '<div class="text-center p-8 text-slate-500">No hay invitados</div>';
            return;
        }
        
        // Renderizar tabla
        if (window.App?.table) {
            window.App.table.renderGuestsTable(guests);
        }
    }
    
    // Renderizar staff
    renderStaff() {
        console.log('[ADMIN] Render staff');
    }
    
    // Renderizar companies
    renderCompanies() {
        console.log('[ADMIN] Render companies');
    }
    
    // Renderizar groups
    renderGroups() {
        console.log('[ADMIN] Render groups');
    }
    
    // Renderizar reports
    renderReports() {
        console.log('[ADMIN] Render reports');
    }
    
    // Renderizar checkin
    renderCheckin() {
        console.log('[ADMIN] Render checkin');
    }
    
    // Render (por defecto)
    render() {
        // Asegurar que la primera tab esté activa
        if (!this.currentTab) {
            this.switchTab('guests');
        }
    }
    
    // Check-in de invitado
    checkInGuest(guestId) {
        console.log(`[ADMIN] Check-in: ${guestId}`);
        if (window.App?.checkInGuest) {
            window.App.checkInGuest(guestId);
        }
    }
    
    // Exportar guests
    exportGuests() {
        if (window.App?.exportGuests) {
            window.App.exportGuests();
        }
    }
    
    // Importar guests
    importGuests() {
        if (window.App?.openImportModal) {
            window.App.openImportModal('guests');
        }
    }
}

export const AdminViewInstance = new AdminView();
export default AdminViewInstance;