/**
 * test_login.js — Chequeo manual del endpoint de login contra un servidor vivo.
 * Uso: E2E_USER=tu@correo.com E2E_PASS='TuClave123' node tests/test_login.js
 * (v12.44.802: ya no trae credenciales por defecto — están prohibidas en el repo)
 */
async function run() {
    const username = process.env.E2E_USER || process.env.ADMIN_EMAIL;
    const password = process.env.E2E_PASS || process.env.ADMIN_PASSWORD;
    if (!username || !password) {
        console.error('✗ Faltan credenciales: define E2E_USER y E2E_PASS (o ADMIN_EMAIL y ADMIN_PASSWORD) en el entorno.');
        process.exit(1);
    }
    try {
        const res = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) { console.error(e); }
}
run();
