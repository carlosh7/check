const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const xlsx = require('xlsx');
const qrcode = require('qrcode');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

const upload = multer({ dest: 'uploads/' });

const fs = require('fs');
const pdfParse = require('pdf-parse');

// --- API ROUTES ---

// Registro de nuevo Administrador
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], function(err) {
        if (err) {
            return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        }
        res.json({ success: true, userId: this.lastID });
    });
});

// Login Simple
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            res.json({ success: true, userId: row.id, username: row.username });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Obtener eventos filtrados por usuario
app.get('/api/events', (req, res) => {
    const { userId } = req.query;
    const query = userId ? "SELECT * FROM events WHERE user_id = ?" : "SELECT * FROM events";
    const params = userId ? [userId] : [];
    db.all(query, params, (err, rows) => {
        res.json(rows);
    });
});

// Crear evento vinculado a un usuario
app.post('/api/events', (req, res) => {
    const { userId, name, date, location, description } = req.body;
    db.run("INSERT INTO events (user_id, name, date, location, description) VALUES (?, ?, ?, ?, ?)", 
        [userId, name, date, location, description], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
    });
});

// Borrar evento y sus invitados
app.delete('/api/events/:id', (req, res) => {
    const eventId = req.params.id;
    db.serialize(() => {
        db.run("DELETE FROM guests WHERE event_id = ?", [eventId]);
        db.run("DELETE FROM events WHERE id = ?", [eventId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Registro de invitado (Público)
app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization } = req.body;
    db.run("INSERT INTO guests (event_id, name, email, phone, organization) VALUES (?, ?, ?, ?, ?)",
        [event_id, name, email, phone, organization], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Obtener invitados de un evento
app.get('/api/guests/:eventId', (req, res) => {
    db.all("SELECT * FROM guests WHERE event_id = ?", [req.params.eventId], (err, rows) => {
        res.json(rows);
    });
});

// Toggle Check-in
app.post('/api/checkin/:guestId', (req, res) => {
    const { status } = req.body;
    const time = status ? new Date().toISOString() : null;
    db.run("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?", [status ? 1 : 0, time, req.params.guestId], (err) => {
        res.json({ success: true });
    });
});

// Dashboard Stats
app.get('/api/stats/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn
        FROM guests WHERE event_id = ?
    `, [eventId], (err, row) => {
        res.json(row);
    });
});

// Importar Excel (Más robusto)
app.post('/api/import/:eventId', upload.single('file'), (req, res) => {
    const eventId = req.params.eventId;
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const stmt = db.prepare("INSERT INTO guests (event_id, name, email, phone, organization) VALUES (?, ?, ?, ?, ?)");
    data.forEach(row => {
        // Normalizar nombres de columnas
        const name = row.Nombre || row.nombre || row.Name || row.name || "";
        const email = row.Email || row.email || row.Correo || "";
        const phone = row.Telefono || row.telefono || row.Phone || "";
        const org = row.Empresa || row.empresa || row.Organización || row.organization || "";
        
        if (name) stmt.run(eventId, name, email, phone, org);
    });
    stmt.finalize();
    res.json({ success: true, count: data.length });
});

// Importar PDF
app.post('/api/import-pdf/:eventId', upload.single('file'), (req, res) => {
    const eventId = req.params.eventId;
    const dataBuffer = fs.readFileSync(req.file.path);

    pdfParse(dataBuffer).then(function(data) {
        // Lógica de parsing simple: asume que cada línea es un registro
        // Formato esperado: Nombre, Email, Telefono, Organización
        const lines = data.text.split('\n').filter(l => l.trim().length > 5);
        const stmt = db.prepare("INSERT INTO guests (event_id, name, email, phone, organization) VALUES (?, ?, ?, ?, ?)");
        
        lines.forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 1) {
                stmt.run(eventId, parts[0], parts[1] || "", parts[2] || "", parts[3] || "");
            }
        });
        stmt.finalize();
        res.json({ success: true, count: lines.length });
    });
});

// --- ENCUESTAS Y QR ---

// Generar QR para encuesta del evento
app.get('/api/events/:id/qrcode', async (req, res) => {
    const eventId = req.params.id;
    // URL que llevará a la página pública de encuesta
    const surveyUrl = `${req.protocol}://${req.get('host')}/survey.html?eventId=${eventId}`;
    try {
        const qrImage = await qrcode.toDataURL(surveyUrl);
        res.json({ qrCode: qrImage });
    } catch (err) {
        res.status(500).json({ error: 'Error al generar QR' });
    }
});

// Enviar respuesta de encuesta
app.post('/api/surveys/respond', (req, res) => {
    const { event_id, guest_id, rating, comment } = req.body;
    db.run("INSERT INTO survey_responses (event_id, guest_id, rating, comment) VALUES (?, ?, ?, ?)",
        [event_id, guest_id, rating, comment], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Obtener estadísticas de satisfacción
app.get('/api/surveys/stats/:eventId', (req, res) => {
    db.get(`
        SELECT 
            AVG(rating) as avgRating,
            COUNT(*) as totalResponses
        FROM survey_responses WHERE event_id = ?
    `, [req.params.eventId], (err, row) => {
        res.json(row || { avgRating: 0, totalResponses: 0 });
    });
});

app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
