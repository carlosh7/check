class Form {
    constructor() {
        this.forms = new Map();
    }

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

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Seleccionar...';
        select.appendChild(defaultOpt);

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value || opt;
            option.textContent = opt.label || opt;
            select.appendChild(option);
        });

        wrapper.appendChild(select);

        return wrapper;
    }

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

    createFileInput(config) {
        const {
            name,
            label,
            accept = '*',
            multiple = false,
            required = false,
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
        input.type = 'file';
        input.name = name || '';
        input.accept = accept;
        input.multiple = multiple;
        input.required = required;
        input.className = 'form-file w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-colors cursor-pointer';

        wrapper.appendChild(input);

        return wrapper;
    }

    createToggleSwitch(config) {
        const {
            name,
            label,
            checked = false,
            disabled = false,
            className = ''
        } = config;

        const wrapper = document.createElement('label');
        wrapper.className = `flex items-center gap-3 cursor-pointer ${className}`;

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.name = name || '';
        toggle.checked = checked;
        toggle.disabled = disabled;
        toggle.className = 'sr-only peer';

        const visual = document.createElement('div');
        visual.className = 'relative w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-primary/60 peer-disabled:opacity-50 after:content-[""] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full';

        wrapper.appendChild(toggle);
        wrapper.appendChild(visual);

        if (label) {
            const labelText = document.createElement('span');
            labelText.className = 'text-sm text-slate-300';
            labelText.textContent = label;
            wrapper.appendChild(labelText);
        }

        return wrapper;
    }

    createDatePicker(config) {
        const {
            name,
            label,
            value = '',
            required = false,
            min,
            max,
            className = ''
        } = config;

        const wrapper = this.createInput({
            type: 'date',
            name,
            label,
            value,
            required,
            className
        });

        const input = wrapper.querySelector('input');
        if (min) input.min = min;
        if (max) input.max = max;

        return wrapper;
    }

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

    getFieldValue(formElement, fieldName) {
        const el = formElement.elements[fieldName] || formElement.querySelector(`[name="${fieldName}"]`);
        if (!el) return null;
        if (el.type === 'checkbox') return el.checked ? 1 : 0;
        if (el.type === 'radio') {
            const checked = formElement.querySelector(`[name="${fieldName}"]:checked`);
            return checked ? checked.value : null;
        }
        return el.value !== undefined ? el.value : null;
    }

    setFieldValue(formElement, fieldName, value) {
        const el = formElement.elements[fieldName] || formElement.querySelector(`[name="${fieldName}"]`);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else if (el.type === 'radio') {
            const radio = formElement.querySelector(`[name="${fieldName}"][value="${value}"]`);
            if (radio) radio.checked = true;
        } else {
            el.value = value !== null && value !== undefined ? value : '';
        }
    }

    getData(formElement) {
        const formData = new FormData(formElement);
        const data = {};

        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    }

    serialize(formElement) {
        const data = {};
        const elements = formElement.elements;

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (!el.name || el.disabled || el.type === 'file') continue;
            if (el.type === 'checkbox') {
                data[el.name] = el.checked ? 1 : 0;
            } else if (el.type === 'radio') {
                if (el.checked) data[el.name] = el.value;
            } else if (el.tagName === 'SELECT' && el.multiple) {
                data[el.name] = Array.from(el.selectedOptions).map(o => o.value);
            } else {
                const val = el.value;
                data[el.name] = (val === null || val === undefined || val === 'null') ? '' : val;
            }
        }

        return data;
    }

    populateForm(formElement, data) {
        if (!data) return;
        Object.keys(data).forEach(key => {
            this.setFieldValue(formElement, key, data[key]);
        });
    }

    reset(formElement) {
        formElement.reset();
        formElement.querySelectorAll('input, select, textarea').forEach(input => {
            input.classList.remove('border-red-500');
        });
    }

    setFieldError(formElement, fieldName, message) {
        const input = formElement.querySelector(`[name="${fieldName}"]`);
        if (!input) return;

        input.classList.add('border-red-500');

        const existingError = formElement.querySelector(`.form-error[data-field="${fieldName}"]`);
        if (existingError) {
            existingError.textContent = message;
            return;
        }

        const errorEl = document.createElement('p');
        errorEl.className = 'form-error text-red-400 text-xs mt-1';
        errorEl.setAttribute('data-field', fieldName);
        errorEl.textContent = message;
        input.parentNode.appendChild(errorEl);
    }

    clearFieldError(formElement, fieldName) {
        const input = formElement.querySelector(`[name="${fieldName}"]`);
        if (input) {
            input.classList.remove('border-red-500');
        }

        const errorEl = formElement.querySelector(`.form-error[data-field="${fieldName}"]`);
        if (errorEl) {
            errorEl.remove();
        }
    }

    clearAllErrors(formElement) {
        formElement.querySelectorAll('.border-red-500').forEach(el => {
            el.classList.remove('border-red-500');
        });
        formElement.querySelectorAll('.form-error').forEach(el => {
            el.remove();
        });
    }

    showErrors(formElement, errors) {
        this.clearAllErrors(formElement);

        Object.keys(errors).forEach(field => {
            const message = errors[field];
            this.setFieldError(formElement, field, message);
        });
    }
}

export const FormManager = new Form();

export default FormManager;
