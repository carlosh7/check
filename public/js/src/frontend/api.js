/**
 * api.js - Módulo de comunicación con la API para Check Pro
 */

import { LS } from './utils.js';

export const API = {
    BASE_URL: '/api',
    TIMEOUT_MS: 30000,

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

        // Timeout con AbortController para no colgar la UI indefinidamente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
        options.signal = controller.signal;

        try {
            const response = await fetch(url, options);

            // Manejo de errores HTTP
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('[API] Sesión expirada o no autorizada');
                    window.dispatchEvent(new CustomEvent('auth:unauthorized', {
                        detail: { status: 401, message: 'Sesión expirada' }
                    }));
                }
                const errorData = await response.json().catch(() => ({}));
                throw this._makeError(errorData.message || errorData.error || `HTTP ${response.status}`, response.status, errorData);
            }

            const body = await response.json();

            // Contrato unificado: los endpoints que responden {success:false} con 200
            // también se tratan como error para que los try/catch de las vistas funcionen.
            if (body && typeof body === 'object' && body.success === false) {
                throw this._makeError(body.error || body.message || 'Error en la operación', response.status, body);
            }

            return body;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw this._makeError('Tiempo de espera agotado (30s)', 408, {});
            }
            // Re-lanzar ApiError tal cual; envolver fallos de red
            if (error.isApiError) throw error;
            console.error('[API] Error de conexión:', error);
            throw this._makeError('Error de conexión con el servidor', 0, {});
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Crea un Error normalizado con metadatos de API.
     * Las vistas pueden usar e.message directamente en toasts/alertas.
     */
    _makeError(message, status, payload) {
        const err = new Error(message);
        err.isApiError = true;
        err.status = status;
        err.payload = payload;
        return err;
    }
};
