/**
 * modules/index.js
 * Exports centralizados de todos los módulos
 */

// Core
export { Config } from './core/Config.js';
export { AppStateManager } from './core/State.js';

// Utils
export { Constants } from './utils/Constants.js';

// Navigation
export { RouterManager } from './navigation/Router.js';
export { PersistenceManager } from './navigation/Persistence.js';

// Components
export { ToastManager } from './components/Toast.js';
export { ModalManager, hideModal } from './components/Modal.js';
export { TableManager } from './components/Table.js';
export { SidebarManager } from './components/Sidebar.js';
export { FormManager } from './components/Form.js';
export { DropdownManager } from './components/Dropdown.js';

// Views
export { ViewManagerInstance } from './views/ViewManager.js';
export { MyEventsViewInstance } from './views/MyEvents.js';
export { AdminViewInstance } from './views/Admin.js';
export { EventConfigViewInstance } from './views/EventConfig.js';
export { SystemViewInstance } from './views/System.js';

// Services
export { ApiServiceInstance } from './services/ApiService.js';
export { AuthServiceInstance } from './services/AuthService.js';
export { EventServiceInstance } from './services/EventService.js';
export { GuestServiceInstance } from './services/GuestService.js';

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