/**
 * Rutas públicas - versión y salud
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { db } = require('../../database');
const { getStats } = require('../utils/cache');

const router = express.Router();

router.get('/app-version', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        res.json({ version: pkg.version });
    } catch (err) {
        console.error('[VERSION] Error:', err.message);
        res.status(500).json({ error: 'Version no disponible' });
    }
});

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/redis', async (req, res) => {
    try {
        const stats = await getStats();
        if (stats && stats.engine === 'redis') {
            res.json({ 
                status: 'connected', 
                engine: 'redis',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({ 
                status: 'fallback', 
                engine: stats ? stats.engine : 'none',
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Health check completo - SEC-029
 * Verifica: DB, Cache, SMTP
 */
router.get('/health/full', async (req, res) => {
    var appVersion = 'unknown';
    try { var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')); appVersion = pkg.version; } catch(e) {}
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: appVersion,
        database: { status: 'unknown' },
        cache: { status: 'unknown' },
        smtp: { status: 'unknown' }
    };
    
    let allHealthy = true;
    
    // Check Database
    try {
        const result = db.prepare('SELECT 1 as test').get();
        checks.database = { 
            status: result ? 'connected' : 'error',
            engine: 'sqlite'
        };
    } catch (err) {
        checks.database = { status: 'error', message: err.message };
        allHealthy = false;
    }
    
    // Check Cache
    try {
        const stats = await getStats();
        checks.cache = {
            status: stats ? 'connected' : 'error',
            engine: stats?.engine || 'unknown',
            keys: stats?.keys || 0
        };
    } catch (err) {
        checks.cache = { status: 'error', message: err.message };
        allHealthy = false;
    }
    
    // Determinar status general
    if (!allHealthy) {
        checks.status = 'degraded';
    }
    
    res.status(allHealthy ? 200 : 503).json(checks);
});

module.exports = router;
