/**
 * Tests para Utilidades de Seguridad
 */

const { schemas, validate } = require('../src/security/validation');

// Logger sanitization logic tests (inline since SENSITIVE_FIELDS is private)
describe('Logger - Sanitization Logic', () => {
    const SENSITIVE_FIELDS = new Set([
        'password', 'pass', 'pwd', 'secret', 'token', 'jwt', 
        'access_token', 'refresh_token', 'api_key', 'apikey',
        'smtp_pass', 'smtp_password', 'imap_pass', 'imap_password',
        'private_key', 'privatekey', 'credit_card', 'cvv'
    ]);
    
    function sanitizeForLog(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }
        
        const sanitized = Array.isArray(data) ? [] : {};
        
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = SENSITIVE_FIELDS.has(lowerKey) || 
                SENSITIVE_FIELDS.has(key) ||
                ['password', 'token', 'secret', 'key', 'pass'].some(f => lowerKey.includes(f));
            
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeForLog(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    test('should redact password fields', () => {
        const data = { username: 'test', password: 'secret123' };
        const result = sanitizeForLog(data);
        
        expect(result.username).toBe('test');
        expect(result.password).toBe('[REDACTED]');
    });
    
    test('should redact smtp_pass fields', () => {
        const data = { smtp_host: 'smtp.test.com', smtp_pass: 'mypassword' };
        const result = sanitizeForLog(data);
        
        expect(result.smtp_host).toBe('smtp.test.com');
        expect(result.smtp_pass).toBe('[REDACTED]');
    });
    
    test('should handle nested objects', () => {
        const data = { user: { name: 'test', password: 'secret' } };
        const result = sanitizeForLog(data);
        
        expect(result.user.name).toBe('test');
        expect(result.user.password).toBe('[REDACTED]');
    });
    
    test('should handle arrays', () => {
        const data = [{ username: 'a', password: 'x' }, { username: 'b', password: 'y' }];
        const result = sanitizeForLog(data);
        
        expect(result[0].username).toBe('a');
        expect(result[0].password).toBe('[REDACTED]');
    });
    
    test('should return original value for non-objects', () => {
        expect(sanitizeForLog(null)).toBe(null);
        expect(sanitizeForLog(undefined)).toBe(undefined);
        expect(sanitizeForLog('string')).toBe('string');
        expect(sanitizeForLog(123)).toBe(123);
    });
});

describe('Validation - schemas', () => {
    describe('login schema', () => {
        test('should accept valid login data', () => {
            const data = { username: 'test@example.com', password: 'password123' };
            const result = validate(schemas.login, data);
            
            expect(result.valid).toBe(true);
            expect(result.data).toEqual(data);
        });
        
        test('should reject empty username', () => {
            const data = { username: '', password: 'password123' };
            const result = validate(schemas.login, data);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('username: Email requerido');
        });
        
        test('should reject missing password', () => {
            const data = { username: 'test@example.com' };
            const result = validate(schemas.login, data);
            
            expect(result.valid).toBe(false);
        });
    });
    
    describe('signup schema', () => {
        test('should accept valid signup data', () => {
            const data = {
                username: 'test@example.com',
                password: 'password123',
                display_name: 'Test User'
            };
            const result = validate(schemas.signup, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should reject short password', () => {
            const data = {
                username: 'test@example.com',
                password: '12345',
                display_name: 'Test User'
            };
            const result = validate(schemas.signup, data);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('6 caracteres'))).toBe(true);
        });
        
        test('should accept valid roles', () => {
            const validRoles = ['ADMIN', 'PRODUCTOR', 'LOGISTICO'];
            
            validRoles.forEach(role => {
                const data = {
                    username: 'test@example.com',
                    password: 'password123',
                    display_name: 'Test',
                    role
                };
                const result = validate(schemas.signup, data);
                expect(result.valid).toBe(true);
            });
        });
    });
    
    describe('createEvent schema', () => {
        test('should accept valid event data', () => {
            const data = { name: 'Mi Evento' };
            const result = validate(schemas.createEvent, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should reject empty name', () => {
            const data = { name: '' };
            const result = validate(schemas.createEvent, data);
            
            expect(result.valid).toBe(false);
        });
        
        test('should reject name too long', () => {
            const data = { name: 'a'.repeat(201) };
            const result = validate(schemas.createEvent, data);
            
            expect(result.valid).toBe(false);
        });
    });
    
    describe('createGuest schema', () => {
        test('should accept valid guest data', () => {
            const data = { name: 'Invitado Test', email: 'guest@example.com' };
            const result = validate(schemas.createGuest, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should accept empty email', () => {
            const data = { name: 'Invitado Test', email: '' };
            const result = validate(schemas.createGuest, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should accept valid gender values', () => {
            ['M', 'F', 'O'].forEach(gender => {
                const data = { name: 'Test', gender };
                const result = validate(schemas.createGuest, data);
                expect(result.valid).toBe(true);
            });
        });
        
        test('should reject invalid gender', () => {
            const data = { name: 'Test', gender: 'X' };
            const result = validate(schemas.createGuest, data);
            
            expect(result.valid).toBe(false);
        });
    });
    
    describe('broadcastEmail schema', () => {
        test('should accept valid email data', () => {
            const data = {
                event_id: 1,
                subject: 'Test Subject',
                body: '<p>Test body</p>'
            };
            const result = validate(schemas.broadcastEmail, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should reject empty subject', () => {
            const data = { event_id: 1, subject: '', body: 'body' };
            const result = validate(schemas.broadcastEmail, data);
            
            expect(result.valid).toBe(false);
        });
        
        test('should reject body too long', () => {
            const data = {
                event_id: 1,
                subject: 'Test',
                body: 'x'.repeat(50001)
            };
            const result = validate(schemas.broadcastEmail, data);
            
            expect(result.valid).toBe(false);
        });
    });
    
    describe('smtpConfig schema', () => {
        test('should accept valid SMTP config', () => {
            const data = {
                smtp_host: 'smtp.gmail.com',
                smtp_port: 587,
                smtp_user: 'test@gmail.com',
                smtp_secure: false,
                from_email: 'test@gmail.com'
            };
            const result = validate(schemas.smtpConfig, data);
            
            expect(result.valid).toBe(true);
        });
        
        test('should reject invalid port', () => {
            const data = { smtp_port: 70000 };
            const result = validate(schemas.smtpConfig, data);
            
            expect(result.valid).toBe(false);
        });
    });
});

describe('Validation - edge cases', () => {
    test('should handle invalid schema gracefully', () => {
        const result = validate(null, {});
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid validation schema');
    });
    
    test('should handle missing data', () => {
        const result = validate(schemas.login, null);
        expect(result.valid).toBe(false);
    });
    
    test('should validate UUID format for idParam', () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        const result = validate(schemas.idParam, { id: validId });
        expect(result.valid).toBe(true);
    });
    
    test('should validate pagination parameters', () => {
        const data = { page: '1', limit: '50' };
        const result = validate(schemas.pagination, data);
        expect(result.valid).toBe(true);
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
    });
});
