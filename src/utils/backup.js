// backup.js - Sistema de Backups Automatizados
// Usa db.backup() de better-sqlite3 para copias seguras mientras la BD está en uso
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

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
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // Usar db.backup() — seguro mientras la BD está en uso (WAL mode)
        await db.backup(backupPath);

        const stats = fs.statSync(backupPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        logger.info('[BACKUP] Backup creado: ' + backupFileName + ' (' + sizeMB + ' MB)');

        cleanupOldBackups();

        return { success: true, path: backupPath, size: sizeMB };
    } catch (error) {
        logger.error('[BACKUP] Error al crear backup: ' + error.message);
        return { success: false, error: error.message };
    }
}

function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        files.forEach(file => {
            if (file.startsWith('check_app_backup_') && file.endsWith('.db')) {
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
    logger.info('[BACKUP] Scheduler iniciado: Backup cada 6 horas');
    setTimeout(() => createBackup(), 5000);
    setInterval(createBackup, 6 * 60 * 60 * 1000);
}

module.exports = { createBackup, cleanupOldBackups, startBackupScheduler };
