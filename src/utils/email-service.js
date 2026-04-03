/**
 * Email Service - Wrapper global para envío de emails
 * Usa las cuentas configuradas en el sistema
 */

const nodemailer = require('nodemailer');
const db = require('../../database');
const { v4: uuidv4 } = require('uuid');

class EmailService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minuto
    }
    
    /**
     * Obtiene una cuenta activa para enviar emails
     * Prioriza: event_id específico > cuenta por defecto global
     */
    getAccount(eventId = null) {
        const cacheKey = eventId || 'default';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.account;
        }
        
        let account;
        if (eventId) {
            // Buscar cuenta específica del evento
            account = db.prepare(`
                SELECT * FROM email_accounts 
                WHERE event_id = ? AND is_active = 1 
                ORDER BY is_default DESC 
                LIMIT 1
            `).get(eventId);
            
            // Si no hay del evento, buscar global
            if (!account) {
                account = db.prepare(`
                    SELECT * FROM email_accounts 
                    WHERE event_id IS NULL AND is_active = 1 
                    ORDER BY is_default DESC 
                    LIMIT 1
                `).get();
            }
        } else {
            // Buscar solo cuentas globales
            account = db.prepare(`
                SELECT * FROM email_accounts 
                WHERE event_id IS NULL AND is_active = 1 
                ORDER BY is_default DESC 
                LIMIT 1
            `).get();
        }
        
        if (account) {
            this.cache.set(cacheKey, { account, timestamp: Date.now() });
        }
        
        return account;
    }
    
    /**
     * Verifica si hay una cuenta disponible
     */
    hasAccount(eventId = null) {
        return !!this.getAccount(eventId);
    }
    
    /**
     * Reemplaza variables en plantillas
     */
    replaceVariables(template, data) {
        if (!template) return '';
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }
        return result;
    }
    
    /**
     * Envía un email
     */
    async sendEmail({ to, subject, html, text, eventId = null, variables = {} }) {
        const account = this.getAccount(eventId);
        
        if (!account) {
            console.log('[EmailService] No account available for:', eventId || 'global');
            return { success: false, error: 'No hay cuenta de email configurada' };
        }
        
        // Verificar límite diario
        const today = new Date().toISOString().split('T')[0];
        if (account.last_sent_date !== today) {
            db.prepare('UPDATE email_accounts SET emails_sent_today = 0, last_sent_date = ? WHERE id = ?')
                .run(today, account.id);
            account.emails_sent_today = 0;
        }
        
        if (account.emails_sent_today >= account.daily_limit) {
            return { success: false, error: 'Límite diario de emails alcanzado' };
        }
        
        // Procesar variables
        const processedSubject = this.replaceVariables(subject, variables);
        const processedHtml = this.replaceVariables(html, variables);
        const processedText = this.replaceVariables(text, variables);
        
        try {
            const transporter = nodemailer.createTransport({
                host: account.smtp_host,
                port: account.smtp_port || 587,
                secure: account.smtp_ssl === 1,
                auth: {
                    user: account.smtp_user,
                    pass: account.smtp_password
                }
            });
            
            const mailOptions = {
                from: `"${account.sender_name || account.name}" <${account.sender_email || account.smtp_user}>`,
                to,
                subject: processedSubject,
                html: processedHtml,
                text: processedText
            };
            
            const result = await transporter.sendMail(mailOptions);
            
            // Actualizar contador
            db.prepare('UPDATE email_accounts SET emails_sent_today = emails_sent_today + 1 WHERE id = ?')
                .run(account.id);
            
            // Registrar log
            db.prepare(`
                INSERT INTO email_logs (id, account_id, recipient_email, recipient_name, subject, status, sent_at, created_at)
                VALUES (?, ?, ?, ?, ?, 'SENT', ?, ?)
            `).run(
                uuidv4(),
                account.id,
                to,
                variables.guest_name || to.split('@')[0],
                processedSubject,
                new Date().toISOString(),
                new Date().toISOString()
            );
            
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] Send error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Envía email de prueba
     */
    async sendTestEmail(accountId, to) {
        const account = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(accountId);
        
        if (!account) {
            return { success: false, error: 'Cuenta no encontrada' };
        }
        
        try {
            const transporter = nodemailer.createTransport({
                host: account.smtp_host,
                port: account.smtp_port || 587,
                secure: account.smtp_ssl === 1,
                auth: {
                    user: account.smtp_user,
                    pass: account.smtp_password
                }
            });
            
            await transporter.sendMail({
                from: `"${account.sender_name || account.name}" <${account.sender_email || account.smtp_user}>`,
                to,
                subject: 'Test - Configuración de Email',
                html: `<p>Este es un email de prueba para verificar la configuración.</p>
                       <p>Si recibes este mensaje, la configuración está correcta.</p>
                       <hr><small>Enviado desde Check Pro</small>`,
                text: 'Este es un email de prueba para verificar la configuración.'
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Limpia el cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Singleton
const emailService = new EmailService();

// Exportar para uso global
module.exports = emailService;