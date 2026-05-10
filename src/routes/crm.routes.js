const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const https = require('https');

const router = express.Router();

// ─── CRM CONNECTIONS (HubSpot, Zoho) ───
router.get('/crm/connections', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const list = db.prepare("SELECT id, platform, name, is_active, last_sync_at, created_at FROM crm_connections ORDER BY created_at DESC").all();
        res.json(list);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/crm/connections', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { platform, name, api_key, api_secret, region } = req.body;
        if (!platform || !name || !api_key) return res.status(400).json({ error: 'platform, name y api_key requeridos' });
        const id = uuidv4();
        db.prepare("INSERT INTO crm_connections (id, platform, name, api_key, api_secret, region, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, platform, name, api_key, api_secret || null, region || 'us', new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/crm/connections/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM crm_connections WHERE id=?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/crm/connections/:id/sync', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const conn = db.prepare("SELECT * FROM crm_connections WHERE id=?").get(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });
        
        const contacts = await fetchCrmContacts(conn);
        let imported = 0;
        for (const c of contacts) {
            const existing = db.prepare("SELECT id FROM crm_contacts WHERE email = ? AND connection_id = ?").get(c.email, conn.id);
            if (!existing) {
                db.prepare("INSERT INTO crm_contacts (id, connection_id, external_id, name, email, phone, company, raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .run(uuidv4(), conn.id, String(c.id), c.name, c.email, c.phone || '', c.company || '', JSON.stringify(c), new Date().toISOString());
                imported++;
            }
        }
        db.prepare("UPDATE crm_connections SET last_sync_at = ? WHERE id = ?").run(new Date().toISOString(), conn.id);
        res.json({ success: true, imported, total: contacts.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

function fetchCrmContacts(conn) {
    if (conn.platform === 'hubspot') {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.hubapi.com', path: '/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,phone,company',
                headers: { 'Authorization': 'Bearer ' + conn.api_key, 'Content-Type': 'application/json' }
            };
            const req = https.get(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve((parsed.results || []).map(r => ({
                            id: r.id, name: (r.properties?.firstname || '') + ' ' + (r.properties?.lastname || ''),
                            email: r.properties?.email || '', phone: r.properties?.phone || '',
                            company: r.properties?.company || ''
                        })));
                    } catch(e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.setTimeout(15000, function() { req.destroy(); reject(new Error('Timeout al conectar con HubSpot')); });
        });
    }
    return Promise.resolve([]);
}

module.exports = router;
