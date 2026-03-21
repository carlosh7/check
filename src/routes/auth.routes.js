/**
 * Rutas de autenticación
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }
    
    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    
    if (!row) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    
    if (row.status !== 'APPROVED') {
        return res.status(401).json({ success: false, message: 'Cuenta no aprobada' });
    }
    
    const passwordMatch = bcrypt.compareSync(password, row.password);
    
    if (passwordMatch) {
        res.json({ success: true, userId: row.id, role: row.role, username: row.username });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    const { username, password, role = 'PRODUCTOR' } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return res.status(400).json({ error: 'Email inválido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    
    try {
        const id = getValidId('users');
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username.toLowerCase(), hashedPassword, role, 'PENDING', new Date().toISOString());
        
        res.json({ success: true, message: 'Solicitud enviada. Un administrador debe aprobar tu acceso.' });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Este email ya está registrado' });
        res.status(500).json({ error: 'Error al crear la cuenta' });
    }
});

// Solicitar reset de contraseña
router.post('/password-reset-request', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Email requerido' });
    
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
    if (!user) {
        return res.json({ success: true, message: 'Si el email existe, recibirás un código de recuperación' });
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    db.prepare("INSERT INTO password_resets (id, user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(getValidId('password_resets'), user.id, code, expires, new Date().toISOString());
    
    res.json({ success: true, message: 'Código enviado (simulado)', code });
});

// Verificar código de reset
router.post('/verify-reset-code', (req, res) => {
    const { code } = req.body;
    const reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
      .get(code, new Date().toISOString());
    
    if (!reset) {
        return res.status(400).json({ success: false, error: 'Código inválido o expirado' });
    }
    
    res.json({ success: true, valid: true });
});

// Resetear contraseña
router.post('/reset-password', (req, res) => {
    const { code, new_password } = req.body;
    
    const reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
      .get(code, new Date().toISOString());
    
    if (!reset) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
    }
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(reset.user_id);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (new_password) {
        const hashedPassword = bcrypt.hashSync(new_password, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);
        db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);
        return res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
    }
    
    res.json({ success: true, valid: true });
});

module.exports = router;
