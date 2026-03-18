const fetch = require('node-fetch'); // wait, fetch is built-in in recent node
async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: "admin@check.com", password: "admin123" })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) { console.error(e); }
}
run();
