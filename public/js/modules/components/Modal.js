/**
 * modules/components/Modal.js
 * Sistema de gestión de modales
 */

class Modal {
    constructor() {
        this.activeModals = new Set();
        this._clickHandler = (e) => {
            if (e.target === e.currentTarget) {
                this.hide(e.currentTarget.id);
            }
        };
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                const lastId = Array.from(this.activeModals).pop();
                this.hide(lastId);
            }
        };
    }
    
    // Mostrar un modal
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`[MODAL] Modal not found: ${modalId}`);
            return;
        }
        
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        this.activeModals.add(modalId);
        document.body.style.overflow = 'hidden';
        
        modal.addEventListener('click', this._clickHandler);
        if (this.activeModals.size === 1) {
            document.addEventListener('keydown', this._keyHandler);
        }
    }
    
    // Ocultar un modal
    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`[MODAL] Modal not found: ${modalId}`);
            return;
        }
        
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        modal.removeEventListener('click', this._clickHandler);
        this.activeModals.delete(modalId);
        
        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', this._keyHandler);
        }
    }
    
    // Toggle modal
    toggle(modalId) {
        if (this.activeModals.has(modalId)) {
            this.hide(modalId);
        } else {
            this.show(modalId);
        }
    }
    
    // Cerrar todos los modales activos
    hideAll() {
        this.activeModals.forEach(modalId => {
            this.hide(modalId);
        });
    }
    
    // Verificar si un modal está activo
    isActive(modalId) {
        return this.activeModals.has(modalId);
    }
    
    // Obtener lista de modales activos
    getActiveModals() {
        return Array.from(this.activeModals);
    }
    
    // Métodos快捷 para modales comunes
    showEventModal() {
        this.show('modal-event');
    }
    
    hideEventModal() {
        this.hide('modal-event');
    }
    
    showInviteModal() {
        this.show('modal-invite');
    }
    
    hideInviteModal() {
        this.hide('modal-invite');
    }
    
    showQRModal() {
        this.show('modal-qr');
    }
    
    hideQRModal() {
        this.hide('modal-qr');
    }
    
    showTicketModal() {
        this.show('modal-ticket');
    }
    
    hideTicketModal() {
        this.hide('modal-ticket');
    }
    
    // Resetear formulario de un modal
    resetForm(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }
}

// Instancia singleton
export const ModalManager = new Modal();

// Alias para compatibilidad
export const ModalService = ModalManager;

// Función global para backwards compatibility
export function hideModal(id) {
    return ModalManager.hide(id);
}

export default ModalManager;