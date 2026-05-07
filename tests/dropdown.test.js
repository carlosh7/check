/**
 * @jest-environment jsdom
 */

const path = require('path');

describe('DropdownManager', () => {
    let DropdownManager;

    beforeAll(() => {
        const mod = require(path.resolve(__dirname, '../public/js/modules/components/Dropdown.js'));
        DropdownManager = mod.DropdownManager || mod.default;
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('should be a singleton instance', () => {
        expect(DropdownManager).toBeDefined();
        expect(DropdownManager.constructor.name).toBe('Dropdown');
    });

    test('should create simple dropdown', () => {
        const dropdown = DropdownManager.createSimple({
            id: 'test-dropdown',
            triggerText: 'Actions',
            items: [
                { text: 'Edit', icon: 'edit', onClick: jest.fn() },
                { divider: true },
                { text: 'Delete', icon: 'delete', onClick: jest.fn() }
            ]
        });

        expect(dropdown).toBeInstanceOf(HTMLElement);
        expect(dropdown.id).toBe('test-dropdown');
        expect(dropdown.querySelector('.dropdown-trigger')).toBeTruthy();
        expect(dropdown.querySelector('.dropdown-menu')).toBeTruthy();
        expect(dropdown.querySelectorAll('.dropdown-item').length).toBe(2);
    });

    test('should create actions dropdown', () => {
        const dropdown = DropdownManager.createActionsDropdown({
            id: 'table-actions',
            actions: [
                { text: 'View', icon: 'visibility', onClick: jest.fn() }
            ]
        });

        expect(dropdown).toBeTruthy();
        expect(dropdown.id).toBe('table-actions');
    });

    test('should create searchable dropdown', () => {
        const onSelect = jest.fn();
        const dropdown = DropdownManager.createSearchable({
            id: 'search-dropdown',
            placeholder: 'Search...',
            items: ['Apple', 'Banana', 'Orange'],
            onSelect
        });

        expect(dropdown).toBeTruthy();
        expect(dropdown.querySelector('input').placeholder).toBe('Search...');
    });

    test('should toggle visibility by ID', () => {
        const el = document.createElement('div');
        el.id = 'my-dropdown';
        el.classList.add('hidden');
        document.body.appendChild(el);

        DropdownManager.toggleById('my-dropdown');
        expect(el.classList.contains('hidden')).toBe(false);

        DropdownManager.toggleById('my-dropdown');
        expect(el.classList.contains('hidden')).toBe(true);
    });

    test('should show and hide by ID', () => {
        const el = document.createElement('div');
        el.id = 'legacy-dropdown';
        el.classList.add('hidden');
        document.body.appendChild(el);

        DropdownManager.showById('legacy-dropdown');
        expect(el.classList.contains('hidden')).toBe(false);

        DropdownManager.hideById('legacy-dropdown');
        expect(el.classList.contains('hidden')).toBe(true);
    });

    test('should show and hide by selector', () => {
        const el = document.createElement('div');
        el.className = 'suggestions-box';
        el.classList.add('hidden');
        document.body.appendChild(el);

        DropdownManager.showBySelector('.suggestions-box');
        expect(el.classList.contains('hidden')).toBe(false);

        DropdownManager.hideBySelector('.suggestions-box');
        expect(el.classList.contains('hidden')).toBe(true);
    });

    test('should toggle by selector', () => {
        const el = document.createElement('div');
        el.className = 'toggle-me';
        el.classList.add('hidden');
        document.body.appendChild(el);

        DropdownManager.toggleBySelector('.toggle-me');
        expect(el.classList.contains('hidden')).toBe(false);
    });

    test('should track open state', () => {
        expect(DropdownManager.isOpen()).toBe(false);
        expect(DropdownManager.getActive()).toBeNull();
    });

    test('should destroy a dropdown element', () => {
        const el = document.createElement('div');
        el.id = 'temp-dropdown';
        document.body.appendChild(el);

        expect(document.getElementById('temp-dropdown')).toBeTruthy();
        DropdownManager.destroy('temp-dropdown');
        expect(document.getElementById('temp-dropdown')).toBeNull();
    });

    test('should close all open dropdowns', () => {
        const d1 = document.createElement('div');
        d1.className = 'dropdown open';
        document.body.appendChild(d1);
        const d2 = document.createElement('div');
        d2.className = 'dropdown open';
        document.body.appendChild(d2);

        DropdownManager.closeAll();
        expect(document.querySelectorAll('.dropdown.open').length).toBe(0);
    });

    test('should toggle by ID using dropdown class', () => {
        const dropdown = document.createElement('div');
        dropdown.id = 'dd';
        dropdown.className = 'dropdown';
        document.body.appendChild(dropdown);

        DropdownManager.toggle('dd');
        expect(dropdown.classList.contains('open')).toBe(true);

        DropdownManager.toggle('dd');
        expect(dropdown.classList.contains('open')).toBe(false);
    });
});
