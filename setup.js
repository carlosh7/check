/**
 * Script de configuración automática para el servidor
 * Ejecutar: node setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Configurando Check Pro...\n');

// 1. Verificar archivo .env
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('📝 Creando archivo .env...');
    
    const vapidPublicKey = 'BL1xrfpMgEMMLpTS5ktElp_Nhhn4X-76OBSF4pWQoMrl2bwQgHuk5NThk6WH78PGd7Tusem8dUl2Bhd6SN58h6U';
    const vapidPrivateKey = '0cmIn2igdzGFATBOklzIe_m18ZX5qX_J-9yxw37NoyM';
    
    const envContent = `# Check Pro - Configuración
# Generated automatically

# JWT
JWT_SECRET=check_pro_secret_key_change_in_production

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${vapidPrivateKey}
VAPID_SUBJECT=mailto:admin@check.com
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Archivo .env creado');
} else {
    console.log('✅ Archivo .env ya existe');
}

// 2. Verificar node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Instalando dependencias...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencias instaladas');
    } catch(e) {
        console.error('❌ Error instalando dependencias:', e.message);
        process.exit(1);
    }
} else {
    console.log('✅ Dependencias ya instaladas');
}

console.log('\n🎉 Configuración completada!');
console.log('🚀 Para iniciar el servidor: node server.js');