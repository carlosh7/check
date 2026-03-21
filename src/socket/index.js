/**
 * Socket.io Module
 * Manejo centralizado de conexiones y eventos realtime
 */

const { Server } = require('socket.io');

let io = null;

function init(server, opts = {}) {
    const cors = opts.cors || { origin: '*', methods: ['GET', 'POST'] };
    io = new Server(server, { cors });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

        socket.on('join_event', (eventId) => {
            socket.join(eventId);
            console.log(`[Socket.io] ${socket.id} joined event ${eventId}`);
        });

        socket.on('leave_event', (eventId) => {
            socket.leave(eventId);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
        });
    });

    console.log('✓ Socket.io inicializado');
    return io;
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

module.exports = { init, getIO, emit, emitToRoom };
