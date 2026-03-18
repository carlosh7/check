const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const xlsx = require('xlsx');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

// --- SECURITY MIDDLEWARE (V7.0) ---
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado temporalmente para permitir scripts inlines del frontend
    crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(bodyParser.json());

// --- RATE LIMITING (Calibrado V7.1) ---
app.set('trust proxy', 1); // Confiar en proxy interno/docker
const skipLocal = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';

const apiLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 2000, 
    skip: skipLocal,
    message: { error: 'Demasiadas peticiones desde esta IP. Intente más tarde.' } 
});
const authLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 50, 
    skip: skipLocal,
    message: { error: 'Demasiados intentos de inicio de sesión.' } 
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);

app.use(express.static(path.join(__dirname, '/'), {
    maxAge: 0,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const upload = multer({ dest: 'uploads/' });

// --- V9.0 ENRUTAMIENTO SPA ---
// Permitir que las URLs dinámicas sirvan el index.html
app.get('/:eventName/registro', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- MIDDLEWARES ---
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const userId = req.headers['x-user-id'] || req.query['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });
        db.get("SELECT role, status FROM users WHERE id = ?", [userId], (err, row) => {
            if (err || !row) return res.status(401).json({ error: 'Usuario inexistente' });
            if (row.status !== 'APPROVED') return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
            if (roles.length > 0 && !roles.includes(row.role)) return res.status(403).json({ error: 'Acceso denegado' });
            req.userRole = row.role;
            next();
        });
    };
};

// --- API ---

app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    const id = uuidv4();
    const status = (role === 'ADMIN') ? 'APPROVED' : 'PENDING';
    db.run("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
        [id, username, password, role || 'PRODUCTOR', status, new Date().toISOString()], (err) => {
            if (err) return res.status(400).json({ success: false });
            res.json({ success: true, userId: id, status });
        });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row && row.status === 'APPROVED') res.json({ success: true, userId: row.id, role: row.role, username: row.username });
        else res.status(401).json({ success: false, message: 'Credenciales inválidas o cuenta no aprobada' });
    });
});

// --- GOVERNANCE V10 (USERS & SETTINGS) ---
app.get('/api/users', authMiddleware(['ADMIN']), (req, res) => {
    db.all("SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC", (err, rows) => res.json(rows));
});

app.post('/api/users/invite', authMiddleware(['ADMIN']), (req, res) => {
    const { username, password, role } = req.body;
    const id = uuidv4();
    db.run("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, 'APPROVED', ?)", 
        [id, username, password, role || 'PRODUCTOR', new Date().toISOString()], (err) => {
            if (err) return res.status(400).json({ success: false, error: 'Usuario ya existe u ocurrió un error' });
            res.json({ success: true, userId: id });
        });
});

app.put('/api/users/:id/role', authMiddleware(['ADMIN']), (req, res) => {
    db.run("UPDATE users SET role = ? WHERE id = ?", [req.body.role, req.params.id], () => res.json({ success: true }));
});

app.put('/api/users/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    db.run("UPDATE users SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => res.json({ success: true }));
});

app.put('/api/users/:id/password', authMiddleware(), (req, res) => {
    // Solo un ADMIN o el propio usuario puede cambiar su clave
    const targetId = req.params.id;
    const requesterId = req.headers['x-user-id'] || req.query['x-user-id'];
    if (req.userRole !== 'ADMIN' && requesterId !== targetId) return res.status(403).json({ error: 'Acceso Denegado' });
    db.run("UPDATE users SET password = ? WHERE id = ?", [req.body.password, targetId], () => res.json({ success: true }));
});

app.get('/api/settings', (req, res) => {
    db.all("SELECT * FROM settings", (err, rows) => {
        const dict = {};
        if (rows) rows.forEach(r => dict[r.setting_key] = r.setting_value);
        res.json(dict);
    });
});

app.put('/api/settings', authMiddleware(['ADMIN']), (req, res) => {
    const { policy_data, terms_conditions } = req.body;
    if (policy_data !== undefined) db.run("UPDATE settings SET setting_value = ? WHERE setting_key = 'policy_data'", [policy_data]);
    if (terms_conditions !== undefined) db.run("UPDATE settings SET setting_value = ? WHERE setting_key = 'terms_conditions'", [terms_conditions]);
    res.json({ success: true });
});

