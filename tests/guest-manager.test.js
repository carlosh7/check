/**
 * @jest-environment jsdom
 */
import { GuestManager } from '../public/js/modules/views/GuestManager.js';

describe('GuestManager', () => {
    let apiMock, mgr;
    beforeEach(() => {
        apiMock = { client: { fetchAPI: jest.fn().mockResolvedValue({ success: true }) }, checkInGuest: jest.fn() };
        mgr = new GuestManager({ api: apiMock });
    });
    test('changeStatus valida estado', async () => {
        await expect(mgr.changeStatus('e1', 'g1', 'invalido')).rejects.toThrow('Estado inválido');
        await mgr.changeStatus('e1', 'g1', 'confirmed');
        expect(apiMock.client.fetchAPI).toHaveBeenCalled();
    });
    test('filterGuests por status y search', () => {
        const guests = [{ name: 'Ana', status: 'confirmed' }, { name: 'Luis', status: 'lead' }];
        expect(mgr.filterGuests(guests, { status: 'confirmed' })).toHaveLength(1);
        expect(mgr.filterGuests(guests, { search: 'luis' })[0].name).toBe('Luis');
    });
    test('availability calcula cupos', () => {
        const cats = [{ id: 'c1', name: 'VIP', capacity: 10 }];
        const guests = [{ category_id: 'c1', status: 'confirmed' }, { category_id: 'c1', status: 'waitlisted' }];
        const avail = mgr.availability(cats, guests);
        expect(avail[0].used).toBe(1);
        expect(avail[0].remaining).toBe(9);
        expect(avail[0].waitlist).toBe(1);
    });
});
