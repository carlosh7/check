/**
 * Módulo de Mailing - Rutas API
 * Gestiona cuentas SMTP/IMAP, plantillas, campañas y envío de emails
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { mailparser } = require('mailparser');
const { db } = require('../../database');

// ============================================================
// HELPERS
// ============================================================

function getEmailDb() {
    return db;
}

/**
 * Reemplaza variables en plantillas
 * {{guest_name}} -> "Juan Pérez"
 * {{event_name}} -> "Conferencia Anual"
 */
function replaceTemplateVariables(template, data) {
    if (!template) return '';
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
}

/**
 * Obtiene los headers SMTP de una cuenta
 * Compatible con esquema legacy (smtp_pass) y nuevo (smtp_password)
 */
function getSmtpConfig(account) {
    return {
        host: account.smtp_host,
        port: account.smtp_port || 587,
        secure: account.smtp_ssl === 1,
        auth: {
            user: account.smtp_user,
            pass: account.smtp_password || account.smtp_pass
        }
    };
}

/**
 * Obtiene la configuración IMAP de una cuenta
 * Compatible con esquema legacy (imap_pass) y nuevo (imap_password)
 */
function getImapConfig(account) {
    return {
        user: account.imap_user,
        password: account.imap_password || account.imap_pass,
        host: account.imap_host,
        port: account.imap_port || 993,
        tls: account.imap_ssl === 1,
        tlsOptions: { rejectUnauthorized: false }
    };
}

// ============================================================
// CUENTAS DE EMAIL (SMTP/IMAP)
// ============================================================

// GET /api/email/accounts - Listar cuentas
router.get('/accounts', (req, res) => {
    try {
        const { event_id } = req.query;
        let query = 'SELECT * FROM email_accounts WHERE 1=1';
        let params = [];
        
        if (event_id) {
            query += ' AND (event_id = ? OR event_id IS NULL)';
            params.push(event_id);
        }
        
        query += ' ORDER BY is_default DESC, name ASC';
        const accounts = getEmailDb().prepare(query).all(...params);
        
        // Ocultar contraseñas
        const safeAccounts = accounts.map(acc => ({
            ...acc,
            smtp_password: acc.smtp_password ? '***' : '',
            imap_password: acc.imap_password ? '***' : ''
        }));
        
        res.json(safeAccounts);
    } catch (error) {
        console.error('Error listing accounts:', error);
        res.status(500).json({ error: 'Error al listar cuentas' });
    }
});

// GET /api/email/accounts/:id - Obtener cuenta
router.get('/accounts/:id', (req, res) => {
    try {
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        // Ocultar contraseña
        account.smtp_password = account.smtp_password ? '***' : '';
        account.imap_password = account.imap_password ? '***' : '';
        
        res.json(account);
    } catch (error) {
        console.error('Error getting account:', error);
        res.status(500).json({ error: 'Error al obtener cuenta' });
    }
});

