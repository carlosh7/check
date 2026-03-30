/**
 * Rutas de usuarios
 */

const z = require('zod');
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId, castId, getProducerGroups } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

const router = express.Router();

// Obtener usuario por ID
router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    
    // Solo el propio usuario o ADMIN pueden ver los datos
    if (req.userId !== targetId && req.userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes acceso a este usuario' });
    }
    
    try {
        const user = db.prepare("SELECT id, username, display_name, phone, role, status, group_id FROM users WHERE id = ?").get(targetId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        // Obtener grupos del usuario
        const groups = db.prepare(`
            SELECT g.id, g.name FROM groups g
            JOIN group_users gu ON gu.group_id = g.id
            WHERE gu.user_id = ?
        `).all(targetId);
        
        res.json({
            ...user,
            groups: groups
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

router.get('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    let rows;
    if (req.userRole === 'ADMIN') {
        rows = db.prepare("SELECT id, username, display_name, phone, role, role_detail, status, created_at FROM users ORDER BY display_name || username ASC").all();
    } else {
        const groupIds = getProducerGroups(req.userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            // Buscar usuarios que estén asignados a los grupos del PRODUCTOR
            const validUsers = db.prepare(`SELECT DISTINCT user_id FROM group_users WHERE group_id IN (${placeholders})`).all(...groupIds).map(u => u.user_id);
            if (validUsers.length === 0) {
                rows = [];
            } else {
                const uPlaceholders = validUsers.map(() => '?').join(',');
                rows = db.prepare(`SELECT id, username, display_name, phone, role, role_detail, status, created_at FROM users WHERE id IN (${uPlaceholders}) ORDER BY display_name || username ASC`).all(...validUsers);
            }
        }
    }

    const usersWithDetails = rows.map(u => {
        // Obtenemos tooooodos los grupos a los que pertenece el usuario desde la tabla pivot
        const userGroups = db.prepare("SELECT g.id, g.name FROM group_users gu JOIN groups g ON gu.group_id = g.id WHERE gu.user_id = ?").all(u.id);
        const events = db.prepare("SELECT event_id FROM user_events WHERE user_id = ?").all(u.id);
        
        return {
            ...u,
            groups: userGroups, // Ahora es un Array de objetos {id, name}
            events: events.map(e => e.event_id)
        };
    });

    res.json(usersWithDetails);
});

router.post('/', (req, res) => {
    const v = validate(schemas.signup, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username, password, role } = v.data;
    const { group_id, event_id } = req.body; // Campos opcionales para asignación automática
    
    const id = getValidId('users');
    const status = (role === 'ADMIN') ? 'APPROVED' : 'PENDING';
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username, hashedPassword, role || 'PRODUCTOR', status, new Date().toISOString());
        
        // Asignar a grupo si se proporciona
        if (group_id) {
            db.prepare("INSERT INTO group_users (id, group_id, user_id, created_at) VALUES (?, ?, ?, ?)")
              .run(getValidId('group_users'), group_id, id, new Date().toISOString());
        }
        
        // Asignar a evento si se proporciona
        if (event_id) {
            db.prepare("INSERT INTO event_users (id, event_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
              .run(getValidId('event_users'), event_id, id, 'COLABORADOR', new Date().toISOString());
        }
        
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
        
        // Insertamos el usuario (mantenemos group_id por retrocompatibilidad inmediata si no la hemos purgado de DB schema pero lo ideal es dejarlo nulo)
        db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?)")
          .run(id, username.toLowerCase(), hashedPassword, role, display_name || username, phone || '', new Date().toISOString());

        // Inserción multi-tenant en group_users
        if (group_id) {
            const groupsArray = Array.isArray(group_id) ? group_id : [group_id];
            const insertGroup = db.prepare("INSERT INTO group_users (id, group_id, user_id, created_at) VALUES (?, ?, ?, ?)");
            groupsArray.forEach(gId => {
                insertGroup.run(getValidId('group_users'), gId, id, new Date().toISOString());
            });
        }

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

// Actualizar usuario (editar colaborador)
router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    
    // Permisos: ADMIN puede editar cualquier usuario, PRODUCTOR solo puede editar usuarios que no sean ADMIN
    // EXCEPCIÓN: cualquier usuario puede editar su propio perfil
    if (req.userId !== targetId && req.userRole !== 'ADMIN') {
        const targetUser = db.prepare("SELECT role FROM users WHERE id = ?").get(targetId);
        if (!targetUser || targetUser.role === 'ADMIN') {
            return res.status(403).json({ error: 'No tienes permiso para editar este usuario' });
        }
    }
    
    const { username, display_name, role, password } = req.body;
    
    // Validar username si se proporciona
    if (username) {
        if (typeof username !== 'string' || username.length < 5 || !username.includes('@')) {
            return res.status(400).json({ error: 'El email debe ser válido' });
        }
        // Verificar que el username no esté en uso por otro usuario
        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, targetId);
        if (existing) {
            return res.status(400).json({ error: 'El email ya está en uso' });
        }
    }
    
    // Validar role si se proporciona (solo ADMIN puede cambiar role)
    if (role && req.userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo ADMIN puede cambiar el rol' });
    }
    
    // Construir query dinámicamente
    const updates = [];
    const params = [];
    
    if (username) {
        updates.push("username = ?");
        params.push(username);
    }
    if (display_name !== undefined) {
        updates.push("display_name = ?");
        params.push(display_name);
    }
    if (role && req.userRole === 'ADMIN') {
        updates.push("role = ?");
        params.push(role);
    }
    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        updates.push("password = ?");
        params.push(hashedPassword);
    }
    
    if (updates.length > 0) {
        params.push(targetId);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        logAction(req, AUDIT_ACTIONS.USER_UPDATED, { targetId, fields: updates });
    }
    
    const user = db.prepare("SELECT id, username, display_name, role, group_id, phone, status FROM users WHERE id = ?").get(targetId);
    res.json({ success: true, user });
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
    const roleSchema = z.enum(['ADMIN', 'PRODUCTOR', 'STAFF', 'CLIENTE', 'OTROS', 'LOGISTICO']);
    const result = roleSchema.safeParse(req.body.role);
    if (!result.success) return res.status(400).json({ errors: result.error.issues });

    const targetId = castId('users', req.params.id);
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(result.data, targetId);

    logAction(req, AUDIT_ACTIONS.USER_UPDATED, { targetId, action: 'role_change', newRole: result.data });

    res.json({ success: true });
});

