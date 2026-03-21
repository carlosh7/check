/**
 * Script de migración de contraseñas a bcrypt
 * Uso: node scripts/migrate_passwords.js
 */

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'check_app.db'));

console.log('===========================================');
console.log('  🔐 MIGRACIÓN DE CONTRASEÑAS A BCRYPT');
console.log('===========================================\n');

const saltRounds = 10;

// Obtener todos los usuarios
const users = db.prepare("SELECT id, username, password, display_name, role FROM users").all();

console.log(`📊 Total de usuarios encontrados: ${users.length}\n`);

let migrated = 0;
let alreadyHashed = 0;
let errors = 0;

const updateStmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");

console.log('🔄 Procesando usuarios...\n');

for (const user of users) {
    try {
        // Verificar si ya está hasheado (bcrypt empieza con $2)
        if (user.password && user.password.startsWith('$2')) {
            alreadyHashed++;
            console.log(`  ✓ ${user.username} - ya tiene hash bcrypt`);
            continue;
        }
        
        // Verificar que la contraseña no esté vacía
        if (!user.password || user.password.trim() === '') {
            console.log(`  ⚠ ${user.username} - contraseña vacía, omitido`);
            continue;
        }
        
        // Hashear la contraseña
        const hashed = bcrypt.hashSync(user.password, saltRounds);
        updateStmt.run(hashed, user.id);
        migrated++;
        console.log(`  ✓ ${user.username} - migrado ✓`);
        
    } catch (err) {
        errors++;
        console.log(`  ✗ ${user.username} - ERROR: ${err.message}`);
    }
}

console.log('\n===========================================');
console.log('  📊 RESUMEN DE MIGRACIÓN');
console.log('===========================================');
console.log(`   ✓ Migrados:        ${migrated}`);
console.log(`   ✓ Ya eran hash:    ${alreadyHashed}`);
console.log(`   ✗ Errores:         ${errors}`);
console.log('===========================================\n');

// Verificar un usuario de prueba
const adminUser = db.prepare("SELECT id, username, password FROM users WHERE role = 'ADMIN' LIMIT 1").get();
if (adminUser) {
    console.log('📧 Verificando usuario admin...');
    const isHashed = adminUser.password && adminUser.password.startsWith('$2');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   ¿Password hasheado?: ${isHashed ? 'SÍ ✓' : 'NO ✗'}`);
    
    if (isHashed) {
        console.log('\n🔑 Test de verificación:');
        console.log('   Intentando verificar contraseña original...');
        console.log('   (No podemos probar sin saber la contraseña original)');
    }
}

console.log('\n✅ Migración completada!');
console.log('\n⚠️  IMPORTANTE: Ahora el servidor usará bcrypt para verificar contraseñas.');
console.log('   Si el login falla después de reiniciar, restaurar backup:');
console.log('   cp server_backup_fase6.js server.js');

db.close();