// POST /api/email/accounts - Crear cuenta
router.post('/accounts', (req, res) => {
    try {
        const {
            event_id = null,
            name,
            smtp_host,
            smtp_port = 587,
            smtp_user,
            smtp_password,
            smtp_ssl = false,
            imap_host,
            imap_port = 993,
            imap_user,
            imap_password,
            imap_ssl = true,
            imap_folder = 'INBOX',
            sender_name,
            sender_email,
            is_default = false,
            is_active = true,
            daily_limit = 500
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        // Si es cuenta por defecto, desmarcar las demás
        if (is_default) {
            getEmailDb().prepare('UPDATE email_accounts SET is_default = 0 WHERE event_id IS ?').run(event_id || null);
        }
        
        getEmailDb().prepare(`
            INSERT INTO email_accounts (
                id, event_id, name, smtp_host, smtp_port, smtp_user, smtp_password, smtp_pass, smtp_ssl, smtp_secure,
                imap_host, imap_port, imap_user, imap_password, imap_pass, imap_ssl, imap_tls, imap_folder,
                sender_name, from_name, sender_email, from_email, is_default, is_active, daily_limit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, event_id, name, smtp_host || '', smtp_port, smtp_user || '', smtp_password || '', smtp_password || '', smtp_ssl ? 1 : 0, smtp_ssl ? 1 : 0,
            imap_host || '', imap_port, imap_user || '', imap_password || '', imap_password || '', imap_ssl ? 1 : 0, imap_ssl ? 1 : 0, imap_folder || 'INBOX',
            sender_name || '', sender_name || '', sender_email || '', sender_email || '', is_default ? 1 : 0, is_active ? 1 : 0, daily_limit, now, now
        );
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
        account.smtp_password = '***';
        account.imap_password = '***';
        
        res.status(201).json(account);
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Error al crear cuenta' });
    }
});

// PUT /api/email/accounts/:id - Actualizar cuenta
router.put('/accounts/:id', (req, res) => {
    try {
        const existing = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        const {
            name,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_password,
            smtp_ssl,
            imap_host,
            imap_port,
            imap_user,
            imap_password,
            imap_ssl,
            imap_folder,
            sender_name,
            sender_email,
            is_default,
            is_active,
            daily_limit
        } = req.body;
        
        // Si es cuenta por defecto, desmarcar las demás
        if (is_default) {
            getEmailDb().prepare('UPDATE email_accounts SET is_default = 0 WHERE event_id IS ? AND id != ?')
                .run(existing.event_id || null, req.params.id);
        }
        
        const now = new Date().toISOString();
        
        getEmailDb().prepare(`
            UPDATE email_accounts SET
                name = COALESCE(?, name),
                smtp_host = COALESCE(?, smtp_host),
                smtp_port = COALESCE(?, smtp_port),
                smtp_user = COALESCE(?, smtp_user),
                smtp_password = CASE WHEN ? = '***' THEN smtp_password ELSE ? END,
                smtp_ssl = COALESCE(?, smtp_ssl),
                imap_host = COALESCE(?, imap_host),
                imap_port = COALESCE(?, imap_port),
                imap_user = COALESCE(?, imap_user),
                imap_password = CASE WHEN ? = '***' THEN imap_password ELSE ? END,
                imap_ssl = COALESCE(?, imap_ssl),
                imap_folder = COALESCE(?, imap_folder),
                sender_name = COALESCE(?, sender_name),
                sender_email = COALESCE(?, sender_email),
                is_default = COALESCE(?, is_default),
                is_active = COALESCE(?, is_active),
                daily_limit = COALESCE(?, daily_limit),
                updated_at = ?
            WHERE id = ?
        `).run(
            name, smtp_host, smtp_port, smtp_user, 
            smtp_password, smtp_password !== '***' ? smtp_password : null,
            smtp_ssl ? 1 : 0,
            imap_host, imap_port, imap_user,
            imap_password, imap_password !== '***' ? imap_password : null,
            imap_ssl ? 1 : 0,
            imap_folder, sender_name, sender_email,
            is_default ? 1 : 0,
            is_active ? 1 : 0,
            daily_limit,
            now,
            req.params.id
        );
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        account.smtp_password = '***';
        account.imap_password = '***';
        
        res.json(account);
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ error: 'Error al actualizar cuenta' });
    }
});

// DELETE /api/email/accounts/:id - Eliminar cuenta
router.delete('/accounts/:id', (req, res) => {
    try {
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        getEmailDb().prepare('DELETE FROM email_accounts WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Error al eliminar cuenta' });
    }
});

// POST /api/email/accounts/:id/test-smtp - Probar conexión SMTP
router.post('/accounts/:id/test-smtp', async (req, res) => {
    try {
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        if (!account.smtp_host || !account.smtp_user || !account.smtp_password) {
            return res.json({ success: false, error: 'Configuración SMTP incompleta' });
        }
        
        const transporter = nodemailer.createTransport(getSmtpConfig(account));
        
        // Intentar verificar conexión
        await transporter.verify();
        
        res.json({ success: true, message: 'Conexión SMTP exitosa' });
    } catch (error) {
        console.error('SMTP test error:', error);
        res.json({ success: false, error: error.message });
    }
});

// POST /api/email/accounts/:id/test-imap - Probar conexión IMAP
router.post('/accounts/:id/test-imap', async (req, res) => {
    try {
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        if (!account.imap_host || !account.imap_user || !account.imap_password) {
            return res.json({ success: false, error: 'Configuración IMAP incompleta' });
        }
        
        const imap = new Imap(getImapConfig(account));
        
        return new Promise((resolve) => {
            imap.once('ready', () => {
                imap.end();
                res.json({ success: true, message: 'Conexión IMAP exitosa' });
                resolve();
            });
            
            imap.once('error', (err) => {
                res.json({ success: false, error: err.message });
                resolve();
            });
            
            imap.connect();
        });
    } catch (error) {
        console.error('IMAP test error:', error);
        res.json({ success: false, error: error.message });
    }
});

// ============================================================
// PLANTILLAS DE EMAIL
// ============================================================

// GET /api/email/templates - Listar plantillas
router.get('/templates', (req, res) => {
    try {
        const { event_id, category } = req.query;
        let query = 'SELECT * FROM email_templates WHERE 1=1';
        let params = [];
        
        if (event_id) {
            query += ' AND (event_id = ? OR event_id IS NULL)';
            params.push(event_id);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY is_system DESC, name ASC';
        const templates = getEmailDb().prepare(query).all(...params);
        
        res.json(templates);
    } catch (error) {
        console.error('Error listing templates:', error);
        res.status(500).json({ error: 'Error al listar plantillas' });
    }
});

// GET /api/email/templates/:id - Obtener plantilla
router.get('/templates/:id', (req, res) => {
    try {
        const template = getEmailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        res.json(template);
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({ error: 'Error al obtener plantilla' });
    }
});

// POST /api/email/templates - Crear plantilla
router.post('/templates', (req, res) => {
    try {
        const {
            event_id = null,
            name,
            subject,
            body_html,
            body_text,
            category = 'general',
            is_system = false
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        getEmailDb().prepare(`
            INSERT INTO email_templates (id, event_id, name, subject, body_html, body_text, category, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, event_id, name, subject, body_html, body_text, category, is_system ? 1 : 0, now, now);
        
        const template = getEmailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
        res.status(201).json(template);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Error al crear plantilla' });
    }
});

// PUT /api/email/templates/:id - Actualizar plantilla
router.put('/templates/:id', (req, res) => {
    try {
        const existing = getEmailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        
        if (existing.is_system) {
            return res.status(403).json({ error: 'No se puede modificar una plantilla del sistema' });
        }
        
        const { name, subject, body_html, body_text, category } = req.body;
        const now = new Date().toISOString();
        
        getEmailDb().prepare(`
            UPDATE email_templates SET
                name = COALESCE(?, name),
                subject = COALESCE(?, subject),
                body_html = COALESCE(?, body_html),
                body_text = COALESCE(?, body_text),
                category = COALESCE(?, category),
                updated_at = ?
            WHERE id = ?
        `).run(name, subject, body_html, body_text, category, now, req.params.id);
        
        const template = getEmailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
        res.json(template);
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Error al actualizar plantilla' });
    }
});

// DELETE /api/email/templates/:id - Eliminar plantilla
router.delete('/templates/:id', (req, res) => {
    try {
        const template = getEmailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        
        if (template.is_system) {
            return res.status(403).json({ error: 'No se puede eliminar una plantilla del sistema' });
        }
        
        getEmailDb().prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Error al eliminar plantilla' });
    }
});

// POST /api/email/templates/seed - Crear plantillas base del sistema
router.post('/templates/seed', (req, res) => {
    try {
        const event_id = req.body.event_id || null;
        const now = new Date().toISOString();
        
        // Verificar si ya existen plantillas del sistema
        const existingSystem = getEmailDb().prepare(
            'SELECT COUNT(*) as count FROM email_templates WHERE is_system = 1'
        ).get();
        
        if (existingSystem.count > 0) {
            return res.json({ success: false, message: 'Las plantillas ya fueron creadas' });
        }
        
        const baseTemplates = [
            {
                id: uuidv4(),
                name: 'Invitación',
                subject: 'Estás invitado a {{event_name}}',
                category: 'invitacion',
                is_system: true,
                body_html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{event_name}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c4dff 100%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{company_name}}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #333333;">
                            <h2 style="color: #8b5cf6; margin-top: 0;">¡Hola {{guest_first_name}}!</h2>
                            <p style="font-size: 16px; line-height: 1.6;">Te encantará este evento.</p>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin: 0 0 10px; color: #333;">{{event_name}}</h3>
                                <p style="margin: 5px 0; font-size: 14px;">📅 {{event_date}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">🕐 {{event_time}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">📍 {{event_location}}</p>
                            </div>
                            <p style="font-size: 14px; line-height: 1.6;">{{event_description}}</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{boton_confirmar}}" style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Confirmar Asistencia</a>
                            </div>
                            <p style="font-size: 14px; color: #666;">Si no puedes asistir, por favor háznoslo saber.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">{{company_name}} - {{company_address}}</p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">© {{current_year}} Todos los derechos reservados</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
            },
            {
                id: uuidv4(),
                name: 'Recordatorio 7 días',
                subject: 'Recordatorio: {{event_name}} es en 7 días',
                category: 'recordatorio',
                is_system: true,
                body_html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Recordatorio</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c4dff 100%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{company_name}}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #333333;">
                            <h2 style="color: #8b5cf6; margin-top: 0;">¡Hola {{guest_first_name}}!</h2>
                            <p style="font-size: 16px; line-height: 1.6;">Solo faltan <strong>7 días</strong> para {{event_name}}!</p>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0; font-size: 14px;">📅 {{event_date}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">🕐 {{event_time}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">📍 {{event_location}}</p>
                            </div>
                            <p style="font-size: 14px;">¿Te acompañamos?</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{boton_confirmar}}" style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Confirmar Asistencia</a>
                            </div>
                            <p style="font-size: 14px; color: #666;">¡Te esperamos con gusto!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">{{company_name}} - {{company_address}}</p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">© {{current_year}} Todos los derechos reservados</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
            },
            {
                id: uuidv4(),
                name: 'Confirmación de Asistencia',
                subject: 'Confirmación - {{event_name}}',
                category: 'confirmacion',
                is_system: true,
                body_html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Confirmación</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c4dff 100%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{company_name}}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #333333;">
                            <h2 style="color: #8b5cf6; margin-top: 0;">¡Gracias por confirmar, {{guest_first_name}}!</h2>
                            <p style="font-size: 16px; line-height: 1.6;">Tu asistencia a <strong>{{event_name}}</strong> ha sido confirmada.</p>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0; font-size: 14px;">📅 {{event_date}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">🕐 {{event_time}}</p>
                                <p style="margin: 5px 0; font-size: 14px;">📍 {{event_location}}</p>
                            </div>
                            <p style="font-size: 14px;">Tu código QR de acceso:</p>
                            <div style="text-align: center; margin: 20px 0;">{{qr_code}}</div>
                            <p style="font-size: 14px; color: #666;">Guarda este email para el día del evento.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">{{company_name}} - {{company_address}}</p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">© {{current_year}} Todos los derechos reservados</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
            }
        ];
        
        const insert = getEmailDb().prepare(`
            INSERT INTO email_templates (id, event_id, name, subject, body_html, category, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const t of baseTemplates) {
            insert.run(t.id, event_id, t.name, t.subject, t.body_html, t.category, 1, now, now);
        }
        
        res.json({ success: true, count: baseTemplates.length });
    } catch (error) {
        console.error('Error seeding templates:', error);
        res.status(500).json({ error: 'Error al crear plantillas base' });
    }
});

// ============================================================
// CAMPAÑAS DE EMAIL
// ============================================================

// GET /api/email/campaigns - Listar campañas
router.get('/campaigns', (req, res) => {
    try {
        const { event_id, status } = req.query;
        let query = 'SELECT * FROM email_campaigns WHERE 1=1';
        let params = [];
        
        if (event_id) {
            query += ' AND event_id = ?';
            params.push(event_id);
        }
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC';
        const campaigns = getEmailDb().prepare(query).all(...params);
        
        res.json(campaigns);
    } catch (error) {
        console.error('Error listing campaigns:', error);
        res.status(500).json({ error: 'Error al listar campañas' });
    }
});

// GET /api/email/campaigns/:id - Obtener campaña
router.get('/campaigns/:id', (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        res.json(campaign);
    } catch (error) {
        console.error('Error getting campaign:', error);
        res.status(500).json({ error: 'Error al obtener campaña' });
    }
});

// POST /api/email/campaigns - Crear campaña
router.post('/campaigns', (req, res) => {
    try {
        const {
            event_id,
            account_id,
            name,
            subject,
            body_html,
            recipient_type = 'all',
            recipient_group_id = null,
            scheduled_at = null
        } = req.body;
        
        if (!name || !account_id) {
            return res.status(400).json({ error: 'Nombre y cuenta son requeridos' });
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        const status = scheduled_at ? 'SCHEDULED' : 'DRAFT';
        
        getEmailDb().prepare(`
            INSERT INTO email_campaigns (
                id, event_id, account_id, name, subject, body_html, status,
                recipient_type, recipient_group_id, scheduled_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, event_id, account_id, name, subject, body_html, status, recipient_type, recipient_group_id, scheduled_at, now, now);
        
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(id);
        res.status(201).json(campaign);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Error al crear campaña' });
    }
});

