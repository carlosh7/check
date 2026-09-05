/**
 * Rutas de primer arranque (Setup Wizard) — v12.44.802
 *
 * Cierra el hallazgo P1-2 de la auditoría 2026-08: la app ya NO siembra un
 * admin con credenciales conocidas. En una instalación sin usuarios, el
 * frontend muestra el wizard y estos endpoints permiten crear el primer
 * administrador de forma segura.
 *
 * Seguridad:
 *  - GET  /api/setup/status → público, solo expone { needsSetup: boolean }.
 *  - POST /api/setup/admin  → SOLO funciona si la tabla users está vacía
 *    (verificación atómica dentro de una transacción). Con cualquier usuario
 *    existente responde 403 siempre.
 *  - Rate limited igual que /api/login (server.js + authLimiter inline).
 *  - La contraseña debe cumplir la política fuerte y no puede ser una de las
 *    contraseñas expuestas (src/security/password-policy).
 *  - El endpoint no está en CSRF_PROTECTED_PATHS (mismo tratamiento que
 *    /api/login: API JWT sin sesión de cookie).
 *
 * @module routes/setup
 * @version 12.44.802
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { schemas, validate } = require('../security/validation');
const { validatePasswordStrength } = require('../security/password-policy');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { limiters } = require('../middleware/rate-limiter');
const logger = require('../utils/logger');
const { generateToken } = require('../security/jwt');

const router = express.Router();

function countUsers() {
    return db.prepare("SELECT COUNT(*) as count FROM users").get().count;
}

/**
 * GET /api/setup/status
 * Indica si la instalación aún no tiene usuarios (wizard pendiente).
 */
router.get('/status', (req, res) => {
    try {
        res.json({ success: true, needsSetup: countUsers() === 0 });
    } catch (e) {
        logger.error('[SETUP] Error consultando estado:', e.message);
        res.status(500).json({ success: false, error: 'Error verificando el estado de la instalación' });
    }
});

/**
 * POST /api/setup/admin
 * Crea el primer administrador (role ADMIN, status APPROVED).
 * Rechazado con 403 en cuanto exista cualquier usuario.
 */
router.post('/admin', limiters.authLimiter, (req, res) => {
    try {
        // 1. Bloqueo duro: con usuarios existentes el wizard está cerrado
        if (countUsers() > 0) {
            logAction(req, AUDIT_ACTIONS.SETUP_ADMIN_REJECTED, { reason: 'users_already_exist' });
            logger.warn('[SETUP] Intento de crear admin inicial con usuarios existentes — rechazado');
            return res.status(403).json({ success: false, error: 'La instalación ya tiene usuarios. Usa el login normal.' });
        }

        // 2. Validación de forma (email + contraseña fuerte)
        const v = validate(schemas.setupAdmin, req.body);
        if (!v.valid) return res.status(400).json({ success: false, errors: v.errors });

        const { username, password, display_name } = v.data;

        // 3. Política completa (incluye lista de contraseñas expuestas)
        const pwCheck = validatePasswordStrength(password);
        if (!pwCheck.valid) return res.status(400).json({ success: false, errors: pwCheck.errors });

        // 4. Creación atómica: re-verifica users=0 dentro de la transacción
        const email = username.toLowerCase();
        const createdId = db.transaction(() => {
            const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
            if (count > 0) return null;
            const id = getValidId('users');
            db.prepare("INSERT INTO users (id, username, password, role, status, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .run(id, email, bcrypt.hashSync(password, 10), 'ADMIN', 'APPROVED', display_name, new Date().toISOString());
            return id;
        })();

        if (!createdId) {
            logAction(req, AUDIT_ACTIONS.SETUP_ADMIN_REJECTED, { reason: 'users_already_exist_race' });
            return res.status(403).json({ success: false, error: 'La instalación ya tiene usuarios. Usa el login normal.' });
        }

        logger.info('[SETUP] ✓ Administrador inicial creado mediante wizard de primer arranque');
        logAction(req, AUDIT_ACTIONS.SETUP_ADMIN_CREATED, { username: email, role: 'ADMIN', via: 'setup_wizard' });

        // v12.44.806: token de sesión en la única respuesta que este endpoint
        // puede dar (solo fire cuando users=0). Permite el paso opcional de
        // 2FA del wizard con los endpoints /api/me/2fa/* existentes.
        const token = generateToken({ userId: createdId, username: email, role: 'ADMIN' });
        res.status(201).json({
            success: true,
            message: 'Administrador creado correctamente. Ya puedes iniciar sesión.',
            token,
            username: email
        });
    } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'Este email ya está registrado' });
        }
        logger.error('[SETUP] Error creando admin inicial:', e.message);
        res.status(500).json({ success: false, error: 'Error al crear el administrador' });
    }
});

module.exports = router;
