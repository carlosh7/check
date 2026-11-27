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
// // v12.44.847 (auditoría 2026-11-25, P8): los logs iban siempre a <repo>/data/logs ignorando DATA_PATH. En un contenedor sin root
// esa carpeta pertenece al código y no es escribible; ahora siguen a los datos persistentes.
const LOG_DIR = process.env.DATA_PATH ? path.join(process.env.DATA_PATH, 'logs') : path.join(__dirname, '../../data/logs');
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

// v12.44.853 (P8): escritura ASÍNCRONA por lotes. Antes cada línea hacía appendFileSync (un syscall
// bloqueante por log; con ~12 logs por request el event loop se detenía una y otra vez).
// Diseño sin perder evidencia:
//   - warn/info/debug van a un búfer por archivo y se vuelcan en lotes (un appendFile por archivo).
//   - ERROR se escribe SINCRÓNICO siempre: la evidencia de un fallo debe sobrevivir al fallo.
//   - flushSync() vuelca lo pendiente de forma síncrona: se llama en el apagado y ante un crash.
//   - Si un volcado asíncrono falla, se reintenta sincrónico para no perder el lote.
const pending = new Map(); // filePath -> array de líneas
const FLUSH_INTERVAL = 500;   // ms entre volcados
const FLUSH_BATCH = 500;      // volcado anticipado si el búfer crece mucho
let flushTimer = null;
let flushing = false;

function queueWrite(filePath, text) {
    if (!pending.has(filePath)) pending.set(filePath, []);
    const batch = pending.get(filePath);
    batch.push(text);
    if (batch.length >= FLUSH_BATCH) flushSyncFile(filePath);
    else scheduleFlush();
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function() { flushTimer = null; flushAll(); }, FLUSH_INTERVAL);
}

async function flushAll() {
    if (flushing) { scheduleFlush(); return; } // reprogramar: llegaron líneas durante el volcado
    flushTimer = null;
    flushing = true;
    try {
        for (const [filePath, lines] of pending) {
            if (lines.length === 0) { pending.delete(filePath); continue; }
            pending.set(filePath, []);
            try {
                await fs.promises.appendFile(filePath, lines.join(''));
            } catch (e) {
                try { fs.appendFileSync(filePath, lines.join('')); } catch (_) {}
            }
        }
    } finally {
        flushing = false;
    }
    let quedan = false;
    for (const lines of pending.values()) if (lines.length > 0) quedan = true;
    if (quedan) scheduleFlush();
}

function flushSyncFile(filePath) {
    const lines = pending.get(filePath);
    if (!lines || lines.length === 0) { pending.delete(filePath); return; }
    try { fs.appendFileSync(filePath, lines.join('')); } catch (_) {}
    pending.set(filePath, []);
}

// Vuelca TODO lo pendiente de forma síncrona (apagado, crash, pruebas)
function flushSync() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    for (const filePath of Array.from(pending.keys())) flushSyncFile(filePath);
}

function writeToFile(filePath, line, opts) {
    const text = line + '\n';
    if (opts && opts.immediate) {
        // error: síncrono siempre (evidencia de crash)
        try { fs.appendFileSync(filePath, text); } catch (e) {}
        return;
    }
    queueWrite(filePath, text);
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
            writeToFile(files.error, formatFileLine('error', message, args), { immediate: true });
            writeToFile(files.combined, formatFileLine('error', message, args), { immediate: true });
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

logger.flushSync = flushSync; // apagado ordenado, crash y pruebas (v12.44.853 P8)
logger.flushAll = flushAll;   // volcado asíncrono

// Limpiar logs viejos una vez al día, sin bloquear el arranque
setTimeout(function() { cleanOldLogs(); }, 2000);

module.exports = logger;