// PUT /api/email/campaigns/:id - Actualizar campaña
router.put('/campaigns/:id', (req, res) => {
    try {
        const existing = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (existing.status === 'SENDING') {
            return res.status(400).json({ error: 'No se puede modificar una campaña en envío' });
        }
        
        const { name, subject, body_html, recipient_type, recipient_group_id, scheduled_at } = req.body;
        const now = new Date().toISOString();
        
        getEmailDb().prepare(`
            UPDATE email_campaigns SET
                name = COALESCE(?, name),
                subject = COALESCE(?, subject),
                body_html = COALESCE(?, body_html),
                recipient_type = COALESCE(?, recipient_type),
                recipient_group_id = COALESCE(?, recipient_group_id),
                scheduled_at = COALESCE(?, scheduled_at),
                updated_at = ?
            WHERE id = ?
        `).run(name, subject, body_html, recipient_type, recipient_group_id, scheduled_at, now, req.params.id);
        
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        res.json(campaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Error al actualizar campaña' });
    }
});

// DELETE /api/email/campaigns/:id - Eliminar campaña
router.delete('/campaigns/:id', (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (campaign.status === 'SENDING') {
            return res.status(400).json({ error: 'No se puede eliminar una campaña en envío' });
        }
        
        // Eliminar logs y queue relacionados
        getEmailDb().prepare('DELETE FROM email_logs WHERE campaign_id = ?').run(req.params.id);
        getEmailDb().prepare('DELETE FROM email_queue WHERE campaign_id = ?').run(req.params.id);
        getEmailDb().prepare('DELETE FROM email_campaigns WHERE id = ?').run(req.params.id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Error al eliminar campaña' });
    }
});

// POST /api/email/campaigns/:id/send - Iniciar envío
router.post('/campaigns/:id/send', async (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
            return res.status(400).json({ error: `No se puede iniciar envío. Estado actual: ${campaign.status}` });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(campaign.account_id);
        if (!account || !account.is_active) {
            return res.status(400).json({ error: 'Cuenta de email no disponible o inactiva' });
        }
        
        // Obtener destinatarios según tipo
        let recipients = [];
        
        if (campaign.event_id) {
            const guests = getEmailDb().prepare(`
                SELECT name, email FROM guests 
                WHERE event_id = ? AND unsubscribed = 0 AND email IS NOT NULL AND email != ''
            `).all(campaign.event_id);
            
            if (campaign.recipient_type === 'confirmed') {
                recipients = guests.filter(g => g.checked_in === 1);
            } else if (campaign.recipient_type === 'pending') {
                recipients = guests.filter(g => g.checked_in === 0);
            } else {
                recipients = guests;
            }
        }
        
        if (recipients.length === 0) {
            return res.status(400).json({ error: 'No hay destinatarios para esta campaña' });
        }
        
        // Crear queue items
        const queueInsert = getEmailDb().prepare(`
            INSERT INTO email_queue (id, campaign_id, account_id, recipient_email, recipient_data, subject, body_html, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `);
        
        for (const r of recipients) {
            const recipientData = JSON.stringify({ name: r.name, email: r.email });
            queueInsert.run(uuidv4(), campaign.id, account.id, r.email, recipientData, campaign.subject, campaign.body_html, new Date().toISOString());
        }
        
        // Actualizar campaña
        const now = new Date().toISOString();
        getEmailDb().prepare(`
            UPDATE email_campaigns SET 
                status = 'SENDING', 
                started_at = ?,
                total_recipients = ?,
                updated_at = ?
            WHERE id = ?
        `).run(now, recipients.length, now, campaign.id);
        
        // Iniciar procesamiento asíncrono
        processEmailQueue(campaign.id, account);
        
        res.json({ success: true, message: `Envío iniciado a ${recipients.length} destinatarios` });
    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({ error: 'Error al iniciar envío' });
    }
});

