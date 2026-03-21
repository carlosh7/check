/**
 * Rutas públicas - versión y salud
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
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

module.exports = router;
