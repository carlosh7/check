/**
 * api.js - Módulo de comunicación con la API para Check Pro
 */

import { LS } from './utils.js';

export const API = {
    BASE_URL: '/api',
    
    async fetchAPI(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;
        const user = JSON.parse(LS.get('user') || '{}');
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LS.get('token')}`
        };
        
        if (user && user.userId) {
            defaultHeaders['x-user-id'] = user.userId;
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
