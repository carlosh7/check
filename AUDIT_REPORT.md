# AUDIT_REPORT.md — Check Pro v12.44.783

**Auditoría técnica independiente** · Fecha: 2026-08-21 · Alcance: commit `85f52be` (1.955 commits)
**Método:** análisis estático + verificación runtime real (`npm ci`, tests, arranque, curl). No se modificó código fuente.

---

## 1. Resumen Ejecutivo

Check Pro es un sistema de gestión de eventos e invitados (Node.js + Express + SQLite + frontend vanilla JS) con **~55.000 LOC propias, 458 endpoints API en ~40 routers y una documentación excepcionalmente completa** (roadmap, guías de usuario por módulo, arquitectura). El producto es real y funcional en instalaciones existentes: login JWT, CRUD de eventos/invitados, check-in QR, encuestas, ruleta, pagos, mailing y más están implementados y operan.

Sin embargo, la auditoría runtime destapa **3 problemas P0 que rompen la experiencia de primera instalación y exponen el servidor**:

1. **Instalación fresca rota**: `src/utils/schema.js:1481` usa `uuidv4()` sin importarlo → `ReferenceError` al crear el admin inicial → el servidor no arranca en BD nueva.
2. **`DATA_PATH=/home/data_check`** en `.env.example` requiere permisos root y su fallo se resuelve con `process.exit(1)` silencioso que además **mata la suite de Jest completa**.
3. **Exposición del directorio raíz del proyecto por HTTP** (`server.js:274` sirve `express.static(__dirname)`): `/package.json`, `/server.js`, `/database.js`, `/docker-compose.yml` descargables públicamente (verificado con curl). Solo los dotfiles escapan.

**SCORE GLOBAL: 62/100** — Producto maduro y ambicioso cuya deuda técnica se concentra en bootstrap/deploy, higiene estática y superficie de exposición, no en falta de funcionalidad.

---

## 2. Inventario Técnico (Dimensión 1)

| Componente | Tecnología | Versión | Estado |
|---|---|---|---|
| Runtime | Node.js 22 | LTS | ✅ |
| Backend | Express | 4.22.1 (latest: 5.2) | ⚠️ major atrás |
| BD | better-sqlite3 + WAL | 12.8 (latest 13) | ✅ |
| Frontend | Vanilla JS ES modules, HTML, CSS modular | — | ✅ |
| Tiempo real | Socket.io | 4.7.5 | ✅ |
| Auth | jsonwebtoken HS256 + bcryptjs + blacklist jti | jwt 9 / bcryptjs 2.4 (latest 3) | ✅/⚠️ |
| Pagos/SMS/Email | Stripe 22, Twilio 6, Nodemailer 8, IMAPFlow | — | ✅ |
| IA/Extras | googleapis 140 (-36 majors), redis 6, sharp 0.33, zod 3 | — | ⚠️ |
| Tests | Jest 30 + Supertest + Playwright (no CI config visible) | — | ✅ |
| Deploy | Docker + docker-compose + Portainer webhook auto-deploy | — | ✅ |

**No es monorepo**: app única con SDK interno (`sdk/`) y docs OpenAPI parcial (`src/docs/api/*.yaml`). Sin TypeScript (solo `sdk/index.d.ts`, que pasa `tsc --strict --noEmit` sin errores). Build: **no existe paso de build** (vanilla JS servido directo) — documentado como N/A.

Dependencias totales: 948 paquetes instalados vía `npm ci` ✓ (11s).

## 3. Estado Real de Avance vs Documentación (Dimensión 2)

- `docs/ROADMAP.md` declara "Fases 0-4, S, backlog, Ciclos 2-11 completados al 100%". **En líneas generales es creíble**: los módulos existen, hay 458 endpoints reales montados, 235 tests ejecutables pasan, y las guías de usuario (`docs/user/01..09`) cubren eventos, invitados, ruleta, mailing, pagos, webhooks, administración.
- **"Caja vacía" detectada (menor)**:
  - `tests/visual.test.js`: el último commit dice "visual tests 7/7", pero el archivo es un script Playwright standalone **sin ningún test Jest** → la suite falla al correrla ("must contain at least one test").
  - Integraciones pesadas (Stripe/Twilio/Redis/chatbot) tienen rutas montadas pero no fue posible verificar credenciales/e2e; probablemente dependientes de entorno.
  - Drift documental: ROADMAP menciona BD maestra `check_app.db`; el código actual usa `data/system/database.db` (+ DBs por evento vía `database-manager.js`). README aún referencia estructura antigua (script.js/style.css en raíz).
