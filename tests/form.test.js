/**
 * @jest-environment jsdom
 */

const path = require('path');

describe('FormManager', () => {
    let FormManager;

    beforeAll(() => {
        const module = require(path.resolve(__dirname, '../public/js/modules/components/Form.js'));
        FormManager = module.FormManager || module.default;
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('should be a singleton instance', () => {
        expect(FormManager).toBeDefined();
        expect(FormManager.constructor.name).toBe('Form');
    });

    test('should create input element', () => {
        const wrapper = FormManager.createInput({
            name: 'test-name',
            label: 'Test Label',
            placeholder: 'Enter value',
            required: true
        });

        expect(wrapper).toBeInstanceOf(HTMLElement);
        expect(wrapper.querySelector('input')).toBeTruthy();
        expect(wrapper.querySelector('input').name).toBe('test-name');
        expect(wrapper.querySelector('input').required).toBe(true);
        expect(wrapper.querySelector('input').placeholder).toBe('Enter value');
    });

    test('should create select element', () => {
        const wrapper = FormManager.createSelect({
            name: 'test-select',
            options: [
                { value: '1', label: 'One' },
                { value: '2', label: 'Two' }
            ]
        });

        const select = wrapper.querySelector('select');
        expect(select).toBeTruthy();
        expect(select.name).toBe('test-select');
        expect(select.options.length).toBe(3);
    });

    test('should create textarea element', () => {
        const wrapper = FormManager.createTextarea({
            name: 'test-area',
            rows: 6
        });

        const textarea = wrapper.querySelector('textarea');
        expect(textarea).toBeTruthy();
        expect(textarea.name).toBe('test-area');
        expect(textarea.rows).toBe(6);
    });

    test('should create checkbox element', () => {
        const wrapper = FormManager.createCheckbox({
            name: 'test-check',
            label: 'Accept terms',
            checked: true
        });

        const checkbox = wrapper.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeTruthy();
        expect(checkbox.checked).toBe(true);
    });

    test('should create file input', () => {
        const wrapper = FormManager.createFileInput({
            name: 'test-file',
            accept: '.pdf,.jpg'
        });

        const input = wrapper.querySelector('input[type="file"]');
        expect(input).toBeTruthy();
        expect(input.accept).toBe('.pdf,.jpg');
    });

    test('should create toggle switch', () => {
        const wrapper = FormManager.createToggleSwitch({
            name: 'test-toggle',
            label: 'Enable',
            checked: true
        });

        const input = wrapper.querySelector('input[type="checkbox"]');
        expect(input).toBeTruthy();
        expect(input.checked).toBe(true);
    });

    test('should create date picker', () => {
        const wrapper = FormManager.createDatePicker({
            name: 'event-date',
            value: '2026-06-01',
            required: true
        });

        const input = wrapper.querySelector('input[type="date"]');
        expect(input).toBeTruthy();
        expect(input.value).toBe('2026-06-01');
        expect(input.required).toBe(true);
    });

    test('should get and set field values', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input name="username" value="john">
            <input type="checkbox" name="active" checked>
        `;

        expect(FormManager.getFieldValue(form, 'username')).toBe('john');
        expect(FormManager.getFieldValue(form, 'active')).toBe(1);
        expect(FormManager.getFieldValue(form, 'nonexistent')).toBeNull();

        FormManager.setFieldValue(form, 'username', 'jane');
        expect(form.querySelector('[name="username"]').value).toBe('jane');
    });

    test('should serialize form data correctly', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input name="name" value="Event 1">
            <input type="checkbox" name="is_public" checked>
            <input type="checkbox" name="has_parking">
            <select name="category">
                <option value="1" selected>VIP</option>
                <option value="2">Regular</option>
            </select>
        `;

        const data = FormManager.serialize(form);
        expect(data.name).toBe('Event 1');
        expect(data.is_public).toBe(1);
        expect(data.has_parking).toBe(0);
    });

    test('should populate form with data', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="name" value=""><input name="desc" value="">';

        FormManager.populateForm(form, { name: 'New Event', desc: 'Description' });

        expect(form.querySelector('[name="name"]').value).toBe('New Event');
        expect(form.querySelector('[name="desc"]').value).toBe('Description');
    });

    test('should validate required fields', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input name="name" required value="">
            <input name="email" required value="test@test.com">
        `;

        expect(FormManager.validate(form)).toBe(false);
        expect(form.querySelector('[name="name"]').classList.contains('border-red-500')).toBe(true);
        expect(form.querySelector('[name="email"]').classList.contains('border-red-500')).toBe(false);
    });

    test('should clear all errors', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="name" class="border-red-500">';

        FormManager.clearAllErrors(form);
        expect(form.querySelector('[name="name"]').classList.contains('border-red-500')).toBe(false);
    });

    test('should set and clear field errors', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="email" value="invalid">';

        FormManager.setFieldError(form, 'email', 'Invalid');
        expect(form.querySelector('[name="email"]').classList.contains('border-red-500')).toBe(true);
        expect(form.querySelector('.form-error').textContent).toBe('Invalid');

        FormManager.clearFieldError(form, 'email');
        expect(form.querySelector('.form-error')).toBeNull();
    });

    test('should clear errors on reset', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="name" value="test" class="border-red-500">';

        FormManager.reset(form);
        expect(form.querySelector('[name="name"]').classList.contains('border-red-500')).toBe(false);
    });

    test('should show multiple errors', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="name" value=""><input name="email" value="">';

        FormManager.showErrors(form, { name: 'Required', email: 'Required' });

        expect(form.querySelectorAll('.form-error').length).toBe(2);
        expect(form.querySelector('.border-red-500')).toBeTruthy();
    });

    test('should handle getData with FormData', () => {
        const form = document.createElement('form');
        form.innerHTML = '<input name="test" value="hello">';

        const data = FormManager.getData(form);
        expect(data.test).toBe('hello');
    });
});
