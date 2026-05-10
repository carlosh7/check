# Documentación de Arquitectura — Check Pro

## Visión General

Check Pro es un sistema de gestión de eventos con arquitectura **monolítica modular**:
un solo servidor Node.js/Express que sirve API REST y frontend SPA, con comunicación
en tiempo real via Socket.IO.

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Node.js + Express | 20 LTS / Express 4.x |
| Base de datos | SQLite (better-sqlite3) | better-sqlite3 v10 |
| Frontend | Vanilla JS + HTML + CSS | ES6 Modules |
| Tiempo real | Socket.IO | 4.x |
| PWA | Service Worker + Web Push API | SW v3 |
| Testing | Jest + Supertest | Jest 30.x |
| E2E | Playwright | Chromium headless |
| CI | Husky (pre-commit hooks) | Husky 9.x |

## Estructura de Directorios

```
/
├── server.js              # Entry point, middleware stack
├── database.js            # Schema SQLite, migraciones, índices
├── setup.js               # Setup inicial (admin, config)
├── package.json           # Dependencias y scripts
├── .env                   # Configuración (no versionado)
├── data/                  # Persistencia local
├── src/
│   ├── routes/            # Módulos de API por recurso
│   │   ├── index.js       # Registro central de rutas
│   │   ├── auth.routes.js
│   │   ├── events.routes.js
│   │   ├── guests.routes.js
│   │   └── ... (30+ módulos)
│   ├── middleware/         # Auth, CSRF, rate limiting, validación IA
│   ├── security/          # JWT, cifrado, auditoría, captcha
│   ├── utils/             # Webhooks, cache, email, backup, helpers
│   ├── chatbot/           # Motor de chatbot (reglas + IA)
│   └── socket/            # Configuración Socket.IO
├── public/
│   ├── index.html         # Login SPA
│   ├── html/              # app-shell.html (SPA principal)
│   │   └── pages/         # Standalone: landing, portal, survey, calendar
│   ├── js/
│   │   ├── app.js         # ~20k líneas, lógica principal
│   │   ├── modules/       # ES6 modules: theme, push, components
│   │   └── lib/           # Librerías third-party
│   ├── css/               # CSS modular
│   │   └── modules/       # base, components, layout, forms, tables
│   └── sw.js              # Service Worker (offline, push, cache)
├── tests/                 # Jest + Supertest (243 tests)
├── sdk/                   # SDK oficial Node.js
├── mobile/                # Guía React Native
├── scripts/               # Utilidades (migrate-pg, etc.)
└── docs/                  # Documentación
    ├── ROADMAP.md         # Plan maestro (vitácora)
    ├── API_REFERENCE.md   # Referencia de endpoints
    └── user/              # Guías de usuario por módulo
```

## Flujo de Datos

```
Cliente (Browser/PWA)
    │
    ├── HTTP/HTTPS ──► Express (server.js)
    │                      │
    │                      ├── Middleware stack
    │                      │   ├── compression
    │                      │   ├── helmet (seguridad)
    │                      │   ├── cors
    │                      │   ├── express.json/raw
    │                      │   ├── rate limiting (18 limiters)
    │                      │   ├── security headers
    │                      │   └── CSRF protection
    │                      │
    │                      ├── Routes (src/routes/)
    │                      │   └── SQLite (better-sqlite3)
    │                      │
    │                      └── Response (JSON / HTML / PDF / Excel)
    │
    └── WebSocket (Socket.IO)
        └── Eventos en tiempo real
            ├── join_event / leave_event
            ├── live_checkin
            ├── update_stats
            ├── editing_guest / collab_update
            └── presence_heartbeat / presence_update
```

## Base de Datos

- **Motor:** SQLite (better-sqlite3, síncrono, embebido)
- **Modo WAL:** Write-Ahead Logging para lecturas concurrentes
- **BD Principal:** `data/system/database.db` (global: usuarios, eventos, config)
- **BD por Evento:** `data/events/{eventId}.db` (opcional, aislamiento de datos)
- **Migraciones:** ALTER TABLE con try/catch (schema evolutivo)
- **Índices:** 78+ índices CREATE INDEX
- **Optimización:** PRAGMA journal_mode=WAL, busy_timeout=5000, synchronous=NORMAL

## API

- **Formato:** JSON
- **Autenticación:** JWT (Bearer) o x-user-id (legacy) o x-api-key (pública)
- **Rate Limiting:** 18 limiters granulares por endpoint
- **Documentación:** `docs/API_REFERENCE.md`

## Seguridad

- **JWT** con expiry configurable
- **CSRF** tokens en mutaciones
- **Helmet** headers de seguridad
- **Rate limiting** por endpoint
- **2FA TOTP** con speakeasy
- **Cifrado AES-256-GCM** para datos sensibles
- **DLP** en prompts IA (enmascaramiento PII)
- **Auditoría** completa (audit_logs, change_log, deploy_logs)
- **GDPR** export/delete

## Despliegue

- **Plataforma:** Linux (Ubuntu) + Docker + Portainer
- **Proxy:** nginx-proxy-manager
- **Red:** proxy-network (Docker bridge)
- **Persistencia:** /home/data_check (volumen Docker)
- **Auto-deploy:** Webhook GitHub → app → Portainer (C6-14)
