const express = require('express');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

const router = express.Router();

// Get SMS settings
router.get('/api/sms/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var settings = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'sms_%'").all();
        var result = {};
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
        var { account_sid, auth_token, from_number, enabled } = req.body;
        var upsert = function(key, val) {
            var existing = db.prepare("SELECT setting_key FROM settings WHERE setting_key = ?").get(key);
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
        var { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: 'Teléfono y mensaje requeridos' });
        var accountSid = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_account_sid'").get();
        var authToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_auth_token'").get();
        var fromNumber = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_from_number'").get();
        if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'SMS no configurado' });

        var twilio = require('twilio')(accountSid.setting_value, authToken.setting_value);
        var result = await twilio.messages.create({
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
        var guest = db.prepare("SELECT id, name, phone, event_id FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (!guest.phone) return res.status(400).json({ error: 'Este invitado no tiene teléfono registrado' });

        var accountSid = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_account_sid'").get();
        var authToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_auth_token'").get();
        var fromNumber = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'sms_from_number'").get();
        if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'SMS no configurado' });

        var event = db.prepare("SELECT name, date, location FROM events WHERE id = ?").get(guest.event_id);
        var message = 'Hola ' + (guest.name || '') + '! Te esperamos en ' + (event ? event.name : 'el evento') + '.';
        if (event && event.location) message += ' Ubicación: ' + event.location + '.';

        var twilio = require('twilio')(accountSid.setting_value, authToken.setting_value);
        var result = await twilio.messages.create({ body: message, to: guest.phone, from: fromNumber.setting_value });
        logAction(req, 'SMS_SENT_GUEST', { guestId: guest.id, sid: result.sid });
        res.json({ success: true, sid: result.sid, status: result.status, to: guest.phone });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
