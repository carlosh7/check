/**
 * modules/components/Dropdown.js
 * Sistema de menús desplegables
 */

class Dropdown {
    constructor() {
        this.activeDropdown = null;
        this.init();
    }
    
    // Inicializar
    init() {
        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                this.closeAll();
            }
        });
        
        // Cerrar al presionar Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }
    
    // Toggle dropdown
    toggle(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        const isOpen = dropdown.classList.contains('open');
        
        // Cerrar todos
        this.closeAll();
        
        // Abrir si no estaba abierto
        if (!isOpen) {
            dropdown.classList.add('open');
            this.activeDropdown = dropdownId;
        }
    }
    
    // Abrir dropdown
    open(dropdownId) {
        this.closeAll();
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.add('open');
            this.activeDropdown = dropdownId;
        }
    }
    
    // Cerrar dropdown
    close(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.remove('open');
            if (this.activeDropdown === dropdownId) {
                this.activeDropdown = null;
            }
        }
    }
    
    // Cerrar todos los dropdowns
    closeAll() {
        document.querySelectorAll('.dropdown.open').forEach(d => {
            d.classList.remove('open');
        });
        this.activeDropdown = null;
    }
    
    // Crear dropdown simple
    createSimple(config) {
        const {
            id,
            triggerText,
            triggerIcon = 'expand_more',
            items = [],
            className = ''
        } = config;
        
        const dropdown = document.createElement('div');
        dropdown.id = id;
        dropdown.className = `dropdown relative inline-block ${className}`;
        
        // Trigger button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'dropdown-trigger flex items-center gap-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 hover:border-white/20 transition-colors';
        trigger.innerHTML = `
            <span>${triggerText}</span>
            <span class="material-symbols-outlined text-lg">${triggerIcon}</span>
        `;
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(id);
        });
        
        // Menú
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu absolute z-50 mt-1 min-w-[160px] py-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl hidden';
        
        if (items.length > 0) {
            items.forEach(item => {
                if (item.divider) {
                    const divider = document.createElement('div');
                    divider.className = 'my-1 border-t border-white/10';
                    menu.appendChild(divider);
                } else {
                    const menuItem = document.createElement('button');
                    menuItem.type = 'button';
                    menuItem.className = 'dropdown-item w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2';
                    
                    if (item.icon) {
                        menuItem.innerHTML = `
                            <span class="material-symbols-outlined text-lg">${item.icon}</span>
                            <span>${item.text}</span>
                        `;
                    } else {
                        menuItem.textContent = item.text;
                    }
                    
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (item.onClick) item.onClick(item);
                        this.close(id);
                    });
                    
                    menu.appendChild(menuItem);
                }
            });
        }
        
        dropdown.appendChild(trigger);
        dropdown.appendChild(menu);
        
        return dropdown;
    }
    
    // Crear dropdown de acciones (tabla)
    createActionsDropdown(config) {
        const {
            id,
            actions = []
        } = config;
        
        const dropdown = document.createElement('div');
        dropdown.id = id;
        dropdown.className = 'dropdown relative inline-block';
        
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors';
        trigger.innerHTML = '<span class="material-symbols-outlined text-slate-400 text-sm">more_vert</span>';
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(id);
        });
        
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu absolute right-0 z-50 mt-1 min-w-[140px] py-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl hidden';
        
        actions.forEach(action => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${action.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`;
            
            item.innerHTML = `
                <span class="material-symbols-outlined text-lg">${action.icon}</span>
                <span>${action.text}</span>
            `;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (action.onClick) action.onClick(action);
                this.close(id);
            });
            
            menu.appendChild(item);
        });
        
        dropdown.appendChild(trigger);
        dropdown.appendChild(menu);
        
        return dropdown;
    }
    
    // Crear dropdown con búsqueda
    createSearchable(config) {
        const {
            id,
            placeholder = 'Buscar...',
            items = [],
            onSelect
        } = config;
        
        const dropdown = document.createElement('div');
        dropdown.id = id;
        dropdown.className = 'dropdown relative w-full';
        
        // Input de búsqueda
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'relative';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.className = 'w-full px-3 py-2 pl-9 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary/50';
        
        const searchIcon = document.createElement('span');
        searchIcon.className = 'material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-lg';
        searchIcon.textContent = 'search';
        
        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(input);
        
        // Menú
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto py-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl hidden';
        
        // Renderizar items
        const renderItems = (filteredItems) => {
            menu.innerHTML = '';
            filteredItems.forEach(item => {
                const menuItem = document.createElement('button');
                menuItem.type = 'button';
                menuItem.className = 'w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white';
                menuItem.textContent = item.text || item;
                menuItem.addEventListener('click', () => {
                    if (onSelect) onSelect(item);
                    this.close(id);
                });
                menu.appendChild(menuItem);
            });
        };
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = items.filter(item => 
                (item.text || item).toLowerCase().includes(query)
            );
            renderItems(filtered);
            menu.classList.remove('hidden');
        });
        
        input.addEventListener('focus', () => {
            renderItems(items);
            menu.classList.remove('hidden');
        });
        
        renderItems(items);
        
        dropdown.appendChild(inputWrapper);
        dropdown.appendChild(menu);
        
        return dropdown;
    }
    
    // Verificar si hay dropdown abierto
    isOpen() {
        return this.activeDropdown !== null;
    }
    
    // Obtener dropdown activo
    getActive() {
        return this.activeDropdown;
    }
}

// Instancia singleton
export const DropdownManager = new Dropdown();

export default DropdownManager;