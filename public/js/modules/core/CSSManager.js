/**
 * modules/core/CSSManager.js
 * Sistema de gestión de estilos CSS modular
 */

export class CSSManager {
    constructor() {
        this.loadedModules = new Set();
        this.modules = {
            base: '/css/modules/base.css',
            layout: '/css/modules/layout.css',
            components: '/css/modules/components.css',
            tables: '/css/modules/tables.css',
            forms: '/css/modules/forms.css',
            survey: '/css/modules/survey.css',
            wheel: '/css/modules/wheel.css',
            ticket: '/css/modules/ticket.css',
            registro: '/css/modules/registro.css'
        };
        this.linkId = 'dynamic-css-manager';
    }

    getVersion() {
        return '12.44.483';
    }

    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return true;
        }

        const modulePath = this.modules[moduleName];
        if (!modulePath) {
            console.warn(`[CSSManager] Módulo '${moduleName}' no encontrado`);
            return false;
        }

        try {
            const existingLink = document.getElementById(`${this.linkId}-${moduleName}`);
            if (existingLink) {
                this.loadedModules.add(moduleName);
                return true;
            }

            const link = document.createElement('link');
            link.id = `${this.linkId}-${moduleName}`;
            link.rel = 'stylesheet';
            link.href = `${modulePath}?v=${this.getVersion()}`;
            
            document.head.appendChild(link);
            this.loadedModules.add(moduleName);
            console.log(`[CSSManager] Módulo '${moduleName}' cargado`);
            return true;
        } catch (error) {
            console.error(`[CSSManager] Error cargando módulo '${moduleName}':`, error);
            return false;
        }
    }

    async unloadModule(moduleName) {
        if (!this.loadedModules.has(moduleName)) {
            return false;
        }

        const link = document.getElementById(`${this.linkId}-${moduleName}`);
        if (link) {
            link.remove();
            this.loadedModules.delete(moduleName);
            console.log(`[CSSManager] Módulo '${moduleName}' descargado`);
            return true;
        }
        return false;
    }

    async loadAll() {
        console.log('[CSSManager] Cargando todos los módulos CSS...');
        const promises = Object.keys(this.modules).map(name => this.loadModule(name));
        await Promise.all(promises);
        console.log('[CSSManager] Todos los módulos cargados');
    }

    async loadPage(pageName) {
        const pageModules = {
            survey: ['base', 'survey'],
            wheel: ['base', 'wheel'],
            ticket: ['base'],
            registro: ['base']
        };

        if (pageModules[pageName]) {
            for (const mod of pageModules[pageName]) {
                await this.loadModule(mod);
            }
        } else {
            await this.loadAll();
        }
    }

    isLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }

    getLoadedModules() {
        return Array.from(this.loadedModules);
    }
}

export const CSSManagerInstance = new CSSManager();
export default CSSManagerInstance;
