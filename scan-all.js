const fs = require('fs');
const path = require('path');

const extensions = ['.js', '.html', '.css', '.md', '.json', '.yaml', '.yml', '.txt', '.jsx', '.ts', '.tsx'];
const excludeDirs = ['node_modules', '.git', 'uploads', 'dist', 'build', 'Capturas'];

function scanDir(dir) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                    results.push(...scanDir(fullPath));
                }
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    // Detectar caracteres corruptos comunes
                    if (content.match(/[ÃÂâ€¢â‚¬â„¢âœâ€â€“â€”]/)) {
                        // Contar ocurrencias
                        const corruptCount = (content.match(/[ÃÂâ€¢â‚¬â„¢âœâ€â€“â€”]/g) || []).length;
                        results.push({ path: fullPath, corruptCount });
                    }
                } catch (e) {
                    // Ignorar errores de lectura
                }
            }
        }
    } catch (e) {
        // Ignorar errores de directorio
    }
    return results;
}

console.log('Escaneando archivos con caracteres corruptos...');
const results = scanDir('.');
console.log(`\nEncontrados ${results.length} archivos con posibles caracteres corruptos:`);
results.forEach(r => {
    console.log(`  ${r.path} (${r.corruptCount} caracteres sospechosos)`);
});

// También mostrar algunos ejemplos
console.log('\n--- Ejemplos de líneas corruptas ---');
for (const r of results.slice(0, 5)) {
    console.log(`\n${r.path}:`);
    const content = fs.readFileSync(r.path, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/[ÃÂâ€¢â‚¬â„¢âœâ€â€“â€”]/)) {
            console.log(`  ${i+1}: ${lines[i].substring(0, 120)}`);
            // Mostrar solo 3 líneas por archivo
            if (i > 10) break;
        }
    }
}