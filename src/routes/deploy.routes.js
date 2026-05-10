const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../../database');
const { v4: uuidv4 } = require('uuid');
const { getStatus, migrateExistingPasswords } = require('../security/encryption');

function verifyGitHubSignature(payload, signature) {
    const secret = process.env.DEPLOY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const computed = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch {
        return false;
    }
}

router.post('/deploy/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (!verifyGitHubSignature(req.body, signature)) {
        console.warn(`[DEPLOY] Invalid signature from ${req.ip}`);
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const ref = payload.ref || '';
    const repository = payload.repository ? payload.repository.full_name : 'unknown';
    const commitSha = payload.head_commit ? payload.head_commit.id : null;
    const committer = payload.head_commit ? payload.head_commit.committer.name : null;
    const isMainBranch = ref === 'refs/heads/main' || ref === 'refs/heads/master';

    const logId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO deploy_logs (id, event_type, repository, ref, commit_sha, committer, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'received', ?)`).run(logId, event || 'push', repository, ref, commitSha, committer, now);

    if (!isMainBranch) {
        db.prepare(`UPDATE deploy_logs SET status = 'skipped', error = 'Not a main/master branch push' WHERE id = ?`).run(logId);
        return res.json({ ok: true, status: 'skipped', reason: 'Not main/master branch' });
    }

    const portainerUrl = process.env.PORTAINER_WEBHOOK_URL;
    if (portainerUrl) {
        try {
            const response = await fetch(portainerUrl, { method: 'POST', signal: AbortSignal.timeout(30000) });
            const portainerStatus = response.ok ? 'triggered' : `error: HTTP ${response.status}`;
            db.prepare(`UPDATE deploy_logs SET status = 'deploying', portainer_status = ? WHERE id = ?`).run(portainerStatus, logId);
            console.log(`[DEPLOY] Redeploy triggered via Portainer (${response.status})`);
        } catch (err) {
            db.prepare(`UPDATE deploy_logs SET status = 'error', error = ? WHERE id = ?`).run(err.message, logId);
            console.error(`[DEPLOY] Portainer webhook failed:`, err.message);
        }
    } else {
        db.prepare(`UPDATE deploy_logs SET status = 'received', error = 'PORTAINER_WEBHOOK_URL not configured' WHERE id = ?`).run(logId);
    }

    res.json({ ok: true, status: 'received' });
});

router.get('/deploy/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs = db.prepare(`SELECT * FROM deploy_logs ORDER BY created_at DESC LIMIT ?`).all(limit);
    res.json(logs);
});

router.get('/deploy/encryption-status', (req, res) => {
    res.json(getStatus());
});

router.post('/deploy/migrate-encryption', (req, res) => {
    try {
        const result = migrateExistingPasswords();
        res.json({ ok: true, migrated: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/deploy/rate-limit-status', (req, res) => {
    try {
        const { getRateLimitStatus } = require('../middleware/rate-limiter');
        res.json(getRateLimitStatus());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
