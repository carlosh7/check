function maskPII(text) {
    if (!text || typeof text !== 'string') return text;
    var masked = text;
    masked = masked.replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[EMAIL]');
    masked = masked.replace(/\b\d{10,15}\b/g, '[TEL]');
    masked = masked.replace(/\b[A-Z]{3,4}\d{6}[A-Z0-9]{3}\b/g, '[RFC]');
    masked = masked.replace(/\b\d{18}\b/g, '[CURP]');
    return masked;
}

function middleware(req, res, next) {
    var originalJson = res.json.bind(res);
    res.json = function(body) {
        if (body && req.aiValidation && req.aiValidation.riskScore > 0) {
            if (typeof body === 'object') {
                var str = JSON.stringify(body);
                str = maskPII(str);
                try { body = JSON.parse(str); } catch(e) {}
            }
        }
        return originalJson(body);
    };
    next();
}

module.exports = { maskPII, middleware };
