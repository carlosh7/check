/**
 * Rutas de Invitados e Importación/Exportación
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

// Obtener invitados de evento (con paginación)
router.get('/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let whereClause = 'event_id = ?';
    let params = [eId];

    if (search) {
        whereClause += " AND (name LIKE ? OR email LIKE ? OR organization LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM guests WHERE ${whereClause}`).get(...params).count;
    const rows = db.prepare(`SELECT * FROM guests WHERE ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);

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
    const session = tempImport[req.userId];
    if (!session || !require('fs').existsSync(session.filePath)) {
        return res.status(400).json({ error: 'Sesión expirada' });
    }
    
    const fs = require('fs');
    const pdfParse = require('pdf-parse');
    const ExcelJS = require('exceljs');
    
    const { mapping, event_id } = req.body;
    const eId = castId('events', event_id);
    const guests = [];

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

        const existing = db.prepare("SELECT email, phone FROM guests WHERE event_id = ?").all(eId);
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

        const insertGuest = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, dietary_notes, position, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const insertedGuests = [];
        const insertMany = db.transaction((list) => {
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
    const rows = db.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?").all(eId);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Check Pro V10';
    const sheet = workbook.addWorksheet('Invitados', { views: [{ state: 'frozen', ySplit: 1 }] });
    
    sheet.columns = [
        { header: 'Nombre', key: 'Nombre', width: 30 },
        { header: 'Email', key: 'Email', width: 35 },
        { header: 'Organización', key: 'Organizacion', width: 30 },
        { header: 'Teléfono', key: 'Telefono', width: 18 },
        { header: 'Género', key: 'Genero', width: 10 },
        { header: 'Asistió', key: 'Asistio', width: 12 },
        { header: 'Hora Check-in', key: 'Hora', width: 22 }
    ];
    
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
router.post('/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const gId = castId('guests', req.params.guestId);
    const guest = db.prepare("SELECT * FROM guests WHERE id = ?").get(gId);
    if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
    
    const io = socketGetIO();
    
    if (guest.checked_in) {
        db.prepare("UPDATE guests SET checked_in = 0, checkin_time = NULL WHERE id = ?").run(gId);
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
        
        return res.json({ success: true, action: 'uncheckin' });
    }
    
    db.prepare("UPDATE guests SET checked_in = 1, checkin_time = ? WHERE id = ?").run(new Date().toISOString(), gId);
    if (io) io.to(guest.event_id).emit('update_stats', guest.event_id);
    
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
    
    res.json({ success: true, action: 'checkin' });
});

// Limpiar base de datos de evento
router.post('/clear/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    db.prepare("DELETE FROM guests WHERE event_id = ?").run(eId);
    res.json({ success: true });
});

module.exports = router;
module.exports.tempImport = tempImport;
