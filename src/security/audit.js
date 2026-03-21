/**
 * Audit Logger
 * Logs estructurados de acciones de usuarios
 */

const { db } = require('../../database');
const { v4: uuidv4 } = require('uuid');

const AuditLog = {
    log(action, userId, details = {}) {
        try {
            db.prepare(`INSERT INTO audit_logs (id, user_id, action, details, ip_address, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?)`).run(
                uuidv4(),
                userId || null,
                action,
                JSON.stringify(details),
                details.ip || null,
                new Date().toISOString()
            );
        } catch (e) {
            console.error('[Audit] Failed to log:', e.message);
        }
    },

    getByUser(userId, limit = 50) {
        return db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
            .all(userId, limit);
    },

    getByAction(action, limit = 50) {
        return db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT ?')
            .all(action, limit);
    },

    getRecent(limit = 100) {
        return db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    }
};

const AUDIT_ACTIONS = {
    LOGIN: 'LOGIN',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_DELETED: 'USER_DELETED',
    USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
    EVENT_CREATED: 'EVENT_CREATED',
    EVENT_UPDATED: 'EVENT_UPDATED',
    EVENT_DELETED: 'EVENT_DELETED',
    GUEST_IMPORTED: 'GUEST_IMPORTED',
    GUEST_CHECKIN: 'GUEST_CHECKIN',
    GUEST_UNCHECKIN: 'GUEST_UNCHECKIN',
    EMAIL_SENT: 'EMAIL_SENT',
    EMAIL_BROADCAST: 'EMAIL_BROADCAST',
    SETTINGS_UPDATED: 'SETTINGS_UPDATED',
    WEBHOOK_CREATED: 'WEBHOOK_CREATED',
    WEBHOOK_UPDATED: 'WEBHOOK_UPDATED',
    WEBHOOK_DELETED: 'WEBHOOK_DELETED',
    WEBHOOK_TRIGGERED: 'WEBHOOK_TRIGGERED'
};

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.socket?.remoteAddress || 
           req.ip;
}

function logAction(req, action, extraDetails = {}) {
    const details = {
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'],
        ...extraDetails
    };
    AuditLog.log(action, req.userId, details);
}

module.exports = { AuditLog, AUDIT_ACTIONS, logAction };
