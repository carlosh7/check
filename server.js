// server.js — Check Elite Pro V10.2 (ExcelJS + Express 5 nativo)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const ExcelJS = require('exceljs');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// --- VERSIÓN DINÁMICA V10.3 ---
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = pkg.version;
let tempImport = {};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

// --- ID COMPATIBILITY WRAPPER (V10.4.3) ---
const getValidId = (tableName) => {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        return (idCol && idCol.type === 'INTEGER') ? null : uuidv4();
    } catch(e) { return uuidv4(); }
};

const castId = (tableName, id) => {
    if (id === null || id === undefined) return id;
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER' && !isNaN(id)) return parseInt(id, 10);
        return id;
    } catch(e) { return id; }
};

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json()); // Nativo en Express 5 — body-parser ya no es necesario

// --- RATE LIMITING ---
app.set('trust proxy', 1);
const skipLocal = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
const apiLimiter = rateLimit({ windowMs: 15*60*1000, max: 2000, skip: skipLocal, message: { error: 'Demasiadas peticiones.' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50, skip: skipLocal, message: { error: 'Demasiados intentos.' } });
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);

// --- STATIC FILES ---
app.use(express.static(path.join(__dirname, '/'), {
    maxAge: 0,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const upload = multer({ dest: 'uploads/' });

// --- ENRUTAMIENTO SPA (V9) ---
app.get('/:eventName/registro', (req, res) => {
    res.sendFile(path.join(__dirname, 'registro.html'));
});

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE DE AUTH — better-sqlite3: síncrono
// ─────────────────────────────────────────────────────────────
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        let userId = req.headers['x-user-id'] || req.query['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });
        userId = castId('users', userId); // ASEGURAR TIPO DE DATO
        const row = db.prepare("SELECT role, status FROM users WHERE id = ?").get(userId);
        if (!row) return res.status(401).json({ error: 'Usuario inexistente' });
        if (row.status !== 'APPROVED') return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
        if (roles.length > 0 && !roles.includes(row.role)) return res.status(403).json({ error: 'Acceso denegado' });
        req.userId = userId; // Inyectar ID casteado
        req.userRole = row.role;
        req.userGroupId = row.group_id;
        next();
    };
};

// ═══ FUNCIONES HELPER PARA PERMISOS JERÁRQUICOS V10.5 ═══

// Obtener grupos que administra un PRODUCTOR
const getProducerGroups = (userId) => {
    const groupUsers = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
    return groupUsers.map(g => g.group_id);
};

// Obtener eventos a los que tiene acceso un usuario (por grupo o asignados)
const getUserEventIds = (userId, role) => {
    if (role === 'ADMIN') {
        const all = db.prepare("SELECT id FROM events").all();
        return all.map(e => e.id);
    }
    
    const userGroups = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
    const groupIds = userGroups.map(g => g.group_id);
    
    let eventIds = [];
    if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => '?').join(',');
        const eventsByGroup = db.prepare(`SELECT id FROM events WHERE group_id IN (${placeholders})`).all(...groupIds);
        eventIds = eventsByGroup.map(e => e.id);
    }
    
    const userEvents = db.prepare("SELECT event_id FROM user_events WHERE user_id = ?").all(userId);
    const assignedIds = userEvents.map(e => e.event_id);
    
    return [...new Set([...eventIds, ...assignedIds])];
};

// Verificar si usuario tiene acceso a un evento específico
const hasEventAccess = (userId, eventId, role) => {
    if (role === 'ADMIN') return true;
    
    const event = db.prepare("SELECT group_id FROM events WHERE id = ?").get(eventId);
    if (!event) return false;
    
    if (event.group_id) {
        const inGroup = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(userId, event.group_id);
        if (inGroup) return true;
    }
    
    const assigned = db.prepare("SELECT 1 FROM user_events WHERE user_id = ? AND event_id = ?").get(userId, eventId);
    return !!assigned;
};

// ═══ AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────
app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    const id = getValidId('users');
    const status = (role === 'ADMIN') ? 'APPROVED' : 'PENDING';
    try {
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username, password, role || 'PRODUCTOR', status, new Date().toISOString());
        res.json({ success: true, userId: id, status });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const row = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (row && row.status === 'APPROVED') {
        res.json({ success: true, userId: row.id, role: row.role, username: row.username });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas o cuenta no aprobada' });
    }
});

// ─────────────────────────────────────────────────────────────
// GOVERNANCE V10 — USUARIOS
// ─────────────────────────────────────────────────────────────
app.get('/api/users', authMiddleware(['ADMIN']), (req, res) => {
    // ADMIN ve todos los usuarios
    const rows = db.prepare("SELECT id, username, role, role_detail, status, created_at, group_id FROM users ORDER BY created_at DESC").all();
    res.json(rows);
});

// ═══ ENDPOINTS DE GRUPOS V10.5 ═══

// Ver grupos (ADMIN ve todos, PRODUCTOR ve los suyos)
app.get('/api/groups', authMiddleware(), (req, res) => {
    const userId = req.userId;
    const role = req.userRole;
    
    let rows;
    if (role === 'ADMIN') {
        rows = db.prepare("SELECT * FROM groups ORDER BY created_at DESC").all();
    } else {
        // PRODUCTOR ve solo sus grupos
        const groupIds = getProducerGroups(userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT * FROM groups WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...groupIds);
        }
    }
    res.json(rows);
});