// POST /api/email/campaigns/:id/pause - Pausar envío
router.post('/campaigns/:id/pause', (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (campaign.status !== 'SENDING') {
            return res.status(400).json({ error: 'Solo se pueden pausar campañas en envío' });
        }
        
        getEmailDb().prepare(`
            UPDATE email_campaigns SET status = 'PAUSED', updated_at = ? WHERE id = ?
        `).run(new Date().toISOString(), req.params.id);
        
        // Marcar items pending como PAUSED
        getEmailDb().prepare(`
            UPDATE email_queue SET status = 'PAUSED' WHERE campaign_id = ? AND status = 'PROCESSING'
        `).run(req.params.id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error pausing campaign:', error);
        res.status(500).json({ error: 'Error al pausar campaña' });
    }
});

// POST /api/email/campaigns/:id/resume - Reanudar envío
router.post('/campaigns/:id/resume', async (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (campaign.status !== 'PAUSED') {
            return res.status(400).json({ error: 'Solo se pueden reanudar campañas pausadas' });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(campaign.account_id);
        
        getEmailDb().prepare(`
            UPDATE email_campaigns SET status = 'SENDING', updated_at = ? WHERE id = ?
        `).run(new Date().toISOString(), req.params.id);
        
        // Reanudar procesamiento
        processEmailQueue(campaign.id, account);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error resuming campaign:', error);
        res.status(500).json({ error: 'Error al reanudar campaña' });
    }
});

