const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');

const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// ── Checkout Session (Stripe Checkout redirect) ──

router.post('/events/:eventId/checkout-session', (req, res) => {
    try {
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        if (!event.payment_required) return res.status(400).json({ error: 'Este evento no requiere pago' });

        var { name, email, items, success_url, cancel_url } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Nombre y email requeridos' });
        if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Se requiere al menos un item en el carrito' });

        // Validate all items and build line_items for Stripe
        var lineItems = [];
        var totalAmount = 0;
        var categoriesUsed = [];

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

        var transactionId = uuidv4();
        var currency = (event.currency || 'USD').toLowerCase();
        db.prepare("INSERT INTO transactions (id, event_id, amount, currency, provider, status, guest_name, guest_email, metadata_json, created_at) VALUES (?, ?, ?, ?, 'stripe', 'pending', ?, ?, ?, ?)").run(
            transactionId, req.params.eventId, totalAmount, event.currency || 'USD', name, email, JSON.stringify({ items: items, categories: categoriesUsed }), new Date().toISOString()
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

        var { name, email, category_id } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Nombre y email requeridos' });

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
    var endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

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
        eventDb.prepare("INSERT INTO guests (id, event_id, name, email, category_id, qr_token, is_new_registration, status, registered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'confirmed', ?, ?)").run(gId, txn.event_id, txn.guest_name, txn.guest_email, catId || txn.category_id, qrT, now, now);
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
                    } catch(e) {}
                }

                if (!firstGuestId) {
                    firstGuestId = createGuestFromTxn(txn, txn.category_id, now, eventDb);
                }

                db.prepare("UPDATE transactions SET guest_id = ? WHERE id = ?").run(firstGuestId, txnId);
                try { triggerWebhooks(txn.event_id, 'PAYMENT_COMPLETED', { transactionId: txnId, guestId: firstGuestId, amount: txn.amount, currency: txn.currency, name: txn.guest_name, email: txn.guest_email }); } catch(e) {}
                try { logAction(req, 'PAYMENT_COMPLETED', { eventId: txn.event_id, transactionId: txnId, guestId: firstGuestId, amount: txn.amount }); } catch(e) {}
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
                eventDb.prepare("INSERT INTO guests (id, event_id, name, email, category_id, qr_token, is_new_registration, status, registered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'confirmed', ?, ?)").run(
                    guestId, txn.event_id, txn.guest_name, txn.guest_email, txn.category_id, qrToken, now, now
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

function getEventDb(eventId) {
    var ev = db.prepare("SELECT has_own_db FROM events WHERE id = ?").get(eventId);
    if (ev && ev.has_own_db === 1 && eventDatabaseExists(eventId)) {
        var conn = getEventConnection(eventId);
        if (conn) return conn;
    }
    return db;
}

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

module.exports = { router, getEventDb };
