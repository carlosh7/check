/**
 * modules/index.js
 * Exports centralizados de todos los módulos
 */

// Core
export { Config, default as DefaultConfig } from './core/Config.js';
export { AppStateManager, default as AppState } from './core/State.js';

// Utils
export { Constants, default as DefaultConstants } from './utils/Constants.js';

// Navigation
export { RouterManager as Router, default as DefaultRouter } from './navigation/Router.js';
export { PersistenceManager as Persistence, default as DefaultPersistence } from './navigation/Persistence.js';

// Components
export { ToastManager as Toast, default as DefaultToast } from './components/Toast.js';
export { ModalManager as Modal, hideModal, default as DefaultModal } from './components/Modal.js';
export { TableManager as Table, default as DefaultTable } from './components/Table.js';
export { SidebarManager as Sidebar, default as DefaultSidebar } from './components/Sidebar.js';
export { FormManager as Form, default as DefaultForm } from './components/Form.js';
export { DropdownManager as Dropdown, default as DefaultDropdown } from './components/Dropdown.js';

// Views
export { ViewManagerInstance as ViewManager } from './views/ViewManager.js';
export { MyEventsViewInstance as MyEventsView } from './views/MyEvents.js';
export { AdminViewInstance as AdminView } from './views/Admin.js';
export { EventConfigViewInstance as EventConfigView } from './views/EventConfig.js';
export { SystemViewInstance as SystemView } from './views/System.js';

// Services
export { ApiServiceInstance as ApiService } from './services/ApiService.js';
export { AuthServiceInstance as AuthService } from './services/AuthService.js';
export { EventServiceInstance as EventService } from './services/EventService.js';
export { GuestServiceInstance as GuestService } from './services/GuestService.js';

// Información de versión
export const MODULES_VERSION = '1.0.0';
export const MODULES_LAST_UPDATE = '2026-04-14';

// Estado de cada módulo
export const MODULES_STATUS = {
    core: {
        Config: '✅ Completo',
        State: '✅ Completo',
    },
    utils: {
        Constants: '✅ Completo',
    },
    navigation: {
        Router: '✅ Completo',
        Persistence: '✅ Completo',
    },
    components: {
        Toast: '✅ Completo',
        Modal: '✅ Completo',
        Table: '✅ Completo',
        Sidebar: '✅ Completo',
        Form: '✅ Completo',
        Dropdown: '✅ Completo',
    },
    views: {
        ViewManager: '✅ Completo',
        MyEvents: '✅ Completo',
        Admin: '✅ Completo',
        EventConfig: '✅ Completo',
        System: '✅ Completo',
    },
    services: {
        ApiService: '✅ Completo',
        AuthService: '✅ Completo',
        EventService: '✅ Completo',
        GuestService: '✅ Completo',
    },
};

console.log(`[MODULES] Módulos cargados - v${MODULES_VERSION} (${MODULES_LAST_UPDATE})`);
console.log('[MODULES] Estado:', MODULES_STATUS);