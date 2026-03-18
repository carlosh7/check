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
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 intentos
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
    // Los administradores son aprobados de inmediato (solo debería haber uno inicial)
    const status = role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    
    db.run("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
        [id, username, password, role || 'PRODUCTOR', status, new Date().toISOString()], function(err) {
        if (err) return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        res.json({ success: true, userId: id, status: status });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            if (row.status !== 'APPROVED') {
                return res.status(403).json({ success: false, message: 'Cuenta pendiente de aprobación' });
            }
            res.json({ success: true, userId: row.id, role: row.role, username: row.username });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Gestión de Usuarios (Admin Only)
app.get('/api/admin/users/pending', authMiddleware(['ADMIN']), (req, res) => {
    db.all("SELECT id, username, role, created_at FROM users WHERE status = 'PENDING'", (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/users/approve', authMiddleware(['ADMIN']), (req, res) => {
    const { userId, status } = req.body; // status: 'APPROVED' o 'REJECTED'
    db.run("UPDATE users SET status = ? WHERE id = ?", [status, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
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

// Añadir pregunta a la encuesta de un evento
app.post('/api/surveys/questions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { event_id, question, type, options } = req.body;
    db.run("INSERT INTO surveys (id, event_id, question, type, options) VALUES (?, ?, ?, ?, ?)", 
        [uuidv4(), event_id, question, type || 'stars', options || null], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Invitados
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        res.json(rows);
    });
});

// --- MAILING ENGINE ---
async function sendEmail(eventId, type, guestData) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM event_mailing_config WHERE event_id = ?", [eventId], async (err, config) => {
            if (err || !config) return resolve(false);

            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                auth: { user: config.smtp_user, pass: config.smtp_pass }
            });

            let subject = type === 'welcome' ? config.welcome_subject : config.survey_subject;
            let body = type === 'welcome' ? config.welcome_body : config.survey_body;

            // Reemplazo de variables dinámicas
            const vars = { '{{nombre}}': guestData.name, '{{evento}}': guestData.eventName || 'el evento' };
            Object.keys(vars).forEach(k => {
                subject = subject.replace(new RegExp(k, 'g'), vars[k]);
                body = body.replace(new RegExp(k, 'g'), vars[k]);
            });

            try {
                await transporter.sendMail({
                    from: `"Check | ${guestData.eventName}" <${config.smtp_user}>`,
                    to: guestData.email,
                    subject: subject,
                    html: body.replace(/\n/g, '<br>')
                });
                console.log(`Email de ${type} enviado a ${guestData.email}`);
                resolve(true);
            } catch (error) {
                console.error("Error enviando email:", error);
                resolve(false);
            }
        });
    });
}

// Configuración de Mailing por Evento
app.post('/api/mailing-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { event_id, host, port, user, pass, welcome_sub, welcome_body, survey_sub, survey_body } = req.body;
    const id = uuidv4();

    db.run(`INSERT OR REPLACE INTO event_mailing_config (id, event_id, smtp_host, smtp_port, smtp_user, smtp_pass, welcome_subject, welcome_body, survey_subject, survey_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, event_id, host, port, user, pass, welcome_sub, welcome_body, survey_sub, survey_body], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Obtener configuración de Mailing
app.get('/api/mailing-config/:eventId', authMiddleware(), (req, res) => {
    db.get("SELECT * FROM event_mailing_config WHERE event_id = ?", [req.params.eventId], (err, row) => {
        res.json(row || {});
    });
});

// Check-in (Trigger Real-time & Email)
app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;

    db.get(`
        SELECT g.event_id, g.name, g.email, e.name as eventName 
        FROM guests g JOIN events e ON g.event_id = e.id 
        WHERE g.id = ?
    `, [req.params.guestId], (err, guest) => {
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], (err) => {
            // Repuesta inmediata al UI
            res.json({ success: true });

            // Eventos asíncronos (Real-time & Email)
            io.to(guest.event_id).emit('checkin_update', { guestId: req.params.guestId, status });
            
            if (status && guest.email) {
                sendEmail(guest.event_id, 'welcome', guest);
            }
        });
    });
});

// Stats Avanzadas (Real-time compatible)
app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eventId = req.params.eventId;
    
    const queries = {
        general: `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn,
                    SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite,
                    COUNT(DISTINCT organization) as orgs
                  FROM guests WHERE event_id = ?`,
        health: `SELECT COUNT(*) as count FROM guests 
                 WHERE event_id = ? AND (dietary_notes LIKE '%vegano%' OR dietary_notes LIKE '%alergia%' OR dietary_notes IS NOT NULL AND dietary_notes != '')`,
        gender: `SELECT gender, COUNT(*) as count FROM guests WHERE event_id = ? GROUP BY gender`,
        flow: `SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count 
               FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL 
               GROUP BY hour ORDER BY hour ASC`
    };

    db.get(queries.general, [eventId], (err, general) => {
        db.get(queries.health, [eventId], (err, health) => {
            db.all(queries.gender, [eventId], (err, genders) => {
                db.all(queries.flow, [eventId], (err, flow) => {
                    const m = genders.find(g => g.gender === 'M')?.count || 0;
                    const f = genders.find(g => g.gender === 'F')?.count || 0;
                    
                    res.json({
                        ...general,
                        healthAlerts: health.count,
                        genderRatio: f > 0 ? (m / f).toFixed(1) : m.toFixed(1),
                        flowData: flow
                    });
                });
            });
        });
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
