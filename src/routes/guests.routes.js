/**
 * Rutas de Invitados e Importación/Exportación
 *
 * @openapi
 * tags:
 *   - name: Guests
 *     description: Invitados, check-in, categorías, badges
 *
 * /api/guests/{eventId}:
 *   get:
 *     tags: [Guests]
 *     summary: Listar invitados de un evento
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de invitados }
 *
 * /api/guests/{eventId}/checkin:
 *   post:
 *     tags: [Guests]
 *     summary: Realizar check-in de un invitado
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Check-in exitoso }
 *
 * /api/guests/{eventId}/categories:
 *   get:
 *     tags: [Guests]
 *     summary: Listar categorías del evento
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de categorías }
 *   post:
 *     tags: [Guests]
 *     summary: Crear categoría
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       201: { description: Categoría creada }
 *
 * /api/guests/{eventId}/badges:
 *   get:
 *     tags: [Guests]
 *     summary: Generar PDF de gafetes
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: PDF de gafetes }
 *
 * /api/guests/by-id/{guestId}:
 *   get:
 *     tags: [Guests]
 *     summary: Obtener invitado por ID (público)
 *     responses:
 *       200: { description: Datos del invitado }
 */

const express = require('express');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getIO: socketGetIO } = require('../socket');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { sendPushToEventUsers } = require('./push.routes');
const { logChange } = require('../utils/change-log');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

let tempImport = {};

// Obtener invitado por ID (público - para tickets)
router.get('/by-id/:guestId', (req, res) => {
    const gId = castId('guests', req.params.guestId);
    if (!gId) return res.status(400).json({ error: 'ID de invitado inválido' });
    const guest = db.prepare("SELECT * FROM guests WHERE id = ?").get(gId);
    if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
    res.json(guest);
});

