const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf8');

// Remove legacy block after the correct one (from line ~8865 to ~8930)
const legacyBlock = /\n    \/\/ Legacy - usar siempre el carrusel unificado\n    openEventEditAction\(\) \{[\s\S]*?this\.openEventEditCarousel\(selected\);\n    \},\n\n    openEventEditModal\(eventId\) \{[\s\S]*?modal\.style\.display = 'flex';\n        \}\n    \},\n\n    openEventEditCarousel: async function\(selectedIds\) \{[\s\S]*?renderCarousel\(\);\n    \},\n/;

content = content.replace(legacyBlock, '\n');

fs.writeFileSync('public/js/app.js', content);
console.log('Legacy block removed');