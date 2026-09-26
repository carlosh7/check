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
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { schemas, validate } = require('../security/validation');
const { validatePasswordStrength } = require('../security/password-policy');
const { generateToken } = require('../security/jwt');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { authMiddleware } = require('../middleware/auth');
const { blacklistToken } = require('../security/jwt');
const { limiters } = require('../middleware/rate-limiter');

const logger = require("../utils/logger");
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
router.post('/login', limiters.authLimiter,
    body('username').isString().trim().notEmpty().withMessage('Usuario requerido'),
    body('password').isString().notEmpty().withMessage('Contraseña requerida'),
    function(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
        // ... existing login logic
    try {
        const v = validate(schemas.login, req.body);
        if (!v.valid) return res.status(400).json({ success: false, errors: v.errors });

        let { username, password } = v.data;
        username = username ? username.toLowerCase() : '';
        
        logger.info(`[AUTH] Intento de login: ${username}`);
        
        const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        
        if (!row) {
            logger.warn(`[AUTH] Usuario no encontrado: ${username}`);
            logAction(req, AUDIT_ACTIONS.LOGIN_FAILED, { username, reason: 'user_not_found' });
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        logger.info(`[AUTH] Usuario encontrado: ${row.username}, status: ${row.status}`);
        
        if (row.status !== 'APPROVED') {
            logger.warn(`[AUTH] Usuario no aprobado: ${username}`);
            return res.status(401).json({ success: false, message: 'Cuenta no aprobada' });
        }
        
        const passwordMatch = bcrypt.compareSync(password, row.password);
        logger.info(`[AUTH] Password match: ${passwordMatch}`);

        // F2 (2026-08): verificación TOTP obligatoria si el usuario activó 2FA
        if (passwordMatch && row.totp_enabled === 1) {
            const totpToken = String(req.body.totp_token || '').trim();
            if (!totpToken) {
                return res.status(401).json({ success: false, requires2FA: true, message: 'Código 2FA requerido' });
            }
            const totpOk = require('speakeasy').totp.verify({ secret: row.totp_secret, encoding: 'base32', token: totpToken, window: 1 });
            if (!totpOk) {
                logAction(req, AUDIT_ACTIONS.LOGIN_FAILED, { username, reason: 'invalid_2fa' });
                return res.status(401).json({ success: false, requires2FA: true, message: 'Código 2FA inválido' });
            }
        }

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
        logger.error('[AUTH] Critical Error during login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

/**
 * @openapi
 * /api/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión (revocar token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Sesión cerrada }
 */
router.post('/logout', authMiddleware(), (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        blacklistToken(token);
    }
    logAction(req, AUDIT_ACTIONS.LOGIN, { username: req.user?.username, action: 'logout' });
    res.json({ success: true, message: 'Sesión cerrada' });
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
router.post('/signup', limiters.authLimiter, (req, res) => {
    const v = validate(schemas.signup, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { username, password, display_name } = v.data;

    // L-1A.3 (v12.44.818): aceptación de Términos y Política de Tratamiento obligatoria
    // (Ley 1581 arts. 8-9). Se registra como evidencia en consent_logs.
    const acceptedTerms = req.body.accepted_terms === true || req.body.accepted_terms === 'true';
    if (!acceptedTerms) {
        return res.status(400).json({ errors: ['Debes aceptar los Términos del Servicio y la Política de Tratamiento de Datos Personales'] });
    }

    // v12.44.802 (cierra hueco): se ignora el role que envíe el cliente.
    // Toda cuenta nueva nace PRODUCTOR; el rol real lo asigna un admin
    // desde el panel de usuarios. Nunca se auto-asigna ADMIN vía signup.
    const role = 'PRODUCTOR';

    // v12.44.802: política de contraseñas (rechaza las expuestas en el repo)
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) return res.status(400).json({ errors: pwCheck.errors });

    try {
        const id = getValidId('users');
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO users (id, username, password, role, status, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(id, username.toLowerCase(), hashedPassword, role, 'PENDING', display_name, new Date().toISOString());

        logAction(req, AUDIT_ACTIONS.USER_CREATED, { username, role });

        // L-1A.3 (v12.44.818): evidencia de la aceptación de T&C + Política de Tratamiento
        try {
            const { sha256Hex } = require('../utils/privacy');
            const tosText = 'Términos del Servicio y Política de Tratamiento de Datos Personales de Check Pro (versión 2026-09, plantilla legal — ver /legal/terminos y /legal/privacidad)';
            db.prepare(`INSERT INTO consent_logs (id, guest_id, event_id, consent_type, consent_given, consent_text, ip_address, user_agent)
                        VALUES (?, ?, 'PLATFORM', 'platform_tos', 1, ?, ?, ?)`)
              .run(uuidv4(), id, `[sha256:${sha256Hex(tosText)}] ${tosText}`, req.ip || '', req.get('User-Agent') || null);
        } catch (_) {}

        res.json({ success: true, message: 'Solicitud enviada. Un administrador debe aprobar tu acceso.' });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Este email ya está registrado' });
        res.status(500).json({ error: 'Error al crear la cuenta' });
    }
});

router.post('/password-reset-request', (req, res) => {
    try {
        const v = validate(schemas.passwordResetRequest, req.body);
        if (!v.valid) return res.status(400).json({ errors: v.errors });

        const { username } = v.data;
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
        if (!user) return res.json({ success: true, message: 'Si el email existe, recibirás un código de recuperación' });

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        db.prepare("INSERT INTO password_resets (id, user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(getValidId('password_resets'), user.id, code, expires, new Date().toISOString());

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
                emailService.sendEmail({ to: user.username, subject: 'Código de recuperación - Check Pro', html: html, eventId: null })
                    .then(function() { emailSent = true; }).catch(function(err) { logger.error('[PASSWORD_RESET] Error email:', err.message); });
                emailSent = true;
            }
        } catch(e) { logger.error('[PASSWORD_RESET] Error sending email:', e.message); }

        res.json({ success: true, message: emailSent ? 'Código enviado por email' : 'Código generado (configura SMTP para envio automatico)' });
    } catch(err) { logger.error('[PASSWORD_RESET] Error:', err.message); res.status(500).json({ error: 'Error al procesar solicitud' }); }
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

    // v12.44.802: la nueva contraseña no puede ser una de las expuestas
    const pwCheck = validatePasswordStrength(new_password);
    if (!pwCheck.valid) return res.status(400).json({ errors: pwCheck.errors });

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

// GET /api/me/export — Portabilidad de datos del usuario de plataforma (ARCO, Ley 1581)
// L-1A/L-3 (v12.44.818): el titular puede descargar sus propios datos y consentimientos.
router.get('/me/export', authMiddleware(), (req, res) => {
    try {
        const user = db.prepare("SELECT id, username, display_name, phone, role, status, group_id, created_at FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        let consents = [];
        try {
            consents = db.prepare("SELECT consent_type, consent_given, consent_text, ip_address, created_at FROM consent_logs WHERE guest_id = ? ORDER BY created_at DESC").all(req.userId);
        } catch (_) {}
        res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-checkpro.json"');
        res.json({
            exported_at: new Date().toISOString(),
            format: 'Ley 1581 / GDPR portability (self-service)',
            user: user,
            consents: consents
        });
    } catch (e) { res.status(500).json({ error: 'Error al exportar datos' }); }
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
        // Fix L-4 (v12.44.818): la constante USER_PROFILE_UPDATED no existía en
        // AUDIT_ACTIONS (el cambio de email no quedaba auditado).
        logAction(req, AUDIT_ACTIONS.USER_UPDATED, { userId: req.userId, action: 'email_change', email });
        
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

        // v12.44.802: política de contraseñas (fortaleza + expuestas)
        const pwCheck = validatePasswordStrength(newPassword);
        if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.errors.join('. ') });

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.userId);
        logAction(req, AUDIT_ACTIONS.USER_PASSWORD_CHANGED, { userId: req.userId });
        
        res.json({ success: true, message: 'Contraseña actualizada' });
    } catch (e) {
        res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
});

// ─── N-3 / B5 (v12.44.819): Borrado de cuenta self-service (Ley 1581 arts. 8-15) ───
// El titular puede eliminar su cuenta sin intermediarios. En lugar de un DELETE físico
// (rompería bitácoras y evidencia de consentimientos, cuya conservación es deber legal),
// se ANONIMIZA la fila: los datos personales se sustituyen por valores no atribuibles y
// la cuenta queda en estado 'DELETED', que el middleware de auth rechaza de inmediato.
router.post('/me/delete-account', limiters.authLimiter, authMiddleware(), (req, res) => {
    try {
        const { password, confirmation } = req.body;
        if (!password) return res.status(400).json({ error: 'Contraseña requerida para confirmar el borrado' });
        if (confirmation !== 'ELIMINAR') return res.status(400).json({ error: 'Debes escribir ELIMINAR para confirmar el borrado definitivo' });

        const user = db.prepare("SELECT id, username, password, role FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (!bcrypt.compareSync(password, user.password)) {
            logAction(req, AUDIT_ACTIONS.USER_UPDATED, { userId: req.userId, action: 'delete_account_failed' });
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // Un ADMIN no puede autodestruirse: la plataforma quedaría sin administración.
        // El borrado de un admin se hace desde la gestión de usuarios con otro admin.
        if (user.role === 'ADMIN') {
            return res.status(403).json({ error: 'Una cuenta ADMIN no puede eliminarse a sí misma: usa la gestión de usuarios con otro administrador.' });
        }

        const crypto = require('crypto');
        const anonEmail = `eliminado+${uuidv4()}@anulado.local`;
        const randomPassword = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
        db.prepare(`UPDATE users SET username = ?, display_name = ?, phone = '', password = ?, totp_secret = NULL, totp_enabled = 0, status = 'DELETED' WHERE id = ?`)
          .run(anonEmail, 'Usuario eliminado', randomPassword, req.userId);

        // La bitácora conserva el evento sin datos personales del titular (username previo
        // se registra solo como referencia operativa mínima para soporte/fraude).
        logAction(req, AUDIT_ACTIONS.USER_DELETED, { userId: req.userId, self_service: true, anonymized: true });

        res.json({ success: true, message: 'Cuenta eliminada. Tus datos personales fueron anonimizados; la evidencia de consentimientos se conserva por deber legal (Ley 1581).' });
    } catch (e) {
        logger.error('[me/delete-account] Error:', e.message);
        res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }
});

// ─── 2FA TOTP (C6-15) ───
router.post('/me/2fa/setup', authMiddleware(), (req, res) => {
    try {
        const speakeasy = require('speakeasy');
        const qrcode = require('qrcode');
        const secret = speakeasy.generateSecret({ name: 'Check Pro:' + req.userId });
        db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret.base32, req.userId);
        qrcode.toDataURL(secret.otpauth_url, function(err, data) {
            res.json({ success: true, secret: secret.base32, qrCode: data });
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/me/2fa/verify', authMiddleware(), (req, res) => {
    try {
        const { token } = req.body;
        const user = db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(req.userId);
        if (!user || !user.totp_secret) return res.status(400).json({ error: '2FA no configurado' });
        const verified = require('speakeasy').totp.verify({ secret: user.totp_secret, encoding: 'base32', token: token, window: 1 });
        if (verified) { db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(req.userId); res.json({ success: true }); }
        else res.status(400).json({ error: 'Código inválido' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/me/2fa/disable', authMiddleware(), (req, res) => {
    try { db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(req.userId); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/me/2fa/status', authMiddleware(), (req, res) => {
    try {
        const user = db.prepare("SELECT totp_enabled FROM users WHERE id = ?").get(req.userId);
        res.json({ enabled: user?.totp_enabled === 1 });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