// Crear grupo (solo ADMIN)
app.post('/api/groups', authMiddleware(['ADMIN']), (req, res) => {
    const { name, description } = req.body;
    const id = getValidId('groups');
    const created_by = req.userId;
    
    db.prepare("INSERT INTO groups (id, name, description, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, name, description || '', 'ACTIVE', new Date().toISOString(), created_by);
    
    res.json({ success: true, groupId: id });
});

// Agregar usuario a grupo
app.post('/api/groups/:groupId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { userId, role_in_group } = req.body;
    const groupId = castId('groups', req.params.groupId);
    
    // Verificar que el PRODUCTOR tenga acceso al grupo
    if (req.userRole === 'PRODUCTOR') {
        const hasAccess = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(req.userId, groupId);
        if (!hasAccess) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }
    
    const id = getValidId('group_users');
    db.prepare("INSERT INTO group_users (id, group_id, user_id, role_in_group, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, groupId, userId, role_in_group || 'PRODUCTOR', new Date().toISOString());
    
    res.json({ success: true });
});

// Asignar usuario a evento
app.post('/api/events/:eventId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { userId } = req.body;
    const eventId = castId('events', req.params.eventId);
    
    // Verificar acceso al evento
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const id = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, userId, eventId, new Date().toISOString());
    
    res.json({ success: true });
});

app.post('/api/users/invite', authMiddleware(['ADMIN']), (req, res) => {
    const { username, password, role } = req.body;
    const id = uuidv4();
    try {
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, 'APPROVED', ?)")
          .run(id, username, password, role || 'PRODUCTOR', new Date().toISOString());
        res.json({ success: true, userId: id });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Usuario ya existe u ocurrió un error' });
    }
});

app.put('/api/users/:id/role', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(req.body.role, targetId);
    res.json({ success: true });
});

app.put('/api/users/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(req.body.status, targetId);
    res.json({ success: true });
});

app.put('/api/users/:id/password', authMiddleware(), (req, res) => {
    const targetId = castId('users', req.params.id);
    const requesterId = req.userId; // YA CASTEADO
    if (req.userRole !== 'ADMIN' && requesterId !== targetId) return res.status(403).json({ error: 'Acceso Denegado' });
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(req.body.password, targetId);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// GOVERNANCE V10 — SETTINGS (LEGALES)
// ─────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const dict = {};
    rows.forEach(r => dict[r.setting_key] = r.setting_value);
    res.json(dict);
});

app.put('/api/settings', authMiddleware(['ADMIN']), (req, res) => {
    const { policy_data, terms_conditions } = req.body;
    if (policy_data !== undefined) {
        db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'policy_data'").run(policy_data);
    }
    if (terms_conditions !== undefined) {
        db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'terms_conditions'").run(terms_conditions);
    }
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// EVENTS ENDPOINTS
// ─────────────────────────────────────────────────────────────
app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), upload.single('logo'), (req, res) => {
    const { name, date, end_date, location, description } = req.body;
    const userId = req.userId; // YA CASTEADO EN EL MIDDLEWARE
    const id = getValidId('events');
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    try {
        db.prepare("INSERT INTO events (id, user_id, name, date, end_date, location, logo_url, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(id, userId, name, date, end_date, location, logoUrl, description, new Date().toISOString());
        res.json({ success: true, eventId: id });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.userId;
    const role = req.userRole;
    
    let rows;
    if (role === 'ADMIN') {
        // ADMIN ve todos los eventos
        rows = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
    } else {
        // PRODUCTOR, STAFF, CLIENTE ven solo eventos de sus grupos/asignaciones
        const eventIds = getUserEventIds(userId, role);
        if (eventIds.length === 0) {
            rows = [];
        } else {
            const placeholders = eventIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...eventIds);
        }
    }
    res.json(rows);
});

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description } = req.body;
    const targetId = castId('events', req.params.id);
    db.prepare("UPDATE events SET name = ?, date = ?, location = ?, description = ? WHERE id = ?")
      .run(name, date, location, description, targetId);
    res.json({ success: true });
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('events', req.params.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(targetId);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// INVITADOS
// ─────────────────────────────────────────────────────────────
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const rows = db.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
    res.json(rows);
});

