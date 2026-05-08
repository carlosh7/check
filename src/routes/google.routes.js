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

function getUserRefreshToken(userId) {
    var token = db.prepare("SELECT refresh_token FROM user_google_accounts WHERE user_id = ?").pluck();
    return token.get(userId) || null;
}

function getOAuthWithToken(refreshToken) {
    var oauth2 = getOAuth2Client();
    if (!oauth2 || !refreshToken) return null;
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}

function getAuthScope() {
    return [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
    ];
}

function findBestAccount(event, userId) {
    if (event.google_account_id) return event.google_account_id;
    var userAcc = db.prepare("SELECT id, refresh_token FROM user_google_accounts WHERE user_id = ?").get(userId);
    if (userAcc && userAcc.refresh_token) return { type: 'user', id: userAcc.id, refreshToken: userAcc.refresh_token };
    return null;
}

async function ensureEventFolder(drive, event, accountLabel) {
    if (event.google_folder_id) {
        try {
            await drive.files.get({ fileId: event.google_folder_id, fields: 'id' });
            return event.google_folder_id;
        } catch(e) { }
    }

    var groupName = 'Sin Empresa';
    if (event.group_id) {
        var grp = db.prepare("SELECT name FROM groups WHERE id = ?").get(event.group_id);
        if (grp) groupName = grp.name;
    }

    var eventName = event.name || 'Evento';

    // Buscar o crear carpeta raíz "Check Pro"
    var rootFolder = null;
    var rootQuery = await drive.files.list({
        q: "name='Check Pro' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)', pageSize: 1
    });
    if (rootQuery.data.files.length > 0) {
        rootFolder = rootQuery.data.files[0].id;
    } else {
        var rootRes = await drive.files.create({
            resource: { name: 'Check Pro', mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id'
        });
        rootFolder = rootRes.data.id;
    }

    // Buscar o crear carpeta del grupo
    var groupFolder = null;
    var groupQuery = await drive.files.list({
        q: "name='" + groupName.replace(/'/g, "\\'") + "' and '" + rootFolder + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)', pageSize: 1
    });
    if (groupQuery.data.files.length > 0) {
        groupFolder = groupQuery.data.files[0].id;
    } else {
        var grpRes = await drive.files.create({
            resource: { name: groupName, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolder] },
            fields: 'id'
        });
        groupFolder = grpRes.data.id;
    }

    // Buscar o crear carpeta del evento
    var eventFolderId = event.google_folder_id;
    if (eventFolderId) {
        try {
            var existing = await drive.files.get({ fileId: eventFolderId, fields: 'id' });
            if (existing) return eventFolderId;
        } catch(e) { }
    }

    var evtQuery = await drive.files.list({
        q: "name='" + eventName.replace(/'/g, "\\'") + "' and '" + groupFolder + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)', pageSize: 1
    });
    if (evtQuery.data.files.length > 0) {
        eventFolderId = evtQuery.data.files[0].id;
    } else {
        var evtRes = await drive.files.create({
            resource: { name: eventName, mimeType: 'application/vnd.google-apps.folder', parents: [groupFolder] },
            fields: 'id'
        });
        eventFolderId = evtRes.data.id;
    }

    db.prepare("UPDATE events SET google_folder_id = ? WHERE id = ?").run(eventFolderId, event.id);
    return eventFolderId;
}

async function uploadPdfToDrive(drive, folderId, filename, pdfBuffer) {
    var query = await drive.files.list({
        q: "name='" + filename.replace(/'/g, "\\'") + "' and '" + folderId + "' in parents and trashed=false",
        fields: 'files(id)', pageSize: 1
    });
    if (query.data.files.length > 0) {
        await drive.files.update({
            fileId: query.data.files[0].id,
            media: { body: pdfBuffer, mimeType: 'application/pdf' }
        });
        return query.data.files[0].id;
    }
    var res = await drive.files.create({
        resource: { name: filename, parents: [folderId] },
        media: { body: pdfBuffer, mimeType: 'application/pdf' },
        fields: 'id'
    });
    return res.data.id;
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

// ── OAuth: Iniciar autenticación para grupo ──

router.get('/auth', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).json({ error: 'Google OAuth no configurado.' });

        var groupId = req.query.group_id;
        var label = req.query.label || 'Mi cuenta Google';
        if (!groupId) return res.status(400).json({ error: 'group_id requerido' });

        var state = JSON.stringify({ type: 'group', groupId: groupId, label: label, userId: req.userId });
        var authUrl = oauth2.generateAuthUrl({
            access_type: 'offline',
            scope: getAuthScope(),
            prompt: 'consent',
            state: state
        });
        res.json({ url: authUrl });
    } catch (err) {
        console.error('[GOOGLE] Auth error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Iniciar autenticación para usuario personal ──

router.get('/user/auth', authMiddleware(), (req, res) => {
    try {
        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).json({ error: 'Google OAuth no configurado.' });

        var state = JSON.stringify({ type: 'user', userId: req.userId });
        var authUrl = oauth2.generateAuthUrl({
            access_type: 'offline',
            scope: getAuthScope(),
            prompt: 'consent',
            state: state
        });
        res.json({ url: authUrl });
    } catch (err) {
        console.error('[GOOGLE] User auth error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Estado de la cuenta personal ──

router.get('/user/status', authMiddleware(), (req, res) => {
    try {
        var acc = db.prepare("SELECT id, google_email, created_at FROM user_google_accounts WHERE user_id = ?").get(req.userId);
        if (acc) {
            res.json({ connected: true, email: acc.google_email, connectedAt: acc.created_at });
        } else {
            res.json({ connected: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Desconectar cuenta personal ──

router.delete('/user/disconnect', authMiddleware(), (req, res) => {
    try {
        var acc = db.prepare("SELECT * FROM user_google_accounts WHERE user_id = ?").get(req.userId);
        if (acc && acc.refresh_token) {
            try {
                var oauth2 = getOAuth2Client();
                if (oauth2) oauth2.revokeToken(acc.refresh_token).catch(function() {});
            } catch(e) {}
        }
        db.prepare("DELETE FROM user_google_accounts WHERE user_id = ?").run(req.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── OAuth: Callback unificado ──

router.get('/callback', async (req, res) => {
    try {
        var code = req.query.code;
        var state = JSON.parse(req.query.state || '{}');
        if (!code) return res.status(400).send('Código de autorización requerido');

        var oauth2 = getOAuth2Client();
        if (!oauth2) return res.status(400).send('OAuth no configurado');

        var token = await oauth2.getToken(code);
        var refreshToken = token.tokens.refresh_token;
        if (!refreshToken) return res.status(400).send('No se obtuvo refresh_token.');

        oauth2.setCredentials({ access_token: token.tokens.access_token });
        var oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
        var userInfo = await oauth2Api.userinfo.get();
        var googleEmail = userInfo.data.email || '';

        if (state.type === 'user') {
            var existing = db.prepare("SELECT id FROM user_google_accounts WHERE user_id = ?").get(state.userId);
            if (existing) {
                db.prepare("UPDATE user_google_accounts SET google_email = ?, refresh_token = ?, updated_at = ? WHERE user_id = ?").run(googleEmail, refreshToken, new Date().toISOString(), state.userId);
            } else {
                db.prepare("INSERT INTO user_google_accounts (id, user_id, google_email, refresh_token) VALUES (?, ?, ?, ?)").run(uuidv4(), state.userId, googleEmail, refreshToken);
            }
            try { logAction(req, 'GOOGLE_USER_CONNECTED', { email: googleEmail }); } catch(e) {}
            res.send('<html><body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2 style="color:#10b981">✅ Cuenta personal conectada</h2><p>' + googleEmail + '</p><p>Vinculada a tu perfil. Tus eventos se sincronizar&aacute;n autom&aacute;ticamente.</p><p>Puedes cerrar esta ventana.</p></div></body></html>');
        } else {
            var accountId = uuidv4();
            db.prepare("INSERT INTO group_google_accounts (id, group_id, label, google_email, refresh_token, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(
                accountId, state.groupId, state.label, googleEmail, refreshToken, state.userId || null
            );
            try { logAction(req, 'GOOGLE_ACCOUNT_CONNECTED', { groupId: state.groupId, label: state.label, email: googleEmail }); } catch(e) {}
            res.send('<html><body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2 style="color:#10b981">✅ Cuenta conectada</h2><p>Cuenta ' + googleEmail + ' vinculada al grupo.</p><p>Puedes cerrar esta ventana.</p></div></body></html>');
        }
    } catch (err) {
        console.error('[GOOGLE] Callback error:', err.message);
        res.status(500).send('Error al conectar: ' + err.message);
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

// ── Exportar evento a Google Sheets + PDFs en carpeta Drive ──

router.post('/events/:eventId/export', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), async (req, res) => {
    try {
        var eId = req.params.eventId;
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        var accountId = event.google_account_id;

        // Auto-asignar cuenta personal del creador si el evento no tiene cuenta
        if (!accountId) {
            var creatorAcc = db.prepare("SELECT id, refresh_token FROM user_google_accounts WHERE user_id = ?").get(event.user_id || req.userId);
            if (creatorAcc && creatorAcc.refresh_token) {
                accountId = creatorAcc.id;
                db.prepare("UPDATE events SET google_account_id = ? WHERE id = ?").run(creatorAcc.id, eId);
                event.google_account_id = creatorAcc.id;
            }
        }

        if (!accountId) return res.status(400).json({ error: 'Este evento no tiene una cuenta Google asignada. Conecta una cuenta en tu Perfil o asigna una en la configuración del evento.' });

        var refreshToken = null;
        var accountLabel = 'Cuenta';
        // Buscar en cuentas de grupo primero
        var groupAcc = db.prepare("SELECT refresh_token, label FROM group_google_accounts WHERE id = ?").get(accountId);
        if (groupAcc && groupAcc.refresh_token) {
            refreshToken = groupAcc.refresh_token;
            accountLabel = groupAcc.label || 'Cuenta de grupo';
        } else {
            // Buscar en cuenta personal del usuario
            var userAcc = db.prepare("SELECT refresh_token, google_email FROM user_google_accounts WHERE id = ?").get(accountId);
            if (userAcc && userAcc.refresh_token) {
                refreshToken = userAcc.refresh_token;
                accountLabel = userAcc.google_email || 'Cuenta personal';
            }
        }

        if (!refreshToken) return res.status(400).json({ error: 'Cuenta Google no válida o token expirado' });

        var oauth2 = getOAuthWithToken(refreshToken);
        if (!oauth2) return res.status(400).json({ error: 'Error de autenticación Google' });

        var sheets = google.sheets({ version: 'v4', auth: oauth2 });
        var drive = google.drive({ version: 'v3', auth: oauth2 });
        var eventName = event.name || 'Evento sin nombre';
        var targetDb = getEventConnection(eId) || db;

        // Asegurar carpeta del evento en Drive
        var folderId = await ensureEventFolder(drive, event, accountLabel);

        // ── 1. Exportar invitados a Sheets ──
        var guests = targetDb.prepare("SELECT name, email, organization, phone, gender, status, checked_in, checkin_time, category_id FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
        var categories = {};
        try {
            var cats = targetDb.prepare("SELECT id, name FROM guest_categories").all();
            cats.forEach(function(c) { categories[c.id] = c.name; });
        } catch(e) {}

        var spreadsheetTitle = eventName + ' - Invitados';
        var spreadsheetId = null;

        try {
            var existingSheets = await drive.files.list({
                q: "name='" + spreadsheetTitle.replace(/'/g, "\\'") + "' and '" + folderId + "' in parents and trashed=false",
                fields: 'files(id)', pageSize: 1
            });
            if (existingSheets.data.files.length > 0) {
                spreadsheetId = existingSheets.data.files[0].id;
            }
        } catch(e) {}

        if (!spreadsheetId) {
            var createRes = await sheets.spreadsheets.create({
                resource: {
                    properties: { title: spreadsheetTitle },
                    sheets: [{ properties: { title: 'Invitados' } }]
                }
            });
            spreadsheetId = createRes.data.spreadsheetId;
            // Mover a la carpeta del evento
            try {
                await drive.files.update({
                    fileId: spreadsheetId,
                    addParents: folderId,
                    removeParents: 'root',
                    fields: 'id'
                });
            } catch(e) {}
        }

        var headers = ['Nombre', 'Email', 'Organización', 'Teléfono', 'Género', 'Estado', 'Check-in', 'Hora Check-in', 'Categoría'];
        var rows = guests.map(function(g) {
            return [g.name || '', g.email || '', g.organization || '', g.phone || '', g.gender || '', g.status || 'lead', g.checked_in ? 'Sí' : 'No', g.checkin_time || '', categories[g.category_id] || ''];
        });

        await sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheetId, range: 'Invitados!A:I' });
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId, range: 'Invitados!A1', valueInputOption: 'RAW',
            resource: { values: [headers].concat(rows) }
        });

        // ── 2. Exportar reporte PDF ──
        try {
            var { jsPDF } = require('jspdf');
            var autoTable = require('jspdf-autotable').default;
            var doc = new jsPDF();

            var total = guests.length;
            var checkedIn = guests.filter(function(g) { return g.checked_in; }).length;
            var conversionRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

            doc.setFontSize(22); doc.setTextColor(124, 58, 237);
            doc.text('Reporte del Evento', 14, 30);
            doc.setFontSize(12); doc.setTextColor(60);
            doc.text(eventName, 14, 40);
            doc.setFontSize(10); doc.setTextColor(100);
            doc.text('Generado: ' + new Date().toLocaleString(), 14, 48);

            doc.setFontSize(16); doc.setTextColor(0);
            doc.text('Resumen', 14, 68);
            autoTable(doc, {
                startY: 74, head: [['Métrica', 'Valor']],
                body: [['Total invitados', String(total)], ['Check-ins', String(checkedIn)], ['Pendientes', String(total - checkedIn)], ['Tasa de conversión', conversionRate + '%']],
                theme: 'grid', headStyles: { fillColor: [124, 58, 237] }
            });

            if (guests.length > 0) {
                if (doc.lastAutoTable.finalY + 20 > 250) doc.addPage();
                doc.setFontSize(16); doc.setTextColor(0);
                doc.text('Invitados', 14, (doc.lastAutoTable?.finalY || 74) + 20);
                autoTable(doc, {
                    startY: (doc.lastAutoTable?.finalY || 74) + 26,
                    head: [['Nombre', 'Email', 'Estado', 'Asistió']],
                    body: guests.map(function(g) { return [g.name || '-', g.email || '-', g.status || 'lead', g.checked_in ? 'Sí' : 'No']; }),
                    theme: 'striped', headStyles: { fillColor: [124, 58, 237] }, styles: { fontSize: 8 }
                });
            }

            await uploadPdfToDrive(drive, folderId, eventName + ' - Reporte.pdf', Buffer.from(doc.output('arraybuffer')));
        } catch(pdfErr) {
            console.error('[GOOGLE] PDF report error:', pdfErr.message);
        }

        // ── 3. Exportar gafetes PDF ──
        try {
            var QRCode = require('qrcode');
            var { jsPDF: JsPDF2 } = require('jspdf');
            var doc2 = new JsPDF2({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            var pageW = 210, margin = 10, cols = 2, rowsPerPage = 3;
            var cardW = (pageW - margin * 3) / cols, cardH = 85;

            var badgeGuests = targetDb.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
            for (var i = 0; i < badgeGuests.length; i++) {
                var g = badgeGuests[i];
                if (i > 0 && i % (cols * rowsPerPage) === 0) doc2.addPage();
                var pos = i % (cols * rowsPerPage);
                var col = pos % cols;
                var row = Math.floor(pos / cols);
                var x = margin + col * (cardW + margin);
                var y = margin + row * (cardH + margin);
                doc2.setDrawColor(124, 58, 237); doc2.setLineWidth(0.5);
                doc2.rect(x, y, cardW, cardH);
                doc2.setFontSize(8); doc2.setTextColor(100);
                doc2.text(eventName, x + 3, y + 6);
                doc2.setFontSize(14); doc2.setTextColor(0);
                doc2.text(g.name || 'Sin nombre', x + 3, y + 18);
                doc2.setFontSize(9); doc2.setTextColor(80);
                if (g.organization) doc2.text(g.organization, x + 3, y + 26);
                if (g.qr_token) {
                    try {
                        var qrDataUrl = await QRCode.toDataURL(g.qr_token, { width: 80, margin: 1 });
                        doc2.addImage(qrDataUrl, 'PNG', x + cardW - 45, y + 25, 40, 40);
                    } catch(_) {}
                }
                doc2.setFontSize(7); doc2.setTextColor(150);
                doc2.text('Check Pro', x + 3, y + cardH - 3);
            }

            await uploadPdfToDrive(drive, folderId, eventName + ' - Gafetes.pdf', Buffer.from(doc2.output('arraybuffer')));
        } catch(badgeErr) {
            console.error('[GOOGLE] Badges PDF error:', badgeErr.message);
        }

        // Actualizar sync
        db.prepare("UPDATE events SET google_last_sync_at = ? WHERE id = ?").run(new Date().toISOString(), eId);
        try { logAction(req, 'GOOGLE_SHEETS_EXPORT', { eventId: eId, eventName: eventName, guestCount: guests.length, folderId: folderId }); } catch(e) {}

        res.json({ success: true, folderUrl: 'https://drive.google.com/drive/folders/' + folderId, guestCount: guests.length });
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
