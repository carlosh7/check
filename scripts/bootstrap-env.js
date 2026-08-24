/**
 * bootstrap-env.js — Preparación idempotente del entorno (Fase 0 · P1-2 auditoría 2026-08)
 *
 * Se ejecuta en `postinstall` y desde setup.js. Garantiza que una instalación
 * nueva NUNCA arranque con secretos débiles conocidos:
 *   - Copia .env.example → .env si falta
 *   - Reemplaza JWT_SECRET / ENCRYPTION_KEY placeholder por valores aleatorios fuertes
 *   - Genera claves VAPID reales si siguen siendo placeholders
 *   - Crea el directorio de datos local
 *
 * Idempotente: solo sustituye los valores placeholder exactos; jamás toca secretos reales.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function bootstrapEnv({ logger = console } = {}) {
    const root = path.resolve(__dirname, '..');
    const envPath = path.join(root, '.env');
    const envExamplePath = path.join(root, '.env.example');
    const changes = [];

    // 1) Asegurar .env
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            fs.copyFileSync(envExamplePath, envPath);
            changes.push('.env creado desde .env.example');
        } else {
            fs.writeFileSync(envPath, '# Check Pro - generado por bootstrap-env\nPORT=3000\nAPP_URL=http://localhost:3000\nALLOWED_ORIGINS=http://localhost:3000\nDATA_PATH=./data\n');
            changes.push('.env creado con configuración mínima');
        }
    }

    let content = fs.readFileSync(envPath, 'utf8');

    // 2) Endurecer secretos débiles conocidos
    function replaceIfWeak(key, newValue) {
        const re = new RegExp(`^(${key})=(.*)$`, 'm');
        const match = content.match(re);
        if (!match) {
            content = content.trimEnd() + `\n${key}=${newValue}\n`;
            changes.push(`${key} añadido (no existía)`);
            return;
        }
        const current = match[2].trim();
        const weakPatterns = [/^genera_una_clave/i, /^tu_clave/i, /^changeme$/i, /^change_?me$/i, /^secret$/i, /^$/];
        if (!weakPatterns.some(p => p.test(current))) return;
        content = content.replace(re, `${key}=${newValue}`);
        changes.push(`${key} rotado (placeholder débil detectado)`);
    }

    replaceIfWeak('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
    replaceIfWeak('ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex'));

    // 3) Claves VAPID reales para Web Push
    if (/^VAPID_PUBLIC_KEY=tu_clave_publica_aqui\s*$/m.test(content)) {
        try {
            const webpush = require('web-push');
            const keys = webpush.generateVAPIDKeys();
            content = content.replace(/^VAPID_PUBLIC_KEY=.*$/m, `VAPID_PUBLIC_KEY=${keys.publicKey}`);
            content = content.replace(/^VAPID_PRIVATE_KEY=.*$/m, `VAPID_PRIVATE_KEY=${keys.privateKey}`);
            changes.push('Claves VAPID generadas automáticamente');
        } catch (e) {
            logger.warn('[bootstrap-env] web-push no disponible, VAPID queda pendiente de config manual');
        }
    }

    fs.writeFileSync(envPath, content);

    // 4) Directorio de datos local
    const dataDir = path.join(root, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        changes.push('directorio data/ creado');
    }

    return changes;
}

module.exports = { bootstrapEnv };

if (require.main === module) {
    const changes = bootstrapEnv();
    if (changes.length === 0) {
        console.log('[bootstrap-env] Entorno OK, sin cambios necesarios');
    } else {
        console.log('[bootstrap-env] Aplicados ' + changes.length + ' cambio(s):');
        changes.forEach(c => console.log('  ✓ ' + c));
    }
}
