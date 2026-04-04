/**
 * Redis Cache Utility
 * Redis client wrapper with same interface as node-cache
 */

let createClient;
try {
    createClient = require('redis').createClient;
} catch (e) {
    // Redis no disponible, usar node-cache como fallback
    createClient = null;
}

let redisClient = null;
let isConnected = false;

async function initRedis() {
    if (redisClient) return redisClient;
    
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || 6379;
    const password = process.env.REDIS_PASSWORD || '';
    
    try {
        redisClient = createClient({
            url: `redis://${host}:${port}`,
            password: password || undefined
        });
        
        redisClient.on('error', (err) => {
            // Silenciar errores de Redis - es opcional
            isConnected = false;
        });
        
        redisClient.on('connect', () => {
            console.log('Redis connected');
            isConnected = true;
        });
        
        await redisClient.connect();
        return redisClient;
    } catch (err) {
        // Silenciar error - Redis es opcional
        redisClient = null;
        isConnected = false;
        return null;
    }
}

async function get(key) {
    if (!redisClient || !isConnected) return undefined;
    try {
        const value = await redisClient.get(key);
        if (value) {
            return JSON.parse(value);
        }
        return undefined;
    } catch (err) {
        console.error('Redis get error:', err.message);
        return undefined;
    }
}

async function set(key, value, ttl = 300) {
    if (!redisClient || !isConnected) return false;
    try {
        const stringValue = JSON.stringify(value);
        if (ttl > 0) {
            await redisClient.setEx(key, ttl, stringValue);
        } else {
            await redisClient.set(key, stringValue);
        }
        return true;
    } catch (err) {
        console.error('Redis set error:', err.message);
        return false;
    }
}

async function del(key) {
    if (!redisClient || !isConnected) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (err) {
        console.error('Redis del error:', err.message);
        return false;
    }
}

async function flush() {
    if (!redisClient || !isConnected) return false;
    try {
        await redisClient.flushAll();
        return true;
    } catch (err) {
        console.error('Redis flush error:', err.message);
        return false;
    }
}

async function keys(pattern = '*') {
    if (!redisClient || !isConnected) return [];
    try {
        return await redisClient.keys(pattern);
    } catch (err) {
        console.error('Redis keys error:', err.message);
        return [];
    }
}

async function getStats() {
    if (!redisClient || !isConnected) return null;
    try {
        const info = await redisClient.info();
        const lines = info.split('\r\n');
        const stats = {};
        lines.forEach(line => {
            const [key, value] = line.split(':');
            if (key && value) {
                stats[key] = value;
            }
        });
        return stats;
    } catch (err) {
        console.error('Redis stats error:', err.message);
        return null;
    }
}

// Same cache keys as node-cache wrapper
const CACHE_KEYS = {
    EVENT: (id) => `event:${id}`,
    EVENT_LIST: 'events:list',
    USER: (id) => `user:${id}`,
    SETTINGS: 'settings:all',
    GUEST_STATS: (eventId) => `guests:stats:${eventId}`,
    EMAIL_LOGS: (page) => `email:logs:${page}`,
};

async function cacheOrFetch(key, fetchFn, ttl = 300) {
    const cached = await get(key);
    if (cached !== undefined) return cached;
    const data = await fetchFn();
    await set(key, data, ttl);
    return data;
}

module.exports = { 
    initRedis, 
    get, 
    set, 
    del, 
    flush, 
    keys, 
    getStats, 
    CACHE_KEYS, 
    cacheOrFetch,
    isRedisAvailable: () => redisClient && isConnected
};