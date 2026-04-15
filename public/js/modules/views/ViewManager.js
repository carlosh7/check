/**
 * modules/views/ViewManager.js
 * Sistema de gestión de vistas
 */

import { AppStateManager } from '../core/State.js';
import { RouterManager } from '../navigation/Router.js';
import { PersistenceManager } from '../navigation/Persistence.js';

class ViewManager {
    constructor() {
        this.views = [
            'my-events',
            'admin',
            'event-config',
            'system',
            'groups',
            'smtp',
            'pre-registrations',
            'survey-manager'
        ];
        this.currentView = null;
        this.viewElements = {};
    }
    
    // Inicializar vistas
    init() {
        this.views.forEach(viewId => {
            const el = document.getElementById(`view-${viewId}`);
            if (el) {
                this.viewElements[viewId] = el;
            }
        });
        
        
    }
    
    // Mostrar una vista
    show(viewId, params = {}) {
        // Ocultar todas las vistas
        this.hideAll();
        
        // Mostrar la vista seleccionada
        const viewEl = this.viewElements[viewId];
        if (viewEl) {
            viewEl.classList.remove('hidden');
            viewEl.classList.add('animate-fade-in');
            this.currentView = viewId;
            
            // Guardar estado
            PersistenceManager.saveViewState(viewId, params);
            
            
        } else {
            console.warn(`[VIEWS] Vista no encontrada: ${viewId}`);
        }
    }
    
    // Ocultar todas las vistas
    hideAll() {
        this.views.forEach(viewId => {
            const viewEl = this.viewElements[viewId];
            if (viewEl) {
                viewEl.classList.add('hidden');
                viewEl.classList.remove('animate-fade-in');
            }
        });
    }
    
    // Obtener vista actual
    getCurrentView() {
        return this.currentView;
    }
    
    // Verificar si una vista está activa
    isActive(viewId) {
        return this.currentView === viewId;
    }
    
    // Obtener elemento de una vista
    getViewElement(viewId) {
        return this.viewElements[viewId];
    }
    
    // Navegar a vista (con verificación de permisos)
    navigateTo(viewId, params = {}) {
        const user = AppStateManager.get('user');
        const role = user?.role || 'INVITADO';
        
        if (!RouterManager.hasPermissionForView(role, viewId)) {
            console.warn(`[VIEWS] Sin permisos para: ${viewId}`);
            return false;
        }
        
        this.show(viewId, params);
        return true;
    }
    
    // Cargar última vista guardada
    loadSavedView() {
        const savedState = PersistenceManager.loadViewState();
        
        if (savedState && savedState.view) {
            const user = AppStateManager.get('user');
            const role = user?.role || 'INVITADO';
            
            if (RouterManager.hasPermissionForView(role, savedState.view)) {
                this.show(savedState.view, savedState.params);
                return true;
            }
        }
        
        // Vista por defecto
        this.show('my-events');
        return false;
    }
    
    // Actualizar sidebar según vista
    updateSidebar(viewId) {
        // Quitar active de todos los nav-items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active', 'bg-primary/10', 'text-primary');
        });
        
        // Agregar active al botón correspondiente
        const navBtn = document.getElementById(`nav-btn-${viewId}`);
        if (navBtn) {
            navBtn.classList.add('active', 'bg-primary/10', 'text-primary');
        }
    }
}

// Instancia singleton
export const ViewManagerInstance = new ViewManager();

export default ViewManagerInstance;