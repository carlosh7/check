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
    var startTime = Date.now();
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: appVersion,
        responseTimeMs: 0,
        database: { status: 'unknown' },
        cache: { status: 'unknown' },
        disk: { status: 'unknown' },
        memory: { status: 'unknown' }
    };
    
    let allHealthy = true;
    
    // Check Database
    try {
        var result = db.prepare('SELECT 1 as test').get();
        // Check event DB accessibility (sample)
        var eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
        checks.database = { 
            status: result ? 'connected' : 'error',
            engine: 'sqlite',
            totalEvents: eventCount
        };
    } catch (err) {
        checks.database = { status: 'error', message: err.message };
        allHealthy = false;
    }
    
    // Check Cache
    try {
        var stats = await getStats();
        checks.cache = {
            status: stats ? 'connected' : 'error',
            engine: stats?.engine || 'unknown',
            keys: stats?.keys || 0
        };
    } catch (err) {
        checks.cache = { status: 'error', message: err.message };
        allHealthy = false;
    }
    
    // Check Disk
    try {
        var dataPath = process.env.DATA_PATH || '/usr/src/app/persistence';
        if (fs.existsSync(dataPath)) {
            var diskStats = {};
            try {
                var st = fs.statfsSync(dataPath);
                diskStats = { availableBytes: st.bfree * st.bsize, totalBytes: st.blocks * st.bsize, availablePercent: Math.round((st.bfree / st.blocks) * 100) };
            } catch(e) {
                // statfs not available on all platforms
                diskStats = { availableBytes: 'N/A', totalBytes: 'N/A' };
            }
            checks.disk = { status: 'available', path: dataPath, ...diskStats };
        } else {
            checks.disk = { status: 'unavailable', path: dataPath };
            allHealthy = false;
        }
    } catch (err) {
        checks.disk = { status: 'error', message: err.message };
    }
    
    // Check Memory
    try {
        var mem = process.memoryUsage();
        checks.memory = {
            status: 'ok',
            rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
            heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100) + '%'
        };
        if (mem.heapUsed / mem.heapTotal > 0.9) {
            checks.memory.status = 'critical';
            allHealthy = false;
        } else if (mem.heapUsed / mem.heapTotal > 0.75) {
            checks.memory.status = 'warning';
        }
    } catch (err) {
        checks.memory = { status: 'error', message: err.message };
    }
    
    checks.responseTimeMs = Date.now() - startTime;
    
    if (!allHealthy) {
        checks.status = 'degraded';
    }
    
    res.status(allHealthy ? 200 : 503).json(checks);
});

module.exports = router;
