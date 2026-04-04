/**
 * Rutas para notificaciones push (Web Push API)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

// Importación condicional de web-push (puede no estar disponible)
let webpush = null;
try {
    webpush = require('web-push');
} catch (e) {
    console.warn('⚠️ web-push no disponible. Notificaciones push deshabilitadas.');
}

const router = express.Router();

// Función para obtener VAPID keys desde base de datos o variables de entorno
function getVapidKeys() {
    // Primero intentar desde variables de entorno
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    
    // Si no hay en env, buscar en base de datos
    if (!publicKey || !privateKey) {
        try {
            const dbPublicKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'VAPID_PUBLIC_KEY'").get();
            const dbPrivateKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'VAPID_PRIVATE_KEY'").get();
            
            if (dbPublicKey) publicKey = dbPublicKey.setting_value;
            if (dbPrivateKey) privateKey = dbPrivateKey.setting_value;
        } catch(e) {
            console.warn('[PUSH] Error leyendo VAPID de DB:', e.message);
        }
    }
    
    return { publicKey, privateKey };
}

// Inicializar web-push
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@check.com';

function initWebPush() {
    const { publicKey, privateKey } = getVapidKeys();
    
    // Verificar que las keys no sean valores placeholder vacíos o inválidos
    const isValidKey = (key) => key && key.length > 20 && !key.includes('tu_') && !key.includes('change');
    
    if (!isValidKey(publicKey) || !isValidKey(privateKey)) {
        console.warn('⚠️  VAPID keys no configuradas. Notificaciones push no funcionarán.');
        console.warn('   Configura en panel de administración o variables de entorno.');
        return false;
    }
    
    webpush.setVapidDetails(
        vapidSubject,
        publicKey,
        privateKey
    );
    console.log('✅ Web Push configurado con clave pública:', publicKey.substring(0, 20) + '...');
    return true;
}

// Inicializar al cargar
initWebPush();

/**
 * Obtener clave pública VAPID (pública)
 */
router.get('/vapid-public-key', (req, res) => {
    const { publicKey } = getVapidKeys();
    if (!publicKey) {
        return res.json({ publicKey: null, configured: false });
    }
    res.json({ publicKey, configured: true });
});

/**
 * Configurar VAPID keys (solo admin)
 */
router.post('/vapid-keys', authMiddleware(['ADMIN']), async (req, res) => {
    const { publicKey, privateKey } = req.body;
    
    if (!publicKey || !privateKey) {
        return res.status(400).json({ error: 'Ambas claves son requeridas' });
    }
    
    try {
        // Guardar o actualizar en settings
        const upsert = (key, value) => {
            const existing = db.prepare("SELECT setting_key FROM settings WHERE setting_key = ?").get(key);
            if (existing) {
                db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(value, key);
            } else {
                db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, value);
            }
        };
        
        upsert('VAPID_PUBLIC_KEY', publicKey);
        upsert('VAPID_PRIVATE_KEY', privateKey);
        
        // Reinicializar web-push
        initWebPush();
        
        res.json({ success: true, message: 'VAPID keys configuradas correctamente' });
    } catch(e) {
        res.status(500).json({ error: 'Error guardando keys: ' + e.message });
    }
});

/**
 * Obtener estado de configuración de VAPID (solo admin)
 */
router.get('/vapid-status', authMiddleware(['ADMIN']), async (req, res) => {
    const { publicKey, privateKey } = getVapidKeys();
    res.json({ 
        configured: !!(publicKey && privateKey),
        hasPublicKey: !!publicKey,
        hasPrivateKey: !!privateKey
    });
});

/**
 * Suscribirse a notificaciones push
 * Puede ser pública (sin auth) o con usuario autenticado
 */
