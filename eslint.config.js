const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
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
            'no-duplicate-case': 'error',
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
                fetch: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                FormData: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                WebSocket: 'readonly',
                EventSource: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                console: 'readonly',
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
