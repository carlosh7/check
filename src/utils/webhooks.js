/**
 * Webhook utilities para integraciones externas (Slack, Discord, etc)
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { db } = require('../../database');
// v12.44.846 (auditoría 2026-11-25, S7): portero único de destinos salientes (prevención de SSRF).
// Toda petición hacia una URL que venga del usuario pasa por aquí antes de salir.
const { checkUrlAllowed } = require('../security/network-policy');

// Event types supported
const WEBHOOK_EVENTS = {
    GUEST_CREATED: 'guest.created',
    GUEST_UPDATED: 'guest.updated',
    GUEST_CHECKED_IN: 'guest.checked_in',
    GUEST_UNCHECKED_IN: 'guest.unchecked_in',
    GUEST_UNSUBSCRIBED: 'guest.unsubscribed',
    EVENT_CREATED: 'event.created',
    EVENT_UPDATED: 'event.updated',
    EVENT_DELETED: 'event.deleted',
    EMAIL_SENT: 'email.sent',
    EMAIL_FAILED: 'email.failed',
    SURVEY_SUBMITTED: 'survey.submitted',
    PRE_REGISTRATION_CREATED: 'pre_registration.created',

    PRE_REGISTRATION_CONFIRMED: 'pre_registration.confirmed',

    PAYMENT_COMPLETED: 'payment.completed',

    PAYMENT_FAILED: 'payment.failed'

};

/**
 * Create a new webhook
 */
function createWebhook(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const events = Array.isArray(data.events) ? JSON.stringify(data.events) : '[]';
    const headers = data.headers ? JSON.stringify(data.headers) : null;
    
    const stmt = db.prepare(`
        INSERT INTO webhooks (id, event_id, name, url, secret, events, headers, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        id,
        data.event_id || null,
        data.name,
        data.url,
        data.secret || null,
        events,
        headers,
        data.status || 'ACTIVE',
        now,
        now
    );
    
    return getWebhook(id);
}

/**
 * Update an existing webhook
 */
function updateWebhook(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = [];
    
    if (data.event_id !== undefined) {
        updates.push('event_id = ?');
        params.push(data.event_id || null);
    }
    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.url !== undefined) {
        updates.push('url = ?');
        params.push(data.url);
    }
    if (data.secret !== undefined) {
        updates.push('secret = ?');
        params.push(data.secret || null);
    }
    if (data.events !== undefined) {
        updates.push('events = ?');
        params.push(JSON.stringify(Array.isArray(data.events) ? data.events : []));
    }
    if (data.headers !== undefined) {
        updates.push('headers = ?');
        params.push(data.headers ? JSON.stringify(data.headers) : null);
    }
    if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    
    params.push(id);
    
    const stmt = db.prepare(`
        UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...params);
    
    return getWebhook(id);
}

/**
 * Get a webhook by ID
 */
function getWebhook(id) {
    const stmt = db.prepare('SELECT * FROM webhooks WHERE id = ?');
    const webhook = stmt.get(id);
    if (!webhook) return null;
    
    return {
        ...webhook,
        events: JSON.parse(webhook.events || '[]'),
        headers: webhook.headers ? JSON.parse(webhook.headers) : null
    };
}

/**
 * List webhooks (optionally filtered by event_id and status)
 */
function listWebhooks(filters = {}) {
    const where = [];
    const params = [];
    
    if (filters.event_id !== undefined) {
        where.push('event_id = ?');
        params.push(filters.event_id);
    }
    if (filters.status !== undefined) {
        where.push('status = ?');
        params.push(filters.status);
    }
    
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const stmt = db.prepare(`SELECT * FROM webhooks ${whereClause} ORDER BY created_at DESC`);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
        ...row,
        events: JSON.parse(row.events || '[]'),
        headers: row.headers ? JSON.parse(row.headers) : null
    }));
}

/**
 * Delete a webhook
 */
function deleteWebhook(id) {
    const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
    return stmt.run(id);
}

/**
 * Generate a secret for webhook signing
 */
function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Sign payload with secret using HMAC-SHA256
 */
function signPayload(payload, secret) {
    if (!secret) return null;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return hmac.digest('hex');
}

/**
 * Trigger webhooks for a specific event
 */
async function triggerWebhooks(eventType, data, eventId = null) {
    // Find active webhooks that subscribe to this event
    const webhooks = listWebhooks({ status: 'ACTIVE' });
    const matchingWebhooks = webhooks.filter(wh => 
        wh.events.includes(eventType) && 
        (wh.event_id === null || wh.event_id === eventId)
    );
    
    if (matchingWebhooks.length === 0) {
        return [];
    }
    
    const results = [];
    
    for (const webhook of matchingWebhooks) {
        try {
            await sendWebhook(webhook, eventType, data);
            results.push({ webhookId: webhook.id, success: true });
        } catch (error) {
            results.push({ webhookId: webhook.id, success: false, error: error.message });
            console.error(`Webhook ${webhook.id} failed:`, error.message);
        }
    }
    
    return results;
}

