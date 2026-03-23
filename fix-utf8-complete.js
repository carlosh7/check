const fs = require('fs');
const path = require('path');

// Mapa de reemplazos: secuencia corrupta -> correcta
const replacements = [
    // Separadores de sección (Ã¢€¢Â -> ─)
    [/Ã¢€¢Â/g, '─'],
    
    // Checkmarks
    [/Ã¢Å“€œ/g, '✓'],
    [/Ã¢Å“€/g, '✓'],
    [/Ã¢Å“€¦/g, '✓'],
    [/¦/g, ' '],
    
    // Caracteres españoles
    [/á/g, 'Á'],
    [/á/g, 'Í'],
    
    // Punto medio
    [/Ã‚Â·/g, '·'],
    
    // Símbolos de advertencia
    [/⚠Â¢Ã¯Â¸Â/g, '⚠'],
    
    // Símbolos de cruz/eliminar
    [/Ãƒ€”/g, '×'],
    [/Ã¢ÂÅ’/g, '×'],
    
    // Signos de interrogación y exclamación invertidos
    [/Ã‚Â¿/g, '¿'],
    [/Ã‚Â¡/g, '¡'],
    [/Â¿/g, '¿'],
    [/Â¡/g, '¡'],
    
    // Viñetas y separadores
    [/â€¢â€¢â€¢/g, '────'],
    [/â•â•â•/g, '────'],
    
    // Caracteres especiales
    [/Ã¢Ëœ/g, '⚠'],
    [/Ã¢Ë†/g, '←'],
    [/â†'/g, '→'],
    [/Ã¢Å"â‚¬/g, '€'],
    [/â‚¬/g, '€'],
    
    // Palabras completas corruptas
    [/DISEÃƒâ€˜O/g, 'DISEÑO'],
    [/DISEÃ"Ã¢Ë†/g, 'DISEÑO'],
    [/DISENO/g, 'DISEÑO'],
    [/MÃƒâ€°TRICAS/g, 'MÉTRICAS'],
    [/METRICAS/g, 'MÉTRICAS'],
    [/CONTRASEÃƒâ€˜A/g, 'CONTRASEÑA'],
    [/CONTRASEÃ"Ã¢Ë†A/g, 'CONTRASEÑA'],
    [/CONTRASENA/g, 'CONTRASEÑA'],
    [/PERMISOS JERÃ¡Â ÃQUICOS/g, 'PERMISOS JERÁRQUICOS'],
    [/JERÃ¡Â ÃQUICOS/g, 'JERÁRQUICOS'],
    [/JERARQUICOS/g, 'JERÁRQUICOS'],
    
    // Caracteres latinos básicos (si aparecen individualmente)
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã­/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    [/Ã±/g, 'ñ'],
    [/Ã/g, 'Á'],
    [/Ã‰/g, 'É'],
    [/Ã/g, 'Í'],
    [/Ã“/g, 'Ó'],
    [/Ãš/g, 'Ú'],
    [/Ã‘/g, 'Ñ'],
    [/Ã¼/g, 'ü'],
    [/Ã¤/g, 'ä'],
    [/Ã¶/g, 'ö'],
    [/ÃŸ/g, 'ß'],
];

function fixFile(filePath) {
    console.log(`Procesando ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    let totalReplaced = 0;
    
    for (const [pattern, replacement] of replacements) {
        const matches = content.match(pattern);
        if (matches) {
            content = content.replace(pattern, replacement);
            totalReplaced += matches.length;
        }
    }
    
    if (totalReplaced > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`  Reemplazados ${totalReplaced} caracteres corruptos.`);
    } else {
        console.log(`  No se encontraron caracteres corruptos.`);
    }
}

// Procesar script.js
fixFile('script.js');

// También podemos procesar otros archivos si es necesario
const otherFiles = [
    'index.html',
    'app-shell.html',
    'registro.html',
    'ticket.html',
    'survey.html',
    'styles.css',
    'src/styles/main.css',
    'src/frontend/utils.js',
    'src/frontend/api.js',
];

otherFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fixFile(file);
    }
});

console.log('\n¡Corrección completada!');