const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');
// Reemplazar broken bar por espacio
const replaced = content.replace(/¦/g, ' ');
if (replaced !== content) {
    fs.writeFileSync('script.js', replaced);
    console.log('Reemplazado broken bar.');
} else {
    console.log('No se encontró broken bar.');
}