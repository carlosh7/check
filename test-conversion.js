const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

// Función para intentar reparar mediante re-encoding
function repairByReencoding(str) {
    // Convertir la cadena a Buffer asumiendo que está en latin1 (ISO-8859-1)
    const buffer = Buffer.from(str, 'latin1');
    return buffer.toString('utf8');
}

// Secuencias corruptas conocidas
const samples = [
    'Ã¢€¢Â',
    'Ã¢Å“€œ',
    'Ã‚Â·',
    'Ãƒ€”',
    'á',
    'Ã¢€¢Â',
    'Ã¢Å“€¦',
    'Ã¢ÂÅ’',
    'Sá',
    'Â¢Ã¯Â',
    'Ã‚Â¿',
    'Ã‚Â¡',
    'â€¢â€¢â€¢',
    'â•â•â•',
    'Ã¢Ëœ',
    'Ã¢Ë†',
    'â†\'',
    'Ã¢Å"â‚¬',
    'â‚¬',
    'DISEÃƒâ€˜O',
    'MÃƒâ€°TRICAS',
    'CONTRASEÃƒâ€˜A',
    'PERMISOS JERÃ¡Â ÃQUICOS',
    'JERÃ¡Â ÃQUICOS'
];

console.log('Probando conversión latin1 -> utf8:');
samples.forEach(sample => {
    try {
        const repaired = repairByReencoding(sample);
        console.log(`"${sample}" -> "${repaired}" (${repaired === sample ? 'igual' : 'diferente'})`);
    } catch(e) {
        console.log(`Error con "${sample}":`, e.message);
    }
});

// También probar la conversión inversa: asumir que el texto original era UTF-8, fue mal interpretado como Windows-1252 y guardado como UTF-8 again.
// Esto es: texto -> bytes UTF-8 -> interpretado como Windows-1252 -> bytes -> UTF-8.
// Para revertir: texto -> bytes UTF-8 -> interpretar como Windows-1252 produce bytes originales? No.
// La operación correcta es: texto -> Buffer.from(str, 'utf8').toString('latin1') ?
function doubleDecode(str) {
    return Buffer.from(str, 'utf8').toString('latin1');
}

console.log('\nProbando double decode (utf8 -> latin1):');
samples.forEach(sample => {
    try {
        const repaired = doubleDecode(sample);
        console.log(`"${sample}" -> "${repaired}"`);
    } catch(e) {
        console.log(`Error con "${sample}":`, e.message);
    }
});