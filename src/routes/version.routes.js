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
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    res.json({ version: pkg.version });
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
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')).version,
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
    
    // Check SMTP (sin enviar email)
    try {
        const smtp = db.prepare('SELECT smtp_host FROM smtp_config WHERE id = 1').get();
        checks.smtp = {
            status: smtp && smtp.smtp_host ? 'configured' : 'not_configured',
            host: smtp?.smtp_host || null
        };
    } catch (err) {
        checks.smtp = { status: 'error', message: err.message };
    }
    
    // Determinar status general
    if (!allHealthy) {
        checks.status = 'degraded';
    }
    
    res.status(allHealthy ? 200 : 503).json(checks);
});

module.exports = router;
