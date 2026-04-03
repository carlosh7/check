/**
 * Script de configuración automática para el servidor
 * Ejecutar: node setup.js
 * 
 * Este script automatiza todo el proceso de inicialización:
 * 1. Crea archivo .env si no existe
 * 2. Instala dependencias si faltan
 * 3. Inicializa la base de datos
 * 4. Crea usuario admin por defecto
 * 5. Inicia el servidor automáticamente
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
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
        const vapidPublicKey = 'BL1xrfpMgEMMLpTS5ktElp_Nhhn4X-76OBSF4pWQoMrl2bwQgHuk5NThk6WH78PGd7Tusem8dUl2Bhd6SN58h6U';
        const vapidPrivateKey = '0cmIn2igdzGFATBOklzIe_m18ZX5qX_J-9yxw37NoyM';
        
        const envContent = `# Check Pro - Configuración
# Generated automatically

# Puerto del servidor
PORT=3000

# JWT
JWT_SECRET=check_pro_secret_key_change_in_production

# Admin inicial
ADMIN_EMAIL=admin@check.com
ADMIN_PASSWORD=admin123

# URL de la aplicación
APP_URL=http://localhost:3000

# Dominios permitidos para CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${vapidPrivateKey}
VAPID_SUBJECT=mailto:admin@check.com
`;
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Archivo .env creado con configuración básica');
    }
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
    
    // Verificar si hay usuarios
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    
    if (userCount.count === 0) {
        console.log('👤 Creando usuario admin por defecto...');
        const adminId = uuidv4();
        const adminHash = bcrypt.hashSync('admin123', 10);
        
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(adminId, 'admin@check.com', adminHash, 'ADMIN', 'APPROVED', new Date().toISOString());
        
        console.log('✅ Usuario admin creado: admin@check.com / admin123');
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
    console.log('👤 Usuario: admin@check.com');
    console.log('🔑 Contraseña: admin123');
    console.log('\nPresiona Ctrl+C para detener el servidor');
    
} catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
}