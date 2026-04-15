/**
 * modules/services/EventService.js
 * Servicio de gestión de eventos
 */

import { ApiServiceInstance } from './ApiService.js';
import { AppStateManager } from '../core/State.js';
import { ToastManager } from '../components/Toast.js';

class EventService {
    constructor() {
        this.cache = new Map();
    }
    
    // Obtener todos los eventos
    async getAll(force = false) {
        try {
            if (!force && this.cache.has('all')) {
                return this.cache.get('all');
            }
            
            const response = await ApiServiceInstance.getEvents();
            
            // fetchAPI devuelve array directamente o {success, events}
            const events = Array.isArray(response) ? response : (response.events || []);
            
            if (events.length > 0) {
                this.cache.set('all', events);
                AppStateManager.set('events', events);
                return events;
            } else {
                return [];
            }
        } catch (error) {
            console.error('[EVENTS] Error:', error);
            return [];
        }
    }
    
    // Limpiar cache
    clearCache() {
        this.cache.clear();
    }
    
    // Obtener evento por ID
    async getById(eventId) {
        // Check cache first
        if (this.cache.has(eventId)) {
            return this.cache.get(eventId);
        }
        
        try {
            const response = await ApiServiceInstance.getEvent(eventId);
            
            if (response.success) {
                this.cache.set(eventId, response.event);
                AppStateManager.set('event', response.event);
                return response.event;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo cargar el evento');
                return null;
            }
        } catch (error) {
            console.error('[EVENTS] Error:', error);
            return null;
        }
    }
    
    // Crear evento
    async create(eventData) {
        try {
            const response = await ApiServiceInstance.createEvent(eventData);
            
            if (response.success) {
                ToastManager.success('Éxito', 'Evento creado correctamente');
                
                // Add to cache and state
                const events = AppStateManager.get('events') || [];
                events.unshift(response.event);
                AppStateManager.set('events', events);
                
                return response.event;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo crear el evento');
                return null;
            }
        } catch (error) {
            console.error('[EVENTS] Error:', error);
            ToastManager.error('Error', 'Error de conexión');
            return null;
        }
    }
    
    // Actualizar evento
    async update(eventId, eventData) {
        try {
            const response = await ApiServiceInstance.updateEvent(eventId, eventData);
            
            if (response.success) {
                ToastManager.success('Éxito', 'Evento actualizado');
                
                // Update cache
                this.cache.set(eventId, response.event);
                
                // Update state
                const events = AppStateManager.get('events') || [];
                const index = events.findIndex(e => e.id === eventId);
                if (index !== -1) {
                    events[index] = response.event;
                    AppStateManager.set('events', events);
                }
                
                // Update current event if it's the same
                const currentEvent = AppStateManager.get('event');
                if (currentEvent?.id === eventId) {
                    AppStateManager.set('event', response.event);
                }
                
                return response.event;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo actualizar');
                return null;
            }
        } catch (error) {
            console.error('[EVENTS] Error:', error);
            return null;
        }
    }
    
    // Eliminar evento
    async delete(eventId) {
        try {
            const response = await ApiServiceInstance.deleteEvent(eventId);
            
            if (response.success) {
                ToastManager.success('Eliminado', 'Evento eliminado');
                
                // Remove from cache
                this.cache.delete(eventId);
                
                // Remove from state
                const events = AppStateManager.get('events') || [];
                const filtered = events.filter(e => e.id !== eventId);
                AppStateManager.set('events', filtered);
                
                return true;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo eliminar');
                return false;
            }
        } catch (error) {
            console.error('[EVENTS] Error:', error);
            return false;
        }
    }
    
    // Buscar eventos
    async search(query) {
        const events = AppStateManager.get('events') || [];
        
        if (!query.trim()) return events;
        
        const lowerQuery = query.toLowerCase();
        return events.filter(event => 
            event.name?.toLowerCase().includes(lowerQuery) ||
            event.client?.toLowerCase().includes(lowerQuery) ||
            event.location?.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Filtrar eventos
    async filterByStatus(status) {
        const events = AppStateManager.get('events') || [];
        
        if (!status) return events;
        
        return events.filter(e => e.status === status);
    }
    
    // Filtrar eventos por cliente
    async filterByClient(client) {
        const events = AppStateManager.get('events') || [];
        
        if (!client) return events;
        
        return events.filter(e => e.client === client);
    }
    
    // Obtener eventos próximos
    async getUpcoming() {
        const events = AppStateManager.get('events') || [];
        const now = new Date();
        
        return events.filter(e => {
            const eventDate = new Date(e.date);
            return e.status === 'upcoming' && eventDate > now;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    // Obtener eventos activos
    async getActive() {
        const events = AppStateManager.get('events') || [];
        return events.filter(e => e.status === 'active');
    }
    
    // Obtener eventos finalizados
    async getCompleted() {
        const events = AppStateManager.get('events') || [];
        return events.filter(e => e.status === 'completed');
    }
    
    // Exportar eventos
    exportToCSV(events) {
        if (!events || events.length === 0) {
            ToastManager.warning('Sin datos', 'No hay eventos para exportar');
            return;
        }
        
        const csv = [
            ['Nombre', 'Cliente', 'Fecha', 'Ubicación', 'Estado'].join(','),
            ...events.map(e => [
                `"${e.name || ''}"`,
                `"${e.client || ''}"`,
                `"${e.date || ''}"`,
                `"${e.location || ''}"`,
                `"${e.status || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `eventos_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        ToastManager.success('Exportado', `${events.length} eventos exportados`);
    }
    
    // Limpiar cache
    clearCache() {
        this.cache.clear();
    }
}

export const EventServiceInstance = new EventService();

export default EventServiceInstance;