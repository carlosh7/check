/**
 * Tests de carga para rutas principales (H-06)
 * 
 * Uso: node tests/load.test.js
 * Requiere: npm install autocannon -g
 * O: npx autocannon -c 10 -d 10 http://localhost:3000/api/health
 */
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINTS = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/version', method: 'GET' },
    { path: '/api/events/public', method: 'GET' },
];

async function runLoadTest() {
    console.log('=== Check Pro - Load Tests (H-06) ===');
    console.log('Target:', BASE_URL);
    console.log('');

    var totalRequests = 0;
    var totalErrors = 0;
    var totalTime = 0;
    var minTime = Infinity;
    var maxTime = 0;

    for (var e of ENDPOINTS) {
        console.log('Testing:', e.method, e.path);
        for (var i = 0; i < 10; i++) {
            var start = Date.now();
            try {
                await new Promise(function(resolve, reject) {
                    var req = http.request(BASE_URL + e.path, { method: e.method }, function(res) {
                        var body = '';
                        res.on('data', function(chunk) { body += chunk; });
                        res.on('end', function() {
                            var ms = Date.now() - start;
                            totalTime += ms;
                            minTime = Math.min(minTime, ms);
                            maxTime = Math.max(maxTime, ms);
                            totalRequests++;
                            if (res.statusCode >= 400) totalErrors++;
                            resolve();
                        });
                    });
                    req.on('error', function(err) { totalErrors++; totalRequests++; reject(err); });
                    req.end();
                });
            } catch (e) {
                totalErrors++;
            }
        }
        console.log('  -> OK (10 requests)');
    }

    console.log('');
    console.log('=== Results ===');
    console.log('Total requests:', totalRequests);
    console.log('Errors:', totalErrors);
    console.log('Avg time:', (totalTime / totalRequests).toFixed(0) + 'ms');
    console.log('Min time:', minTime + 'ms');
    console.log('Max time:', maxTime + 'ms');
    console.log('Success rate:', ((1 - totalErrors / totalRequests) * 100).toFixed(1) + '%');
}

runLoadTest().catch(console.error);
