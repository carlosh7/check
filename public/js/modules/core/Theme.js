/**
 * modules/core/Theme.js
 * Sistema de gestión de theme
 */

export class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
    }
    
    // Obtener tema actual
    getCurrentTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
        return this.getSystemTheme();
    }
    
    // Obtener tema del sistema
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    
    // Toggle theme
    toggleTheme() {
        const current = this.getCurrentTheme();
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }
    
    // Set tema específico
    setTheme(theme) {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        this.currentTheme = theme;
    }
    
    // Inicializar theme
    initTheme() {
        const theme = this.getCurrentTheme();
        this.setTheme(theme);
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
    
    // Aplicar transición suave
    applyThemeTransition() {
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    }
}

// Singleton
export const ThemeManagerInstance = new ThemeManager();

export default ThemeManagerInstance;