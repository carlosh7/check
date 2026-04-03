/**
 * Rutas de Importación y Exportación de Datos
 * V12.44.38 - Sistema de importación/exportación Excel y PDF
 */

const express = require('express');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const jsPDF = require('jspdf');
require('jspdf-autotable').default;

const router = express.Router();

// ══════════════════════════════════════════════════════════════
// DESCARGAR PLANTILLA DE IMPORTACIÓN
// ══════════════════════════════════════════════════════════════
router.get('/template', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Check Pro';
        workbook.created = new Date();

        // ─── HOJA 1: EMPRESAS ───
        const groupsSheet = workbook.addWorksheet('Empresas');
        groupsSheet.columns = [
            { header: 'Nombre', key: 'name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Teléfono', key: 'phone', width: 20 },
            { header: 'Estado', key: 'status', width: 15 },
            { header: 'Descripción', key: 'description', width: 40 }
        ];
        
        // Fila de ejemplo
        groupsSheet.addRow({
            name: 'Mi Empresa S.A.S',
            email: 'contacto@miempresa.com',
            phone: '+57 300 123 4567',
            status: 'ACTIVE',
            description: 'Empresa de example'
        });

        // Estilo header
        groupsSheet.getRow(1).font = { bold: true };
        groupsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7c3aed' } };
        groupsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // ─── HOJA 2: EVENTOS ───
        const eventsSheet = workbook.addWorksheet('Eventos');
        eventsSheet.columns = [
            { header: 'Nombre', key: 'name', width: 30 },
            { header: 'Fecha', key: 'date', width: 20 },
            { header: 'Ubicación', key: 'location', width: 30 },
            { header: 'Descripción', key: 'description', width: 40 },
            { header: 'Empresa_ID', key: 'group_id', width: 20 }
        ];
        
        eventsSheet.addRow({
            name: 'Mi Evento 2024',
            date: '2024-12-31',
            location: 'Bogotá, Colombia',
            description: 'Evento de example',
            group_id: ''
        });

        eventsSheet.getRow(1).font = { bold: true };
        eventsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
        eventsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // ─── HOJA 3: STAFF ───
        const staffSheet = workbook.addWorksheet('Staff');
        staffSheet.columns = [
            { header: 'Nombre', key: 'display_name', width: 25 },
            { header: 'Email', key: 'username', width: 30 },
            { header: 'Contraseña', key: 'password', width: 20 },
            { header: 'Rol', key: 'role', width: 15 },
            { header: 'Teléfono', key: 'phone', width: 20 },
            { header: 'Empresa_ID', key: 'group_id', width: 20 }
        ];
        
        staffSheet.addRow({
            display_name: 'Juan Pérez',
            username: 'juan@empresa.com',
            password: 'clave123',
            role: 'STAFF',
            phone: '+57 300 987 6543',
            group_id: ''
        });

        staffSheet.getRow(1).font = { bold: true };
        staffSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8b5cf6' } };
        staffSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=plantilla_importacion_check.xlsx');
        res.send(buffer);
    } catch(e) {
        console.error('Error generando plantilla:', e);
        res.status(500).json({ success: false, message: 'Error generando plantilla' });
    }
});

