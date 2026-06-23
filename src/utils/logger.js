const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LEVEL_COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

const isDev = process.env.NODE_ENV !== 'production';
const currentLevel = LOG_LEVELS[isDev ? 'debug' : 'info'];

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

const logger = {
    error(message, ...args) {
        if (currentLevel >= LOG_LEVELS.error) {
            console.error(...formatMessage('error', message, args));
        }
    },
    warn(message, ...args) {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.warn(...formatMessage('warn', message, args));
        }
    },
    info(message, ...args) {
        if (currentLevel >= LOG_LEVELS.info) {
            console.log(...formatMessage('info', message, args));
        }
    },
    debug(message, ...args) {
        if (currentLevel >= LOG_LEVELS.debug) {
            console.log(...formatMessage('debug', message, args));
        }
    }
};

module.exports = logger;