// ─── Guards de envío (v12.44.846, auditoría 2026-11-25, S7) ───

/**
 * Cabeceras que un webhook personalizado NUNCA puede llevar. Host, Content-Length
 * y Connection las fijaba el usuario tal cual (permitían colar una petición hacia
 * un host interno disfrazada de legítima, o romper el enmarcado de la petición);
 * el resto son cabeceras "salto a salto" (RFC 7230 §6.1) que no tienen sentido
 * en un webhook y solo sirven para lo mismo.
 */
const BLOCKED_WEBHOOK_HEADERS = [
    'host', 'content-length', 'connection',
    'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'
];

/** Tope por defecto (en BYTES) de la respuesta que se guarda en webhook_logs. */
const DEFAULT_RESPONSE_LOG_MAX_BYTES = 2000;

/** Tope de tiempo para leer el cuerpo de la respuesta. Si se agota, se registra lo leído. */
const WEBHOOK_BODY_READ_TIMEOUT_MS = 10000;

/** Tiempo tope para el envío "enriquecido" a Slack, que antes no tenía ninguno. */
const SLACK_SEND_TIMEOUT_MS = 10000;

function isBlockedWebhookHeader(name) {
    return BLOCKED_WEBHOOK_HEADERS.includes(String(name).trim().toLowerCase());
}

/**
 * Devuelve la primera cabecera prohibida de un objeto de cabeceras, o null si no hay ninguna.
 * Se usa en crear/editar para rechazarlas con un mensaje claro.
 * @param {Object} headers
 * @returns {string|null}
 */
function findBlockedWebhookHeader(headers) {
    if (!headers || typeof headers !== 'object') return null;
    for (const name of Object.keys(headers)) {
        if (isBlockedWebhookHeader(name)) return name;
    }
    return null;
}

/**
 * Quita del objeto de cabeceras (que ya se va a enviar) las prohibidas, comparando
 * sin distinguir mayúsculas. Defensa en profundidad para webhooks ya guardados.
 * @param {Object} headers
 */
function stripBlockedWebhookHeaders(headers) {
    for (const name of Object.keys(headers)) {
        if (isBlockedWebhookHeader(name)) delete headers[name];
    }
    return headers;
}

/**
 * Tope de bytes de la respuesta guardada. Variable de entorno
 * WEBHOOK_RESPONSE_LOG_MAX_BYTES (entero > 0); por defecto 2000.
 * @returns {number}
 */
