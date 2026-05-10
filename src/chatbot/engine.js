const { db } = require('../../database');
const https = require('https');

function getEventContext(eventId) {
    if (!eventId) return null;
    const event = db.prepare("SELECT id, name, date, end_date, location, description, status FROM events WHERE id = ?").get(eventId);
    if (!event) return null;
    const guestCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(eventId);
    const checkedCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(eventId);
    let sessions = [];
    try {
        const conn = require('../../database').getEventConnection(eventId);
        if (conn) sessions = conn.prepare("SELECT title, start_time, location FROM sessions WHERE event_id = ? ORDER BY start_time ASC LIMIT 10").all(eventId);
    } catch(e) {}
    return { event, guestCount: guestCount?.c || 0, checkedCount: checkedCount?.c || 0, sessions };
}

async function getAiResponse(message, eventId) {
    const apiKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_openrouter_key'").pluck().get() || '';
    const model = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_model'").pluck().get() || 'google/gemini-2.0-flash-lite-preview-02-05:free';

    let contextInfo = '';
    const ctx = getEventContext(eventId);
    if (ctx) {
        contextInfo = `Contexto del evento:\nNombre: ${ctx.event.name}\nFecha: ${ctx.event.date}\nUbicación: ${ctx.event.location || 'No especificada'}\nDescripción: ${ctx.event.description || 'No disponible'}\nInvitados totales: ${ctx.guestCount}\nCheck-ins: ${ctx.checkedCount}\n`;
        if (ctx.sessions.length > 0) {
            contextInfo += 'Actividades:\n' + ctx.sessions.map(s => `- ${s.start_time || ''} ${s.title}${s.location ? ' (' + s.location + ')' : ''}`).join('\n');
        }
    }

    const systemPrompt = `Eres un asistente virtual de Check Pro, una plataforma de gestión de eventos. Responde de forma amable y concisa en español.${contextInfo ? '\n\n' + contextInfo : ''}`;

    return new Promise((resolve) => {
        if (!apiKey) return resolve(null);
        const postData = JSON.stringify({
            model, max_tokens: 500,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ]
        });
        const req = https.request({
            hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
                'HTTP-Referer': 'https://check.app', 'X-Title': 'Check Pro'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.choices?.[0]?.message?.content || null);
                } catch(e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

function getRuleResponse(message, eventId) {
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
    return null;
}

async function getResponse(message, eventId) {
    const ruleResponse = getRuleResponse(message, eventId);
    if (ruleResponse) return ruleResponse;

    const aiResponse = await getAiResponse(message, eventId);
    if (aiResponse) return { text: aiResponse };

    return { text: 'No entendí tu consulta. Intenta preguntar sobre: fecha, ubicación, registro o actividades.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Cómo me registro?'] };
}

module.exports = { getResponse };
