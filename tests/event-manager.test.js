/**
 * @jest-environment jsdom
 */
import { EventManager } from '../public/js/modules/views/EventManager.js';

describe('EventManager', () => {
    let apiMock, toastMock, mgr;
    beforeEach(() => {
        apiMock = { getEvents: jest.fn().mockResolvedValue([{ id: '1', name: 'A' }]), createEvent: jest.fn().mockResolvedValue({ success: true }), updateEvent: jest.fn().mockResolvedValue({ success: true }), deleteEvent: jest.fn() };
        toastMock = { show: jest.fn() };
        mgr = new EventManager({ api: apiMock, toast: toastMock });
    });
    test('loadEvents usa cache', async () => {
        await mgr.loadEvents();
        await mgr.loadEvents();
        expect(apiMock.getEvents).toHaveBeenCalledTimes(1);
    });
    test('filterEvents por query', () => {
        const evs = [{ name: 'Fiesta', location: 'Bogotá' }, { name: 'Boda', location: 'Medellín' }];
        expect(mgr.filterEvents(evs, 'fiesta')).toHaveLength(1);
        expect(mgr.filterEvents(evs, '')).toHaveLength(2);
    });
    test('sortEvents asc/desc', () => {
        const evs = [{ name: 'B' }, { name: 'A' }];
        expect(mgr.sortEvents(evs, 'name', 'asc')[0].name).toBe('A');
        expect(mgr.sortEvents(evs, 'name', 'desc')[0].name).toBe('B');
    });
    test('deleteEvent invalida cache', async () => {
        mgr.cache = [{ id: '1' }];
        await mgr.deleteEvent('1');
        expect(mgr.cache).toBeNull();
    });
});