- **Completitud real estimada: ~80–85%** del roadmap prometido (core 95%+; integraciones externas y bootstrap fresco por debajo).

## 4. Calidad de Código (Dimensión 3)

Evidencia ESLint (`npx eslint .`): **3.773 problemas (1.031 errores, 2.742 warnings)**.

| Regla | Count | Comentario |
|---|---|---|
| no-var | 1.719 | estilo legacy masivo |
| no-undef | 985 | mayoría `document` en archivos frontend (config env de ESLint incorrecta para código browser) |
| no-unused-vars | 727 | dead code significativo |
| prefer-const | 147 | |
| require-await | 90 | async innecesario |
| no-await-in-loop | 46 | posibles N+1 |

Otros indicadores:
- **`public/js/app.js`: 19.005 líneas** — monolito frontend que contradice la modularización anunciada (`public/js/modules/*` coexiste sin migración completa).
- 85 `console.log` residuales en backend pese a tener logger estructurado (`src/utils/logger.js`).
- Artefactos de generación IA con **caracteres chinos en código/comentarios**: `server.js:48` (`始于`), `server.js:453` (`接受ir`), `jwt.js:41` (`检查`) — señal de revisión humana insuficiente.
- `routes/index.js:13` usa `logger` antes de definirlo (solo falla si sharp no está instalado — latent bug).
- `database.js` 1.496 líneas + `schema.js` 1.931: refactor reciente dejó imports rotos (ver P0-1).
- TODO/FIXME: solo 8 — baja deuda declarada, buena señal.

## 5. Bugs Concretos (Dimensión 4)

| ID | Severidad | Archivo:línea | Descripción |
|---|---|---|---|
| B-1 | **P0** | `src/utils/schema.js:1481` | `uuidv4 is not defined` (import faltante tras refactor). En BD vacía, `initSchema()` lanza ReferenceError → `require('./database')` falla → **el servidor no puede bootstrapear instalación nueva** (reproducido en tests). |
| B-2 | **P0** | `server.js:274` | `express.static(path.join(__dirname,'/'))` expone código fuente y artefactos por HTTP (ver §6). |
| B-3 | **P1** | `.env.example:22` + `database.js:11-39` | `DATA_PATH=/home/data_check` inaccesible sin root; `mkdirSync` falla silenciosamente (catch traga error), write-test falla → `process.exit(1)`. Instalación según README (`npm start`) muere sin remedio para usuario no-root. |
| B-4 | **P1** | `package.json:11` (`test`) | La suite estándar **se autodestruye**: `tests/backend.test.js` requiere `database.js` → `process.exit(1)` mata el runner de Jest completo (reproducido: log con 23 líneas). Además backend.test.js nunca termina sin `--forceExit` (open handles: schedulers/socket); solo `test:e2e` lo tiene. |
| B-5 | **P2** | `tests/visual.test.js` (todo) | Script Playwright sin tests Jest → suite siempre roja en `npm test`. |
| B-6 | **P2** | `src/middleware/auth.js:51-53` | Acepta JWT por query param (`?token=`) → filtración de tokens en logs/proxies/referrer. |
| B-7 | **P2** | `src/routes/index.js:8-15` | `logger.warn` usado antes de definir `logger` (línea 112, scope función): si `sharp` faltara, el catch lanzaría ReferenceError. |
| B-8 | **P3** | `server.js:82` | Socket.io arranca con CORS `origin:'*'`; se corrige a posteriori en línea 439 — ventana de riesgo y fragilidad. |
| B-9 | **P3** | `docs/ROADMAP.md`, `README.md:297-310` | Docs referencian `check_app.db`, `script.js`, `style.css` inexistentes hoy (drift). |

Revisión manual de rutas críticas: queries parametrizadas (prepared statements) en guests/public/events ✓; authZ verificada runtime (401 sin token, datos correctos con token) ✓; bcrypt + status APPROVED en login ✓; CSRF global + raw body para Stripe/GitHub webhooks ✓. Async races: SQLite síncrono evita la mayoría; los 46 `await-in-loop` son candidatos a transacción/lote.

## 6. Seguridad (Dimensión 5)

### npm audit
- **Producción: 23 vulnerabilidades (12 high, 10 moderate, 1 low)** — destacan CVEs heredadas de libvips vía sharp (CVE-2026-33327/33328/35590/35591).
- Total con dev: 26 (14 high).

