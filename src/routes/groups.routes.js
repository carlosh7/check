/**
 * Rutas de Grupos y Users-Groups
 */

const express = require('express');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { CACHE_KEYS, del } = require('../utils/cache');

const router = express.Router();

// Obtener grupos
router.get('/', authMiddleware(), (req, res) => {
    if (req.userRole === 'ADMIN') {
        const rows = db.prepare("SELECT * FROM groups ORDER BY created_at DESC").all();
        return res.json(rows);
    }
    
    const groupIds = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(req.userId).map(g => g.group_id);
    if (groupIds.length === 0) return res.json([]);
    
    const placeholders = groupIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM groups WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...groupIds);
    res.json(rows);
});

// Crear grupo
router.post('/', authMiddleware(['ADMIN']), (req, res) => {
    const { name, description, email, phone } = req.body;
    const id = getValidId('groups');
    
    db.prepare("INSERT INTO groups (id, name, description, email, phone, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)")
      .run(id, name, description || '', email || '', phone || '', new Date().toISOString(), req.userId);
    
    res.json({ success: true, groupId: id });
});

// Actualizar grupo
router.put('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const { name, description, email, phone, status } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    
    if (updates.length > 0) {
        values.push(castId('groups', req.params.id));
        db.prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    res.json({ success: true });
});

// Eliminar grupo
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const groupId = castId('groups', req.params.id);
    
    // Primero desvincular usuarios del grupo
    db.prepare("UPDATE users SET group_id = NULL WHERE group_id = ?").run(groupId);
    
    // Desvincular eventos del grupo
    db.prepare("UPDATE events SET group_id = NULL WHERE group_id = ?").run(groupId);
    
    // Eliminar relaciones en group_users
    db.prepare("DELETE FROM group_users WHERE group_id = ?").run(groupId);
    
    // Eliminar el grupo
    db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    
    res.json({ success: true });
});

// Obtener usuarios de grupo
router.get('/:groupId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    const rows = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.role_detail, u.status, gu.role_in_group 
        FROM users u 
        JOIN group_users gu ON u.id = gu.user_id 
        WHERE gu.group_id = ?
        ORDER BY u.display_name || u.username
    `).all(groupId);
    res.json(rows);
});

// Agregar usuario a grupo
router.post('/:groupId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    const { user_id, role_in_group } = req.body;
    
    const id = getValidId('group_users');
    db.prepare("INSERT OR IGNORE INTO group_users (id, group_id, user_id, role_in_group, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, groupId, user_id, role_in_group || 'PRODUCTOR', new Date().toISOString());
    
    res.json({ success: true });
});

// Eliminar usuario de grupo
router.delete('/:groupId/users/:userId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    const userId = castId('users', req.params.userId);
    
    db.prepare("DELETE FROM group_users WHERE group_id = ? AND user_id = ?").run(groupId, userId);
    res.json({ success: true });
});

// Asignar eventos a un grupo (Mutabilidad Empresarial V12.5.0)
router.put('/:groupId/events', authMiddleware(['ADMIN']), async (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    const { events } = req.body;
    
    // Primero, liberar todos los eventos actuales de esta empresa
    db.prepare("UPDATE events SET group_id = NULL WHERE group_id = ?").run(groupId);
    
    // Asignar los nuevos eventos
    if (events && Array.isArray(events) && events.length > 0) {
        const placeholders = events.map(() => '?').join(',');
        db.prepare(`UPDATE events SET group_id = ? WHERE id IN (${placeholders})`).run(groupId, ...events);
    }
    
    // Invalidate caches
    await del(CACHE_KEYS.EVENT_LIST);
    
    res.json({ success: true });
});

module.exports = router;
