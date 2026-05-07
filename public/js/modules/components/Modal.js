class Modal {
    constructor() {
        this.activeModals = new Set();
    }

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
    }

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`[MODAL] Modal not found: ${modalId}`);
            return;
        }
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        this.activeModals.delete(modalId);
        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
        }
    }

    toggle(modalId) {
        if (this.activeModals.has(modalId)) {
            this.hide(modalId);
        } else {
            this.show(modalId);
        }
    }

    hideAll() {
        this.activeModals.forEach(modalId => this.hide(modalId));
    }

    isActive(modalId) {
        return this.activeModals.has(modalId);
    }

    getActiveModals() {
        return Array.from(this.activeModals);
    }

    showEventModal() { this.show('modal-event'); }
    hideEventModal() { this.hide('modal-event'); }
    showInviteModal() { this.show('modal-invite'); }
    hideInviteModal() { this.hide('modal-invite'); }
    showQRModal() { this.show('modal-qr'); }
    hideQRModal() { this.hide('modal-qr'); }
    showTicketModal() { this.show('modal-ticket'); }
    hideTicketModal() { this.hide('modal-ticket'); }

    resetForm(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    }
}

export const ModalManager = new Modal();
export const ModalService = ModalManager;
export function hideModal(id) { return ModalManager.hide(id); }
export default ModalManager;