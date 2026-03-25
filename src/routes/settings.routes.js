/**
 * Rutas de Settings y Admin
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Obtener settings
router.get('/', (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const dict = {};
    rows.forEach(r => dict[r.setting_key] = r.setting_value);
    res.json(dict);
});

// Actualizar settings
router.put('/', authMiddleware(['ADMIN']), (req, res) => {
    const { key, value } = req.body;
    
    if (key && value !== undefined) {
        db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, value);
    }
    
    res.json({ success: true });
});

module.exports = router;
