/**
 * Rutas de Clientes
 */

const express = require('express');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { CACHE_KEYS, del } = require('../utils/cache');

const router = express.Router();

// Obtener todos los clientes (filtrados por empresa para no-admin)
router.get('/', authMiddleware(), (req, res) => {
    let query = `
        SELECT c.*, g.name as company_name,
            (SELECT COUNT(*) FROM client_events WHERE client_id = c.id) as event_count
        FROM clients c
        LEFT JOIN groups g ON c.company_id = g.id
    `;
    
    const params = [];
    
    if (req.userRole !== 'ADMIN') {
        // Staff solo ve clientes asignados a través de client_users
        const assignedClients = db.prepare("SELECT client_id FROM client_users WHERE user_id = ?").all(req.userId).map(c => c.client_id);
        
        if (assignedClients.length === 0) {
            return res.json([]);
        }
        
        const placeholders = assignedClients.map(() => '?').join(',');
        query += ` WHERE c.id IN (${placeholders})`;
        params.push(...assignedClients);
    }
    
    query += " ORDER BY c.created_at DESC";
    
    const clients = db.prepare(query).all(...params);
    res.json(clients);
});

// Obtener un cliente específico con sus eventos
router.get('/:id', authMiddleware(), (req, res) => {
    const clientId = castId('clients', req.params.id);
    
    const client = db.prepare(`
        SELECT c.*, g.name as company_name
        FROM clients c
        LEFT JOIN groups g ON c.company_id = g.id
        WHERE c.id = ?
    `).get(clientId);
    
    if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Obtener eventos del cliente
    const events = db.prepare(`
        SELECT e.* FROM events e
        JOIN client_events ce ON e.id = ce.event_id
        WHERE ce.client_id = ?
    `).all(clientId);
    
    // Obtener staff asignado al cliente
    const staff = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, cu.created_at
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE cu.client_id = ?
    `).all(clientId);
    
    res.json({ ...client, events, staff });
});

// Crear cliente
router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF']), (req, res) => {
    const { name, email, phone, company_id } = req.body;
    
    if (!name || !company_id) {
        return res.status(400).json({ error: 'Nombre y empresa son requeridos' });
    }
    
    const id = getValidId('clients');
    db.prepare(`
        INSERT INTO clients (id, name, email, phone, company_id, status, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `).run(id, name, email || '', phone || '', company_id, new Date().toISOString(), req.userId);
    
    res.json({ success: true, clientId: id });
});

// Actualizar cliente
router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'STAFF']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const { name, email, phone, status } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    
    if (updates.length > 0) {
        values.push(clientId);
        db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    res.json({ success: true });
});

// Eliminar cliente
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    
    // Eliminar relaciones
    db.prepare("DELETE FROM client_events WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_users WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM clients WHERE id = ?").run(clientId);
    
    res.json({ success: true });
});

// Asignar eventos a cliente
router.put('/:id/events', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const { events } = req.body;
    
    // Eliminar eventos actuales del cliente
    db.prepare("DELETE FROM client_events WHERE client_id = ?").run(clientId);
    
    // Asignar nuevos eventos
    if (events && Array.isArray(events)) {
        const stmt = db.prepare("INSERT INTO client_events (id, client_id, event_id, created_at) VALUES (?, ?, ?, ?)");
        for (const eventId of events) {
            stmt.run(getValidId('client_events'), clientId, eventId, new Date().toISOString());
        }
    }
    
    res.json({ success: true });
});

// Asignar staff a cliente
router.put('/:id/staff', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const { users } = req.body;
    
    // Eliminar staff actual del cliente
    db.prepare("DELETE FROM client_users WHERE client_id = ?").run(clientId);
    
    // Asignar nuevo staff
    if (users && Array.isArray(users)) {
        const stmt = db.prepare("INSERT INTO client_users (id, client_id, user_id, created_at) VALUES (?, ?, ?, ?)");
        for (const userId of users) {
            stmt.run(getValidId('client_users'), clientId, userId, new Date().toISOString());
        }
    }
    
    res.json({ success: true });
});

// Agregar un usuario específico al cliente
router.post('/:id/staff', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const { user_id } = req.body;
    
    const id = getValidId('client_users');
    db.prepare("INSERT OR IGNORE INTO client_users (id, client_id, user_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, clientId, user_id, new Date().toISOString());
    
    res.json({ success: true });
});

// Quitar un usuario del cliente
router.delete('/:id/staff/:userId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const userId = castId('users', req.params.userId);
    
    db.prepare("DELETE FROM client_users WHERE client_id = ? AND user_id = ?").run(clientId, userId);
    res.json({ success: true });
});

// Agregar un evento específico al cliente
router.post('/:id/events', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const { event_id } = req.body;
    
    const id = getValidId('client_events');
    db.prepare("INSERT OR IGNORE INTO client_events (id, client_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, clientId, event_id, new Date().toISOString());
    
    res.json({ success: true });
});

// Quitar un evento del cliente
router.delete('/:id/events/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const clientId = castId('clients', req.params.id);
    const eventId = castId('events', req.params.eventId);
    
    db.prepare("DELETE FROM client_events WHERE client_id = ? AND event_id = ?").run(clientId, eventId);
    res.json({ success: true });
});

// Asignar clientes a una empresa (cambiar company_id)
router.put('/assign-to-company', authMiddleware(['ADMIN']), (req, res) => {
    const { client_ids, company_id } = req.body;
    
    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de client_ids' });
    }
    
    if (!company_id) {
        return res.status(400).json({ error: 'Se requiere company_id' });
    }
    
    const stmt = db.prepare("UPDATE clients SET company_id = ? WHERE id = ?");
    for (const clientId of client_ids) {
        stmt.run(company_id, castId('clients', clientId));
    }
    
    res.json({ success: true });
});

// Desasignar cliente de empresa (company_id = '')
router.put('/unassign-from-company', authMiddleware(['ADMIN']), (req, res) => {
    const { client_ids } = req.body;
    
    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de client_ids' });
    }
    
    const stmt = db.prepare("UPDATE clients SET company_id = '' WHERE id = ? AND company_id IS NOT NULL AND company_id != ''");
    for (const clientId of client_ids) {
        stmt.run(castId('clients', clientId));
    }
    
    res.json({ success: true });
});

module.exports = router;
