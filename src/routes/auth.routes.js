/**
 * Rutas de autenticación
 *
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Autenticación, registro y recuperación de contraseña
 *
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       properties:
 *         username: { type: string, example: admin }
 *         password: { type: string, example: "123456" }
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         token: { type: string }
 *         user: { type: object }
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { schemas, validate } = require('../security/validation');
const { generateToken, verifyToken } = require('../security/jwt');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @openapi
 * /api/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve token JWT
 *       400:
 *         description: Credenciales inválidas
 */
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

/**
 * @openapi
 * /api/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *               display_name: { type: string }
 *     responses:
 *       201: { description: Usuario creado }
 *       400: { description: Error de validación }
 */
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

    // Generar codigo de 6 digitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare("INSERT INTO password_resets (id, user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(getValidId('password_resets'), user.id, code, expires, new Date().toISOString());

    // Enviar email si hay servicio configurado
    let emailSent = false;
    try {
        const emailService = global.emailService;
        if (emailService && typeof emailService.sendEmail === 'function') {
            const html = '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:12px;color:#fff;text-align:center">' +
                '<h2 style="margin:0 0 10px;font-size:20px">Recuperación de Contraseña</h2>' +
                '<p style="font-size:14px;opacity:0.9;margin:0 0 20px">Tu código de verificación es:</p>' +
                '<div style="font-size:36px;font-weight:bold;letter-spacing:8px;background:rgba(255,255,255,0.2);padding:15px;border-radius:8px;margin:0 auto 20px;display:inline-block">' + code + '</div>' +
                '<p style="font-size:12px;opacity:0.7;margin:0">Válido por 30 minutos</p>' +
                '<div style="margin-top:20px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.2);font-size:10px;opacity:0.5">Check Pro - Smart Eventos</div></div>';
            emailService.sendEmail({
                to: user.username,
                subject: 'Código de recuperación - Check Pro',
                html: html,
                eventId: null
            }).then(() => { emailSent = true; }).catch(err => console.error('[PASSWORD_RESET] Error email:', err.message));
            emailSent = true; // optimistic
        }
    } catch(e) {
        console.error('[PASSWORD_RESET] Error sending email:', e.message);
    }

    res.json({ success: true, message: emailSent ? 'Código enviado por email' : 'Código generado (configura SMTP para envio automatico)', code: code });
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

/**
 * @openapi
 * /api/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener perfil del usuario actual
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Datos del usuario }
 *       401: { description: No autenticado }
 */
router.get('/me', authMiddleware(), (req, res) => {
    try {
        const user = db.prepare("SELECT id, username, display_name, phone, role, status, group_id FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        // Obtener grupos del usuario
        const groups = db.prepare(`
            SELECT g.id, g.name FROM groups g
            JOIN group_users gu ON gu.group_id = g.id
            WHERE gu.user_id = ?
        `).all(req.userId);
        
        // Formatear para el frontend
        res.json({
            id: user.id,
            username: user.username,
            name: user.display_name || user.username,
            role: user.role,
            phone: user.phone || '',
            email: user.username,
            status: user.status,
            group_id: user.group_id,
            groups: groups
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// PUT /api/me/email - Cambiar email del usuario logueado
router.put('/me/email', authMiddleware(), (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        
        // Verificar que no exista
        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(email.toLowerCase(), req.userId);
        if (existing) return res.status(400).json({ error: 'Este email ya está registrado' });
        
        db.prepare("UPDATE users SET username = ? WHERE id = ?").run(email.toLowerCase(), req.userId);
        logAction(req, AUDIT_ACTIONS.USER_PROFILE_UPDATED, { userId: req.userId, email });
        
        res.json({ success: true, message: 'Email actualizado' });
    } catch (e) {
        res.status(500).json({ error: 'Error al actualizar email' });
    }
});

// PUT /api/me/password - Cambiar contraseña del usuario logueado
router.put('/me/password', authMiddleware(), (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' });
        
        const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }
        
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.userId);
        logAction(req, AUDIT_ACTIONS.USER_PASSWORD_CHANGED, { userId: req.userId });
        
        res.json({ success: true, message: 'Contraseña actualizada' });
    } catch (e) {
        res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
});

module.exports = router;
