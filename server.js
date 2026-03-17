const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

const upload = multer({ dest: 'uploads/' });

// --- API ROUTES ---

// Login Simple
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            res.json({ success: true, user: { id: row.id, username: row.username } });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    });
});

// Obtener todos los eventos
app.get('/api/events', (req, res) => {
    db.all("SELECT * FROM events", [], (err, rows) => {
        res.json(rows);
    });
});

// Crear evento
app.post('/api/events', (req, res) => {
    const { name, date, location, description } = req.body;
    db.run("INSERT INTO events (name, date, location, description) VALUES (?, ?, ?, ?)", 
        [name, date, location, description], function(err) {
        res.json({ id: this.lastID });
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

// Importar Excel
app.post('/api/import/:eventId', upload.single('file'), (req, res) => {
    const eventId = req.params.eventId;
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const stmt = db.prepare("INSERT INTO guests (event_id, name, email, phone, organization) VALUES (?, ?, ?, ?, ?)");
    data.forEach(row => {
        stmt.run(eventId, row.Nombre || row.name, row.Email || row.email, row.Telefono || row.phone, row.Empresa || row.organization);
    });
    stmt.finalize();
    res.json({ success: true, count: data.length });
});

app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
