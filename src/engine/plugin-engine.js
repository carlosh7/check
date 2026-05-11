/**
 * Plugin Engine — Sistema de Plugins con VM Sandbox (C11-09)
 *
 * Los plugins se ejecutan en un sandbox de Node.js (vm) con acceso controlado.
 * Cada plugin define hooks a los que suscribirse (eventos del sistema).
 * Cuando un hook se dispara, se ejecutan todos los plugins suscritos.
 */
const vm = require('vm');
const { db } = require('../../database');

const HOOKS = {
    GUEST_CHECKED_IN: 'guest.checked_in',
    GUEST_REGISTERED: 'guest.registered',
    POLL_VOTED: 'poll.voted',
    EVENT_CREATED: 'event.created',
    SESSION_STARTED: 'session.started',
};

const loadedPlugins = new Map(); // plugin_id -> { hooks, script, sandbox }

function loadPlugin(plugin) {
    try {
        var hooks = [];
        try { hooks = JSON.parse(plugin.hooks || '[]'); } catch(e) {}
        var script = plugin.script || '';
        var sandbox = {
            console: { log: function() {}, error: function() {} },
            setTimeout: setTimeout,
            fetch: function(url, opts) { return fetch(url, opts); },
            db: { get: function(sql, params) { try { return db.prepare(sql).get.apply(db.prepare(sql), params || []); } catch(e) { return null; } } },
            utils: { log: function(msg) { /* plugin logging */ } }
        };
        loadedPlugins.set(plugin.id, { id: plugin.id, name: plugin.name, hooks: hooks, script: script, sandbox: sandbox, vmContext: null });
    } catch(e) {
        console.error('[PLUGIN] Error loading plugin ' + plugin.id + ':', e.message);
    }
}

function unloadPlugin(pluginId) {
    loadedPlugins.delete(pluginId);
}

function initPlugins() {
    var plugins = db.prepare("SELECT * FROM plugins WHERE enabled = 1").all();
    plugins.forEach(loadPlugin);
    console.log('[PLUGIN] Loaded ' + plugins.length + ' plugins');
}

// Disparar un hook: ejecuta todos los plugins suscritos
async function triggerHook(hookName, payload, eventId) {
    var results = [];
    for (var [pluginId, plugin] of loadedPlugins) {
        if (!plugin.hooks.includes(hookName)) continue;
        try {
            var script = plugin.script;
            if (!script) continue;
            // Verificar si el plugin está habilitado para este evento
            if (eventId) {
                var instance = db.prepare("SELECT enabled, settings FROM plugin_instances WHERE plugin_id = ? AND event_id = ?").get(pluginId, eventId);
                if (!instance || !instance.enabled) continue;
                plugin.sandbox.settings = {};
                try { plugin.sandbox.settings = JSON.parse(instance.settings || '{}'); } catch(e) {}
            }
            plugin.sandbox.payload = payload;
            plugin.sandbox.eventId = eventId;
            var context = vm.createContext(plugin.sandbox);
            plugin.vmContext = context;
            var wrappedScript = '"use strict";' + script;
            vm.runInContext(wrappedScript, context, { timeout: 5000 });
            results.push({ pluginId: pluginId, pluginName: plugin.name, success: true });
            // Log success
            try { db.prepare("INSERT INTO plugin_logs (id, plugin_id, event_id, hook, status) VALUES (?, ?, ?, ?, 'success')").run(
                require('uuid').v4(), pluginId, eventId || '', hookName
            ); } catch(e) {}
        } catch(e) {
            console.error('[PLUGIN] Error in plugin ' + plugin.name + ' hook ' + hookName + ':', e.message);
            results.push({ pluginId: pluginId, pluginName: plugin.name, success: false, error: e.message });
            try { db.prepare("INSERT INTO plugin_logs (id, plugin_id, event_id, hook, status, message) VALUES (?, ?, ?, ?, 'error', ?)").run(
                require('uuid').v4(), pluginId, eventId || '', hookName, e.message.substring(0, 500)
            ); } catch(e2) {}
        }
    }
    return results;
}

// Seed plugins iniciales
function seedDefaultPlugins() {
    var existing = db.prepare("SELECT COUNT(*) as c FROM plugins WHERE is_system = 1").get().c;
    if (existing > 0) return;
    var plugins = [
        {
            id: 'welcome-email',
            name: 'Email de bienvenida',
            description: 'Envía un email automático cuando un invitado se registra',
            version: '1.0.0',
            author: 'Check Pro',
            icon: '📧',
            hooks: JSON.stringify(['guest.registered']),
            script: `if (payload && payload.email) { console.log('[WELCOME] Would send email to ' + payload.email); }`,
            is_system: 1
        },
        {
            id: 'checkin-notifier',
            name: 'Notificador de check-in',
            description: 'Notifica al organizador cuando alguien hace check-in (modo kiosko)',
            version: '1.0.0',
            author: 'Check Pro',
            icon: '🔔',
            hooks: JSON.stringify(['guest.checked_in']),
            script: `if (payload && payload.name) { console.log('[CHECKIN] ' + payload.name + ' checked in'); }`,
            is_system: 1
        },
        {
            id: 'poll-announcer',
            name: 'Anunciador de encuestas',
            description: 'Envía una notificación push cuando se activa una nueva encuesta',
            version: '1.0.0',
            author: 'Check Pro',
            icon: '📊',
            hooks: JSON.stringify(['poll.voted']),
            script: `if (payload && payload.pollTitle) { console.log('[POLL] Vote recorded for: ' + payload.pollTitle); }`,
            is_system: 1
        }
    ];
    var insert = db.prepare("INSERT OR IGNORE INTO plugins (id, name, description, version, author, icon, hooks, script, is_system, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)");
    plugins.forEach(function(p) {
        try { insert.run(p.id, p.name, p.description, p.version, p.author, p.icon, p.hooks, p.script, p.is_system); } catch(e) {}
    });
    console.log('[PLUGIN] Seeded ' + plugins.length + ' default plugins');
}

module.exports = { initPlugins, triggerHook, loadPlugin, unloadPlugin, seedDefaultPlugins, HOOKS };