// Asignar usuario a múltiples grupos (ADMIN) V12.6.0
router.put('/:id/group', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { group_id } = req.body; 
    
    // Convertimos la entrada a un array sin importar lo que regrese para que soporte N Empresas
    const groupsArray = Array.isArray(group_id) ? group_id : (group_id ? [group_id] : []);
    
    // Transacción para limpiar e insertar
    const deleteGroupUser = db.prepare("DELETE FROM group_users WHERE user_id = ?");
    const insertGroupUser = db.prepare("INSERT INTO group_users (id, group_id, user_id, created_at) VALUES (?, ?, ?, ?)");
    
    try {
        db.transaction(() => {
            deleteGroupUser.run(targetId);
            groupsArray.forEach(gId => {
                insertGroupUser.run(getValidId('group_users'), gId, targetId, new Date().toISOString());
            });
            // Re-vincular de manera legacy si hace falta a null
            db.prepare("UPDATE users SET group_id = NULL WHERE id = ?").run(targetId);
        })();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Asignar usuario a eventos (ADMIN/PRODUCTOR)
router.put('/:id/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { events } = req.body;
    
    if (req.userRole === 'PRODUCTOR') {
        // PRODUCTOR puede editar su propio usuario
        if (req.userId === targetId) {
            // Permitido - el usuario se edita a sí mismo
        } else {
            // PRODUCTOR puede editar otros usuarios solo si son de su empresa
            const userGroups = getProducerGroups(req.userId);
            const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
            if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
                return res.status(403).json({ error: 'No tienes acceso a este usuario' });
            }
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
        // PRODUCTOR puede editar su propio usuario
        if (req.userId === targetId) {
            // Permitido - el usuario se edita a sí mismo
        } else {
            // PRODUCTOR puede editar otros usuarios solo si son de su empresa
            const userGroups = getProducerGroups(req.userId);
            const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
            if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
                return res.status(403).json({ error: 'No tienes acceso a este usuario' });
            }
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
    
    const { display_name, phone, group_id, username } = req.body;
    
    // Validar username si se proporciona
    if (username) {
        if (typeof username !== 'string' || username.length < 5 || !username.includes('@')) {
            return res.status(400).json({ error: 'El email debe ser válido' });
        }
        // Verificar que el username no esté en uso por otro usuario
        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, targetId);
        if (existing) {
            return res.status(400).json({ error: 'El email ya está en uso' });
        }
    }
    
    // Construir query dinámicamente
    const updates = [];
    const params = [];
    
    if (display_name !== undefined) {
        updates.push("display_name = ?");
        params.push(display_name);
    }
    if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(phone);
    }
    if (username) {
        updates.push("username = ?");
        params.push(username);
    }
    if (req.userRole === 'ADMIN' && group_id !== undefined) {
        updates.push("group_id = ?");
        params.push(group_id || null);
    }
    
    if (updates.length > 0) {
        params.push(targetId);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    const user = db.prepare("SELECT id, username, display_name, role, group_id, phone, status FROM users WHERE id = ?").get(targetId);
    res.json({ success: true, user });
});

// Eliminar usuario
router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    
    // PRODUCTOR no puede eliminar usuarios
    if (req.userRole === 'PRODUCTOR') {
        return res.status(403).json({ error: 'No tienes permisos para eliminar usuarios' });
    }
    
    // No puede eliminarse a sí mismo
    if (targetId === req.userId) {
        return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    
    try {
        // Verificar que el usuario existe
        const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // No eliminar admins
        if (user.role === 'ADMIN') {
            return res.status(400).json({ error: 'No se pueden eliminar usuarios ADMIN' });
        }
        
        // Eliminar de grupos
        db.prepare("DELETE FROM group_users WHERE user_id = ?").run(targetId);
        
        // Eliminar de eventos
        db.prepare("DELETE FROM event_users WHERE user_id = ?").run(targetId);
        
        // Eliminar usuario
        db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
        
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting user:', e);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;
