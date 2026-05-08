const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, getDatabase } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { getValidId } = require('../utils/helpers');
const { google } = require('googleapis');

const router = express.Router();

function getSetting(key) {
    var val = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").pluck();
    return val.get() || '';
}

function getOAuth2Client() {
    var clientId = getSetting('google_client_id');
    var clientSecret = getSetting('google_client_secret');
    var redirectUri = getSetting('google_redirect_uri');
    if (!clientId || !clientSecret || !redirectUri) return null;
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getRefreshToken(accountId) {
    var token = db.prepare("SELECT refresh_token FROM group_google_accounts WHERE id = ?").pluck();
    return token.get(accountId) || null;
}

// ── Estado de configuración ──

router.get('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var clientId = getSetting('google_client_id');
        res.json({ configured: !!clientId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Iniciar autenticación ──

router.get('/auth', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).json({ error: 'Google OAuth no configurado. Configure client_id y client_secret en settings.' });

        var groupId = req.query.group_id;
        var label = req.query.label || 'Mi cuenta Google';
        if (!groupId) return res.status(400).json({ error: 'group_id requerido' });

        var state = JSON.stringify({ groupId: groupId, label: label, userId: req.userId });
        var authUrl = oauth2.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/spreadsheets'],
            prompt: 'consent',
            state: state
        });
        res.json({ url: authUrl });
    } catch (err) {
        console.error('[GOOGLE] Auth error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Callback ──

router.get('/callback', async (req, res) => {
    try {
        var code = req.query.code;
        var state = JSON.parse(req.query.state || '{}');
        if (!code) return res.status(400).send('Código de autorización requerido');

        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).send('OAuth no configurado');

        var token = await oauth2.getToken(code);
        var refreshToken = token.tokens.refresh_token;
        if (!refreshToken) return res.status(400).send('No se obtuvo refresh_token. Asegúrate de autorizar con una cuenta que no haya autorizado antes.');

        // Obtener email de Google
        oauth2.setCredentials({ access_token: token.tokens.access_token });
        var oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
        var userInfo = await oauth2Api.userinfo.get();
        var googleEmail = userInfo.data.email || '';

        var accountId = uuidv4();
        db.prepare("INSERT INTO group_google_accounts (id, group_id, label, google_email, refresh_token, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(
            accountId, state.groupId, state.label, googleEmail, refreshToken, state.userId || null
        );

        try { logAction(req, 'GOOGLE_ACCOUNT_CONNECTED', { groupId: state.groupId, label: state.label, email: googleEmail }); } catch(e) {}

        res.send('<html><body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2 style="color:#10b981">✅ Cuenta conectada</h2><p>Cuenta ' + googleEmail + ' vinculada correctamente.</p><p>Puedes cerrar esta ventana.</p></div></body></html>');
    } catch (err) {
        console.error('[GOOGLE] Callback error:', err.message);
        res.status(500).send('Error al conectar cuenta Google: ' + err.message);
    }
});

// ── CRUD: Listar cuentas de un grupo ──

router.get('/groups/:groupId/accounts', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var accounts = db.prepare("SELECT id, group_id, label, google_email, created_at, updated_at FROM group_google_accounts WHERE group_id = ? ORDER BY created_at DESC").all(req.params.groupId);
        res.json(accounts);
    } catch (err) {
        console.error('[GOOGLE] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── CRUD: Actualizar etiqueta ──

router.put('/groups/:groupId/accounts/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var label = (req.body.label || '').trim();
        if (!label) return res.status(400).json({ error: 'Etiqueta requerida' });
        db.prepare("UPDATE group_google_accounts SET label = ?, updated_at = ? WHERE id = ? AND group_id = ?").run(label, new Date().toISOString(), req.params.id, req.params.groupId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── CRUD: Eliminar cuenta (revocar token) ──

router.delete('/groups/:groupId/accounts/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var account = db.prepare("SELECT * FROM group_google_accounts WHERE id = ? AND group_id = ?").get(req.params.id, req.params.groupId);
        if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

        // Intentar revocar token en Google
        if (account.refresh_token) {
            try {
                var oauth2 = getOAuth2Client();
                if (oauth2) {
                    oauth2.revokeToken(account.refresh_token).catch(function() {});
                }
            } catch(e) {}
        }

        // Desvincular eventos que usan esta cuenta
        db.prepare("UPDATE events SET google_account_id = NULL, google_auto_sync_mode = 'manual' WHERE google_account_id = ?").run(req.params.id);
        db.prepare("DELETE FROM group_google_accounts WHERE id = ?").run(req.params.id);

        try { logAction(req, 'GOOGLE_ACCOUNT_DISCONNECTED', { groupId: req.params.groupId, email: account.google_email }); } catch(e) {}

        res.json({ success: true });
    } catch (err) {
        console.error('[GOOGLE] Delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Exportar evento a Google Sheets ──

router.post('/events/:eventId/export', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), async (req, res) => {
    try {
        var eId = req.params.eventId;
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        var accountId = event.google_account_id;
        if (!accountId) return res.status(400).json({ error: 'Este evento no tiene una cuenta Google asignada' });

        var account = db.prepare("SELECT * FROM group_google_accounts WHERE id = ?").get(accountId);
        if (!account || !account.refresh_token) return res.status(400).json({ error: 'Cuenta Google no válida o token expirado' });

        var eventName = event.name || 'Evento sin nombre';
        var targetDb = getEventConnection(eId) || db;
        var guests = targetDb.prepare("SELECT name, email, organization, phone, gender, status, checked_in, checkin_time, category_id FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);

        var categories = {};
        try {
            var cats = targetDb.prepare("SELECT id, name FROM guest_categories").all();
            cats.forEach(function(c) { categories[c.id] = c.name; });
        } catch(e) {}

        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).json({ error: 'Google OAuth no configurado' });
        oauth2.setCredentials({ refresh_token: account.refresh_token });

        var sheets = google.sheets({ version: 'v4', auth: oauth2 });

        // Crear o encontrar spreadsheet
        var spreadsheetTitle = eventName + ' - Check Pro';
        var spreadsheet = null;

        try {
            var searchRes = await sheets.spreadsheets.get({ spreadsheetId: account.spreadsheet_id || '' }).catch(function() { return null; });
            if (searchRes && searchRes.data) {
                spreadsheet = searchRes.data;
            }
        } catch(e) {}

        if (!spreadsheet) {
            var createRes = await sheets.spreadsheets.create({
                resource: {
                    properties: { title: spreadsheetTitle },
                    sheets: [{ properties: { title: 'Invitados' } }]
                }
            });
            spreadsheet = createRes.data;
            // Guardar spreadsheet_id en la cuenta
            if (!account.spreadsheet_id) {
                db.prepare("UPDATE group_google_accounts SET spreadsheet_id = ? WHERE id = ?").run(spreadsheet.spreadsheetId, accountId);
            }
        }

        var spreadsheetId = spreadsheet.spreadsheetId;

        // Preparar datos
        var headers = ['Nombre', 'Email', 'Organización', 'Teléfono', 'Género', 'Estado', 'Check-in', 'Hora Check-in', 'Categoría'];
        var rows = guests.map(function(g) {
            return [
                g.name || '',
                g.email || '',
                g.organization || '',
                g.phone || '',
                g.gender || '',
                g.status || 'lead',
                g.checked_in ? 'Sí' : 'No',
                g.checkin_time || '',
                categories[g.category_id] || ''
            ];
        });

        var values = [headers].concat(rows);

        // Limpiar y escribir datos
        try {
            var sheetTitle = 'Invitados';
            var sheetsList = spreadsheet.sheets || [];
            var existingSheet = sheetsList.find(function(s) { return s.properties.title === sheetTitle; });
            if (!existingSheet) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    resource: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
                });
            }
            await sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: sheetTitle + '!A:I'
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: sheetTitle + '!A1',
                valueInputOption: 'RAW',
                resource: { values: values }
            });

            // Formatear encabezados
            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    resource: {
                        requests: [{
                            repeatCell: {
                                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.24, green: 0.14, blue: 0.67 },
                                        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        }]
                    }
                });
            } catch(e) {}

            // Actualizar sync
            db.prepare("UPDATE events SET google_last_sync_at = ? WHERE id = ?").run(new Date().toISOString(), eId);

            try { logAction(req, 'GOOGLE_SHEETS_EXPORT', { eventId: eId, eventName: eventName, guestCount: guests.length, spreadsheetId: spreadsheetId }); } catch(e) {}

            res.json({ success: true, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId, guestCount: guests.length });
        } catch (apiError) {
            // Si el token expiró
            if (apiError.message && (apiError.message.includes('Token') || apiError.message.includes('auth'))) {
                db.prepare("UPDATE group_google_accounts SET refresh_token = NULL WHERE id = ?").run(accountId);
                return res.status(401).json({ error: 'Token expirado. Reconecta la cuenta Google.' });
            }
            console.error('[GOOGLE] Sheets API error:', apiError.message);
            res.status(500).json({ error: 'Error de Google Sheets API: ' + apiError.message });
        }
    } catch (err) {
        console.error('[GOOGLE] Export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Importar desde Google Sheets ──

router.post('/events/:eventId/import', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        var eId = req.params.eventId;
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        var accountId = event.google_account_id;
        if (!accountId) return res.status(400).json({ error: 'No hay cuenta asignada' });
        var account = db.prepare("SELECT * FROM group_google_accounts WHERE id = ?").get(accountId);
        if (!account || !account.refresh_token) return res.status(400).json({ error: 'Token expirado' });

        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).json({ error: 'OAuth no configurado' });
        oauth2.setCredentials({ refresh_token: account.refresh_token });

        var sheets = google.sheets({ version: 'v4', auth: oauth2 });

        // Buscar el spreadsheet del evento
        var spreadsheetTitle = (event.name || 'Evento') + ' - Check Pro';
        var spreadsheetId = req.body.spreadsheet_id || account.spreadsheet_id;
        if (!spreadsheetId) return res.status(400).json({ error: 'No hay spreadsheet vinculado. Exporta primero.' });

        var sheetRes = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Invitados!A:I'
        }).catch(function(err) {
            if (err.message && err.message.includes('Token')) { throw new Error('Token expirado'); }
            throw err;
        });

        var rows = sheetRes.data.values || [];
        if (rows.length <= 1) return res.json({ imported: 0, message: 'No hay datos para importar' });

        var targetDb = getEventConnection(eId) || db;
        var headers = rows[0];
        var nameIdx = headers.indexOf('Nombre');
        var emailIdx = headers.indexOf('Email');
        var orgIdx = headers.indexOf('Organización');
        var phoneIdx = headers.indexOf('Teléfono');

        if (nameIdx === -1 && emailIdx === -1) return res.status(400).json({ error: 'La hoja debe tener al menos columnas Nombre o Email' });

        var statusMap = { 'lead': 'lead', 'contactado': 'contacted', 'confirmado': 'confirmed', 'asistió': 'attended', 'Asistió': 'attended', 'Sí': 'attended', 'no interesado': 'not_interested' };

        var imported = 0;
        var insertGuest = targetDb.prepare("INSERT OR IGNORE INTO guests (id, event_id, name, email, organization, phone, status, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        var insertMany = targetDb.transaction(function(dataRows) {
            for (var i = 1; i < dataRows.length; i++) {
                var row = dataRows[i];
                var name = row[nameIdx] || '';
                var email = (row[emailIdx] || '').toLowerCase().trim();
                if (!name && !email) continue;
                var org = orgIdx >= 0 ? (row[orgIdx] || '') : '';
                var phone = phoneIdx >= 0 ? (row[phoneIdx] || '') : '';
                var statusRaw = '';
                for (var j = 0; j < headers.length; j++) {
                    if (headers[j].toLowerCase() === 'estado' || headers[j].toLowerCase() === 'status') { statusRaw = (row[j] || '').toLowerCase().trim(); break; }
                }
                var status = statusMap[statusRaw] || 'lead';

                    var guestId = getValidId('guests');
                var qrToken = uuidv4();
                try {
                    insertGuest.run(guestId, eId, name, email, org, phone, status, qrToken);
                    imported++;
                } catch(e) {}
            }
        });

        insertMany(rows);
        db.prepare("UPDATE events SET google_last_sync_at = ? WHERE id = ?").run(new Date().toISOString(), eId);

        try { logAction(req, 'GOOGLE_SHEETS_IMPORT', { eventId: eId, imported: imported }); } catch(e) {}

        res.json({ success: true, imported: imported });
    } catch (err) {
        if (err.message === 'Token expirado') {
            var acc = db.prepare("SELECT id FROM group_google_accounts WHERE id = ?").get(req.params.eventId);
            if (acc) db.prepare("UPDATE group_google_accounts SET refresh_token = NULL WHERE id = ?").run(acc.id);
            return res.status(401).json({ error: 'Token expirado. Reconecta la cuenta.' });
        }
        console.error('[GOOGLE] Import error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Sincronizar eventos programados (worker interno) ──

function runSyncWorker() {
    try {
        var now = new Date().toISOString();
        var eventsToSync = db.prepare(`
            SELECT e.id, e.name, e.google_account_id, e.google_sync_interval, e.google_last_sync_at,
                   e.google_debounce_until, e.google_auto_sync_mode
            FROM events e
            WHERE e.google_account_id IS NOT NULL
              AND e.google_auto_sync_mode IN ('scheduled', 'checkin')
              AND (e.google_debounce_until IS NULL OR e.google_debounce_until <= ?)
        `).all(now);

        eventsToSync.forEach(function(event) {
            try {
                if (event.google_auto_sync_mode === 'scheduled' && event.google_sync_interval) {
                    var lastSync = event.google_last_sync_at ? new Date(event.google_last_sync_at).getTime() : 0;
                    var intervalMs = event.google_sync_interval * 60 * 1000;
                    if (Date.now() - lastSync < intervalMs) return;
                }

                // Trigger export via fetch internal
                triggerExport(event.id);
            } catch(e) {
                console.error('[GOOGLE] Sync error for event ' + event.id + ':', e.message);
            }
        });
    } catch(e) {
        console.error('[GOOGLE] Sync worker error:', e.message);
    }
}

function triggerExport(eventId) {
    var server = require('../../server');
    var http = require('http');
    var url = require('url');

    var baseUrl = process.env.APP_URL || 'http://localhost:' + (process.env.PORT || 3000);
    var parsedUrl = url.parse(baseUrl);

    var postData = JSON.stringify({});
    var options = {
        hostname: parsedUrl.hostname || 'localhost',
        port: parsedUrl.port || 3000,
        path: '/api/google/events/' + eventId + '/export',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-sync': 'true'
        }
    };

    var req = http.request(options, function(res) {
        if (res.statusCode !== 200) {
            console.error('[GOOGLE] Sync failed for event ' + eventId + ': HTTP ' + res.statusCode);
        }
    });
    req.on('error', function(e) {
        console.error('[GOOGLE] Sync request error for event ' + eventId + ':', e.message);
    });
    req.write(postData);
    req.end();
}

var syncInterval = null;

function startSyncWorker() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(runSyncWorker, 60000);
    console.log('[GOOGLE] Sync worker started (interval: 60s)');
}