// OTP Check-in (BL-14)
router.post('/otp/generate/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var guest = db.prepare("SELECT id FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        var code = String(Math.floor(100000 + Math.random() * 900000));
        db.prepare("UPDATE guests SET otp_code = ? WHERE id = ?").run(code, req.params.guestId);
        res.json({ success: true, code: code });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos OTP. Espera 15 minutos.' } });

router.post('/otp/verify', otpLimiter, (req, res) => {
    try {
        var { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Código requerido' });
        var guest = db.prepare("SELECT id, event_id, name, checked_in FROM guests WHERE otp_code = ?").get(code);
        if (!guest) return res.json({ valid: false, error: 'Código inválido' });
        if (guest.checked_in) return res.json({ valid: false, error: 'Ya registró asistencia', guest: guest });
        if (!guest.checked_in) {
            db.prepare("UPDATE guests SET checked_in = 1, checkin_time = ? WHERE id = ?").run(new Date().toISOString(), guest.id);
            try { var io2 = require('../socket').getIO(); if (io2) { io2.to(guest.event_id).emit('update_stats', guest.event_id); io2.to(guest.event_id).emit('live_checkin', { name: guest.name, id: guest.id, event_id: guest.event_id }); } } catch(e) {}
        }
        res.json({ valid: true, guest: { id: guest.id, name: guest.name, event_id: guest.event_id } });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Obtener invitados de evento (con paginación)
router.get('/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    // Usar BD del evento si existe
    const targetDb = getEventDb(eId);

    let whereClause = 'event_id = ?';
    let params = [eId];

    if (search) {
        whereClause += " AND (name LIKE ? OR email LIKE ? OR organization LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    const total = targetDb.prepare(`SELECT COUNT(*) as count FROM guests WHERE ${whereClause}`).get(...params).count;
    const rows = targetDb.prepare(`
        SELECT 
            *, 
            id as client_id, 
            name as client_name, 
            email as client_email, 
            phone as client_phone 
        FROM guests 
        WHERE ${whereClause} 
        ORDER BY name ASC 
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
        data: rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Importar preview (PENDIENTE - necesita implementación completa)
// router.post('/import-preview', authMiddleware(), async (req, res) => { ... });

// Importar confirmados
router.post('/import-confirm', authMiddleware(), async (req, res) => {
    console.log('[IMPORT-CONFIRM] ========== INICIO IMPORT ==========');
    
    const session = tempImport[req.userId];
    if (!session || !require('fs').existsSync(session.filePath)) {
        return res.status(400).json({ error: 'Sesión expirada' });
    }
    
    const fs = require('fs');
    const pdfParse = require('pdf-parse');
    const ExcelJS = require('exceljs');
    
    const { mapping, event_id } = req.body;
    console.log('[IMPORT-CONFIRM] event_id:', event_id);
    
    const eId = castId('events', event_id);
    console.log('[IMPORT-CONFIRM] eId:', eId);
    const guests = [];
    
    // Usar BD del evento si existe
    const targetDb = getEventDb(eId);

    try {
        if (session.isPDF) {
            const text = (await pdfParse(fs.readFileSync(session.filePath))).text;
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = text.match(emailRegex) || [];
            emails.forEach(email => {
                guests.push({ name: email.split('@')[0], email: email.toLowerCase(), organization: 'Importado PDF' });
            });
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(session.filePath);
            const sheet = workbook.getWorksheet(1);
            
            sheet.eachRow((row, i) => {
                if (i > 1) {
                    const g = {};
                    if (mapping.name !== undefined) g.name = row.getCell(mapping.name + 1).text;
                    if (mapping.email !== undefined) g.email = row.getCell(mapping.email + 1).text;
                    if (mapping.organization !== undefined) g.organization = row.getCell(mapping.organization + 1).text;
                    if (mapping.phone !== undefined) g.phone = row.getCell(mapping.phone + 1).text;
                    if (mapping.gender !== undefined) g.gender = row.getCell(mapping.gender + 1).text;
                    if (mapping.position !== undefined) g.position = row.getCell(mapping.position + 1).text;
                    if (mapping.dietary_notes !== undefined) g.dietary_notes = row.getCell(mapping.dietary_notes + 1).text;
                    
                    if (g.email || g.phone || g.name) guests.push(g);
                    if (i % 10 === 0 && socketGetIO()) socketGetIO().to(eId).emit('import_progress', { current: i, total: sheet.rowCount - 1 });
                }
            });
        }

        const existing = targetDb.prepare("SELECT email, phone FROM guests WHERE event_id = ?").all(eId);
        const existingEmails = new Set(existing.map(e => (e.email || '').toLowerCase().trim()));
        const existingPhones = new Set(existing.map(e => (e.phone || '').replace(/\D/g, '')));
        
        let duplicates = 0;
        const newGuests = guests.filter(g => {
            const email = (g.email || '').toLowerCase().trim();
            const phone = (g.phone || '').replace(/\D/g, '');
            if ((email && existingEmails.has(email)) || (phone && phone.length > 6 && existingPhones.has(phone))) {
                duplicates++;
                return false;
            }
            return true;
        });

        const insertGuest = targetDb.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, dietary_notes, position, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const insertedGuests = [];
        const insertMany = targetDb.transaction((list) => {
            for (const g of list) {
                const guestId = getValidId('guests');
                const qrToken = uuidv4();
                insertGuest.run(guestId, eId, g.name || '', g.email || '', g.organization || '', g.phone || '', g.gender || 'O', g.dietary_notes || '', g.position || '', qrToken);
                insertedGuests.push({
                    id: guestId,
                    event_id: eId,
                    name: g.name || '',
                    email: g.email || '',
                    organization: g.organization || '',
                    phone: g.phone || '',
                    gender: g.gender || 'O',
                    dietary_notes: g.dietary_notes || '',
                    position: g.position || '',
                    qr_token: qrToken
                });
            }
        });

        insertMany(newGuests);
        
        // Trigger webhooks for each new guest
        for (const guest of insertedGuests) {
            triggerWebhooks(WEBHOOK_EVENTS.GUEST_CREATED, guest, eId).catch(err => 
                console.error(`Error triggering webhook for guest ${guest.id}:`, err.message)
            );
        }
        if (fs.existsSync(session.filePath)) fs.unlinkSync(session.filePath);
        delete tempImport[req.userId];
        
        if (socketGetIO()) socketGetIO().to(eId).emit('update_stats', eId);
        res.json({ success: true, count: newGuests.length, skipped: duplicates });
    } catch (e) {
        if (session && session.filePath && fs.existsSync(session.filePath)) fs.unlinkSync(session.filePath);
        res.status(500).json({ error: e.message });
    }
});

// Exportar Excel
router.get('/export-excel/:eventId', authMiddleware(), async (req, res) => {
    const eId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eId);
    // Filtros opcionales (F-03)
    var whereClause = "WHERE event_id = ?";
    var params = [eId];
    if (req.query.checked_in === '1') { whereClause += " AND checked_in = 1"; }
    if (req.query.checked_in === '0') { whereClause += " AND checked_in = 0"; }
    if (req.query.category_id) { whereClause += " AND category_id = ?"; params.push(req.query.category_id); }
    if (req.query.search) { whereClause += " AND (name LIKE ? OR email LIKE ? OR organization LIKE ?)"; var s = '%' + req.query.search + '%'; params.push(s, s, s); }
    var rows = targetDb.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, category_id as Categoria, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests " + whereClause + " ORDER BY name ASC").all.apply(targetDb, params);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Check Pro V10';
    const sheet = workbook.addWorksheet('Invitados', { views: [{ state: 'frozen', ySplit: 1 }] });
    
    sheet.columns = [
        { header: 'Nombre', key: 'Nombre', width: 30 },
        { header: 'Email', key: 'Email', width: 35 },
        { header: 'Organización', key: 'Organizacion', width: 30 },
        { header: 'Teléfono', key: 'Telefono', width: 18 },
        { header: 'Género', key: 'Genero', width: 10 },
        { header: 'Categoría', key: 'Categoria', width: 15 },
        { header: 'Asistió', key: 'Asistio', width: 12 },
        { header: 'Hora Check-in', key: 'Hora', width: 22 }
    ];
    
    // Auto-filtros
    sheet.autoFilter = { reference: 'A1:H1' };
    
    sheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    rows.forEach((row, i) => {
        const dataRow = sheet.addRow(row);
        if (i % 2 === 0) {
            dataRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
            });
        }
        const asistioCell = dataRow.getCell('Asistio');
        if (asistioCell.value === 'SÍ') asistioCell.font = { bold: true, color: { argb: 'FF059669' } };
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CheckPro_Export_${req.params.eventId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// Check-in
router.post('/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'ORGANIZER']), (req, res) => {
    const gId = castId('guests', req.params.guestId);
    const guest = db.prepare("SELECT * FROM guests WHERE id = ?").get(gId);
    if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
    
    const targetDb = getEventDb(guest.event_id);
    const io = socketGetIO();
    
    if (guest.checked_in) {
        targetDb.prepare("UPDATE guests SET checked_in = 0, checkin_time = NULL WHERE id = ?").run(gId);
        if (io) io.to(guest.event_id).emit('update_stats', guest.event_id);
        
        // Trigger webhook for uncheck-in
        triggerWebhooks(WEBHOOK_EVENTS.GUEST_UNCHECKED_IN, {
            guest_id: guest.id,
            event_id: guest.event_id,
            name: guest.name,
            email: guest.email,
            checked_in: false,
            checkin_time: null
        }, guest.event_id).catch(err => console.error(`Error triggering webhook for guest ${guest.id}:`, err.message));
        
        // Send push notification to event organizers (optional)
        sendPushToEventUsers(guest.event_id, {
            title: 'Check-in revertido',
            body: `${guest.name} ha sido marcado como no presente.`,
            icon: '/icon-192.png',
            data: { url: `/events/${guest.event_id}/guests` },
            tag: 'guest-uncheckin'
        }).catch(err => console.error(`Error sending push notification for guest ${guest.id}:`, err.message));
        
        logChange(guest.event_id, 'guest', guest.id, 'unchecked_in', 'checked_in', '1', '0', req.userId);
        
        return res.json({ success: true, action: 'uncheckin' });
    }
    
    const currentStatus = guest.status || 'lead';
    targetDb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ?, status = 'attended' WHERE id = ?").run(new Date().toISOString(), gId);
    if (currentStatus !== 'attended') {
        targetDb.prepare("INSERT INTO guest_status_log (guest_id, event_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?, ?)").run(
            gId, guest.event_id, currentStatus, 'attended', req.userId
        );
    }
    if (io) {
        io.to(guest.event_id).emit('update_stats', guest.event_id);
        io.to(guest.event_id).emit('live_checkin', { name: guest.name, id: guest.id, event_id: guest.event_id });
    }
    
    // Trigger webhook for check-in
    triggerWebhooks(WEBHOOK_EVENTS.GUEST_CHECKED_IN, {
        guest_id: guest.id,
        event_id: guest.event_id,
        name: guest.name,
        email: guest.email,
        checked_in: true,
        checkin_time: new Date().toISOString()
    }, guest.event_id).catch(err => console.error(`Error triggering webhook for guest ${guest.id}:`, err.message));
    
    // Send push notification to event organizers
    sendPushToEventUsers(guest.event_id, {
        title: '¡Nuevo check-in!',
        body: `${guest.name} ha llegado al evento.`,
        icon: '/icon-192.png',
        data: { url: `/events/${guest.event_id}/guests` },
        tag: 'guest-checkin'
    }).catch(err => console.error(`Error sending push notification for guest ${guest.id}:`, err.message));
    
    logChange(guest.event_id, 'guest', guest.id, 'checked_in', 'checked_in', '0', '1', req.userId);
    
    res.json({ success: true, action: 'checkin' });
});

// Limpiar base de datos de evento
router.post('/clear/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const targetDb = getEventConnection(eId) || db;
    targetDb.prepare("DELETE FROM guests WHERE event_id = ?").run(eId);
    res.json({ success: true });
});

// Cambiar estado de invitado (Pipeline)
router.patch('/:eventId/guest-status/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'ORGANIZER']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const gId = castId('guests', req.params.guestId);
        const { status, notes } = req.body;
        
        const validStatuses = ['lead', 'contacted', 'confirmed', 'attended', 'not_interested'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Estado invalido. Validos: ' + validStatuses.join(', ') });
        }
        
        const targetDb = getEventConnection(eId) || db;
        const guest = targetDb.prepare("SELECT * FROM guests WHERE id = ? AND event_id = ?").get(gId, eId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        
        const fromStatus = guest.status || 'lead';
        
        targetDb.prepare("UPDATE guests SET status = ? WHERE id = ?").run(status, gId);
        
        targetDb.prepare("INSERT INTO guest_status_log (guest_id, event_id, from_status, to_status, changed_by, notes) VALUES (?, ?, ?, ?, ?, ?)").run(
            gId, eId, fromStatus, status, req.userId, notes || null
        );
        
        logChange(eId, 'guest', gId, 'status_changed', 'status', fromStatus, status, req.userId);
        
        const io = socketGetIO();
        if (io) io.to(eId).emit('update_stats', eId);
        
        res.json({ success: true, fromStatus, toStatus: status });
    } catch (err) {
        console.error('[PIPELINE] Error cambiando estado:', err.message);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
});

// Obtener resumen del pipeline (conteo por estado)
router.get('/:eventId/pipeline', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        
        const targetDb = getEventConnection(eId) || db;
        
        const counts = targetDb.prepare(`
            SELECT status, COUNT(*) as count FROM guests WHERE event_id = ? GROUP BY status
        `).all(eId);
        
        const defaultStatuses = ['lead', 'contacted', 'confirmed', 'attended', 'not_interested'];
        const pipeline = defaultStatuses.map(s => ({
            status: s,
            count: 0,
            label: s === 'lead' ? 'Lead' : s === 'contacted' ? 'Contactado' : s === 'confirmed' ? 'Confirmado' : s === 'attended' ? 'Asistió' : 'No interesado'
        }));
        
        counts.forEach(c => {
            const found = pipeline.find(p => p.status === c.status);
            if (found) found.count = c.count;
        });
        
        const total = pipeline.reduce((a, p) => a + p.count, 0);
        
        res.json({ pipeline, total });
    } catch (err) {
        console.error('[PIPELINE] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener pipeline' });
    }
});

// ── CRUD Categorias de Invitados ──

router.get('/:eventId/categories', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        const cats = targetDb.prepare("SELECT * FROM guest_categories WHERE event_id = ? ORDER BY sort_order ASC, name ASC").all(eId);
        res.json(cats);
    } catch (err) {
        console.error('[CATEGORIES] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
});

router.post('/:eventId/categories', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { name, color, capacity, sort_order, price } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const targetDb = getEventDb(eId);
        targetDb.prepare("INSERT INTO guest_categories (id, event_id, name, color, capacity, sort_order, price) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
            id, eId, name.trim(), color || '#64748b', capacity || 0, sort_order || 0, price || 0
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('[CATEGORIES] Error:', err.message);
        res.status(500).json({ error: 'Error al crear categoria' });
    }
});

router.put('/:eventId/categories/:catId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const catId = req.params.catId;
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { name, color, capacity, sort_order, price } = req.body;
        const targetDb = getEventDb(eId);
        targetDb.prepare("UPDATE guest_categories SET name = COALESCE(?, name), color = COALESCE(?, color), capacity = COALESCE(?, capacity), sort_order = COALESCE(?, sort_order), price = COALESCE(?, price) WHERE id = ? AND event_id = ?").run(
            name || null, color || null, capacity != null ? capacity : null, sort_order != null ? sort_order : null, price != null ? price : null, catId, eId
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[CATEGORIES] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar categoria' });
    }
});

router.delete('/:eventId/categories/:catId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const catId = req.params.catId;
        const targetDb = getEventDb(eId);
        targetDb.prepare("UPDATE guests SET category_id = NULL WHERE category_id = ? AND event_id = ?").run(catId, eId);
        targetDb.prepare("DELETE FROM guest_categories WHERE id = ? AND event_id = ?").run(catId, eId);
        res.json({ success: true });
    } catch (err) {
        console.error('[CATEGORIES] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar categoria' });
    }
});

// Cambiar categoria de un invitado
router.patch('/:eventId/guest-category/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'ORGANIZER']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const gId = castId('guests', req.params.guestId);
        const { category_id } = req.body;
        const targetDb = getEventDb(eId);
        const oldGuest = targetDb.prepare("SELECT category_id FROM guests WHERE id = ? AND event_id = ?").get(gId, eId);
        targetDb.prepare("UPDATE guests SET category_id = ? WHERE id = ? AND event_id = ?").run(category_id || null, gId, eId);
        logChange(eId, 'guest', gId, 'category_changed', 'category_id', oldGuest ? oldGuest.category_id : '', category_id, req.userId);
        res.json({ success: true });
    } catch (err) {
        console.error('[CATEGORIES] Error:', err.message);
        res.status(500).json({ error: 'Error al cambiar categoria' });
    }
});

// GET /:eventId/availability - Cupos disponibles por categoria
router.get('/:eventId/availability', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        const cats = targetDb.prepare("SELECT * FROM guest_categories WHERE event_id = ? ORDER BY sort_order ASC").all(eId);
        const categories = cats.map(function(c) {
            const active = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND category_id = ? AND (status IS NULL OR status != 'waitlisted')").get(eId, c.id);
            const waitlisted = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND category_id = ? AND status = 'waitlisted'").get(eId, c.id);
            return { id: c.id, name: c.name, capacity: c.capacity, active: active.c, remaining: Math.max(0, c.capacity - active.c), waitlist: waitlisted.c };
        });
        const totalActive = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND (status IS NULL OR status != 'waitlisted')").get(eId);
        const totalWaitlist = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND status = 'waitlisted'").get(eId);
        res.json({ categories, totalActive: totalActive.c, totalWaitlist: totalWaitlist.c });
    } catch (err) {
        console.error('[AVAILABILITY] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener disponibilidad' });
    }
});

// PDF: Descargar gafetes (badges) con QR
router.get('/:eventId/badges', authMiddleware(), async (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });

        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const targetDb = getEventDb(eId);
        const guests = targetDb.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);

        const { jsPDF } = require('jspdf');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pageW = 210;
        const margin = 10;
        const cols = 2;
        const rows = 3;
        const cardW = (pageW - margin * 3) / cols;
        const cardH = 85;

        for (let i = 0; i < guests.length; i++) {
            const g = guests[i];
            if (i > 0 && i % (cols * rows) === 0) doc.addPage();

            const pos = i % (cols * rows);
            const col = pos % cols;
            const row = Math.floor(pos / cols);
            const x = margin + col * (cardW + margin);
            const y = margin + row * (cardH + margin);

            // Borde de la tarjeta
            doc.setDrawColor(124, 58, 237);
            doc.setLineWidth(0.5);
            doc.rect(x, y, cardW, cardH);

            // Nombre del evento
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(event.name || '', x + 3, y + 6);

            // Nombre del invitado
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(g.name || 'Sin nombre', x + 3, y + 18);

            // Organizacion
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.text(g.organization || '', x + 3, y + 26);

            // QR
            if (g.qr_token) {
                try {
                    const qrDataUrl = await QRCode.toDataURL(g.qr_token, { width: 80, margin: 1 });
                    doc.addImage(qrDataUrl, 'PNG', x + cardW - 45, y + 25, 40, 40);
                } catch (_) {}
            }

            // Pie
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text('Check Pro', x + 3, y + cardH - 3);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Gafetes_${event.name.replace(/\s+/g, '_')}.pdf`);
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        console.error('[BADGES] Error:', err.message);
        res.status(500).json({ error: 'Error generando gafetes' });
    }
});

// ZPL: Gafetes para impresoras térmicas Zebra (C11-02)
router.get('/:eventId/badges/zpl', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        const targetDb = getEventDb(eId);
        var guests = targetDb.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
        // Filtrar solo checked_in si se solicita
        if (req.query.checked_in === '1') guests = guests.filter(function(g) { return g.checked_in === 1; });
        // Ancho etiqueta: 90mm (aprox 850 dots a 203dpi)
        var labelW = parseInt(req.query.width) || 850;
        var labelH = parseInt(req.query.height) || 550;
        var zpl = '^XA\n';
        zpl += '^CF0,30\n';
        zpl += '^FO30,30^FD' + escZpl(event.name || 'Evento') + '^FS\n';
        zpl += '^CF0,50\n';
        guests.forEach(function(g, i) {
            if (i > 0) zpl += '^XZ\n^XA\n';
            zpl += '^FO30,80^FD' + escZpl(g.name || '') + '^FS\n';
            zpl += '^CF0,25\n';
            if (g.organization) zpl += '^FO30,140^FD' + escZpl(g.organization) + '^FS\n';
            if (g.qr_token) {
                zpl += '^FO' + (labelW - 200) + ',30^BQN,2,5^FDQA,' + g.qr_token + '^FS\n';
                zpl += '^FO' + (labelW - 200) + ',30^BQN,2,5^FDMA,' + g.qr_token + '^FS\n';
            }
        });
        zpl += '^XZ\n';
        res.setHeader('Content-Type', 'application/x-zebra-zpl');
        res.setHeader('Content-Disposition', 'attachment; filename=gafetes_' + eId.slice(0, 8) + '.zpl');
        res.send(zpl);
    } catch (err) {
        console.error('[ZPL] Error:', err.message);
        res.status(500).json({ error: 'Error generando ZPL' });
    }
});
function escZpl(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\^/g, '').replace(/~/g, ''); }

// ESC/POS: Gafetes para impresoras térmicas Brother/Epson (C11-02)
router.get('/:eventId/badges/escpos', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        var guests = targetDb.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
        if (req.query.checked_in === '1') guests = guests.filter(function(g) { return g.checked_in === 1; });
        var lines = [];
        guests.forEach(function(g) {
            lines.push('');
            lines.push('================================');
            lines.push('  ' + (g.name || ''));
            lines.push('  ' + (g.organization || ''));
            if (g.qr_token) lines.push('  QR: ' + g.qr_token);
            lines.push('================================');
            lines.push('');
        });
        var text = lines.join('\n');
        // ESC/POS: Initialize printer, set font, print text, cut
        var escpos = Buffer.concat([
            Buffer.from([0x1B, 0x40]), // Initialize
            Buffer.from(text, 'ascii'),
            Buffer.from([0x1B, 0x64, 0x03]), // Feed 3 lines
            Buffer.from([0x1D, 0x56, 0x41, 0x00]), // Full cut
        ]);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=gafetes_' + eId.slice(0, 8) + '.bin');
        res.send(escpos);
    } catch (err) {
        console.error('[ESCPOS] Error:', err.message);
        res.status(500).json({ error: 'Error generando ESC/POS' });
    }
});

