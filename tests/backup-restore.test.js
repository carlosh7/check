/**
 * tests/backup-restore.test.js — Verificación del ciclo backup → cifrado → restauración.
 *
 * Fase 6 / deuda de backups: los backups se crean cada 6h pero nadie probaba su
 * restauración. Este test crea un backup REAL de la BD de pruebas, comprueba que
 * quedó CIFRADO en disco, y verifica su restauración (descifrado + gunzip + apertura
 * como BD SQLite válida con las tablas críticas) vía verifyBackupRestorable().
 *
 * Requiere que process.env.DATA_PATH y ENCRYPTION_KEY estén definidos ANTES de los
 * requires (el módulo backup resuelve el directorio al cargar).
 */
process.env.DATA_PATH = process.env.DATA_PATH || require('path').join(require('os').tmpdir(), 'check-test-backups-' + Date.now());
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'clave-de-test-backup-restore-2026';

const fs = require('fs');

const backup = require('../src/utils/backup');
const encryption = require('../src/security/encryption');

// BD mínima: el require de database inicializa el esquema completo
beforeAll(() => {
    require('../database');
});

describe('Backup cifrado + restauración (Fase 6)', () => {
    test('encryptBuffer/decryptBuffer es simétrico (gzip + AES-256-GCM)', () => {
        const original = Buffer.from('contenido secreto de prueba: ñáéíóú 🔐');
        const enc = encryption.encryptBuffer(original);
        expect(enc).not.toBeNull();
        expect(enc.equals(original)).toBe(false);
        expect(encryption.isBackupEncrypted(enc)).toBe(true);
        const dec = encryption.decryptBuffer(enc);
        expect(dec.equals(original)).toBe(true);
    });

    test('decryptBuffer falla limpiamente con clave incorrecta (auth tag)', () => {
        const enc = encryption.encryptBuffer(Buffer.from('datos'));
        process.env.ENCRYPTION_KEY = 'otra-clave-distinta';
        const dec = encryption.decryptBuffer(enc);
        process.env.ENCRYPTION_KEY = 'clave-de-test-backup-restore-2026';
        expect(dec).toBeNull();
    });

    test('createBackup produce archivo CIFRADO (sin volcado SQLite en claro)', async () => {
        const created = await backup.createBackup();
        expect(created.success).toBe(true);
        expect(created.encrypted).toBe(true);
        expect(created.path.endsWith('.db.enc')).toBe(true);
        expect(fs.existsSync(created.path)).toBe(true);

        // El archivo en disco NO contiene el volcado SQLite en claro
        const raw = fs.readFileSync(created.path);
        expect(raw.slice(0, 15).toString('utf8')).not.toBe('SQLite format 3');
    });

    test('verificarBackupRestorable: descifra, abre BD válida con tablas críticas', async () => {
        const created = await backup.createBackup();
        expect(created.success).toBe(true);
        const r = backup.verifyBackupRestorable(created.path);
        expect(r.ok).toBe(true);
        expect(r.encrypted).toBe(true);
        expect(r.integrity).toBe('ok');
        for (const t of ['users', 'events', 'guests', 'settings']) {
            expect(typeof r.tables[t]).toBe('number');
        }
    });

    test('restauración rechaza clave incorrecta con error claro', async () => {
        const created = await backup.createBackup();
        expect(created.success).toBe(true);
        process.env.ENCRYPTION_KEY = 'clave-equivocada';
        expect(() => backup.restoreBackupToBuffer(created.path)).toThrow(/descifrar/i);
        process.env.ENCRYPTION_KEY = 'clave-de-test-backup-restore-2026';
    });

    test('listBackups lista cifrados y legados con su estado', async () => {
        await backup.createBackup();
        const list = backup.listBackups();
        expect(list.length).toBeGreaterThan(0);
        expect(list[0].encrypted).toBe(true);
    });
});
