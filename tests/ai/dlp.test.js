jest.mock('../../database', function() {
    return {
        db: {
            prepare: function() { return { run: function() {}, get: function() {}, all: function() {} }; },
            exec: function() {},
            pragma: function() {}
        }
    };
});

var { maskSensitiveData, SENSITIVE_DATA_PATTERNS } = require('../../src/middleware/ai-validation');

describe('AI DLP - Sensitive Data Masking', function() {

    test('should mask email addresses', function() {
        var result = maskSensitiveData('Contact me at user@example.com please');
        expect(result.masked).not.toContain('user@example.com');
        expect(result.masked).toContain('[EMAIL]');
        expect(result.foundTypes).toContain('email');
    });

    test('should mask phone numbers (10-15 digits)', function() {
        var result = maskSensitiveData('Call me at 551234567890');
        expect(result.masked).not.toContain('551234567890');
        expect(result.masked).toContain('[TEL]');
        expect(result.foundTypes).toContain('phone');
    });

    test('should mask RFC (tax ID)', function() {
        var result = maskSensitiveData('My RFC is ABCD123456XYZ');
        expect(result.masked).not.toContain('ABCD123456XYZ');
        expect(result.masked).toContain('[RFC]');
        expect(result.foundTypes).toContain('rfc');
    });

    test('should mask CURP (18 digits)', function() {
        var result = maskSensitiveData('CURP: 123456789012345678');
        expect(result.masked).not.toContain('123456789012345678');
        expect(result.masked).toContain('[CURP]');
        expect(result.foundTypes).toContain('curp');
    });

    test('should mask credit card numbers (16 digits)', function() {
        var result = maskSensitiveData('Card: 1234567890123456');
        expect(result.masked).not.toContain('1234567890123456');
        expect(result.masked).toContain('[TARJETA]');
        expect(result.foundTypes).toContain('credit_card');
    });

    test('should NOT modify text without sensitive data', function() {
        var text = 'The event starts at 8 PM and ends at 10 PM';
        var result = maskSensitiveData(text);
        expect(result.masked).toBe(text);
        expect(result.foundTypes).toEqual([]);
    });

    test('should mask multiple sensitive data occurrences', function() {
        var text = 'Email: a@b.com, Phone: 551234567890, Email2: c@d.com';
        var result = maskSensitiveData(text);
        expect(result.masked).not.toContain('a@b.com');
        expect(result.masked).not.toContain('c@d.com');
        expect(result.masked).not.toContain('551234567890');
        expect(result.foundTypes).toContain('email');
        expect(result.foundTypes).toContain('phone');
    });

    test('should handle empty text', function() {
        var result = maskSensitiveData('');
        expect(result.masked).toBe('');
        expect(result.foundTypes).toEqual([]);
    });

    test('should handle null text', function() {
        var result = maskSensitiveData(null);
        expect(result.masked).toBe(null);
        expect(result.foundTypes).toEqual([]);
    });

    test('SENSITIVE_DATA_PATTERNS should have 6 patterns defined', function() {
        expect(SENSITIVE_DATA_PATTERNS.length).toBe(6);
        SENSITIVE_DATA_PATTERNS.forEach(function(p) {
            expect(p.regex).toBeDefined();
            expect(p.type).toBeDefined();
            expect(p.label).toBeDefined();
        });
    });
});
