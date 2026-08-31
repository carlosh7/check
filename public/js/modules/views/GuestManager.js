/**
 * GuestManager — Pipeline de invitados, categorías, check-in y waitlist
 * Extraído de app.js para modularización v12.44.802
 */
import { ApiServiceInstance } from '../services/ApiService.js';

export class GuestManager {
    constructor({ api = ApiServiceInstance } = {}) {
        this.api = api;
    }

    /**
     * Cambia estado del pipeline y registra en log
     * @param {string} eventId
     * @param {string} guestId
     * @param {string} status - lead | contacted | confirmed | attended | not_interested
     * @returns {Promise<object>}
     */
    async changeStatus(eventId, guestId, status) {
        const valid = ['lead', 'contacted', 'confirmed', 'attended', 'not_interested'];
        if (!valid.includes(status)) throw new Error(`Estado inválido: ${status}`);
        return this.api.client.fetchAPI(`/guests/${eventId}/guest-status/${guestId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    /**
     * Obtiene resumen del pipeline por estado
     */
    async getPipeline(eventId) {
        return this.api.client.fetchAPI(`/guests/${eventId}/pipeline`);
    }

    /**
     * Asigna categoría a un invitado
     */
    async setCategory(eventId, guestId, categoryId) {
        return this.api.client.fetchAPI(`/guests/${eventId}/guest-category/${guestId}`, {
            method: 'PATCH',
            body: JSON.stringify({ category_id: categoryId })
        });
    }

    /**
     * Lista categorías del evento
     */
    async listCategories(eventId) {
        return this.api.client.fetchAPI(`/guests/${eventId}/categories`);
    }

    /**
     * Check-in toggle
     */
    async toggleCheckin(guestId) {
        return this.api.checkInGuest(null, guestId); // ApiService resuelve la ruta correcta vía delegation
    }

    /**
     * Filtra invitados por estado y categoría en memoria
     */
    filterGuests(guests, { status, categoryId, search } = {}) {
        let list = guests;
        if (status) list = list.filter(g => g.status === status);
        if (categoryId) list = list.filter(g => String(g.category_id) === String(categoryId));
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(g =>
                (g.name || '').toLowerCase().includes(q) ||
                (g.email || '').toLowerCase().includes(q) ||
                (g.organization || '').toLowerCase().includes(q)
            );
        }
        return list;
    }

    /**
     * Calcula disponibilidad por categoría (cupos)
     */
    availability(categories, guests) {
        return categories.map(c => {
            const used = guests.filter(g => String(g.category_id) === String(c.id) && g.status !== 'waitlisted').length;
            const waitlisted = guests.filter(g => String(g.category_id) === String(c.id) && g.status === 'waitlisted').length;
            return {
                id: c.id,
                name: c.name,
                capacity: c.capacity,
                used,
                remaining: Math.max(0, (c.capacity || 0) - used),
                waitlist: waitlisted
            };
        });
    }
}

export const GuestManagerInstance = new GuestManager();
export default GuestManagerInstance;
