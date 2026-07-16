/**
 * Chatbot Engine (v12.44.777)
 * Multi-turn context, conversation history, richer intents
 */
const { db } = require('../../database');
const https = require('https');

// In-memory conversation store (bounded, per-session)
const conversations = new Map();
const MAX_CONVERSATIONS = 1000;
const MAX_HISTORY = 10;
const CONVERSATION_TTL = 3600000; // 1 hour

function getConversation(sessionId) {
    if (!sessionId) return null;
    const conv = conversations.get(sessionId);
    if (!conv) return null;
    if (Date.now() - conv.lastActive > CONVERSATION_TTL) {
        conversations.delete(sessionId);
        return null;
    }
    conv.lastActive = Date.now();
    return conv;
}

function addToHistory(sessionId, role, content) {
    if (!sessionId) return;
    let conv = conversations.get(sessionId);
    if (!conv) {
        conv = { history: [], lastActive: Date.now(), eventId: null };
        conversations.set(sessionId, conv);
        // Cleanup old conversations
        if (conversations.size > MAX_CONVERSATIONS) {
            const oldest = [...conversations.entries()].sort((a, b) => a[1].lastActive - b[1].lastActive)[0];
            if (oldest) conversations.delete(oldest[0]);
        }
    }
    conv.history.push({ role, content, ts: Date.now() });
    if (conv.history.length > MAX_HISTORY) conv.history.shift();
}

function getEventContext(eventId) {
    if (!eventId) return null;
    const event = db.prepare("SELECT id, name, date, end_date, location, description, status, payment_required, currency FROM events WHERE id = ?").get(eventId);
    if (!event) return null;
    const guestCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(eventId);
    const checkedCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(eventId);
    const categoryCount = db.prepare("SELECT COUNT(*) as c FROM guest_categories WHERE event_id = ?").get(eventId);
    let sessions = [];
    try {
        const conn = require('../../database').getEventConnection(eventId);
        if (conn) sessions = conn.prepare("SELECT title, start_time, end_time, location, capacity FROM sessions WHERE event_id = ? ORDER BY start_time ASC LIMIT 10").all(eventId);
    } catch(e) {}
    return { event, guestCount: guestCount?.c || 0, checkedCount: checkedCount?.c || 0, sessions, categories: categoryCount?.c || 0 };
}