router.post('/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        
        if (!subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
            return res.status(400).json({ error: 'Suscripción inválida' });
        }
        
        // Verificar si ya existe una suscripción con este endpoint
        const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint);
        
        let userId = null;
        if (req.userId) {
            userId = req.userId;
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        if (existing) {
            // Actualizar suscripción existente
            db.prepare(`
                UPDATE push_subscriptions 
                SET user_id = ?, p256dh = ?, auth = ?, created_at = ?
                WHERE endpoint = ?
            `).run(userId, subscription.keys.p256dh, subscription.keys.auth, now, subscription.endpoint);
            
            logAction(req, AUDIT_ACTIONS.PUSH_SUBSCRIBE, {
                subscriptionId: existing.id,
                action: 'updated'
            });
            
            console.log(`📱 Suscripción push actualizada para usuario: ${userId || 'anonymous'}`);
        } else {
            // Crear nueva suscripción
            db.prepare(`
                INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, now);
            
            logAction(req, AUDIT_ACTIONS.PUSH_SUBSCRIBE, {
                subscriptionId: id,
                action: 'created'
            });
            
            console.log(`📱 Nueva suscripción push creada para usuario: ${userId || 'anonymous'}`);
        }
        
        res.json({ success: true, id: existing ? existing.id : id });
    } catch (error) {
        console.error('Error al guardar suscripción push:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * Cancelar suscripción push
 */
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint requerido' });
        }
        
        const subscription = db.prepare('SELECT id, user_id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
        
        if (subscription) {
            db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
            
            logAction(req, AUDIT_ACTIONS.PUSH_UNSUBSCRIBE, {
                subscriptionId: subscription.id,
                userId: subscription.user_id
            });
            
            console.log(`📱 Suscripción push eliminada: ${endpoint.substring(0, 50)}...`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar suscripción push:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * Enviar notificación de prueba (solo admin)
 */
router.post('/send-test', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const { title = 'Test Push', body = 'Esta es una notificación de prueba de Check Pro' } = req.body;
        
        // Obtener todas las suscripciones (o solo las del usuario actual si no es admin)
        let subscriptions;
        if (req.userRole === 'ADMIN') {
            subscriptions = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all();
        } else {
            subscriptions = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(req.userId);
        }
        
        if (subscriptions.length === 0) {
            return res.json({ success: true, message: 'No hay suscripciones activas' });
        }
        
        const payload = JSON.stringify({
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: '/' },
            tag: 'test-notification'
        });
        
        // Enviar a todas las suscripciones
        const results = await Promise.allSettled(
            subscriptions.map(sub => {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };
                
                return webpush.sendNotification(subscription, payload)
                    .then(() => ({ success: true, endpoint: sub.endpoint }))
                    .catch(error => ({ success: false, endpoint: sub.endpoint, error: error.message }));
            })
        );
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;
        
        logAction(req, AUDIT_ACTIONS.PUSH_SEND_TEST, {
            total: subscriptions.length,
            successful,
            failed
        });
        
        console.log(`📤 Notificación de prueba enviada: ${successful} exitosas, ${failed} fallidas`);
        
        res.json({
            success: true,
            total: subscriptions.length,
            successful,
            failed,
            results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
        });
    } catch (error) {
        console.error('Error al enviar notificación de prueba:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * Enviar notificación push a un usuario específico
 * (Uso interno - integración con eventos)
 */
async function sendPushToUser(userId, notification) {
    try {
        const subscriptions = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId);
        
        if (subscriptions.length === 0) {
            return { success: false, error: 'No hay suscripciones para este usuario' };
        }
        
        const payload = JSON.stringify({
            title: notification.title || 'Check Pro',
            body: notification.body || '',
            icon: notification.icon || '/icon-192.png',
            badge: notification.badge || '/icon-192.png',
            vibrate: notification.vibrate || [200, 100, 200],
            data: notification.data || { url: '/' },
            tag: notification.tag || 'check-pro-notification',
            actions: notification.actions || []
        });
        
        const results = await Promise.allSettled(
            subscriptions.map(sub => {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };
                
                return webpush.sendNotification(subscription, payload)
                    .then(() => ({ success: true, endpoint: sub.endpoint }))
                    .catch(error => ({ success: false, endpoint: sub.endpoint, error: error.message }));
            })
        );
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        
        return {
            success: successful > 0,
            total: subscriptions.length,
            successful,
            failed: subscriptions.length - successful
        };
    } catch (error) {
        console.error('Error al enviar notificación push a usuario:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Enviar notificación push a todos los usuarios de un evento
 * (Uso interno - integración con eventos)
 */
async function sendPushToEventUsers(eventId, notification) {
    try {
        // Obtener usuarios asociados al evento (organizadores, productores, staff)
        const users = db.prepare(`
            SELECT DISTINCT u.id 
            FROM users u
            LEFT JOIN events e ON u.group_id = e.group_id
            WHERE e.id = ? AND u.status = 'ACTIVE'
        `).all(eventId);
        
        if (users.length === 0) {
            return { success: false, error: 'No hay usuarios asociados a este evento' };
        }
        
        const results = await Promise.allSettled(
            users.map(user => sendPushToUser(user.id, notification))
        );
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        
        return {
            success: successful > 0,
            total: users.length,
            successful,
            failed: users.length - successful
        };
    } catch (error) {
        console.error('Error al enviar notificación push a usuarios del evento:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    router,
    sendPushToUser,
    sendPushToEventUsers
};