app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.headers['x-user-id'] || req.query['x-user-id'];
    const query = req.userRole === 'ADMIN' ? "SELECT * FROM events" : "SELECT * FROM events WHERE user_id = ?";
    db.all(query, req.userRole === 'ADMIN' ? [] : [userId], (err, rows) => res.json(rows));
});

app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description } = req.body;
    const id = uuidv4();
    db.run("INSERT INTO events (id, user_id, name, date, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        [id, req.headers['x-user-id'], name, date, location, description, new Date().toISOString()], () => res.json({ id }));
});

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description } = req.body;
    db.run("UPDATE events SET name = ?, date = ?, location = ?, description = ? WHERE id = ?",
        [name, date, location, description, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.run("DELETE FROM events WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC", [req.params.eventId], (err, rows) => res.json(rows));
});

// Import Logic V5.5 (Refined Naming)
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
            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            raw = xlsx.utils.sheet_to_json(sheet).map(row => ({
                name: (row.Nombre || row.nombre || row.name || "").toString().trim() || row.Email || "Invitado",
                email: (row.Email || row.email || row.correo || "").toString().toLowerCase().trim(),
                organization: (row.Organizacion || row.Empresa || row.organization || "").toString().trim(),
                phone: (row.Telefono || row.phone || "").toString().trim(),
                gender: (row.Genero || row.gender || "O").toString().trim()
            }));
        }
        fs.unlinkSync(req.file.path);

        const uniqueInFile = [];
        const seen = new Set();
        raw.filter(g => g.email).forEach(g => {
            if (!seen.has(g.email)) {
                seen.add(g.email);
                uniqueInFile.push(g);
            }
        });

        db.all("SELECT LOWER(TRIM(email)) as email FROM guests WHERE event_id = ?", [eventId], (err, rowsDb) => {
            const inDb = new Set(rowsDb.map(r => r.email));
            const final = uniqueInFile.filter(g => !inDb.has(g.email));
            res.json({ 
                summary: { new: final.length, existing: uniqueInFile.length - final.length }, 
                data: final 
            });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import-confirm', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { eventId, guests } = req.body;
    const stmt = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    guests.forEach(g => stmt.run([uuidv4(), eventId, g.name, g.email, g.organization, g.phone, g.gender, uuidv4()]));
    stmt.finalize();
    io.to(eventId).emit('update_stats', eventId);
    res.json({ success: true });
});

app.get('/api/export-excel/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Nombre: "Sin datos" }]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Invitados");
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Export_${req.params.eventId}.xlsx`);
        res.send(xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    });
});

app.post('/api/clear-db/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM guests WHERE event_id = ?", [req.params.eventId]);
        db.run("DELETE FROM survey_responses WHERE event_id = ?", [req.params.eventId]);
    });
    res.json({ success: true });
});

app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;
    db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], (err) => {
        db.get("SELECT event_id FROM guests WHERE id = ?", [req.params.guestId], (err, row) => {
            if (row) io.to(row.event_id).emit('update_stats', row.event_id);
            res.json({ success: true });
        });
    });
});

app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eId = req.params.eventId;
    db.get("SELECT COUNT(*) as total, SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, COUNT(DISTINCT organization) as orgs, SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite FROM guests WHERE event_id = ?", [eId], (err, gen) => {
        db.get("SELECT COUNT(*) as health FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')", [eId], (err, health) => {
            db.all("SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 GROUP BY hour", [eId], (err, flow) => {
                res.json({ ...gen, healthAlerts: health.health, flowData: flow });
            });
        });
    });
});

app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    db.run("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [uuidv4(), event_id, name, email, phone, organization, gender, dietary_notes, uuidv4()], () => {
            io.to(event_id).emit('update_stats', event_id);
            res.json({ success: true });
        });
});

server.listen(port, () => console.log(`ELITE CORE V5.5: Port ${port}`));
