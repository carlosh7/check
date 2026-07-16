const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { validatePrompt, maskSensitiveData } = require('../middleware/ai-validation');
const { AUDIT_ACTIONS, logAction } = require('../security/audit');
const https = require('https');

const logger = require("../utils/logger");
const router = express.Router();

// GET /api/security/ai/inventory — Listar sistemas de IA detectados
router.get('/ai/inventory', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const items = db.prepare("SELECT * FROM ai_inventory ORDER BY detected_at DESC").all();
        items.forEach(function(item) {
            try { item.data_processed = JSON.parse(item.data_processed); } catch(e) { item.data_processed = []; }
        });
        res.json(items);
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

// POST /api/security/ai/inventory — Agregar sistema de IA al inventario
router.post('/ai/inventory', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, type, provider, description, data_processed, risk_level } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO ai_inventory (id, name, type, provider, description, data_processed, risk_level, status, detected_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'detected', ?, ?)").run(
            id, name.trim(), type || 'llm', provider || '', description || '', JSON.stringify(data_processed || []), risk_level || 'medium', now, now
        );
        res.json({ success: true, id });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al agregar sistema' });
    }
});

// DELETE /api/security/ai/inventory/:id — Eliminar sistema del inventario
router.delete('/ai/inventory/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM ai_inventory WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// PUT /api/security/ai/inventory/:id — Actualizar estado/riesgo
router.put('/ai/inventory/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { status, risk_level, last_seen_at } = req.body;
        db.prepare("UPDATE ai_inventory SET status = COALESCE(?, status), risk_level = COALESCE(?, risk_level), last_seen_at = COALESCE(?, last_seen_at) WHERE id = ?").run(
            status || null, risk_level || null, last_seen_at || null, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// GET /api/security/ai/policies — Listar politicas de IA
router.get('/ai/policies', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const policies = db.prepare("SELECT * FROM ai_policies ORDER BY created_at DESC").all();
        res.json(policies);
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener politicas' });
    }
});

// POST /api/security/ai/policies — Crear/actualizar politica
router.post('/ai/policies', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, description, content, is_active } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO ai_policies (id, name, description, content, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, name.trim(), description || '', content || '', is_active !== false ? 1 : 0, now);
        res.json({ success: true, id });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al crear politica' });
    }
});

// PUT /api/security/ai/policies/:id — Editar politica
router.put('/ai/policies/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, description, content, is_active } = req.body;
        const now = new Date().toISOString();
        db.prepare("UPDATE ai_policies SET name = COALESCE(?, name), description = COALESCE(?, description), content = COALESCE(?, content), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?").run(
            name || null, description || null, content || null, is_active != null ? (is_active ? 1 : 0) : null, now, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar politica' });
    }
});

// DELETE /api/security/ai/policies/:id — Eliminar politica
router.delete('/ai/policies/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM ai_policies WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar politica' });
    }
});

// ── FS-03: AI Detection & Response (AIDR) ──

