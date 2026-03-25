/**
 * Email Tracking System
 * Maneja tracking de aperturas y clicks
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');

/**
 * Genera un tracking ID único para cada email
 */
function generateTrackingId() {
    return uuidv4();
}

/**
 * Inyecta pixel de tracking en el HTML del email
 * @param {string} html - Contenido HTML del email
 * @param {string} campaignId - ID de la campaña
 * @param {string} toEmail - Email del destinatario
 * @param {string} messageId - ID único del mensaje
 * @returns {string} HTML con pixel inyectado
 */
function injectTrackingPixel(html, campaignId, toEmail, messageId) {
    // Pixel invisible de 1x1
    const trackingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/track/open/${messageId}`;
    
    const pixel = `
<!-- Check Pro Tracking Pixel -->
<img src="${trackingUrl}" alt="" width="1" height="1" style="display:none;" />
<!-- End Tracking -->
`;
    
    // Insertar antes del closing body tag
    return html.replace('</body>', `${pixel}</body>`);
}

/**
 * Convierte URLs a URLs rastreadas
 * @param {string} html - Contenido HTML del email
 * @param {string} campaignId - ID de la campaña
 * @param {string} toEmail - Email del destinatario
 * @param {string} messageId - ID único del mensaje
 * @returns {string} HTML con URLs rastreadas
 */
function injectClickTracking(html, campaignId, toEmail, messageId) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const trackingBase = `${baseUrl}/api/track/click`;
    
    // Regex para encontrar URLs
    const urlRegex = /href=["'](https?:\/\/[^"']+)["']/g;
    
    return html.replace(urlRegex, (match, originalUrl) => {
        // No trackear URLs de unsubscribe
        if (originalUrl.includes('/unsubscribe') || originalUrl.includes('mailto:')) {
            return match;
        }
        
        // Codificar parámetros
        const params = new URLSearchParams({
            url: originalUrl,
            campaign: campaignId || '',
            email: toEmail,
            msg: messageId
        });
        
        const trackedUrl = `${trackingBase}?${params.toString()}`;
        return `href="${trackedUrl}"`;
    });
}

/**
 * Procesa un email con tracking completo
 */
function processEmailForTracking(html, options) {
    const { campaignId, toEmail } = options;
    
    // Generar message ID único
    const messageId = options.messageId || generateTrackingId();
    
    let processedHtml = html;
    
    // 1. Inyectar pixel de apertura
    processedHtml = injectTrackingPixel(processedHtml, campaignId, toEmail, messageId);
    
    // 2. Rastrear clicks
    processedHtml = injectClickTracking(processedHtml, campaignId, toEmail, messageId);
    
    return {
        html: processedHtml,
        messageId
    };
}

/**
 * Registra una apertura de email
 */
function registerOpen(messageId, ipAddress, userAgent) {
    try {
        // Buscar el email relacionado
        const log = db.prepare(`
            SELECT * FROM email_logs WHERE message_id = ? LIMIT 1
        `).get(messageId);
        
        if (!log) {
            console.log('[TRACKING] Message ID no encontrado:', messageId);
            return false;
        }
        
        // Buscar en campaign logs
        const campaignLog = db.prepare(`
            SELECT * FROM email_campaign_logs WHERE to_email = ? 
            ORDER BY sent_at DESC LIMIT 1
        `).get(log.to_email);
        
        const trackingId = uuidv4();
        const now = new Date().toISOString();
        
        // Guardar apertura
        db.prepare(`
            INSERT INTO email_tracking_opens (id, campaign_id, guest_id, to_email, message_id, opened_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            trackingId,
            campaignLog?.campaign_id || null,
            campaignLog?.guest_id || null,
            log.to_email,
            messageId,
            now,
            ipAddress || null,
            userAgent || null
        );
        
        // Actualizar campaign log si existe
        if (campaignLog) {
            db.prepare(`
                UPDATE email_campaign_logs SET opened_at = ? WHERE campaign_id = ? AND to_email = ?
            `).run(now, campaignLog.campaign_id, log.to_email);
        }
        
        console.log('[TRACKING] Apertura registrada para:', log.to_email);
        return true;
        
    } catch (error) {
        console.error('[TRACKING] Error al registrar apertura:', error.message);
        return false;
    }
}

/**
 * Registra un click
 */
function registerClick(originalUrl, campaignId, toEmail, messageId, ipAddress, userAgent) {
    try {
        const trackingId = uuidv4();
        const now = new Date().toISOString();
        
        // Buscar guest_id
        const guest = db.prepare(`SELECT id FROM guests WHERE email = ? LIMIT 1`).get(toEmail);
        
        db.prepare(`
            INSERT INTO email_tracking_clicks (id, campaign_id, guest_id, to_email, message_id, original_url, clicked_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            trackingId,
            campaignId || null,
            guest?.id || null,
            toEmail,
            messageId,
            originalUrl,
            now,
            ipAddress || null,
            userAgent || null
        );
        
        // Actualizar campaign log
        if (campaignId) {
            db.prepare(`
                UPDATE email_campaign_logs SET clicked_at = ? WHERE campaign_id = ? AND to_email = ?
            `).run(now, campaignId, toEmail);
        }
        
        console.log('[TRACKING] Click registrado para:', toEmail, 'URL:', originalUrl);
        return true;
        
    } catch (error) {
        console.error('[TRACKING] Error al registrar click:', error.message);
        return false;
    }
}

/**
 * Obtiene estadísticas de tracking para una campaña
 */
function getCampaignTrackingStats(campaignId) {
    const stats = {
        opens: { total: 0, unique: 0, percentage: 0 },
        clicks: { total: 0, unique: 0, percentage: 0 },
        bounces: 0
    };
    
    // Obtener total de emails enviados
    const sent = db.prepare(`
        SELECT COUNT(*) as count FROM email_campaign_logs 
        WHERE campaign_id = ? AND status = 'SENT'
    `).get(campaignId);
    
    const totalSent = sent?.count || 0;
    
    if (totalSent === 0) return stats;
    
    // Opens únicos
    const opens = db.prepare(`
        SELECT COUNT(DISTINCT to_email) as count FROM email_tracking_opens 
        WHERE campaign_id = ?
    `).get(campaignId);
    
    // Clicks únicos  
    const clicks = db.prepare(`
        SELECT COUNT(DISTINCT to_email) as count FROM email_tracking_clicks 
        WHERE campaign_id = ?
    `).get(campaignId);
    
    stats.opens.total = opens?.count || 0;
    stats.opens.unique = opens?.count || 0;
    stats.opens.percentage = Math.round((stats.opens.unique / totalSent) * 100);
    
    stats.clicks.total = clicks?.count || 0;
    stats.clicks.unique = clicks?.count || 0;
    stats.clicks.percentage = Math.round((stats.clicks.unique / totalSent) * 100);
    
    // Bounces
    const bounces = db.prepare(`
        SELECT COUNT(*) as count FROM email_campaign_logs 
        WHERE campaign_id = ? AND status = 'BOUNCED'
    `).get(campaignId);
    stats.bounces = bounces?.count || 0;
    
    return stats;
}

module.exports = {
    generateTrackingId,
    injectTrackingPixel,
    injectClickTracking,
    processEmailForTracking,
    registerOpen,
    registerClick,
    getCampaignTrackingStats
};