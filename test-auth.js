const { db } = require('./database');
const bcrypt = require('bcryptjs');

async function testLogin(usernameInput) {
    console.log(`--- Test Login para: ${usernameInput} ---`);
    const username = usernameInput.toLowerCase();
    console.log(`Username normalizado: ${username}`);
    
    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!row) {
        console.log("RESULTADO: Usuario NO encontrado.");
        return;
    }
    
    console.log(`Usuario encontrado en DB: ${row.username}`);
    console.log(`Estado del usuario: ${row.status}`);
    
    // Test password match logic (we can't know the password, but we verify the bcrypt call wouldn't crash)
    try {
        const dummyPass = "any_password";
        const match = bcrypt.compareSync(dummyPass, row.password);
        console.log(`Lógica de Bcrypt OK (Match con pass dummy: ${match})`);
    } catch (e) {
        console.error("Error en lógica de Bcrypt:", e.message);
    }
    
    console.log("--- Fin del Test ---\n");
}

async function run() {
    await testLogin("admin@check.com");
    await testLogin("Admin@check.com"); // Test normalization
    await testLogin("nonexistent@void.com");
}

run();
