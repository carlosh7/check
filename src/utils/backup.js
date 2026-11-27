// backup.js - Sistema de Backups Automatizados
// Usa db.backup() de better-sqlite3 para copias seguras mientras la BD está en uso
// L-4b (v12.44.820): los backups se CIFRAN (gzip + AES-256-GCM) con BACKUP_ENCRYPTION_KEY
// (o ENCRYPTION_KEY como respaldo). Los .db en claro antiguos siguen listándose/limpiándose.
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const encryption = require('../security/encryption');

let db;
try {
    db = require('../../database').db;
} catch (e) {
    logger.error('[BACKUP] No se pudo cargar la BD: ' + e.message);
}

const BACKUP_DIR = process.env.DATA_PATH
    ? path.join(process.env.DATA_PATH, 'system', 'backups')
    : path.join(__dirname, '../../data/system/backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('[BACKUP] Directorio de backups creado: ' + BACKUP_DIR);
}

async function createBackup() {
    if (!db) {
        logger.warn('[BACKUP] BD no disponible, omitiendo backup');
        return { success: false, error: 'BD no disponible' };
    }

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `check_app_backup_${timestamp}.db`;
        const tmpPath = path.join(BACKUP_DIR, backupFileName);
        const encryptionAvailable = !!process.env.BACKUP_ENCRYPTION_KEY || !!process.env.ENCRYPTION_KEY;
        const finalPath = encryptionAvailable ? tmpPath + '.enc' : tmpPath;

        // Usar db.backup() — seguro mientras la BD está en uso (WAL mode)
        await db.backup(tmpPath);

        if (encryptionAvailable) {
            // Cifrar el volcado: gzip + AES-256-GCM (auth tag = cualquier alteración se detecta)
            const raw = fs.readFileSync(tmpPath);
            const enc = encryption.encryptBuffer(raw);
            fs.writeFileSync(finalPath, enc);
            fs.unlinkSync(tmpPath); // el volcado en claro nunca permanece en disco
        } else {
            // Sin clave: se conserva el backup en claro (recuperación de desastres > cifrado)
            // pero queda avisado de forma ruidosa (el módulo encryption también lo audita).
            logger.error('[BACKUP] ⚠️ Backup guardado SIN CIFRAR: define BACKUP_ENCRYPTION_KEY o ENCRYPTION_KEY. Ruta: ' + finalPath);
        }

        const stats = fs.statSync(finalPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        logger.info('[BACKUP] Backup creado: ' + path.basename(finalPath) + ' (' + sizeMB + ' MB, ' + (encryptionAvailable ? 'cifrado' : 'SIN cifrar') + ')');

        // // v12.44.847 (auditoría 2026-11-25, D2): la BD maestra NO contiene los invitados de los eventos con BD propia (que son
        // todos los nuevos). Un respaldo "correcto" de solo la maestra no servía para recuperar a los
        // asistentes. Se respaldan también las BDs de evento y los archivos subidos, cifrados igual.
        const events = await backupEventDatabases(timestamp).catch(function(err) {
            logger.error('[BACKUP] Error respaldando BDs de evento: ' + err.message);
            return { count: 0, total: 0, error: err.message };
        });
        const uploads = await backupUploads(timestamp).catch(function(err) {
            logger.error('[BACKUP] Error respaldando archivos subidos: ' + err.message);
            return { ok: false, error: err.message };
        });

        cleanupOldBackups();

        return { success: true, path: finalPath, size: sizeMB, encrypted: encryptionAvailable, events: events, uploads: uploads };
    } catch (error) {
        logger.error('[BACKUP] Error al crear backup: ' + error.message);
        return { success: false, error: error.message };
    }
}

// Lista los backups vigentes (cifrados y legados en claro), el más nuevo primero
function listBackups() {
    try {
        return fs.readdirSync(BACKUP_DIR)
            .filter(isBackupFile)
            .map(f => {
                const full = path.join(BACKUP_DIR, f);
                return { file: f, path: full, size: fs.statSync(full).size, encrypted: f.endsWith('.enc') || encryption.isBackupEncrypted(full) };
            })
            .sort((a, b) => b.file.localeCompare(a.file));
    } catch (_) { return []; }
}