// POST /api/email/campaigns/:id/cancel - Cancelar envío
router.post('/campaigns/:id/cancel', (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        if (campaign.status !== 'SENDING' && campaign.status !== 'PAUSED') {
            return res.status(400).json({ error: 'Solo se pueden cancelar campañas en envío o pausadas' });
        }
        
        const now = new Date().toISOString();
        getEmailDb().prepare(`
            UPDATE email_campaigns SET status = 'CANCELLED', completed_at = ?, updated_at = ? WHERE id = ?
        `).run(now, now, req.params.id);
        
        // Marcar items pendientes como cancelled
        getEmailDb().prepare(`
            UPDATE email_queue SET status = 'CANCELLED' WHERE campaign_id = ? AND status IN ('PENDING', 'PROCESSING')
        `).run(req.params.id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling campaign:', error);
        res.status(500).json({ error: 'Error al cancelar campaña' });
    }
});

// GET /api/email/campaigns/:id/logs - Obtener logs de campaña
router.get('/campaigns/:id/logs', (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        let query = 'SELECT * FROM email_logs WHERE campaign_id = ?';
        let params = [req.params.id];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const logs = getEmailDb().prepare(query).all(...params);
        res.json(logs);
    } catch (error) {
        console.error('Error getting campaign logs:', error);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

// GET /api/email/campaigns/:id/stats - Obtener estadísticas de campaña
router.get('/campaigns/:id/stats', (req, res) => {
    try {
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        
        const stats = {
            total: campaign.total_recipients,
            sent: campaign.sent_count,
            failed: campaign.failed_count,
            pending: getEmailDb().prepare('SELECT COUNT(*) as count FROM email_queue WHERE campaign_id = ? AND status IN (\'PENDING\', \'PROCESSING\')').get(req.params.id).count,
            status: campaign.status
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting campaign stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// ============================================================
// ENVÍO DE EMAIL INDIVIDUAL
// ============================================================

// POST /api/email/send - Enviar email individual
router.post('/send', async (req, res) => {
    try {
        const { account_id, to, subject, body_html, body_text, variables = {} } = req.body;
        
        if (!account_id || !to || !subject) {
            return res.status(400).json({ error: 'account_id, to y subject son requeridos' });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ? AND is_active = 1').get(account_id);
        if (!account) {
            return res.status(400).json({ error: 'Cuenta de email no disponible' });
        }
        
        // Verificar límite diario
        const today = new Date().toISOString().split('T')[0];
        if (account.last_sent_date !== today) {
            getEmailDb().prepare('UPDATE email_accounts SET emails_sent_today = 0, last_sent_date = ? WHERE id = ?').run(today, account_id);
            account.emails_sent_today = 0;
        }
        
        if (account.emails_sent_today >= account.daily_limit) {
            return res.status(400).json({ error: 'Límite diario de emails alcanzado' });
        }
        
        // Reemplazar variables
        const processedSubject = replaceTemplateVariables(subject, variables);
        const processedHtml = replaceTemplateVariables(body_html, variables);
        const processedText = replaceTemplateVariables(body_text, variables);
        
        // Enviar email
        const transporter = nodemailer.createTransport(getSmtpConfig(account));
        
        const mailOptions = {
            from: `"${account.sender_name || account.name}" <${account.sender_email || account.smtp_user}>`,
            to,
            subject: processedSubject,
            html: processedHtml,
            text: processedText
        };
        
        const result = await transporter.sendMail(mailOptions);
        
        // Actualizar contador
        getEmailDb().prepare('UPDATE email_accounts SET emails_sent_today = emails_sent_today + 1 WHERE id = ?').run(account_id);
        
        // Registrar log
        getEmailDb().prepare(`
            INSERT INTO email_logs (id, account_id, recipient_email, recipient_name, subject, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, 'SENT', ?, ?)
        `).run(uuidv4(), account_id, to, variables.guest_name || to.split('@')[0], processedSubject, new Date().toISOString(), new Date().toISOString());
        
        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// MAILBOX (IMAP)
// ============================================================

// GET /api/email/mailbox/folders - Obtener carpetas IMAP
router.get('/mailbox/folders', async (req, res) => {
    try {
        const { account_id } = req.query;
        
        if (!account_id) {
            return res.status(400).json({ error: 'account_id es requerido' });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ? AND is_active = 1').get(account_id);
        if (!account) {
            return res.status(400).json({ error: 'Cuenta no disponible' });
        }
        
        const imap = new Imap(getImapConfig(account));
        
        return new Promise((resolve) => {
            imap.once('ready', () => {
                imap.getBoxes((err, boxes) => {
                    imap.end();
                    if (err) {
                        res.json({ success: false, error: err.message });
                        resolve();
                        return;
                    }
                    
                    // Extraer solo nombres de carpetas (evitar referencias circulares)
                    const folderNames = [];
                    function extractFolders(boxObj, prefix = '') {
                        if (!boxObj) return;
                        for (const [name, box] of Object.entries(boxObj)) {
                            if (box && typeof box === 'object' && box.name) {
                                folderNames.push(prefix ? `${prefix}/${box.name}` : box.name);
                                if (box.children) {
                                    extractFolders(box.children, prefix ? `${prefix}/${box.name}` : box.name);
                                }
                            }
                        }
                    }
                    extractFolders(boxes);
                    
                    // Asegurar carpetas estándar
                    const standardFolders = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam', 'Junk'];
                    for (const sf of standardFolders) {
                        if (!folderNames.includes(sf) && !folderNames.some(f => f.toLowerCase() === sf.toLowerCase())) {
                            folderNames.push(sf);
                        }
                    }
                    
                    res.json({ success: true, folders: folderNames.sort() });
                    resolve();
                });
            });
            
            imap.once('error', (err) => {
                res.json({ success: false, error: err.message });
                resolve();
            });
            
            imap.connect();
        });
    } catch (error) {
        console.error('Error getting mailbox folders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/email/mailbox/messages - Obtener mensajes de una carpeta
router.get('/mailbox/messages', async (req, res) => {
    try {
        const { account_id, folder = 'INBOX', limit = 50, offset = 0 } = req.query;
        
        if (!account_id) {
            return res.status(400).json({ error: 'account_id es requerido' });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ? AND is_active = 1').get(account_id);
        if (!account) {
            return res.status(400).json({ error: 'Cuenta no disponible' });
        }
        
        const imap = new Imap(getImapConfig(account));
        
        return new Promise((resolve) => {
            imap.once('ready', () => {
                let folderName = folder;
                if (folder !== 'INBOX' && !folder.startsWith('INBOX.')) {
                    folderName = `INBOX.${folder}`;
                }
                
                imap.openBox(folderName, true, (err, box) => {
                    if (err) {
                        imap.end();
                        res.json({ success: false, error: err.message });
                        return resolve();
                    }
                    
                    const total = box.messages.total;
                    
                    if (total === 0) {
                        imap.end();
                        res.json({ success: true, messages: [], total: 0 });
                        return resolve();
                    }
                    
                    // Search para obtener TODOS los UIDs
                    imap.search([['ALL']], (err, results) => {
                        if (err || !results || results.length === 0) {
                            imap.end();
                            res.json({ success: err ? false : true, messages: [], total });
                            return resolve();
                        }
                        
                        // Obtener los últimos N UIDs
                        const count = Math.min(limit, total);
                        const uids = results.slice(-count);
                        const messages = [];
                        
                        // Fetch secuencial: un UID a la vez
                        function fetchNext(index) {
                            if (index >= uids.length) {
                                imap.end();
                                res.json({ success: true, messages, total });
                                return resolve();
                            }
                            
                            const uid = uids[index];
                            const fetch = imap.fetch([uid], {
                                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
                                markSeen: false
                            });
                            
                            fetch.on('message', (msg) => {
                                const msgData = { uid: uid, from: '', from_name: '', to: '', subject: '', date: '', seen: false };
                                
                                msg.on('attributes', (attrs) => {
                                    msgData.seen = attrs.flags.includes('\\Seen');
                                });
                                
                                msg.on('body', (stream) => {
                                    let buffer = '';
                                    stream.on('data', chunk => { buffer += chunk.toString('utf8'); });
                                    stream.on('end', () => {
                                        const lines = buffer.split(/\r?\n/);
                                        for (const line of lines) {
                                            if (/^From:/i.test(line) && !msgData.from) {
                                                const clean = line.replace(/^From:\s*/i, '').trim();
                                                const match = clean.match(/^(.*?)\s*<(.+?)>/);
                                                if (match) {
                                                    msgData.from_name = match[1].replace(/"/g, '').trim();
                                                    msgData.from = match[2].trim();
                                                } else {
                                                    msgData.from = clean;
                                                }
                                            } else if (/^To:/i.test(line) && !msgData.to) {
                                                const clean = line.replace(/^To:\s*/i, '').trim();
                                                const match = clean.match(/<(.+?)>/);
                                                msgData.to = match ? match[1] : clean;
                                            } else if (/^Subject:/i.test(line) && !msgData.subject) {
                                                msgData.subject = line.replace(/^Subject:\s*/i, '').trim();
                                            } else if (/^Date:/i.test(line) && !msgData.date) {
                                                msgData.date = line.replace(/^Date:\s*/i, '').trim();
                                            }
                                        }
                                        messages.push(msgData);
                                        // Siguiente mensaje
                                        fetchNext(index + 1);
                                    });
                                });
                            });
                            
                            fetch.once('error', () => {
                                // Skip this message and continue
                                fetchNext(index + 1);
                            });
                        }
                        
                        fetchNext(0);
                    });
                });
            });
            
            imap.once('error', (err) => {
                res.json({ success: false, error: err.message });
                resolve();
            });
            
            imap.connect();
        });
    } catch (error) {
        console.error('Error getting mailbox messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/email/mailbox/message/:uid - Obtener mensaje completo
router.get('/mailbox/message/:uid', async (req, res) => {
    try {
        const { account_id, folder = 'INBOX' } = req.query;
        const { uid } = req.params;
        
        if (!account_id) {
            return res.status(400).json({ error: 'account_id es requerido' });
        }
        
        const account = getEmailDb().prepare('SELECT * FROM email_accounts WHERE id = ? AND is_active = 1').get(account_id);
        if (!account) {
            return res.status(400).json({ error: 'Cuenta no disponible' });
        }
        
        const imap = new Imap(getImapConfig(account));
        
        return new Promise((resolve) => {
            imap.once('ready', () => {
                let folderName = folder;
                if (folder !== 'INBOX' && !folder.startsWith('INBOX.')) {
                    folderName = `INBOX.${folder}`;
                }
                
                imap.openBox(folderName, false, (err, box) => {
                    if (err) {
                        imap.end();
                        res.json({ success: false, error: err.message });
                        return resolve();
                    }
                    
                    // Fetch solo headers + texto plano (no HTML completo para evitar problemas de memoria)
                    const fetch = imap.fetch(uid, { 
                        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                        markSeen: false 
                    });
                    
                    let headersParsed = false;
                    let bodyParsed = false;
                    const msgData = {
                        id: uid,
                        from: '', from_name: '', to: '', subject: '', date: '',
                        html: '', text: '', attachments: []
                    };
                    
                    fetch.on('message', (msg) => {
                        msg.on('body', (stream, info) => {
                            let buffer = '';
                            stream.on('data', chunk => { buffer += chunk.toString('utf8'); });
                            stream.on('end', () => {
                                if (info.which.includes('HEADER')) {
                                    const lines = buffer.split(/\r?\n/);
                                    for (const line of lines) {
                                        if (/^From:/i.test(line) && !msgData.from) {
                                            const clean = line.replace(/^From:\s*/i, '').trim();
                                            const match = clean.match(/^(.*?)\s*<(.+?)>/);
                                            if (match) {
                                                msgData.from_name = match[1].replace(/"/g, '').trim();
                                                msgData.from = match[2].trim();
                                            } else {
                                                msgData.from = clean;
                                            }
                                        } else if (/^To:/i.test(line) && !msgData.to) {
                                            const clean = line.replace(/^To:\s*/i, '').trim();
                                            const match = clean.match(/<(.+?)>/);
                                            msgData.to = match ? match[1] : clean;
                                        } else if (/^Subject:/i.test(line) && !msgData.subject) {
                                            msgData.subject = line.replace(/^Subject:\s*/i, '').trim();
                                        } else if (/^Date:/i.test(line) && !msgData.date) {
                                            msgData.date = line.replace(/^Date:\s*/i, '').trim();
                                        }
                                    }
                                    headersParsed = true;
                                    tryFinish();
                                } else {
                                    // Limitar el body a 50KB para evitar problemas de memoria
                                    const maxLen = 50000;
                                    const bodyText = buffer.length > maxLen ? buffer.substring(0, maxLen) + '\n\n[...contenido truncado...]' : buffer;
                                    msgData.text = bodyText;
                                    msgData.html = `<pre style="white-space:pre-wrap;word-wrap:break-word;font-family:inherit;">${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                                    bodyParsed = true;
                                    tryFinish();
                                }
                            });
                        });
                        
                        msg.once('end', () => {
                            // Si no se recibió body, marcar como parseado
                            if (!bodyParsed) {
                                bodyParsed = true;
                                tryFinish();
                            }
                        });
                    });
                    
                    function tryFinish() {
                        if (headersParsed && bodyParsed) {
                            imap.end();
                            res.json({ success: true, message: msgData });
                            resolve();
                        }
                    }
                    
                    fetch.once('end', () => {
                        // Timeout de seguridad
                        setTimeout(() => {
                            if (!headersParsed || !bodyParsed) {
                                imap.end();
                                res.json({ success: true, message: msgData });
                                resolve();
                            }
                        }, 5000);
                    });
                    
                    fetch.once('error', (err) => {
                        imap.end();
                        res.json({ success: false, error: err.message });
                        resolve();
                    });
                });
            });
            
            imap.once('error', (err) => {
                res.json({ success: false, error: err.message });
                resolve();
            });
            
            imap.connect();
        });
    } catch (error) {
        console.error('Error getting mailbox message:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PROCESAMIENTO DE COLA (ASYNC)
// ============================================================

async function processEmailQueue(campaignId, account) {
    const processNext = async () => {
        // Verificar si la campaña sigue en envío
        const campaign = getEmailDb().prepare('SELECT * FROM email_campaigns WHERE id = ?').get(campaignId);
        if (!campaign || campaign.status !== 'SENDING') {
            console.log(`[EMAIL] Campaign ${campaignId} stopped`);
            return;
        }
        
        // Obtener siguiente email pendiente
        const item = getEmailDb().prepare(`
            SELECT * FROM email_queue 
            WHERE campaign_id = ? AND status = 'PENDING' 
            ORDER BY created_at ASC LIMIT 1
        `).get(campaignId);
        
        if (!item) {
            // No hay más emails pendientes, marcar como completado
            const now = new Date().toISOString();
            getEmailDb().prepare(`
                UPDATE email_campaigns SET status = 'SENT', completed_at = ?, updated_at = ? WHERE id = ?
            `).run(now, now, campaignId);
            console.log(`[EMAIL] Campaign ${campaignId} completed`);
            return;
        }
        
        // Marcar como procesando
        getEmailDb().prepare('UPDATE email_queue SET status = ? WHERE id = ?').run('PROCESSING', item.id);
        
        try {
            // Parsear datos del destinatario
            const recipientData = JSON.parse(item.recipient_data || '{}');
            
            // Reemplazar variables en contenido
            const processedSubject = replaceTemplateVariables(item.subject, recipientData);
            const processedHtml = replaceTemplateVariables(item.body_html, recipientData);
            
            // Enviar email
            const transporter = nodemailer.createTransport(getSmtpConfig(account));
            
            const mailOptions = {
                from: `"${account.sender_name || account.name}" <${account.sender_email || account.smtp_user}>`,
                to: item.recipient_email,
                subject: processedSubject,
                html: processedHtml
            };
            
            await transporter.sendMail(mailOptions);
            
            // Marcar como enviado
            getEmailDb().prepare(`
                UPDATE email_queue SET status = 'SENT', processed_at = ? WHERE id = ?
            `).run(new Date().toISOString(), item.id);
            
            // Actualizar contadores
            getEmailDb().prepare(`
                UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?
            `).run(campaignId);
            
            // Registrar log
            getEmailDb().prepare(`
                INSERT INTO email_logs (id, campaign_id, account_id, recipient_email, recipient_name, subject, status, sent_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'SENT', ?, ?)
            `).run(uuidv4(), campaignId, account.id, item.recipient_email, recipientData.name || '', processedSubject, new Date().toISOString(), new Date().toISOString());
            
            // Actualizar contador de la cuenta
            getEmailDb().prepare('UPDATE email_accounts SET emails_sent_today = emails_sent_today + 1 WHERE id = ?').run(account.id);
            
            // Continuar con el siguiente (rate limiting: 1 email por segundo)
            setTimeout(processNext, 1000);
            
        } catch (error) {
            console.error(`[EMAIL] Error sending to ${item.recipient_email}:`, error.message);
            
            // Incrementar intentos
            const newAttempts = item.attempts + 1;
            
            if (newAttempts >= item.max_attempts) {
                // Marcar como fallido
                getEmailDb().prepare(`
                    UPDATE email_queue SET status = 'FAILED', attempts = ?, error_message = ?, processed_at = ? WHERE id = ?
                `).run(newAttempts, error.message, new Date().toISOString(), item.id);
                
                getEmailDb().prepare(`
                    UPDATE email_campaigns SET failed_count = failed_count + 1 WHERE id = ?
                `).run(campaignId);
                
                // Registrar log de fallo
                getEmailDb().prepare(`
                    INSERT INTO email_logs (id, campaign_id, account_id, recipient_email, subject, status, error_message, created_at)
                    VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?)
                `).run(uuidv4(), campaignId, account.id, item.recipient_email, item.subject, error.message, new Date().toISOString());
            } else {
                // Programar reintento
                const nextRetry = new Date(Date.now() + 60000 * Math.pow(2, newAttempts)).toISOString();
                getEmailDb().prepare(`
                    UPDATE email_queue SET status = 'PENDING', attempts = ?, next_retry = ? WHERE id = ?
                `).run(newAttempts, nextRetry, item.id);
            }
            
            // Continuar con el siguiente
            setTimeout(processNext, 1000);
        }
    };
    
    // Iniciar procesamiento
    processNext();
}

module.exports = router;