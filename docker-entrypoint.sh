#!/bin/bash
# Docker Entrypoint Script para Check Pro
# Este script se ejecuta al iniciar el contenedor Docker

set -e

echo "🚀 Iniciando Check Pro en contenedor Docker..."
echo "=============================================="

# 0. Automatización de Persistencia Externa (v12.44.314)
if [ ! -z "$DATA_PATH" ]; then
    echo "📂 Configurando persistencia externa en: $DATA_PATH"
    if [ ! -d "$DATA_PATH" ]; then
        echo "📁 Creando directorio de persistencia..."
        mkdir -p "$DATA_PATH"
    fi
    # Asegurar que subcarpetas existen
    mkdir -p "$DATA_PATH/events"
    mkdir -p "$DATA_PATH/uploads"
    
    # Intentar ajustar permisos para que el código pueda escribir
    chmod -R 777 "$DATA_PATH" || echo "⚠️ No se pudo cambiar permisos, continuando..."
    echo "✅ Directorio de persistencia listo"
fi

# 1. Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
else
    echo "✅ Dependencias ya instaladas"
fi

# 2. Verificar archivo .env
if [ ! -f ".env" ]; then
    echo "📝 Creando archivo .env desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado"
    else
        echo "⚠️  Advertencia: No se encontró .env.example"
    fi
else
    echo "✅ Archivo .env ya existe"
fi

# 3. Crear directorio data si no existe (fallback local)
if [ ! -d "data" ]; then
    echo "📁 Creando directorio data local..."
    mkdir -p data
fi

# 4. Inicializar base de datos y crear usuario admin
echo "🗄️  Inicializando base de datos..."
node -e "
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

try {
    const basePath = process.env.DATA_PATH || path.resolve(__dirname, 'data');
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
    
    const dbPath = path.resolve(basePath, 'check_app.db');
    const db = new Database(dbPath);
    
    // Activar WAL mode
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Crear tabla de usuarios si no existe
    db.exec(\`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'PRODUCTOR',
        role_detail TEXT DEFAULT 'STAFF',
        group_id TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TEXT
    )\`);
    
    // Verificar si hay usuarios
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (userCount.count === 0) {
        console.log('👤 Creando usuario admin por defecto...');
        const adminId = uuidv4();
        const adminHash = bcrypt.hashSync('admin123', 10);
        
        db.prepare('INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(adminId, 'admin@check.com', adminHash, 'ADMIN', 'APPROVED', new Date().toISOString());
        
        console.log('✅ Usuario admin creado: admin@check.com / admin123');
    } else {
        console.log('✅ Base de datos ya tiene usuarios');
    }
    
    // Crear otras tablas esenciales
    console.log('📊 Verificando tablas esenciales...');
    
    // Tabla de eventos
    db.exec(\`CREATE TABLE IF NOT EXISTS events (
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
    )\`);
    
    // Tabla de invitados
    db.exec(\`CREATE TABLE IF NOT EXISTS guests (
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
    )\`);
    
    // Tabla de configuración SMTP
    db.exec(\`CREATE TABLE IF NOT EXISTS smtp_config (
        id INTEGER PRIMARY KEY,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        smtp_secure INTEGER,
        from_name TEXT,
        from_email TEXT
    )\`);
    
    // Verificar si hay configuración SMTP
    const smtpCount = db.prepare('SELECT COUNT(*) as count FROM smtp_config').get();
    if (smtpCount.count === 0) {
        db.prepare('INSERT INTO smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_secure, from_name) VALUES (1, \\'\\', 587, \\'\\', 0, \\'Check Attendance\\')').run();
        console.log('✅ Configuración SMTP inicial creada');
    }
    
    db.close();
    console.log('✅ Base de datos inicializada correctamente');
    
} catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    process.exit(1);
}
"

# 5. Iniciar el servidor
echo ""
echo "🚀 Iniciando servidor Check Pro..."
echo "=================================="
echo "🌐 URL: http://localhost:3000"
echo "👤 Usuario: admin@check.com"
echo "🔑 Contraseña: admin123"
echo "=================================="

exec npm start