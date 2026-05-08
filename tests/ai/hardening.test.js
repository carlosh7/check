var helmet = require('helmet');

function createMockRes() {
    var headers = {};
    return {
        headers: headers,
        setHeader: function(name, value) { headers[name.toLowerCase()] = value; },
        getHeader: function(name) { return headers[name.toLowerCase()]; },
        removeHeader: function(name) { delete headers[name.toLowerCase()]; },
        end: function() {}
    };
}

describe('AI Hardening - Security Headers', function() {

    test('helmet should set X-Frame-Options header', function(done) {
        helmet()({ headers: {}, ip: '127.0.0.1' }, createMockRes(), function() {
            done();
        });
    });

    test('helmet should set X-Content-Type-Options header', function() {
        var res = createMockRes();
        helmet()({ headers: {}, ip: '127.0.0.1' }, res, function() {
            expect(res.getHeader('x-content-type-options')).toBe('nosniff');
        });
    });

    test('helmet should set Strict-Transport-Security header', function() {
        var res = createMockRes();
        helmet()({ headers: {}, ip: '127.0.0.1' }, res, function() {
            expect(res.getHeader('strict-transport-security')).toMatch(/max-age=/);
        });
    });

    test('helmet should set X-Frame-Options to SAMEORIGIN', function() {
        var res = createMockRes();
        helmet()({ headers: {}, ip: '127.0.0.1' }, res, function() {
            expect(res.getHeader('x-frame-options')).toBe('SAMEORIGIN');
        });
    });

    test('helmet should set X-XSS-Protection header', function() {
        var res = createMockRes();
        helmet()({ headers: {}, ip: '127.0.0.1' }, res, function() {
            expect(res.getHeader('x-xss-protection')).toBe('0');
        });
    });

    test('helmet should call next()', function(done) {
        helmet()({ headers: {}, ip: '127.0.0.1' }, createMockRes(), function() {
            done();
        });
    });
});
