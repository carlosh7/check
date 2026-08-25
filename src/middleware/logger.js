/**
 * Logger estructurado con request ID, timing y formato JSON
 */
const { v4: uuidv4 } = require('uuid');

function requestLogger(req, res, next) {
    req.requestId = uuidv4().slice(0, 8);
    req.startTime = Date.now();
    
    const originalEnd = res.end;
    res.end = function() {
        const duration = Date.now() - req.startTime;
        const logData = {
            rid: req.requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            ms: duration,
            ip: req.ip || req.connection.remoteAddress || '-'
        };
        if (req.userId) logData.uid = req.userId;
        if (duration > 2000) logData.slow = true;
        const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
        console.log('[' + level + ']', JSON.stringify(logData));
        originalEnd.apply(res, arguments);
    };
    next();
}

module.exports = { requestLogger };
