/**
 * modules/core/State.js
 * Gestión de estado global de la aplicación
 */

class AppState {
    constructor() {
        this._state = {
            event: null,
            events: [],
            guests: [],
            user: null,
            socket: null,
            chart: null,
            version: '12.44.366',
            groups: [],
            _navigating: false,
            quillEditor: null,
            editingTemplate: null,
            emailTemplates: [],
            columnConfig: {
                name: { label: 'Nombre', visible: true, order: 0 },
                email: { label: 'Email', visible: true, order: 1 },
                organization: { label: 'Empresa', visible: true, order: 2 },
                phone: { label: 'Teléfono', visible: false, order: 3 },
                position: { label: 'Cargo', visible: false, order: 4 },
                status: { label: 'Estado', visible: true, order: 5 }
            },
            importSession: null,
            eventsViewMode: 'grid', // 'grid' o 'list'
        };
        
        this._listeners = new Map();
    }
    
    // Getter genérico
    get(key) {
        return this._state[key];
    }
    
    // Setter genérico
    set(key, value) {
        const oldValue = this._state[key];
        this._state[key] = value;
        
        // Notificar listeners
        this._notify(key, value, oldValue);
    }
    
    // Getter múltiple
    getMultiple(...keys) {
        const result = {};
        keys.forEach(key => {
            result[key] = this._state[key];
        });
        return result;
    }
    
    // Setter múltiple
    setMultiple(obj) {
        Object.keys(obj).forEach(key => {
            this.set(key, obj[key]);
        });
    }
    
    // Obtener todo el estado
    getAll() {
        return { ...this._state };
    }
    
    // Resetear estado
    reset() {
        this._state = {
            event: null,
            events: [],
            guests: [],
            user: null,
            socket: null,
            chart: null,
            version: '12.44.366',
            groups: [],
            _navigating: false,
            quillEditor: null,
            editingTemplate: null,
            emailTemplates: [],
            columnConfig: {
                name: { label: 'Nombre', visible: true, order: 0 },
                email: { label: 'Email', visible: true, order: 1 },
                organization: { label: 'Empresa', visible: true, order: 2 },
                phone: { label: 'Teléfono', visible: false, order: 3 },
                position: { label: 'Cargo', visible: false, order: 4 },
                status: { label: 'Estado', visible: true, order: 5 }
            },
            importSession: null,
            eventsViewMode: 'grid',
        };
        this._notify('reset', this._state);
    }
    
    // Suscribirse a cambios
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this._listeners.get(key);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }
    
    // Notificar cambios
    _notify(key, newValue, oldValue) {
        const listeners = this._listeners.get(key);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (e) {
                    console.error(`[State] Error in listener for ${key}:`, e);
                }
            });
        }
    }
    
    // Utilidad para verificar estado de usuario
    isLoggedIn() {
        return this._state.user !== null;
    }
    
    isAdmin() {
        return this._state.user?.role === 'ADMIN';
    }
    
    isProductor() {
        return this._state.user?.role === 'PRODUCTOR';
    }
    
    hasEvent() {
        return this._state.event !== null;
    }
}

// Instancia singleton
export const AppStateManager = new AppState();

// Export default
export default AppStateManager;