### gitleaks (`~/.local/bin/gitleaks detect`, 1.943 commits escaneados)
5 hallazgos, todos de baja severidad real: placeholders en `.env.example` (`genera_una_clave_unica` ×2), `sk_test_placeholder` en `payments.routes.js:9`, claves VAPID de ejemplo en `setup.js:20,37`. **Sin secretos reales filtrados en historial** ✓.

### Revisión manual
- 🔴 **P0 — Exposición de raíz del proyecto** (`server.js:274`): verificado con curl contra servidor vivo:
  ```
  200 /package.json   200 /database.js   200 /server.js   200 /docker-compose.yml
  404 /.env           404 /data/system/database.db (solo porque DATA_PATH apunta fuera)
  ```
  En un despliegue sin `DATA_PATH` externo, **la base de datos SQLite completa quedaría descargable** en `/data/system/database.db`.
- 🟠 **P1 — Secretos con default débil conocido**: `.env.example` incluye `JWT_SECRET=genera_una_clave_unica` y `ADMIN_PASSWORD=changeme123`. Si el operador no edita, los tokens son falsificables con clave pública en el repo (jwt.js exige presencia, no fortaleza).
- 🟠 CSP con `'unsafe-inline'` + 4 CDNs (`server.js:134-136`) y `frameSrc:*`: debilita la defensa XSS del frontend (que renderiza HTML dinámico).
- ✅ Fortalezas: helmet completo, rate limiting granular (~25 buckets), CSRF middleware, bcrypt, blacklist JWT con jti + limpieza programada, audit logging, path-traversal guard en /uploads, multer con límites y mime-whitelist, Swagger desactivado en producción.

## 7. Eficiencia (Dimensión 6)

✅ Positivo: paginación real en guests (`guests.routes.js:119-155` LIMIT/OFFSET), índices compuestos documentados y creados (`schema.js`, `scripts/create_indexes.js`), cache settings con TTL (database.js:64-77), NodeCache global + Redis opcional, compresión gzip, WAL + busy_timeout + cache_size pragmas.
⚠️ Mejorable: 46 `await-in-loop` (N+1 potenciales, p.ej. loops de inserción en import/email); `SELECT * FROM guests` sin paginación en badges/report/export (aceptable para PDFs pero riesgoso en eventos grandes); sync worker de Google Sheets sin backoff visible.

## 8. Actualización Tecnológica (Dimensión 7)

`npm outdated` (resumen): express 4→**5**, multer 1.4.5-lts→**2** (línea legacy EOL-prone), helmet 7→8, better-sqlite3 12→13, bcryptjs 2→3, nodemailer 8→9, dotenv 16→17, pdf-parse 1→2, googleapis 140→**176**, express-rate-limit 7→8, lint-staged 15→17. Dev deps al día (Jest 30.x, ESLint 10.x, Playwright 1.62). Migraciones recomendadas: multer→2 (seguridad activa), express→5 (planificado), sharp 0.35 (cierra los 4 CVE libvips).

## 9. Diseño & Arquitectura / UX (Dimensión 8)

- Arquitectura backend **profesional**: capas claras (routes/middleware/security/utils/engine), DB maestra + DB por evento con aislamiento, plugins engine, webhooks, backups automáticos cada 6h, graceful shutdown, migrations runner.
- Frontend: rediseño "Minimalista Premium" reciente (commit f45b6d9), CSS modular en `public/css/modules/`, dark mode, i18n (es/en), PWA con service worker versionado, páginas kiosko/portal/ruleta/survey. Pero convive con el monolito `app.js` de 19k líneas (arquitectura a medio migrar).
- UX: no evaluada visualmente en esta auditoría (el script de screenshots requiere server + Playwright browsers; documentado como limitación). Por estructura (guías de usuario por módulo, flujos QR públicos, kiosko) el diseño de producto es sólido. **Veredicto: profesional en backend, básico-profesional en frontend, con inconsistencia por la migración modular inconclusa.**

## 10. Runtime REAL (Dimensión 9)

