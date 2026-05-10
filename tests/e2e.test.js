const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:3456';
let serverProcess = null;
let browser = null;

function waitForServer(url, timeout = 30000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        function check() {
            http.get(url, (res) => { resolve(true); }).on('error', () => {
                if (Date.now() - start > timeout) reject(new Error('Server timeout'));
                else setTimeout(check, 500);
            });
        }
        check();
    });
}

beforeAll(async () => {
    process.env.PORT = '3456';
    process.env.DATA_PATH = path.resolve(__dirname, '..', 'data');
    serverProcess = require('child_process').spawn('node', ['server.js'], {
        env: { ...process.env, PORT: '3456', DATA_PATH: path.resolve(__dirname, '..', 'data') },
        stdio: 'pipe'
    });
    await waitForServer(BASE_URL + '/api/version');
    browser = await chromium.launch({ headless: true });
}, 60000);

afterAll(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
});

test('Homepage loads and shows login form', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.title();
    expect(title).toContain('Check');
    await page.close();
});

test('API health endpoint returns ok', async () => {
    const page = await browser.newPage();
    const res = await page.goto(BASE_URL + '/api/version');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('version');
    await page.close();
});

test('Login flow works', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.fill('input[type="email"], input[name="username"], input[id="login-email"]', 'admin@check.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Ingresar"), button:has-text("Login")');

    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('dashboard');
    await page.close();
});
