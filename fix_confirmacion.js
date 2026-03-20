const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const premiumStyle = (title, content, actionText, actionUrl) => `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc !important; margin: 0; text-shadow: none !important;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); text-shadow: none !important;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff !important; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-shadow: none !important;">${title}</h1>
        </div>
        <div style="padding: 40px;">
            <div style="color: #94a3b8 !important; line-height: 1.8; font-size: 16px; text-shadow: none !important;">
                ${content}
            </div>
            ${actionText ? `
            <div style="margin-top: 40px; text-align: center;">
                <a href="${actionUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3); text-shadow: none !important;">${actionText}</a>
            </div>` : ''}
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
                <p style="color: #64748b !important; font-size: 13px; margin: 0; text-shadow: none !important;">
                    Atentamente,<br>
                    <strong style="color: #f8fafc !important; font-size: 15px; text-shadow: none !important;">El Equipo de Check Pro</strong>
                </p>
                <div style="margin-top: 20px; opacity: 0.5;">
                    <img src="https://check-app.com/logo.png" alt="Check Pro" style="height: 30px;">
                </div>
            </div>
        </div>
    </div>
</div>`;

const body = premiumStyle(
    '¡Registro Exitoso!',
    `<p style="color: #94a3b8 !important;">Hola <strong style="color: #f8fafc !important;">{{guest_name}}</strong>,</p>
    <p style="color: #94a3b8 !important;">Es un placer confirmarte que tu lugar en <strong style="color: #f8fafc !important;">{{event_name}}</strong> está asegurado.</p>
    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 25px; margin: 30px 0; border: 1px solid rgba(255,255,255,0.05);">
        <p style="margin: 0 0 10px 0; color: #f8fafc !important;"><strong style="color: #f8fafc !important;">Evento:</strong> {{event_name}}</p>
        <p style="margin: 0 0 10px 0; color: #f8fafc !important;"><strong style="color: #f8fafc !important;">Fecha:</strong> {{event_date}}</p>
        <p style="margin: 0; color: #f8fafc !important;"><strong style="color: #f8fafc !important;">Ubicación:</strong> {{event_location}}</p>
    </div>
    <p style="color: #94a3b8 !important;">Hemos adjuntado los detalles necesarios para tu participación. ¡Nos vemos pronto!</p>`,
    'Descargar Invitación',
    '{{login_url}}'
);

const stmt = db.prepare("UPDATE email_templates SET body = ?, updated_at = ? WHERE name = ?");
stmt.run(body, new Date().toISOString(), '[Modelo] Confirmación de Registro');

db.close();
console.log("Template updated with !important and text-shadow: none.");
