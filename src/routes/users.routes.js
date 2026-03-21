/**
 * Rutas de usuarios
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId, castId, getProducerGroups } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Obtener usuarios
router.get('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    let rows;
    if (req.userRole === 'ADMIN') {
        rows = db.prepare("SELECT id, username, display_name, phone, role, role_detail, status, created_at, group_id FROM users ORDER BY display_name || username ASC").all();
    } else {
        const groupIds = getProducerGroups(req.userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT id, username, display_name, phone, role, role_detail, status, created_at, group_id FROM users WHERE group_id IN (${placeholders}) ORDER BY display_name || username ASC`).all(...groupIds);
        }
    }
    
    const usersWithDetails = rows.map(u => {
        const group = u.group_id ? db.prepare("SELECT name FROM groups WHERE id = ?").get(u.group_id) : null;
        const events = db.prepare("SELECT event_id FROM user_events WHERE user_id = ?").all(u.id);
        return {
            ...u,
            group_name: group?.name || null,
            events: events.map(e => e.event_id)
        };
    });
    
    res.json(usersWithDetails);
});

// Crear usuario (signup/admin)
router.post('/', (req, res) => {
    const { username, password, role } = req.body;
    const id = getValidId('users');
    const status = (role === 'ADMIN') ? 'APPROVED' : 'PENDING';
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username, hashedPassword, role || 'PRODUCTOR', status, new Date().toISOString());
        res.json({ success: true, userId: id, status });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Invitar usuario (ADMIN)
router.post('/invite', authMiddleware(['ADMIN']), (req, res) => {
    const { username, password, role, display_name, phone, group_id } = req.body;
    const id = getValidId('users');
    
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)")
          .run(id, username.toLowerCase(), hashedPassword, role || 'PRODUCTOR', display_name || username, phone || '', group_id || null, new Date().toISOString());
        
        res.json({ success: true, userId: id });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Cambiar estado de usuario (ADMIN)
router.put('/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const newStatus = req.body.status;
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(newStatus, targetId);
    res.json({ success: true });
});

// Cambiar contraseña
router.put('/:id/password', authMiddleware(), (req, res) => {
    const targetId = castId('users', req.params.id);
    if (req.userRole !== 'ADMIN' && req.userId !== targetId) {
        return res.status(403).json({ error: 'Acceso Denegado' });
    }
    
    const hashedPassword = bcrypt.hashSync(req.body.password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, targetId);
    res.json({ success: true });
});

// Eliminar usuario (ADMIN)
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    
    if (targetId === req.userId) {
        return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    
    db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
    res.json({ success: true });
});

module.exports = router;
