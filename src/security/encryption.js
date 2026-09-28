const crypto = require('crypto');
const fs = require('fs');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = '$aes-gcm$';

function getKey() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) return null;
    return crypto.createHash('sha256').update(secret).digest();
}

// L-4b (v12.44.820): antes el fallback devolvía el texto plano EN SILENCIO — el operador
// nunca se enteraba de que sus credenciales dormían sin cifrar. Ahora avisa UNA vez por
// proceso por la vía ruidosa (logger + consola) para que aparezca en docker logs.
let plaintextFallbackWarned = false;
function warnPlaintextFallback(context) {
    if (plaintextFallbackWarned) return;
    plaintextFallbackWarned = true;
    const msg = '[ENCRYPTION] ⚠️ ENCRYPTION_KEY no configurada: ' + (context || 'dato') +
        ' se guardará/leerá SIN CIFRAR. Configura ENCRYPTION_KEY (o BACKUP_ENCRYPTION_KEY para backups) en el entorno.';
    console.error(msg);
    try { require('./logger').error(msg); } catch (_) {}
    try {
        const { db } = require('../../database');
        db.prepare("INSERT INTO audit_logs (id, user_id, user_name, action, details, ip_address) VALUES (?, 'system', 'system', 'ENCRYPTION_KEY_MISSING', ?, '')")
          .run(require('crypto').randomUUID(), JSON.stringify({ context }));
    } catch (_) {}
}

function encrypt(plaintext) {
    if (plaintext == null || plaintext === '') return plaintext;
    const key = getKey();
    if (!key) { warnPlaintextFallback('credencial'); return plaintext; }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return PREFIX + iv.toString('base64') + '.' + encrypted + '.' + tag;
}

function decrypt(stored) {
    if (!stored || typeof stored !== 'string') return stored;
    if (!stored.startsWith(PREFIX)) return stored;
    const key = getKey();
    if (!key) return stored;
    const parts = stored.slice(PREFIX.length).split('.');
    if (parts.length !== 3) return stored;
    try {
        const iv = Buffer.from(parts[0], 'base64');
        const encrypted = parts[1];
        const tag = Buffer.from(parts[2], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return stored;
    }
}

function encryptPassword(plaintext) {
    if (!plaintext || plaintext === '***') return plaintext;
    const key = getKey();
    if (!key) return plaintext;
    return encrypt(plaintext);
}

function decryptPassword(stored) {
    if (!stored || stored === '***') return stored;
    return decrypt(stored);
}

function isEncrypted(stored) {
    return typeof stored === 'string' && stored.startsWith(PREFIX);
}

function getStatus() {
    const hasKey = !!process.env.ENCRYPTION_KEY;
    return {
        enabled: hasKey,
        algorithm: ALGORITHM,
        key_configured: hasKey,
        key_length: hasKey ? KEY_LENGTH * 8 : 0
    };
}

function migrateExistingPasswords() {
    const { db } = require('../../database');
    const migrated = { smtp: 0, imap: 0 };
    const accounts = db.prepare('SELECT id, smtp_password, imap_password FROM email_accounts').all();
    for (const acc of accounts) {
        if (acc.smtp_password && !acc.smtp_password.startsWith(PREFIX)) {
            const encrypted = encryptPassword(acc.smtp_password);
            db.prepare('UPDATE email_accounts SET smtp_password = ? WHERE id = ?').run(encrypted, acc.id);
            migrated.smtp++;
        }
        if (acc.imap_password && !acc.imap_password.startsWith(PREFIX)) {
            const encrypted = encryptPassword(acc.imap_password);
            db.prepare('UPDATE email_accounts SET imap_password = ? WHERE id = ?').run(encrypted, acc.id);
            migrated.imap++;
        }
    }
    return migrated;
}

// ─── L-4b (v12.44.820): cifrado de BACKUPS (AES-256-GCM sobre gzip) ───
// Clave dedicada BACKUP_ENCRYPTION_KEY con fallback a ENCRYPTION_KEY.
const BACKUP_PREFIX = '$bkenc1$';

function getBackupKey() {
    const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!secret) return null;
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptBuffer(buffer) {
    const key = getBackupKey();
    if (!key) { warnPlaintextFallback('backup'); return null; }
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(buffer);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([
        Buffer.from(BACKUP_PREFIX),
        Buffer.from(iv.toString('base64') + '.' + tag.toString('hex') + '.'),
        encrypted
    ]);
}

function decryptBuffer(stored) {
    if (!stored || !stored.slice(0, BACKUP_PREFIX.length).equals(Buffer.from(BACKUP_PREFIX))) return null;
    const key = getBackupKey();
    if (!key) return null;
    try {
        const rest = stored.slice(BACKUP_PREFIX.length);
        const sep1 = rest.indexOf('.');
        const sep2 = rest.indexOf('.', sep1 + 1);
        if (sep1 < 0 || sep2 < 0) return null;
        const iv = Buffer.from(rest.slice(0, sep1).toString(), 'base64');
        const tag = Buffer.from(rest.slice(sep1 + 1, sep2).toString(), 'hex');
        const encrypted = rest.slice(sep2 + 1);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        const compressed = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return require('zlib').gunzipSync(compressed);
    } catch (_) {
        return null; // clave incorrecta o archivo alterado (auth tag no coincide)
    }
}

// Acepta una RUTA (lee la cabecera del archivo) o un BUFFER en memoria
function isBackupEncrypted(source) {
    try {
        let head;
        if (Buffer.isBuffer(source)) {
            head = source.slice(0, BACKUP_PREFIX.length);
        } else {
            const fd = fs.openSync(source, 'r');
            head = Buffer.alloc(BACKUP_PREFIX.length);
            fs.readSync(fd, head, 0, BACKUP_PREFIX.length, 0);
            fs.closeSync(fd);
        }
        return head.equals(Buffer.from(BACKUP_PREFIX));
    } catch (_) { return false; }
}

// L-4b (v12.44.820): claves Twilio vivían en TEXTO PLANO en settings (hallazgo C-5/L-8).
// Migra los valores existentes a AES-256-GCM; idempotente (salta lo ya cifrado).
function migrateTwilioSettings() {
    const { db } = require('../../database');
    const migrated = { twilio: 0 };
    if (!process.env.ENCRYPTION_KEY) {
        warnPlaintextFallback('migración de claves Twilio');
        return migrated;
    }
    for (const settingKey of ['sms_auth_token', 'sms_account_sid']) {
        try {
            const row = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get(settingKey);
            if (row && row.setting_value && !row.setting_value.startsWith(PREFIX)) {
                db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(encrypt(row.setting_value), settingKey);
                migrated.twilio++;
            }
        } catch (e) {
            require('./logger').error('[ENCRYPTION] migrateTwilioSettings ' + settingKey + ': ' + e.message);
        }
    }
    return migrated;
}

module.exports = { encrypt, decrypt, encryptPassword, decryptPassword, isEncrypted, getStatus, migrateExistingPasswords, encryptBuffer, decryptBuffer, isBackupEncrypted, migrateTwilioSettings };
