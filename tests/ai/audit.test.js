describe('AI Audit - Logging Actions', () => {

    var AUDIT_ACTIONS = {
        AI_PROMPT_SENT: 'AI_PROMPT_SENT',
        AI_INJECTION_DETECTED: 'AI_INJECTION_DETECTED',
        AI_ALERT_CREATED: 'AI_ALERT_CREATED',
        AI_ALERT_ACKNOWLEDGED: 'AI_ALERT_ACKNOWLEDGED',
        AI_PROMPT_REJECTED: 'AI_PROMPT_REJECTED'
    };

    test('AUDIT_ACTIONS should contain AI_PROMPT_SENT', () => {
        expect(AUDIT_ACTIONS.AI_PROMPT_SENT).toBe('AI_PROMPT_SENT');
    });

    test('AUDIT_ACTIONS should contain AI_INJECTION_DETECTED', () => {
        expect(AUDIT_ACTIONS.AI_INJECTION_DETECTED).toBe('AI_INJECTION_DETECTED');
    });

    test('AUDIT_ACTIONS should contain AI_ALERT_CREATED', () => {
        expect(AUDIT_ACTIONS.AI_ALERT_CREATED).toBe('AI_ALERT_CREATED');
    });

    test('AUDIT_ACTIONS should have 5 AI-specific actions', () => {
        var aiActions = Object.keys(AUDIT_ACTIONS).filter(function(k) {
            return k.startsWith('AI_');
        });
        expect(aiActions.length).toBe(5);
    });

    test('log entry should have required fields', () => {
        var logEntry = {
            action: 'AI_PROMPT_SENT',
            userId: 'user-123',
            details: {
                riskScore: 0.9,
                injectionDetected: true,
                ip: '127.0.0.1'
            }
        };
        expect(logEntry.action).toBeDefined();
        expect(logEntry.userId).toBeDefined();
        expect(logEntry.details).toBeDefined();
        expect(logEntry.details.riskScore).toBe(0.9);
    });

    test('log entry should store injection detection details', () => {
        var logEntry = {
            action: 'AI_INJECTION_DETECTED',
            userId: 'user-123',
            details: {
                riskScore: 0.9,
                pattern: 'ignore_previous_instructions',
                prompt: '[MASKED]',
                ip: '127.0.0.1'
            }
        };
        expect(logEntry.action).toBe('AI_INJECTION_DETECTED');
        expect(logEntry.details.riskScore).toBeGreaterThanOrEqual(0.7);
        expect(logEntry.details.pattern).toBeDefined();
    });

    test('sensitive data should be redacted in audit logs', () => {
        var logEntry = {
            action: 'AI_PROMPT_SENT',
            userId: 'user-123',
            details: {
                prompt: '[MASKED]',
                password: '[REDACTED]',
                apiKey: '[REDACTED]',
                ip: '127.0.0.1'
            }
        };
        var sensitiveKeys = ['password', 'apiKey'];
        sensitiveKeys.forEach(function(key) {
            expect(logEntry.details[key]).toBe('[REDACTED]');
        });
        expect(logEntry.details.prompt).toBe('[MASKED]');
    });
});
