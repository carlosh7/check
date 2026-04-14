/**
 * modules/services/AuthService.js
 * Servicio de autenticación
 */

import { LS } from '../../src/frontend/utils.js';
import { ApiServiceInstance } from './ApiService.js';
import { AppStateManager } from '../core/State.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
    }
    
    // Inicializar auth
    init() {
        // Cargar usuario desde localStorage
        const savedUser = LS.get('user');
        if (savedUser && savedUser !== 'undefined') {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.isAuthenticated = !!this.currentUser?.token;
                
                if (this.isAuthenticated) {
                    AppStateManager.set('user', this.currentUser);
                    console.log('[AUTH] Usuario cargado desde storage');
                }
            } catch (e) {
                console.warn('[AUTH] Error parseando usuario:', e);
                this.logout();
            }
        }
        
        // Escuchar eventos de unauthorized
        window.addEventListener('auth:unauthorized', () => {
            console.warn('[AUTH] Sesión expirada');
            this.handleUnauthorized();
        });
    }
    
    // Login
    async login(email, password) {
        try {
            const response = await ApiServiceInstance.login({ email, password });
            
            if (response.success) {
                this.setSession(response.user, response.token);
                return { success: true, user: response.user };
            } else {
                return { success: false, error: response.error || 'Credenciales inválidas' };
            }
        } catch (error) {
            console.error('[AUTH] Error en login:', error);
            return { success: false, error: 'Error de conexión' };
        }
    }
    
    // Logout
    async logout() {
        try {
            await ApiServiceInstance.logout();
        } catch (e) {
            console.warn('[AUTH] Error en logout API:', e);
        }
        
        this.clearSession();
        window.location.href = '/login';
    }
    
    // Establecer sesión
    setSession(user, token) {
        this.currentUser = { ...user, token };
        this.isAuthenticated = true;
        
        LS.set('user', JSON.stringify(this.currentUser));
        LS.set('token', token);
        
        AppStateManager.set('user', this.currentUser);
        
        console.log('[AUTH] Sesión establecida para:', user.email);
    }
    
    // Limpiar sesión
    clearSession() {
        this.currentUser = null;
        this.isAuthenticated = false;
        
        LS.remove('user');
        LS.remove('token');
        LS.remove('sidebarCollapsed');
        
        AppStateManager.set('user', null);
        
        console.log('[AUTH] Sesión limpiada');
    }
    
    // Manejar sesión expirada
    handleUnauthorized() {
        this.clearSession();
        
        if (window.App?.showPremiumToast) {
            window.App.showPremiumToast('Sesión expirada', 'Por favor, inicia sesión nuevamente', 'warning');
        }
        
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }
    
    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Verificar si está autenticado
    isLoggedIn() {
        return this.isAuthenticated && !!this.currentUser;
    }
    
    // Obtener token
    getToken() {
        return this.currentUser?.token;
    }
    
    // Obtener rol
    getRole() {
        return this.currentUser?.role;
    }
    
    // Verificar permisos
    hasPermission(roleRequired) {
        const userRole = this.getRole();
        
        const permissions = {
            'ADMIN': ['ADMIN', 'PRODUCTOR', 'INVITADO'],
            'PRODUCTOR': ['PRODUCTOR', 'INVITADO'],
            'INVITADO': ['INVITADO']
        };
        
        const allowedRoles = permissions[userRole] || [];
        return allowedRoles.includes(roleRequired);
    }
    
    // Verificar si es admin
    isAdmin() {
        return this.getRole() === 'ADMIN';
    }
    
    // Verificar si es productor
    isProductor() {
        return this.getRole() === 'PRODUCTOR';
    }
}

// Instancia singleton
export const AuthServiceInstance = new AuthService();

export default AuthServiceInstance;