const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const https = require('https');

const router = express.Router();

// ─── ECOMMERCE CONNECTIONS CRUD (Shopify/WooCommerce) ───
router.get('/connections', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const list = db.prepare("SELECT id, platform, name, store_url, api_key, is_active, last_sync_at, created_at FROM ecommerce_connections ORDER BY created_at DESC").all();
        res.json(list);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/connections', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { platform, name, store_url, api_key, api_secret, webhook_secret } = req.body;
        if (!platform || !name || !store_url || !api_key) return res.status(400).json({ error: 'platform, name, store_url y api_key son requeridos' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO ecommerce_connections (id, platform, name, store_url, api_key, api_secret, webhook_secret, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, platform, name, store_url, api_key, api_secret || null, webhook_secret || null, now);
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/connections/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, store_url, api_key, api_secret, webhook_secret, is_active } = req.body;
        db.prepare("UPDATE ecommerce_connections SET name=COALESCE(?,name), store_url=COALESCE(?,store_url), api_key=COALESCE(?,api_key), api_secret=COALESCE(?,api_secret), webhook_secret=COALESCE(?,webhook_secret), is_active=COALESCE(?,is_active) WHERE id=?")
            .run(name, store_url, api_key, api_secret, webhook_secret, is_active != null ? (is_active ? 1 : 0) : null, req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/connections/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM ecommerce_connections WHERE id=?").run(req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── PRODUCT SYNC ───
router.post('/connections/:id/sync-products', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const conn = db.prepare("SELECT * FROM ecommerce_connections WHERE id=?").get(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });
        
        let products = [];
        if (conn.platform === 'shopify') {
            products = await fetchShopifyProducts(conn);
        } else if (conn.platform === 'woocommerce') {
            products = await fetchWooCommerceProducts(conn);
        }
        
        const now = new Date().toISOString();
        let synced = 0;
        for (const p of products) {
            const existing = db.prepare("SELECT id FROM ecommerce_products WHERE external_id = ? AND connection_id = ?").get(String(p.id), conn.id);
            if (existing) {
                db.prepare("UPDATE ecommerce_products SET title=?, price=?, currency=?, updated_at=? WHERE id=?").run(p.title, p.price, p.currency, now, existing.id);
            } else {
                db.prepare("INSERT INTO ecommerce_products (id, connection_id, external_id, title, price, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
                    .run(uuidv4(), conn.id, String(p.id), p.title, p.price, p.currency, now, now);
            }
            synced++;
        }
        
        db.prepare("UPDATE ecommerce_connections SET last_sync_at = ? WHERE id = ?").run(now, conn.id);
        res.json({ success: true, synced, total: products.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── WEBHOOK HANDLER ───
router.post('/webhook/:connectionId', (req, res) => {
    try {
        const conn = db.prepare("SELECT * FROM ecommerce_connections WHERE id=?").get(req.params.connectionId);
        if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });
        
        const event = req.headers['x-shopify-topic'] || req.headers['x-wc-webhook-event'] || 'unknown';
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        if (event.includes('order') && body.email) {
            const existingGuest = db.prepare("SELECT id FROM guests WHERE email = ? AND event_id IS NULL LIMIT 1").get(body.email);
            if (!existingGuest) {
                db.prepare("INSERT INTO guests (id, name, email, organization, status, checked_in, is_new_registration, created_at) VALUES (?, ?, ?, ?, 'lead', 0, 1, ?)")
                    .run(uuidv4(), body.name || body.billing?.name || body.email, body.email, 'Importado de ' + conn.platform, new Date().toISOString());
            }
        }
        
        db.prepare("INSERT INTO ecommerce_sync_logs (id, connection_id, event, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(uuidv4(), conn.id, event, 'received', JSON.stringify(body).substring(0, 1000), new Date().toISOString());
        
        res.json({ received: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── HELPERS ───
function fetchShopifyProducts(conn) {
    return new Promise((resolve, reject) => {
        const store = conn.store_url.replace(/\/+$/, '').replace(/^https?:\/\//, '');
        const options = {
            hostname: store, path: '/admin/api/2024-01/products.json?limit=50&status=active',
            method: 'GET', headers: { 'X-Shopify-Access-Token': conn.api_key, 'Content-Type': 'application/json' }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const products = (parsed.products || []).map(p => ({
                        id: p.id, title: p.title, price: p.variants?.[0]?.price || '0',
                        currency: p.variants?.[0]?.currency || 'USD'
                    }));
                    resolve(products);
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function fetchWooCommerceProducts(conn) {
    return new Promise((resolve, reject) => {
        const base = conn.store_url.replace(/\/+$/, '');
        const auth = Buffer.from(conn.api_key + ':' + (conn.api_secret || '')).toString('base64');
        const options = {
            hostname: new URL(base).hostname, path: '/wp-json/wc/v3/products?per_page=50',
            method: 'GET', headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const products = (JSON.parse(data) || []).map(p => ({
                        id: p.id, title: p.name, price: p.price || '0', currency: 'USD'
                    }));
                    resolve(products);
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

module.exports = router;
