/**
 * @jest-environment jsdom
 */
import { SessionManager } from '../public/js/modules/auth/SessionManager.js';

describe('SessionManager', () => {
    let storage, apiMock, mgr;
    beforeEach(() => {
        storage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
        apiMock = { login: jest.fn(), logout: jest.fn() };
        mgr = new SessionManager({ api: apiMock, storage });
        global.fetch = jest.fn();
    });
    afterEach(() => jest.restoreAllMocks());
    test('restore parsea user', () => {
        storage.getItem.mockReturnValue(JSON.stringify({ token: 't', userId: '1' }));
        const m = new SessionManager({ api: apiMock, storage });
        expect(m.user.token).toBe('t');
    });
    test('isAuthenticated false sin user', () => {
        expect(mgr.isAuthenticated()).toBe(false);
    });
    test('login lanza requires2FA', async () => {
        apiMock.login.mockResolvedValue({ requires2FA: true, message: 'Código 2FA requerido' });
        await expect(mgr.login('a', 'b')).rejects.toMatchObject({ requires2FA: true });
    });
    test('requestRecoveryCode valida email', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: () => ({ success: true }) });
        await expect(mgr.requestRecoveryCode('a@b.com')).resolves.toBeDefined();
    });
    test('resetPassword valida longitud', async () => {
        await expect(mgr.resetPassword('123', 'short')).rejects.toThrow('6 dígitos');
        await expect(mgr.resetPassword('123456', 'short')).rejects.toThrow('8 caracteres');
    });
});
