const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = '$aes-gcm$';

function getKey() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) return null;
    return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext) {
    if (plaintext == null || plaintext === '') return plaintext;
    const key = getKey();
    if (!key) return plaintext;
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

module.exports = { encrypt, decrypt, encryptPassword, decryptPassword, isEncrypted, getStatus, migrateExistingPasswords };
