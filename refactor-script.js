const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Cabecera ESM
const header = `import { LS, lazyLoad } from './src/frontend/utils.js';
import { API } from './src/frontend/api.js';

// MASTER SCRIPT V12.2.3 - ARQUITECTURA ESM 🛡️🚀💎
console.log("CHECK V12.2.3: Iniciando Sistema Modular...");
console.log('[INIT] Script loaded as ESM, LS available');

`;

// 2. Reemplazar hasta window.App
const appStart = content.indexOf('window.App = {');
if (appStart !== -1) {
    content = header + content.substring(appStart);
} else {
    console.error('No se encontró window.App = {');
    process.exit(1);
}

// 3. Insertar fetchAPI wrapper
const constantsLine = "constants: { API_URL: '/api' },";
if (content.includes(constantsLine)) {
    content = content.replace(constantsLine, `${constantsLine}\n    fetchAPI(endpoint, options) { return API.fetchAPI(endpoint, options); },`);
}

// 4. Corregir codificación
const legacyMap = {
    'ÃƒÂ­': 'í',
    'ÃƒÂ³': 'ó',
    'ÃƒÂ¡': 'á',
    'ÃƒÂ©': 'é',
    'ÃƒÂº': 'ú',
    'ÃƒÂ±': 'ñ',
    'Ãƒâ€œ': 'Ó',
    'ÃƒÂ': 'á',
    'Ã°Å¸â€ºÂ¡': '🛡️',
    'Ã°Å¸Å¡â‚¬': '🚀',
    'Ã°Å¸â€™Å½': '💎'
};

for (const [key, value] of Object.entries(legacyMap)) {
    content = content.split(key).join(value);
}

// 5. Versión
content = content.split("version: '12.2.2'").join("version: '12.2.3'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Script refactorizado con éxito.');
