const fs = require('fs');
const path = require('path');

// Leer script.js
const content = fs.readFileSync('script.js', 'utf8');

// Encontrar secuencias que contienen caracteres comunes de corrupción
const corruptionPattern = /[ÃÂâ€¢â‚¬â„¢âœâ€â€“â€”Ã‚Â¡Ã‚Â¿Ã¡Ã©Ã­Ã³ÃºÃ±Ã£Ã¢Ã¨Ã¬Ã²Ã¹Ã£Ã§Ã¯Ã¶Ã¼Ã„Ã–ÃœÃ¤Ã¶Ã¼ÃŸÃ€Ã‰ÃÃ“ÃšÃ‘Ã¡Ã©Ã­Ã³ÃºÃ±]+/g;
let matches = content.match(corruptionPattern);
if (!matches) matches = [];

// Agrupar y contar
const freq = {};
matches.forEach(m => {
    freq[m] = (freq[m] || 0) + 1;
});

console.log('Frecuencia de secuencias corruptas:');
Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,30).forEach(([seq, count]) => {
    console.log(`${count}\t${seq}`);
});

// Extraer líneas con ejemplos
console.log('\n--- Ejemplos de líneas ---');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Ã¢€¢Â')) {
        console.log(`${i+1}: ${lines[i].substring(0,100)}`);
        break;
    }
}