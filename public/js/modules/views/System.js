/**
 * modules/views/System.js
 * Gestión del sistema
 */

import { AppStateManager } from '../core/State.js';
import { ToastManager } from '../components/Toast.js';

class SystemView {
    constructor() {
        this.viewId = 'system';
        this.tabs = [
            'users',
            'roles',
            'clients',
            'companies',
            'groups',
            'smtp',
            'backup',
            'settings'
        ];
        this.currentTab = 'users';
    }
    
    // Inicializar
    init() {
        
        this.bindEvents();
    }
    
    // Bind events
    bindEvents() {
        // Tabs del sistema
        document.querySelectorAll('#view-system .nav-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });
    }
    
    // Mostrar vista
    show(tab = null) {
        if (tab) {
            this.currentTab = tab;
        }
        
        this.checkPermissions();
        this.loadTabContent(this.currentTab);
    }
    
    // Ocultar vista
    hide() {
        // Cleanup
    }
    
    // Verificar permisos
    checkPermissions() {
        const user = AppStateManager.get('user');
        
        if (user?.role !== 'ADMIN') {
            // Ocultar tabs que no son permitidos
            
        }
    }
    
    // Cambiar pestaña
    switchTab(tabName) {
        if (!this.tabs.includes(tabName)) {
            console.warn(`[SYSTEM] Tab no válido: ${tabName}`);
            return;
        }
        
        // Actualizar UI
        document.querySelectorAll('#view-system .nav-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-primary/20', 'text-primary');
        });
        
        const activeBtn = document.querySelector(`#view-system [data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/20', 'text-primary');
        }
        
        this.currentTab = tabName;
        
        // Guardar pestaña activa
        sessionStorage.setItem('active_system_tab', tabName);
        
        // Cargar contenido
        this.loadTabContent(tabName);
    }
    
    // Cargar contenido de pestaña
    loadTabContent(tabName) {
        
        
        // Los contenidos se cargan desde app.js legacy
        // Este módulo es un wrapper para coordinación
        
        switch (tabName) {
            case 'users':
                this.loadUsers();
                break;
            case 'clients':
                this.loadClients();
                break;
            case 'smtp':
                this.loadSMTP();
                break;
            case 'settings':
                this.loadSettings();
                break;
            default:
                
        }
    }
    
    // Cargar usuarios
    async loadUsers() {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const users = await res.json();
                AppStateManager.set('allUsers', users);
                
            }
        } catch (error) {
            console.error('[SYSTEM] Error cargando usuarios:', error);
        }
    }
    
    // Cargar clientes
    async loadClients() {
        try {
            const res = await fetch('/api/clients');
            if (res.ok) {
                const clients = await res.json();
                
            }
        } catch (error) {
            console.error('[SYSTEM] Error cargando clientes:', error);
        }
    }
    
    // Cargar configuración SMTP
    async loadSMTP() {
        
    }
    
    // Cargar settings
    async loadSettings() {
        
    }
    
    // Crear usuario
    createUser(userData) {
        
        if (window.App?.createUser) {
            window.App.createUser(userData);
        }
    }
    
    // Editar usuario
    editUser(userId) {
        
        if (window.App?.editUser) {
            window.App.editUser(userId);
        }
    }
    
    // Eliminar usuario
    deleteUser(userId) {
        
        if (window.App?.deleteUser) {
            window.App.deleteUser(userId);
        }
    }
    
    // Guardar configuración SMTP
    saveSMTPConfig(config) {
        
        if (window.App?.saveSMTPConfig) {
            window.App.saveSMTPConfig(config);
        }
    }
    
    // Exportar datos
    exportData() {
        if (window.App?.exportSystemData) {
            window.App.exportSystemData();
        }
    }
    
    // Importar datos
    importData() {
        if (window.App?.importSystemData) {
            window.App.importSystemData();
        }
    }
}

export const SystemViewInstance = new SystemView();
export default SystemViewInstance;