// PDF: Reporte del evento
router.get('/:eventId/report', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });

        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const targetDb = getEventDb(eId);
        const guests = targetDb.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);

        const total = guests.length;
        const checkedIn = guests.filter(g => g.checked_in).length;
        const conversionRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
        const orgs = [...new Set(guests.map(g => g.organization).filter(Boolean))].length;

        const { jsPDF } = require('jspdf');
        const autoTable = require('jspdf-autotable').default;
        const doc = new jsPDF();

        // Portada
        doc.setFontSize(22);
        doc.setTextColor(124, 58, 237);
        doc.text('Reporte del Evento', 14, 30);
        doc.setFontSize(12);
        doc.setTextColor(60);
        doc.text(event.name || 'Sin nombre', 14, 40);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 48);

        // KPIs
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Resumen', 14, 68);

        const kpiData = [
            ['Total invitados', String(total)],
            ['Check-ins', String(checkedIn)],
            ['Pendientes', String(total - checkedIn)],
            ['Tasa de conversion', conversionRate + '%'],
            ['Organizaciones', String(orgs)]
        ];

        autoTable(doc, {
            startY: 74,
            head: [['Metrica', 'Valor']],
            body: kpiData,
            theme: 'grid',
            headStyles: { fillColor: [124, 58, 237] }
        });

        // Lista de invitados
        if (guests.length > 0) {
            if (doc.lastAutoTable.finalY + 20 > 250) doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(0);
            doc.text('Invitados', 14, (doc.lastAutoTable?.finalY || 74) + 20);

            autoTable(doc, {
                startY: (doc.lastAutoTable?.finalY || 74) + 26,
                head: [['Nombre', 'Email', 'Organizacion', 'Estado', 'Asistio']],
                body: guests.map(g => [
                    g.name || '-',
                    g.email || '-',
                    g.organization || '-',
                    g.status || 'lead',
                    g.checked_in ? 'Si' : 'No'
                ]),
                theme: 'striped',
                headStyles: { fillColor: [124, 58, 237] },
                styles: { fontSize: 8 }
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_${event.name.replace(/\s+/g, '_')}.pdf`);
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        console.error('[REPORT] Error:', err.message);
        res.status(500).json({ error: 'Error generando reporte' });
    }
});

// ─── Networking directory (C5-05) ───
router.get('/:eventId/network', (req, res) => {
    try {
        var guests = db.prepare("SELECT id, name, email, organization, position, bio, interests, social_linkedin, photo_url FROM guests WHERE event_id = ? AND (bio IS NOT NULL AND bio != '') ORDER BY name ASC").all(req.params.eventId);
        res.json(guests);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:eventId/guests/:guestId/profile', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { bio, interests, social_linkedin, photo_url } = req.body;
        const old = db.prepare("SELECT bio, interests, social_linkedin, photo_url FROM guests WHERE id = ?").get(req.params.guestId);
        db.prepare("UPDATE guests SET bio = COALESCE(?, bio), interests = COALESCE(?, interests), social_linkedin = COALESCE(?, social_linkedin), photo_url = COALESCE(?, photo_url) WHERE id = ?").run(
            bio || null, interests || null, social_linkedin || null, photo_url || null, req.params.guestId
        );
        if (old && req.params.eventId) {
            if (bio !== undefined && bio !== old.bio) logChange(req.params.eventId, 'guest', req.params.guestId, 'profile_updated', 'bio', old.bio, bio, req.userId);
            if (interests !== undefined && interests !== old.interests) logChange(req.params.eventId, 'guest', req.params.guestId, 'profile_updated', 'interests', old.interests, interests, req.userId);
            if (social_linkedin !== undefined && social_linkedin !== old.social_linkedin) logChange(req.params.eventId, 'guest', req.params.guestId, 'profile_updated', 'social_linkedin', old.social_linkedin, social_linkedin, req.userId);
        }
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Gamification (C5-06) ───
router.get('/:eventId/achievements/:guestId', (req, res) => {
    try {
        var achievements = db.prepare("SELECT * FROM guest_achievements WHERE guest_id = ? AND event_id = ? ORDER BY awarded_at DESC").all(req.params.guestId, req.params.eventId);
        res.json(achievements);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/:eventId/achievements/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { achievement } = req.body;
        if (!achievement) return res.status(400).json({ error: 'Achievement requerido' });
        var id = require('uuid').v4();
        db.prepare("INSERT INTO guest_achievements (id, guest_id, event_id, achievement) VALUES (?, ?, ?, ?)").run(id, req.params.guestId, req.params.eventId, achievement);
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Social Media auto-publish (C5-08) ───
router.post('/:eventId/social-publish', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        var event = db.prepare("SELECT id, name, date, location, description FROM events WHERE id = ?").get(req.params.eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        var message = '📢 ' + event.name + ' - ' + new Date(event.date).toLocaleDateString('es-ES');
        if (event.location) message += '\n📍 ' + event.location;
        if (event.description) message += '\n\n' + event.description.slice(0, 200);
        message += '\n\nRegístrate aquí: ' + (req.headers.origin || '') + '/registro.html?event=' + event.id;

        // Twitter/X
        var twitterResult = null;
        try {
            var twToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'twitter_token'").get();
            if (twToken) {
                var twRes = await fetch('https://api.twitter.com/2/tweets', { method: 'POST', headers: { 'Authorization': 'Bearer ' + twToken.setting_value, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message.slice(0, 280) }) });
                twitterResult = twRes.ok ? 'published' : 'error';
            }
        } catch(e) { twitterResult = 'error'; }

        // LinkedIn
        var linkedinResult = null;
        try {
            var liToken = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'linkedin_token'").get();
            if (liToken) {
                var liRes = await fetch('https://api.linkedin.com/v2/ugcPosts', { method: 'POST', headers: { 'Authorization': 'Bearer ' + liToken.setting_value, 'Content-Type': 'application/json' }, body: JSON.stringify({ author: 'urn:li:person:me', lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: message }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } }) });
                linkedinResult = liRes.ok ? 'published' : 'error';
            }
        } catch(e) { linkedinResult = 'error'; }

        res.json({ success: true, twitter: twitterResult, linkedin: linkedinResult, message: message });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── GDPR: Export guest data (C6-18) ───
// DEPRECATED: Usar /api/compliance/events/:eventId/guests/:guestId/export
router.get('/:eventId/guests/:guestId/export', (req, res) => {
    try {
        var guest = db.prepare("SELECT * FROM guests WHERE id = ? AND event_id = ?").get(req.params.guestId, req.params.eventId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        var achievements = db.prepare("SELECT * FROM guest_achievements WHERE guest_id = ?").all(req.params.guestId);
        res.json({ personalData: guest, achievements: achievements, exportDate: new Date().toISOString(), generatedBy: 'Check Pro GDPR' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DEPRECATED: Usar /api/compliance/events/:eventId/guests/:guestId/personal-data
router.delete('/:eventId/guests/:guestId/erase', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM guest_achievements WHERE guest_id = ?").run(req.params.guestId);
        db.prepare("DELETE FROM guests WHERE id = ? AND event_id = ?").run(req.params.guestId, req.params.eventId);
        res.json({ success: true, message: 'Datos eliminados conforme a GDPR' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Presence (C6-07) ───
router.post('/:eventId/presence', authMiddleware(), (req, res) => {
    try {
        var key = 'presence_' + req.params.eventId;
        var now = Date.now();
        var existing = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get(key);
        var users = existing ? JSON.parse(existing.setting_value) : {};
        users[req.userId] = now;
        // Clean stale entries (>30s)
        Object.keys(users).forEach(function(u) { if (users[u] < now - 30000) delete users[u]; });
        var upsert = function(k, v) { var e = db.prepare("SELECT setting_key FROM settings WHERE setting_key = ?").get(k); if (e) db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(v, k); else db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)").run(k, v); };
        upsert(key, JSON.stringify(users));
        res.json({ online: Object.keys(users).length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /:eventId/editors — Obtener editores activos (C6-05)
router.get('/:eventId/editors', authMiddleware(), (req, res) => {
    try {
        const { getActiveEditors } = require('../socket');
        res.json({ editors: getActiveEditors(req.params.eventId) || [] });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.tempImport = tempImport;
