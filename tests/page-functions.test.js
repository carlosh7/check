/**
 * Test de bloqueo del auditor de funciones de páginas (v12.44.853).
 *
 * Garantiza que NINGUNA función declarada en public/js/pages/*.js esté muerta (cero menciones en
 * todo el frontend). Las funciones de páginas se invocan por STRING (data-call → window[fn]), así
 * que una "función sin usar" para ESLint suele estar viva; este test + scripts/audit-page-functions.js
 * documentan la diferencia con evidencia. Si este test falla, hay una función muerta demostrada que
 * se puede (y debe) eliminar.
 */
const path = require('path');
const { analyze } = require('../scripts/audit-page-functions');

describe('Auditor de funciones de páginas (v12.44.853)', () => {
    test('todas las funciones declaradas tienen al menos una invocación real', function() {
        const result = analyze();
        expect(result.deadCount).toBe(0);
        expect(result.alive).toBe(result.total);
    });

    test('el corpus incluye HTML de páginas y JS generador', function() {
        // sanity: el análisis no puede ser trivialmente vacío
        const result = analyze();
        expect(result.total).toBeGreaterThan(400);
    });
});
