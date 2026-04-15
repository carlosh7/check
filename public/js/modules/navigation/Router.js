/**
 * modules/navigation/Router.js
 * Sistema de navegación y rutas
 */

import { AppStateManager } from '../core/State.js';

class Router {
    constructor() {
        this._isPushingState = false;
        this._hasHandledInitialNav = false;
        this._currentView = null;
        this._currentParams = {};
    }
    
    // Actualizar UI del sidebar
    updateSidebarUI(viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('nav-btn-' + viewId);
        if (activeBtn) activeBtn.classList.add('active');
    }
    
    // Navegación básica - redirecciona a la función completa
    navigate(viewId) {
        this.navigateTo(viewId, {}, true);
    }
    
    // Navegación completa con parámetros
    navigateTo(viewId, params = {}, saveState = true) {
        // Obtener usuario desde App.state (fuente principal)
        const user = window.App?.state?.user || AppStateManager.get('user');
        const role = user?.role || 'INVITADO';
        
        console.log('[ROUTER] navigateTo:', viewId, 'role:', role, 'user:', user?.email);
        
        if (!this.hasPermissionForView(role, viewId)) {
            console.warn(`[ROUTER] No permission for view: ${viewId} (role: ${role})`);
            return;
        }
        
        // Guardar estado si es necesario
        if (saveState) {
            this.saveViewState(viewId, params, role);
        }
        
        // Actualizar sidebar
        this.updateSidebarUI(viewId);
        
        // Actualizar estado interno
        this._currentView = viewId;
        this._currentParams = params;
        
        console.log(`[ROUTER] Navigated to: ${viewId}`, params);
    }
    
    // Obtener vista por defecto según rol
    getDefaultViewByRole(role) {
        return { view: 'my-events', tab: null };
    }
    
    // Validar permisos para una vista
    hasPermissionForView(role, view, tab) {
        // ADMIN tiene acceso a todo
        if (role === 'ADMIN') return true;
        
        // my-events accesible para todos
        if (view === 'my-events') return true;
        
        // system accesible para ADMIN y PRODUCTOR
        if (view === 'system' && (role === 'PRODUCTOR' || role === 'ADMIN')) return true;
        
        // admin accesible para ADMIN y PRODUCTOR
        if (view === 'admin' && (role === 'PRODUCTOR' || role === 'ADMIN')) return true;
        
        // event-config accesible para ADMIN y PRODUCTOR
        if (view === 'event-config' && (role === 'PRODUCTOR' || role === 'ADMIN')) return true;
        
        return false;
    }
    
    // Obtener vista actual
    getCurrentView() {
        return this._currentView;
    }
    
    // Obtener parámetros actuales
    getCurrentParams() {
        return this._currentParams;
    }
    
    // Verificar si ya se manejó la navegación inicial
    hasHandledInitialNav() {
        return this._hasHandledInitialNav;
    }
    
    // Marcar como navegación inicial handled
    setHandledInitialNav(value) {
        this._hasHandledInitialNav = value;
    }
    
    // Navegación programática a eventos específicos
    navigateToEvent(eventId, view = 'admin') {
        this.navigateTo(view, { id: eventId }, true);
    }
    
    navigateToCreateEvent(type = 'short') {
        // Lógica para crear evento
        console.log(`[ROUTER] Navigate to create event: ${type}`);
    }
}

// Instancia singleton
export const RouterManager = new Router();

// Export default
export default RouterManager;