// POST /api/ai/chat — Enviar consulta a IA con deteccion de inyeccion y logging
router.post('/ai/chat', authMiddleware(['ADMIN', 'PRODUCTOR', 'STAFF', 'ORGANIZER']), async (req, res) => {
    try {
        let startTime = Date.now();
        let prompt = (req.body.prompt || '').trim();
        if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

        let aiEnabled = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_enabled'").pluck();
        let enabled = aiEnabled.get();
        if (enabled !== '1') return res.status(503).json({ error: 'IA deshabilitada' });

        let aiKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_openrouter_key'").pluck();
        let apiKey = aiKey.get() || '';
        if (!apiKey) return res.status(503).json({ error: 'API key de IA no configurada' });

        let aiModel = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_model'").pluck();
        let model = aiModel.get() || 'google/gemini-2.0-flash-lite-preview-02-05:free';

        let aiSysPrompt = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_system_prompt'").pluck();
        let systemPrompt = aiSysPrompt.get() || '';

        // Validacion de inyeccion
        let validation = validatePrompt(prompt);
        let dlpResult = maskSensitiveData(prompt);
        let maskedPrompt = dlpResult.masked;

        let logId = uuidv4();
        let userId = req.userId || 'unknown';
        let userName = req.user?.name || req.user?.username || 'unknown';

        // Crear alerta si se detecta inyeccion
        if (validation.injectionDetected) {
            let alertId = uuidv4();
            let patterns = validation.matchedPatterns.map(function(p) { return p.pattern; }).join(', ');
            db.prepare("INSERT INTO ai_alerts (id, type, severity, title, description, source, user_id, user_name, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
                alertId, 'injection_detected', validation.riskScore >= 0.9 ? 'critical' : 'high',
                'Inyeccion de prompt detectada',
                'Patrones: ' + patterns + ' | Risk: ' + validation.riskScore,
                'ai_chat', userId, userName,
                JSON.stringify({ prompt: maskedPrompt, riskScore: validation.riskScore, patterns: validation.matchedPatterns })
            );
            try { logAction(req, AUDIT_ACTIONS.AI_INJECTION_DETECTED, { logId: logId, riskScore: validation.riskScore, patterns: validation.matchedPatterns }); } catch(e) {}
        }

        // Enviar a OpenRouter
        let responseText = '';
        try {
            responseText = await new Promise(function(resolve, reject) {
                let postData = JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: maskedPrompt }
                    ],
                    max_tokens: 2000
                });

                let options = {
                    hostname: 'openrouter.ai',
                    path: '/api/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey,
                        'HTTP-Referer': req.headers['origin'] || 'https://check.app',
                        'X-Title': 'Check Pro'
                    }
                };

                let apiReq = https.request(options, function(apiRes) {
                    let data = '';
                    apiRes.on('data', function(chunk) { data += chunk; });
                    apiRes.on('end', function() {
                        try {
                            let parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices.length > 0) {
                                resolve(parsed.choices[0].message.content || '');
                            } else {
                                resolve(parsed.error?.message || 'Error en respuesta de IA');
                            }
                        } catch(e) { reject(new Error('Error parseando respuesta')); }
                    });
                });
                apiReq.on('error', function(e) { reject(e); });
                apiReq.write(postData);
                apiReq.end();
            });
        } catch (apiError) {
            responseText = 'Error al contactar el servicio de IA: ' + apiError.message;
        }

        let duration = Date.now() - startTime;

        // Enmascarar PII en respuesta
        let maskedResponse = maskSensitiveData(responseText).masked;

        // Guardar log
        db.prepare("INSERT INTO ai_prompt_logs (id, user_id, user_name, prompt, response, model, risk_score, injection_detected, injection_pattern, masked_prompt, masked_response, tokens_used, duration_ms, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            logId, userId, userName, prompt, responseText, model, validation.riskScore,
            validation.injectionDetected ? 1 : 0,
            validation.injectionDetected ? JSON.stringify(validation.matchedPatterns.map(function(p) { return p.pattern; })) : null,
            maskedPrompt, maskedResponse, 0, duration, req.ip || ''
        );

        try { logAction(req, AUDIT_ACTIONS.AI_PROMPT_SENT, { logId: logId, riskScore: validation.riskScore, injectionDetected: validation.injectionDetected }); } catch(e) {}

        res.json({
            success: true,
            response: maskedResponse,
            logId: logId,
            riskScore: validation.riskScore,
            injectionDetected: validation.injectionDetected,
            durationMs: duration
        });
    } catch (err) {
        logger.error('[AI_CHAT] Error:', err.message);
        res.status(500).json({ error: 'Error al procesar consulta IA' });
    }
});

// GET /api/security/ai/logs — Logs de consultas IA
router.get('/ai/logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = Math.min(parseInt(req.query.limit) || 30, 100);
        let offset = (page - 1) * limit;
        let userId = req.query.user_id || '';
        let riskMin = parseFloat(req.query.risk_min) || 0;
        let injectionOnly = req.query.injection_only === '1';

        let where = [];
        let params = [];
        if (userId) { where.push("user_id = ?"); params.push(userId); }
        if (riskMin > 0) { where.push("risk_score >= ?"); params.push(riskMin); }
        if (injectionOnly) { where.push("injection_detected = 1"); }

        let whereClause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';
        let total = db.prepare("SELECT COUNT(*) as cnt FROM ai_prompt_logs" + whereClause).get(...params).cnt;
        let logs = db.prepare("SELECT id, user_id, user_name, model, risk_score, injection_detected, injection_pattern, masked_prompt, masked_response, tokens_used, duration_ms, created_at FROM ai_prompt_logs" + whereClause + " ORDER BY created_at DESC LIMIT ? OFFSET ?").all(...params, limit, offset);

        res.json({ data: logs, pagination: { page: page, limit: limit, total: total } });
    } catch (err) {
        logger.error('[AI_LOGS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

// GET /api/security/ai/logs/:id — Detalle de un log
router.get('/ai/logs/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let log = db.prepare("SELECT * FROM ai_prompt_logs WHERE id = ?").get(req.params.id);
        if (!log) return res.status(404).json({ error: 'Log no encontrado' });
        res.json(log);
    } catch (err) {
        logger.error('[AI_LOGS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener log' });
    }
});

