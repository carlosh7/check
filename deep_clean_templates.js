const Database = require('better-sqlite3');
const db = new Database('./check_app.db');

const cleanHtml = (html) => {
    if (!html) return html;
    
    // 1. Eliminar resaltados de fondo invasivos (especialmente blancos o muy parecidos)
    // Buscamos background-color: white, #fff, rgb(255, 255, 255), etc. 
    // Pero solo en etiquetas span/p/div que NO sean el header o el botón
    let cleaned = html;
    
    // Eliminar background de spans (Quill suele inyectar esto)
    cleaned = cleaned.replace(/background-color\s*:\s*[^;"]+;?/gi, '');
    cleaned = cleaned.replace(/background\s*:\s*white;?/gi, '');
    cleaned = cleaned.replace(/background\s*:\s*#ffffff;?/gi, '');
    
    // 2. Corregir colores de texto forzados a blanco en el cuerpo
    // Si encontramos color: #ffffff o white en un tag que NO sea h1 o a (botón)
    // lo cambiamos a inherit
    cleaned = cleaned.replace(/(<(?!(h1|a|strong|b|i|u|em)[^>]*)\b[^>]*style="[^"]*)\bcolor\s*:\s*(#ffffff|white|#f8fafc|rgb\(255,\s*255,\s*255\))\s*;?/gi, '$1color: inherit;');
    
    // 3. Asegurar que el contenedor principal sea transparente y herede color
    cleaned = cleaned.replace(/<div style="[^"]*background:[^"]*#020617[^"]*">/gi, '<div style="font-family: sans-serif; padding: 20px; background: transparent; color: inherit;">');
    
    return cleaned;
};

const tables = ['email_templates', 'event_email_templates'];

tables.forEach(table => {
    const rows = db.prepare(`SELECT id, name, body FROM ${table}`).all();
    const update = db.prepare(`UPDATE ${table} SET body = ? WHERE id = ?`);
    
    rows.forEach(row => {
        const newBody = cleanHtml(row.body);
        if (newBody !== row.body) {
            update.run(newBody, row.id);
            console.log(`Cleaned ${table}: ${row.name}`);
        }
    });
});

db.close();
console.log("Deep clean completed.");
