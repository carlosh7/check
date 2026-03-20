const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const premiumStyle = (title, content, actionText, actionUrl) => `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; padding: 40px 20px; color: #f8fafc; margin: 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">${title}</h1>
        </div>
        <div style="padding: 40px;">
            <div style="color: #94a3b8; line-height: 1.8; font-size: 16px;">
                ${content}
            </div>
            ${actionText ? `
            <div style="margin-top: 40px; text-align: center;">
                <a href="${actionUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3); transition: all 0.3s ease;">${actionText}</a>
            </div>` : ''}
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
                <p style="color: #64748b; font-size: 13px; margin: 0;">
                    Atentamente,<br>
                    <strong style="color: #f8fafc; font-size: 15px;">El Equipo de Check Pro</strong>
                </p>
                <div style="margin-top: 20px; opacity: 0.5;">
                    <img src="https://check-app.com/logo.png" alt="Check Pro" style="height: 30px;">
                </div>
            </div>
        </div>
    </div>
</div>`;

const updates = [
    {
        name: '[Modelo] Recordatorio de Evento',
        subject: '⏰ Recordatorio: {{event_name}} está muy cerca',
        body: premiumStyle(
            '¡Te Esperamos!',
            `<p>Hola <strong>{{guest_name}}</strong>,</p>
            <p>Solo faltan unos días para nuestro gran encuentro en <strong>{{event_name}}</strong>. Queremos asegurarnos de que tienes todo listo para disfrutar de la experiencia al máximo.</p>
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 25px; margin: 30px 0; border: 1px solid rgba(255,255,255,0.05);">
                <p style="margin: 0 0 10px 0; color: #f8fafc;"><strong>📅 Cuándo:</strong> {{event_date}}</p>
                <p style="margin: 0; color: #f8fafc;"><strong>📍 Dónde:</strong> {{event_location}}</p>
            </div>
            <p>No olvides tener a mano tu código de acceso para un ingreso rápido.</p>`,
            'Ver Detalles del Evento',
            '{{login_url}}'
        )
    },
    {
        name: '[Modelo] Confirmación de Registro',
        subject: '✅ Registro Confirmado: {{event_name}}',
        body: premiumStyle(
            '¡Registro Exitoso!',
            `<p>Hola <strong>{{guest_name}}</strong>,</p>
            <p>Es un placer confirmarte que tu lugar en <strong>{{event_name}}</strong> está asegurado.</p>
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 25px; margin: 30px 0; border: 1px solid rgba(255,255,255,0.05);">
                <p style="margin: 0 0 10px 0; color: #f8fafc;"><strong>Evento:</strong> {{event_name}}</p>
                <p style="margin: 0 0 10px 0; color: #f8fafc;"><strong>Fecha:</strong> {{event_date}}</p>
                <p style="margin: 0; color: #f8fafc;"><strong>Ubicación:</strong> {{event_location}}</p>
            </div>
            <p>Hemos adjuntado los detalles necesarios para tu participación. ¡Nos vemos pronto!</p>`,
            'Descargar Invitación',
            '{{login_url}}'
        )
    },
    {
        name: '[Modelo] Agradecimiento Post-Evento',
        subject: '🌟 Gracias por ser parte de {{event_name}}',
        body: premiumStyle(
            '¡Gracias por Asistir!',
            `<p>Hola <strong>{{guest_name}}</strong>,</p>
            <p>Tu presencia en <strong>{{event_name}}</strong> hizo que el evento fuera un verdadero éxito.</p>
            <p>Esperamos que las conexiones y conocimientos adquiridos sean de gran valor para ti.</p>
            <div style="background: rgba(124, 58, 237, 0.1); border-radius: 16px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0; color: #f8fafc; font-size: 14px;">Ya puedes descargar tu certificado de participación desde el panel.</p>
            </div>`,
            'Descargar Certificado',
            '{{login_url}}'
        )
    }
];

const stmt = db.prepare("UPDATE email_templates SET subject = ?, body = ?, updated_at = ? WHERE name = ?");

updates.forEach(u => {
    const result = stmt.run(u.subject, u.body, new Date().toISOString(), u.name);
    console.log(`Updated ${u.name}: ${result.changes} changes`);
});

db.close();
console.log("Done.");
