const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
    console.log("Iniciando navegador...");
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Capturar todos los errores
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error' || type === 'warning' || msg.text().includes('CHECK')) {
            console.log(`PAGE LOG [${type}]:`, msg.text());
        }
    });
    page.on('pageerror', err => {
        console.log('PAGE ERROR FATAL:', err.toString());
    });

    console.log("Navegando a localhost:3000...");
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    
    console.log("Esperando 2 segundos para asegurar carga CDN Tailwind...");
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Buscando el botón #login-nav-btn...");
    const btn = await page.$('#login-nav-btn');
    if (!btn) {
        console.log("No se encontró el botón. Tomando screenshot para ver qué pasa.");
        await page.screenshot({path: 'pre_click_error.png'});
    } else {
        console.log("Botón encontrado. Haciendo clic...");
        // Simulando clic real o evaluando JS
        await page.evaluate(() => document.getElementById('login-nav-btn').click());
        
        console.log("Clic ejecutado. Esperando 1 segundo (periodo del parpadeo reportado)...");
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Tomando screenshot al segundo 1...");
        await page.screenshot({path: 'post_click_1s.png'});
        
        console.log("Esperando 3 segundos más (pantalla blanca)...");
        await new Promise(r => setTimeout(r, 3000));
        
        console.log("Tomando screenshot del resultado final...");
        await page.screenshot({path: 'post_click_4s.png'});
        
        // Verificando visibilidad
        const vLogin = await page.evaluate(() => {
            const el = document.getElementById('view-login');
            return { display: el.style.display, visibility: el.style.visibility, opacity: el.style.opacity, classList: el.className };
        });
        const vReg = await page.evaluate(() => {
            const el = document.getElementById('view-registration');
            return { display: el.style.display, visibility: el.style.visibility, opacity: el.style.opacity, classList: el.className };
        });
        console.log("DOM State (view-login):", vLogin);
        console.log("DOM State (view-registration):", vReg);
    }
    
    await browser.close();
    console.log("Prueba forense completada.");
}

run().catch(console.error);
