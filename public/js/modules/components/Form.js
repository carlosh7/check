/**
 * modules/components/Form.js
 * Sistema de formularios
 */

class Form {
    constructor() {
        this.forms = new Map();
    }
    
    // Crear elemento de input
    createInput(config) {
        const {
            type = 'text',
            name,
            label,
            placeholder = '',
            value = '',
            required = false,
            disabled = false,
            className = ''
        } = config;
        
        const wrapper = document.createElement('div');
        wrapper.className = `form-group mb-4 ${className}`;
        
        if (label) {
            wrapper.innerHTML = `
                <label class="block text-sm font-medium text-slate-300 mb-1">
                    ${label}${required ? '<span class="text-red-400">*</span>' : ''}
                </label>
            `;
        }
        
        const input = document.createElement('input');
        input.type = type;
        input.name = name || '';
        input.placeholder = placeholder;
        input.value = value;
        input.disabled = disabled;
        input.required = required;
        input.className = 'form-input w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-colors';
        
        wrapper.appendChild(input);
        
        return wrapper;
    }
    
    // Crear select
    createSelect(config) {
        const {
            name,
            label,
            options = [],
            value = '',
            required = false,
            disabled = false,
            className = ''
        } = config;
        
        const wrapper = document.createElement('div');
        wrapper.className = `form-group mb-4 ${className}`;
        
        if (label) {
            wrapper.innerHTML = `
                <label class="block text-sm font-medium text-slate-300 mb-1">
                    ${label}${required ? '<span class="text-red-400">*</span>' : ''}
                </label>
            `;
        }
        
        const select = document.createElement('select');
        select.name = name || '';
        select.value = value;
        select.disabled = disabled;
        select.required = required;
        select.className = 'form-select w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-colors';
        
        // Opción por defecto
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Seleccionar...';
        select.appendChild(defaultOpt);
        
        // Opciones
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value || opt;
            option.textContent = opt.label || opt;
            select.appendChild(option);
        });
        
        wrapper.appendChild(select);
        
        return wrapper;
    }
    
    // Crear textarea
    createTextarea(config) {
        const {
            name,
            label,
            placeholder = '',
            value = '',
            rows = 4,
            required = false,
            disabled = false,
            className = ''
        } = config;
        
        const wrapper = document.createElement('div');
        wrapper.className = `form-group mb-4 ${className}`;
        
        if (label) {
            wrapper.innerHTML = `
                <label class="block text-sm font-medium text-slate-300 mb-1">
                    ${label}${required ? '<span class="text-red-400">*</span>' : ''}
                </label>
            `;
        }
        
        const textarea = document.createElement('textarea');
        textarea.name = name || '';
        textarea.placeholder = placeholder;
        textarea.value = value;
        textarea.rows = rows;
        textarea.disabled = disabled;
        textarea.required = required;
        textarea.className = 'form-textarea w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-colors resize-y';
        
        wrapper.appendChild(textarea);
        
        return wrapper;
    }
    
    // Crear checkbox
    createCheckbox(config) {
        const {
            name,
            label,
            checked = false,
            disabled = false,
            className = ''
        } = config;
        
        const wrapper = document.createElement('div');
        wrapper.className = `form-checkbox flex items-center gap-2 mb-3 ${className}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = name || '';
        checkbox.checked = checked;
        checkbox.disabled = disabled;
        checkbox.className = 'w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50';
        
        if (label) {
            const labelEl = document.createElement('label');
            labelEl.className = 'text-sm text-slate-300';
            labelEl.textContent = label;
            wrapper.appendChild(labelEl);
        }
        
        wrapper.insertBefore(checkbox, wrapper.firstChild);
        
        return wrapper;
    }
    
    // Validar formulario
    validate(formElement) {
        const inputs = formElement.querySelectorAll('input, select, textarea');
        let isValid = true;
        
        inputs.forEach(input => {
            if (input.required && !input.value.trim()) {
                input.classList.add('border-red-500');
                isValid = false;
            } else {
                input.classList.remove('border-red-500');
            }
            
            // Validar email
            if (input.type === 'email' && input.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    input.classList.add('border-red-500');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    }
    
    // Obtener datos del formulario
    getData(formElement) {
        const formData = new FormData(formElement);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }
    
    // Resetear formulario
    reset(formElement) {
        formElement.reset();
        formElement.querySelectorAll('input, select, textarea').forEach(input => {
            input.classList.remove('border-red-500');
        });
    }
    
    // Mostrar errores
    showErrors(formElement, errors) {
        // Limpiar errores previos
        formElement.querySelectorAll('.border-red-500').forEach(el => {
            el.classList.remove('border-red-500');
        });
        
        // Mostrar nuevos errores
        Object.keys(errors).forEach(field => {
            const input = formElement.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('border-red-500');
            }
        });
    }
}

// Instancia singleton
export const FormManager = new Form();

export default FormManager;