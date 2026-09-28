#!/usr/bin/env node
/**
 * scripts/verify-backup-restore.js — Verificación de restauración de backups (Fase 6).
 *
 * CIERRA LA DEUDA: los backups se crean cada 6h desde 2026 pero nadie probó que se
 * pudieran RESTAURAR. Toma los backups del directorio (cifrados .enc y legados .db),
 * los descifra/descomprime, los abre con better-sqlite3 y comprueba que las tablas
 * críticas existen y son consultables.
 *
 * Uso:
 *   node scripts/verify-backup-restore.js            # verifica el backup más nuevo
 *   node scripts/verify-backup-restore.js --all      # verifica todos los vigentes
 *   node scripts/verify-backup-restore.js --create   # crea un backup fresco y lo verifica
 *
 * Requiere BACKUP_ENCRYPTION_KEY o ENCRYPTION_KEY en el entorno para los .enc.
 * Exit code 0 = todos los backups verificados restauran; 1 = alguno falló.
 */
process.env.DATA_PATH = process.env.DATA_PATH || require('path').join(__dirname, '../data');

const { listBackups, createBackup, verifyBackupRestorable } = require('../src/utils/backup');

async function main() {
    const args = process.argv.slice(2);
    const all = args.includes('--all');
    const create = args.includes('--create');

    if (create) {
        console.log('→ Creando backup fresco...');
        const created = await createBackup();
        if (!created.success) {
            console.error('✗ No se pudo crear el backup: ' + created.error);
            process.exit(1);
        }
        console.log('  Backup creado: ' + created.path + ' (' + created.size + ' MB, ' + (created.encrypted ? 'cifrado' : 'SIN cifrar') + ')');
    }

    const backups = listBackups();
    if (backups.length === 0) {
        console.error('✗ No hay backups en el directorio. Usa --create o espera el ciclo automático.');
        process.exit(1);
    }

    const targets = all ? backups : [backups[0]];
    console.log(`→ Verificando ${targets.length} backup(s) de ${backups.length} disponibles...\n`);

    let failures = 0;
    for (const entry of targets) {
        const r = verifyBackupRestorable(entry.path);
        const label = r.encrypted ? '[cifrado]' : '[LEGADO en claro]';
        if (r.ok) {
            console.log(`✓ ${label} ${r.file} — integrity: ${r.integrity} — usuarios:${r.tables.users} eventos:${r.tables.events} invitados:${r.tables.guests} consentimientos:${r.tables.consent_logs}`);
        } else {
            failures++;
            console.error(`✗ ${label} ${r.file} — ${r.error || 'integrity != ok'}`);
        }
    }

    console.log(failures === 0 ? '\n✓ RESTAURACIÓN VERIFICADA: todos los backups probados se restauran correctamente.' : `\n✗ ${failures} backup(s) FALLARON la restauración.`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('✗ Error fatal:', e.message); process.exit(1); });
