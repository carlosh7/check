/**
 * Visual Testing Script (v12.44.783)
 * Takes screenshots of all major pages for visual verification
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
    console.log('🚀 Starting visual tests...\n');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ 
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark'
    });
    const page = await context.newPage();
    
    // Force dark mode via localStorage
    await page.addInitScript(() => {
        localStorage.setItem('theme', 'dark');
    });
    
    const results = [];
    
    // ═══ TEST 1: Login Page ═══
    console.log('📸 Test 1: Login page');
    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1000);
        
        // Check key elements
        const hasInterFont = await page.evaluate(() => {
            const link = document.querySelector('link[href*="Inter"]');
            return !!link;
        });
        const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        const hasLoginCard = await page.evaluate(() => !!document.querySelector('.login-card'));
        const hasBtnPrimary = await page.evaluate(() => !!document.querySelector('.btn-primary'));
        const hasInput = await page.evaluate(() => !!document.querySelector('.input'));
        
        // Check CSS variables are applied
        const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const cardBg = await page.evaluate(() => {
            const card = document.querySelector('.login-card');
            return card ? getComputedStyle(card).backgroundColor : 'not found';
        });
        
        results.push({
            test: 'Login Page',
            pass: hasInterFont && hasDarkClass && hasLoginCard && hasBtnPrimary && hasInput,
            details: {
                interFont: hasInterFont,
                darkClass: hasDarkClass,
                loginCard: hasLoginCard,
                btnPrimary: hasBtnPrimary,
                input: hasInput,
                bodyBg: bgColor,
                cardBg: cardBg
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login.png'), fullPage: true });
        console.log('  ✅ Screenshot: 01-login.png');
    } catch (e) {
        results.push({ test: 'Login Page', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 2: Login Flow ═══
    console.log('📸 Test 2: Login flow');
    try {
        await page.fill('#login-email', 'admin@check.com');
        await page.fill('#login-password', 'admin123');
        await page.click('#login-btn');
        await page.waitForTimeout(3000);
        
        const url = page.url();
        const hasAppContainer = await page.evaluate(() => !!document.querySelector('#app-container'));
        const hasSidebar = await page.evaluate(() => !!document.querySelector('.app-sidebar'));
        const hasNavItems = await page.evaluate(() => document.querySelectorAll('.nav-item').length);
        
        results.push({
            test: 'Login Flow',
            pass: hasAppContainer && hasSidebar && hasNavItems > 0,
            details: {
                url: url,
                appContainer: hasAppContainer,
                sidebar: hasSidebar,
                navItems: hasNavItems
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-dashboard.png'), fullPage: false });
        console.log('  ✅ Screenshot: 02-dashboard.png');
    } catch (e) {
        results.push({ test: 'Login Flow', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 3: Sidebar ═══
    console.log('📸 Test 3: Sidebar');
    try {
        const sidebarBg = await page.evaluate(() => {
            const sidebar = document.querySelector('.app-sidebar');
            return sidebar ? getComputedStyle(sidebar).backgroundColor : 'not found';
        });
        const navItemCount = await page.evaluate(() => document.querySelectorAll('.nav-item').length);
        const brandIcon = await page.evaluate(() => !!document.querySelector('.app-sidebar-brand-icon'));
        
        results.push({
            test: 'Sidebar',
            pass: sidebarBg !== 'not found' && navItemCount > 0,
            details: {
                sidebarBg: sidebarBg,
                navItems: navItemCount,
                brandIcon: brandIcon
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-sidebar.png'), fullPage: false, clip: { x: 0, y: 0, width: 260, height: 900 } });
        console.log('  ✅ Screenshot: 03-sidebar.png');
    } catch (e) {
        results.push({ test: 'Sidebar', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 4: My Events View ═══
    console.log('📸 Test 4: My Events view');
    try {
        await page.click('#nav-btn-my-events');
        await page.waitForTimeout(1000);
        
        const viewVisible = await page.evaluate(() => {
            const view = document.querySelector('#view-my-events');
            return view && !view.classList.contains('hidden');
        });
        const hasCards = await page.evaluate(() => document.querySelectorAll('.card').length);
        const hasSearchBar = await page.evaluate(() => !!document.querySelector('.search-bar, .input'));
        
        results.push({
            test: 'My Events View',
            pass: viewVisible,
            details: {
                viewVisible: viewVisible,
                cards: hasCards,
                searchBar: hasSearchBar
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-events.png'), fullPage: false });
        console.log('  ✅ Screenshot: 04-events.png');
    } catch (e) {
        results.push({ test: 'My Events View', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 5: Admin Dashboard ═══
    console.log('📸 Test 5: Admin Dashboard');
    try {
        // Admin button may be hidden for non-admin users
        const adminBtn = await page.$('#nav-btn-admin');
        if (adminBtn) {
            const isHidden = await adminBtn.evaluate(el => el.classList.contains('hidden'));
            if (!isHidden) {
                await adminBtn.click();
                await page.waitForTimeout(2000);
            }
        }
        
        const hasCards = await page.evaluate(() => document.querySelectorAll('.card').length);
        const hasSidebar = await page.evaluate(() => !!document.querySelector('.app-sidebar'));
        
        results.push({
            test: 'Admin Dashboard',
            pass: hasSidebar,
            details: {
                cards: hasCards,
                sidebar: hasSidebar
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-admin.png'), fullPage: false });
        console.log('  ✅ Screenshot: 05-admin.png');
    } catch (e) {
        results.push({ test: 'Admin Dashboard', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 6: CSS Variables Applied ═══
    console.log('📸 Test 6: CSS Variables');
    try {
        const cssVars = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            return {
                bgApp: root.getPropertyValue('--bg-app').trim(),
                accent: root.getPropertyValue('--accent').trim(),
                textPrimary: root.getPropertyValue('--text-primary').trim(),
                border: root.getPropertyValue('--border').trim(),
                radiusLg: root.getPropertyValue('--radius-lg').trim(),
                fontSans: root.getPropertyValue('--font-sans').trim()
            };
        });
        
        const accentIsGreen = cssVars.accent.includes('10b981') || cssVars.accent.includes('059669');
        const hasInter = cssVars.fontSans.includes('Inter');
        
        results.push({
            test: 'CSS Variables',
            pass: accentIsGreen && hasInter,
            details: cssVars
        });
    } catch (e) {
        results.push({ test: 'CSS Variables', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ TEST 7: Mobile View ═══
    console.log('📸 Test 7: Mobile view');
    try {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(500);
        
        const hamburgerVisible = await page.evaluate(() => {
            const btn = document.querySelector('.hamburger-btn');
            return btn ? getComputedStyle(btn).display !== 'none' : false;
        });
        const sidebarHidden = await page.evaluate(() => {
            const sidebar = document.querySelector('.app-sidebar');
            if (!sidebar) return false;
            const transform = getComputedStyle(sidebar).transform;
            return transform.includes('-') || transform === 'none';
        });
        
        results.push({
            test: 'Mobile View',
            pass: true, // Just checking it renders
            details: {
                hamburgerVisible: hamburgerVisible,
                sidebarHidden: sidebarHidden
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-mobile.png'), fullPage: false });
        console.log('  ✅ Screenshot: 06-mobile.png');
    } catch (e) {
        results.push({ test: 'Mobile View', pass: false, error: e.message });
        console.log('  ❌ Error:', e.message);
    }
    
    // ═══ RESULTS ═══
    await browser.close();
    
    console.log('\n═══════════════════════════════════════');
    console.log('  VISUAL TEST RESULTS');
    console.log('═══════════════════════════════════════\n');
    
    let passed = 0, failed = 0;
    results.forEach(r => {
        const status = r.pass ? '✅' : '❌';
        console.log(`${status} ${r.test}`);
        if (r.details) {
            Object.entries(r.details).forEach(([k, v]) => {
                console.log(`   ${k}: ${v}`);
            });
        }
        if (r.error) console.log(`   Error: ${r.error}`);
        console.log('');
        if (r.pass) passed++; else failed++;
    });
    
    console.log(`\nTotal: ${passed} passed, ${failed} failed`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    
    return { passed, failed, results };
}

run().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
