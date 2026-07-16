/**
 * Chatbot Routes (v12.44.778)
 * Multi-turn chat with session context
 */
const express = require('express');
const { getResponse } = require('../chatbot/engine');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/chatbot/message — public chat endpoint with multi-turn context
router.post('/api/chatbot/message', async (req, res) => {
    try {
        var { message, event_id, session_id } = req.body;
        if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
        
        // Generate session ID if not provided (for anonymous users)
        const sessionId = session_id || req.ip + '_' + (event_id || 'global');
        
        var response = await getResponse(message, event_id || null, sessionId);
        res.json({ success: true, response: response, session_id: sessionId });
    } catch(err) {
        logger.error('[CHATBOT] Error:', err.message);
        res.status(500).json({ error: 'Error al procesar mensaje' });
    }
});

module.exports = router;