function stopSyncWorker() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('[GOOGLE] Sync worker stopped');
    }
}

// ── Configurar sync de evento ──

router.put('/events/:eventId/sync-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var eId = req.params.eventId;
        var accountId = req.body.google_account_id || null;
        var mode = req.body.google_auto_sync_mode || 'manual';
        var interval = parseInt(req.body.google_sync_interval) || 60;

        if (!['manual', 'checkin', 'scheduled'].includes(mode)) return res.status(400).json({ error: 'Modo inválido' });
        if (mode === 'scheduled' && (interval < 5 || interval > 1440)) return res.status(400).json({ error: 'Intervalo debe ser entre 5 y 1440 minutos' });

        db.prepare("UPDATE events SET google_account_id = ?, google_auto_sync_mode = ?, google_sync_interval = ? WHERE id = ?").run(accountId, mode, interval, eId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Trigger check-in sync ──

function notifyCheckin(eventId) {
    var event = db.prepare("SELECT google_auto_sync_mode, google_debounce_until, google_account_id FROM events WHERE id = ?").get(eventId);
    if (!event || event.google_auto_sync_mode !== 'checkin' || !event.google_account_id) return;

    var debounceUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.prepare("UPDATE events SET google_debounce_until = ? WHERE id = ?").run(debounceUntil, eventId);

    try { triggerExport(eventId); } catch(e) {}
}

module.exports = { router, startSyncWorker, stopSyncWorker, notifyCheckin };
