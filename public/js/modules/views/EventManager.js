/**
 * EventManager — Gestión modular de eventos
 * Extraído de app.js (20k líneas) como parte de la modularización v12.44.802
 * Mantiene compatibilidad con App.* (no sustituye, delega)
 */
import { ApiServiceInstance } from '../services/ApiService.js';
import { ToastManager } from '../components/Toast.js';

export class EventManager {
    constructor({ api = ApiServiceInstance, toast = ToastManager, state = null } = {}) {
        this.api = api;
        this.toast = toast;
        this.state = state;
        this.cache = null;
        this.lastLoad = 0;
        this.CACHE_TTL = 30000;
    }

    /**
     * Carga eventos con cache de 30s. Usa ApiService si está disponible.
     * @param {boolean} force - forzar recarga ignorando cache
     * @returns {Promise<Array>}
     */
    async loadEvents(force = false) {
        const now = Date.now();
        if (!force && this.cache && (now - this.lastLoad) < this.CACHE_TTL) {
            return this.cache;
        }
        try {
            const res = await this.api.getEvents();
            const events = Array.isArray(res) ? res : (res.data || res.events || []);
            this.cache = events;
            this.lastLoad = now;
            if (this.state) this.state.events = events;
            return events;
        } catch (e) {
            this.toast?.show?.('Error al cargar eventos', 'error');
            throw e;
        }
    }

    /**
     * Crea o actualiza un evento. Valida con FormManager y serializa.
     * @param {HTMLFormElement} form
     * @param {object} formManager - instancia de FormManager
     * @returns {Promise<object>}
     */
    async saveFromForm(form, formManager) {
        if (!formManager.validate(form)) {
            throw new Error('Formulario inválido');
        }
        const data = formManager.serialize(form);
        if (!data.name || !data.date) throw new Error('Nombre y fecha son obligatorios');
        const id = form.querySelector('#ev-id-hidden')?.value?.trim();
        const payload = {
            name: data.name,
            date: data.date,
            location: data.location || '',
            description: data.description || '',
            group_id: data.group_id || '',
            venue_id: data.venue_id || ''
        };
        let res;
        if (id) {
            res = await this.api.updateEvent(id, payload);
        } else {
            res = await this.api.createEvent(payload);
        }
        if (res && res.success === false) throw new Error(res.error || 'No se pudo guardar');
        this.cache = null; // invalidar
        return res;
    }

    /**
     * Elimina un evento con confirmación
     */
    async deleteEvent(id) {
        if (!id) throw new Error('ID requerido');
        const res = await this.api.deleteEvent(id);
        this.cache = null;
        return res;
    }

    /**
     * Filtra eventos en memoria por texto
     */
    filterEvents(events, query) {
        if (!query) return events;
        const q = query.toLowerCase();
        return events.filter(e =>
            (e.name || '').toLowerCase().includes(q) ||
            (e.location || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q)
        );
    }

    /**
     * Ordena eventos por campo
     */
    sortEvents(events, field, dir = 'asc') {
        const copy = [...events];
        copy.sort((a, b) => {
            const va = a[field] || '';
            const vb = b[field] || '';
            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });
        return copy;
    }
}

export const EventManagerInstance = new EventManager();
export default EventManagerInstance;
