/**
 * Tests del logger asíncrono por lotes (v12.44.853 — auditoría 2026-11-25, P8).
 *
 * Garantías que se fijan aquí:
 *   1. warn/info/debug van a un búfer: NO aparecen en el archivo hasta flushSync/flushAll
 *      (así el event loop no se detiene en cada línea).
 *   2. flushSync() vuelca TODO lo pendiente de forma síncrona (apagado/crash/pruebas).
 *   3. error se escribe SINCRÓNICO inmediatamente: la evidencia de un fallo sobrevive al fallo.
 *   4. El volcado por lotes async escribe el contenido íntegro (flushAll).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATA_PATH = process.env.DATA_PATH || require('path').join(require('os').tmpdir(), 'check-logger-test-' + Date.now());
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-logger-test-0123456789';

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const LOG_DIR = path.join(process.env.DATA_PATH, 'logs');
const todayFile = (kind) => path.join(LOG_DIR, `${kind}-${new Date().toISOString().split('T')[0]}.log`);
const readSafe = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

describe('Logger asíncrono por lotes (v12.44.853)', () => {
    beforeEach(function() { logger.flushSync(); });

    test('info va al búfer: NO está en disco hasta flushSync', function() {
        const msg = 'qa-buffer-' + Date.now();
        logger.info(msg);
        expect(readSafe(todayFile('combined'))).not.toContain(msg); // aún en búfer
        logger.flushSync();
        expect(readSafe(todayFile('combined'))).toContain(msg);
    });

    test('error se escribe SINCRÓNICO inmediatamente (sin flush)', function() {
        const msg = 'qa-error-sync-' + Date.now();
        logger.error(msg);
        expect(readSafe(todayFile('error'))).toContain(msg);
        expect(readSafe(todayFile('combined'))).toContain(msg);
    });

    test('flushAll async escribe el lote íntegro', async function() {
        const msg = 'qa-flushall-' + Date.now();
        logger.warn(msg);
        logger.info(msg + '-segundo');
        await logger.flushAll();
        const combined = readSafe(todayFile('combined'));
        expect(combined).toContain(msg);
        expect(combined).toContain(msg + '-segundo');
    });

    test('varios logs consecutivos aterrizan en orden dentro del mismo volcado', function() {
        logger.flushSync();
        const base = 'qa-orden-' + Date.now();
        logger.info(base + '-1');
        logger.info(base + '-2');
        logger.info(base + '-3');
        logger.flushSync();
        const combined = readSafe(todayFile('combined'));
        const i1 = combined.indexOf(base + '-1');
        const i2 = combined.indexOf(base + '-2');
        const i3 = combined.indexOf(base + '-3');
        expect(i1).toBeGreaterThanOrEqual(0);
        expect(i2).toBeGreaterThan(i1);
        expect(i3).toBeGreaterThan(i2);
    });
});