function getResponseLogMaxBytes() {
    const parsed = parseInt(process.env.WEBHOOK_RESPONSE_LOG_MAX_BYTES, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RESPONSE_LOG_MAX_BYTES;
}

/**
 * Recorta un texto a `maxBytes` BYTES reales (no caracteres: una ñ ocupa 2).
 * Al recortar se añade un marcador dentro del propio tope.
 * @param {*} value
 * @param {number} maxBytes
 * @returns {string|*}
 */
function truncateBytes(value, maxBytes) {
    if (value === null || value === undefined) return value;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const buf = Buffer.from(String(text), 'utf8');
    if (buf.length <= maxBytes) return text;
    const marker = '…[respuesta recortada]';
    const markerLen = Buffer.byteLength(marker, 'utf8');
    if (maxBytes <= markerLen) return buf.subarray(0, maxBytes).toString('utf8');
    let cut = maxBytes - markerLen;
    // No partir un carácter de varios bytes por la mitad: se retrocede hasta donde empieza uno
    while (cut > 0 && (buf[cut] & 0xc0) === 0x80) cut--;
    return buf.subarray(0, cut).toString('utf8') + marker;
}

/**
 * Lee solo el principio del cuerpo de la respuesta, hasta `maxBytes` y con un
 * tope de tiempo. Si la respuesta continuaba, lleva el marcador de recorte.
 * Nunca rechaza: si el cuerpo se rompe, se corta o se eterniza, devuelve lo leído
 * hasta ese momento (igual que hacía el `.catch(() => '')`).
 * Antes se leía el cuerpo ENTERO en memoria y sin tope de tiempo: un destino que
 * mandara cabeceras y luego callara dejaba el envío colgado para siempre.
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<string>}
 */
async function readResponseBodyPrefix(response, maxBytes) {
    if (!response || !response.body || typeof response.body.getReader !== 'function') return '';
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    let finished = false;
    let timer;
    const expired = new Promise((resolve) => { timer = setTimeout(() => resolve('expired'), WEBHOOK_BODY_READ_TIMEOUT_MS); });
    try {
        // Se lee hasta pasar el tope o llegar al final. Si se llega JUSTO al tope se lee un
        // trozo más, solo para saber si la respuesta continúa y poder marcar el recorte.
        while (!finished && received <= maxBytes) {
            const step = await Promise.race([reader.read(), expired]);
            if (step === 'expired') break;
            if (step.done) { finished = true; break; }
            chunks.push(Buffer.from(step.value));
            received += step.value.length;
        }
    } catch (_) {
        // cuerpo roto o conexión cortada: se conserva lo leído
    } finally {
        clearTimeout(timer);
        try { reader.cancel().catch(() => {}); } catch (_) {}
    }
    return truncateBytes(Buffer.concat(chunks).toString('utf8'), maxBytes);
}

/**
 * Revalida el destino de un webhook justo antes de cada fetch. Si dejó de ser
 * público (o nunca lo fue) NO se dispara, la entrega queda registrada en el log
 * como fallida por destino bloqueado y lanza un error con code SSRF_BLOCKED.
 * Cubre también los webhooks guardados antes de esta versión.
 * @param {Object} webhook
 * @param {string} eventType
 * @param {string} requestBody
 */
async function assertWebhookDestinationAllowed(webhook, eventType, requestBody) {
    const destination = await checkUrlAllowed(webhook.url);
    if (destination.allowed) return destination;

    const reason = `Destino bloqueado por la política de red (SSRF): ${destination.reason}`;
    const url = typeof webhook.url === 'string' ? webhook.url : '';
    logWebhookDelivery(webhook.id, eventType, url, requestBody, 0, reason, 0, false);
    // La dirección interna solo va al log del servidor, nunca al mensaje del usuario
    logger.warn(`[WEBHOOKS] Entrega a ${webhook.id} (${eventType}) NO enviada: ${destination.reason}` + (destination.ip ? ` [${destination.ip}]` : ''));
    const blocked = new Error(reason);
    blocked.code = 'SSRF_BLOCKED';
    throw blocked;
}

/**
 * Send a single webhook request
 */
async function sendWebhook(webhook, eventType, data) {
    const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: data
    };
    
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckPro-Webhooks/12.2.2',
        'X-Webhook-Event': eventType,
        'X-Webhook-ID': webhook.id
    };
    
    // Add custom headers
    if (webhook.headers && typeof webhook.headers === 'object') {
        Object.assign(headers, webhook.headers);
    }
    // v12.44.846 (auditoría 2026-11-25, S7): fuera Host / Content-Length / Connection y el resto
    // de cabeceras de salto a salto, vengan del webhook que vengan (también de los ya guardados)
    stripBlockedWebhookHeaders(headers);
    
    // Add signature if secret exists
    const signature = signPayload(JSON.stringify(payload), webhook.secret);
    if (signature) {
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
    
    // v12.44.846 (auditoría 2026-11-25, S7): el destino se revalida JUSTO ANTES de cada fetch.
    // Antes se aceptaba cualquier URL, incluida una interna (SSRF). Si dejó de ser público
    // no se dispara y la entrega queda en el log como fallida por destino bloqueado.
    await assertWebhookDestinationAllowed(webhook, eventType, JSON.stringify(payload));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const startTime = Date.now();
    
    try {
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
            // v12.44.846 (auditoría 2026-11-25, S7): no seguir redirecciones. Antes, un destino público
            // que respondiera "302 -> dirección interna" se seguía sin volver a validar.
            redirect: 'error'
        });
        
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        // v12.44.846 (auditoría 2026-11-25, S7): antes response.text() leía el cuerpo ENTERO y sin tope de tiempo
        const respBody = await readResponseBodyPrefix(response, getResponseLogMaxBytes()).catch(() => '');
        logWebhookDelivery(webhook.id, eventType, webhook.url, JSON.stringify(payload), response.status, respBody, duration, response.ok);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        logWebhookDelivery(webhook.id, eventType, webhook.url, JSON.stringify(payload), 0, error.message, duration, false);
        throw error;
    }
}

/**
 * Log a webhook delivery attempt
 */
