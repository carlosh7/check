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
    console.log('Cliente conectado:', socket.id);
    socket.on('join_event', (eventId) => {
        socket.join(eventId);
    });
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
            if (row.status !== 'APPROVED') {
                return res.status(403).json({ success: false, message: 'Cuenta pendiente de aprobación' });
            }
            res.json({ success: true, userId: row.id, role: row.role, username: row.username });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Admin Users
app.get('/api/admin/users/pending', authMiddleware(['ADMIN']), (req, res) => {
    db.all("SELECT id, username, role, created_at FROM users WHERE status = 'PENDING'", (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/users/approve', authMiddleware(['ADMIN']), (req, res) => {
    const { userId, status } = req.body;
    db.run("UPDATE users SET status = ? WHERE id = ?", [status, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Events
app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.headers['x-user-id'];
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

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, description, logo_url } = req.body;
    db.run("UPDATE events SET name = ?, date = ?, location = ?, description = ?, logo_url = ? WHERE id = ?",
        [name, date, location, description, logo_url, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.run("DELETE FROM events WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Surveys
app.post('/api/surveys/questions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { event_id, question, type, options } = req.body;
    db.run("INSERT INTO surveys (id, event_id, question, type, options) VALUES (?, ?, ?, ?, ?)", 
        [uuidv4(), event_id, question, type || 'stars', options || null], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get('/api/surveys/questions/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM surveys WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/surveys/questions/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    db.run("DELETE FROM surveys WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Guests
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Import Engine (Enhanced for Excel & PDF)
app.post('/api/import-dry-run', authMiddleware(['ADMIN', 'PRODUCTOR']), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { eventId } = req.body;
    let data = [];

    try {
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            // Extracción simple de emails y nombres (Regex)
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const emails = pdfData.text.match(emailRegex) || [];
            data = emails.map(email => ({ name: email.split('@')[0], email, organization: "PDF Import", phone: "", gender: "O" }));
        } else {
            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const excelData = xlsx.utils.sheet_to_json(sheet);
            data = excelData.map(row => ({
                name: row.Nombre || row.nombre || row.name || "Invitado PDF",
                email: (row.Email || row.email || row.correo || "").toString(),
                organization: row.Organizacion || row.Empresa || row.organization || "",
                phone: row.Telefono || row.phone || "",
                gender: row.Genero || row.gender || "O"
            }));
        }
        fs.unlinkSync(req.file.path);

        db.all("SELECT email FROM guests WHERE event_id = ?", [eventId], (err, existingGuests) => {
            const existingEmails = new Set(existingGuests.map(g => g.email ? g.email.toLowerCase() : ""));
            let newCount = 0;
            let existingCount = 0;
            const uniqueGuests = data.filter(g => {
                const email = g.email.toLowerCase();
                if (email && existingEmails.has(email)) {
                    existingCount++;
                    return false;
                }
                newCount++;
                return true;
            });
            res.json({ summary: { new: newCount, existing: existingCount }, data: uniqueGuests });
        });
    } catch (e) {
        res.status(500).json({ error: "Error procesando archivo" });
    }
});

app.post('/api/import-confirm', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { eventId, guests } = req.body;
    const stmt = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    guests.forEach(g => {
        stmt.run([uuidv4(), eventId, g.name, g.email, g.organization, g.phone, g.gender, uuidv4()]);
    });
    stmt.finalize();
    io.to(eventId).emit('update_stats', eventId);
    res.json({ success: true });
});

// Advanced Export & Cleanup
app.get('/api/export-excel/:eventId', authMiddleware(), (req, res) => {
    db.all("SELECT name, email, organization, phone, gender, checked_in, checkin_time FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        if (err) return res.status(500).send(err.message);
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
        res.json({ success: true, message: "Base de datos del evento limpiada." });
    });
});

// Survey Responses
app.post('/api/surveys/respond', (req, res) => {
    const { event_id, guest_id, rating, comment } = req.body;
    const id = uuidv4();
    const responsesJson = JSON.stringify({ rating, comment });
    db.run("INSERT INTO survey_responses (id, event_id, guest_id, responses_json, submitted_at) VALUES (?, ?, ?, ?, ?)",
        [id, event_id, guest_id, responsesJson, new Date().toISOString()], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Mailing Engine
async function sendEmail(eventId, type, guestData) {
    db.get("SELECT * FROM event_mailing_config WHERE event_id = ?", [eventId], async (err, config) => {
        if (err || !config) return;

        const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: config.smtp_port,
            auth: { user: config.smtp_user, pass: config.smtp_pass }
        });

        let subject = type === 'welcome' ? config.welcome_subject : config.survey_subject;
        let body = type === 'welcome' ? config.welcome_body : config.survey_body;

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
        } catch (error) {
            console.error("Error enviando email:", error);
        }
    });
}

app.post('/api/mailing-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { event_id, host, port, user, pass, welcome_sub, welcome_body, survey_sub, survey_body } = req.body;
    db.run(`INSERT OR REPLACE INTO event_mailing_config (id, event_id, smtp_host, smtp_port, smtp_user, smtp_pass, welcome_subject, welcome_body, survey_subject, survey_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), event_id, host, port, user, pass, welcome_sub, welcome_body, survey_sub, survey_body], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get('/api/mailing-config/:eventId', authMiddleware(), (req, res) => {
    db.get("SELECT * FROM event_mailing_config WHERE event_id = ?", [req.params.eventId], (err, row) => {
        res.json(row || {});
    });
});

// Check-in
app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;

    db.get("SELECT g.*, e.name as eventName FROM guests g JOIN events e ON g.event_id = e.id WHERE g.id = ?", [req.params.guestId], (err, guest) => {
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], (err) => {
            res.json({ success: true });
            io.to(guest.event_id).emit('checkin_update', { guestId: req.params.guestId, status });
            io.to(guest.event_id).emit('update_stats', guest.event_id);
            if (status && guest.email) sendEmail(guest.event_id, 'welcome', guest);
        });
    });
});

// Stats
app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eventId = req.params.eventId;
    const queries = {
        general: "SELECT COUNT(*) as total, SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite, COUNT(DISTINCT organization) as orgs FROM guests WHERE event_id = ?",
        health: "SELECT COUNT(*) as count FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')",
        gender: "SELECT gender, COUNT(*) as count FROM guests WHERE event_id = ? GROUP BY gender",
        flow: "SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL GROUP BY hour ORDER BY hour ASC"
    };

    db.get(queries.general, [eventId], (err, general) => {
        db.get(queries.health, [eventId], (err, health) => {
            db.all(queries.gender, [eventId], (err, genders) => {
                db.all(queries.flow, [eventId], (err, flow) => {
                    const m = genders.find(g => g.gender === 'M')?.count || 0;
                    const f = genders.find(g => g.gender === 'F')?.count || 0;
                    res.json({ ...general, healthAlerts: health.count, genderRatio: f > 0 ? (m / f).toFixed(1) : m.toFixed(1), flowData: flow });
                });
            });
        });
    });
});

// Public Registration
app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    const id = uuidv4();
    db.run("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [id, event_id, name, email, phone, organization, gender, dietary_notes, uuidv4()], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            io.to(event_id).emit('update_stats', event_id);
            res.json({ success: true, id });
        });
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    res.json({ url: `/uploads/${req.file.filename}` });
});

server.listen(port, () => {
    console.log(`Servidor MAESTRO ejecutándose en http://localhost:${port}`);
});
