/**
 * Unified Cache Utility
 * Supports Redis (primary) and NodeCache (fallback)
 */

const { initRedis, get: redisGet, set: redisSet, del: redisDel, flush: redisFlush, keys: redisKeys, getStats: redisStats, isRedisAvailable } = require('./redis-cache');

let nodeCacheInstance = null;
let useRedis = false;

async function init(cache) {
    nodeCacheInstance = cache;
    
    try {
        await initRedis();
        useRedis = isRedisAvailable();
        if (useRedis) {
            console.log('Cache: Using Redis');
        } else {
            console.log('Cache: Using NodeCache (fallback)');
        }
    } catch (err) {
        console.log('Cache: Redis init failed, using NodeCache');
        useRedis = false;
    }
}

async function get(key) {
    if (useRedis) {
        const value = await redisGet(key);
        if (value !== undefined) return value;
    }
    
    if (nodeCacheInstance) {
        return nodeCacheInstance.get(key);
    }
    
    return undefined;
}

async function set(key, value, ttl = 300) {
    if (useRedis) {
        const success = await redisSet(key, value, ttl);
        if (success) return true;
    }
    
    if (nodeCacheInstance) {
        return nodeCacheInstance.set(key, value, ttl);
    }
    
    return false;
}

async function del(key) {
    if (useRedis) {
        const success = await redisDel(key);
        if (success) return true;
    }
    
    if (nodeCacheInstance) {
        return nodeCacheInstance.del(key);
    }
    
    return false;
}

async function flush() {
    if (useRedis) {
        const success = await redisFlush();
        if (success) return true;
    }
    
    if (nodeCacheInstance) {
        return nodeCacheInstance.flushAll();
    }
    
    return false;
}

async function keys(pattern = '*') {
    if (useRedis) {
        return await redisKeys(pattern);
    }
    
    if (nodeCacheInstance) {
        return nodeCacheInstance.keys();
    }
    
    return [];
}

async function getStats() {
    if (useRedis) {
        const stats = await redisStats();
        if (stats) return { ...stats, engine: 'redis' };
    }
    
    if (nodeCacheInstance) {
        const stats = nodeCacheInstance.getStats();
        return { ...stats, engine: 'node-cache' };
    }
    
    return null;
}

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

module.exports = { init, get, set, del, flush, keys, getStats, CACHE_KEYS, cacheOrFetch };