// ══════════════════════════════════════════════════════════════
// VALIDAR ARCHIVO DE IMPORTACIÓN
// ══════════════════════════════════════════════════════════════
router.post('/validate', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    // Manejar archivo como base64
    const { file, filename, type } = req.body;
    console.log('[IMPORT] file received, length:', file?.length, 'filename:', filename);
    if (!file) {
        return res.status(400).json({ success: false, message: 'No se envió archivo' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        // Decodificar base64 a buffer
        const buffer = Buffer.from(file, 'base64');
        console.log('[IMPORT] buffer created, size:', buffer.length);
        await workbook.xlsx.load(buffer);

        const stats = { new: 0, update: 0, errors: 0 };
        const errors = [];
        const data = { groups: [], events: [], users: [] };
        
        // Headers that indicate a header row (case insensitive)
        const headerValues = ['nombre', 'name', 'email', 'telefono', 'phone', 'estado', 'status', 'descripcion', 'description', 'ubicacion', 'location', 'fecha', 'date', 'display', 'username', 'rol', 'role', 'empresa', 'company'];

        // ─── PROCESAR EMPRESAS ───
        if (workbook.getWorksheet('Empresas')) {
            const sheet = workbook.getWorksheet('Empresas');
            const existingGroups = db.prepare("SELECT name, email FROM groups").all();
            
            sheet.eachRow({ skip: 1 }, (row, rowNumber) => {
                try {
                    const name = row.getCell(1).text?.trim();
                    if (!name) return;

                    // Skip header rows
                    const nameLower = (name || '').toLowerCase();
                    if (headerValues.includes(nameLower)) return;

                    const email = row.getCell(2).text?.trim() || '';
                    const phone = row.getCell(3).text?.trim() || '';
                    const status = row.getCell(4).text?.trim() || 'ACTIVE';
                    const description = row.getCell(5).text?.trim() || '';

                    // Verificar si existe
                    const exists = existingGroups.find(g => 
                        g.name.toLowerCase() === name.toLowerCase() || 
                        (g.email && g.email.toLowerCase() === email.toLowerCase())
                    );

                    if (exists) {
                        stats.update++;
                        data.groups.push({ name, email, phone, status, description, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.groups.push({ name, email, phone, status, description, action: 'create' });
                    }
                } catch(e) {
                    stats.errors++;
                    errors.push(`Fila ${rowNumber}: Error procesando empresa`);
                }
            });
        }

        // ─── PROCESAR EVENTOS ───
        if (workbook.getWorksheet('Eventos')) {
            const sheet = workbook.getWorksheet('Eventos');
            const existingEvents = db.prepare("SELECT name, date FROM events").all();
            
            sheet.eachRow({ skip: 1 }, (row, rowNumber) => {
                try {
                    const name = row.getCell(1).text?.trim();
                    if (!name) return;

                    // Skip header rows
                    const nameLower = (name || '').toLowerCase();
                    if (headerValues.includes(nameLower)) return;

                    const date = row.getCell(2).text?.trim() || '';
                    const location = row.getCell(3).text?.trim() || '';
                    const description = row.getCell(4).text?.trim() || '';
                    const group_id = row.getCell(5).text?.trim() || '';

                    const exists = existingEvents.find(e => 
                        e.name.toLowerCase() === name.toLowerCase() && e.date === date
                    );

                    if (exists) {
                        stats.update++;
                        data.events.push({ name, date, location, description, group_id, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.events.push({ name, date, location, description, group_id, action: 'create' });
                    }
                } catch(e) {
                    stats.errors++;
                    errors.push(`Fila ${rowNumber}: Error procesando evento`);
                }
            });
        }

        // ─── PROCESAR STAFF ───
        if (workbook.getWorksheet('Staff')) {
            const sheet = workbook.getWorksheet('Staff');
            const existingUsers = db.prepare("SELECT username FROM users").all();
            
            sheet.eachRow({ skip: 1 }, (row, rowNumber) => {
                try {
                    const display_name = row.getCell(1).text?.trim();
                    const username = row.getCell(2).text?.trim();
                    const password = row.getCell(3).text?.trim() || '';
                    const role = row.getCell(4).text?.trim() || 'STAFF';
                    const phone = row.getCell(5).text?.trim() || '';
                    const group_id = row.getCell(6).text?.trim() || '';

                    if (!username) return;
                    
                    // Skip header rows (check if any cell value looks like a header)
                    const firstCell = (display_name || '').toLowerCase();
                    const secondCell = (username || '').toLowerCase();
                    if (headerValues.includes(firstCell) || headerValues.includes(secondCell)) {
                        return; // Skip this row
                    }

                    const exists = existingUsers.find(u => u.username.toLowerCase() === username.toLowerCase());

                    if (exists) {
                        stats.update++;
                        data.users.push({ display_name, username, password, role, phone, group_id, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.users.push({ display_name, username, password, role, phone, group_id, action: 'create' });
                    }
                } catch(e) {
                    stats.errors++;
                    errors.push(`Fila ${rowNumber}: Error procesando staff`);
                }
            });
        }

        stats.message = `${stats.new} nuevos, ${stats.update} para actualizar, ${stats.errors} errores`;

        res.json({ success: true, data, stats, errors });
    } catch(e) {
        console.error('Error validando archivo:', e);
        res.status(500).json({ success: false, message: 'Error validando archivo: ' + e.message });
    }
});

// ══════════════════════════════════════════════════════════════
// EJECUTAR IMPORTACIÓN
// ══════════════════════════════════════════════════════════════
router.post('/execute', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log('[IMPORT EXECUTE] data received:', JSON.stringify(data).substring(0, 500));
        let imported = 0;
        let updated = 0;

        // Importar grupos
        if (data.groups && data.groups.length > 0) {
            console.log('[IMPORT] Processing groups:', data.groups.length);
            
            for (const g of data.groups) {
                console.log('[IMPORT] Group:', g.name, 'email:', g.email);
                
                // Buscar por nombre O email
                let existing = null;
                if (g.name) {
                    existing = db.prepare("SELECT id, name FROM groups WHERE LOWER(name) = LOWER(?)").get(g.name);
                }
                if (!existing && g.email) {
                    existing = db.prepare("SELECT id, name FROM groups WHERE email IS NOT NULL AND LOWER(email) = LOWER(?)").get(g.email);
                }
                
                if (existing) {
                    console.log('[IMPORT] Updating group:', existing.name, 'id:', existing.id);
                    db.prepare("UPDATE groups SET email = ?, phone = ?, status = ?, description = ? WHERE id = ?")
                        .run(g.email, g.phone, g.status, g.description, existing.id);
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new group:', g.name);
                    db.prepare("INSERT INTO groups (id, name, email, phone, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                        .run(getValidId('groups'), g.name, g.email, g.phone, g.status, g.description, new Date().toISOString());
                    imported++;
                }
            }
        }

        // Importar eventos
        if (data.events && data.events.length > 0) {
            console.log('[IMPORT] Processing events:', data.events.length);
            
            for (const e of data.events) {
                console.log('[IMPORT] Event:', e.name, 'date:', e.date);
                
                // Buscar por nombre Y fecha
                let existing = null;
                if (e.name && e.date) {
                    existing = db.prepare("SELECT id, name FROM events WHERE LOWER(name) = LOWER(?) AND date = ?").get(e.name, e.date);
                }
                
                if (existing) {
                    console.log('[IMPORT] Updating event:', existing.name);
                    db.prepare("UPDATE events SET location = ?, description = ?, group_id = ? WHERE id = ?")
                        .run(e.location, e.description, e.group_id || null, existing.id);
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new event:', e.name);
                    db.prepare("INSERT INTO events (id, user_id, name, date, location, description, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)")
                        .run(getValidId('events'), req.userId, e.name, e.date, e.location, e.description, e.group_id || null, new Date().toISOString());
                    imported++;
                }
            }
        }

        // Importar usuarios (Staff)
        if (data.users && data.users.length > 0) {
            console.log('[IMPORT] Processing users:', data.users.length);
            const bcrypt = require('bcryptjs');
            
            for (const u of data.users) {
                console.log('[IMPORT] User:', u.username, 'display_name:', u.display_name);
                
                // Buscar por username (email)
                let existing = null;
                if (u.username) {
                    existing = db.prepare("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)").get(u.username);
                }
                
                if (existing) {
                    console.log('[IMPORT] Updating user:', existing.username);
                    db.prepare("UPDATE users SET display_name = ?, phone = ?, role = ?, group_id = ? WHERE id = ?")
                        .run(u.display_name, u.phone, u.role, u.group_id || null, existing.id);
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new user:', u.username);
                    const hashedPassword = u.password ? await bcrypt.hash(u.password, 10) : await bcrypt.hash('check123', 10);
                    db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)")
                        .run(getValidId('users'), u.username, hashedPassword, u.role, u.display_name, u.phone, u.group_id || null, new Date().toISOString());
                    imported++;
                }
            }
        }

        console.log('[IMPORT] Result - imported:', imported, 'updated:', updated);
        res.json({ success: true, imported, updated });
    } catch(e) {
        console.error('Error ejecutando importación:', e);
        res.status(500).json({ success: false, message: 'Error en importación: ' + e.message });
    }
});

// ══════════════════════════════════════════════════════════════
// EXPORTAR DATOS
// ══════════════════════════════════════════════════════════════
router.get('/:type', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { type } = req.params;
    const format = req.query.format || 'excel';

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Check Pro';
        workbook.created = new Date();

        if (type === 'groups' || type === 'staff') {
            // ─── EXPORTAR GRUPOS/EMPRESAS (matching import template) ───
            const groupsSheet = workbook.addWorksheet('Empresas');
            groupsSheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 20 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Descripción', key: 'description', width: 40 }
            ];

            const groups = db.prepare("SELECT name, email, phone, status, description FROM groups ORDER BY created_at DESC").all();
            groupsSheet.addRows(groups);

            groupsSheet.getRow(1).font = { bold: true };
            groupsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7c3aed' } };
            groupsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

            // ─── EXPORTAR EVENTOS (matching import template) ───
            const eventsSheet = workbook.addWorksheet('Eventos');
            eventsSheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Fecha', key: 'date', width: 20 },
                { header: 'Ubicación', key: 'location', width: 30 },
                { header: 'Descripción', key: 'description', width: 40 },
                { header: 'Empresa_ID', key: 'group_id', width: 20 }
            ];

            const events = db.prepare("SELECT name, date, location, description, group_id FROM events ORDER BY created_at DESC").all();
            eventsSheet.addRows(events);

            eventsSheet.getRow(1).font = { bold: true };
            eventsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
            eventsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

            // ─── EXPORTAR USUARIOS (matching import template) ───
            const usersSheet = workbook.addWorksheet('Staff');
            usersSheet.columns = [
                { header: 'Nombre', key: 'display_name', width: 25 },
                { header: 'Email', key: 'username', width: 35 },
                { header: 'Password', key: 'password', width: 15 },
                { header: 'Rol', key: 'role', width: 15 },
                { header: 'Telefono', key: 'phone', width: 20 },
                { header: 'Empresa ID', key: 'group_id', width: 25 }
            ];

            const users = db.prepare("SELECT display_name, username, role, phone, group_id FROM users ORDER BY created_at DESC").all();
            // Add password column as empty (security - don't export passwords)
            usersSheet.addRows(users.map(u => ({ ...u, password: '' })));

            usersSheet.getRow(1).font = { bold: true };
            usersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8b5cf6' } };
            usersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }

        // Generar archivo según formato
        if (format === 'excel') {
            const buffer = await workbook.xlsx.writeBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=export_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
            res.send(buffer);
        } else {
            // PDF - Crear manualmente con jsPDF v4
            try {
                const { jsPDF } = require('jspdf');
                const autoTable = require('jspdf-autotable').default;
                
                const doc = new jsPDF();
                const groups = db.prepare("SELECT * FROM groups ORDER BY created_at DESC").all();
                const events = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
                const users = db.prepare("SELECT id, username, display_name, role, group_id, status, created_at FROM users ORDER BY created_at DESC").all();

                // Título
                doc.setFontSize(20);
                doc.setTextColor(124, 58, 237);
                doc.text('Reporte de Exportacion', 14, 20);
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);

                // Empresas
                let currentY = 40;
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.text('Empresas', 14, currentY);
                currentY += 10;
                
                if (groups.length > 0) {
                    autoTable(doc, {
                        startY: currentY,
                        head: [['Nombre', 'Email', 'Telefono', 'Estado']],
                        body: groups.map(g => [g.name || '-', g.email || '-', g.phone || '-', g.status || '-']),
                        theme: 'grid',
                        headStyles: { fillColor: [124, 58, 237] }
                    });
                    currentY = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(10);
                    doc.text('No hay empresas registradas', 14, currentY);
                    currentY += 15;
                }

                // Eventos - nueva pagina si es necesario
                if (currentY > 200) { doc.addPage(); currentY = 20; }
                doc.setFontSize(14);
                doc.text('Eventos', 14, currentY);
                currentY += 10;
                
                if (events.length > 0) {
                    autoTable(doc, {
                        startY: currentY,
                        head: [['Nombre', 'Fecha', 'Ubicacion', 'Estado']],
                        body: events.map(e => [e.name || '-', e.date || '-', e.location || '-', e.status || '-']),
                        theme: 'grid',
                        headStyles: { fillColor: [59, 130, 246] }
                    });
                    currentY = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(10);
                    doc.text('No hay eventos registrados', 14, currentY);
                    currentY += 15;
                }

                // Staff - nueva pagina si es necesario
                if (currentY > 200) { doc.addPage(); currentY = 20; }
                doc.setFontSize(14);
                doc.text('Staff', 14, currentY);
                currentY += 10;
                
                if (users.length > 0) {
                    autoTable(doc, {
                        startY: currentY,
                        head: [['Nombre', 'Email', 'Rol', 'Estado']],
                        body: users.map(u => [u.display_name || '-', u.username || '-', u.role || '-', u.status || '-']),
                        theme: 'grid',
                        headStyles: { fillColor: [139, 92, 246] }
                    });
                } else {
                    doc.setFontSize(10);
                    doc.text('No hay staff registrado', 14, currentY);
                }

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=export_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
                res.send(Buffer.from(doc.output('arraybuffer')));
            } catch(pdfError) {
                console.error('Error generando PDF:', pdfError);
                res.status(500).json({ success: false, message: 'Error generando PDF: ' + pdfError.message });
            }
        }
    } catch(e) {
        console.error('Error exportando:', e);
        res.status(500).json({ success: false, message: 'Error generando exportación' });
    }
});

module.exports = router;
