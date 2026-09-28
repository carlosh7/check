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

// C-8 (v12.44.820): escape HTML para plantillas de correo generadas server-side
const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// C-6 (v12.44.820): el código de recuperación de 6 dígitos NUNCA se almacena en claro.
// Se guarda su HMAC-SHA256 firmado con JWT_SECRET: determinista (permite buscarlo por
// índice sin revelarlo) e irreversible ante robo de la BD (sin el secreto no hay tabla
// precomputada posible). El limiter.auth (50/ventana) acota el espacio de prueba.
let resetCodeSecretWarned = false;
function hashCodeResetCode(code) {
    const secret = process.env.JWT_SECRET;
    if (!secret && !resetCodeSecretWarned) {
        resetCodeSecretWarned = true;
        logger.warn('[AUTH] JWT_SECRET no definida: hash de códigos de recuperación con secreto débil (solo desarrollo)');
    }
    return require('crypto').createHmac('sha256', secret || 'check-dev-insecure').update('pwreset:' + code).digest('hex');
}

// C-6: contabiliza un intento fallido y mata el código a los 5 (contra fuerza bruta
// dirigida a un usuario concreto). Devuelve true si el código quedó invalidado.
function registerResetAttempt(resetId) {
    try {
        const row = db.prepare("SELECT attempts FROM password_resets WHERE id = ?").get(resetId);
        if (!row) return false;
        const attempts = (row.attempts || 0) + 1;
        if (attempts >= 5) {
            db.prepare("UPDATE password_resets SET attempts = ?, used = 1 WHERE id = ?").run(attempts, resetId);
            return true;
        }
        db.prepare("UPDATE password_resets SET attempts = ? WHERE id = ?").run(attempts, resetId);
    } catch (_) {}
    return false;
}

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
        // C-6 (v12.44.820): hash del código + email ligado + un solo código activo por usuario
        db.prepare("UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0").run(user.id);
        db.prepare("INSERT INTO password_resets (id, user_id, code, email, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(getValidId('password_resets'), user.id, hashCodeResetCode(code), user.username.toLowerCase(), expires, new Date().toISOString());

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

    // C-6 (v12.44.820): comparación contra hash HMAC + contador de intentos (máx 5).
    // `username` es opcional: si el wizard lo envía, el código se liga a ese usuario y los
    // intentos fallidos se contabilizan contra ese código concreto.
    const { code } = v.data;
    const username = String(req.body.username || req.body.email || '').trim().toLowerCase();
    const codeHash = hashCodeResetCode(code);
    let reset;
    if (username) {
        reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ? AND email = ?")
          .get(codeHash, new Date().toISOString(), username);
        if (!reset) {
            const active = db.prepare("SELECT id FROM password_resets WHERE used = 0 AND expires_at > ? AND email = ? ORDER BY created_at DESC").get(new Date().toISOString(), username);
            if (active && registerResetAttempt(active.id)) {
                return res.status(400).json({ success: false, error: 'Demasiados intentos fallidos: solicita un código nuevo' });
            }
        }
    } else {
        reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
          .get(codeHash, new Date().toISOString());
    }

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

    // C-6 (v12.44.820): hash HMAC + intentos + ligado opcional al email solicitado
    const username = String(req.body.username || req.body.email || '').trim().toLowerCase();
    const codeHash = hashCodeResetCode(code);
    let reset;
    if (username) {
        reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ? AND email = ?")
          .get(codeHash, new Date().toISOString(), username);
        if (!reset) {
            const active = db.prepare("SELECT id FROM password_resets WHERE used = 0 AND expires_at > ? AND email = ? ORDER BY created_at DESC").get(new Date().toISOString(), username);
            if (active && registerResetAttempt(active.id)) {
                return res.status(400).json({ error: 'Demasiados intentos fallidos: solicita un código nuevo' });
            }
        }
    } else {
        reset = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0 AND expires_at > ?")
          .get(codeHash, new Date().toISOString());
    }

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
// C-8 (v12.44.820): re-verificación de propiedad — el cambio ya NO se aplica de inmediato.
// Se envía un enlace de confirmación al correo NUEVO (token de un solo uso, 24h): solo
// quien reciba ese correo puede completar el cambio. Evita el secuestro de notificaciones
// apuntando la cuenta a un correo ajeno.
router.put('/me/email', authMiddleware(), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email válido requerido' });
        const newEmail = email.toLowerCase();

        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(newEmail, req.userId);
        if (existing) return res.status(400).json({ error: 'Este email ya está registrado' });

        const user = db.prepare("SELECT id, display_name FROM users WHERE id = ?").get(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Un solo token activo por usuario: los anteriores quedan invalidados
        db.prepare("UPDATE email_change_tokens SET used = 1 WHERE user_id = ? AND used = 0").run(req.userId);
        const token = uuidv4();
        db.prepare("INSERT INTO email_change_tokens (id, user_id, new_email, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(uuidv4(), req.userId, newEmail, token, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString());

        const baseUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        const confirmUrl = baseUrl + '/api/me/email/confirm?token=' + token;
        let emailSent = false;
        try {
            if (global.emailService && typeof global.emailService.sendEmail === 'function') {
                const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1e293b">'
                    + '<h2 style="font-size:18px">Confirma tu nuevo correo</h2>'
                    + '<p style="font-size:14px">Hola ' + escHtml(user.display_name || '') + ', recibimos una solicitud para cambiar el correo de tu cuenta Check Pro a <b>' + escHtml(newEmail) + '</b>.</p>'
                    + '<p style="margin:20px 0"><a href="' + confirmUrl + '" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar cambio de correo</a></p>'
                    + '<p style="font-size:12px;color:#64748b">El enlace vence en 24 horas y solo funciona una vez. Si no fuiste tú, ignora este mensaje y tu correo no cambiará.</p></div>';
                await global.emailService.sendEmail({ to: newEmail, subject: 'Confirma tu nuevo correo — Check Pro', html: html, eventId: null });
                emailSent = true;
            }
        } catch (e) { logger.error('[me/email] No se pudo enviar confirmación:', e.message); }

        logAction(req, AUDIT_ACTIONS.USER_UPDATED, { userId: req.userId, action: 'email_change_requested', new_email: newEmail, email_sent: emailSent });

        if (!emailSent) {
            return res.status(503).json({ error: 'No hay servicio de correo configurado: no podemos enviar la confirmación al nuevo email. Configura SMTP e inténtalo de nuevo.' });
        }
        res.json({ success: true, message: 'Te enviamos un enlace de confirmación al nuevo correo. El cambio se aplicará cuando lo confirmes desde ahí (vence en 24 horas).' });
    } catch (e) {
        logger.error('[me/email] Error:', e.message);
        res.status(500).json({ error: 'Error al solicitar el cambio de email' });
    }
});

// GET /api/me/email/confirm?token=... — C-8: aplica el cambio de email tras la prueba de
// posesión del buzón nuevo. Público POR DISEÑO: el token (UUID de un solo uso, 24h) es la
// prueba; responder HTML porque el titular llega desde su cliente de correo.
router.get('/me/email/confirm', (req, res) => {
    const token = String(req.query.token || '');
    const page = (title, body) => '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + title + ' — Check Pro</title></head><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0"><div style="max-width:460px;padding:40px;text-align:center"><h1 style="font-size:22px">' + title + '</h1><p style="font-size:14px;color:#94a3b8;line-height:1.6">' + body + '</p></div></body></html>';
    try {
        if (!token) return res.status(400).send(page('Enlace inválido', 'Falta el token de confirmación.'));
        const row = db.prepare("SELECT * FROM email_change_tokens WHERE token = ? AND used = 0 AND expires_at > ?").get(token, new Date().toISOString());
        if (!row) return res.status(400).send(page('Enlace inválido o vencido', 'El enlace ya fue usado, venció (24 h) o fue anulado por una solicitud más reciente. Inicia sesión y solicita el cambio de nuevo.'));
        const dup = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(row.new_email, row.user_id);
        if (dup) return res.status(400).send(page('Correo no disponible', 'Ese email ya está en uso por otra cuenta.'));
        db.prepare("UPDATE users SET username = ? WHERE id = ?").run(row.new_email, row.user_id);
        db.prepare("UPDATE email_change_tokens SET used = 1 WHERE id = ?").run(row.id);
        try {
            db.prepare("INSERT INTO audit_logs (id, user_id, user_name, action, details, ip_address) VALUES (?, ?, 'system', 'USER_UPDATED', ?, ?)")
              .run(uuidv4(), row.user_id, JSON.stringify({ action: 'email_change_confirmed', new_email: row.new_email }), req.ip || '');
        } catch (_) {}
        res.send(page('✓ Correo actualizado', 'Tu email ahora es <b>' + row.new_email.replace(/</g, '&lt;') + '</b>. Ya puedes iniciar sesión con él.<br><br><a href="/" style="color:#a78bfa">Ir al inicio de sesión</a>'));
    } catch (e) {
        logger.error('[me/email/confirm] Error:', e.message);
        res.status(500).send(page('Error', 'No se pudo confirmar el cambio. Intenta de nuevo.'));
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
