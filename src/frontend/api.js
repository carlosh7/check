/**
 * api.js - Módulo de comunicación con la API para Check Pro
 */

import { LS } from './utils.js';

export const API = {
    BASE_URL: '/api',
    
    async fetchAPI(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;
        
        // Usar App.state.user primero (fuente confiable post-login), luego LS como fallback
        let token = null;
        let userId = null;
        
        if (window.App?.state?.user) {
            token = window.App.state.user.token;
            userId = window.App.state.user.userId;
        }
        
        // Fallback a localStorage si no hay token en App.state
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
            userId = userId || user.userId;
        }
        
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
        
        if (userId) {
            defaultHeaders['x-user-id'] = userId;
        }
        
        // Unir headers personalizados
        options.headers = { ...defaultHeaders, ...options.headers };
        
        try {
            const response = await fetch(url, options);
            
            // Manejo de errores de red o HTTP
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('[API] Sesión expirada o no autorizada');
                    // Opcional: Trigger logout o redirección
                }
                const errorData = await response.json().catch(() => ({}));
                return { success: false, error: errorData.message || errorData.error || `HTTP ${response.status}` };
            }
            
            return await response.json();
        } catch (error) {
            console.error('[API] Error de conexión:', error);
            return { success: false, error: 'Error de conexión con el servidor' };
        }
    }
};
