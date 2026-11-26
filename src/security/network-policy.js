/**
 * Política de red saliente: prevención de SSRF (v12.44.846, auditoría 2026-11-25, S7)
 *
 * SSRF, en cristiano: engañar al servidor para que ÉL haga una petición que le
 * indique un usuario, hacia sitios a los que solo llega el servidor (su propia
 * base de datos, la red interna del dueño, el servicio de "metadata" de la nube
 * que entrega credenciales). El servidor es el chico de los recados: si se le
 * acepta cualquier dirección, acabará entrando donde no debe y trayendo la
 * respuesta de vuelta.
 *
 * Este módulo es el portero único de las peticiones salientes hacia direcciones
 * que vengan del usuario (webhooks, tiendas de e-commerce, ...). Reglas:
 *   1. Solo http:// y https://.
 *   2. Nombre de host con formato válido.
 *   3. Se resuelve el nombre (dns.lookup con { all: true }) y se RECHAZA el
 *      destino si ALGUNA de las direcciones es privada o reservada. Se miran
 *      todas, no solo la primera: un nombre que devuelva [pública, privada]
 *      está prohibido.
 *
 * Los rangos bloqueados son constantes de protocolo (no configuración de un
 * entorno concreto) y están documentados uno a uno abajo. La lista de
 * excepciones sí es configurable:
 *
 *   SSRF_ALLOWED_CIDRS   redes o direcciones privadas que el dueño PERMITE
 *                        explícitamente (p. ej. servicios self-hosted).
 *                        Formato: bloques CIDR o IP sueltas, separados por
 *                        comas. Ej.: "192.168.2.50/32,10.10.0.0/16,fd00::/8".
 *                        Por defecto: vacío = se bloquean todas las privadas y
 *                        reservadas. Una entrada mal escrita se ignora (nunca
 *                        abre nada) y se avisa por consola.
 *
 * Fallo cerrado: si una dirección no se puede resolver o no se puede validar,
 * el destino NO se permite.
 *
 * Pendiente de unificar en una fase posterior con este mismo portero:
 * src/routes/email.routes.js (peticiones salientes hacia buzones configurables).
 *
 * @module security/network-policy
 */

const dns = require('dns');
const net = require('net');

/** Tiempo máximo de espera para resolver un nombre. Si se agota, el destino se rechaza. */
const LOOKUP_TIMEOUT_MS = 5000;

/** Longitud máxima admitida para una URL. */
const MAX_URL_LENGTH = 2048;

/**
 * Nombre de host válido: etiquetas de 1 a 63 caracteres con letras, dígitos y
 * guion (se admite "_" porque hay nombres reales que lo usan), separadas por
 * puntos y hasta 253 caracteres en total. Se admite el punto final de un nombre
 * absoluto ("ejemplo.com.").
 */
