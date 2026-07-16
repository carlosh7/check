/**
 * Logger Persistente con Rotación (v12.44.777)
 * Escribe a console + archivos con rotación diaria
 */
const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LEVEL_COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

const isDev = process.env.NODE_ENV !== 'production';
const currentLevel = LOG_LEVELS[isDev ? 'debug' : 'info'];

// Directorio de logs
const LOG_DIR = path.join(__dirname, '../../data/logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch(e) {}

// Archivos de log (rotación diaria)
function getLogFiles() {
    const date = new Date().toISOString().split('T')[0];
    return {
        error: path.join(LOG_DIR, `error-${date}.log`),
        combined: path.join(LOG_DIR, `combined-${date}.log`)
    };
}

// Limpiar logs viejos (> 7 días)
function cleanOldLogs() {
    try {
        const files = fs.readdirSync(LOG_DIR);
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        files.forEach(f => {
            const fp = path.join(LOG_DIR, f);
            if (f.endsWith('.log') && fs.statSync(fp).mtimeMs < cutoff) {
                fs.unlinkSync(fp);
            }
        });
    } catch(e) {}
}

// Ejecutar limpieza una vez al día
let lastClean = Date.now();
function maybeClean() {
    if (Date.now() - lastClean > 24 * 60 * 60 * 1000) {
        cleanOldLogs();
        lastClean = Date.now();
    }
}

// Escribir a archivo (append, síncrono para no bloquear)
function writeToFile(filePath, line) {
    try {
        fs.appendFileSync(filePath, line + '\n');
    } catch(e) {
        // Si falla la escritura, no hacemos nada (no bloquear el proceso)
    }
}

function formatTimestamp() {
    return new Date().toISOString();
}

function formatMessage(level, message, args) {
    const ts = formatTimestamp();
    const color = LEVEL_COLORS[level];
    const label = level.toUpperCase().padEnd(5);
    const prefix = `${color}[${ts}] ${label}${RESET}`;
    const msg = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    return args.length > 0 ? [prefix, msg, ...args] : [prefix, msg];
}

function formatFileLine(level, message, args) {
    const ts = formatTimestamp();
    const label = level.toUpperCase().padEnd(5);
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '';
    return `[${ts}] ${label} ${msg}${extra}`;
}

const logger = {
    error(message, ...args) {
        if (currentLevel >= LOG_LEVELS.error) {
            console.error(...formatMessage('error', message, args));
            const files = getLogFiles();
            writeToFile(files.error, formatFileLine('error', message, args));
            writeToFile(files.combined, formatFileLine('error', message, args));
            maybeClean();
        }
    },
    warn(message, ...args) {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.warn(...formatMessage('warn', message, args));
            const files = getLogFiles();
            writeToFile(files.combined, formatFileLine('warn', message, args));
            maybeClean();
        }
    },
    info(message, ...args) {
        if (currentLevel >= LOG_LEVELS.info) {
            console.log(...formatMessage('info', message, args));
            const files = getLogFiles();
            writeToFile(files.combined, formatFileLine('info', message, args));
            maybeClean();
        }
    },
    debug(message, ...args) {
        if (currentLevel >= LOG_LEVELS.debug) {
            console.log(...formatMessage('debug', message, args));
            // Debug no se escribe a archivo en producción
            if (isDev) {
                const files = getLogFiles();
                writeToFile(files.combined, formatFileLine('debug', message, args));
            }
        }
    }
};

module.exports = logger;
