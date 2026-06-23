const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

var checkoutSessionSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(200),
    email: z.string().email('Email inválido'),
    items: z.array(z.object({
        category_id: z.string().min(1),
        quantity: z.number().int().min(1).optional()
    })).min(1, 'Se requiere al menos un item'),
    coupon_code: z.string().max(50).optional(),
    success_url: z.string().url().optional().or(z.literal('')),
    cancel_url: z.string().url().optional().or(z.literal(''))
});

var checkoutSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(200),
    email: z.string().email('Email inválido'),
    category_id: z.string().min(1, 'Categoría requerida')
});
if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️ STRIPE_SECRET_KEY no configurada. Pagos con Stripe no disponibles.');
}
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

// ── Checkout Session (Stripe Checkout redirect) ──

router.post('/events/:eventId/checkout-session', (req, res) => {
    try {
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        if (!event.payment_required) return res.status(400).json({ error: 'Este evento no requiere pago' });

        var parsed = checkoutSessionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, email, items, coupon_code, success_url, cancel_url } = parsed.data;

        // Validate all items and build line_items for Stripe
        var lineItems = [];
        var totalAmount = 0;
        var categoriesUsed = [];
        var discountAmount = 0;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var cat = db.prepare("SELECT * FROM guest_categories WHERE id = ? AND event_id = ?").get(item.category_id, req.params.eventId);
            if (!cat) return res.status(400).json({ error: 'Categoría ' + item.category_id + ' no encontrada' });
            if (!cat.price || cat.price <= 0) return res.status(400).json({ error: cat.name + ' no tiene precio' });
            var qty = parseInt(item.quantity) || 1;
            lineItems.push({
                price_data: { currency: (event.currency || 'USD').toLowerCase(), product_data: { name: cat.name }, unit_amount: Math.round(cat.price * 100) },
                quantity: qty
            });
            totalAmount += cat.price * qty;
            for (var j = 0; j < qty; j++) categoriesUsed.push(cat.id);
        }

        // Apply coupon if provided
        var appliedCouponId = null;
        if (coupon_code) {
            var coupon = db.prepare("SELECT * FROM coupons WHERE event_id = ? AND code = UPPER(?) AND is_active = 1").get(req.params.eventId, coupon_code);
            if (!coupon) return res.status(400).json({ error: 'Cupón no válido' });
            if (coupon.max_uses > 0 && coupon.current_uses >= coupon.max_uses) return res.status(400).json({ error: 'Cupón agotado' });
            if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'Cupón expirado' });
            if (coupon.discount_type === 'percentage') discountAmount = totalAmount * (coupon.discount_value / 100);
            else discountAmount = Math.min(coupon.discount_value, totalAmount);
            appliedCouponId = coupon.id;
            // Increment usage
            db.prepare("UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?").run(coupon.id);
        }

        var finalAmount = Math.max(0, totalAmount - discountAmount);
        var transactionId = uuidv4();
        var currency = (event.currency || 'USD').toLowerCase();
        db.prepare("INSERT INTO transactions (id, event_id, amount, currency, provider, status, guest_name, guest_email, metadata_json, created_at) VALUES (?, ?, ?, ?, 'stripe', 'pending', ?, ?, ?, ?)").run(
            transactionId, req.params.eventId, finalAmount, event.currency || 'USD', name, email, JSON.stringify({ items: items, categories: categoriesUsed, coupon: coupon_code, discount: discountAmount }), new Date().toISOString()
        );

        var baseUrl = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.get('host');
        var sUrl = success_url || baseUrl + '/registro.html?event=' + req.params.eventId + '&txn=' + transactionId + '&success=1&cart=1';
        var cUrl = cancel_url || baseUrl + '/registro.html?event=' + req.params.eventId + '&cancel=1';

        stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: sUrl + '&session_id={CHECKOUT_SESSION_ID}',
            cancel_url: cUrl,
            metadata: { transaction_id: transactionId, event_id: req.params.eventId, guest_name: name, guest_email: email }
        }).then(function(session) {
            db.prepare("UPDATE transactions SET provider_txn_id = ? WHERE id = ?").run(session.id, transactionId);
            res.json({ success: true, provider: 'stripe', url: session.url, sessionId: session.id, transactionId: transactionId });
        }).catch(function(err) {
            db.prepare("UPDATE transactions SET status = 'failed', metadata_json = ? WHERE id = ?").run(JSON.stringify({ error: err.message }), transactionId);
            res.status(500).json({ error: 'Error al crear sesión: ' + err.message });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Checkout: crear intención de pago (legacy) ──

router.post('/events/:eventId/checkout', (req, res) => {
    try {
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        if (!event.payment_required) return res.status(400).json({ error: 'Este evento no requiere pago' });

        var parsed = checkoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, email, category_id } = parsed.data;

        var category = db.prepare("SELECT * FROM guest_categories WHERE id = ? AND event_id = ?").get(category_id, req.params.eventId);
        if (!category) return res.status(400).json({ error: 'Categoría no encontrada' });
        if (!category.price || category.price <= 0) return res.status(400).json({ error: 'Esta categoría no tiene precio configurado' });

        var transactionId = uuidv4();
        var amount = Math.round(category.price * 100); // cents
        var currency = (event.currency || 'USD').toLowerCase();

        db.prepare("INSERT INTO transactions (id, event_id, category_id, amount, currency, provider, status, guest_name, guest_email, created_at) VALUES (?, ?, ?, ?, ?, 'stripe', 'pending', ?, ?, ?)").run(
            transactionId, req.params.eventId, category_id, category.price, event.currency || 'USD', name, email, new Date().toISOString()
        );

        stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            metadata: { transaction_id: transactionId, event_id: req.params.eventId, category_id: category_id, guest_name: name, guest_email: email }
        }).then(function(paymentIntent) {
            db.prepare("UPDATE transactions SET provider_txn_id = ? WHERE id = ?").run(paymentIntent.id, transactionId);
            res.json({
                success: true,
                provider: 'stripe',
                clientSecret: paymentIntent.client_secret,
                transactionId: transactionId,
                amount: category.price,
                currency: event.currency || 'USD'
            });
        }).catch(function(err) {
            db.prepare("UPDATE transactions SET status = 'failed', metadata_json = ? WHERE id = ?").run(JSON.stringify({ error: err.message }), transactionId);
            res.status(500).json({ error: 'Error al crear el pago: ' + err.message });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Webhook Stripe ──

router.post('/webhooks/stripe', (req, res) => {
    var sig = req.headers['stripe-signature'];
    var endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) return res.status(500).json({ error: 'Stripe webhook secret no configurado' });

    try {
        var event2 = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('[PAYMENTS] Stripe webhook signature verification failed:', err.message);
        return res.status(400).send('Signature verification failed');
    }

    var eventData = event2.data.object;
    var meta = eventData.metadata || {};

    // Handle checkout.session.completed (Stripe Checkout)
    function createGuestFromTxn(txn, catId, now, eventDb) {
        var gId = uuidv4(); var qrT = uuidv4().replace(/-/g, '').slice(0, 12);
        eventDb.prepare("INSERT INTO guests (id, event_id, name, email, category_id, qr_token, is_new_registration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'confirmed', ?)").run(gId, txn.event_id, txn.guest_name, txn.guest_email, catId || txn.category_id, qrT, now);
        return gId;
    }

    if (event2.type === 'checkout.session.completed') {
        var txnId = meta.transaction_id;
        if (txnId) {
            var txn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(txnId);
            if (txn && txn.status === 'pending') {
                var now = new Date().toISOString();
                db.prepare("UPDATE transactions SET status = 'completed', completed_at = ?, metadata_json = ? WHERE id = ?").run(now, JSON.stringify(event2), txnId);
                var eventDb = getEventDb(txn.event_id);
                var firstGuestId = null;

                // Check if cart (multiple items) or single item
                var meta2 = {};
                try { meta2 = JSON.parse(txn.metadata_json || '{}'); if (typeof meta2 === 'string') meta2 = JSON.parse(meta2); } catch(e) { meta2 = {}; }
                var cartItems = (meta2 && meta2.categories) || (meta2.data && meta2.data.object && meta2.data.object.metadata);

                if (txn.metadata_json) {
                    try {
                        var parsed = JSON.parse(txn.metadata_json);
                        var cats = parsed.categories || [];
                        cats.forEach(function(catId) {
                            var gId = createGuestFromTxn(txn, catId, now, eventDb);
                            if (!firstGuestId) firstGuestId = gId;
                        });
                    } catch(e) { console.error('[PAYMENTS] Error procesando categorías:', e.message); }
                }

                if (!firstGuestId) {
                    firstGuestId = createGuestFromTxn(txn, txn.category_id, now, eventDb);
                }

                db.prepare("UPDATE transactions SET guest_id = ? WHERE id = ?").run(firstGuestId, txnId);
                try { triggerWebhooks(txn.event_id, 'PAYMENT_COMPLETED', { transactionId: txnId, guestId: firstGuestId, amount: txn.amount, currency: txn.currency, name: txn.guest_name, email: txn.guest_email }); } catch(e) { console.error('[PAYMENTS] Error trigger webhook:', e.message); }
                try { logAction(req, 'PAYMENT_COMPLETED', { eventId: txn.event_id, transactionId: txnId, guestId: firstGuestId, amount: txn.amount }); } catch(e) { console.error('[PAYMENTS] Error log action:', e.message); }
                console.log('[PAYMENTS] Checkout completado:', txnId);
            }
        }
    }

    if (event2.type === 'payment_intent.succeeded') {
        var txnId = meta.transaction_id;

        if (txnId) {
            var txn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(txnId);
            if (txn && txn.status === 'pending') {
                var now = new Date().toISOString();
                db.prepare("UPDATE transactions SET status = 'completed', completed_at = ?, metadata_json = ? WHERE id = ?").run(now, JSON.stringify(event2), txnId);

                // Crear guest
                var guestId = uuidv4();
                var qrToken = uuidv4().replace(/-/g, '').slice(0, 12);
                var eventDb = getEventDb(txn.event_id);
                eventDb.prepare("INSERT INTO guests (id, event_id, name, email, category_id, qr_token, is_new_registration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'confirmed', ?)").run(
                    guestId, txn.event_id, txn.guest_name, txn.guest_email, txn.category_id, qrToken, now
                );
                db.prepare("UPDATE transactions SET guest_id = ? WHERE id = ?").run(guestId, txnId);

                try { triggerWebhooks(txn.event_id, 'PAYMENT_COMPLETED', { transactionId: txnId, guestId: guestId, amount: txn.amount, currency: txn.currency, name: txn.guest_name, email: txn.guest_email }); } catch(e) {}
                try { logAction(req, 'PAYMENT_COMPLETED', { eventId: txn.event_id, transactionId: txnId, guestId: guestId, amount: txn.amount }); } catch(e) {}

                console.log('[PAYMENTS] Pago completado:', txnId, '- Guest creado:', guestId);
            }
        }
    }

    res.json({ received: true });
});

// ── Listar transacciones ──

router.get('/events/:eventId/transactions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var txs = db.prepare("SELECT * FROM transactions WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(txs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var txn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
        if (!txn) return res.status(404).json({ error: 'Transacción no encontrada' });
        res.json(txn);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Receipt PDF (C4-07) ───

router.get('/transactions/:id/receipt', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        var txn = db.prepare("SELECT t.*, e.name as event_name, e.date as event_date, e.location as event_location FROM transactions t JOIN events e ON t.event_id = e.id WHERE t.id = ?").get(req.params.id);
        if (!txn) return res.status(404).json({ error: 'Transacción no encontrada' });

        var { jsPDF } = require('jspdf');
        var autoTable = require('jspdf-autotable').default;
        var doc = new jsPDF();

        // Colors
        var primary = [124, 58, 237];
        doc.setFillColor(primary[0], primary[1], primary[2]);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('RECIBO DE PAGO', 15, 20);
        doc.setFontSize(10);
        doc.text('Check Pro - Smart Eventos', 15, 30);

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(16);
        doc.text('Comprobante de pago', 15, 50);

        doc.setFontSize(10);
        doc.text('Folio: ' + txn.id, 15, 62);
        doc.text('Fecha: ' + new Date(txn.created_at).toLocaleString('es-MX'), 15, 70);
        doc.text('Estado: ' + (txn.status === 'completed' ? '✅ Pagado' : txn.status), 15, 78);

        // Event info
        doc.setFontSize(12);
        doc.text('Evento: ' + (txn.event_name || ''), 15, 92);
        doc.setFontSize(10);
        doc.text('Fecha evento: ' + (txn.event_date ? new Date(txn.event_date).toLocaleDateString() : '-'), 15, 100);
        doc.text('Ubicación: ' + (txn.event_location || '-'), 15, 108);

        // Guest info
        doc.setFontSize(12);
        doc.text('Cliente:', 15, 124);
        doc.setFontSize(10);
        doc.text('Nombre: ' + (txn.guest_name || '-'), 15, 132);
        doc.text('Email: ' + (txn.guest_email || '-'), 15, 140);

        // Amount
        doc.setFontSize(16);
        doc.setTextColor(primary[0], primary[1], primary[2]);
        doc.text('Total pagado: $' + parseFloat(txn.amount || 0).toFixed(2) + ' ' + (txn.currency || 'USD'), 15, 160);

        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.text('Este comprobante fue generado electrónicamente por Check Pro.', 15, 280);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=recibo_' + txn.id.slice(0, 8) + '.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch(err) { console.error('[RECEIPT] Error:', err.message); res.status(500).json({ error: err.message }); }
});

// ─── Coupons (C4-06) ───

router.get('/events/:eventId/coupons', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try { res.json(db.prepare("SELECT * FROM coupons WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId)); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/coupons', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { code, discount_type, discount_value, max_uses, expires_at } = req.body;
        if (!code || !discount_value) return res.status(400).json({ error: 'Código y valor requeridos' });
        var id = require('uuid').v4();
        db.prepare("INSERT INTO coupons (id, event_id, code, discount_type, discount_value, max_uses, expires_at) VALUES (?, ?, UPPER(?), ?, ?, ?, ?)").run(id, req.params.eventId, code, discount_type || 'percentage', parseFloat(discount_value) || 0, parseInt(max_uses) || 0, expires_at || null);
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/events/:eventId/coupons/:couponId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var d = req.body;
        db.prepare("UPDATE coupons SET code = COALESCE(UPPER(?), code), discount_type = COALESCE(?, discount_type), discount_value = COALESCE(?, discount_value), max_uses = COALESCE(?, max_uses), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) WHERE id = ? AND event_id = ?").run(
            d.code || null, d.discount_type || null, d.discount_value != null ? parseFloat(d.discount_value) : null, d.max_uses != null ? parseInt(d.max_uses) : null, d.expires_at || null, d.is_active !== undefined ? (d.is_active ? 1 : 0) : null, req.params.couponId, req.params.eventId
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:eventId/coupons/:couponId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try { db.prepare("DELETE FROM coupons WHERE id = ? AND event_id = ?").run(req.params.couponId, req.params.eventId); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// Validate and apply coupon (public)
router.post('/events/:eventId/coupons/validate', (req, res) => {
    try {
        var { code, items } = req.body;
        if (!code) return res.json({ valid: false, error: 'Código requerido' });
        var coupon = db.prepare("SELECT * FROM coupons WHERE event_id = ? AND code = UPPER(?) AND is_active = 1").get(req.params.eventId, code);
        if (!coupon) return res.json({ valid: false, error: 'Cupón no válido' });
        if (coupon.max_uses > 0 && coupon.current_uses >= coupon.max_uses) return res.json({ valid: false, error: 'Cupón agotado' });
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.json({ valid: false, error: 'Cupón expirado' });

        var total = 0;
        if (items && Array.isArray(items)) {
            items.forEach(function(item) {
                var cat = db.prepare("SELECT price FROM guest_categories WHERE id = ? AND event_id = ?").get(item.category_id, req.params.eventId);
                if (cat) total += (cat.price || 0) * (parseInt(item.quantity) || 1);
            });
        }

        var discount = 0;
        if (coupon.discount_type === 'percentage') discount = total * (coupon.discount_value / 100);
        else discount = Math.min(coupon.discount_value, total);

        res.json({ valid: true, coupon: { id: coupon.id, code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value }, total: total, discount: discount, finalTotal: Math.max(0, total - discount) });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, getEventDb };
