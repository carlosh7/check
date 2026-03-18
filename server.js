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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

// --- ID COMPATIBILITY WRAPPER (V10.4.2) ---
const getValidId = (tableName) => {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        return (idCol && idCol.type === 'INTEGER') ? null : uuidv4();
    } catch(e) { return uuidv4(); }
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
        const userId = req.headers['x-user-id'] || req.query['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });
        const row = db.prepare("SELECT role, status FROM users WHERE id = ?").get(userId);
        if (!row) return res.status(401).json({ error: 'Usuario inexistente' });
        if (row.status !== 'APPROVED') return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
        if (roles.length > 0 && !roles.includes(row.role)) return res.status(403).json({ error: 'Acceso denegado' });
        req.userRole = row.role;
        next();
    };
};

// ─────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
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
    const rows = db.prepare("SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC").all();
    res.json(rows);
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
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(req.body.role, req.params.id);
    res.json({ success: true });
});

app.put('/api/users/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
    res.json({ success: true });
});

app.put('/api/users/:id/password', authMiddleware(), (req, res) => {
    const targetId = req.params.id;
    const requesterId = req.headers['x-user-id'] || req.query['x-user-id'];
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
    const userId = req.headers['x-user-id'];
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
    const userId = req.headers['x-user-id'] || req.query['x-user-id'];
    const rows = req.userRole === 'ADMIN'
        ? db.prepare("SELECT * FROM events ORDER BY created_at DESC").all()
        : db.prepare("SELECT * FROM events WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(rows);
});

app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO events (id, user_id, name, date, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, req.headers['x-user-id'], name, date, location, description, new Date().toISOString());
    res.json({ id });
});

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description } = req.body;
    db.prepare("UPDATE events SET name = ?, date = ?, location = ?, description = ? WHERE id = ?")
      .run(name, date, location, description, req.params.id);
    res.json({ success: true });
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// INVITADOS
// ─────────────────────────────────────────────────────────────
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    const rows = db.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(req.params.eventId);
    res.json(rows);
});

// ─────────────────────────────────────────────────────────────
// IMPORTACIÓN (dry-run + confirm)
// ─────────────────────────────────────────────────────────────
app.post('/api/import-dry-run', authMiddleware(['ADMIN', 'PRODUCTOR']), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo' });
    const { eventId } = req.body;
    let raw = [];
    try {
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = [...new Set(pdfData.text.match(emailRegex) || [])];
            raw = emails.map(e => ({
                name: e.split('@')[0].split(/[._+-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                email: e.toLowerCase().trim(), organization: "Importación PDF", phone: "", gender: "O"
            }));
        } else {
            // Leer Excel con ExcelJS (moderno, mantenido, sin vulnerabilidades)
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            const sheet = workbook.worksheets[0];
            // Obtener encabezados de la primera fila
            const headers = [];
            sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '').trim()));
            // Mapear filas a objetos
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Saltar encabezados
                const obj = {};
                row.eachCell((cell, colNumber) => { obj[headers[colNumber - 1]] = cell.value; });
                const name = (obj.Nombre || obj.nombre || obj.name || '').toString().trim() || obj.Email || 'Invitado';
                const email = (obj.Email || obj.email || obj.correo || '').toString().toLowerCase().trim();
                if (email) raw.push({
                    name,
                    email,
                    organization: (obj.Organizacion || obj.Empresa || obj.organization || '').toString().trim(),
                    phone: (obj.Telefono || obj.phone || '').toString().trim(),
                    gender: (obj.Genero || obj.gender || 'O').toString().trim()
                });
            });
        }
        fs.unlinkSync(req.file.path);

        // Deduplicar dentro del archivo
        const uniqueInFile = [];
        const seen = new Set();
        raw.filter(g => g.email).forEach(g => {
            if (!seen.has(g.email)) { seen.add(g.email); uniqueInFile.push(g); }
        });

        // Detectar duplicados contra la DB (síncrono)
        const rowsDb = db.prepare("SELECT LOWER(TRIM(email)) as email FROM guests WHERE event_id = ?").all(eventId);
        const inDb = new Set(rowsDb.map(r => r.email));
        const final = uniqueInFile.filter(g => !inDb.has(g.email));
        res.json({ summary: { new: final.length, existing: uniqueInFile.length - final.length }, data: final });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import-confirm', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { eventId, guests } = req.body;
    // Inserción en transacción para máxima velocidad
    const insertGuest = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const insertMany = db.transaction((guestList) => {
        for (const g of guestList) {
            insertGuest.run(uuidv4(), eventId, g.name, g.email, g.organization, g.phone, g.gender, uuidv4());
        }
    });
    insertMany(guests);
    io.to(eventId).emit('update_stats', eventId);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// EXPORTAR EXCEL
// ─────────────────────────────────────────────────────────────
app.get('/api/export-excel/:eventId', authMiddleware(), async (req, res) => {
    const rows = db.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?").all(req.params.eventId);
    
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
    db.prepare("DELETE FROM guests WHERE event_id = ?").run(req.params.eventId);
    db.prepare("DELETE FROM survey_responses WHERE event_id = ?").run(req.params.eventId);
    res.json({ success: true });
});

app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;
    db.prepare("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?").run(status ? 1 : 0, time, req.params.guestId);
    const row = db.prepare("SELECT event_id FROM guests WHERE id = ?").get(req.params.guestId);
    if (row) io.to(row.event_id).emit('update_stats', row.event_id);
    res.json({ success: true });
});

app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eId = req.params.eventId;
    const gen = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, COUNT(DISTINCT organization) as orgs, SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite FROM guests WHERE event_id = ?").get(eId);
    const health = db.prepare("SELECT COUNT(*) as health FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')").get(eId);
    const flow = db.prepare("SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 GROUP BY hour").all(eId);
    res.json({ ...gen, healthAlerts: health.health, flowData: flow });
});

app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    db.prepare("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .run(uuidv4(), event_id, name, email, phone, organization, gender, dietary_notes, uuidv4());
    io.to(event_id).emit('update_stats', event_id);
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

server.listen(port, () => console.log(`CHECK PRO V${APP_VERSION} (ExcelJS + better-sqlite3 + Express 5): Puerto ${port}`));
