// database.js — better-sqlite3 V10 (Síncrono, moderno, sin callbacks)
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'data/check_app.db');
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
try { db.exec("ALTER TABLE events ADD COLUMN has_wheel INTEGER DEFAULT 0"); } catch (_) {}

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
// Campos Fase 8: Personalización de Tickets y QR
try { db.exec("ALTER TABLE events ADD COLUMN qr_color_dark TEXT DEFAULT '#000000'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN qr_color_light TEXT DEFAULT '#ffffff'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN qr_logo_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN ticket_bg_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN ticket_accent_color TEXT DEFAULT '#7c3aed'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_email_whitelist TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_email_blacklist TEXT"); } catch (_) {}

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
try { db.exec("ALTER TABLE guests ADD COLUMN is_new_registration INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN qr_token TEXT"); } catch (_) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)"); } catch (_) {}

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
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN gender TEXT DEFAULT 'O'"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN dietary_notes TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN position TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN organization TEXT"); } catch (_) {}

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
try { db.exec("ALTER TABLE event_email_config ADD COLUMN subject_prefix TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_email_config ADD COLUMN template_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_email_config ADD COLUMN send_confirmation INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE event_email_config ADD COLUMN send_reminder INTEGER DEFAULT 0"); } catch (_) {}

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
try { db.exec("ALTER TABLE event_agenda ADD COLUMN duration TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_agenda ADD COLUMN created_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_agenda ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch (_) {}

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

// ═══ TABLAS DE RULETA (V12) ═══
db.exec(`CREATE TABLE IF NOT EXISTS event_wheels (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    config TEXT, -- JSON config
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_participants (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    guest_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'manual', -- manual, guests, leads
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_spins (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    participant_id TEXT,
    winner_name TEXT,
    winner_email TEXT,
    ip_address TEXT,
    created_at TEXT,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_leads (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source_url TEXT,
    created_at TEXT,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

// Semilla de textos legales (V12.1.1 - Profesional)
const POLICY_TEXT = `<div class="legal-content space-y-4">
    <h2 class="text-xl font-bold text-white border-b border-primary/30 pb-2">POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES</h2>
    <p class="text-sm text-slate-300">En **Check App**, la privacidad y seguridad de su información es nuestra prioridad. Esta política describe cómo recolectamos, usamos y protegemos sus datos bajo los principios de legalidad, finalidad y transparencia.</p>

    <h3 class="text-md font-bold text-primary">1. Responsable del Tratamiento</h3>
    <p class="text-xs text-slate-400">El responsable del tratamiento de sus datos es el Organizador del Evento al cual usted se registra, utilizando la plataforma Check App como medio tecnológico de gestión.</p>

    <h3 class="text-md font-bold text-primary">2. Finalidad de la Recolección</h3>
    <ul class="list-disc ml-6 text-xs text-slate-400 space-y-1">
        <li>Gestión de registro y acreditación para el evento.</li>
        <li>Envío de confirmaciones, códigos QR y comunicaciones logísticas.</li>
        <li>Generación de estadísticas agregadas para el organizador.</li>
        <li>Gestión de requerimientos especiales (dietas, alergias) para su seguridad.</li>
    </ul>

    <h3 class="text-md font-bold text-primary">3. Derechos del Titular</h3>
    <p class="text-xs text-slate-400">Usted tiene derecho a conocer, actualizar y rectificar sus datos personales, así como a solicitar su supresión cuando no exista un deber legal de conservarlos.</p>

    <h3 class="text-md font-bold text-primary">4. Seguridad</h3>
    <p class="text-xs text-slate-400">Implementamos medidas técnicas y administrativas para evitar el acceso no autorizado o alteración de su información personal.</p>
</div>`;

const TERMS_TEXT = `<div class="legal-content space-y-4">
    <h2 class="text-xl font-bold text-white border-b border-primary/30 pb-2">TÉRMINOS Y CONDICIONES DE SERVICIO</h2>
    <p class="text-sm text-slate-300">El acceso y uso de la plataforma Check App implica la aceptación total de los presentes términos por parte del usuario y el organizador.</p>

    <h3 class="text-md font-bold text-primary">1. Uso del Servicio</h3>
    <p class="text-xs text-slate-400">Check App es una plataforma de gestión de asistencia. El usuario se compromete a proporcionar información veraz durante el proceso de registro.</p>

    <h3 class="text-md font-bold text-primary">2. Responsabilidad del Organizador</h3>
    <p class="text-xs text-slate-400">El Organizador es el único responsable del uso de la información de los invitados, de la logística del evento y del cumplimiento normativo en el recinto.</p>

    <h3 class="text-md font-bold text-primary">3. Propiedad Intelectual</h3>
    <p class="text-xs text-slate-400">Todos los derechos sobre el software, diseño y marcas de Check App son propiedad exclusiva del desarrollador.</p>

    <h3 class="text-md font-bold text-primary">4. Limitación de Responsabilidad</h3>
    <p class="text-xs text-slate-400">Check App no se hace responsable por interrupciones del servicio derivadas de fallos en proveedores de red o causas de fuerza mayor.</p>
</div>`;

db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('policy_data', POLICY_TEXT);
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('terms_conditions', TERMS_TEXT);

// Actualizar si ya existían con el texto provisional (Fuerza actualización v12.1.1)
db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ? AND setting_value LIKE '%Texto provisional%'").run(POLICY_TEXT, 'policy_data');
db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ? AND setting_value LIKE '%Texto provisional%'").run(TERMS_TEXT, 'terms_conditions');

// 7.1 Configuración de Visibilidad (V12.2.1)
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('show_legal_login', '1');

// 7.2 Configuración de IA (V12.3.1)
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_enabled', '1');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_openrouter_key', '');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_model', 'google/gemini-2.0-flash-lite-preview-02-05:free');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_system_prompt', 'Eres un asistente experto en gestión de eventos para la plataforma Check Pro. Ayudas a redactar correos, analizar datos de invitados y responder dudas logísticas.');

// 8. Logs de Auditoría (V10)
db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    details TEXT,
    created_at TEXT
)`);

// 8b. Auditoría Estructurada (V12.3 - Seguridad)
db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)"); } catch (_) {}

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

// 12b. Cuentas de Email Adicionales (Múltiples cuentas SMTP)
db.exec(`CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT NOT NULL,
    smtp_pass TEXT NOT NULL,
    smtp_secure INTEGER DEFAULT 0,
    from_name TEXT,
    from_email TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 500,
    used_today INTEGER DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT,
    updated_at TEXT
)`);

// 12c. Configuración IMAP Global
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

// 16B. Campañas de Email (Campaigns)
db.exec(`CREATE TABLE IF NOT EXISTS email_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    event_id TEXT,
    template_id TEXT,
    subject TEXT,
    body_html TEXT,
    filters TEXT, -- JSON: {organizations: [], gender: [], checked_in: null, search: ''}
    status TEXT DEFAULT 'DRAFT', -- DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    scheduled_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (template_id) REFERENCES email_templates(id)
)`);

// 16C. Tracking de Emails por Campaña
db.exec(`CREATE TABLE IF NOT EXISTS email_campaign_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    guest_id TEXT,
    to_email TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, ERROR, BOUNCED
    sent_at TEXT,
    error_message TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// Índices para campañas
db.exec("CREATE INDEX IF NOT EXISTS idx_email_campaigns_event ON email_campaigns(event_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status)");
db.exec("CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_campaign ON email_campaign_logs(campaign_id)");

// 16D. Tracking de Aperturas (Pixel Tracking)
db.exec(`CREATE TABLE IF NOT EXISTS email_tracking_opens (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    guest_id TEXT,
    to_email TEXT NOT NULL,
    message_id TEXT,
    opened_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// 16E. Tracking de Clicks
db.exec(`CREATE TABLE IF NOT EXISTS email_tracking_clicks (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    guest_id TEXT,
    to_email TEXT NOT NULL,
    message_id TEXT,
    original_url TEXT NOT NULL,
    clicked_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// Índices para tracking
db.exec("CREATE INDEX IF NOT EXISTS idx_tracking_opens_campaign ON email_tracking_opens(campaign_id, opened_at)");
db.exec("CREATE INDEX IF NOT EXISTS idx_tracking_clicks_campaign ON email_tracking_clicks(campaign_id, clicked_at)");
db.exec("CREATE INDEX IF NOT EXISTS idx_tracking_opens_email ON email_tracking_opens(to_email)");
db.exec("CREATE INDEX IF NOT EXISTS idx_tracking_clicks_email ON email_tracking_clicks(to_email)");

// 17. Webhooks para integraciones externas (Slack, Discord, etc)
db.exec(`CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- HMAC signing secret
    events TEXT NOT NULL, -- JSON array: ["guest.created", "guest.checked_in", "guest.updated", "event.created", "event.updated"]
    headers TEXT, -- JSON object for custom headers
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// Migraciones para invitados (Bajas/Unsubscribe)
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT"); } catch (_) {}

// 18. Suscripciones para notificaciones push (Web Push API)
db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 19. Resultados guardados de sorteos (Ruleta V12.26.0)
db.exec(`CREATE TABLE IF NOT EXISTS wheel_results (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    winners_json TEXT NOT NULL DEFAULT '[]',
    total_participants INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id) ON DELETE CASCADE
)`);

// Índices para wheel_results
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wheel_results_wheel ON wheel_results(wheel_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wheel_results_created ON wheel_results(created_at DESC)"); } catch (_) {}

// Semillas de plantillas de email por defecto
// Semillas de plantillas de email por defecto (Sistema)
const templateCount = db.prepare("SELECT COUNT(*) as count FROM email_templates WHERE event_id IS NULL").get();
if (templateCount.count <= 2) { // Si hay pocos o faltan las nuevas, forzamos actualización de estilo
    const templates = [
        {
            id: 'user_approved',
            name: 'Aprobación de Cuenta',
            subject: '¡Tu cuenta ha sido aprobada! - Check Pro',
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">¡Cuenta Aprobada!</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{user_name}}</strong>, nos complace informarte que tu solicitud de acceso a <strong>Check Pro</strong> ha sido aprobada exitosamente.</p>
            <div style="background: rgba(124, 58, 237, 0.05); border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid rgba(124, 58, 237, 0.1);">
                <p style="margin: 5px 0; color: inherit;"><strong>Usuario:</strong> {{email}}</p>
                <p style="margin: 5px 0; color: inherit;"><strong>Contraseña:</strong> {{password}}</p>
                <p style="margin: 5px 0; color: inherit;"><strong>Rol:</strong> {{role}}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{login_url}}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);">Entrar a Check Pro</a>
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
            </div>
        </div>
    </div>
</div>`
        },
        {
            id: 'user_invited',
            name: 'Invitación a Equipo',
            subject: 'Has sido invitado a {{company_name}} en Check Pro',
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">Invitación de Equipo</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{user_name}}</strong>, has sido invitado(a) a formar parte de <strong>{{company_name}}</strong>.</p>
            <div style="background: rgba(124, 58, 237, 0.05); border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="margin: 5px 0; color: inherit; font-size: 18px;"><strong>Rol asignado:</strong> {{role}}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{login_url}}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);">Aceptar Invitación</a>
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
            </div>
        </div>
    </div>
</div>`
        },
        {
            id: 'password_reset',
            name: 'Recuperación de Contraseña',
            subject: 'Restablece tu contraseña - Check Pro',
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">Recuperar Acceso</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{user_name}}</strong>, recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
            <div style="background: rgba(124, 58, 237, 0.08); border: 2px dashed #7c3aed; border-radius: 16px; padding: 30px; margin: 25px 0; text-align: center;">
                <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: inherit;">{{reset_code}}</span>
            </div>
            <p style="text-align: center; color: inherit; opacity: 0.6; font-size: 14px;">El código expira en 30 minutos.</p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{reset_url}}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700;">Restablecer mi Contraseña</a>
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">Si no solicitaste este cambio, ignora este mensaje.</p>
            </div>
        </div>
    </div>
</div>`
        }
    ];

    templates.forEach(t => {
        db.prepare("INSERT OR REPLACE INTO email_templates (id, name, subject, body, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(t.id, t.name, t.subject, t.body, new Date().toISOString());
    });
}

// ═══ SEMILLA DE ADMIN POR DEFECTO ═══
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (userCount.count === 0) {
    const adminId = uuidv4();
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(adminId, 'admin@check.com', adminHash, 'ADMIN', 'APPROVED', new Date().toISOString());
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
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">¡Registro Confirmado!</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{guest_name}}</strong>, tu registro para el evento ha sido procesado con éxito.</p>
            <div style="background: rgba(124, 58, 237, 0.05); border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid rgba(124, 58, 237, 0.1);">
                <p style="margin: 5px 0; color: inherit; font-size: 18px; text-align: center;"><strong>{{event_name}}</strong></p>
                <div style="margin-top: 15px; border-top: 1px solid rgba(124, 58, 237, 0.1); padding-top: 15px;">
                    <p style="margin: 5px 0; color: inherit;"><strong>📅 Fecha:</strong> {{event_date}}</p>
                    <p style="margin: 5px 0; color: inherit;"><strong>📍 Ubicación:</strong> {{event_location}}</p>
                </div>
            </div>
            <p style="line-height: 1.6; font-size: 16px; color: inherit; text-align: center;">Estamos ansiosos de contar con tu presencia.</p>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">Atentamente,<br><strong>El Equipo de Check Pro</strong></p>
                <p style="font-size: 11px; opacity: 0.4; margin-top: 10px;">Power By <a href="https://smarteventos.co" style="color: #7c3aed; text-decoration: none;">Smart Eventos</a></p>
            </div>
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
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">¡Bienvenido(a)!</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{guest_name}}</strong>, agradecemos tu puntualidad. Tu ingreso a <strong>{{event_name}}</strong> ha sido registrado.</p>
            <h3 style="color: #7c3aed; font-size: 18px; margin-top: 30px; border-bottom: 2px solid #7c3aed; padding-bottom: 5px; display: inline-block;">📋 Agenda del Día</h3>
            <div style="margin: 20px 0; color: inherit; line-height: 1.8; background: rgba(0,0,0,0.02); padding: 20px; border-radius: 12px;">
                {{agenda}}
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">Esperamos que disfrutes de la experiencia.</p>
                <p style="font-size: 11px; opacity: 0.4; margin-top: 10px;">Power By <a href="https://smarteventos.co" style="color: #7c3aed; text-decoration: none;">Smart Eventos</a></p>
            </div>
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
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">¡Gracias!</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{guest_name}}</strong>, ha sido un honor contar con tu presencia en <strong>{{event_name}}</strong>.</p>
            <p style="line-height: 1.6; font-size: 16px; color: inherit; margin-top: 15px;">Esperamos que los contenidos y conexiones te resulten de gran valor para tu futuro profesional.</p>
            <div style="text-align: center; margin-top: 30px;">
                <span style="font-size: 40px;">🌟</span>
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">¡Nos vemos pronto!</p>
                <p style="font-size: 11px; opacity: 0.4; margin-top: 10px;">Power By <a href="https://smarteventos.co" style="color: #7c3aed; text-decoration: none;">Smart Eventos</a></p>
            </div>
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
            body: `<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">Danos tu Opinión</h1>
        </div>
        <div style="padding: 40px;">
            <p style="line-height: 1.6; font-size: 16px; color: inherit;">Hola <strong>{{guest_name}}</strong>, nos encantaría saber qué te pareció <strong>{{event_name}}</strong> para seguir mejorando la experiencia.</p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{suggestion_url}}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.2);">Enviar Sugerencia</a>
            </div>
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin: 0;">¡Gracias por tu tiempo!</p>
                <p style="font-size: 11px; opacity: 0.4; margin-top: 10px;">Power By <a href="https://smarteventos.co" style="color: #7c3aed; text-decoration: none;">Smart Eventos</a></p>
            </div>
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

// ═══ ÍNDICES ADICIONALES (Performance V12.3) ═══
const additionalIndices = [
    // Guests - queries frecuentes
    "CREATE INDEX IF NOT EXISTS idx_guests_event_name ON guests(event_id, name COLLATE NOCASE)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_email ON guests(event_id, email COLLATE NOCASE)",
    "CREATE INDEX IF NOT EXISTS idx_guests_checkin ON guests(event_id, checked_in)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_newreg ON guests(event_id, is_new_registration)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_unsub ON guests(event_id, unsubscribed)",
    
    // Email queue - procesamiento
    "CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS idx_email_queue_event ON email_queue(event_id, status)",
    
    // Email logs - consultas paginadas
    "CREATE INDEX IF NOT EXISTS idx_email_logs_event_type ON email_logs(event_id, type, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC)",
    
    // Events - búsqueda por grupo y fecha
    "CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_events_group_created ON events(group_id, created_at DESC)",
    
    // Users - búsqueda por grupo y nombre
    "CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_users_group_name ON users(group_id, display_name COLLATE NOCASE, username COLLATE NOCASE)",
    
    // Pre-registrations - por evento, estado y fecha
    "CREATE INDEX IF NOT EXISTS idx_prereg_event_status ON pre_registrations(event_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_prereg_event_status_registered ON pre_registrations(event_id, status, registered_at DESC)",
    
    // Guest suggestions - por evento y fecha
    "CREATE INDEX IF NOT EXISTS idx_guest_suggestions_event_submitted ON guest_suggestions(event_id, submitted_at DESC)",
    
    // Event agenda - por evento y horario
    "CREATE INDEX IF NOT EXISTS idx_event_agenda_event_start ON event_agenda(event_id, start_time)",
    
    // Surveys - por evento
    "CREATE INDEX IF NOT EXISTS idx_surveys_event ON surveys(event_id)",
    
    // Survey responses - por evento
    "CREATE INDEX IF NOT EXISTS idx_survey_responses_event ON survey_responses(event_id)",
    
    // Password resets - por código y usuario
    "CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(code, expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, expires_at)",
    
    // Audit logs - por usuario y fecha
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC)",
    
    // Webhooks - por evento y estado
    "CREATE INDEX IF NOT EXISTS idx_webhooks_event_status ON webhooks(event_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status)",
];

for (const sql of additionalIndices) {
    try { db.exec(sql); } catch (_) {}
}

// Exportar función para usar en server.js
module.exports = { db, createEventEmailTemplates };
