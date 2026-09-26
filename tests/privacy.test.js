/**
 * Tests Fase L (v12.44.818) — Utilidades de privacidad (Ley 1581)
 */
const { maskEmail, sha256Hex } = require('../src/utils/privacy');

describe('privacy.maskEmail (minimización kiosco)', () => {
    test('enmascara email normal conservando dominio', () => {
        expect(maskEmail('juan.perez@acme.com')).toBe('j***@acme.com');
    });

    test('conserva primer carácter aunque sea largo', () => {
        expect(maskEmail('a@b.co')).toBe('a***@b.co');
    });

    test('devuelve vacío/inválido sin romperse', () => {
        expect(maskEmail('')).toBe('');
        expect(maskEmail(null)).toBe('');
        expect(maskEmail('sin-arroba')).toBe('sin-arroba');
    });
});

describe('privacy.sha256Hex (prueba de versión de política)', () => {
    test('hash determinista de 64 hex', () => {
        const h1 = sha256Hex('política v1');
        const h2 = sha256Hex('política v1');
        expect(h1).toBe(h2);
        expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('textos distintos → hashes distintos', () => {
        expect(sha256Hex('v1')).not.toBe(sha256Hex('v2'));
    });

    test('acepta null/undefined sin lanzar', () => {
        expect(sha256Hex(null)).toMatch(/^[a-f0-9]{64}$/);
    });
});
