/**
 * Rutas de autenticación (con JWT y Zod)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { schemas, validate } = require('../security/validation');
const { generateToken, verifyToken } = require('../security/jwt');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
    try {
        const v = validate(schemas.login, req.body);
        if (!v.valid) return res.status(400).json({ success: false, errors: v.errors });

        let { username, password } = v.data;
        username = username ? username.toLowerCase() : '';
        
        console.log(`[AUTH] Intento de login: ${username}`);
        
        const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        
        if (!row) {
            console.warn(`[AUTH] Usuario no encontrado: ${username}`);
            logAction(req, AUDIT_ACTIONS.LOGIN_FAILED, { username, reason: 'user_not_found' });
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        console.log(`[AUTH] Usuario encontrado: ${row.username}, status: ${row.status}`);
        
        if (row.status !== 'APPROVED') {
            console.warn(`[AUTH] Usuario no aprobado: ${username}`);
            return res.status(401).json({ success: false, message: 'Cuenta no aprobada' });
        }
        
        const passwordMatch = bcrypt.compareSync(password, row.password);
        console.log(`[AUTH] Password match: ${passwordMatch}`);

        if (passwordMatch) {
            const token = generateToken({
                userId: row.id,
                username: row.username,
                role: row.role
            });

            logAction(req, AUDIT_ACTIONS.LOGIN, { username: row.username, role: row.role });

            res.json({
                success: true,
                token,
                userId: row.id,
                role: row.role,
                username: row.username
            });
        } else {
            logAction(req, AUDIT_ACTIONS.LOGIN_FAILED, { username, reason: 'wrong_password' });
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('[AUTH] Critical Error during login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

router.post('/signup', (req, res) => {
    const v = validate(schemas.signup, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username, password, role = 'PRODUCTOR', display_name } = v.data;

    try {
        const id = getValidId('users');
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO users (id, username, password, role, status, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(id, username.toLowerCase(), hashedPassword, role, 'PENDING', display_name, new Date().toISOString());

        logAction(req, AUDIT_ACTIONS.USER_CREATED, { username, role });

        res.json({ success: true, message: 'Solicitud enviada. Un administrador debe aprobar tu acceso.' });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Este email ya está registrado' });
        res.status(500).json({ error: 'Error al crear la cuenta' });
    }
});

router.post('/password-reset-request', (req, res) => {
    const v = validate(schemas.passwordResetRequest, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username } = v.data;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
    if (!user) {
        return res.json({ success: true, message: 'Si el email existe, recibirás un código de recuperación' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare("INSERT INTO password_resets (id, user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(getValidId('password_resets'), user.id, code, expires, new Date().toISOString());

    res.json({ success: true, message: 'Código enviado por email (simulado)' });
});

router.post('/verify-reset-code', (req, res) => {
    const v = validate(schemas.verifyResetCode, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { code } = v.data;
    const reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
      .get(code, new Date().toISOString());

    if (!reset) {
        return res.status(400).json({ success: false, error: 'Código inválido o expirado' });
    }

    res.json({ success: true, valid: true });
});

router.post('/reset-password', (req, res) => {
    const v = validate(schemas.resetPassword, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { code, new_password } = v.data;
    const reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
      .get(code, new Date().toISOString());

    if (!reset) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(reset.user_id);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);
    db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);

    logAction(req, AUDIT_ACTIONS.USER_PASSWORD_CHANGED, { userId: user.id });

    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
});

router.get('/me', authMiddleware(), (req, res) => {
    try {
        const user = db.prepare("SELECT id, username, display_name, phone, role, status FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        // Formatear para el frontend
        res.json({
            id: user.id,
            username: user.username,
            name: user.display_name || user.username,
            role: user.role,
            phone: user.phone || '',
            email: user.username,
            status: user.status
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

module.exports = router;
