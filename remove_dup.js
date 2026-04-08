const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf8');

// Find the position of first async openEventEditCarousel around line 8377
const lines = content.split('\n');
let foundFirst = false;
let removeStart = -1;
let removeEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('openEventEditCarousel: async function')) {
        if (!foundFirst) {
            foundFirst = true;
            // Find the end of this function (look for the next function definition)
            let braceCount = 0;
            let startFound = false;
            for (let j = i; j < lines.length; j++) {
                if (lines[j].includes('openEventEditCarousel: async function')) startFound = true;
                if (startFound) {
                    if (lines[j].includes('{')) braceCount++;
                    if (lines[j].includes('}')) braceCount--;
                    if (braceCount === 0 && j > i) {
                        // Found the end
                        removeStart = i;
                        removeEnd = j + 1;
                        break;
                    }
                }
            }
            break;
        }
    }
}

if (removeStart >= 0) {
    const newLines = [...lines.slice(0, removeStart), ...lines.slice(removeEnd)];
    content = newLines.join('\n');
    console.log('Removed duplicate function from line', removeStart + 1, 'to', removeEnd);
} else {
    console.log('Could not find duplicate to remove');
}

fs.writeFileSync('public/js/app.js', content);