const HOSTNAME_PATTERN = /^(?:[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?\.?$/i;

/**
 * Rangos IPv4 que NO son redes públicas: nadie aloja un webhook legítimo aquí,
 * y son justo a donde un SSRF quiere llegar.
 * Cada entrada: [red, prefijo, por qué].
 */
const RESERVED_V4_RANGES = [
    ['0.0.0.0', 8, 'RFC 791: "esta red" (incluye 0.0.0.0)'],
    ['10.0.0.0', 8, 'RFC 1918: red privada'],
    ['100.64.0.0', 10, 'RFC 6598: rango compartido (CGNAT; lo usan Tailscale y similares)'],
    ['127.0.0.0', 8, 'RFC 1122: loopback (la propia máquina)'],
    ['169.254.0.0', 16, 'RFC 3927: link-local. Incluye 169.254.169.254 (metadata de AWS/GCP/Azure/OpenStack, que entrega credenciales)'],
    ['172.16.0.0', 12, 'RFC 1918: red privada (172.16.0.0 - 172.31.255.255)'],
    ['192.0.0.0', 24, 'RFC 6890: asignaciones de la IETF'],
    ['192.0.2.0', 24, 'RFC 5737: TEST-NET-1 (documentación)'],
    ['192.88.99.0', 24, 'RFC 7526: relay 6to4 (deprecado)'],
    ['192.168.0.0', 16, 'RFC 1918: red privada'],
    ['198.18.0.0', 15, 'RFC 2544: pruebas de rendimiento (benchmarking)'],
    ['198.51.100.0', 24, 'RFC 5737: TEST-NET-2 (documentación)'],
    ['203.0.113.0', 24, 'RFC 5737: TEST-NET-3 (documentación)'],
    ['224.0.0.0', 4, 'RFC 1112: multidestino (multicast)'],
    ['240.0.0.0', 4, 'RFC 1112: reservado (clase E; incluye 255.255.255.255)']
].map(([base, prefix, why]) => ({ base, prefix, why, bytes: parseIpv4(base) }));

/**
 * Rangos IPv6 equivalentes (registro de "IPv6 Special-Purpose Address Registry" de la IANA).
 */
const RESERVED_V6_RANGES = [
    ['::', 128, 'RFC 4291: dirección no especificada'],
    ['::1', 128, 'RFC 4291: loopback (la propia máquina)'],
    ['::ffff:0:0', 96, 'RFC 4291: IPv4 mapeada (se evalúa como la IPv4 que lleva dentro)'],
    ['::ffff:0:0:0', 96, 'RFC 2765: IPv4 traducida (deprecada)'],
    ['64:ff9b::', 96, 'RFC 6052: NAT64 (se evalúa como la IPv4 que lleva dentro)'],
    ['64:ff9b:1::', 48, 'RFC 8215: NAT64 de uso local (se evalúa como la IPv4 que lleva dentro)'],
    ['100::', 64, 'RFC 6666: discard-only'],
    ['2001::', 23, 'IANA: asignaciones de la IETF (incluye Teredo 2001::/32)'],
    ['2001:db8::', 32, 'RFC 3849: documentación'],
    ['2002::', 16, 'RFC 7526: 6to4 (deprecado)'],
    ['3fff::', 20, 'RFC 9637: documentación'],
    ['5f00::', 16, 'RFC 9602: segment routing'],
    ['fc00::', 7, 'RFC 4193: direcciones locales únicas (ULA; el equivalente a las RFC 1918)'],
    ['fe80::', 10, 'RFC 4291: link-local'],
    ['fec0::', 10, 'RFC 3879: site-local (deprecada)'],
    ['ff00::', 8, 'RFC 4291: multidestino (multicast)']
].map(([base, prefix, why]) => ({ base, prefix, why, bytes: parseIpv6(base) }));

/** Prefijos cuya parte final es una IPv4 (NAT64). */
const NAT64_PREFIXES = RESERVED_V6_RANGES.filter(r => r.base === '64:ff9b::' || r.base === '64:ff9b:1::');

/** Nombre de la variable de entorno con las excepciones del dueño. */
const ALLOWED_CIDRS_ENV = 'SSRF_ALLOWED_CIDRS';

/**
 * Error de política de red. `code` distingue el motivo:
 *   INVALID_URL     formato (esquema, host, URL)
 *   SSRF_DNS_FAIL   el nombre no se pudo resolver
 *   SSRF_BLOCKED    el destino está en una red privada o reservada
 */
class NetworkPolicyError extends Error {
    constructor(message, code, detail) {
        super(message);
        this.name = 'NetworkPolicyError';
        this.code = code;
        this.detail = detail || null;
    }
}

// ─── Parseo de direcciones IP a bytes ───

/**
 * IPv4 en texto -> 4 bytes, o null si no es una IPv4 válida.
 * @param {string} ip
 * @returns {number[]|null}
 */
function parseIpv4(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip).trim());
    if (!m) return null;
    const out = [];
    for (let i = 1; i <= 4; i++) {
        const n = Number(m[i]);
        if (n > 255) return null;
        out.push(n);
    }
    return out;
}

/**
 * IPv6 en texto -> 16 bytes, o null si no es una IPv6 válida.
 * Admite corchetes, zona de enlace ("fe80::1%eth0") e IPv4 al final ("::ffff:1.2.3.4").
 * @param {string} ip
 * @returns {number[]|null}
 */
