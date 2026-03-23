const fs = require('fs');
const path = require('path');

// Read script.js as Buffer to handle encoding properly
const filePath = 'script.js';
let content = fs.readFileSync(filePath);

// Convert to string for processing
let str = content.toString('utf8');

// Replace all known corrupted checkmark patterns
const replacements = [
  // Corrupted ✓ patterns (appears as Ã¢Å"€œ or similar)
  [/Ã¢Å[â„¢""][€""][™]/g, '✓'],
  [/Ã¢Å[â„¢][€][™]/g, '✓'],
  [/Ã¢Å[™][€]/g, '✓'],
  [/âœ[™]/g, '✓'],
  [/âœ/g, '✓'],
  [/Ã¢Å"€/g, '✓'],
  [/Ã¢Å"â€/g, '✓'],
  [/â€¢â€¢â€¢/g, '────'],
  [/â•â•â•/g, '────'],
  [/Ã‚Â¿/g, '¿'],
  [/Â¿/g, '¿'],
  [/Ã‚Â¡/g, '¡'],
  [/Â¡/g, '¡'],
  [/Ã¢ËœÂ¢/g, '⚠'],
  [/Ã¢Ë†/g, '←'],
  [/â†'/g, '→'],
  [/Ã¢Å"â‚¬/g, '€'],
  [/â‚¬/g, '€'],
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
];

let totalReplaced = 0;
for (const [pattern, replacement] of replacements) {
  const matches = str.match(pattern);
  if (matches) {
    console.log(`Replacing ${matches.length} x "${pattern}" -> "${replacement}"`);
    str = str.replace(pattern, replacement);
    totalReplaced += matches.length;
  }
}

console.log(`\nTotal replaced: ${totalReplaced}`);

// Write back
fs.writeFileSync(filePath, str);
console.log('File saved!');
