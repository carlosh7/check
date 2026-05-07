import { LS } from '../src/frontend/utils.js';

const ThemeModule = window.ThemeModule = {
    VERSION: '12.44.516',
    
    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    
    getCurrentTheme() {
        if (typeof ThemeManagerInstance !== 'undefined') {
            return ThemeManagerInstance.getCurrentTheme();
        }
        const saved = LS.get('theme');
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
        return this.getSystemTheme();
    },
    
    applyThemeTransition() {
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    },
    
    toggleTheme() {
        let newTheme;
        if (typeof ThemeManagerInstance !== 'undefined') {
            newTheme = ThemeManagerInstance.toggleTheme();
        } else {
            const currentTheme = this.getCurrentTheme();
            newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.applyThemeTransition();
            document.documentElement.classList.remove('dark', 'light');
            document.documentElement.classList.add(newTheme);
            LS.set('theme', newTheme);
        }
        
        document.querySelectorAll('.theme-icon').forEach(icon => {
            icon.textContent = newTheme === 'dark' ? 'dark_mode' : 'light_mode';
        });
        
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
    },
    
    initTheme() {
        const theme = ThemeManagerInstance ? ThemeManagerInstance.getCurrentTheme() : this.getCurrentTheme();
        
        if (typeof ThemeManagerInstance !== 'undefined') {
            ThemeManagerInstance.initTheme();
        }
        
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
        
        document.querySelectorAll('.theme-icon').forEach(icon => {
            icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
        });
        
        if (!window._themeListenerAdded) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!LS.get('theme')) {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.classList.remove('dark', 'light');
                    document.documentElement.classList.add(newTheme);
                    document.querySelectorAll('.theme-icon').forEach(icon => {
                        icon.textContent = newTheme === 'dark' ? 'dark_mode' : 'light_mode';
                    });
                }
            });
            window._themeListenerAdded = true;
        }
    }
};

export default ThemeModule;