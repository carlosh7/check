/**
 * i18n — Sistema de internacionalización (C2-06)
 * 
 * Uso:
 *   import { t, setLang, getLang } from './i18n.js';
 *   t('app.name'); // "Check Pro"
 *   setLang('en');
 *   t('app.name'); // "Check Pro" (same in English)
 */

const STORAGE_KEY = 'check_lang';
const DEFAULT_LANG = 'es';

let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
let translations = {};

async function loadLang(lang) {
    try {
        const res = await fetch('/js/lang/' + lang + '.json?v=12.44.753');
        if (res.ok) {
            translations = await res.json();
        } else {
            console.warn('[i18n] Language not found:', lang);
            translations = {};
        }
    } catch (e) {
        console.error('[i18n] Error loading language:', e.message);
        translations = {};
    }
    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        var val = getTranslation(key);
        if (val) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = val;
            } else {
                el.innerHTML = val;
            }
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-placeholder');
        var val = getTranslation(key);
        if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-title');
        var val = getTranslation(key);
        if (val) el.title = val;
    });
    document.documentElement.lang = currentLang;
}

function getTranslation(key) {
    if (!key) return '';
    var parts = key.split('.');
    var obj = translations;
    for (var i = 0; i < parts.length; i++) {
        if (obj && typeof obj === 'object' && parts[i] in obj) {
            obj = obj[parts[i]];
        } else {
            return '';
        }
    }
    return typeof obj === 'string' ? obj : '';
}

function setLang(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    // Also save to server if user is logged in
    try {
        if (window.App && window.App.state && window.App.state.user) {
            window.App.fetchAPI('/settings', { method: 'PUT', body: JSON.stringify({ language: lang }) }).catch(function() {});
        }
    } catch(e) {}
    loadLang(lang);
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
}

function getLang() {
    return currentLang;
}

function t(key) {
    return getTranslation(key) || key;
}

// Auto-init on load
document.addEventListener('DOMContentLoaded', function() {
    loadLang(currentLang);
});

// Also run if DOM is already ready
if (document.readyState !== 'loading') {
    loadLang(currentLang);
}

window.i18n = { t: t, setLang: setLang, getLang: getLang, loadLang: loadLang };

export { t, setLang, getLang, loadLang };
