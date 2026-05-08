/**
 * Rutas de Invitados e Importación/Exportación
 */

const express = require('express');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getIO: socketGetIO } = require('../socket');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { sendPushToEventUsers } = require('./push.routes');
const QRCode = require('qrcode');

const router = express.Router();

let tempImport = {};

// Función helper para obtener la BD correcta según el evento
function getEventDb(eventId) {
    console.log('[GET-EVENT-DB guests] ========== INICIO ==========');
    console.log('[GET-EVENT-DB guests] eventId:', eventId);
    
    if (!eventId) {
        console.log('[GET-EVENT-DB guests] eventId es null, retorno DB sistema');
        return db;
    }
    
    const event = db.prepare("SELECT id, has_own_db, name FROM events WHERE id = ?").get(eventId);
    console.log('[GET-EVENT-DB guests] Evento encontrado:', event);
    
    if (!event) {
        console.log('[GET-EVENT-DB guests] Evento no encontrado, retorno DB sistema');
        return db;
    }
    
    console.log('[GET-EVENT-DB guests] has_own_db:', event.has_own_db, 'exists:', eventDatabaseExists(eventId));
    
    if (event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        const eventDb = getEventConnection(eventId);
        console.log('[GET-EVENT-DB guests] retorneando DB EVENTO:', eventDb ? 'SI' : 'NO');
        if (eventDb) return eventDb;
    }
    
    console.log('[GET-EVENT-DB guests] retorno DB sistema');
    return db;
}

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
    const rows = targetDb.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?").all(eId);
    
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
        
        return res.json({ success: true, action: 'uncheckin' });
    }
    
    const currentStatus = guest.status || 'lead';
    targetDb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ?, status = 'attended' WHERE id = ?").run(new Date().toISOString(), gId);
    if (currentStatus !== 'attended') {
        targetDb.prepare("INSERT INTO guest_status_log (guest_id, event_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?, ?)").run(
            gId, guest.event_id, currentStatus, 'attended', req.userId
        );
    }
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
router.post('/clear/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const targetDb = getEventConnection(eId) || db;
    targetDb.prepare("DELETE FROM guests WHERE event_id = ?").run(eId);
    res.json({ success: true });
});

// Cambiar estado de invitado (Pipeline)
router.patch('/:eventId/guest-status/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
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

module.exports = router;
module.exports.tempImport = tempImport;
