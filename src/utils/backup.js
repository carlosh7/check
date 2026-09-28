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

        cleanupOldBackups();

        return { success: true, path: finalPath, size: sizeMB, encrypted: encryptionAvailable };
    } catch (error) {
        logger.error('[BACKUP] Error al crear backup: ' + error.message);
        return { success: false, error: error.message };
    }
}

// Lista los backups vigentes (cifrados y legados en claro), el más nuevo primero
function listBackups() {
    try {
        return fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('check_app_backup_') && (f.endsWith('.db') || f.endsWith('.db.enc')))
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
        fs.writeFileSync(tmp, restoreBackupToBuffer(filePath), { mode: 0o600 });
        const Database = require('better-sqlite3');
        const db = new Database(tmp, { readonly: true });
        result.integrity = db.pragma('integrity_check', { simple: true });
        // Críticas: deben existir SIEMPRE. consent_logs se crea lazy (compliance.routes)
        // y se reporta solo si está presente, sin fallar la verificación.
        for (const table of ['users', 'events', 'guests', 'settings', 'audit_logs']) {
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
            if (file.startsWith('check_app_backup_') && (file.endsWith('.db') || file.endsWith('.db.enc'))) {
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

function startBackupScheduler() {
    logger.info('[BACKUP] Scheduler iniciado: Backup cada 6 horas' +
        ((process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY) ? ' (cifrados)' : ' ⚠️ SIN cifrado: define BACKUP_ENCRYPTION_KEY'));
    setTimeout(() => createBackup(), 5000);
    setInterval(createBackup, 6 * 60 * 60 * 1000);
}

module.exports = { createBackup, cleanupOldBackups, startBackupScheduler, listBackups, restoreBackupToBuffer, verifyBackupRestorable };
