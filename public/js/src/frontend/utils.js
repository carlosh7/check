/**
 * utils.js - Utilidades compartidas para Check Pro
 */

// --- localStorage WRAPPER (soporta Tracking Prevention de Edge) ---
export const LS = {
    get: (k) => { try { return localStorage.getItem(k); } catch(e) { console.warn('[LS] Error get:', k, e); return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { console.warn('[LS] Error set:', k, v, e); } },
    remove: (k) => { try { localStorage.removeItem(k); } catch(e) { console.warn('[LS] Error remove:', k, e); } }
};

// --- LAZY LOADING UTILITY (Performance V12.3) ---
export const lazyLoad = {
    observer: null,
    loadedScripts: new Set(),
    loadedStyles: new Set(),
    
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        const src = el.dataset.src;
                        if (src) {
                            el.src = src;
                            el.removeAttribute('data-src');
                            this.observer.unobserve(el);
                        }
                        const bgSrc = el.dataset.bgSrc;
                        if (bgSrc) {
                            el.style.backgroundImage = `url('${bgSrc}')`;
                            el.removeAttribute('data-bg-src');
                            this.observer.unobserve(el);
                        }
                    }
                });
            }, { rootMargin: '100px', threshold: 0.1 });
        }
    },
    
    observe(el) {
        if (this.observer && (el.dataset.src || el.dataset.bgSrc)) {
            this.observer.observe(el);
        }
    },
    
    observeAll(selector = '[data-src], [data-bg-src]') {
        if (!this.observer) return;
        document.querySelectorAll(selector).forEach(el => this.observe(el));
    },
    
    async loadScript(url, options = {}) {
        if (this.loadedScripts.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            if (options.integrity) script.integrity = options.integrity;
            if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
            script.onload = () => { this.loadedScripts.add(url); resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async loadQuill() {
        
        await this.loadStyle('https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css');
        await this.loadScript('https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js');
        
    },
    
    async loadStyle(url, options = {}) {
        if (this.loadedStyles.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            if (options.integrity) link.integrity = options.integrity;
            if (options.crossOrigin) link.crossOrigin = options.crossOrigin;
            link.onload = () => { this.loadedStyles.add(url); resolve(); };
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }
};
