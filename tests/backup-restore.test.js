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

// v12.44.847 (auditoría 2026-11-25, D2): el respaldo debe incluir las BDs de evento (ahí viven los
// invitados de los eventos nuevos) y los archivos subidos, no solo la BD maestra.
describe('Backup incluye BDs de evento y archivos subidos (v12.44.847)', () => {
    const path = require('path');
    const eventId = '11111111-2222-4333-8444-555555555555';
    let created = null;

    beforeAll(() => {
        const Database = require('better-sqlite3');
        const evDir = path.join(process.env.DATA_PATH, 'events');
        const upDir = path.join(process.env.DATA_PATH, 'uploads', 'logos');
        fs.mkdirSync(evDir, { recursive: true });
        fs.mkdirSync(upDir, { recursive: true });
        const edb = new Database(path.join(evDir, eventId + '.db'));
        edb.exec('CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, event_id TEXT, name TEXT, email TEXT)');
        edb.prepare('INSERT INTO guests (id, event_id, name, email) VALUES (?, ?, ?, ?)').run('g1', eventId, 'QA Invitado', 'qa@invitado.test');
        edb.close();
        fs.writeFileSync(path.join(upDir, 'logo-qa.png'), 'png-de-prueba');
    });

    afterAll(() => {
        for (const f of [path.join(process.env.DATA_PATH, 'events', eventId + '.db'), path.join(process.env.DATA_PATH, 'uploads', 'logos', 'logo-qa.png')]) {
            try { fs.unlinkSync(f); } catch (e) {}
        }
    });

    test('createBackup respalda la BD del evento, cifrada y restorable con sus invitados', async () => {
        created = await backup.createBackup();
        expect(created.success).toBe(true);
        expect(created.events.count).toBe(1);
        const files = backup.listBackups().map(b => b.file);
        const evBackup = files.find(f => f.startsWith('check_event_backup_') && f.includes(eventId));
        expect(evBackup).toBeTruthy();
        const full = path.join(process.env.DATA_PATH, 'system', 'backups', evBackup);
        expect(fs.readFileSync(full).slice(0, 15).toString('utf8')).not.toBe('SQLite format 3'); // cifrado
        const plain = backup.restoreBackupToBuffer(full);
        const Database = require('better-sqlite3');
        const tmp = path.join(require('os').tmpdir(), 'restore-ev-' + Date.now() + '.db');
        fs.writeFileSync(tmp, plain);
        const db = new Database(tmp, { readonly: true });
        expect(db.prepare('SELECT COUNT(*) AS c FROM guests').get().c).toBe(1);
        expect(db.prepare('SELECT email FROM guests').get().email).toBe('qa@invitado.test');
        db.close();
        fs.unlinkSync(tmp);
    });

    test('createBackup empaqueta y cifra los archivos subidos', async () => {
        expect(created.uploads.ok).toBe(true);
        const files = backup.listBackups().map(b => b.file);
        const upBackup = files.find(f => f.startsWith('check_uploads_backup_'));
        expect(upBackup).toBeTruthy();
        const plain = backup.restoreBackupToBuffer(path.join(process.env.DATA_PATH, 'system', 'backups', upBackup));
        expect(plain[0]).toBe(0x1f); // gzip
        expect(plain[1]).toBe(0x8b);
    });

    test('la limpieza por antigüedad reconoce los tres tipos de respaldo', () => {
        const stale = ['check_app_backup_2000-01-01.db.enc', 'check_event_backup_2000-01-01_x.db.enc', 'check_uploads_backup_2000-01-01.tar.gz.enc', 'otro-archivo.txt'];
        const dir = path.join(process.env.DATA_PATH, 'system', 'backups');
        const old = new Date(Date.now() - 10 * 24 * 3600 * 1000);
        for (const f of stale) { fs.writeFileSync(path.join(dir, f), 'x'); fs.utimesSync(path.join(dir, f), old, old); }
        backup.cleanupOldBackups();
        const left = fs.readdirSync(dir);
        expect(left).toEqual(expect.arrayContaining(['otro-archivo.txt']));
        for (const f of stale.slice(0, 3)) expect(left).not.toContain(f);
    });
});

describe('verifyBackupRestorable entiende los tres tipos de respaldo (v12.44.847)', () => {
    const path = require('path');
    const dir = () => path.join(process.env.DATA_PATH, 'system', 'backups');

    test('un respaldo de evento se verifica solo con su tabla de invitados', async () => {
        await backup.createBackup();
        const ev = backup.listBackups().map(b => b.file).find(f => f.startsWith('check_event_backup_'));
        const r = backup.verifyBackupRestorable(path.join(dir(), ev));
        expect(r.ok).toBe(true);
        expect(r.integrity).toBe('ok');
        expect(r.tables.guests).toBe(1);
    });

    test('un respaldo de subidas se verifica como gzip válido', async () => {
        const up = backup.listBackups().map(b => b.file).find(f => f.startsWith('check_uploads_backup_'));
        const r = backup.verifyBackupRestorable(path.join(dir(), up));
        expect(r.ok).toBe(true);
    });

    test('la BD maestra sigue verificándose con todas sus tablas críticas', async () => {
        const app = backup.listBackups().map(b => b.file).find(f => f.startsWith('check_app_backup_'));
        const r = backup.verifyBackupRestorable(path.join(dir(), app));
        expect(r.ok).toBe(true);
        expect(typeof r.tables.users).toBe('number');
    });
});