| Paso | Comando | Resultado |
|---|---|---|
| Install | `npm ci` | ✅ 948 paquetes, 11s |
| Test (estándar) | `npm test` | ❌ **CRASHEA**: database.js:39 `process.exit(1)` mata Jest tras 1 suite (log: 23 líneas, exit=1) |
| Test (suites individuales, `DATA_PATH=/tmp/opencode/data_check`) | `npx jest <suite>` | ✅ **235/235 tests pasan** en 10 suites (backend 91, security 27, ai/validation 16, form 17, helpers 17, helpers.security 17, middleware 15, dropdown 12, ai/dlp 10, ai/audit 7, ai/hardening 6) |
| Suites rotas | api.test.js, visual.test.js | ❌ api: ReferenceError uuidv4; visual: 0 tests |
| tsc | `tsc --noEmit sdk/index.d.ts` | ✅ sin errores |
| eslint | `npx eslint .` | ❌ 1.031 errores / 2.742 warnings |
| Build | N/A (sin build step) | — |
| Arranque | `DATA_PATH=/tmp/opencode/data_check PORT=3777 node server.js` | ✅ arriba en ~5s (tras sembrar admin manualmente, porque el seed automático falla por B-1) |
| Login | POST `/api/login` admin@check.com/admin123 | ✅ token JWT válido emitido |
| API autenticada | GET `/api/events` con/sin Bearer | ✅ 200 con token / ✅ 401 sin token |
| Exposición estática | GET `/package.json`, `/server.js`, etc. | ❌ 200 en todos (P0) |

**Nota metodológica:** `npm test` reportado tal cual (crash). Para cuantificar, las suites se ejecutaron individualmente con `DATA_PATH` temporal corregido — ninguna prueba ejecutada falló.

---

## 11. Score Global Desglosado

| Dimensión | Peso | Score | Justificación breve |
|---|---:|---:|---|
| Avance real | 20% | **78** | Core funcional y extenso; bootstrap fresco roto, visual tests fantasma, drift docs |
| Calidad de código | 15% | **55** | 1.031 errores lint, monolito 19k LOC, dead code, artefactos IA |
| Bugs | 15% | **50** | 2×P0 funcionales/exposición + suite de tests autodestructiva |
| Seguridad | 20% | **52** | Exposición raíz confirmada, secrets default débiles, 23 vulns prod; compensa con stack defensivo amplio |
| Eficiencia | 10% | **70** | Caching/index/paginación presentes; N+1 puntuales |
| Stack actual | 5% | **55** | 14 majors atrás en clave; multer 1.x legacy; CVEs sharp |
| Diseño/Arquitectura | 15% | **72** | Backend profesional; frontend a medio migrar; UX no verificada visualmente |
| **GLOBAL** | 100% | **62/100** | Producto maduro con riesgos concentrados en deploy/exposición |

## 12. Tabla Consolidada de Hallazgos

| ID | Sev | Hallazgo | Ubicación |
|---|---|---|---|
| P0-1 | P0 | Bootstrap instalación fresca roto (`uuidv4` sin import) | src/utils/schema.js:1481 |
| P0-2 | P0 | Raíz del proyecto servida por HTTP (código fuente; riesgo de descargar BD) | server.js:274 |
| P0-3 | P0 | `npm test` se autodestruye vía `process.exit(1)` en require de BD | database.js:39 + tests/backend.test.js:9 |
| P1-1 | P1 | `DATA_PATH=/home/data_check` imposible sin root; fallo silencioso→exit | .env.example:22, database.js:11-39 |
| P1-2 | P1 | JWT_SECRET/ADMIN_PASSWORD con defaults débiles shipeados | .env.example:5,16 |
| P1-3 | P1 | backend.test.js cuelga Jest (open handles sin --forceExit) | package.json:11 |
| P2-1 | P2 | Token JWT aceptado por query string | src/middleware/auth.js:51 |
| P2-2 | P2 | Suite visual.test.js sin tests (falsa señal de cobertura) | tests/visual.test.js |
| P2-3 | P2 | CSP con unsafe-inline + frameSrc * | server.js:134-142 |
| P2-4 | P2 | `logger` usado antes de definirse en catch de import sharp | src/routes/index.js:13,112 |
| P3-1 | P3 | 23 vulnerabilidades en deps de producción (sharp/libvips high) | package.json deps |
| P3-2 | P3 | Caracteres chinos residuales en código (artefactos IA) | server.js:48,453; jwt.js:41 |
| P3-3 | P3 | 85 console.log residuales en backend | src/, database.js, server.js |
| P3-4 | P3 | Drift documental (check_app.db, script.css, estructura vieja) | README.md:297-360, docs/ROADMAP.md |
| P3-5 | P3 | Socket.io CORS `'*'` inicial antes de corrección async | server.js:82,439 |

*Limitaciones de auditoría: UX visual no evaluada en navegador; integraciones externas (Stripe/Twilio/Google) probadas solo hasta nivel de ruta; e2e/load excluidos según configuración del propio proyecto.*
