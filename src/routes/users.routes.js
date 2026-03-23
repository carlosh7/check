/**
 * Rutas de usuarios
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId, castId, getProducerGroups } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

const router = express.Router();

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

router.post('/', (req, res) => {
    const v = validate(schemas.signup, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username, password, role } = v.data;
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

router.post('/invite', authMiddleware(['ADMIN']), (req, res) => {
    const v = validate(schemas.createUser, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username, password, role, display_name, phone, group_id } = v.data;
    const id = getValidId('users');

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)")
          .run(id, username.toLowerCase(), hashedPassword, role, display_name || username, phone || '', group_id || null, new Date().toISOString());

        logAction(req, AUDIT_ACTIONS.USER_CREATED, { userId: id, username, role });

        res.json({ success: true, userId: id });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Cambiar estado de usuario (ADMIN)
router.put('/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    const v = validate(schemas.updateUser, { status: req.body.status });
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const targetId = castId('users', req.params.id);
    const newStatus = v.data.status;

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(newStatus, targetId);

    logAction(req, AUDIT_ACTIONS.USER_UPDATED, { targetId, action: 'status_change', newStatus });

    res.json({ success: true });
});

// Cambiar contraseña
router.put('/:id/password', authMiddleware(), (req, res) => {
    const v = validate(schemas.changePassword, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const targetId = castId('users', req.params.id);
    if (req.userRole !== 'ADMIN' && req.userId !== targetId) {
        return res.status(403).json({ error: 'Acceso Denegado' });
    }

    const hashedPassword = bcrypt.hashSync(v.data.newPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, targetId);

    logAction(req, AUDIT_ACTIONS.USER_PASSWORD_CHANGED, { targetId });

    res.json({ success: true });
});

// Eliminar usuario (ADMIN)
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);

    if (targetId === req.userId) {
        return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(targetId);

    logAction(req, AUDIT_ACTIONS.USER_DELETED, { targetId });

    res.json({ success: true });
});

// Cambiar rol de usuario (ADMIN)
router.put('/:id/role', authMiddleware(['ADMIN']), (req, res) => {
    const v = validate(z => z.enum(['ADMIN', 'PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS', 'LOGISTICO']), req.body.role);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const targetId = castId('users', req.params.id);
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(v.data, targetId);

    logAction(req, AUDIT_ACTIONS.USER_UPDATED, { targetId, action: 'role_change', newRole: v.data });

    res.json({ success: true });
});

// Asignar usuario a grupo (ADMIN)
router.put('/:id/group', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { group_id } = req.body;
    db.prepare("UPDATE users SET group_id = ? WHERE id = ?").run(group_id || null, targetId);
    res.json({ success: true });
});

// Asignar usuario a eventos (ADMIN/PRODUCTOR)
router.put('/:id/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { events } = req.body;
    
    if (req.userRole === 'PRODUCTOR') {
        const userGroups = getProducerGroups(req.userId);
        const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
        if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
            return res.status(403).json({ error: 'No tienes acceso a este usuario' });
        }
    }
    
    db.prepare("DELETE FROM user_events WHERE user_id = ?").run(targetId);
    
    if (events && events.length > 0) {
        const insert = db.prepare("INSERT INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)");
        events.forEach(eventId => {
            insert.run(getValidId('user_events'), targetId, eventId, new Date().toISOString());
        });
    }
    
    res.json({ success: true });
});

// Quitar un evento de un usuario (ADMIN/PRODUCTOR)
router.delete('/:id/events/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const eventId = castId('events', req.params.eventId);
    
    if (req.userRole === 'PRODUCTOR') {
        const userGroups = getProducerGroups(req.userId);
        const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
        if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
            return res.status(403).json({ error: 'No tienes acceso a este usuario' });
        }
    }
    
    db.prepare("DELETE FROM user_events WHERE user_id = ? AND event_id = ?").run(targetId, eventId);
    res.json({ success: true });
});

// Actualizar perfil de usuario
router.put('/:id/profile', authMiddleware(), (req, res) => {
    const targetId = castId('users', req.params.id);
    
    if (req.userRole !== 'ADMIN' && req.userId !== targetId) {
        return res.status(403).json({ error: 'Acceso Denegado' });
    }
    
    const { display_name, phone, group_id } = req.body;
    
    if (req.userRole === 'ADMIN') {
        db.prepare("UPDATE users SET display_name = ?, phone = ?, group_id = ? WHERE id = ?")
          .run(display_name || '', phone || '', group_id || null, targetId);
    } else {
        db.prepare("UPDATE users SET display_name = ?, phone = ? WHERE id = ?")
          .run(display_name || '', phone || '', targetId);
    }
    
    const user = db.prepare("SELECT id, username, display_name, role, group_id, phone, status FROM users WHERE id = ?").get(targetId);
    res.json({ success: true, user });
});

module.exports = router;
