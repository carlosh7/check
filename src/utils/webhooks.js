/**
 * Webhook utilities para integraciones externas (Slack, Discord, etc)
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { db } = require('../../database');

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
    PRE_REGISTRATION_CONFIRMED: 'pre_registration.confirmed'
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
    let where = [];
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
    
    // Add signature if secret exists
    const signature = signPayload(JSON.stringify(payload), webhook.secret);
    if (signature) {
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
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
    sendWebhook
};