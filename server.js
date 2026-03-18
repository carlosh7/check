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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// --- RATE LIMITING ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { error: "Demasiados intentos, intente más tarde." }
});

app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

app.use(express.static(path.join(__dirname, '/')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- MIDDLEWARES ---
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const userId = req.headers['x-user-id'] || req.query['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });

        db.get("SELECT role, status FROM users WHERE id = ?", [userId], (err, row) => {
            if (err || !row) return res.status(401).json({ error: 'Usuario no encontrado' });
            if (row.status !== 'APPROVED') return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
            
            if (roles.length > 0 && !roles.includes(row.role)) {
                return res.status(403).json({ error: 'Permisos insuficientes' });
            }
            req.userRole = row.role;
            next();
        });
    };
};

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('join_event', (eventId) => socket.join(eventId));
});

// --- API ROUTES ---

// Auth
app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    const id = uuidv4();
    const status = role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    db.run("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
        [id, username, password, role || 'PRODUCTOR', status, new Date().toISOString()], function(err) {
        if (err) return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        res.json({ success: true, userId: id, status: status });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            if (row.status !== 'APPROVED') return res.status(403).json({ success: false, message: 'Cuenta pendiente de aprobación' });
            res.json({ success: true, userId: row.id, role: row.role, username: row.username });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Admin Users
app.get('/api/admin/users/pending', authMiddleware(['ADMIN']), (req, res) => {
    db.all("SELECT id, username, role, created_at FROM users WHERE status = 'PENDING'", (err, rows) => res.json(rows));
});

app.post('/api/admin/users/approve', authMiddleware(['ADMIN']), (req, res) => {
    const { userId, status } = req.body;
    db.run("UPDATE users SET status = ? WHERE id = ?", [status, userId], (err) => res.json({ success: true }));
});

// Events
app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.headers['x-user-id'] || req.query['x-user-id'];
    let query = req.userRole === 'ADMIN' ? "SELECT * FROM events" : "SELECT * FROM events WHERE user_id = ?";
    let params = req.userRole === 'ADMIN' ? [] : [userId];
    db.all(query, params, (err, rows) => res.json(rows));
});

app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description, logo_url } = req.body;
    const id = uuidv4();
    db.run("INSERT INTO events (id, user_id, name, date, location, description, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
        [id, req.headers['x-user-id'], name, date, location, description, logo_url, new Date().toISOString()], () => res.json({ id }));
});

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description, logo_url } = req.body;
    db.run("UPDATE events SET name = ?, date = ?, location = ?, description = ?, logo_url = ? WHERE id = ?",
        [name, date, location, description, logo_url, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.run("DELETE FROM events WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// Guests & Surveys
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => res.json(rows));
});

// Import Engine (V5.4 RECONSTRUCTION)
app.post('/api/import-dry-run', authMiddleware(['ADMIN', 'PRODUCTOR']), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { eventId } = req.body;
    let rawData = [];
    try {
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const foundEmails = [...new Set(pdfData.text.match(emailRegex) || [])];
            rawData = foundEmails.map(email => ({
                name: email.split('@')[0].replace(/[._]/g, ' '),
                email: email.toLowerCase().trim(),
                organization: "Importación PDF",
                phone: "", gender: "O"
            }));
        } else {
            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rawData = xlsx.utils.sheet_to_json(sheet).map(row => ({
                name: (row.Nombre || row.nombre || row.name || "Invitado").toString().trim(),
                email: (row.Email || row.email || row.correo || "").toString().toLowerCase().trim(),
                organization: (row.Organizacion || row.Empresa || row.organization || "").toString().trim(),
                phone: (row.Telefono || row.phone || "").toString().trim(),
                gender: (row.Genero || row.gender || "O").toString().trim()
            }));
        }
        fs.unlinkSync(req.file.path);

        // Deduplicación interna (dentro del mismo archivo)
        const uniqueInFile = [];
        const seenInFile = new Set();
        rawData.forEach(g => {
            if (g.email && !seenInFile.has(g.email)) {
                seenInFile.add(g.email);
                uniqueInFile.push(g);
            }
        });

        // Deduplicación contra Base de Datos
        db.all("SELECT LOWER(TRIM(email)) as email FROM guests WHERE event_id = ?", [eventId], (err, existing) => {
            const inDb = new Set(existing.map(e => e.email));
            const finalGuests = uniqueInFile.filter(g => !inDb.has(g.email));
            res.json({ 
                summary: { 
                    new: finalGuests.length, 
                    existing: uniqueInFile.length - finalGuests.length, 
                    totalInFile: uniqueInFile.length 
                }, 
                data: finalGuests 
            });
        });
    } catch (e) {
        res.status(500).json({ error: "Error de formato: " + e.message });
    }
});

app.post('/api/import-confirm', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { eventId, guests } = req.body;
    const stmt = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    guests.forEach(g => stmt.run([uuidv4(), eventId, g.name, g.email, g.organization, g.phone, g.gender, uuidv4()]));
    stmt.finalize();
    io.to(eventId).emit('update_stats', eventId);
    res.json({ success: true });
});

// Advanced Export (V5.4 FIX)
app.get('/api/export-excel/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora_Ingreso FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        if (!rows || rows.length === 0) {
            rows = [{ Nombre: "Sin invitados", Email: "N/A", Organizacion: "N/A", Telefono: "N/A", Genero: "N/A", Asistio: "NO", Hora_Ingreso: "" }];
        }
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Invitados");
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Event_Guests_${req.params.eventId}.xlsx`);
        res.send(buffer);
    });
});

app.post('/api/clear-db/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM guests WHERE event_id = ?", [req.params.eventId]);
        db.run("DELETE FROM survey_responses WHERE event_id = ?", [req.params.eventId]);
        res.json({ success: true });
    });
});

// Check-in & Stats
app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;
    db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], () => {
        res.json({ success: true });
        db.get("SELECT event_id FROM guests WHERE id = ?", [req.params.guestId], (err, row) => {
            io.to(row.event_id).emit('update_stats', row.event_id);
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

// Public Registration
app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    db.run("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [uuidv4(), event_id, name, email, phone, organization, gender, dietary_notes, uuidv4()], () => {
            io.to(event_id).emit('update_stats', event_id);
            res.json({ success: true });
        });
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => res.json({ url: `/uploads/${req.file.filename}` }));

server.listen(port, () => console.log(`MASTER CORE V5.4: http://localhost:${port}`));
