/**
 * Socket.io Module
 * Manejo centralizado de conexiones y eventos realtime
 * Soporta: check-in en vivo, edición colaborativa (C6-05), presencia (C6-07)
 */

const { Server } = require('socket.io');
const logger = require('../utils/logger');
// v12.44.850 (auditoría 2026-11-25, S6): autenticación opcional por conexión. Un token válido identifica el socket; uno
// inválido RECHAZA la conexión (no se acepta identificación falsa). Los sockets anónimos solo pueden
// entrar a salas de quiz (quiz:<id>): las salas de evento real (PII de check-in, presencia) exigen sesión.
const { verifyToken } = require('../security/jwt');
function socketIsAuthenticated(socket) {
    const token = (socket.handshake && socket.handshake.auth && socket.handshake.auth.token)
        || (socket.handshake && socket.handshake.headers && String(socket.handshake.headers.authorization || '').replace(/^Bearer /i, ''))
        || (socket.handshake && socket.handshake.query && socket.handshake.query.token);
    if (!token) return null;
    const decoded = verifyToken(token);
    return decoded ? decoded.userId : false; // false = token presentado pero inválido
}

let io = null;
const activeEditors = new Map(); // eventId -> [{ userId, userName, guestId, guestName, joinedAt }]

function init(server, opts = {}) {
    const cors = opts.cors || { origin: '*', methods: ['GET', 'POST'] };
    io = new Server(server, { cors });

    io.use((socket, next) => {
        const userId = socketIsAuthenticated(socket);
        if (userId === false) return next(new Error('Token inválido'));
        socket.userId = userId; // null para anónimos (jugadores de quiz)
        next();
    });

    io.on('connection', (socket) => {
        logger.info('[Socket.io] Cliente conectado: ' + socket.id + (socket.userId ? ' (autenticado)' : ' (anónimo)'));

        socket.on('join_event', (eventId, ack) => {
            // // v12.44.850 (auditoría 2026-11-25, S6): salas de evento real exigen sesión; las salas de quiz quedan abiertas a jugadores
            const isQuizRoom = typeof eventId === 'string' && eventId.indexOf('quiz:') === 0;
            if (!socket.userId && !isQuizRoom) {
                logger.warn('[Socket.io] join_event sin sesión rechazado: ' + socket.id + ' sala=' + String(eventId).slice(0, 12));
                if (typeof ack === 'function') ack({ error: 'Se requiere iniciar sesión' });
                return;
            }
            socket.join(String(eventId));
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            logger.debug('[Socket.io] ' + socket.id + ' joined event ' + eventId);
            io.to(eventId).emit('presence_update', { editors: activeEditors.get(eventId) || [] });
            if (typeof ack === 'function') ack({ ok: true }); // v12.44.852: confirmación al cliente
        });

        socket.on('leave_event', (eventId) => {
            socket.leave(eventId);
            removeEditor(socket, eventId);
        });

        socket.on('editing_guest', (data) => {
            if (!socket.userId) return; // // v12.44.850 (auditoría 2026-11-25, S6: presencia solo para sockets autenticados
            const { eventId, guestId, guestName, userName } = data;
            if (!eventId || !guestId) return;
            // La identidad viene del JWT del socket, no del cuerpo: un cliente no puede
            // hacerse pasar por otro editor.
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            const editors = activeEditors.get(eventId);
            const existing = editors.find(e => e.userId === socket.userId);
            if (existing) {
                existing.guestId = guestId;
                existing.guestName = guestName;
                existing.joinedAt = Date.now();
            } else {
                editors.push({ userId: socket.userId, userName: userName || 'Alguien', guestId, guestName, joinedAt: Date.now() });
            }
            socket.editingData = { eventId, userId: socket.userId };
            io.to(eventId).emit('presence_update', { editors });
        });

        socket.on('stop_editing', (data) => {
            const eventId = data && data.eventId;
            if (eventId) removeEditor(socket, eventId);
        });

        socket.on('collab_update', (data) => {
            if (!socket.userId) return; // v12.44.850 (S6): sin sesión no se pueden suplantar ediciones ajenas
            const { eventId, guestId, guestName, field, userName } = data;
            if (!eventId) return;
            socket.to(eventId).emit('guest_updated', {
                guestId, guestName, field,
                updatedBy: userName || 'Alguien',
                timestamp: new Date().toISOString()
            });
        });

        // Poll vote notification (C11-01)
        socket.on('poll_vote', (data) => {
            const { eventId, pollId, pollTitle } = data;
            if (!eventId || !pollId) return;
            socket.to(eventId).emit('poll_updated', { pollId, pollTitle, timestamp: new Date().toISOString() });
        });

        socket.on('presence_heartbeat', (data) => {
            if (!socket.userId) return; // // v12.44.850 (auditoría 2026-11-25, S6
            const { eventId, userName } = data;
            if (!eventId) return;
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            const editors = activeEditors.get(eventId);
            const existing = editors.find(e => e.userId === socket.userId);
            if (existing) {
                existing.joinedAt = Date.now();
            } else {
                editors.push({ userId: socket.userId, userName: userName || 'Alguien', guestId: null, guestName: null, joinedAt: Date.now() });
            }
            socket.editingData = { eventId, userId: socket.userId };
            io.to(eventId).emit('presence_update', { editors });
        });

        socket.on('disconnect', () => {
            logger.info('[Socket.io] Cliente desconectado: ' + socket.id);
            if (socket.editingData) {
                removeEditor(socket, socket.editingData.eventId);
            }
        });
    });

    logger.info('Socket.io inicializado con soporte colaborativo');
    return io;
}

function removeEditor(socket, eventId) {
    if (!activeEditors.has(eventId)) return;
    const editors = activeEditors.get(eventId);
    const userId = socket.editingData && socket.editingData.userId;
    if (userId) {
        const idx = editors.findIndex(e => e.userId === userId);
        if (idx !== -1) editors.splice(idx, 1);
    }
    if (editors.length === 0) activeEditors.delete(eventId);
    if (io) io.to(eventId).emit('presence_update', { editors });
}

// Purge stale editors every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [eventId, editors] of activeEditors.entries()) {
        const before = editors.length;
        const filtered = editors.filter(e => now - e.joinedAt < 300000);
        if (filtered.length !== before) {
            if (filtered.length === 0) activeEditors.delete(eventId);
            else activeEditors.set(eventId, filtered);
            if (io) io.to(eventId).emit('presence_update', { editors: filtered });
        }
    }
}, 300000).unref();

function getActiveEditors(eventId) {
    return activeEditors.get(eventId) || [];
}

function getIO() {
    return io;
}

function emit(event, data) {
    if (io) io.emit(event, data);
}

function emitToRoom(room, event, data) {
    if (io) io.to(room).emit(event, data);
}

module.exports = { init, getIO, emit, emitToRoom, getActiveEditors };
