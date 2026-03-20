const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const adaptiveStyle = (title, content, actionText, actionUrl) => `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; margin: 0; color: inherit; background: transparent;">
    <div style="max-width: 600px; margin: 0 auto; background: rgba(124, 58, 237, 0.03); border-radius: 24px; border: 1px solid rgba(124, 58, 237, 0.1); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">${title}</h1>
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

const updateTable = (tableName) => {
    const templates = db.prepare(`SELECT id, name FROM ${tableName}`).all();
    const stmt = db.prepare(`UPDATE ${tableName} SET body = ?, updated_at = ? WHERE id = ?`);
    
    templates.forEach(t => {
        let title = t.name.replace('[Modelo] ', '');
        let content = '';
        let actionText = 'Ver Detalles';
        
        if (t.name.includes('Recordatorio')) {
            content = `<p>Hola <strong>{{guest_name}}</strong>,</p><p>Te recordamos que tu evento <strong>{{event_name}}</strong> está por comenzar.</p>`;
        } else if (t.name.includes('Confirmación')) {
            content = `<p>Hola <strong>{{guest_name}}</strong>,</p><p>Tu registro para <strong>{{event_name}}</strong> ha sido confirmado.</p>`;
            actionText = 'Ver Invitación';
        } else if (t.name.includes('Agradecimiento') || t.name.includes('Gracias')) {
            content = `<p>Hola <strong>{{guest_name}}</strong>,</p><p>Gracias por acompañarnos en <strong>{{event_name}}</strong>. ¡Fue un gusto tenerte!</p>`;
            actionText = 'Descargar Certificado';
        } else {
            content = `<p>Hola <strong>{{guest_name}}</strong>,</p><p>Tienes una nueva notificación sobre tu cuenta o evento.</p>`;
        }
        
        const body = adaptiveStyle(title, content, actionText, '{{login_url}}');
        stmt.run(body, new Date().toISOString(), t.id);
        console.log(`Updated ${tableName}: ${t.name}`);
    });
};

updateTable('email_templates');
updateTable('event_email_templates');

db.close();
console.log("All templates updated to adaptive style.");