function logWebhookDelivery(webhookId, eventType, url, requestBody, responseStatus, responseBody, durationMs, success) {
    try {
        const id = uuidv4();
        const now = new Date().toISOString();
        // v12.44.846 (auditoría 2026-11-25, S7): la respuesta ya NO se guarda íntegra. Tope en bytes
        // WEBHOOK_RESPONSE_LOG_MAX_BYTES (por defecto 2000). Vale para la respuesta y para el
        // mensaje de error, que también se guarda aquí.
        const clippedBody = truncateBytes(responseBody, getResponseLogMaxBytes());
        const stmt = db.prepare(`
            INSERT INTO webhook_logs (id, webhook_id, event_type, request_url, request_body, response_status, response_body, duration_ms, success, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, webhookId, eventType, url, typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody), responseStatus, clippedBody, durationMs, success ? 1 : 0, now);
        return id;
    } catch (e) {
        console.error('[WEBHOOKS] Error logging delivery:', e.message);
        return null;
    }
}

/**
 * Get webhook delivery logs
 */
function getWebhookLogs(webhookId, limit = 50) {
    try {
        const stmt = db.prepare("SELECT * FROM webhook_logs WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?");
        return stmt.all(webhookId, limit);
    } catch (e) {
        console.error('[WEBHOOKS] Error fetching logs:', e.message);
        return [];
    }
}

/**
 * Send enriched Slack message (C5-09)
 */
async function sendSlackMessage(webhook, payload) {
    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: payload.title || 'Check Pro' } },
        { type: 'section', text: { type: 'mrkdwn', text: payload.message || '' } }
    ];
    if (payload.fields) {
        blocks.push({ type: 'section', fields: payload.fields.map(function(f) { return { type: 'mrkdwn', text: '*' + f.label + '*\n' + f.value }; }) });
    }
    if (payload.color) {
        blocks.unshift({ type: 'divider' });
        blocks.unshift({ type: 'context', elements: [{ type: 'mrkdwn', text: '🟢 ' + payload.color }] });
    }
    blocks.push({ type: 'divider' }, { type: 'context', elements: [{ type: 'mrkdwn', text: 'Check Pro · ' + new Date().toLocaleString() }] });

    // v12.44.846 (auditoría 2026-11-25, S7): mismo portero que sendWebhook: este fetch también
    // iba a webhook.url sin validar el destino.
    await assertWebhookDestinationAllowed(webhook, 'slack.message', JSON.stringify({ title: payload.title }));

    await fetch(webhook.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload.title, blocks: blocks, username: 'Check Pro', icon_emoji: ':checkered_flag:' }),
        redirect: 'error', // v12.44.846 (auditoría 2026-11-25, S7): sin seguir redirecciones
        signal: AbortSignal.timeout(SLACK_SEND_TIMEOUT_MS) // v12.44.846 (auditoría 2026-11-25, S7): antes sin tope de tiempo
    });
}

// ─── Backup (C5-11) ───

async function createBackup() {
    const backupDir = process.env.BACKUP_DIR || './backups';
    const fs = require('fs'), path = require('path');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(backupDir, 'checkpro_backup_' + dateStr + '.db');

    try {
        const srcDb = db.name || (process.env.DATA_PATH ? path.join(process.env.DATA_PATH, 'system', 'database.db') : path.join(__dirname, '../../data/system/database.db'));
        if (fs.existsSync(srcDb)) {
            fs.copyFileSync(srcDb, backupFile);
            // Keep only last 7 backups
            const files = fs.readdirSync(backupDir).filter(function(f) { return f.startsWith('checkpro_backup_'); }).sort();
            while (files.length > 7) { const old = files.shift(); fs.unlinkSync(path.join(backupDir, old)); }
            return { success: true, file: backupFile, size: fs.statSync(backupFile).size };
        }
        return { success: false, error: 'Database file not found' };
    } catch(e) { return { success: false, error: e.message }; }
}

// ─── Performance Logger (C5-12) ───

function logPerformance(operation, durationMs, details) {
    try {
        const stmt = db.prepare("INSERT INTO performance_logs (id, operation, duration_ms, details, created_at) VALUES (?, ?, ?, ?, ?)");
        stmt.run(require('uuid').v4(), operation, durationMs, JSON.stringify(details || {}), new Date().toISOString());
    } catch(e) {}
}

module.exports = {
    WEBHOOK_EVENTS,
    createWebhook,
    updateWebhook,
    getWebhook,
    listWebhooks,
    deleteWebhook,
    generateSecret,
    signPayload,
    triggerWebhooks,
    sendWebhook,
    logWebhookDelivery,
    getWebhookLogs,
    sendSlackMessage,
    createBackup,
    logPerformance,
    // v12.44.846 (auditoría 2026-11-25, S7): para que las rutas rechacen en crear/editar las mismas cabeceras
    findBlockedWebhookHeader
};