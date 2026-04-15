/**
 * modules/views/EventConfig.js
 * Configuración de evento
 */

import { AppStateManager } from '../core/State.js';
import { ToastManager } from '../components/Toast.js';

class EventConfigView {
    constructor() {
        this.viewId = 'event-config';
        this.tabs = [
            'general',
            'registration',
            'design',
            'agenda',
            'survey',
            'wheel',
            'email',
            'access'
        ];
        this.currentTab = 'general';
        this.currentEventId = null;
    }
    
    // Inicializar
    init() {
        
        this.bindEvents();
    }
    
    // Bind events
    bindEvents() {
        // Tabs de configuración
        document.querySelectorAll('#view-event-config .nav-tab-btn').forEach(btn => {
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
        
        this.loadEventConfig();
    }
    
    // Ocultar vista
    hide() {
        // Cleanup
    }
    
    // Cambiar pestaña
    switchTab(tabName) {
        if (!this.tabs.includes(tabName)) {
            console.warn(`[EVENT_CONFIG] Tab no válido: ${tabName}`);
            return;
        }
        
        // Actualizar UI
        document.querySelectorAll('#view-event-config .nav-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-primary/20', 'text-primary');
        });
        
        const activeBtn = document.querySelector(`#view-event-config [data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/20', 'text-primary');
        }
        
        this.currentTab = tabName;
        
        // Guardar pestaña activa
        sessionStorage.setItem('active_config_tab', tabName);
        
        // Cargar contenido
        this.loadTabContent(tabName);
    }
    
    // Cargar configuración del evento
    async loadEventConfig() {
        try {
            const eventId = this.currentEventId;
            const res = await fetch(`/api/events/${eventId}`);
            
            if (res.ok) {
                const event = await res.json();
                AppStateManager.set('event', event);
                
            }
        } catch (error) {
            console.error('[EVENT_CONFIG] Error cargando evento:', error);
            ToastManager.error('Error', 'No se pudo cargar la configuración');
        }
    }
    
    // Cargar contenido de pestaña
    loadTabContent(tabName) {
        
        
        // Los contenidos se cargan desde app.js legacy
        // Este módulo es un wrapper para coordinación
    }
    
    // Guardar configuración
    async saveConfig() {
        if (!this.currentEventId) {
            ToastManager.error('Error', 'No hay evento seleccionado');
            return;
        }
        
        // Delegate to App
        if (window.App?.saveEventConfig) {
            await window.App.saveEventConfig();
        }
    }
    
    // Preview del evento
    previewEvent() {
        if (window.App?.previewEvent) {
            window.App.previewEvent();
        }
    }
    
    // Publicar evento
    publishEvent() {
        if (window.App?.publishEvent) {
            window.App.publishEvent();
        }
    }
}

export const EventConfigViewInstance = new EventConfigView();
export default EventConfigViewInstance;