// Restaura un backup a BUFFER de BD: descifra (si .enc) y descomprime. Para el script
// scripts/verify-backup-restore.js y el test periódico de restauración (Fase 6).
function restoreBackupToBuffer(filePath) {
    const raw = fs.readFileSync(filePath);
    if (encryption.isBackupEncrypted(filePath)) {
        const plain = encryption.decryptBuffer(raw);
        if (!plain) throw new Error('No se pudo descifrar el backup (¿clave BACKUP_ENCRYPTION_KEY/ENCRYPTION_KEY incorrecta o archivo alterado?)');
        return plain;
    }
    return raw; // backup legado en claro
}

// F6 (v12.44.820): ciclo completo de verificación — descifra, abre la BD, comprueba
// integridad y tablas críticas. Usa un archivo temporal (better-sqlite3 de este proyecto
// no abre Buffers) que se BORRA inmediatamente tras la comprobación.
function verifyBackupRestorable(filePath) {
    const os = require('os');
    const tmp = path.join(os.tmpdir(), 'check-restore-verify-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
    const result = { file: path.basename(filePath), encrypted: encryption.isBackupEncrypted(filePath), ok: false, tables: {}, error: null };
    try {
        // // v12.44.847 (auditoría 2026-11-25, D2): el respaldo de subidas es un tar.gz cifrado, no una base de datos
        if (path.basename(filePath).includes('check_uploads_backup_')) {
            const gz = restoreBackupToBuffer(filePath);
            result.ok = gz.length > 2 && gz[0] === 0x1f && gz[1] === 0x8b;
            if (!result.ok) result.error = 'El respaldo de subidas no descifra a un archivo gzip válido';
            return result;
        }
        fs.writeFileSync(tmp, restoreBackupToBuffer(filePath), { mode: 0o600 });
        const Database = require('better-sqlite3');
        const db = new Database(tmp, { readonly: true });
        result.integrity = db.pragma('integrity_check', { simple: true });
        // Críticas: deben existir SIEMPRE. consent_logs se crea lazy (compliance.routes)
        // y se reporta solo si está presente, sin fallar la verificación.
        // // v12.44.847 (auditoría 2026-11-25, D2): un respaldo de evento solo trae las tablas del evento (no users/settings/audit_logs)
        const isEventBackup = path.basename(filePath).includes('check_event_backup_');
        for (const table of (isEventBackup ? ['guests'] : ['users', 'events', 'guests', 'settings', 'audit_logs'])) {
            try { result.tables[table] = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c; }
            catch (e) { result.tables[table] = 'ERROR: ' + e.message; }
        }
        try { result.tables.consent_logs = db.prepare("SELECT COUNT(*) as c FROM consent_logs").get().c; } catch (_) { result.tables.consent_logs = null; }
        db.close();
        const missing = Object.entries(result.tables).filter(([k, v]) => k !== 'consent_logs' && typeof v !== 'number');
        result.ok = result.integrity === 'ok' && missing.length === 0;
        if (missing.length > 0) result.error = 'Tablas faltantes: ' + missing.map(([k]) => k).join(', ');
    } catch (e) {
        result.error = e.message;
    } finally {
        try { fs.unlinkSync(tmp); } catch (_) {}
    }
    return result;
}

function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        files.forEach(file => {
            if (isBackupFile(file)) {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > maxAge) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
        });

        if (deletedCount > 0) {
            logger.info('[BACKUP] Limpieza: ' + deletedCount + ' backup(s) antiguo(s) eliminado(s)');
        }
    } catch (error) {
        logger.error('[BACKUP] Error en limpieza: ' + error.message);
    }
}

