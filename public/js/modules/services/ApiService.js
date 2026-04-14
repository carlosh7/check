/**
 * modules/services/ApiService.js
 * Wrapper de API para los módulos
 */

import { API as ApiClient } from '../../src/frontend/api.js';

class ApiService {
    constructor() {
        this.baseUrl = '/api';
        this.client = ApiClient;
    }
    
    // GET request
    async get(endpoint, options = {}) {
        return this.client.fetchAPI(endpoint, {
            method: 'GET',
            ...options
        });
    }
    
    // POST request
    async post(endpoint, data, options = {}) {
        return this.client.fetchAPI(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        });
    }
    
    // PUT request
    async put(endpoint, data, options = {}) {
        return this.client.fetchAPI(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }
    
    // DELETE request
    async delete(endpoint, options = {}) {
        return this.client.fetchAPI(endpoint, {
            method: 'DELETE',
            ...options
        });
    }
    
    // PATCH request
    async patch(endpoint, data, options = {}) {
        return this.client.fetchAPI(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    }
    
    // Métodos快捷
    async getEvents() {
        return this.get('/events');
    }
    
    async getEvent(eventId) {
        return this.get(`/events/${eventId}`);
    }
    
    async createEvent(eventData) {
        return this.post('/events', eventData);
    }
    
    async updateEvent(eventId, eventData) {
        return this.put(`/events/${eventId}`, eventData);
    }
    
    async deleteEvent(eventId) {
        return this.delete(`/events/${eventId}`);
    }
    
    async getGuests(eventId) {
        return this.get(`/events/${eventId}/guests`);
    }
    
    async addGuest(eventId, guestData) {
        return this.post(`/events/${eventId}/guests`, guestData);
    }
    
    async updateGuest(eventId, guestId, guestData) {
        return this.put(`/events/${eventId}/guests/${guestId}`, guestData);
    }
    
    async deleteGuest(eventId, guestId) {
        return this.delete(`/events/${eventId}/guests/${guestId}`);
    }
    
    async checkInGuest(eventId, guestId) {
        return this.post(`/events/${eventId}/guests/${guestId}/checkin`, {});
    }
    
    async getUsers() {
        return this.get('/users');
    }
    
    async createUser(userData) {
        return this.post('/users', userData);
    }
    
    async updateUser(userId, userData) {
        return this.put(`/users/${userId}`, userData);
    }
    
    async deleteUser(userId) {
        return this.delete(`/users/${userId}`);
    }
    
    async login(credentials) {
        return this.post('/auth/login', credentials);
    }
    
    async logout() {
        return this.post('/auth/logout', {});
    }
    
    // Manejo de errores
    handleError(error) {
        console.error('[API_SERVICE] Error:', error);
        return {
            success: false,
            error: error.message || 'Error de conexión'
        };
    }
}

// Instancia singleton
export const ApiServiceInstance = new ApiService();

export default ApiServiceInstance;