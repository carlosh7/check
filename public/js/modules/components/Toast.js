/**
 * modules/components/Toast.js
 * Sistema de notificaciones Toast premium
 */

class Toast {
    constructor() {
        this.icons = {
            success: 'check_circle',
            error: 'cancel',
            warning: 'warning',
            info: 'info'
        };
        this.defaultDuration = 4000;
    }
    
    // Obtener el contenedor de toasts
    _getContainer() {
        return document.getElementById('premium-toast-container');
    }
    
    // Mostrar toast
    show(title, message, type = 'success', duration = 4000) {
        const container = this._getContainer();
        if (!container) {
            console.warn('[TOAST] Container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `premium-toast ${type}`;
        
        const icon = this.icons[type] || 'notifications';
        
        toast.innerHTML = `
            <div class="premium-toast-icon">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="premium-toast-content">
                <div class="premium-toast-title">${title}</div>
                <div class="premium-toast-message">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Sonido
        this.playSound(type);
        
        // Auto-remover
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }
    
    // Alias para compatibilidad
    showNotification(title, message, type, duration) {
        return this.show(title, message, type, duration);
    }
    
    // Métodos快捷
    success(title, message, duration) {
        this.show(title, message, 'success', duration || this.defaultDuration);
    }
    
    error(title, message, duration) {
        this.show(title, message, 'error', duration || this.defaultDuration);
    }
    
    warning(title, message, duration) {
        this.show(title, message, 'warning', duration || this.defaultDuration);
    }
    
    info(title, message, duration) {
        this.show(title, message, 'info', duration || this.defaultDuration);
    }
    
    // Sonido sintetizado
    playSound(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            const now = ctx.currentTime;
            
            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'error') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
            // warning e info sin sonido por ahora
        } catch (e) {
            console.warn('[TOAST] Audio not supported or blocked');
        }
    }
    
    // Método legacy para compatibilidad
    notify(title, message, type = 'success') {
        this.show(title, message, type, this.defaultDuration);
    }
}

// Instancia singleton
export const ToastManager = new Toast();

// Alias para compatibilidad
export const ToastService = ToastManager;

export default ToastManager;