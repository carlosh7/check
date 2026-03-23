/**
 * Tests para Middleware de Seguridad
 */

const { csrfMiddleware, securityHeaders, ALLOWED_ORIGINS } = require('../src/middleware/csrf');

// Mock request/response
function createMockReq(overrides = {}) {
    return {
        method: 'GET',
        path: '/api/test',
        headers: {},
        ip: '127.0.0.1',
        ...overrides
    };
}

function createMockRes() {
    const res = {
        headers: {},
        statusCode: 200,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.body = data;
            return this;
        },
        setHeader: function(name, value) {
            this.headers[name] = value;
        }
    };
    return res;
}

describe('CSRF Middleware', () => {
    describe('Allowed Origins Configuration', () => {
        test('should have allowed origins configured', () => {
            expect(Array.isArray(ALLOWED_ORIGINS)).toBe(true);
            expect(ALLOWED_ORIGINS.length).toBeGreaterThan(0);
        });
    });
    
    describe('GET requests', () => {
        test('should allow GET requests (no CSRF needed)', () => {
            const req = createMockReq({ method: 'GET', path: '/api/events' });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
        });
    });
    
    describe('POST requests to non-protected paths', () => {
        test('should allow POST to public paths', () => {
            const req = createMockReq({ method: 'POST', path: '/api/login' });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
        });
    });
    
    describe('POST requests to protected paths', () => {
        test('should allow requests with valid origin', () => {
            const req = createMockReq({
                method: 'POST',
                path: '/api/users',
                headers: { origin: 'http://localhost:3000' }
            });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
        });
        
        test('should block requests with untrusted origin', () => {
            const req = createMockReq({
                method: 'POST',
                path: '/api/users',
                headers: { origin: 'http://evil-site.com' }
            });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
        });
        
        test('should allow requests without origin (same-origin)', () => {
            const req = createMockReq({
                method: 'POST',
                path: '/api/guests',
                headers: {}
            });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
        });
    });
    
    describe('PUT/PATCH/DELETE requests', () => {
        test('should apply CSRF protection to PUT', () => {
            const req = createMockReq({
                method: 'PUT',
                path: '/api/events/1',
                headers: { origin: 'http://localhost:3000' }
            });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
        });
        
        test('should apply CSRF protection to DELETE', () => {
            const req = createMockReq({
                method: 'DELETE',
                path: '/api/guests/1',
                headers: { origin: 'http://evil.com' }
            });
            const res = createMockRes();
            const next = jest.fn();
            
            csrfMiddleware(req, res, next);
            
            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
        });
    });
});

describe('Security Headers Middleware', () => {
    test('should set X-Frame-Options header', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        
        securityHeaders(req, res, next);
        
        expect(res.headers['X-Frame-Options']).toBe('DENY');
        expect(next).toHaveBeenCalled();
    });
    
    test('should set X-Content-Type-Options header', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        
        securityHeaders(req, res, next);
        
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    });
    
    test('should set X-XSS-Protection header', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        
        securityHeaders(req, res, next);
        
        expect(res.headers['X-XSS-Protection']).toBe('1; mode=block');
    });
    
    test('should set Referrer-Policy header', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        
        securityHeaders(req, res, next);
        
        expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
    
    test('should set Permissions-Policy header', () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        
        securityHeaders(req, res, next);
        
        expect(res.headers['Permissions-Policy']).toBe('geolocation=(), microphone=(), camera=()');
    });
    
    describe('API routes caching', () => {
        test('should set no-cache headers for API routes', () => {
            const req = createMockReq({ path: '/api/events' });
            const res = createMockRes();
            const next = jest.fn();
            
            securityHeaders(req, res, next);
            
            expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
        });
        
        test('should not set cache headers for non-API routes', () => {
            const req = createMockReq({ path: '/static/file.js' });
            const res = createMockRes();
            const next = jest.fn();
            
            securityHeaders(req, res, next);
            
            expect(res.headers['Cache-Control']).toBeUndefined();
        });
    });
});
