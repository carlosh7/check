const { db } = require('../../database');

const INJECTION_PATTERNS = [
    { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|commands|prompts)/i, risk: 0.9, label: 'ignore_previous_instructions' },
    { pattern: /you\s+(are\s+)?now\s+(a\s+)?/i, risk: 0.7, label: 'role_impersonation' },
    { pattern: /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|guidelines)/i, risk: 0.9, label: 'forget_instructions' },
    { pattern: /system\s+prompt/i, risk: 0.6, label: 'system_prompt_reference' },
    { pattern: /DAN|do\s+anything\s+now/i, risk: 0.9, label: 'jailbreak_dan' },
    { pattern: /output\s+in\s+markdown|format\s+as\s+json/i, risk: 0.3, label: 'format_request' },
    { pattern: /reveal|display|show\s+(the\s+)?(system|initial|first)\s+(prompt|message|instruction)/i, risk: 0.8, label: 'prompt_leak' },
    { pattern: /tell\s+me\s+(how\s+to\s+)?(hack|crack|exploit|bypass|breach)/i, risk: 0.9, label: 'malicious_request' },
    { pattern: /(admin|root|sudo|superuser)\s+(access|password|credentials|login)/i, risk: 0.8, label: 'privilege_escalation' },
    { pattern: /sql\s+injection|drop\s+table|select\s+\*|DELETE\s+FROM/i, risk: 0.9, label: 'sql_injection' },
    { pattern: /<script|javascript:|onerror=|onclick=/i, risk: 0.9, label: 'xss_attempt' },
    { pattern: /(curl|wget|fetch|request)\s+.*(https?:\/\/|http:\/\/)/i, risk: 0.5, label: 'external_request' },
    { pattern: /base64|hex\s+decode|rot13/i, risk: 0.4, label: 'encoding_obfuscation' },
];

const SENSITIVE_DATA_PATTERNS = [
    { regex: /\b[\w\.-]+@[\w\.-]+\.\w+\b/g, type: 'email', label: '[EMAIL]' },
    { regex: /\b\d{10,15}\b/g, type: 'phone', label: '[TEL]' },
    { regex: /\b[A-Z]{3,4}\d{6}[A-Z0-9]{3}\b/g, type: 'rfc', label: '[RFC]' },
    { regex: /\b\d{18}\b/g, type: 'curp', label: '[CURP]' },
    { regex: /\b\d{16}\b/g, type: 'credit_card', label: '[TARJETA]' },
    { regex: /\b(?!\*)(?:[A-Za-z0-9+/]{4}){2,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\b/g, type: 'base64', label: '[BASE64]' },
];

function validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return { riskScore: 0, injectionDetected: false, matchedPatterns: [] };
    var matchedPatterns = [];
    var maxRisk = 0;
    INJECTION_PATTERNS.forEach(function(p) {
        if (p.pattern.test(prompt)) {
            matchedPatterns.push({ pattern: p.label, risk: p.risk });
            if (p.risk > maxRisk) maxRisk = p.risk;
        }
    });
    return {
        riskScore: Math.round(maxRisk * 100) / 100,
        injectionDetected: maxRisk >= 0.7,
        matchedPatterns: matchedPatterns
    };
}

function maskSensitiveData(text) {
    if (!text || typeof text !== 'string') return { masked: text, foundTypes: [] };
    var masked = text;
    var foundTypes = [];
    SENSITIVE_DATA_PATTERNS.forEach(function(p) {
        masked = masked.replace(p.regex, function(match) {
            if (!foundTypes.includes(p.type)) foundTypes.push(p.type);
            return p.label;
        });
    });
    return { masked: masked, foundTypes: foundTypes };
}

function middleware(req, res, next) {
    if (req.body && req.body.prompt) {
        var validation = validatePrompt(req.body.prompt);
        req.aiValidation = validation;

        var dlp = maskSensitiveData(req.body.prompt);
        req.body.prompt = dlp.masked;

        if (validation.injectionDetected) {
            req.aiInjectionDetected = true;
            req.aiInjectionPatterns = validation.matchedPatterns;
            req.aiRiskScore = validation.riskScore;
        }
    }
    next();
}

module.exports = { validatePrompt, maskSensitiveData, middleware, INJECTION_PATTERNS, SENSITIVE_DATA_PATTERNS };
