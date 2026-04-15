/**
 * modules/views/MyEvents.js
 * Vista de Mis Eventos
 */

import { AppStateManager } from '../core/State.js';
import { TableManager } from '../components/Table.js';
import { ToastManager } from '../components/Toast.js';

class MyEventsView {
    constructor() {
        this.viewId = 'my-events';
        this.filteredEvents = [];
    }
    
    // Inicializar vista
    init() {
        
        this.bindEvents();
    }
    
    // Bind events
    bindEvents() {
        // Botón nuevo evento
        const newEventBtn = document.getElementById('btn-new-event-full');
        if (newEventBtn) {
            newEventBtn.addEventListener('click', () => this.createEvent());
        }
        
        // Buscador
        const searchInput = document.getElementById('event-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.search(e.target.value));
        }
        
        // Filtros
        const filterClient = document.getElementById('filter-event-client');
        const filterStatus = document.getElementById('filter-event-status');
        
        if (filterClient) {
            filterClient.addEventListener('change', () => this.applyFilters());
        }
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.applyFilters());
        }
    }
    
    // Mostrar vista
    show() {
        this.loadEvents();
    }
    
    // Ocultar vista
    hide() {
        // Cleanup si es necesario
    }
    
    // Cargar eventos
    async loadEvents() {
        try {
            const events = AppStateManager.get('events') || [];
            this.filteredEvents = events;
            this.render();
        } catch (error) {
            console.error('[MY_EVENTS] Error cargando eventos:', error);
            ToastManager.error('Error', 'No se pudieron cargar los eventos');
        }
    }
    
    // Renderizar
    render() {
        const container = document.getElementById('events-table-container');
        if (!container) return;
        
        if (this.filteredEvents.length === 0) {
            container.innerHTML = `
                <div class="text-center p-8">
                    <span class="material-symbols-outlined text-4xl text-slate-500">event</span>
                    <p class="text-slate-500 mt-2">No hay eventos</p>
                    <button onclick="App.openCreateEventModal()" class="btn-primary mt-4">
                        Crear primer evento
                    </button>
                </div>
            `;
            return;
        }
        
        TableManager.renderEventsTable(this.filteredEvents);
    }
    
    // Buscar eventos
    search(query) {
        const events = AppStateManager.get('events') || [];
        
        if (!query.trim()) {
            this.filteredEvents = events;
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredEvents = events.filter(event => 
                event.name?.toLowerCase().includes(lowerQuery) ||
                event.client?.toLowerCase().includes(lowerQuery) ||
                event.location?.toLowerCase().includes(lowerQuery)
            );
        }
        
        this.render();
    }
    
    // Aplicar filtros
    applyFilters() {
        const clientFilter = document.getElementById('filter-event-client')?.value;
        const statusFilter = document.getElementById('filter-event-status')?.value;
        
        let events = AppStateManager.get('events') || [];
        
        if (clientFilter) {
            events = events.filter(e => e.client === clientFilter);
        }
        
        if (statusFilter) {
            events = events.filter(e => e.status === statusFilter);
        }
        
        this.filteredEvents = events;
        this.render();
    }
    
    // Crear evento
    createEvent() {
        
        // Delegate to App
        if (window.App?.openCreateEventModal) {
            window.App.openCreateEventModal();
        }
    }
    
    // Abrir configuración de evento
    openEventConfig(eventId) {
        
        if (window.App?.openEventConfig) {
            window.App.openEventConfig(eventId);
        }
    }
    
    // Eliminar evento
    deleteEvent(eventId) {
        
        if (window.App?.deleteEvent) {
            window.App.deleteEvent(eventId);
        }
    }
    
    // Exportar eventos
    exportEvents() {
        if (window.App?.exportEvents) {
            window.App.exportEvents();
        }
    }
    
    // Importar eventos
    importEvents() {
        if (window.App?.openImportModal) {
            window.App.openImportModal('events');
        }
    }
}

export const MyEventsViewInstance = new MyEventsView();
export default MyEventsViewInstance;