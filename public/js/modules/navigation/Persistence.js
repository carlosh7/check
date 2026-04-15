/**
 * modules/navigation/Persistence.js
 * Persistencia de estado de navegación en sessionStorage
 */

import { AppStateManager } from '../core/State.js';

class Persistence {
    constructor() {
        this.STORAGE_KEY = 'check_current_view';
        this.MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas
    }
    
    // Guardar estado de navegación
    saveViewState(view, params = {}, role = null) {
        try {
            if (view === 'system' && (!params || !params.tab)) {
                console.warn('[PERSISTENCE WARNING] Saving system view without tab parameter!');
            }
            
            const state = {
                view: view,
                params: params || {},
                role: role || AppStateManager.get('user')?.role,
                timestamp: Date.now()
            };
            
            // Guardar información adicional si es vista de evento
            if (view === 'admin' || view === 'event-config') {
                const event = AppStateManager.get('event');
                if (event?.id) {
                    state.eventId = event.id;
                } else if (params.id) {
                    state.eventId = params.id;
                }
                
                // Guardar pestaña activa
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
            
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            
        } catch (e) {
            console.warn('[PERSISTENCE] Error saving view state:', e);
        }
    }
    
    // Cargar estado de navegación
    loadViewState() {
        try {
            const sessionData = sessionStorage.getItem(this.STORAGE_KEY);
            if (!sessionData) return null;
            
            const state = JSON.parse(sessionData);
            
            
            if (state.view === 'system' && (!state.params || !state.params.tab)) {
                console.warn('[PERSISTENCE WARNING] Loaded system view without tab parameter!');
            }
            
            // Validar que no sea muy viejo
            if (Date.now() - state.timestamp > this.MAX_AGE) {
                
                return null;
            }
            
            return state;
        } catch (e) {
            console.warn('[PERSISTENCE] Error loading view state:', e);
            return null;
        }
    }
    
    // Limpiar estado de navegación
    clearViewState() {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem('check_current_url');
            sessionStorage.removeItem('active_config_tab');
            sessionStorage.removeItem('active_event_tab');
            
        } catch (e) {
            console.warn('[PERSISTENCE] Error clearing view state:', e);
        }
    }
    
    // Guardar pestaña activa de config
    saveActiveConfigTab(tab) {
        sessionStorage.setItem('active_config_tab', tab);
    }
    
    // Guardar pestaña activa de evento
    saveActiveEventTab(tab) {
        sessionStorage.setItem('active_event_tab', tab);
    }
    
    // Obtener pestaña activa de config
    getActiveConfigTab() {
        return sessionStorage.getItem('active_config_tab');
    }
    
    // Obtener pestaña activa de evento
    getActiveEventTab() {
        return sessionStorage.getItem('active_event_tab');
    }
    
    // Guardar URL actual
    saveCurrentUrl(url) {
        sessionStorage.setItem('check_current_url', url);
    }
    
    // Obtener URL actual
    getCurrentUrl() {
        return sessionStorage.getItem('check_current_url');
    }
}

// Instancia singleton
export const PersistenceManager = new Persistence();

// Export default
export default PersistenceManager;