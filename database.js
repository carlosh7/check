// database.js — better-sqlite3 V10 (Síncrono, moderno, sin callbacks)
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new Database(dbPath);

// Activar WAL mode para mejor rendimiento concurrente
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ═══ CREACIÓN DE TABLAS (Ejecución síncrona directa) ═══

// 1. Usuarios (RBAC)
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

// Migración segura: agregar columna status si no existe (para DBs antiguas)
try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'PENDING'"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN role_detail TEXT DEFAULT 'STAFF'"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN group_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch (_) {}

// 2. Eventos (Multitenancy)
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
try { db.exec("ALTER TABLE events ADD COLUMN created_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN end_date TEXT"); } catch (_) {}

// Campos de personalización de registro público
try { db.exec("ALTER TABLE events ADD COLUMN reg_title TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_welcome_text TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_policy TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_success_message TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_logo_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_phone INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_org INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_position INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_vegan INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_dietary INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_gender INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_require_agreement INTEGER DEFAULT 1"); } catch (_) {}

// 3. Invitados
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

// 3.1 Pre-Registros (Inscripción previa)
db.exec(`CREATE TABLE IF NOT EXISTS pre_registrations (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    organization TEXT,
    position TEXT,
    gender TEXT DEFAULT 'O',
    dietary_notes TEXT,
    status TEXT DEFAULT 'PENDING',
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);

// 4. Configuración de Mailing
db.exec(`CREATE TABLE IF NOT EXISTS event_mailing_config (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    welcome_subject TEXT,
    welcome_body TEXT,
    survey_subject TEXT,
    survey_body TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);

// 5. Encuestas
db.exec(`CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    question TEXT,
    type TEXT DEFAULT 'stars',
    options TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);

// 6. Respuestas de Encuestas
db.exec(`CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    guest_id TEXT,
    responses_json TEXT,
    submitted_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (guest_id) REFERENCES guests (id)
)`);

// 7. Configuración Global (Legales V10)
db.exec(`CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT
)`);

// Semilla de textos legales
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`)
  .run('policy_data', '<h2>Política de Tratamiento de Datos</h2><p>Texto provisional. El administrador debe actualizar esto.</p>');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`)
  .run('terms_conditions', '<h2>Términos y Condiciones</h2><p>Texto provisional. El administrador debe actualizar esto.</p>');

// 8. Logs de Auditoría (V10)
db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    details TEXT,
    created_at TEXT
)`);

// ═══ NUEVAS TABLAS V10.5.3: GRUPOS Y PERMISOS JERÁRQUICOS ═══

// 9. Grupos (cada grupo tiene su propio Producer(es))
db.exec(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT,
    created_by TEXT
)`);

// Migraciones para grupos
try { db.exec("ALTER TABLE groups ADD COLUMN email TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE groups ADD COLUMN phone TEXT"); } catch (_) {}

// Migraciones para users
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}

// 10. Relación Grupo-Usuario (muchos a muchos) - Productores del grupo
db.exec(`CREATE TABLE IF NOT EXISTS group_users (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_in_group TEXT DEFAULT 'PRODUCTOR',
    created_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(group_id, user_id)
)`);

// 11. Relación Usuario-Evento (muchos a muchos) - Staff/Cliente en eventos
db.exec(`CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE(user_id, event_id)
)`);

// Migraciones: agregar group_id a tablas existentes si no existen
try { db.exec("ALTER TABLE users ADD COLUMN group_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN group_id TEXT"); } catch (_) {}

// ═══ SMTP GLOBAL Y PLANTILLAS DE EMAIL ═══

// 12. Configuración SMTP Global
db.exec(`CREATE TABLE IF NOT EXISTS smtp_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_secure INTEGER DEFAULT 0,
    from_name TEXT DEFAULT 'Check Attendance',
    from_email TEXT,
    updated_at TEXT
)`);

// 14. Códigos de recuperación de contraseña
db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// 13. Plantillas de Email
db.exec(`CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT
)`);

// Semillas de plantillas de email por defecto
const templateCount = db.prepare("SELECT COUNT(*) as count FROM email_templates").get();
if (templateCount.count === 0) {
    const templates = [
        {
            id: 'user_approved',
            name: 'Aprobación de Cuenta',
            subject: '¡Bienvenido a Check! Tu cuenta ha sido aprobada',
            body: `<h2>¡Bienvenido {{user_name}}!</h2>
<p>Tu cuenta ha sido aprobada. Aquí están tus credenciales de acceso:</p>
<ul>
<li><strong>Email:</strong> {{email}}</li>
<li><strong>Contraseña temporal:</strong> {{password}}</li>
<li><strong>Rol:</strong> {{role}}</li>
</ul>
<p>Por favor, inicia sesión y cambia tu contraseña inmediatamente.</p>
<p><a href="{{login_url}}" style="background:#7c3aed;color:white;padding:10px 20px;text-decoration:none;border-radius:8px;">Ir a Check</a></p>`
        },
        {
            id: 'user_invited',
            name: 'Invitación a Usuario',
            subject: 'Has sido agregado a {{company_name}}',
            body: `<h2>¡Hola {{user_name}}!</h2>
<p>Has sido agregado(a) a <strong>{{company_name}}</strong> en la plataforma Check.</p>
<ul>
<li><strong>Tu rol:</strong> {{role}}</li>
</ul>
<p>Inicia sesión para comenzar:</p>
<p><a href="{{login_url}}" style="background:#7c3aed;color:white;padding:10px 20px;text-decoration:none;border-radius:8px;">Ir a Check</a></p>`
        },
        {
            id: 'password_reset',
            name: 'Recuperación de Contraseña',
            subject: 'Restablece tu contraseña - Check',
            body: `<h2>Restablecer Contraseña</h2>
<p>Hola {{user_name}},</p>
<p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código o haz clic en el enlace:</p>
<p><strong>Código de verificación:</strong> {{reset_code}}</p>
<p><a href="{{reset_url}}" style="background:#7c3aed;color:white;padding:10px 20px;text-decoration:none;border-radius:8px;">Restablecer Contraseña</a></p>
<p>Si no solicitaste este cambio, ignora este email.</p>`
        }
    ];
    
    const insertTemplate = db.prepare("INSERT INTO email_templates (id, name, subject, body, updated_at) VALUES (?, ?, ?, ?, ?)");
    templates.forEach(t => {
        insertTemplate.run(t.id, t.name, t.subject, t.body, new Date().toISOString());
    });
}

// ═══ SEMILLA DE ADMIN POR DEFECTO ═══
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (userCount.count === 0) {
    const adminId = uuidv4();
    db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(adminId, 'admin@check.com', 'admin123', 'ADMIN', 'APPROVED', new Date().toISOString());
    console.log("✓ Admin por defecto creado: admin@check.com / admin123");
}

// Semilla de SMTP config si no existe
const smtpCount = db.prepare("SELECT COUNT(*) as count FROM smtp_config").get();
if (smtpCount.count === 0) {
    db.prepare("INSERT INTO smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_secure, from_name) VALUES (1, '', 587, '', 0, 'Check Attendance')").run();
}

console.log("✓ better-sqlite3 V10: Base de datos inicializada correctamente.");
module.exports = db;