function parseIpv6(ip) {
    let s = String(ip).trim();
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    const zone = s.indexOf('%');
    if (zone !== -1) s = s.slice(0, zone);
    if (s.indexOf(':') === -1 || net.isIP(s) !== 6) return null;

    // IPv4 embebida al final: se quita del texto y se añade como bytes
    let tailV4 = null;
    const lastColon = s.lastIndexOf(':');
    if (s.slice(lastColon + 1).indexOf('.') !== -1) {
        tailV4 = parseIpv4(s.slice(lastColon + 1));
        if (!tailV4) return null;
        s = s.slice(0, lastColon + 1);
    }

    // Grupos de texto a cada lado de "::"
    const parts = [];
    let gapAt = -1;
    const dbl = s.indexOf('::');
    if (dbl !== -1) {
        if (s.indexOf('::', dbl + 1) !== -1) return null;
        const left = s.slice(0, dbl);
        const right = s.slice(dbl + 2);
        if (left) parts.push(...left.split(':').filter(p => p !== ''));
        gapAt = parts.length;
        if (right) parts.push(...right.split(':').filter(p => p !== ''));
    } else {
        parts.push(...s.split(':').filter(p => p !== ''));
    }
    if (parts.some(p => !/^[0-9a-fA-F]{1,4}$/.test(p))) return null;

    const textGroups = 8 - (tailV4 ? 2 : 0);
    const leftCount = gapAt === -1 ? 0 : gapAt;
    const gapCount = textGroups - parts.length;
    if (gapCount < 0 || (gapAt === -1 && gapCount !== 0)) return null;

    const groups = new Array(8).fill(0);
    for (let i = 0; i < parts.length; i++) {
        const slot = i < leftCount ? i : i + gapCount;
        groups[slot] = parseInt(parts[i], 16);
    }
    const bytes = [];
    for (const g of groups) bytes.push((g >> 8) & 0xff, g & 0xff);
    return tailV4 ? bytes.slice(0, 12).concat(tailV4) : bytes;
}

/**
 * IP (v4 o v6) -> bytes, o null si no es una IP válida.
 * @param {string} ip
 * @returns {number[]|null}
 */
function parseIp(ip) {
    const bytes4 = parseIpv4(ip);
    if (bytes4) return bytes4;
    const bytes6 = parseIpv6(ip);
    if (bytes6) return bytes6;
    return null;
}

/** ¿Los primeros 96 bits son 0...0 y los siguientes 16 bits son ffff? (::ffff:a.b.c.d) */
function isIpv4Mapped(bytes) {
    return bytes.length === 16 &&
        bytes.slice(0, 10).every(b => b === 0) &&
        bytes[10] === 0xff && bytes[11] === 0xff;
}

/** Si la dirección lleva una IPv4 dentro (mapeada o NAT64), la devuelve en bytes; si no, null. */
function embeddedIpv4(bytes) {
    if (bytes.length !== 16) return null;
    if (isIpv4Mapped(bytes)) return bytes.slice(12);
    for (const range of NAT64_PREFIXES) {
        if (cidrMatches(bytes, range.bytes, range.prefix)) return bytes.slice(12);
    }
    return null;
}

/** ¿La dirección (en bytes) cae dentro del bloque red/prefijo? */
function cidrMatches(ipBytes, netBytes, prefix) {
    if (ipBytes.length !== netBytes.length) return false;
    const fullBytes = Math.floor(prefix / 8);
    for (let i = 0; i < fullBytes; i++) {
        if (ipBytes[i] !== netBytes[i]) return false;
    }
    const rest = prefix % 8;
    if (rest === 0) return true;
    const mask = (0xff << (8 - rest)) & 0xff;
    return (ipBytes[fullBytes] & mask) === (netBytes[fullBytes] & mask);
}

// ─── Clasificación ───

function isReservedRangeBytes(bytes) {
    if (bytes.length === 4) {
        return RESERVED_V4_RANGES.some(r => cidrMatches(bytes, r.bytes, r.prefix));
    }
    const embedded = embeddedIpv4(bytes);
    if (embedded) return isReservedRangeBytes(embedded);
    return RESERVED_V6_RANGES.some(r => cidrMatches(bytes, r.bytes, r.prefix));
}

// ─── Excepciones configurables (SSRF_ALLOWED_CIDRS) ───

let allowedCidrsCache = { raw: null, ranges: [] };

/**
 * Lee y parsea SSRF_ALLOWED_CIDRS. Se re-lee si la variable cambia de valor.
 * Las entradas inválidas se descartan (nunca abren nada) y se avisa por consola.
 * @returns {{bytes: number[], prefix: number}[]}
 */