// ─── // v12.44.847 (auditoría 2026-11-25, D2): respaldos de BDs de evento y de archivos subidos ───
// Prefijos: check_app_backup_ (BD maestra), check_event_backup_ (cada BD de evento),
// check_uploads_backup_ (archivos subidos, en un tar.gz).
function isBackupFile(name) {
    return /^check_(app|event|uploads)_backup_/.test(name) && /\.(db(\.enc)?|tar\.gz(\.enc)?)$/.test(name);
}

function dataRoot() {
    return process.env.DATA_PATH || path.join(__dirname, '../../data');
}

// Cifra un volcado temporal (o lo deja en claro avisando, si no hay clave) y devuelve { path, size }
function finalizeBackupFile(tmpPath, outName) {
    if (!process.env.BACKUP_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
        const plainPath = path.join(BACKUP_DIR, outName);
        fs.renameSync(tmpPath, plainPath);
        logger.error('[BACKUP] ⚠️ Backup guardado SIN CIFRAR: define BACKUP_ENCRYPTION_KEY o ENCRYPTION_KEY. Ruta: ' + plainPath);
        return { path: plainPath, size: fs.statSync(plainPath).size };
    }
    const raw = fs.readFileSync(tmpPath);
    const encPath = path.join(BACKUP_DIR, outName + '.enc');
    fs.writeFileSync(encPath, encryption.encryptBuffer(raw));
    fs.unlinkSync(tmpPath); // el volcado en claro nunca permanece en disco
    return { path: encPath, size: fs.statSync(encPath).size };
}

// Copia consistente de una BD aunque la app la tenga abierta (misma API que la BD maestra)
async function backupSqliteFile(dbFile, outName) {
    const Database = require('better-sqlite3');
    const tmpPath = path.join(BACKUP_DIR, outName + '.tmp');
    const src = new Database(dbFile, { readonly: true });
    try {
        await src.backup(tmpPath);
    } finally {
        src.close();
    }
    return finalizeBackupFile(tmpPath, outName);
}

async function backupEventDatabases(timestamp) {
    const dir = path.join(dataRoot(), 'events');
    if (!fs.existsSync(dir)) return { count: 0, total: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.db'));
    let count = 0;
    for (const f of files) {
        const eventId = f.slice(0, -3);
        try {
            await backupSqliteFile(path.join(dir, f), 'check_event_backup_' + timestamp + '_' + eventId + '.db');
            count++;
        } catch (err) {
            logger.error('[BACKUP] No se pudo respaldar la BD del evento ' + eventId + ': ' + err.message);
        }
    }
    logger.info('[BACKUP] BDs de evento respaldadas: ' + count + ' de ' + files.length);
    return { count, total: files.length };
}

async function backupUploads(timestamp) {
    const root = dataRoot();
    const names = ['uploads', 'photos'].filter(function(d) {
        const full = path.join(root, d);
        try { return fs.existsSync(full) && fs.readdirSync(full).length > 0; } catch (e) { return false; }
    });
    if (names.length === 0) return { ok: true, size: 0 };
    const { execFileSync } = require('child_process');
    const tmpPath = path.join(BACKUP_DIR, 'check_uploads_backup_' + timestamp + '.tar.gz.tmp');
    // rutas relativas al directorio de datos: al restaurar se descomprime con -C <DATA_PATH>
    execFileSync('tar', ['-czf', tmpPath, '-C', root].concat(names));
    const out = finalizeBackupFile(tmpPath, 'check_uploads_backup_' + timestamp + '.tar.gz');
    return { ok: true, size: out.size, dirs: names };
}

function startBackupScheduler() {
    logger.info('[BACKUP] Scheduler iniciado: Backup cada 6 horas' +
        ((process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY) ? ' (cifrados)' : ' ⚠️ SIN cifrado: define BACKUP_ENCRYPTION_KEY'));
    setTimeout(() => createBackup(), 5000);
    setInterval(createBackup, 6 * 60 * 60 * 1000).unref(); // v12.44.852 (P11)
}

module.exports = { createBackup, cleanupOldBackups, startBackupScheduler, listBackups, restoreBackupToBuffer, verifyBackupRestorable };
