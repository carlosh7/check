/**
 * modules/components/Sidebar.js
 * Sistema de gestión del sidebar
 */

import { LS } from '../../src/frontend/utils.js';

class Sidebar {
    constructor() {
        this.isCollapsed = false;
        this.element = null;
        this.toggleButton = null;
    }
    
    // Inicializar sidebar
    init() {
        this.element = document.getElementById('global-sidebar');
        this.toggleButton = document.getElementById('btn-toggle-sidebar');
        
        if (!this.element) {
            console.warn('[SIDEBAR] Element not found');
            return;
        }
        
        // Cargar estado guardado
        this.isCollapsed = LS.get('sidebarCollapsed') === true;
        
        if (this.isCollapsed) {
            this.collapse();
        } else {
            this.expand();
        }
        
        console.log('[SIDEBAR] Initialized');
    }
    
    // Toggle sidebar
    toggle() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }
    
    // Colapsar sidebar
    collapse() {
        if (!this.element) return;
        
        this.element.classList.add('collapsed');
        this.isCollapsed = true;
        LS.set('sidebarCollapsed', true);
        
        if (this.toggleButton) {
            this.toggleButton.querySelector('.material-symbols-outlined')?.classList.add('rotate-180');
        }
        
        console.log('[SIDEBAR] Collapsed');
    }
    
    // Expandir sidebar
    expand() {
        if (!this.element) return;
        
        this.element.classList.remove('collapsed');
        this.isCollapsed = false;
        LS.set('sidebarCollapsed', false);
        
        if (this.toggleButton) {
            this.toggleButton.querySelector('.material-symbols-outlined')?.classList.remove('rotate-180');
        }
        
        console.log('[SIDEBAR] Expanded');
    }
    
    // Actualizar UI de navegación
    setActiveItem(viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active', 'bg-primary/10', 'text-primary');
        });
        
        const activeBtn = document.getElementById('nav-btn-' + viewId);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');
        }
    }
    
    // Actualizar información de usuario
    updateUserInfo(user) {
        const usernameEl = document.getElementById('sidebar-username');
        const roleEl = document.getElementById('sidebar-role');
        
        if (usernameEl && user?.display_name) {
            usernameEl.textContent = user.display_name;
        }
        
        if (roleEl && user?.role) {
            roleEl.textContent = user.role;
        }
    }
    
    // Actualizar versión
    updateVersion(version) {
        const versionEl = document.querySelector('.app-version-text');
        if (versionEl) {
            versionEl.textContent = `Check Pro v${version}`;
        }
    }
    
    // Obtener estado
    getState() {
        return {
            isCollapsed: this.isCollapsed,
            element: !!this.element
        };
    }
}

// Instancia singleton
export const SidebarManager = new Sidebar();

export default SidebarManager;