function getAllowedCidrs() {
    const raw = typeof process.env[ALLOWED_CIDRS_ENV] === 'string' ? process.env[ALLOWED_CIDRS_ENV] : '';
    if (allowedCidrsCache.raw === raw) return allowedCidrsCache.ranges;

    const ranges = [];
    const invalid = [];
    for (const entryRaw of raw.split(',')) {
        const entry = entryRaw.trim();
        if (entry === '') continue;
        const pieces = entry.split('/');
        const bytes = parseIp(pieces[0].trim());
        let prefix = bytes ? bytes.length * 8 : 0;
        if (pieces.length > 1) {
            const max = bytes ? bytes.length * 8 : 0;
            if (pieces.length !== 2 || !/^\d{1,3}$/.test(pieces[1]) || Number(pieces[1]) > max) prefix = -1;
            else prefix = Number(pieces[1]);
        }
        if (!bytes || prefix < 0) {
            invalid.push(entry);
            continue;
        }
        ranges.push({ bytes, prefix });
    }
    if (invalid.length > 0) {
        console.warn(`[NETWORK-POLICY] ${ALLOWED_CIDRS_ENV}: se ignoran entradas que no son un bloque CIDR ni una IP válidos: ${invalid.join(', ')}`);
    }
    allowedCidrsCache = { raw, ranges };
    return ranges;
}

/**
 * ¿Esta dirección cae en una de las redes que el dueño permitió por SSRF_ALLOWED_CIDRS?
 * Se comprueba tal cual y también la IPv4 que lleve dentro (mapeada / NAT64).
 */
function isAllowedByEnv(bytes) {
    const ranges = getAllowedCidrs();
    if (ranges.length === 0) return false;
    const embedded = embeddedIpv4(bytes);
    return ranges.some(r => cidrMatches(bytes, r.bytes, r.prefix) || (embedded !== null && cidrMatches(embedded, r.bytes, r.prefix)));
}

/**
 * ¿Esta IP está PROHIBIDA por la política de red vigente?
 * Tiene en cuenta SSRF_ALLOWED_CIDRS: una IP privada que el dueño permitió
 * explícitamente devuelve false. Para la clasificación pura, usar isReservedRangeIp.
 * Una cadena que no sea una IP válida se trata como prohibida (fallo cerrado).
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIp(ip) {
    const bytes = parseIp(ip);
    if (!bytes) return true;
    if (isAllowedByEnv(bytes)) return false;
    return isReservedRangeBytes(bytes);
}

/**
 * Clasificación pura: ¿esta IP pertenece a un rango privado o reservado,
 * sin mirar las excepciones de SSRF_ALLOWED_CIDRS?
 * @param {string} ip
 * @returns {boolean}
 */
function isReservedRangeIp(ip) {
    const bytes = parseIp(ip);
    if (!bytes) return true;
    return isReservedRangeBytes(bytes);
}

// ─── Validación de URL ───

function invalidUrl(message) {
    return new NetworkPolicyError(message, 'INVALID_URL');
}

/**
 * Valida el FORMATO de una URL saliente (sin resolver nada).
 * Lanza NetworkPolicyError con code INVALID_URL si no es http(s) con host válido.
 * @param {string} url
 * @returns {{href: string, protocol: string, hostname: string}} hostname sin corchetes ni puerto
 */
function parseHttpUrl(url) {
    if (typeof url !== 'string' || url.length === 0) {
        throw invalidUrl('URL inválida: se esperaba una dirección http(s) no vacía');
    }
    if (url.length > MAX_URL_LENGTH) {
        throw invalidUrl('URL inválida: demasiado larga');
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_) {
        throw invalidUrl('URL inválida');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw invalidUrl('URL inválida: solo se permiten las direcciones http:// y https://');
    }
    // El parser de URL ya normaliza las formas raras de IPv4 (2130706433, 0x7f.0.0.1,
    // 0177.0.0.1 -> 127.0.0.1), así que aquí llega o una IP canónica o un nombre.
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(hostname) === 0) {
        if (hostname.length > 253 || !HOSTNAME_PATTERN.test(hostname) ||
            hostname.split('.').some(label => label.length > 63)) {
            throw invalidUrl('URL inválida: el nombre de host no tiene un formato válido');
        }
    }
    return { href: parsed.href, protocol: parsed.protocol, hostname };
}

/**
 * Resuelve un nombre de host con TODAS sus direcciones (IPv4 e IPv6), igual que
 * haría la conexión real (dns.lookup pasa por /etc/hosts y el resolvedor del sistema).
 * Lanza NetworkPolicyError con code SSRF_DNS_FAIL si no resuelve o tarda demasiado.
 * @param {string} hostname
 * @returns {Promise<{address: string, family: number}[]>}
 */
function resolveHostAddresses(hostname) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (message) => reject(new NetworkPolicyError(message, 'SSRF_DNS_FAIL', { hostname }));
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            fail(`No se pudo resolver el nombre de host ${hostname}: el DNS no respondió a tiempo`);
        }, LOOKUP_TIMEOUT_MS);

        dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (err) return fail(`No se pudo resolver el nombre de host ${hostname}`);
            if (!Array.isArray(addresses) || addresses.length === 0) {
                return fail(`No se pudo resolver el nombre de host ${hostname}`);
            }
            resolve(addresses.map(entry => ({ address: entry.address, family: net.isIP(entry.address) })));
        });
    });
}

