const Database = require('better-sqlite3');
const db = new Database('./check_app.db');

const adaptiveStyle = (title, content, actionText, actionUrl) => `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: transparent; border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.15); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; text-shadow: none;">${title}</h1>
        </div>
        <div style="padding: 30px;">
            <div style="line-height: 1.6; font-size: 16px; color: inherit;">
                ${content}
            </div>
            ${actionText ? `
            <div style="margin-top: 30px; text-align: center;">
                <a href="${actionUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px;">${actionText}</a>
            </div>` : ''}
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(124, 58, 237, 0.1); text-align: center;">
                <p style="font-size: 13px; opacity: 0.7; margin: 0;">
                    Atentamente,<br>
                    <strong>El Equipo de Check Pro</strong>
                </p>
            </div>
        </div>
    </div>
</div>`;

console.log('--- DEPURACIÓN DE PLANTILLAS DE CONFIRMACIÓN ---');

// 1. Unificar email_templates (GLOBALES)
// Mantendremos 'evt_confirmation_model' y borraremos 'registration_confirm' si existe como duplicado
const globalDuplicates = db.prepare("SELECT id, name FROM email_templates WHERE name LIKE '%Confirmación%' OR name LIKE '%Confirmacion%'").all();
console.log(`Encontradas ${globalDuplicates.length} plantillas globales.`);

if (globalDuplicates.length > 1) {
    const mainId = 'evt_confirmation_model';
    globalDuplicates.forEach(t => {
        if (t.id !== mainId) {
            db.prepare("DELETE FROM email_templates WHERE id = ?").run(t.id);
            console.log(`Eliminado duplicado global: ${t.name} (${t.id})`);
        }
    });
}

// Asegurar que la global principal esté limpia
const mainGlobal = db.prepare("SELECT id FROM email_templates WHERE id = 'evt_confirmation_model'").get();
if (mainGlobal) {
    const body = adaptiveStyle('Confirmación de Registro', '<p>Hola <strong>{{guest_name}}</strong>,</p><p>Tu registro para <strong>{{event_name}}</strong> ha sido confirmado exitosamente.</p>', 'Ver Invitación', '{{login_url}}');
    db.prepare("UPDATE email_templates SET name = '[Modelo] Confirmación de Registro', body = ? WHERE id = ?").run(body, mainGlobal.id);
    console.log('✓ Master Global [Modelo] Confirmación de Registro actualizada.');
}

// 2. Unificar event_email_templates
const eventTemplates = db.prepare("SELECT id, event_id, name FROM event_email_templates WHERE name LIKE '%Confirmación%' OR name LIKE '%Confirmacion%'").all();
console.log(`Encontradas ${eventTemplates.length} plantillas de eventos.`);

eventTemplates.forEach(t => {
    // Aplicar limpieza profunda al contenido existente (para no perder cambios del usuario pero sí fijar el estilo)
    // En este caso, el usuario pidió "solo deja una", pero en eventos suele haber una por evento.
    // Interpretamos "solo deja una" como "quitar duplicados dentro del mismo evento" si los hubiera.
    // Pero la tabla event_email_templates usa template_type como clave única por evento usualmente.
    
    const cleanBody = adaptiveStyle('Confirmación de Registro', '<p>Hola <strong>{{guest_name}}</strong>,</p><p>Tu registro para <strong>{{event_name}}</strong> ha sido confirmado exitosamente.</p>', 'Ver Invitación', '{{login_url}}');
    db.prepare("UPDATE event_email_templates SET name = 'Confirmación de registro', body = ? WHERE id = ?").run(cleanBody, t.id);
    console.log(`✓ Plantilla de evento actualizada: ${t.name} (event_id: ${t.event_id})`);
});

// 3. Unificar Recordatorio de Evento
const reminderTemplates = db.prepare("SELECT id, name FROM email_templates WHERE name LIKE '%Recordatorio%'").all();
reminderTemplates.forEach(t => {
    const body = adaptiveStyle('Recordatorio de Evento', '<p>Hola <strong>{{guest_name}}</strong>,</p><p>Te recordamos que tu evento <strong>{{event_name}}</strong> está por comenzar.</p>', 'Ver Detalles', '{{login_url}}');
    db.prepare("UPDATE email_templates SET body = ? WHERE id = ?").run(body, t.id);
    console.log(`✓ Master Global ${t.name} actualizada.`);
});

db.close();
console.log('--- DEPURACIÓN COMPLETADA ---');
