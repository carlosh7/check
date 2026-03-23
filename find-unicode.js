const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');
const lines = content.split('\n');

// Buscar caracteres suplentes (surrogate pairs)
const surrogateRegex = /[\uD800-\uDFFF]/g;
let found = false;
for (let i = 0; i < lines.length; i++) {
    if (surrogateRegex.test(lines[i])) {
        console.log(`Línea ${i+1}: ${lines[i].trim().substring(0, 120)}`);
        found = true;
    }
}
if (!found) console.log('No se encontraron surrogate pairs.');

// Buscar caracteres de "replacement character" � (U+FFFD) pero no está en la lista.
// Buscar caracteres fuera del plano básico multilingüe (U+10000 y superiores) que podrían estar mal codificados.
// Simplemente imprimir todas las líneas con caracteres no ASCII y mostrar los códigos.
console.log('\n--- Líneas con caracteres no ASCII (excluyendo letras acentuadas comunes) ---');
const commonLetters = /[áéíóúÁÉÍÓÚñÑüÜäÄöÖß¿¡·]/;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/[^\x00-\x7F]/.test(line)) {
        // Filtrar líneas que solo contienen letras acentuadas comunes
        const nonAsciiChars = line.match(/[^\x00-\x7F]/g) || [];
        const unusual = nonAsciiChars.filter(ch => !commonLetters.test(ch));
        if (unusual.length > 0) {
            console.log(`${i+1}: ${line.trim().substring(0, 100)}`);
            unusual.forEach(ch => {
                const code = ch.charCodeAt(0).toString(16).toUpperCase();
                console.log(`   U+${code} "${ch}"`);
            });
        }
    }
}