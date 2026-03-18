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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
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
        const userId = req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });

        db.get("SELECT role FROM users WHERE id = ?", [userId], (err, row) => {
            if (err || !row) return res.status(401).json({ error: 'Usuario no encontrado' });
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
    console.log('Cliente conectado:', socket.id);
    socket.on('join_event', (eventId) => {
        socket.join(eventId);
    });
});

// --- API ROUTES ---

// Registro de Usuario
app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    const id = uuidv4();
    db.run("INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)", 
        [id, username, password, role || 'PRODUCTOR', new Date().toISOString()], function(err) {
        if (err) return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        res.json({ success: true, userId: id });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            res.json({ success: true, userId: row.id, role: row.role, username: row.username });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Eventos (Filtrado por Multitenancy)
app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.headers['x-user-id'];
    const { role } = req.query; // Si el admin quiere ver todos
    
    let query = "SELECT * FROM events WHERE user_id = ?";
    let params = [userId];

    if (req.userRole === 'ADMIN') {
        query = "SELECT * FROM events";
        params = [];
    }

    db.all(query, params, (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description, logo_url } = req.body;
    const userId = req.headers['x-user-id'];
    const id = uuidv4();

    db.run("INSERT INTO events (id, user_id, name, date, location, description, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
        [id, userId, name, date, location, description, logo_url, new Date().toISOString()], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
    });
});

// Invitados
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        res.json(rows);
    });
});

// Check-in (Trigger Real-time & Email)
app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;

    db.get("SELECT event_id, name, email FROM guests WHERE id = ?", [req.params.guestId], (err, guest) => {
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], (err) => {
            // Emitir actualización vía Socket
            io.to(guest.event_id).emit('checkin_update', { guestId: req.params.guestId, status });
            
            // Aquí iría el trigger de Mailing en la Fase 2
            res.json({ success: true });
        });
    });
});

// Stats (Real-time compatible)
app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn,
            SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onSite
        FROM guests WHERE event_id = ?
    `, [req.params.eventId], (err, row) => {
        res.json(row);
    });
});

// Registro Público
app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    const id = uuidv4();
    const qr_token = uuidv4();

    db.run("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Notificar al Dashboard que hay un nuevo registro
            io.to(event_id).emit('new_registration', { id, name });
            
            res.json({ success: true, id });
        });
});

// --- SOCKETS DATA PUSH (Fase 3 PREVIEW) ---
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    res.json({ url: `/uploads/${req.file.filename}` });
});

server.listen(port, () => {
    console.log(`Servidor MAESTRO ejecutándose en http://localhost:${port}`);
});
