const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

// Encontrar todas las secuencias que contienen bytes corruptos comunes
// Regex que captura grupos de caracteres no ASCII
const regex = /[^\x00-\x7F]{2,6}/g;
let matches = content.match(regex);
if (!matches) matches = [];

// Filtrar solo aquellos que contienen caracteres de corrupción típicos
const corruptionIndicators = ['Ã', 'Â', 'â', '€', '¢', '£', '¤', '¥', '¦', '§', '¨', '©', 'ª', '«', '¬', '®', '¯', '°', '±', '²', '³', '´', 'µ', '¶', '·', '¸', '¹', 'º', '»', '¼', '½', '¾', '¿', 'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß', 'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', '÷', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ'];
const filtered = matches.filter(m => corruptionIndicators.some(c => m.includes(c)));

// Agrupar por secuencia
const freq = {};
filtered.forEach(m => {
    freq[m] = (freq[m] || 0) + 1;
});

console.log('Secuencias corruptas únicas (top 50):');
const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
sorted.slice(0, 50).forEach(([seq, count]) => {
    console.log(`${count.toString().padStart(4)} "${seq}"`);
});

// Para cada secuencia frecuente, mostrar contexto
console.log('\n--- Contexto para secuencias más frecuentes ---');
const lines = content.split('\n');
for (const [seq, count] of sorted.slice(0, 20)) {
    console.log(`\n"${seq}" (${count} ocurrencias):`);
    let shown = 0;
    for (let i = 0; i < lines.length && shown < 2; i++) {
        if (lines[i].includes(seq)) {
            console.log(`  ${i+1}: ${lines[i].trim().substring(0, 120)}`);
            shown++;
        }
    }
}