// GET /api/security/ai/alerts — Listar alertas
router.get('/ai/alerts', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = Math.min(parseInt(req.query.limit) || 30, 100);
        let offset = (page - 1) * limit;
        let severity = req.query.severity || '';
        let acknowledged = req.query.acknowledged;

        let where = [];
        let params = [];
        if (severity) { where.push("severity = ?"); params.push(severity); }
        if (acknowledged === '0') { where.push("acknowledged_at IS NULL"); }
        if (acknowledged === '1') { where.push("acknowledged_at IS NOT NULL"); }

        let whereClause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';
        let total = db.prepare("SELECT COUNT(*) as cnt FROM ai_alerts" + whereClause).get(...params).cnt;
        let alerts = db.prepare("SELECT * FROM ai_alerts" + whereClause + " ORDER BY created_at DESC LIMIT ? OFFSET ?").all(...params, limit, offset);

        res.json({ data: alerts, pagination: { page: page, limit: limit, total: total } });
    } catch (err) {
        logger.error('[AI_ALERTS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
});

// POST /api/security/ai/alerts/:id/acknowledge — Marcar alerta como atendida
router.post('/ai/alerts/:id/acknowledge', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let alert = db.prepare("SELECT * FROM ai_alerts WHERE id = ?").get(req.params.id);
        if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });
        db.prepare("UPDATE ai_alerts SET acknowledged_by = ?, acknowledged_at = ? WHERE id = ?").run(req.userId || 'unknown', new Date().toISOString(), req.params.id);
        try { logAction(req, AUDIT_ACTIONS.AI_ALERT_ACKNOWLEDGED, { alertId: req.params.id, type: alert.type, severity: alert.severity }); } catch(e) {}
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_ALERTS] Error:', err.message);
        res.status(500).json({ error: 'Error al acusar alerta' });
    }
});

// GET /api/security/ai/stats — Estadisticas de uso IA
router.get('/ai/stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let totalQueries = db.prepare("SELECT COUNT(*) as cnt FROM ai_prompt_logs").get().cnt;
        let totalInjections = db.prepare("SELECT COUNT(*) as cnt FROM ai_prompt_logs WHERE injection_detected = 1").get().cnt;
        let totalAlerts = db.prepare("SELECT COUNT(*) as cnt FROM ai_alerts").get().cnt;
        let pendingAlerts = db.prepare("SELECT COUNT(*) as cnt FROM ai_alerts WHERE acknowledged_at IS NULL").get().cnt;
        let avgRisk = db.prepare("SELECT COALESCE(AVG(risk_score), 0) as avg FROM ai_prompt_logs").get().avg;
        let avgDuration = db.prepare("SELECT COALESCE(AVG(duration_ms), 0) as avg FROM ai_prompt_logs WHERE duration_ms > 0").get().avg;

        let byUser = db.prepare("SELECT user_id, user_name, COUNT(*) as cnt FROM ai_prompt_logs GROUP BY user_id ORDER BY cnt DESC LIMIT 10").all();
        let dailyTrend = db.prepare("SELECT DATE(created_at) as date, COUNT(*) as cnt FROM ai_prompt_logs WHERE created_at >= DATE('now', '-30 days') GROUP BY DATE(created_at) ORDER BY date ASC").all();

        res.json({
            totalQueries: totalQueries,
            totalInjections: totalInjections,
            totalAlerts: totalAlerts,
            pendingAlerts: pendingAlerts,
            avgRiskScore: Math.round(avgRisk * 100) / 100,
            avgDurationMs: Math.round(avgDuration),
            byUser: byUser,
            dailyTrend: dailyTrend
        });
    } catch (err) {
        logger.error('[AI_STATS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener estadisticas' });
    }
});

// GET /api/security/ai/settings — Obtener configuracion IA
router.get('/ai/settings', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        let settings = {};
        let keys = ['ai_enabled', 'ai_openrouter_key', 'ai_model', 'ai_system_prompt'];
        keys.forEach(function(k) {
            let val = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").pluck().get(k);
            settings[k] = val || '';
        });
        res.json(settings);
    } catch (err) {
        logger.error('[AI_SETTINGS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener configuracion' });
    }
});

// PUT /api/security/ai/settings — Actualizar configuracion IA
router.put('/ai/settings', authMiddleware(['ADMIN']), (req, res) => {
    try {
        let allowed = ['ai_enabled', 'ai_openrouter_key', 'ai_model', 'ai_system_prompt'];
        Object.keys(req.body).forEach(function(k) {
            if (allowed.includes(k)) {
                db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(String(req.body[k]), k);
            }
        });
        res.json({ success: true });
    } catch (err) {
        logger.error('[AI_SETTINGS] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar configuracion' });
    }
});

module.exports = router;
