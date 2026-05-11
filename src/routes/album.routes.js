/**
 * Rutas de Álbum de Fotos Compartido (C11-07)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const UPLOAD_DIR = process.env.DATA_PATH ? path.join(process.env.DATA_PATH, 'photos') : path.join(__dirname, '../../uploads/photos');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: function(req, file, cb) { cb(null, Date.now() + '_' + uuidv4().slice(0, 8) + path.extname(file.originalname)); }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'), false);
        cb(null, true);
    }
});

// Subir foto (público — con guest_token)
router.post('/upload', upload.single('photo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
        var { guest_token, caption, event_id } = req.body;
        if (!guest_token || !event_id) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'guest_token y event_id requeridos' }); }
        var guest = db.prepare("SELECT id FROM guests WHERE qr_token = ? AND event_id = ?").get(guest_token, event_id);
        if (!guest) { fs.unlinkSync(req.file.path); return res.status(401).json({ error: 'Invitado no válido' }); }
        var id = uuidv4();
        db.prepare("INSERT INTO event_photos (id, event_id, guest_id, filename, caption, approved) VALUES (?, ?, ?, ?, ?, 0)").run(
            id, event_id, guest.id, req.file.filename, caption || ''
        );
        res.json({ success: true, id: id, filename: req.file.filename });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Listar fotos aprobadas (público)
router.get('/:eventId', (req, res) => {
    try {
        var photos = db.prepare("SELECT ep.*, g.name as guest_name FROM event_photos ep LEFT JOIN guests g ON g.id = ep.guest_id WHERE ep.event_id = ? AND ep.approved = 1 ORDER BY ep.created_at DESC").all(req.params.eventId);
        photos.forEach(function(p) { p.url = '/uploads/photos/' + p.filename; });
        res.json(photos);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Listar todas las fotos (admin — incluye no aprobadas)
router.get('/:eventId/admin', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var photos = db.prepare("SELECT ep.*, g.name as guest_name FROM event_photos ep LEFT JOIN guests g ON g.id = ep.guest_id WHERE ep.event_id = ? ORDER BY ep.approved ASC, ep.created_at DESC").all(req.params.eventId);
        photos.forEach(function(p) { p.url = '/uploads/photos/' + p.filename; });
        res.json(photos);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Aprobar foto
router.patch('/:eventId/:photoId/approve', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("UPDATE event_photos SET approved = 1 WHERE id = ? AND event_id = ?").run(req.params.photoId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Rechazar/Eliminar foto
router.delete('/:eventId/:photoId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var photo = db.prepare("SELECT * FROM event_photos WHERE id = ? AND event_id = ?").get(req.params.photoId, req.params.eventId);
        if (photo && photo.filename) {
            var filePath = path.join(UPLOAD_DIR, photo.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.prepare("DELETE FROM event_photos WHERE id = ? AND event_id = ?").run(req.params.photoId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
