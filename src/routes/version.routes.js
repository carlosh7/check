/**
 * Rutas públicas - versión y salud
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/app-version', (req, res) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    res.json({ version: pkg.version });
});

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
