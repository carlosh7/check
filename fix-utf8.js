const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// Fix corrupted checkmarks (multiple possible encodings)
content = content.replace(/Ã¢Å"€œ/g, '✓');
content = content.replace(/Ã¢Å"€/g, '✓');
content = content.replace(/âœ/g, '✓');

// Fix corrupted ¿ (multiple encodings)
content = content.replace(/Ã‚Â¿/g, '¿');
content = content.replace(/Â¿/g, '¿');
content = content.replace(/Ã¿/g, '¿');

// Fix corrupted ¡
content = content.replace(/Ã‚Â¡/g, '¡');
content = content.replace(/Â¡/g, '¡');

// Fix corrupted dashes
content = content.replace(/â€¢â€¢â€¢/g, '────');
content = content.replace(/â•â•â•/g, '────');

// Fix Spanish words with corruption
content = content.replace(/DISEÃƒâ€˜O/g, 'DISEÑO');
content = content.replace(/DISEÃ"Ã¢Ë†/g, 'DISEÑO');
content = content.replace(/DISENO/g, 'DISEÑO');

content = content.replace(/MÃƒâ€°TRICAS/g, 'MÉTRICAS');
content = content.replace(/METRICAS/g, 'MÉTRICAS');

content = content.replace(/CONTRASEÃƒâ€˜A/g, 'CONTRASEÑA');
content = content.replace(/CONTRASEÃ"Ã¢Ë†A/g, 'CONTRASEÑA');
content = content.replace(/CONTRASENA/g, 'CONTRASEÑA');

content = content.replace(/PERMISOS JERÃ¡Â ÃQUICOS/g, 'PERMISOS JERÁRQUICOS');
content = content.replace(/JERÃ¡Â ÃQUICOS/g, 'JERÁRQUICOS');
content = content.replace(/JERARQUICOS/g, 'JERÁRQUICOS');

content = content.replace(/GENERAR CERTIFICADOS/g, 'GENERAR CERTIFICADOS');

// Fix any remaining raw UTF-8 issues
content = content.replace(/Ã¢Ëœ/g, '⚠');
content = content.replace(/Ã¢Ë†/g, '←');
content = content.replace(/â†'/g, '→');
content = content.replace(/Ã¢Å"â‚¬/g, '€');
content = content.replace(/â‚¬/g, '€');

fs.writeFileSync('script.js', content);
console.log('Fixed script.js');
