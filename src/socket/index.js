/**
 * Socket.io Module
 * Manejo centralizado de conexiones y eventos realtime
 * Soporta: check-in en vivo, edición colaborativa (C6-05), presencia (C6-07)
 */

const { Server } = require('socket.io');

let io = null;
const activeEditors = new Map(); // eventId -> [{ userId, userName, guestId, guestName, joinedAt }]

function init(server, opts = {}) {
    const cors = opts.cors || { origin: '*', methods: ['GET', 'POST'] };
    io = new Server(server, { cors });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

        socket.on('join_event', (eventId) => {
            socket.join(eventId);
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            console.log(`[Socket.io] ${socket.id} joined event ${eventId}`);
            io.to(eventId).emit('presence_update', { editors: activeEditors.get(eventId) || [] });
        });

        socket.on('leave_event', (eventId) => {
            socket.leave(eventId);
            removeEditor(socket, eventId);
        });

        socket.on('editing_guest', (data) => {
            const { eventId, guestId, guestName, userName, userId } = data;
            if (!eventId || !guestId) return;
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            const editors = activeEditors.get(eventId);
            const existing = editors.find(e => e.userId === userId);
            if (existing) {
                existing.guestId = guestId;
                existing.guestName = guestName;
                existing.joinedAt = Date.now();
            } else {
                editors.push({ userId, userName: userName || 'Alguien', guestId, guestName, joinedAt: Date.now() });
            }
            socket.editingData = { eventId, userId };
            io.to(eventId).emit('presence_update', { editors });
        });

        socket.on('stop_editing', (data) => {
            const eventId = data && data.eventId;
            if (eventId) removeEditor(socket, eventId);
        });

        socket.on('collab_update', (data) => {
            const { eventId, guestId, guestName, field, userId, userName } = data;
            if (!eventId) return;
            socket.to(eventId).emit('guest_updated', {
                guestId, guestName, field,
                updatedBy: userName || userId || 'Alguien',
                timestamp: new Date().toISOString()
            });
        });

        socket.on('presence_heartbeat', (data) => {
            const { eventId, userId, userName } = data;
            if (!eventId || !userId) return;
            if (!activeEditors.has(eventId)) activeEditors.set(eventId, []);
            const editors = activeEditors.get(eventId);
            const existing = editors.find(e => e.userId === userId);
            if (existing) {
                existing.joinedAt = Date.now();
            } else {
                editors.push({ userId, userName: userName || 'Alguien', guestId: null, guestName: null, joinedAt: Date.now() });
            }
            socket.editingData = { eventId, userId };
            io.to(eventId).emit('presence_update', { editors });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
            if (socket.editingData) {
                removeEditor(socket, socket.editingData.eventId);
            }
        });
    });

    console.log('✓ Socket.io inicializado con soporte colaborativo');
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
