/**
 * Script de configuración automática para el servidor
 * Ejecutar: node setup.js
 * 
 * Este script automatiza todo el proceso de inicialización:
 * 1. Crea archivo .env si no existe
 * 2. Instala dependencias si faltan
 * 3. Inicializa la base de datos
 * 4. Inicia el servidor automáticamente
 *    (el admin inicial se crea con el wizard de primer arranque, no aquí)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const Database = require('better-sqlite3');

console.log('🔧 Configurando Check Pro...\n');

// 1. Verificar archivo .env
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('📝 Creando archivo .env desde .env.example...');
    
    if (fs.existsSync(envExamplePath)) {
        // Copiar .env.example a .env
        const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
        fs.writeFileSync(envPath, envExampleContent);
        console.log('✅ Archivo .env creado desde .env.example');
    } else {
        // Crear .env básico si no hay ejemplo
        let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
        let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
        
        if (!vapidPublicKey || !vapidPrivateKey) {
            try {
                const webpush = require('web-push');
                const vapidKeys = webpush.generateVAPIDKeys();
                vapidPublicKey = vapidKeys.publicKey;
                vapidPrivateKey = vapidKeys.privateKey;
                console.log('🔑 Claves VAPID generadas automáticamente');
            } catch (e) {
                console.warn('⚠️ No se pudieron generar claves VAPID. Las notificaciones push requerirán configuración manual.');
            }
        }
        
        const envContent = `# Check Pro - Configuración
# Generated automatically

# Puerto del servidor (auto-detectado si está ocupado)
PORT=3000

# JWT (generar con: openssl rand -hex 32)
JWT_SECRET=${process.env.JWT_SECRET || ''}

# Admin inicial (OPCIONAL — v12.44.802)
# Si defines AMBAS variables se crea ese admin en el primer arranque (headless).
# Si no, el primer arranque abre el asistente web para crear el admin de forma segura.
# ADMIN_EMAIL=
# ADMIN_PASSWORD=

# URL de la aplicación
APP_URL=http://localhost:3000

# Dominios permitidos para CORS (se auto-actualiza con el puerto detectado)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${vapidPrivateKey}
VAPID_SUBJECT=${process.env.VAPID_SUBJECT || 'mailto:tu-correo@tudominio.com'}
`;
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Archivo .env creado con configuración básica');
    }
} else {
    console.log('✅ Archivo .env ya existe');
}

// 1.b Endurecer secretos débiles (Fase 0 · auditoría 2026-08)
try {
    const { bootstrapEnv } = require('./scripts/bootstrap-env');
    const secretChanges = bootstrapEnv();
    if (secretChanges.length > 0) {
        console.log('🔐 Secretos/entorno endurecidos automáticamente:');
        secretChanges.forEach(c => console.log('   ✓ ' + c));
    }
} catch (e) {
    console.warn('⚠️ No se pudo ejecutar bootstrap-env:', e.message);
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

// 3. Verificar y crear directorio data
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    console.log('📁 Creando directorio data...');
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Directorio data creado');
} else {
    console.log('✅ Directorio data ya existe');
}

// 4. Inicializar base de datos
console.log('🗄️  Inicializando base de datos...');
try {
    const dbPath = path.resolve(__dirname, 'data/check_app.db');
    const db = new Database(dbPath);
    
    // Activar WAL mode para mejor rendimiento concurrente
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Crear tabla de usuarios si no existe
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'PRODUCTOR',
        role_detail TEXT DEFAULT 'STAFF',
        group_id TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TEXT
    )`);
    
    // Verificar si hay usuarios (v12.44.802: ya NO se siembra ningún admin
    // con credenciales conocidas — el primer arranque usa el wizard web)
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    
    if (userCount.count === 0) {
        console.log('👤 Instalación sin usuarios: el asistente de primer arranque creará el admin al abrir la app.');
    } else {
        console.log('✅ Base de datos ya tiene usuarios');
    }
    
    // Crear otras tablas esenciales
    console.log('📊 Creando tablas esenciales...');
    
    // Tabla de eventos
    db.exec(`CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        date TEXT,
        location TEXT,
        logo_url TEXT,
        description TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Tabla de invitados
    db.exec(`CREATE TABLE IF NOT EXISTS guests (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        organization TEXT,
        position TEXT,
        gender TEXT DEFAULT 'O',
        dietary_notes TEXT,
        is_new_registration INTEGER DEFAULT 0,
        checked_in INTEGER DEFAULT 0,
        checkin_time TEXT,
        qr_token TEXT UNIQUE,
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);
    
    db.close();
    console.log('✅ Base de datos inicializada correctamente');
    
} catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    process.exit(1);
}

console.log('\n🎉 Configuración completada!');
console.log('🚀 Iniciando servidor...\n');

// 5. Iniciar servidor
try {
    // Cargar variables de entorno
    require('dotenv').config();
    
    // Iniciar servidor
    const serverProcess = spawn('node', ['server.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    serverProcess.on('error', (error) => {
        console.error('❌ Error iniciando servidor:', error.message);
        process.exit(1);
    });
    
    console.log('\n✅ Servidor iniciado correctamente');
    console.log('🌐 Accede a: http://localhost:3000');
    console.log('🧙 Si la instalación es nueva, el asistente de primer arranque te pedirá crear la cuenta de administrador.');
    console.log('\nPresiona Ctrl+C para detener el servidor');
    
} catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
}