/**
 * Rutas de Importación y Exportación de Datos
 * V12.44.38 - Sistema de importación/exportación Excel y PDF
 */

const express = require('express');
const { db, getEventConnection, createEventDatabase } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Importación condicional de jspdf (puede no estar disponible)
let jsPDF = null;
let autoTable = null;
try {
    jsPDF = require('jspdf');
    autoTable = require('jspdf-autotable').default;
} catch (e) {
    console.warn('⚠️ jspdf/jspdf-autotable no disponible. Export PDF deshabilitado.');
}

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
            { header: 'Empresa', key: 'company_name', width: 25 }
        ];
        
        eventsSheet.addRow({
            name: 'Mi Evento 2024',
            date: '2024-12-31',
            location: 'Bogotá, Colombia',
            description: 'Evento de example',
            company_name: 'Mi Empresa S.A.S'
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
            { header: 'Empresa', key: 'company_name', width: 25 },
            { header: 'Evento', key: 'event_name', width: 25 }
        ];
        
        staffSheet.addRow({
            display_name: 'Juan Pérez',
            username: 'juan@empresa.com',
            password: 'clave123',
            role: 'STAFF',
            phone: '+57 300 987 6543',
            company_name: 'Mi Empresa S.A.S',
            event_name: 'Mi Evento 2024'
        });

        staffSheet.getRow(1).font = { bold: true };
        staffSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8b5cf6' } };
        staffSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // ─── HOJA 4: CLIENTES ───
        const clientsSheet = workbook.addWorksheet('Clientes');
        clientsSheet.columns = [
            { header: 'Nombre', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Teléfono', key: 'phone', width: 20 },
            { header: 'Empresa', key: 'company_name', width: 25 },
            { header: 'Evento', key: 'event_name', width: 25 }
        ];
        
        clientsSheet.addRow({
            name: 'Cliente Ejemplo',
            email: 'cliente@ejemplo.com',
            phone: '+57 300 111 2222',
            company_name: 'Mi Empresa S.A.S',
            event_name: 'Mi Evento 2024'
        });

        clientsSheet.getRow(1).font = { bold: true };
        clientsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10b981' } };
        clientsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

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

// DESCARGAR PLANTILLA DE ASISTENTES
router.get('/template/attendance', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Check Pro';
        workbook.created = new Date();

        const attendanceSheet = workbook.addWorksheet('Asistentes');
        attendanceSheet.columns = [
            { header: 'Nombre', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Teléfono', key: 'phone', width: 15 },
            { header: 'Organización', key: 'organization', width: 20 },
            { header: 'Cargo', key: 'cargo', width: 20 },
            { header: 'Vegano', key: 'vegano', width: 10 },
            { header: 'Restricciones', key: 'restricciones', width: 25 }
        ];
        
        // Fila de ejemplo
        attendanceSheet.addRow({
            name: 'Ejemplo Nombre',
            email: 'ejemplo@email.com',
            phone: '+52 123 456 7890',
            organization: 'Empresa S.A.',
            cargo: 'Gerente',
            vegano: 'NO',
            restricciones: ''
        });

        // Estilo header
        attendanceSheet.getRow(1).font = { bold: true };
        attendanceSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366f1' } };
        attendanceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=plantilla_asistentes.xlsx');
        res.send(buffer);
    } catch(e) {
        console.error('Error generando plantilla de asistentes:', e);
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
        const data = { groups: [], events: [], users: [], clients: [] };
        
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
                    const group_name = row.getCell(5).text?.trim() || '';

                    const exists = existingEvents.find(e => 
                        e.name.toLowerCase() === name.toLowerCase() && e.date === date
                    );

                    if (exists) {
                        stats.update++;
                        data.events.push({ name, date, location, description, group_name, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.events.push({ name, date, location, description, group_name, action: 'create' });
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
                    const company_name = row.getCell(6).text?.trim() || '';
                    const event_name = row.getCell(7).text?.trim() || '';

                    if (!username) return;
                    
                    // Skip header rows
                    const firstCell = (display_name || '').toLowerCase();
                    const secondCell = (username || '').toLowerCase();
                    if (headerValues.includes(firstCell) || headerValues.includes(secondCell)) {
                        return;
                    }

                    // No resolver nombres aquí - el execute lo hará con los mapas
                    const exists = existingUsers.find(u => u.username.toLowerCase() === username.toLowerCase());

                    if (exists) {
                        stats.update++;
                        data.users.push({ display_name, username, password, role, phone, company_name, event_name, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.users.push({ display_name, username, password, role, phone, company_name, event_name, action: 'create' });
                    }
                } catch(e) {
                    stats.errors++;
                    errors.push(`Fila ${rowNumber}: Error procesando staff`);
                }
            });
        }

        // ─── PROCESAR CLIENTES ───
        if (workbook.getWorksheet('Clientes')) {
            const sheet = workbook.getWorksheet('Clientes');
            const existingClients = db.prepare("SELECT name, email FROM clients").all();
            
            sheet.eachRow({ skip: 1 }, (row, rowNumber) => {
                try {
                    const name = row.getCell(1).text?.trim();
                    const email = row.getCell(2).text?.trim();
                    const phone = row.getCell(3).text?.trim() || '';
                    const company_name = row.getCell(4).text?.trim() || '';
                    const event_name = row.getCell(5).text?.trim() || '';

                    if (!name && !email) return;
                    
                    // Skip header rows
                    const firstCell = (name || '').toLowerCase();
                    const secondCell = (email || '').toLowerCase();
                    if (headerValues.includes(firstCell) || headerValues.includes(secondCell)) {
                        return;
                    }

                    const exists = existingClients.find(c => 
                        (c.name && c.name.toLowerCase() === name.toLowerCase()) ||
                        (c.email && c.email.toLowerCase() === email.toLowerCase())
                    );

                    if (exists) {
                        stats.update++;
                        data.clients.push({ name, email, phone, company_name, event_name, action: 'update', existing: exists });
                    } else {
                        stats.new++;
                        data.clients.push({ name, email, phone, company_name, event_name, action: 'create' });
                    }
                } catch(e) {
                    stats.errors++;
                    errors.push(`Fila ${rowNumber}: Error procesando cliente`);
                }
            });
        }

        stats.message = `${stats.new} nuevos, ${stats.update} para actualizar, ${stats.errors} errores`;

        // ─── PROCESAR ASISTENTES (type: attendance) ───
        if (type === 'attendance') {
            let availableColumns = [];
            let previewRows = [];
            let totalRows = 0;
            const eventId = castId('events', req.body.eventId);

            if (filename.toLowerCase().endsWith('.pdf')) {
                // Soporte PDF (Extracción básica de emails/nombres)
                try {
                    const pdfParse = require('pdf-parse');
                    const pdfData = await pdfParse(buffer);
                    const text = pdfData.text;
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
                    
                    availableColumns = ['Dato Detectado'];
                    previewRows = lines.slice(0, 10).map(l => ({ 'Dato Detectado': l }));
                    totalRows = lines.length;
                    
                    data.attendance = lines.map(line => ({ raw: line }));
                    stats.message = `PDF detectado: ${lines.length} líneas encontradas`;
                } catch (pdfErr) {
                    console.error('Error procesando PDF:', pdfErr);
                    throw new Error('No se pudo procesar el PDF');
                }
            } else {
                // Excel / XLSX
                const sheet = workbook.getWorksheet('Asistentes') || workbook.getWorksheet(1);
                if (!sheet) throw new Error('No se encontró una hoja válida en el Excel');

                // Obtener cabeceras (Fila 1)
                const headerRow = sheet.getRow(1);
                headerRow.eachCell((cell, colNumber) => {
                    availableColumns.push({
                        index: colNumber - 1,
                        name: cell.text?.trim() || `Columna ${colNumber}`
                    });
                });

                // Detectar columna de email automáticamente (V12.44.309) para conteo real
                let emailColIdx = -1;
                headerRow.eachCell((cell, colNumber) => {
                    const txt = (cell.text || '').toLowerCase();
                    if (txt.includes('email') || txt.includes('correo')) {
                        emailColIdx = colNumber - 1;
                    }
                });

                // Si no se encuentra por nombre, buscar por contenido en la segunda fila
                if (emailColIdx === -1) {
                    const secondRow = sheet.getRow(2);
                    secondRow.eachCell((cell, colNumber) => {
                        const val = cell.text || '';
                        if (val.includes('@') && val.includes('.')) {
                            emailColIdx = colNumber - 1;
                        }
                    });
                }

                // Cargar emails existentes del evento si hay emailColIdx
                const existingEmails = new Set();
                if (emailColIdx !== -1 && eventId) {
                    const targetDb = getEventConnection(eventId);
                    if (targetDb) {
                        const guests = targetDb.prepare("SELECT email FROM guests WHERE event_id = ?").all(eventId);
                        guests.forEach(g => {
                            if (g.email) existingEmails.add(g.email.toLowerCase().trim());
                        });
                    }
                }

                // Procesar todas las filas para estadísticas reales
                sheet.eachRow({ skip: 1 }, (row, rowNumber) => {
                    const vals = [];
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        vals[colNumber - 1] = cell.text?.trim() || '';
                    });
                    
                    if (rowNumber <= 11) { // 1 header + 10 rows
                        previewRows.push(vals);
                    }

                    if (emailColIdx !== -1) {
                        const email = (vals[emailColIdx] || '').toString().toLowerCase().trim();
                        if (email && email.includes('@')) {
                            if (existingEmails.has(email)) {
                                stats.update++;
                            } else {
                                stats.new++;
                            }
                        }
                    }

                    totalRows++;
                });

                stats.message = `Excel: ${totalRows} filas detectadas. (${stats.new} nuevos, ${stats.update} existentes)`;
            }

            return res.json({ 
                success: true, 
                data, 
                stats: { ...stats, totalRows }, 
                availableColumns, 
                previewRows,
                // allRows ELIMINADO para evitar error 500 en archivos grandes
                isMappingRequired: true 
            });
        }

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
        const { type } = req.body;
        const data = req.body.data || {}; // Protección contra undefined
        
        console.log('[IMPORT EXECUTE] Type:', type, 'Processing:', data.groups?.length || 0, 'groups,', data.events?.length || 0, 'events,', data.users?.length || 0, 'users');
        
        let imported = 0;
        let updated = 0;
        let duplicates = 0;
        
        // Mapas para resolver nombres a IDs durante esta importación
        const createdGroupsMap = {};  // nombre_lowercase -> id
        const createdEventsMap = {};  // nombre_lowercase -> id

        // ════════════════════════════════════════════════════════════
        // PASO 1: Importar/Crear GRUPOS/EMPRESAS primero
        // ════════════════════════════════════════════════════════════
        if (data.groups && data.groups.length > 0) {
            console.log('[IMPORT] Step 1 - Processing groups:', data.groups.length);
            
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
                    // Registrar en mapa para siguientes pasos
                    createdGroupsMap[g.name.trim().toLowerCase()] = existing.id;
                } else {
                    console.log('[IMPORT] Creating new group:', g.name);
                    const newId = getValidId('groups');
                    db.prepare("INSERT INTO groups (id, name, email, phone, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                        .run(newId, g.name, g.email, g.phone, g.status, g.description, new Date().toISOString());
                    imported++;
                    // Registrar en mapa para siguientes pasos
                    createdGroupsMap[g.name.trim().toLowerCase()] = newId;
                }
            }
        }

        // ════════════════════════════════════════════════════════════
        // PASO 2: Importar/Crear EVENTOS (usando mapa de empresas)
        // ════════════════════════════════════════════════════════════
        if (data.events && data.events.length > 0) {
            console.log('[IMPORT] Step 2 - Processing events:', data.events.length);
            
            // Obtener empresas existentes de BD para complementar el mapa
            const allGroups = db.prepare("SELECT id, name FROM groups").all();
            for (const g of allGroups) {
                if (!createdGroupsMap[g.name.toLowerCase()]) {
                    createdGroupsMap[g.name.toLowerCase()] = g.id;
                }
            }
            
            for (const e of data.events) {
                console.log('[IMPORT] Event:', e.name, 'date:', e.date, 'group:', e.group_name);
                
                // Resolver nombre de empresa a ID (primero mapa local, luego BD)
                let resolvedGroupId = null;
                if (e.group_name) {
                    const groupNameLower = e.group_name.trim().toLowerCase();
                    if (createdGroupsMap[groupNameLower]) {
                        resolvedGroupId = createdGroupsMap[groupNameLower];
                        console.log('[IMPORT] Resolved group from created:', e.group_name, '->', resolvedGroupId);
                    } else {
                        // Buscar en BD
                        const foundGroup = db.prepare("SELECT id FROM groups WHERE LOWER(name) = LOWER(?)").get(e.group_name);
                        if (foundGroup) {
                            resolvedGroupId = foundGroup.id;
                            console.log('[IMPORT] Resolved group from DB:', e.group_name, '->', resolvedGroupId);
                        }
                    }
                }
                
                // Buscar evento existente
                let existing = null;
                if (e.name && e.date) {
                    existing = db.prepare("SELECT id, name FROM events WHERE LOWER(name) = LOWER(?) AND date = ?").get(e.name, e.date);
                }
                
                if (existing) {
                    console.log('[IMPORT] Updating event:', existing.name);
                    db.prepare("UPDATE events SET location = ?, description = ?, group_id = ? WHERE id = ?")
                        .run(e.location, e.description, resolvedGroupId || null, existing.id);
                    updated++;
                    // Registrar en mapa
                    createdEventsMap[e.name.toLowerCase()] = existing.id;
                } else {
                    console.log('[IMPORT] Creating new event:', e.name);
                    const newId = getValidId('events');
                    db.prepare("INSERT INTO events (id, user_id, name, date, location, description, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)")
                        .run(newId, req.userId, e.name, e.date, e.location, e.description, resolvedGroupId || null, new Date().toISOString());
                    imported++;
                    // Registrar en mapa
                    createdEventsMap[e.name.toLowerCase()] = newId;
                }
            }
        }

        // ════════════════════════════════════════════════════════════
        // PASO 3: Importar/Crear STAFF (usando mapas de empresas y eventos)
        // ════════════════════════════════════════════════════════════
        if (data.users && data.users.length > 0) {
            console.log('[IMPORT] Step 3 - Processing users:', data.users.length);
            const bcrypt = require('bcryptjs');
            
            // Complementar mapas con datos de BD
            const allGroups = db.prepare("SELECT id, name FROM groups").all();
            for (const g of allGroups) {
                if (!createdGroupsMap[g.name.toLowerCase()]) {
                    createdGroupsMap[g.name.toLowerCase()] = g.id;
                }
            }
            
            const allEvents = db.prepare("SELECT id, name FROM events").all();
            for (const ev of allEvents) {
                if (!createdEventsMap[ev.name.toLowerCase()]) {
                    createdEventsMap[ev.name.toLowerCase()] = ev.id;
                }
            }
            
            for (const u of data.users) {
                console.log('[IMPORT] User:', u.username, 'display_name:', u.display_name, 'company:', u.company_name, 'event:', u.event_name);
                
                // Resolver company_name a group_id (usar mapa local primero, luego BD)
                let resolvedGroupId = null;
                if (u.company_name) {
                    const companyLower = u.company_name.toLowerCase();
                    if (createdGroupsMap[companyLower]) {
                        resolvedGroupId = createdGroupsMap[companyLower];
                        console.log('[IMPORT] Resolved company from map:', u.company_name, '->', resolvedGroupId);
                    }
                }
                
                // Buscar por username (email)
                let existingUser = null;
                if (u.username) {
                    existingUser = db.prepare("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)").get(u.username);
                }
                
                let userId;
                
                if (existingUser) {
                    console.log('[IMPORT] Updating user:', existingUser.username);
                    db.prepare("UPDATE users SET display_name = ?, phone = ?, role = ?, group_id = ? WHERE id = ?")
                        .run(u.display_name, u.phone, u.role, resolvedGroupId || null, existingUser.id);
                    userId = existingUser.id;
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new user (APPROVED):', u.username);
                    try {
                        const hashedPassword = u.password ? bcrypt.hashSync(u.password, 10) : bcrypt.hashSync('check123', 10);
                        userId = getValidId('users');
                        db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)")
                            .run(userId, u.username, hashedPassword, u.role, u.display_name, u.phone, resolvedGroupId || null, new Date().toISOString());
                        imported++;
                    } catch(createErr) {
                        if (createErr.message.includes('UNIQUE constraint failed')) {
                            console.log('[IMPORT] User already exists (skipping):', u.username);
                            // Buscar el usuario existente y usarlo
                            const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(u.username);
                            if (existing) {
                                userId = existing.id;
                                console.log('[IMPORT] Using existing user ID:', userId);
                            } else {
                                continue; // Saltar este usuario
                            }
                        } else {
                            throw createErr; // Re-lanzar otros errores
                        }
                    }
                }
                
                // Vincular a eventos (soporta múltiples eventos separados por coma)
                if (u.event_name && userId) {
                    const eventNames = u.event_name.split(',').map(e => e.trim()).filter(e => e);
                    let linkedCount = 0;
                    for (const eventName of eventNames) {
                        const eventLower = eventName.toLowerCase();
                        const eventId = createdEventsMap[eventLower];
                        
                        if (eventId) {
                            console.log('[IMPORT] Linking user to event:', u.username, '->', eventName, '(', eventId, ')');
                            try {
                                db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
                                    .run(getValidId('user_events'), userId, eventId, new Date().toISOString());
                                linkedCount++;
                            } catch(linkErr) {
                                console.log('[IMPORT] Warning: Could not link user to event:', linkErr.message);
                            }
                        } else {
                            console.log('[IMPORT] Warning: Event not found:', eventName);
                        }
                    }
                    if (linkedCount > 0) {
                        console.log('[IMPORT] User', u.username, 'linked to', linkedCount, 'events');
                    }
                }
            }
        }

        console.log('[IMPORT] Result - imported:', imported, 'updated:', updated);

        // ════════════════════════════════════════════════════════════
        // PASO 4: Importar/Crear CLIENTES (usando mapas de empresas y eventos)
        // ════════════════════════════════════════════════════════════
        if (data.clients && data.clients.length > 0) {
            console.log('[IMPORT] Step 4 - Processing clients:', data.clients.length);
            
            // Complementar mapas con datos de BD
            const allGroups = db.prepare("SELECT id, name FROM groups").all();
            for (const g of allGroups) {
                if (!createdGroupsMap[g.name.toLowerCase()]) {
                    createdGroupsMap[g.name.toLowerCase()] = g.id;
                }
            }
            
            const allEvents = db.prepare("SELECT id, name FROM events").all();
            for (const ev of allEvents) {
                if (!createdEventsMap[ev.name.toLowerCase()]) {
                    createdEventsMap[ev.name.toLowerCase()] = ev.id;
                }
            }
            
            for (const c of data.clients) {
                console.log('[IMPORT] Client:', c.name, 'email:', c.email, 'company:', c.company_name, 'event:', c.event_name);
                
                // Resolver company_name a group_id
                let resolvedGroupId = null;
                if (c.company_name) {
                    const companyLower = c.company_name.toLowerCase();
                    if (createdGroupsMap[companyLower]) {
                        resolvedGroupId = createdGroupsMap[companyLower];
                        console.log('[IMPORT] Resolved company for client from map:', c.company_name, '->', resolvedGroupId);
                    }
                }
                
                // Buscar por name o email
                let existingClient = null;
                if (c.name) {
                    existingClient = db.prepare("SELECT id FROM clients WHERE LOWER(name) = LOWER(?)").get(c.name);
                }
                if (!existingClient && c.email) {
                    existingClient = db.prepare("SELECT id FROM clients WHERE email IS NOT NULL AND LOWER(email) = LOWER(?)").get(c.email);
                }
                
                let clientId;
                
                if (existingClient) {
                    console.log('[IMPORT] Updating client:', c.name);
                    db.prepare("UPDATE clients SET email = ?, phone = ?, group_id = ? WHERE id = ?")
                        .run(c.email, c.phone, resolvedGroupId || null, existingClient.id);
                    clientId = existingClient.id;
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new client:', c.name);
                    clientId = getValidId('clients');
                    db.prepare("INSERT INTO clients (id, name, email, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)")
                        .run(clientId, c.name, c.email, c.phone, resolvedGroupId || null, new Date().toISOString());
                    imported++;
                }
                
                // Vincular a eventos (soporta múltiples eventos separados por coma)
                if (c.event_name && clientId) {
                    const eventNames = c.event_name.split(',').map(e => e.trim()).filter(e => e);
                    let linkedCount = 0;
                    for (const eventName of eventNames) {
                        const eventLower = eventName.toLowerCase();
                        const eventId = createdEventsMap[eventLower];
                        
                        if (eventId) {
                            console.log('[IMPORT] Linking client to event:', c.name, '->', eventName, '(', eventId, ')');
                            try {
                                db.prepare("INSERT OR IGNORE INTO client_events (id, client_id, event_id, created_at) VALUES (?, ?, ?, ?)")
                                    .run(getValidId('client_events'), clientId, eventId, new Date().toISOString());
                                linkedCount++;
                            } catch(linkErr) {
                                console.log('[IMPORT] Warning: Could not link client to event:', linkErr.message);
                            }
                        } else {
                            console.log('[IMPORT] Warning: Event not found for client:', eventName);
                        }
                    }
                    if (linkedCount > 0) {
                        console.log('[IMPORT] Client', c.name, 'linked to', linkedCount, 'events');
                    }
                }
            }
        }

        // ════════════════════════════════════════════════════════════
        // PASO 5: Importar/Actualizar ASISTENTES (Attendance)
        // ════════════════════════════════════════════════════════════
        if (type === 'attendance') {
            const eventId = castId('events', req.body.eventId);
            if (!eventId) throw new Error('Se requiere un Event ID válido para importar asistentes');

            let attendeesToProcess = [];

            // Opción A: Se envía el mapeo y el archivo para procesar en el servidor (RECOMENDADO)
            if (req.body.mapping && req.body.file) {
                const buffer = Buffer.from(req.body.file, 'base64');
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const sheet = workbook.getWorksheet('Asistentes') || workbook.getWorksheet(1);
                
                const m = req.body.mapping; 
                
                sheet.eachRow({ skip: 1 }, (row) => {
                    const getVal = (idx) => {
                        if (idx === undefined || idx === null || idx === "") return null;
                        const cell = row.getCell(parseInt(idx) + 1);
                        const val = cell.text?.trim() || (cell.value?.toString() || "").trim();
                        // Importante: devolver null si está vacío para que el COALESCE de SQL funcione
                        return val || null;
                    };

                    const a = {
                        name: getVal(m.name),
                        email: getVal(m.email),
                        phone: getVal(m.phone),
                        organization: getVal(m.organization),
                        cargo: getVal(m.cargo),
                        vegano: getVal(m.vegano),
                        restricciones: getVal(m.restricciones)
                    };

                    // Guardar si tiene al menos email
                    if (a.email) {
                        // Fallback de nombre solo si es NUEVO registro
                        attendeesToProcess.push(a);
                    }
                });
            } else if (data.attendance && data.attendance.length > 0) {
                // Opción B: Datos ya procesados (Legacy o Simple)
                attendeesToProcess = data.attendance;
            }

            if (attendeesToProcess.length === 0) {
                throw new Error('No se encontraron asistentes válidos para procesar');
            }

            console.log(`[IMPORT] Step 5 - Processing ${attendeesToProcess.length} attendees for event:`, eventId);
            
            // Obtener la base de datos correcta (Global o Independiente)
            // Asegurar que la base de datos del evento exista (Get or Create)
            const targetDb = createEventDatabase(eventId);
            if (!targetDb) throw new Error(`Error de persistencia en evento ${eventId}. Detalle: ${global.lastDbError || 'Desconocido'}`);
        
        // --- Migración de Emergencia para Eventos Independientes (V12.44.305) ---
        try {
            const columns = targetDb.prepare("PRAGMA table_info(guests)").all().map(c => c.name);
            const requiredColumns = ['created_at', 'cargo', 'vegano', 'restricciones', 'validated', 'qr_token', 'organization', 'phone', 'position', 'dietary_notes'];
            requiredColumns.forEach(col => {
                if (!columns.includes(col)) {
                    let def = "TEXT";
                    if (col === 'vegano') def = "TEXT DEFAULT 'NO'";
                    if (col === 'validated') def = "INTEGER DEFAULT 0";
                    if (col === 'created_at') def = "TEXT DEFAULT CURRENT_TIMESTAMP";
                    targetDb.exec(`ALTER TABLE guests ADD COLUMN ${col} ${def}`);
                    console.log(`[MIGRATION-EVENT] Columna ${col} añadida a guests del evento ${eventId}`);
                }
            });
        } catch (migErr) {
            console.error('[MIGRATION-EVENT] Error migrando DB del evento:', migErr.message);
        }
            
            // Contadores ya inicializados al inicio del manejador
             
            
            for (const a of attendeesToProcess) {
                if (!a.email) continue;
                const emailLower = a.email.toLowerCase().trim();

                // Normalización de Vegano (V12.44.311)
                const vRaw = (a.vegano || "").toString().trim().toUpperCase();
                const vNorm = (vRaw === 'SI' || vRaw === 'SÍ' || vRaw === 'YES' || vRaw === 'TRUE' || vRaw === '1') ? 'SI' : 'NO';

                // Fallback de nombre: usar email si no hay nombre
                const cleanName = (a.name || "").trim();
                const provisionalName = cleanName || emailLower.split('@')[0];

                // 1. Gestionar tabla 'guests'
                let guest = targetDb.prepare("SELECT id, name FROM guests WHERE event_id = ? AND LOWER(email) = ?").get(eventId, emailLower);
                
                if (guest) {
                    duplicates++; // Marcado como existente/duplicado
                    // Solo actualizar el nombre si el nuevo nombre no está vacío
                    const nameToUpdate = cleanName || guest.name || provisionalName;

                    targetDb.prepare(`
                        UPDATE guests SET 
                            name = ?, 
                            phone = COALESCE(?, phone), 
                            organization = COALESCE(?, organization), 
                            position = COALESCE(?, position),
                            cargo = COALESCE(?, cargo),
                            dietary_notes = COALESCE(?, dietary_notes),
                            restricciones = COALESCE(?, restricciones),
                            vegano = COALESCE(?, vegano)
                        WHERE id = ?
                    `).run(
                        nameToUpdate, 
                        a.phone, a.organization, 
                        a.cargo || a.position, a.cargo || a.position,
                        a.restricciones || a.dietary_notes, a.restricciones || a.dietary_notes,
                        vNorm,
                        guest.id
                    );
                    updated++;
                } else {
                    console.log('[IMPORT] Creating new guest:', emailLower);
                    const guestId = getValidId('guests');
                    const qrToken = require('uuid').v4();
                    
                    targetDb.prepare(`
                        INSERT INTO guests (
                            id, event_id, name, email, phone, organization, position, cargo, 
                            dietary_notes, restricciones, vegano, qr_token, created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        guestId, eventId, provisionalName, emailLower, a.phone, a.organization, 
                        a.cargo || (a.position || null), a.cargo || (a.position || null),
                        a.restricciones || (a.dietary_notes || null), a.restricciones || (a.dietary_notes || null),
                        vNorm, qrToken, new Date().toISOString()
                    );
                    imported++;
                }
}
            }

            // FORZAR ESCRITURA A DISCO (V12.44.350)
            if (targetDb) {
                targetDb.prepare("PRAGMA wal_checkpoint(FULL)").get();
                
                // VERIFICAR QUE EL ARCHIVO EXISTE Y TIENE DATOS
                const dbPath = targetDb.name;
                const fs = require('fs');
                const stats = fs.statSync(dbPath);
                console.log('[IMPORT] DB tamaño después de importar:', stats.size, 'bytes');
                console.log('[IMPORT] Datos sincronizados a disco');
            }

        } catch (e) {
            console.error('Error ejecutando importación:', e);
            res.status(500).json({ success: false, message: 'Error en importación: ' + e.message });
        }
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

        if (type === 'groups' || type === 'all') {
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
        }
        
        if (type === 'events' || type === 'all') {
            // ─── EXPORTAR EVENTOS (matching import template) ───
            const eventsSheet = workbook.addWorksheet('Eventos');
            eventsSheet.columns = [
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Fecha', key: 'date', width: 20 },
                { header: 'Ubicación', key: 'location', width: 30 },
                { header: 'Descripción', key: 'description', width: 40 },
                { header: 'Empresa', key: 'company_name', width: 25 }
            ];

            // Obtener eventos con nombre de empresa
            const events = db.prepare(`
                SELECT e.name, e.date, e.location, e.description, g.name as company_name 
                FROM events e 
                LEFT JOIN groups g ON e.group_id = g.id 
                ORDER BY e.created_at DESC
            `).all();
            eventsSheet.addRows(events);

            eventsSheet.getRow(1).font = { bold: true };
            eventsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
            eventsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
        
        if (type === 'staff' || type === 'users' || type === 'all') {
            // ─── EXPORTAR USUARIOS (matching import template) ───
            const usersSheet = workbook.addWorksheet('Staff');
            usersSheet.columns = [
                { header: 'Nombre', key: 'display_name', width: 25 },
                { header: 'Email', key: 'username', width: 35 },
                { header: 'Password', key: 'password', width: 15 },
                { header: 'Rol', key: 'role', width: 15 },
                { header: 'Telefono', key: 'phone', width: 20 },
                { header: 'Empresa', key: 'company_name', width: 25 },
                { header: 'Evento', key: 'event_name', width: 25 }
            ];

            // Obtener usuarios con nombre de empresa y eventos asociados
            const users = db.prepare(`
                SELECT u.display_name, u.username, u.role, u.phone, 
                       g.name as company_name,
                       GROUP_CONCAT(e.name, ', ') as event_name
                FROM users u 
                LEFT JOIN groups g ON u.group_id = g.id 
                LEFT JOIN user_events ue ON u.id = ue.user_id
                LEFT JOIN events e ON ue.event_id = e.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `).all();
            // Add password column as empty (security - don't export passwords)
            usersSheet.addRows(users.map(u => ({ ...u, password: '' })));

            usersSheet.getRow(1).font = { bold: true };
            usersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8b5cf6' } };
            usersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
        
        if (type === 'clients' || type === 'all') {
            // ─── EXPORTAR CLIENTES (matching import template) ───
            const clientsSheet = workbook.addWorksheet('Clientes');
            clientsSheet.columns = [
                { header: 'Nombre', key: 'name', width: 25 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Teléfono', key: 'phone', width: 20 },
                { header: 'Empresa', key: 'company_name', width: 25 },
                { header: 'Estado', key: 'status', width: 15 }
            ];

            // Obtener clientes con nombre de empresa
            const clients = db.prepare(`
                SELECT c.name, c.email, c.phone, c.status, g.name as company_name 
                FROM clients c 
                LEFT JOIN groups g ON c.group_id = g.id 
                ORDER BY c.created_at DESC
            `).all();
            clientsSheet.addRows(clients);

            clientsSheet.getRow(1).font = { bold: true };
            clientsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10b981' } };
            clientsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
        
        if (workbook.worksheets.length === 0) {
            return res.status(400).json({ error: 'Tipo de exportación no válido. Use: groups, events, staff, users, o all' });
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
                    currentY = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(10);
                    doc.text('No hay staff registrado', 14, currentY);
                    currentY += 15;
                }
                
                // Clientes - nueva pagina si es necesario
                if (currentY > 200) { doc.addPage(); currentY = 20; }
                doc.setFontSize(14);
                doc.text('Clientes', 14, currentY);
                currentY += 10;
                
                const clients = db.prepare("SELECT c.name, c.email, c.phone, c.status, g.name as company_name FROM clients c LEFT JOIN groups g ON c.group_id = g.id ORDER BY c.created_at DESC").all();
                
                if (clients.length > 0) {
                    autoTable(doc, {
                        startY: currentY,
                        head: [['Nombre', 'Email', 'Teléfono', 'Empresa', 'Estado']],
                        body: clients.map(c => [c.name || '-', c.email || '-', c.phone || '-', c.company_name || '-', c.status || '-']),
                        theme: 'grid',
                        headStyles: { fillColor: [16, 185, 129] }
                    });
                } else {
                    doc.setFontSize(10);
                    doc.text('No hay clientes registrados', 14, currentY);
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
