/**
 * modules/services/GuestService.js
 * Servicio de gestión de invitados
 */

import { ApiServiceInstance } from './ApiService.js';
import { AppStateManager } from '../core/State.js';
import { ToastManager } from '../components/Toast.js';

class GuestService {
    constructor() {
        this.cache = new Map();
    }
    
    // Obtener invitados de un evento
    async getByEvent(eventId) {
        // Check cache first
        const cacheKey = `event_${eventId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await ApiServiceInstance.getGuests(eventId);
            
            if (response.success) {
                // Cache and update state
                this.cache.set(cacheKey, response.guests);
                AppStateManager.set('guests', response.guests);
                
                return response.guests;
            } else {
                ToastManager.error('Error', response.error || 'No se pudieron cargar invitados');
                return [];
            }
        } catch (error) {
            console.error('[GUESTS] Error:', error);
            return [];
        }
    }
    
    // Agregar invitado
    async add(eventId, guestData) {
        try {
            const response = await ApiServiceInstance.addGuest(eventId, guestData);
            
            if (response.success) {
                ToastManager.success('Éxito', 'Invitado agregado');
                
                // Update cache and state
                const cacheKey = `event_${eventId}`;
                const guests = this.cache.get(cacheKey) || [];
                guests.unshift(response.guest);
                this.cache.set(cacheKey, guests);
                AppStateManager.set('guests', guests);
                
                return response.guest;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo agregar');
                return null;
            }
        } catch (error) {
            console.error('[GUESTS] Error:', error);
            return null;
        }
    }
    
    // Actualizar invitado
    async update(eventId, guestId, guestData) {
        try {
            const response = await ApiServiceInstance.updateGuest(eventId, guestId, guestData);
            
            if (response.success) {
                ToastManager.success('Éxito', 'Invitado actualizado');
                
                // Update cache and state
                const cacheKey = `event_${eventId}`;
                const guests = this.cache.get(cacheKey) || [];
                const index = guests.findIndex(g => g.id === guestId);
                if (index !== -1) {
                    guests[index] = response.guest;
                    this.cache.set(cacheKey, guests);
                    AppStateManager.set('guests', guests);
                }
                
                return response.guest;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo actualizar');
                return null;
            }
        } catch (error) {
            console.error('[GUESTS] Error:', error);
            return null;
        }
    }
    
    // Eliminar invitado
    async delete(eventId, guestId) {
        try {
            const response = await ApiServiceInstance.deleteGuest(eventId, guestId);
            
            if (response.success) {
                ToastManager.success('Eliminado', 'Invitado eliminado');
                
                // Update cache and state
                const cacheKey = `event_${eventId}`;
                const guests = this.cache.get(cacheKey) || [];
                const filtered = guests.filter(g => g.id !== guestId);
                this.cache.set(cacheKey, filtered);
                AppStateManager.set('guests', filtered);
                
                return true;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo eliminar');
                return false;
            }
        } catch (error) {
            console.error('[GUESTS] Error:', error);
            return false;
        }
    }
    
    // Check-in de invitado
    async checkIn(eventId, guestId) {
        try {
            const response = await ApiServiceInstance.checkInGuest(eventId, guestId);
            
            if (response.success) {
                ToastManager.success('Check-in', 'Asistencia registrada');
                
                // Update cache and state
                const cacheKey = `event_${eventId}`;
                const guests = this.cache.get(cacheKey) || [];
                const index = guests.findIndex(g => g.id === guestId);
                if (index !== -1) {
                    guests[index].status = 'checked-in';
                    guests[index].checkedInAt = new Date().toISOString();
                    this.cache.set(cacheKey, guests);
                    AppStateManager.set('guests', guests);
                }
                
                return true;
            } else {
                ToastManager.error('Error', response.error || 'No se pudo registrar');
                return false;
            }
        } catch (error) {
            console.error('[GUESTS] Check-in error:', error);
            return false;
        }
    }
    
    // Buscar invitados
    async search(eventId, query) {
        const guests = await this.getByEvent(eventId);
        
        if (!query.trim()) return guests;
        
        const lowerQuery = query.toLowerCase();
        return guests.filter(guest => 
            guest.name?.toLowerCase().includes(lowerQuery) ||
            guest.email?.toLowerCase().includes(lowerQuery) ||
            guest.organization?.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Filtrar por estado
    async filterByStatus(eventId, status) {
        const guests = await this.getByEvent(eventId);
        
        if (!status) return guests;
        
        return guests.filter(g => g.status === status);
    }
    
    // Obtener estadísticas
    async getStats(eventId) {
        const guests = await this.getByEvent(eventId);
        
        return {
            total: guests.length,
            pending: guests.filter(g => g.status === 'pending').length,
            confirmed: guests.filter(g => g.status === 'confirmed').length,
            checkedIn: guests.filter(g => g.status === 'checked-in').length,
            cancelled: guests.filter(g => g.status === 'cancelled').length
        };
    }
    
    // Importar invitados (batch)
    async importBatch(eventId, guestsData) {
        const results = {
            success: [],
            failed: []
        };
        
        for (const guestData of guestsData) {
            const guest = await this.add(eventId, guestData);
            if (guest) {
                results.success.push(guest);
            } else {
                results.failed.push(guestData);
            }
        }
        
        return results;
    }
    
    // Exportar invitados a CSV
    exportToCSV(eventId) {
        const guests = AppStateManager.get('guests') || [];
        
        if (guests.length === 0) {
            ToastManager.warning('Sin datos', 'No hay invitados para exportar');
            return;
        }
        
        const csv = [
            ['Nombre', 'Email', 'Empresa', 'Cargo', 'Teléfono', 'Estado'].join(','),
            ...guests.map(g => [
                `"${g.name || ''}"`,
                `"${g.email || ''}"`,
                `"${g.organization || ''}"`,
                `"${g.position || ''}"`,
                `"${g.phone || ''}"`,
                `"${g.status || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `invitados_${eventId}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        ToastManager.success('Exportado', `${guests.length} invitados exportados`);
    }
    
    // Limpiar cache
    clearCache(eventId = null) {
        if (eventId) {
            this.cache.delete(`event_${eventId}`);
        } else {
            this.cache.clear();
        }
    }
}

export const GuestServiceInstance = new GuestService();

export default GuestServiceInstance;