async function getAiResponse(message, eventId, history) {
    const apiKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_openrouter_key'").pluck().get() || '';
    const model = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_model'").pluck().get() || 'google/gemini-2.0-flash-lite-preview-02-05:free';

    let contextInfo = '';
    const ctx = getEventContext(eventId);
    if (ctx) {
        contextInfo = `Contexto del evento:\nNombre: ${ctx.event.name}\nFecha: ${ctx.event.date}\nUbicación: ${ctx.event.location || 'No especificada'}\nDescripción: ${ctx.event.description || 'No disponible'}\nInvitados totales: ${ctx.guestCount}\nCheck-ins: ${ctx.checkedCount}\nCategorías: ${ctx.categories}\n`;
        if (ctx.event.payment_required) contextInfo += `Pagos habilitados (${ctx.event.currency || 'USD'})\n`;
        if (ctx.sessions.length > 0) {
            contextInfo += 'Actividades:\n' + ctx.sessions.map(s => `- ${s.start_time || ''} ${s.title}${s.location ? ' (' + s.location + ')' : ''}`).join('\n');
        }
    }

    const systemPrompt = `Eres un asistente virtual de Check Pro, una plataforma de gestión de eventos profesional. Responde de forma amable, concisa y útil en español. Puedes ayudar con: fecha, ubicación, registro, actividades, precios, y preguntas generales del evento.${contextInfo ? '\n\n' + contextInfo : ''}\n\nResponde en máximo 3 párrafos cortos.`;

    return new Promise((resolve) => {
        if (!apiKey) return resolve(null);
        
        // Build messages with history for multi-turn
        const messages = [{ role: 'system', content: systemPrompt }];
        if (history && history.length > 0) {
            history.forEach(h => messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content }));
        }
        messages.push({ role: 'user', content: message });
        
        const postData = JSON.stringify({ model, max_tokens: 500, messages });
        const req = https.request({
            hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'HTTP-Referer': 'https://check.app', 'X-Title': 'Check Pro' }
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
        event = db.prepare("SELECT name, date, end_date, location, description, payment_required, currency FROM events WHERE id = ?").get(eventId);
    }

    // Greetings
    if (msg.match(/^(hola|buenos?|hey|hi|que tal|saludos)/)) {
        return { text: '¡Hola! 👋 Soy el asistente de Check Pro. ¿En qué puedo ayudarte? Puedo informarte sobre el evento, horarios, ubicación y más.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Qué actividades hay?'] };
    }
    if (msg.includes('gracias')) {
        return { text: '¡De nada! 😊 Si tienes más preguntas, aquí estoy.' };
    }
    
    // Date/Time
    if (msg.match(/(cuándo|cuando|horario|fecha|día|dia|hora)/)) {
        if (event && event.date) {
            const dateStr = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            let resp = 'El evento es el ' + dateStr;
            if (event.end_date && event.end_date !== event.date) {
                resp += ' hasta el ' + new Date(event.end_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
            }
            resp += '.';
            return { text: resp, quickReplies: ['¿Dónde es?', '¿Qué actividades hay?'] };
        }
        return { text: 'La fecha del evento está disponible en la página de registro.' };
    }
    
    // Location
    if (msg.match(/(dónde|donde|ubicación|lugar|dirección|mapa|cómo llego)/)) {
        if (event && event.location) return { text: '📍 El evento se realiza en: ' + event.location + '.', quickReplies: ['¿Cuándo es?', '¿Cómo me registro?'] };
        return { text: 'La ubicación del evento está disponible en la página de registro.' };
    }
    
    // Registration
    if (msg.match(/(registro|registrarme|inscribirme|boletos?|tickets?)/)) {
        let resp = 'Puedes registrarte en la página de registro del evento.';
        if (event && event.payment_required) resp += ' Los boletos son de pago (' + (event.currency || 'USD') + ').';
        return { text: resp, quickReplies: ['¿Cuánto cuesta?', '¿Qué actividades hay?'] };
    }
    
    // Pricing
    if (msg.match(/(costo|precio|pagar|cuánto|cuanto|gratis|pago)/)) {
        if (event && event.payment_required) return { text: '💰 Este evento tiene costo. Los precios están disponibles al momento de registrarte en la página de registro.' };
        if (event) return { text: '✅ Este evento es gratuito. ¡Solo registrate!' };
        return { text: 'Consulta los precios en la página de registro del evento.' };
    }
    
    // Sessions/Activities
    if (msg.match(/(actividades|agenda|sesiones|talleres|charlas|programa|horarios)/)) {
        var sessions = [];
        if (eventId) {
            try {
                var conn = require('../../database').getEventConnection(eventId);
                if (conn) sessions = conn.prepare("SELECT title, start_time, end_time, location FROM sessions WHERE event_id = ? ORDER BY start_time ASC LIMIT 10").all(eventId);
            } catch(e) {}
        }
        if (sessions.length > 0) {
            var text = '📋 Agenda del evento:\n\n';
            sessions.forEach(function(s) {
                text += '• ' + (s.start_time || '??:??') + (s.end_time ? '-' + s.end_time : '') + ' — ' + (s.title || 'Sin título') + (s.location ? ' 📍' + s.location : '') + '\n';
            });
            return { text: text, quickReplies: ['¿Dónde es?', '¿Cómo me registro?'] };
        }
        return { text: 'Consulta la agenda completa en el portal del asistente.' };
    }
    
    // Help
    if (msg.match(/(ayuda|qué puedes|que puedes|opciones|comandos)/)) {
        return { text: '🤖 Puedo ayudarte con:\n• 📅 Fecha y horarios\n• 📍 Ubicación\n• 📝 Registro\n• 📋 Agenda/actividades\n• 💰 Precios\n• ❓ Preguntas generales', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Qué actividades hay?'] };
    }
    
    // Contact/Speaker
    if (msg.match(/(ponente|speaker|expositor|organizador|contacto)/)) {
        return { text: 'Puedes ver la información de ponentes y organizadores en la sección de speakers del evento.' };
    }
    
    // Networking
    if (msg.match(/(networking|conectar|contactar|otros asistentes)/)) {
        return { text: '🤝 Puedes conectar con otros asistentes escaneando el QR de networking en el portal del asistente.' };
    }

    return null;
}

async function getResponse(message, eventId, sessionId) {
    const history = sessionId ? (getConversation(sessionId)?.history || []) : [];
    
    // Try rule-based first
    const ruleResponse = getRuleResponse(message, eventId);
    if (ruleResponse) {
        if (sessionId) {
            addToHistory(sessionId, 'user', message);
            addToHistory(sessionId, 'assistant', ruleResponse.text);
        }
        return ruleResponse;
    }

    // Try AI with context
    const aiResponse = await getAiResponse(message, eventId, history);
    if (aiResponse) {
        if (sessionId) {
            addToHistory(sessionId, 'user', message);
            addToHistory(sessionId, 'assistant', aiResponse);
        }
        return { text: aiResponse };
    }

    // Fallback
    return { text: 'No entendí tu consulta. Intenta preguntar sobre: fecha, ubicación, registro o actividades.', quickReplies: ['¿Cuándo es?', '¿Dónde es?', '¿Cómo me registro?'] };
}

module.exports = { getResponse, getConversation };
