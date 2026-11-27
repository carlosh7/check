/**
 * Prueba de integración de Socket.io (v12.44.852 — auditoría 2026-11-25, S6).
 *
 * Levanta un servidor HTTP efímero con el motor real de socket (src/socket) y comprueba la puerta
 * de autenticación con un cliente real (socket.io-client):
 *   - anónimo + sala de evento real → RECHAZADO (ack con error, no queda en la sala)
 *   - anónimo + sala de quiz (quiz:<id>) → PERMITIDO (los jugadores no inician sesión)
 *   - token inválido → la CONEXIÓN se rechaza
 *   - JWT válido + sala de evento → PERMITIDO
 *   - editing_guest sin sesión → ignorado (no genera presencia)
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test-socket-0123456789';
process.env.RATE_LIMIT_EXEMPT_CIDRS = process.env.RATE_LIMIT_EXEMPT_CIDRS || '127.0.0.1/32,::1/128';

const http = require('http');
const { io: Client } = require('socket.io-client');
const { generateToken } = require('../src/security/jwt');

describe('Socket.io — puerta de autenticación (v12.44.852)', () => {
    let server, port, socketMod;

    beforeAll(function(done) {
        server = http.createServer(function() {});
        socketMod = require('../src/socket');
        socketMod.init(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
        server.listen(0, function() {
            port = server.address().port;
            done();
        });
    });

    afterAll(function(done) {
        try { socketMod.getIO().close(); } catch (e) {}
        try { server.close(); } catch (e) {}
        setTimeout(done, 200);
    });

    const connect = function(opts) {
        return Client('http://127.0.0.1:' + port, Object.assign({ transports: ['websocket'], timeout: 3000, reconnection: false }, opts || {}));
    };

    test('anónimo NO entra a una sala de evento real (ack con error)', function(done) {
        const s = connect();
        s.on('connect', function() {
            s.emit('join_event', 'evento-real-123', function(resp) {
                expect(resp).toBeTruthy();
                expect(resp.error).toMatch(/iniciar sesión/i);
                s.disconnect();
                done();
            });
        });
        s.on('connect_error', function(e) { throw new Error('la conexión anónima no debía rechazarse: ' + e.message); });
    });

    test('anónimo SÍ entra a una sala de quiz (jugadores sin sesión)', function(done) {
        const s = connect();
        s.on('connect', function() {
            s.on('presence_update', function(msg) {
                // el motor emite presence_update al unirse: prueba de que quedó en la sala
                expect(Array.isArray(msg.editors)).toBe(true);
                if (settledQ) return; settledQ = true; s.disconnect(); done();
            });
            s.emit('join_event', 'quiz:session-456');
        });
        s.on('connect_error', function(e) { throw new Error('la sala de quiz debía aceptar anónimos: ' + e.message); });
        let settledQ = false;
        setTimeout(function() { if (settledQ) return; settledQ = true; try { s.disconnect(); } catch (e) {} done(new Error('timeout esperando presence_update')); }, 4000);
    });

    test('token inválido → la conexión se rechaza', function(done) {
        const s = connect({ auth: { token: 'esto-no-es-un-jwt' } });
        s.on('connect', function(e) { throw new Error('un token inválido no debía conectar'); });
        s.on('connect_error', function(e) {
            expect(String(e.message)).toMatch(/Token inválido|jwt|token/i);
            s.disconnect();
            done();
        });
    });

    test('JWT válido SÍ entra a la sala de evento', function(done) {
        const token = generateToken({ userId: 'user-test-1', username: 'qa', role: 'PRODUCTOR' });
        const s = connect({ auth: { token: token } });
        s.on('connect', function() {
            s.emit('join_event', 'evento-real-123', function(resp) {
                expect(resp === undefined || resp === null || !resp.error).toBe(true);
                if (settledJ) return; settledJ = true; s.disconnect(); done();
            });
        });
        s.on('connect_error', function(e) { throw new Error('JWT válido rechazado: ' + e.message); });
        let settledJ = false;
        setTimeout(function() { if (settledJ) return; settledJ = true; try { s.disconnect(); } catch (e) {} done(new Error('timeout esperando ack')); }, 4000);
    });

    test('editing_guest anónimo se ignora (sin suplantación de presencia)', function(done) {
        const s = connect();
        let sawForeignEditor = false;
        const target = connect({ auth: { token: generateToken({ userId: 'user-test-2', username: 'qa2', role: 'ADMIN' }) } });
        target.on('connect', function() {
            target.emit('join_event', 'evento-presencia-789');
            target.on('presence_update', function(msg) {
                for (const e of (msg.editors || [])) { if (e.userId && e.userId !== 'user-test-2') sawForeignEditor = true; }
            });
            // el anónimo intenta colarse como editor
            setTimeout(function() {
                s.emit('editing_guest', { eventId: 'evento-presencia-789', guestId: 'g1', guestName: 'Intruso', userName: 'Intruso', userId: 'intruso' });
            }, 150);
            setTimeout(function() {
                expect(sawForeignEditor).toBe(false);
                s.disconnect(); target.disconnect();
                done();
            }, 900);
        });
        target.on('connect_error', function(e) { throw new Error('JWT válido rechazado: ' + e.message); });
    });
});
