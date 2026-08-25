const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        files: ['scripts/test-all-features.js', 'scripts/audit-shots.js', 'scripts/test-create-event.js', 'scripts/visual-check.js'],
        languageOptions: { globals: {
            window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
            localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly'
        } }
    },
    {
        files: ['public/js/sw.js'],
        languageOptions: { globals: {
            self: 'readonly', caches: 'readonly', clients: 'readonly',
            skipWaiting: 'readonly', registration: 'readonly', fetch: 'readonly', Notification: 'readonly'
        } }
    },
    {
        files: ['tests/**/*.js', 'scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly',
                beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly',
                jest: 'readonly', document: 'readonly', window: 'readonly', navigator: 'readonly',
                localStorage: 'readonly', HTMLElement: 'readonly', getComputedStyle: 'readonly',
                requestAnimationFrame: 'readonly', File: 'readonly', Blob: 'readonly'
            }
        }
    },
    {
        files: ['public/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly', document: 'readonly', navigator: 'readonly',
                sessionStorage: 'readonly', localStorage: 'readonly',
                fetch: 'readonly', FormData: 'readonly', Blob: 'readonly', URL: 'readonly',
                AbortController: 'readonly', CustomEvent: 'readonly', location: 'readonly',
                history: 'readonly', alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
                io: 'readonly', Swal: 'readonly', Html5Qrcode: 'readonly', Quill: 'readonly',
                Chart: 'readonly', THREE: 'readonly', caches: 'readonly', FileReader: 'readonly',
                Notification: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
                crypto: 'readonly', btoa: 'readonly', atob: 'readonly', getComputedStyle: 'readonly',
                matchMedia: 'readonly', ResizeObserver: 'readonly', MutationObserver: 'readonly',
                IntersectionObserver: 'readonly', performance: 'readonly', history: 'readonly', Image: 'readonly', qrcode: 'readonly'
            }
        }
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                global: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^req$|^res$|^next$' }],
            'no-undef': 'error',
            'no-constant-condition': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'warn', // revisar dispatch legacy
            'no-unreachable': 'warn',
            'no-extra-semi': 'warn',
            'no-func-assign': 'error',
            'no-self-assign': 'error',
            'no-self-compare': 'error',
            'no-unmodified-loop-condition': 'warn',
            'no-unused-expressions': 'warn',
            'no-useless-return': 'warn',
            'no-throw-literal': 'warn',
            'no-return-await': 'warn',
            'require-await': 'warn',
            'no-async-promise-executor': 'error',
            'no-await-in-loop': 'warn',
            'no-promise-executor-return': 'warn',
            'prefer-const': 'warn',
            'no-var': 'warn'
        }
    },
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                App: 'readonly',
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                history: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                FormData: 'readonly',
                WebSocket: 'readonly',
                EventSource: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                Chart: 'readonly',
                Quill: 'readonly',
                ExcelJS: 'readonly',
                JSZip: 'readonly',
                saveAs: 'readonly',
                html2canvas: 'readonly',
                jspdf: 'readonly',
                QRCode: 'readonly',
                io: 'readonly',
                stripe: 'readonly',
                Swal: 'readonly',
                Pusher: 'readonly'
            }
        }
    },
    {
        ignores: [
            'node_modules/**',
            'persistence/**',
            'data/**',
            'uploads/**',
            'dist/**',
            'build/**',
            'public/js/vendor/**',
            'public/js/lib/**',
            '*.min.js'
        ]
    }
];
