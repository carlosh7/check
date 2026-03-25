/**
 * Email Queue System con Bull + Redis
 * Manejo de alto volumen de emails con retry automático
 */

const { getRedisClient } = require('./redis-cache');

let emailQueue = null;
let emailWorker = null;

/**
 * Inicializa la cola de emails con Bull
 */
async function initEmailQueue() {
    const redisClient = await getRedisClient();
    if (!redisClient) {
        console.log('[EMAIL QUEUE] Redis no disponible, usando modo fallback');
        return null;
    }
    
    const Bull = require('bull');
    
    emailQueue = new Bull('email-queue', {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined
        },
        defaultJobOptions: {
            removeOnComplete: 1000,  // Mantener últimos 1000 completados
            removeOnFail: 5000,       // Mantener últimos 5000 fallidos
            attempts: 5,              // Reintentos máximos
            backoff: {
                type: 'exponential',  // Backoff exponencial
                delay: 2000           // 2s, 4s, 8s, 16s, 32s
            },
            timeout: 30000            // Timeout de 30s por email
        },
        settings: {
            lockDuration: 30000,
            maxStalledCount: 2
        }
    });
    
    // Event listeners
    emailQueue.on('completed', (job, result) => {
        console.log(`[EMAIL QUEUE] Job ${job.id} completado`, result);
    });
    
    emailQueue.on('failed', (job, err) => {
        console.error(`[EMAIL QUEUE] Job ${job.id} fallido:`, err.message);
    });
    
    emailQueue.on('waiting', (jobId) => {
        console.log(`[EMAIL QUEUE] Job ${jobId} en espera`);
    });
    
    console.log('[EMAIL QUEUE] Sistema de cola inicializado con Bull');
    return emailQueue;
}

/**
 * Encola un email para envío
 */
async function enqueueEmail(options) {
    if (!emailQueue) {
        // Fallback: enviar directamente
        console.log('[EMAIL QUEUE] Modo fallback - enviando directamente');
        return sendEmailDirect(options);
    }
    
    const {
        to_email,
        subject,
        body_html,
        campaign_id = null,
        guest_id = null,
        priority = 'normal', // low, normal, high
        scheduled_at = null,
        account_id = null // Nueva opción para especificar cuenta
    } = options;
    
    const jobData = {
        to_email,
        subject,
        body_html,
        campaign_id,
        guest_id,
        account_id, // Incluir cuenta seleccionada
        attempts: 0,
        created_at: new Date().toISOString()
    };
    
    let job;
    if (scheduled_at && new Date(scheduled_at) > new Date()) {
        // Programar para más tarde
        const delay = new Date(scheduled_at).getTime() - Date.now();
        job = await emailQueue.add(jobData, { 
            delay,
            priority: priority === 'high' ? 1 : (priority === 'low' ? 10 : 5)
        });
        console.log(`[EMAIL QUEUE] Email programado para ${scheduled_at}`);
    } else {
        // Enviar inmediatamente
        job = await emailQueue.add(jobData, {
            priority: priority === 'high' ? 1 : (priority === 'low' ? 10 : 5)
        });
    }
    
    return { jobId: job.id, queued: true };
}

/**
 * Envía email directamente (fallback)
 */
async function sendEmailDirect(options) {
    const { db } = require('../../database');
    const nodemailer = require('nodemailer');
    
    let config = null;
    
    // Si se específica una cuenta, usarla
    if (options.account_id) {
        config = db.prepare("SELECT * FROM email_accounts WHERE id = ? AND is_active = 1").get(options.account_id);
    }
    
    // Si no hay cuenta específica o no existe, usar la principal
    if (!config || !config.smtp_host) {
        config = db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
    }
    
    if (!config || !config.smtp_host) {
        throw new Error('SMTP no configurado');
    }
    
    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_secure === 1,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass
        }
    });
    
    const result = await transporter.sendMail({
        from: `"${config.from_name || 'Check'}" <${config.from_email || config.smtp_user}>`,
        to: options.to_email,
        subject: options.subject,
        html: options.body_html
    });
    
    // Actualizar contador de uso si es cuenta adicional
    if (options.account_id) {
        db.prepare("UPDATE email_accounts SET used_today = used_today + 1, last_used_at = ? WHERE id = ?")
            .run(new Date().toISOString(), options.account_id);
    }
    
    return { messageId: result.messageId, sent: true };
}

/**
 * Procesador de la cola (worker)
 */
async function startEmailWorker() {
    if (!emailQueue) {
        console.log('[EMAIL QUEUE] Worker no iniciado (Redis no disponible)');
        return;
    }
    
    emailWorker = emailQueue.process(async (job) => {
        const { to_email, subject, body_html, campaign_id, guest_id } = job.data;
        
        console.log(`[EMAIL QUEUE] Procesando email para ${to_email}`);
        
        try {
            const result = await sendEmailDirect(job.data);
            
            // Actualizar logs
            const { db } = require('../../database');
            
            // Log de campaña
            if (campaign_id) {
                db.prepare(`UPDATE email_campaign_logs 
                    SET status = 'SENT', sent_at = ?, error_message = NULL 
                    WHERE campaign_id = ? AND to_email = ?`)
                    .run(new Date().toISOString(), campaign_id, to_email);
                
                // Contador
                db.prepare(`UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`)
                    .run(campaign_id);
            }
            
            // Log general
            const logId = require('uuid').v4();
            db.prepare(`INSERT INTO email_logs (id, event_id, type, subject, from_email, to_email, body_html, message_id, created_at)
                VALUES (?, NULL, 'SENT', ?, ?, ?, ?, ?, ?)`)
                .run(logId, subject, 'system@check.com', to_email, body_html, result.messageId, new Date().toISOString());
            
            return { success: true, messageId: result.messageId };
            
        } catch (error) {
            // Actualizar estado de error
            const { db } = require('../../database');
            
            if (campaign_id) {
                db.prepare(`UPDATE email_campaign_logs 
                    SET status = 'ERROR', error_message = ? 
                    WHERE campaign_id = ? AND to_email = ?`)
                    .run(error.message, campaign_id, to_email);
                
                db.prepare(`UPDATE email_campaigns SET error_count = error_count + 1 WHERE id = ?`)
                    .run(campaign_id);
            }
            
            throw error; // Bull manejará el retry
        }
    });
    
    console.log('[EMAIL QUEUE] Worker iniciado');
    return emailWorker;
}

/**
 * Obtener estadísticas de la cola
 */
async function getQueueStats() {
    if (!emailQueue) {
        return { mode: 'fallback', queued: 0, processed: 0 };
    }
    
    const [waiting, active, completed, failed] = await Promise.all([
        emailQueue.getWaitingCount(),
        emailQueue.getActiveCount(),
        emailQueue.getCompletedCount(),
        emailQueue.getFailedCount()
    ]);
    
    return {
        mode: 'bull',
        waiting,
        active,
        completed,
        failed,
        total: waiting + active
    };
}

/**
 * Pausar cola
 */
async function pauseQueue() {
    if (emailQueue) {
        await emailQueue.pause();
        return true;
    }
    return false;
}

/**
 * Reanudar cola
 */
async function resumeQueue() {
    if (emailQueue) {
        await emailQueue.resume();
        return true;
    }
    return false;
}

/**
 * Limpiar cola
 */
async function clearQueue() {
    if (emailQueue) {
        await emailQueue.empty();
        return true;
    }
    return false;
}

module.exports = {
    initEmailQueue,
    startEmailWorker,
    enqueueEmail,
    getQueueStats,
    pauseQueue,
    resumeQueue,
    clearQueue,
    getQueue: () => emailQueue
};