// ─────────────────────────────────────────────────────────────
// IMPORTACIÓN MOTOR V10.5.2 (Limpieza de duplicados y anidados)
// ─────────────────────────────────────────────────────────────
app.post('/api/import-preview', authMiddleware(), upload.single('file'), async (req, res) => {
    if (!req.file || !req.body.event_id) return res.status(400).json({ error: 'Data faltante' });
    const eId = castId('events', req.body.event_id);
    const guests = [];
    
    try {
        if (req.file.originalname.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(dataBuffer);
            const lines = data.text.split('\n').filter(l => l.trim().includes('@'));
            lines.forEach(l => {
                const parts = l.split(/\s+/);
                const email = parts.find(p => p.includes('@'));
                if (email) guests.push({ name: parts.filter(p => !p.includes('@')).join(' ') || 'Invitado PDF', email, organization: 'Importado PDF' });
            });
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            const sheet = workbook.getWorksheet(1);
            if (sheet) {
                sheet.eachRow((row, i) => {
                    if (i > 1) {
                        const name = row.getCell(1).text;
                        const email = row.getCell(2).text;
                        if (name && email) guests.push({ name, email, organization: row.getCell(3).text || '', phone: row.getCell(4).text || '', gender: row.getCell(5).text || 'O' });
                    }
                });
            }
        }
        
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        tempImport[req.userId] = { event_id: eId, guests };
        res.json({ success: true, total: guests.length, valid: guests.length });
    } catch (e) { 
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/import-confirm', authMiddleware(), (req, res) => {
    const data = tempImport[req.userId];
    if (!data || String(data.event_id) !== String(req.body.event_id)) return res.status(400).json({ error: 'Sesión de importación expirada' });
    
    const insertMany = db.transaction((guestList) => {
        const insertGuest = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        for (const g of guestList) {
            insertGuest.run(getValidId('guests'), data.event_id, g.name, g.email, g.organization, g.phone || '', g.gender || 'O', uuidv4());
        }
    });

    try {
        insertMany(data.guests);
        delete tempImport[req.userId];
        io.to(data.event_id).emit('update_stats', data.event_id);
        res.json({ success: true, count: data.guests.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// EXPORTAR EXCEL
// ─────────────────────────────────────────────────────────────
app.get('/api/export-excel/:eventId', authMiddleware(), async (req, res) => {
    const eId = castId('events', req.params.eventId);
    const rows = db.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?").all(eId);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Check Pro V10';
    const sheet = workbook.addWorksheet('Invitados', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });
    
    // Cabeceras con estilo premium
    sheet.columns = [
        { header: 'Nombre', key: 'Nombre', width: 30 },
        { header: 'Email', key: 'Email', width: 35 },
        { header: 'Organización', key: 'Organizacion', width: 30 },
        { header: 'Teléfono', key: 'Telefono', width: 18 },
        { header: 'Género', key: 'Genero', width: 10 },
        { header: 'Asistió', key: 'Asistio', width: 12 },
        { header: 'Hora Check-in', key: 'Hora', width: 22 }
    ];
    
    // Estilo del encabezado
    sheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF5B21B6' } } };
    });
    sheet.getRow(1).height = 24;
    
    // Datos con filas alternas
    rows.forEach((row, i) => {
        const dataRow = sheet.addRow(row);
        if (i % 2 === 0) {
            dataRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
            });
        }
        // Colorear asistidos en verde
        const asistioCell = dataRow.getCell('Asistio');
        if (asistioCell.value === 'SÍ') {
            asistioCell.font = { bold: true, color: { argb: 'FF059669' } };
        }
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CheckPro_Export_${req.params.eventId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// ─────────────────────────────────────────────────────────────
// LIMPIAR BD / CHECK-IN / STATS / REGISTRO PÚBLICO
// ─────────────────────────────────────────────────────────────
app.post('/api/clear-db/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    db.prepare("DELETE FROM guests WHERE event_id = ?").run(eId);
    db.prepare("DELETE FROM survey_responses WHERE event_id = ?").run(eId);
    res.json({ success: true });
});

app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const gId = castId('guests', req.params.guestId);
    const time = status ? new Date().toISOString() : null;
    db.prepare("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?").run(status ? 1 : 0, time, gId);
    const row = db.prepare("SELECT event_id FROM guests WHERE id = ?").get(gId);
    if (row) io.to(row.event_id).emit('update_stats', row.event_id);
    res.json({ success: true });
});

app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const gen = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, COUNT(DISTINCT organization) as orgs, SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite FROM guests WHERE event_id = ?").get(eId);
    const health = db.prepare("SELECT COUNT(*) as health FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')").get(eId);
    const flow = db.prepare("SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 GROUP BY hour").all(eId);
    res.json({ ...gen, healthAlerts: health.health, flowData: flow });
});

app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    const eId = castId('events', event_id);
    db.prepare("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .run(getValidId('guests'), eId, name, email, phone, organization, gender, dietary_notes, uuidv4());
    io.to(eId).emit('update_stats', eId);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// PUBLIC EVENT — Para la ruta de registro
// ─────────────────────────────────────────────────────────────
app.get('/api/events/public/:name', (req, res) => {
    const row = db.prepare("SELECT id, name, date, location, description, logo_url FROM events WHERE LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE(?, ' ', '')) AND status = 'ACTIVE' LIMIT 1").get(req.params.name);
    if (row) res.json(row);
    else res.status(404).json({ error: 'Evento no encontrado' });
});

app.get('/api/app-version', (req, res) => {
    res.json({ version: APP_VERSION });
});

// --- SPA FALLBACK (V10.5) ---
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

server.listen(port, () => console.log(`\x1b[35mCHECK PRO V10.5.3 (ExcelJS + better-sqlite3 + Express 5): Puerto ${port}\x1b[0m`));
