/**
 * SessionManager — Gestión de sesión, login, 2FA y recovery sin recargar
 * Complementa AuthService para flujos UI de v12.44.790+
 */
import { ApiServiceInstance } from '../services/ApiService.js';

const LS_KEY = 'user';

export class SessionManager {
    constructor({ api = ApiServiceInstance, storage = null } = {}) {
        this.api = api;
        this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.user = this.restore();
    }

    restore() {
        try {
            const raw = this.storage?.getItem(LS_KEY);
            if (!raw || raw === 'undefined' || raw === 'null') return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    persist(user) {
        this.user = user;
        try { this.storage?.setItem(LS_KEY, JSON.stringify(user)); } catch {}
    }

    clear() {
        this.user = null;
        try { this.storage?.removeItem(LS_KEY); this.storage?.removeItem('token'); } catch {}
    }

    isAuthenticated() {
        return !!(this.user && (this.user.token || this.user.userId));
    }

    /**
     * Login con soporte 2FA. Lanza error con { requires2FA: true } si necesita código.
     */
    async login(username, password, totpToken) {
        const body = { username, password };
        if (totpToken) body.totp_token = totpToken;
        const data = await this.api.login(body);
        if (data.requires2FA) {
            const err = new Error(data.message || 'Código 2FA requerido');
            err.requires2FA = true;
            throw err;
        }
        if (!data.success) throw new Error(data.message || 'Credenciales inválidas');
        this.persist(data);
        return data;
    }

    async logout() {
        try { await this.api.logout(); } catch {}
        this.clear();
    }

    /**
     * Flujo recovery en 2 pasos: requestCode + resetPassword
     */
    async requestRecoveryCode(email) {
        const res = await fetch('/api/password-reset-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: email })
        });
        const data = await res.json();
        if (!res.ok || data.errors) throw new Error(data.errors?.[0] || 'No se pudo enviar el código');
        return data;
    }

    async resetPassword(code, newPassword) {
        if (!code || code.length !== 6) throw new Error('Código de 6 dígitos requerido');
        if (!newPassword || newPassword.length < 8) throw new Error('Mínimo 8 caracteres');
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, new_password: newPassword })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cambiar la contraseña');
        return data;
    }

    async getTwoFactorStatus(token) {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/me/2fa/status', { headers });
        return res.json();
    }
}

export const SessionManagerInstance = new SessionManager();
export default SessionManagerInstance;