/**
 * Garantiza que una URL apunta a un destino público, o lanza NetworkPolicyError.
 * Es la puerta que debe usar toda petición saliente hacia una URL del usuario.
 * Fallo cerrado: sin formato válido, sin resolución o con ALGUNA dirección
 * privada/reservada (que no esté exceptuada en SSRF_ALLOWED_CIDRS) se rechaza.
 * @param {string} url
 * @returns {Promise<{url: string, hostname: string, addresses: {address: string, family: number}[]}>}
 * @throws {NetworkPolicyError} code INVALID_URL | SSRF_DNS_FAIL | SSRF_BLOCKED
 */
async function assertPublicUrl(url) {
    const target = parseHttpUrl(url);
    const literalFamily = net.isIP(target.hostname);
    // Si el host ya es una IP no hace falta resolver: se evalúa directamente
    const addresses = literalFamily
        ? [{ address: target.hostname, family: literalFamily }]
        : await resolveHostAddresses(target.hostname);

    for (const entry of addresses) {
        if (isPrivateOrReservedIp(entry.address)) {
            throw new NetworkPolicyError(
                'Destino bloqueado: está en una red privada o reservada (prevención de SSRF)',
                'SSRF_BLOCKED',
                { hostname: target.hostname, ip: entry.address }
            );
        }
    }
    return { url: target.href, hostname: target.hostname, addresses };
}

/**
 * Versión de assertPublicUrl que nunca lanza. `reason` es el mensaje para el
 * usuario (no revela direcciones internas); `ip` solo va a logs del servidor.
 * @param {string} url
 * @returns {Promise<{allowed: boolean, reason: string|null, code: string|null, hostname?: string, ip?: string, addresses?: {address: string, family: number}[]}>}
 */
async function checkUrlAllowed(url) {
    try {
        const target = await assertPublicUrl(url);
        return { allowed: true, reason: null, code: null, hostname: target.hostname, addresses: target.addresses };
    } catch (error) {
        if (error instanceof NetworkPolicyError) {
            return {
                allowed: false,
                reason: error.message,
                code: error.code,
                hostname: error.detail ? error.detail.hostname : undefined,
                ip: error.detail ? error.detail.ip : undefined
            };
        }
        // Cualquier fallo inesperado también deja el destino fuera (fallo cerrado)
        return { allowed: false, reason: 'No se pudo validar el destino', code: 'SSRF_CHECK_FAILED' };
    }
}

/**
 * Función `lookup` para http.request / https.request que responde SIEMPRE con las
 * direcciones ya validadas. Cierra el "DNS rebinding": un atacante que conteste
 * con una IP pública a la validación y con una privada a la conexión real ya no
 * puede colarla, porque la conexión no vuelve a preguntar al DNS.
 * El hostname que pida la conexión debe coincidir con el que se validó.
 * @param {{address: string, family: number}[]} addresses  las devueltas por checkUrlAllowed/assertPublicUrl
 * @param {string} expectedHostname
 * @returns {(hostname: string, options: object, callback: Function) => void}
 */
function createPinnedLookup(addresses, expectedHostname) {
    const expected = String(expectedHostname).toLowerCase();
    const pinned = (Array.isArray(addresses) ? addresses : []).map(entry => ({ address: entry.address, family: entry.family }));
    return function pinnedLookup(hostname, options, callback) {
        const cb = typeof options === 'function' ? options : callback;
        if (typeof cb !== 'function') return;
        if (pinned.length === 0 || String(hostname).toLowerCase() !== expected) {
            const err = new Error(`Búsqueda de ${hostname} bloqueada: no coincide con el destino validado`);
            err.code = 'ENOTFOUND';
            err.syscall = 'lookup';
            return cb(err);
        }
        if (options && options.all) return cb(null, pinned.map(entry => ({ address: entry.address, family: entry.family })));
        return cb(null, pinned[0].address, pinned[0].family);
    };
}

module.exports = {
    NetworkPolicyError,
    ALLOWED_CIDRS_ENV,
    parseHttpUrl,
    resolveHostAddresses,
    isPrivateOrReservedIp,
    isReservedRangeIp,
    assertPublicUrl,
    checkUrlAllowed,
    createPinnedLookup
};
