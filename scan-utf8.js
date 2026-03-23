const fs = require('fs');
const path = require('path');

const corruptPatterns = [
  { pattern: /Ã¡/g, shouldBe: 'á' },
  { pattern: /Ã©/g, shouldBe: 'é' },
  { pattern: /Ã­/g, shouldBe: 'í' },
  { pattern: /Ã³/g, shouldBe: 'ó' },
  { pattern: /Ãº/g, shouldBe: 'ú' },
  { pattern: /ÃÃ±/g, shouldBe: 'ñ' },
  { pattern: /Ã±/g, shouldBe: 'ñ' },
  { pattern: /â€™/g, shouldBe: "'" },
  { pattern: /â€œ/g, shouldBe: '"' },
  { pattern: /â€/g, shouldBe: '"' },
  { pattern: /Ã¡/g, shouldBe: 'á' },
  { pattern: /Ã /g, shouldBe: 'Á' },
  { pattern: /Ã‰/g, shouldBe: 'É' },
  { pattern: /Ã"/g, shouldBe: 'Í' },
  { pattern: /Ã"/g, shouldBe: 'Ó' },
  { pattern: /Ãš/g, shouldBe: 'Ú' },
  { pattern: /Ã±/g, shouldBe: 'ñ' },
  { pattern: /Ã±/g, shouldBe: 'Ñ' },
  { pattern: /â‚¬/g, shouldBe: '€' },
  { pattern: /Ã¼/g, shouldBe: 'ü' },
  { pattern: /Ã¤/g, shouldBe: 'ä' },
  { pattern: /Ã¶/g, shouldBe: 'ö' },
];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];
    const lines = content.split('\n');
    for (const p of corruptPatterns) {
      p.pattern.lastIndex = 0;
      if (p.pattern.test(content)) {
        // Find lines with this pattern
        lines.forEach((line, idx) => {
          p.pattern.lastIndex = 0;
          if (p.pattern.test(line)) {
            results.push({ line: idx + 1, pattern: p.pattern.toString().replace('/g', ''), shouldBe: p.shouldBe, text: line.substring(0, 100) });
          }
        });
      }
    }
    return { file: filePath, results };
  } catch (e) {
    return { file: filePath, results: [] };
  }
}

function scanDirectory(dir, extensions) {
  const allResults = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'Capturas') {
        allResults.push(...scanDirectory(fullPath, extensions));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        const result = scanFile(fullPath);
        if (result.results.length > 0) {
          allResults.push(result);
        }
      }
    }
  } catch (e) {
    // Ignore
  }
  return allResults;
}

const results = scanDirectory('.', ['.js', '.html', '.css']);

console.log('\n=== ARCHIVOS CON CARACTERES UTF-8 CORRUPTOS ===\n');
for (const r of results) {
  console.log(r.file);
  for (const issue of r.results) {
    console.log(`  Linea ${issue.line}: "${issue.pattern}" -> deberia ser "${issue.shouldBe}"`);
    console.log(`    ${issue.text.trim()}`);
  }
  console.log('');
}
console.log(`Total archivos con problemas: ${results.length}`);
