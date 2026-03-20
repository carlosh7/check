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

// 4. Configuración de Mailing por Evento
db.exec(`CREATE TABLE IF NOT EXISTS event_email_config (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_secure INTEGER DEFAULT 0,
    from_name TEXT,
    from_email TEXT,
    enabled INTEGER DEFAULT 0,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// 5. Plantillas de Email por Evento
db.exec(`CREATE TABLE IF NOT EXISTS event_email_templates (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    template_type TEXT NOT NULL,
    name TEXT,
    subject TEXT,
    body TEXT,
    is_active INTEGER DEFAULT 1,
    auto_send INTEGER DEFAULT 0,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE(event_id, template_type)
)`);

// 6. Sugerencias de Invitados
db.exec(`CREATE TABLE IF NOT EXISTS guest_suggestions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    guest_id TEXT,
    suggestion TEXT,
    submitted_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// 7. Agenda del Evento
db.exec(`CREATE TABLE IF NOT EXISTS event_agenda (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    speaker TEXT,
    location TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// 8. Encuestas (legacy - mantener para compatibilidad)
db.exec(`CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    question TEXT,
    type TEXT DEFAULT 'stars',
    options TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// 9. Respuestas de Encuestas
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

// 12b. Configuración IMAP Global
db.exec(`CREATE TABLE IF NOT EXISTS imap_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_user TEXT,
    imap_pass TEXT,
    imap_tls INTEGER DEFAULT 1,
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

db.exec(`CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    is_active INTEGER DEFAULT 1,
    event_id TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);
try { db.exec("ALTER TABLE email_templates ADD COLUMN event_id TEXT"); } catch (_) {}

// ═══ FASE 4: BUZÓN Y ENVÍO MASIVO (V11.0) ═══

// 15. Logs de Email (Buzón)
db.exec(`CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    event_id TEXT,
    type TEXT DEFAULT 'INBOX', -- INBOX, SENT, TRASH, ARCHIVE
    subject TEXT,
    from_email TEXT,
    to_email TEXT,
    body_html TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// 16. Cola de Envío Masivo
db.exec(`CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    guest_id TEXT,
    to_email TEXT,
    subject TEXT,
    body_html TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENDING, SENT, ERROR, PAUSED
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    scheduled_at TEXT,
    processed_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// Migraciones para invitados (Bajas/Unsubscribe)
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT"); } catch (_) {}

// Semillas de plantillas de email por defecto
const templateCount = db.prepare("SELECT COUNT(*) as count FROM email_templates").get();
if (templateCount.count === 0) {
    const templates = [
        {
            id: 'user_approved',
            name: 'Aprobación de Cuenta',
            subject: '¡Bienvenido a Check! Tu cuenta ha sido aprobada',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">¡Cuenta Aprobada!</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{user_name}}, nos complace informarte que tu cuenta en <strong>Check Pro</strong> ha sido aprobada exitosamente.</p>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">A continuación encontrarás tus credenciales de acceso:</p>
        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid rgba(255,255,255,0.05);">
            <p style="margin: 5px 0; color: #f8fafc;"><strong>Email:</strong> {{email}}</p>
            <p style="margin: 5px 0; color: #f8fafc;"><strong>Contraseña temporal:</strong> {{password}}</p>
            <p style="margin: 5px 0; color: #f8fafc;"><strong>Rol asignado:</strong> {{role}}</p>
        </div>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center;">Por favor, inicia sesión y cambia tu contraseña por seguridad.</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{login_url}}" style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">Acceder a la Plataforma</a>
        </div>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`
        },
        {
            id: 'user_invited',
            name: 'Invitación a Usuario',
            subject: 'Has sido invitado a unirte a {{company_name}} en Check',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">Invitación de Equipo</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{user_name}}, has sido invitado(a) a formar parte de <strong>{{company_name}}</strong> en la plataforma Check Pro.</p>
        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid rgba(255,255,255,0.05);">
            <p style="margin: 5px 0; color: #f8fafc; text-align: center;"><strong>Tu rol asignado:</strong> {{role}}</p>
        </div>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center;">Ya puedes acceder para comenzar a colaborar con tu equipo.</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{login_url}}" style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">Entrar a Check Pro</a>
        </div>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`
        },
        {
            id: 'password_reset',
            name: 'Recuperación de Contraseña',
            subject: 'Restablece tu contraseña - Check Pro',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">Restablecer Contraseña</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{user_name}}, hemos recibido una solicitud para restablecer la contraseña de tu cuenta conforme a los protocolos de seguridad de Check Pro.</p>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Usa el siguiente código de verificación para continuar:</p>
        <div style="background: rgba(124, 58, 237, 0.1); border: 2px dashed #7c3aed; border-radius: 12px; padding: 15px; margin: 25px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #f8fafc;">{{reset_code}}</span>
        </div>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 14px; text-align: center;">También puedes hacer clic en el botón de abajo para ser redirigido directamente:</p>
        <div style="text-align: center; margin-top: 20px;">
            <a href="{{reset_url}}" style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">Restablecer mi Contraseña</a>
        </div>
        <p style="color: #64748b; line-height: 1.6; font-size: 13px; margin-top: 30px;">Si no solicitaste este cambio, por favor ignora este mensaje o contacta con el administrador de tu grupo por seguridad.</p>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`
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

// Semilla de IMAP config si no existe
const imapCount = db.prepare("SELECT COUNT(*) as count FROM imap_config").get();
if (imapCount.count === 0) {
    db.prepare("INSERT INTO imap_config (id, imap_host, imap_port, imap_tls) VALUES (1, '', 993, 1)").run();
}

// Función para crear plantillas por defecto para un evento
function createEventEmailTemplates(eventId) {
    const eventTemplates = [
        {
            id: uuidv4(),
            template_type: 'registration_confirm',
            name: 'Confirmación de registro',
            subject: '¡Registro exitoso! - {{event_name}}',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">Confirmación de Registro</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{guest_name}}, tu registro para el evento <strong>{{event_name}}</strong> ha sido procesado con éxito.</p>
        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid rgba(255,255,255,0.05);">
            <p style="margin: 5px 0; color: #f8fafc;"><strong>📅 Fecha:</strong> {{event_date}}</p>
            <p style="margin: 5px 0; color: #f8fafc;"><strong>📍 Ubicación:</strong> {{event_location}}</p>
        </div>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Detalles del asistente:</p>
        <ul style="color: #f8fafc; padding-left: 20px;">
            <li>Nombre: {{guest_name}}</li>
            <li>Institución: {{organization}}</li>
        </ul>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center; margin-top: 30px;">Estamos ansiosos de contar con tu presencia.</p>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`,
            is_active: 1,
            auto_send: 1
        },
        {
            id: uuidv4(),
            template_type: 'checkin_welcome',
            name: 'Bienvenida con agenda',
            subject: '¡Bienvenido! - {{event_name}}',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">¡Bienvenido al Evento!</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{guest_name}}, agradecemos tu puntualidad. Tu ingreso a <strong>{{event_name}}</strong> ha sido registrado a las {{checkin_time}}.</p>
        
        <h3 style="color: #f8fafc; font-size: 18px; margin-top: 30px; border-bottom: 1px solid #7c3aed; display: inline-block; padding-bottom: 5px;">📋 Agenda del Día</h3>
        <div style="margin-top: 15px; color: #f8fafc;">
            {{agenda}}
        </div>
        
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center; margin-top: 30px;">Esperamos que disfrutes de esta experiencia.</p>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`,
            is_active: 1,
            auto_send: 1
        },
        {
            id: uuidv4(),
            template_type: 'event_thanks',
            name: 'Agradecimiento post-evento',
            subject: '¡Gracias por asistir! - {{event_name}}',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">¡Gracias por Acompañarnos!</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{guest_name}}, ha sido un honor contar con tu presencia en <strong>{{event_name}}</strong>.</p>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Esperamos que los contenidos y las conexiones realizadas durante la jornada te resulten de gran valor personal y profesional.</p>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center; margin-top: 30px;">¡Nos vemos en nuestra próxima edición!</p>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`,
            is_active: 1,
            auto_send: 0
        },
        {
            id: uuidv4(),
            template_type: 'suggestion_request',
            name: 'Solicitud de sugerencias',
            subject: 'Tu opinión es fundamental - {{event_name}}',
            body: `<div style="font-family: sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px;">
        <h2 style="color: #f8fafc; text-align: center; font-size: 24px; margin-bottom: 20px;">Queremos Escucharte</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">Hola {{guest_name}}, tras finalizar <strong>{{event_name}}</strong>, nos gustaría conocer tu opinión para seguir mejorando la calidad de nuestros eventos.</p>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px; text-align: center;">¿Podrías dedicarnos un minuto para enviarnos tus comentarios o sugerencias?</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{suggestion_url}}" style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">Enviar mi Sugerencia</a>
        </div>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
        </div>
    </div>
</div>`,
            is_active: 1,
            auto_send: 0
        }

    ];
    
    const insert = db.prepare("INSERT OR IGNORE INTO event_email_templates (id, event_id, template_type, name, subject, body, is_active, auto_send, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    eventTemplates.forEach(t => {
        insert.run(t.id, eventId, t.template_type, t.name, t.subject, t.body, t.is_active, t.auto_send, new Date().toISOString());
    });
}

// Exportar función para usar en server.js
module.exports = { db, createEventEmailTemplates };
