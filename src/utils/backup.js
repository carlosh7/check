// backup.js - Sistema de Backups Automatizados
// Ejecuta copias de seguridad de la base de datos cada 6 horas
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve(__dirname, '../data/backups');
const DB_PATH = path.resolve(__dirname, '../data/check_app.db');

// Asegurar que el directorio de backups existe
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('[BACKUP] Directorio de backups creado:', BACKUP_DIR);
}

function createBackup() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            console.warn('[BACKUP] Base de datos no encontrada, omitiendo backup');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `check_app_backup_${timestamp}.db`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // Copiar archivo de base de datos
        fs.copyFileSync(DB_PATH, backupPath);
        
        // Verificar que el backup se creó correctamente
        const stats = fs.statSync(backupPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`[BACKUP] ✅ Backup creado exitosamente: ${backupFileName} (${sizeMB} MB)`);

        // Limpieza: Eliminar backups mayores a 7 días (168 horas)
        cleanupOldBackups();

        return { success: true, path: backupPath, size: sizeMB };
    } catch (error) {
        console.error('[BACKUP] ❌ Error al crear backup:', error.message);
        return { success: false, error: error.message };
    }
}

function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

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
            console.log(`[BACKUP] 🧹 Limpieza: ${deletedCount} backup(s) antiguo(s) eliminado(s)`);
        }
    } catch (error) {
        console.error('[BACKUP] Error en limpieza:', error.message);
    }
}

// Iniciar scheduler de backups (cada 6 horas)
function startBackupScheduler() {
    console.log('[BACKUP] Scheduler iniciado: Backup cada 6 horas');
    
    // Backup inmediato al iniciar
    setTimeout(() => createBackup(), 5000);
    
    // Backup cada 6 horas
    setInterval(createBackup, 6 * 60 * 60 * 1000);
}

// Exportar para uso manual desde API si se desea
module.exports = { createBackup, cleanupOldBackups, startBackupScheduler };
