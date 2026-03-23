const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

// Encontrar caracteres no ASCII
const nonAscii = content.match(/[^\x00-\x7F]/g);
if (!nonAscii) {
    console.log('No hay caracteres no ASCII.');
    process.exit(0);
}

// Contar frecuencias
const freq = {};
nonAscii.forEach(ch => {
    freq[ch] = (freq[ch] || 0) + 1;
});

console.log('Caracteres no ASCII restantes:');
const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
sorted.forEach(([ch, count]) => {
    const code = ch.charCodeAt(0).toString(16).toUpperCase();
    console.log(`U+${code.padStart(4,'0')} "${ch}" ${count} veces`);
});

// Mostrar líneas con caracteres sospechosos (corrupción)
const suspicious = ['Ã', 'Â', 'â', '€', '¢', '£', '¤', '¥', '¦', '§', '¨', '©', 'ª', '«', '¬', '®', '¯', '°', '±', '²', '³', '´', 'µ', '¶', '·', '¸', '¹', 'º', '»', '¼', '½', '¾', '¿', 'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß', 'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', '÷', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ'];
const lines = content.split('\n');
console.log('\nLíneas con caracteres sospechosos:');
let found = false;
for (let i = 0; i < lines.length; i++) {
    if (suspicious.some(s => lines[i].includes(s))) {
        console.log(`${i+1}: ${lines[i].trim().substring(0, 100)}`);
        found = true;
    }
}
if (!found) console.log('No se encontraron líneas con caracteres sospechosos.');