const express = require('express');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('../security/audit');

const router = express.Router();

// Get SMS settings
router.get('/api/sms/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        let settings = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'sms_%'").all();
        let result = {};
        settings.forEach(function(s) { result[s.setting_key.replace('sms_', '')] = s.setting_value; });
        res.json({
            account_sid: result.account_sid || '',
            auth_token_placeholder: result.auth_token ? '••••••••' : '',
            has_auth_token: !!result.auth_token,
            from_number: result.from_number || '',
            enabled: result.enabled === '1'
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Save SMS settings
router.post('/api/sms/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        let { account_sid, auth_token, from_number, enabled } = req.body;
        let upsert = function(key, val) {
            let existing = db.prepare("SELECT setting_key FROM settings WHERE setting_key = ?").get(key);
            if (existing) db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(val, key);
            else db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, val);
        };
        upsert('sms_account_sid', account_sid || '');
        if (auth_token && auth_token !== '••••••••') upsert('sms_auth_token', auth_token);
        upsert('sms_from_number', from_number || '');
        upsert('sms_enabled', enabled ? '1' : '0');
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Send a single SMS (test)
router.post('/api/sms/send', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        let { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: 'Teléfono y mensaje requeridos' });
        let accountSid = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_account_sid'").get();
        let authToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_auth_token'").get();
        let fromNumber = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_from_number'").get();
        if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'SMS no configurado' });

        let twilio = require('twilio')(accountSid.setting_value, authToken.setting_value);
        let result = await twilio.messages.create({
            body: message,
            to: to,
            from: fromNumber.setting_value
        });
        logAction(req, 'SMS_SENT', { to: to, sid: result.sid });
        res.json({ success: true, sid: result.sid, status: result.status });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Send SMS to guest
router.post('/api/sms/send-to-guest/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        let guest = db.prepare("SELECT id, name, phone, event_id FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (!guest.phone) return res.status(400).json({ error: 'Este invitado no tiene teléfono registrado' });

        let accountSid = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_account_sid'").get();
        let authToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_auth_token'").get();
        let fromNumber = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_from_number'").get();
        if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'SMS no configurado' });

        let event = db.prepare("SELECT name, date, location FROM events WHERE id = ?").get(guest.event_id);
        let message = 'Hola ' + (guest.name || '') + '! Te esperamos en ' + (event ? event.name : 'el evento') + '.';
        if (event && event.location) message += ' Ubicación: ' + event.location + '.';

        let twilio = require('twilio')(accountSid.setting_value, authToken.setting_value);
        let result = await twilio.messages.create({ body: message, to: guest.phone, from: fromNumber.setting_value });
        logAction(req, 'SMS_SENT_GUEST', { guestId: guest.id, sid: result.sid });
        res.json({ success: true, sid: result.sid, status: result.status, to: guest.phone });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── WhatsApp (C3-01) ───

// Get WhatsApp settings
router.get('/api/whatsapp/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        let settings = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'wa_%'").all();
        let result = {};
        settings.forEach(function(s) { result[s.setting_key.replace('wa_', '')] = s.setting_value; });
        res.json({
            phone_number_id: result.phone_number_id || '',
            token_placeholder: result.access_token ? '••••••••' : '',
            has_token: !!result.access_token,
            from_phone: result.from_phone || '',
            enabled: result.enabled === '1'
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Save WhatsApp settings
router.post('/api/whatsapp/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        let { phone_number_id, access_token, from_phone, enabled } = req.body;
        let upsert = function(key, val) {
            let existing = db.prepare("SELECT setting_key FROM settings WHERE setting_key = ?").get(key);
            if (existing) db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(val, key);
            else db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, val);
        };
        upsert('wa_phone_number_id', phone_number_id || '');
        if (access_token && access_token !== '••••••••') upsert('wa_access_token', access_token);
        upsert('wa_from_phone', from_phone || '');
        upsert('wa_enabled', enabled ? '1' : '0');
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Send WhatsApp message
router.post('/api/whatsapp/send', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        let { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: 'Teléfono y mensaje requeridos' });
        let phoneId = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'wa_phone_number_id'").get();
        let token = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'wa_access_token'").get();
        if (!phoneId || !token) return res.status(400).json({ error: 'WhatsApp no configurado' });

        let response = await fetch('https://graph.facebook.com/v18.0/' + phoneId.setting_value + '/messages', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token.setting_value, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to.replace(/[^0-9]/g, ''),
                type: 'text',
                text: { body: message }
            })
        });
        let data = await response.json();
        if (data.messages && data.messages[0]) {
            logAction(req, 'WHATSAPP_SENT', { to: to, id: data.messages[0].id });
            res.json({ success: true, waId: data.messages[0].id });
        } else {
            res.status(400).json({ error: data.error?.message || 'Error al enviar WhatsApp' });
        }
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Send WhatsApp to guest
router.post('/api/whatsapp/send-to-guest/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        let guest = db.prepare("SELECT id, name, phone, event_id FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (!guest.phone) return res.status(400).json({ error: 'Este invitado no tiene teléfono' });
        let event = db.prepare("SELECT name, date, location FROM events WHERE id = ?").get(guest.event_id);
        let msg = 'Hola ' + (guest.name || '') + '! Te esperamos en ' + (event ? event.name : 'el evento') + '.';
        if (event && event.location) msg += ' Ubicación: ' + event.location;

        let phoneId = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'wa_phone_number_id'").get();
        let token = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'wa_access_token'").get();
        if (!phoneId || !token) return res.status(400).json({ error: 'WhatsApp no configurado' });

        let response = await fetch('https://graph.facebook.com/v18.0/' + phoneId.setting_value + '/messages', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token.setting_value, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: guest.phone.replace(/[^0-9]/g, ''), type: 'text', text: { body: msg } })
        });
        let data = await response.json();
        if (data.messages && data.messages[0]) {
            logAction(req, 'WHATSAPP_SENT_GUEST', { guestId: guest.id, waId: data.messages[0].id });
            res.json({ success: true, waId: data.messages[0].id, to: guest.phone });
        } else {
            res.status(400).json({ error: data.error?.message || 'Error al enviar WhatsApp' });
        }
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
