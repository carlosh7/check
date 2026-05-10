const express = require('express');
const { db } = require('../../database');
const { getResponse } = require('../chatbot/engine');

const router = express.Router();

// POST /api/chatbot/message — public chat endpoint
router.post('/api/chatbot/message', (req, res) => {
    try {
        var { message, event_id } = req.body;
        if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
        var response = getResponse(message, event_id || null);
        res.json({ success: true, response: response });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
