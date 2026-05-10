/**
 * Simple chatbot engine for guest support (C4-08)
 * Responds to common guest inquiries about the event.
 */

const { db } = require('../../database');

function getResponse(message, eventId) {
    var msg = (message || '').toLowerCase().trim();
    var event = null;
    if (eventId) {
        event = db.prepare("SELECT name, date, location, description FROM events WHERE id = ?").get(eventId);
    }

    if (msg.includes('hola') || msg.includes('buenos') || msg.includes('hey')) {
        return { text: '¡Hola! 👋 ¿En qué puedo ayudarte? Puedo informarte sobre el evento, horarios, ubicación y más.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Qué actividades hay?'] };
    }
    if (msg.includes('gracias')) {
        return { text: '¡De nada! 😊 Si tienes más preguntas, aquí estoy.' };
    }
    if (msg.includes('cuándo') || msg.includes('horario') || msg.includes('fecha') || msg.includes('día')) {
        if (event && event.date) return { text: 'El evento es el ' + new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '.' };
        return { text: 'La fecha del evento está disponible en la página de registro.' };
    }
    if (msg.includes('dónde') || msg.includes('ubicación') || msg.includes('lugar') || msg.includes('dirección')) {
        if (event && event.location) return { text: 'El evento se realiza en: ' + event.location + '.' };
        return { text: 'La ubicación del evento está disponible en la página de registro.' };
    }
    if (msg.includes('registro') || msg.includes('registrarme') || msg.includes('inscribirme')) {
        return { text: 'Puedes registrarte en la página de registro del evento. El enlace está en tu invitación.' };
    }
    if (msg.includes('costo') || msg.includes('precio') || msg.includes('pagar') || msg.includes('boleto')) {
        return { text: 'Los precios y categorías están disponibles en la página de registro al seleccionar tu boleto.' };
    }
    if (msg.includes('ayuda') || msg.includes('qué puedes')) {
        return { text: 'Puedo ayudarte con: fecha del evento, ubicación, registro, horarios. Solo pregúntame.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Cómo me registro?'] };
    }
    if (msg.includes('actividades') || msg.includes('agenda') || msg.includes('sesiones') || msg.includes('talleres')) {
        var sessions = [];
        if (eventId) {
            try {
                var conn = require('../../database').getEventConnection(eventId);
                if (conn) sessions = conn.prepare("SELECT title, start_time, location FROM sessions WHERE event_id = ? ORDER BY start_time ASC LIMIT 5").all(eventId);
            } catch(e) {}
        }
        if (sessions.length > 0) {
            var text = '📋 Estas son las actividades:\n';
            sessions.forEach(function(s) { text += '• ' + (s.start_time || '') + ' - ' + (s.title || '') + (s.location ? ' (' + s.location + ')' : '') + '\n'; });
            return { text: text };
        }
        return { text: 'Consulta la agenda del evento en el portal del asistente.' };
    }
    return { text: 'No entendí tu consulta. Intenta preguntar sobre: fecha, ubicación, registro o actividades.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Cómo me registro?'] };
}

module.exports = { getResponse };
