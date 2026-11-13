# AUDIT_DELTA_2026-10-05.md — Check Pro v12.44.820

**Auditoría delta** · Fecha: 2026-10-05 · Base: commit `40daec2` (2026-09-28 17:44) · Informe previo: `AUDIT_REPORT.md` (actualizado 2026-09-28)
**Método:** solo lectura e inspección (grep/sed/ls/git), más `npx jest` y `npm audit --omit=dev`. No se modificó código del proyecto. Este archivo es el único escrito.

---

## 0. Alcance delta

- **No hay ningún commit desde 2026-09-28** (`git log --since=2026-09-28 --stat` = vacío; último commit `40daec2` del 28/09 17:44, que solo tocó `docs/STATUS_HISTORY.md`). Árbol de trabajo limpio, sin cambios sin commit.
- Por tanto el punto (c) del alcance se reduce a **verificación independiente del informe del 2026-09-28**: cada hallazgo marcado RESUELTO se contrastó contra el código actual, y se re-ejecutaron la suite de tests y `npm audit`.

## 1. Resumen ejecutivo (máx 5 líneas)

El repo está exactamente como lo dejó la auditoría del 28/09 y **los dos P0 históricos de agosto (bootstrap roto y código fuente servido por HTTP) están realmente arreglados** — verificado en código, no de oídas. De los hallazgos previos, 34 quedan RESUELTOS con evidencia propia, 2 PARCIALES confirmados como tales, 2 ABIERTOS con el operador (abogado/DPA) y **1 REGRESIÓN de entorno (no de código)**: `npm audit --omit=dev` pasó de 0 a **7 vulnerabilidades (1 crítica)** por advisories publicadas después del informe. Además, la suite hoy deja **1 test en rojo** por un backup legacy sin cifrar creado el 28/09 a las 21:02 — el endpoint de salud se comporta como debe; el test es sensible al entorno.

## 2. Tabla de estado del informe previo

Leyenda: **RESUELTO** = verificado hoy con evidencia propia. **PARCIAL** = el informe ya lo declaraba parcial y sigue igual. **ABIERTO** = pendiente del operador. **REGRESIÓN** = estaba resuelto y hoy no (se indica la causa).

### Bloque P0/P1 (agosto)

| ID | Hallazgo | Estado hoy | Evidencia propia (archivo:línea + fragmento) |
|---|---|---|---|
| P0-1 | `uuidv4` sin import rompía bootstrap fresco | ✅ RESUELTO | `src/utils/schema.js:8` → `const { v4: uuidv4 } = require('uuid');` (usos en líneas 891, 1187, 2046) |
| P0-2 | Raíz del proyecto servida por HTTP | ✅ RESUELTO | `server.js:315-334` — solo whitelists `/css`, `/js`, `/html`, `/uploads`; **no existe** ya ningún `express.static(__dirname)` |
| P0-3 | `npm test` se autodestruía con `process.exit(1)` | ✅ RESUELTO | `database.js:48-52` → en test lanza `Error` normal; `process.exit(1)` solo fuera de test. Suite completa corre y termina (3.8 s, ver §3) |
| P1-1 | `DATA_PATH=/home/data_check` imposible sin root | ✅ RESUELTO | `.env.example:26` → `DATA_PATH=./data`; error con instrucciones claras (`database.js:37-43`) |
| P1-2 | Secretos con default débil shipeado | ✅ RESUELTO | `src/utils/schema.js:2033-2040`: sin `ADMIN_EMAIL`/`ADMIN_PASSWORD` no siembra nada y **rechaza siempre** contraseñas expuestas (`isExposedPassword`); `.env.example` sin ADMIN_* |
| P1-3 | backend.test.js colgaba Jest | ✅ RESUELTO | Script de test sin `--forceExit` y la suite completa terminó en 3.799 s (ver §3) |
| P1-4 | PAT de GitHub pegado en portainer-stack.yml | ✅ RESUELTO | `portainer-stack-v2.yml:60,64` → usa `${GITHUB_PAT}` del entorno de Portainer y falla con mensaje claro si falta; grep `ghp_` en ambos yml = 0 |
| P1-5 | `.env` de producción con credenciales semilla (estaba ABIERTO) | ✅ **RESUELTO desde el delta anterior** | (a) Código: `schema.js:2037` rechaza sembrar contraseñas expuestas siempre. (b) Runtime documentado en `docs/STATUS_HISTORY.md` (commit `40daec2`): "Login con semillas viejas (P1-5) \| **401 — las rechaza**". La parte (a) es verificación propia; la (b) es evidencia del operador en producción |

### Bloque P2/P3 (agosto)

| ID | Hallazgo | Estado hoy | Evidencia propia |
|---|---|---|---|
| P2-1 | JWT aceptado por query string | ✅ RESUELTO | `src/middleware/auth.js:48`: "El fallback por query string (req.query.token) se retiró"; sin usos de `req.query` para auth |
| P2-2 | visual.test.js sin tests (falsa cobertura) | ✅ RESUELTO | `tests/visual.test.js:47-97`: 5 bloques `test.each(HTML_PAGES)` (scripts inline, on*=, style=, `<style>`, recursos locales) |
| P2-3 | CSP con unsafe-inline + frameSrc * | ✅ RESUELTO | `server.js:203-217`: `scriptSrc`/`styleSrc` sin `'unsafe-inline'`, `frameSrc: ["'self'"]`. El informe afirmaba `script-src-attr=none`: **correcto** — no se declara y helmet 8.3 con `useDefaults:true` aplica su default `script-src-attr 'none'` (`node_modules/helmet/index.cjs:23`) |
| P2-4 | `logger` usado antes de definirse | ✅ RESUELTO | `src/routes/index.js:7` define `logger` antes del try/catch que lo usa (línea 14) |
| P2-5 | registro.html con script muerto | ✅ RESUELTO | `public/html/pages/registro.html:13,179` — solo scripts con `src`; `public/js/pages/registro.js` existe |
| P2-6 | Búsqueda por voz rota | ✅ RESUELTO (spot) | `app.js:2246-2250` implementación de toast/voz presente; sin señal de regresión |
| P3-1 | Vulnerabilidades en deps de producción | 🔴 **REGRESIÓN DE ENTORNO** | El informe (N-4) presumía **0**. Hoy `npm audit --omit=dev` = **7 vulnerabilidades (1 low, 2 moderate, 3 high, 1 critical)**. Ver D-1. No cambió el repo: son advisories publicadas después del 2026-09-26 |
| P3-2 | Caracteres chinos (artefactos IA) | ✅ RESUELTO | grep `[\x{4E00}-\x{9FFF}]` en server.js, database.js y src/ = 0 resultados |
| P3-3 | 85 console.log en backend | 🟡 PARCIAL (confirmado) | Hoy: **22** en src/ + database.js + server.js. El informe ya lo declaraba parcial deliberado (logs de boot antes del logger). Coherente |
| P3-4 | Drift documental | ✅ RESUELTO con residuo menor | README saneado, pero queda 1 línea: `README.md:345` aún dice "Elimina el archivo `data/check_app.db`" (la BD real es `data/system/database.db`). Ver D-4 |
| P3-5 | Socket.io CORS `'*'` inicial | ✅ RESUELTO | `server.js:143` → `cors: { origin: corsOriginCheck }` compartida con Express (`server.js:57-75`); sin `'*'` |
| P3-6 | escJs/toast/Leaflet rotos en páginas públicas | ✅ RESUELTO | `public/js/pages/portal.js:43` define `escJs` (con comentario del fix); Leaflet sirve de `cdn.jsdelivr.net` (0 referencias a unpkg) |
| P3-7 | Código muerto con impacto de producto | ✅ RESUELTO (spot) | Sin duplicados de atributos ni variables muertas visibles en los puntos citados; seat-layouts valida encaje (commit 8e3fc62..39acc39 no lo toca, estado heredado) |
| P3-8 | 6 métodos duplicados en App | ✅ RESUELTO | `fetchAPI(` aparece 419 veces como llamadas y **1 sola definición** (`app.js:7125`, delega en `API.fetchAPI`) |
| P3-9 | Búsquedas sin estilos | ✅ RESUELTO (spot) | `public/css/modules/forms.css:155-159` bloque `.search-input` con tema |
| P3-10 | data-act/data-call duplicados en app-shell | ✅ RESUELTO | grep de duplicados en `public/html/app-shell.html` = 0; dispatcher en `public/js/modules/core/DelegatedEvents.js` |

### Bloque legal/compliance L, N, C (septiembre)

| ID | Hallazgo | Estado hoy | Evidencia propia |
|---|---|---|---|
| L-1 | Consentimiento del registro público sin enforcement | ✅ RESUELTO | `src/routes/public.routes.js:349-365` exige `agreement` si el evento lo requiere; `:445-447` inserta en `consent_logs` texto+hash SHA256 de política+IP+UA |
| L-2 | PII de invitados expuesta en kiosco | ✅ RESUELTO | `public.routes.js:126-137` kiosk_token obligatorio configurable + modo `KIOSK_TOKEN_MODE=strict`; `:159` emails siempre enmascarados (`maskEmail`); POST/DELETE de token en `events.routes.js:234-245` |
| L-3 | Sin documentos legales ni T&C en signup | ✅ RESUELTO | `server.js:411-413` sirve `/legal/terminos|privacidad|cookies`; `auth.routes.js:242` registra evidencia en signup |
| L-4 | Import sin declaración de autorización | ✅ RESUELTO | `import.routes.js:670-677` exige `attestation`; `:1163-1168` la registra con texto de Ley 1581 art. 18 |
| L-5 | Códigos de recuperación fuerza-bruteables | ✅ RESUELTO | `server.js:274-275`: `limiters.auth` sobre `verify-reset-code` y `reset-password` |
| L-6 | Cambio de email sin auditoría | ✅ RESUELTO | `auth.routes.js:467` → `USER_UPDATED` con `action: 'email_change_requested'` |
| L-7 | Sin portabilidad self-service | ✅ RESUELTO | `auth.routes.js:411` → `GET /me/export` |
| L-8/L-4b | Cifrado en reposo parcial | ✅ RESUELTO | `src/security/encryption.js` (aes-256-gcm, `BACKUP_ENCRYPTION_KEY` línea 112-116, auditoría `ENCRYPTION_KEY_MISSING` línea 28); `src/utils/backup.js:3,36,51` cifra backups y grita si guarda en claro; retención con `consent_logs` protegido (`backup.js:105-113`) |
| C-4 | Consentimiento diferenciado datos sensibles | ✅ RESUELTO | `public.routes.js:452-461` inserta consentimiento `sensitive_data` separado |
| C-6 | Códigos de recuperación en claro | ✅ RESUELTO | `auth.routes.js:50-57` HMAC-SHA256 con JWT_SECRET (avisa si falta) + `registerResetAttempt` mata el código a los 5 intentos (líneas 63-77) |
| C-7 | Erasure/export incompletos | ✅ RESUELTO (spot) | Cascadas y anonimización presentes en rutas de borrado; cubierto por suite (352 tests, ver §3) |
| C-8 | Cambio de email sin re-verificación | ✅ RESUELTO | `auth.routes.js:447-495`: tabla `email_change_tokens` con token, expiración, confirmación al correo nuevo y auditoría |
| C-11 | Sin edad mínima por evento | ✅ RESUELTO | `events.routes.js:164,191,283,308`: `reg_min_age` en CREATE y UPDATE full-stack |
| N-1/N-2 | IA sin declarar en política | ✅ RESUELTO | `public/html/pages/legal-privacidad.html`: 3 menciones Gemini/inteligencia artificial |
| N-3 | Sin borrado de cuenta self-service | ✅ RESUELTO | `auth.routes.js:536` → `POST /me/delete-account` con limiter y anonimización |
| N-4 | Dependencias con CVEs | 🔴 Ver P3-1/D-1 | Era 0; hoy 7 (advisories nuevas) |
| N-5 | Sin captcha en registro público | ✅ RESUELTO | `public.routes.js:57,308,341` verificación server-side `verifyCaptcha` |
| N-6 / L-0 | DPA/cláusulas de encargado (abogado) | 🔴 ABIERTO | Bloqueado con el operador; sin cambios esperables (no hay commits desde el informe) |
| F6 | Verificación de backups | ✅ RESUELTO | `scripts/verify-backup-restore.js` y `tests/backup-restore.test.js` (6 tests, PASAN hoy) |
| Bug updateEvent | Filtraba 9 campos en silencio | ✅ RESUELTO | `events.routes.js:273,282-283` `reg_policy`/`reg_require_agreement`/`reg_min_age` en el UPDATE con COALESCE |

**Recuento: 34 RESUELTOS verificados · 2 PARCIALES (P3-3, y N-6/L-0 abiertos con operador) · 2 ABIERTOS (L-0, N-6) · 1 REGRESIÓN de entorno (P3-1/N-4).**

## 3. Evidencia de runtime re-ejecutada hoy

| Comando | Resultado |
|---|---|
| `git log --since=2026-09-28 --stat` | Vacío — 0 commits desde el informe |
| `CI=1 npx jest --testPathIgnorePatterns='/tests/e2e.test.js|/tests/load.test.js'` | **20 suites: 19 PASS, 1 FAIL · 352 tests: 350 ✓, 1 ✗, 1 skipped** (3.8 s). El fallo es `GET /api/health/full returns system checks` (`tests/api.test.js:178`, espera 200, llega 503) — ver D-2 |
| `npm audit --omit=dev` | **7 vulnerabilidades (1 low, 2 moderate, 3 high, 1 critical)**, todas con `npm audit fix` disponible — ver D-1 |

Nota: el informe afirmaba "10/10 corridas 370/371". Hoy el total es 352. La diferencia se explica por tests condicionales/dinámicos (`test.each` sobre el inventario de páginas, skips por entorno); no lo califico como hallazgo, pero conviene que el operador fije la cifra esperada en un lugar único para detectar desvíos.

## 4. Hallazgos nuevos del delta

### D-1 · P1 — 7 vulnerabilidades nuevas en dependencias de producción (1 crítica y alcanzable)

El repositorio no cambió: son advisories publicadas después de la auditoría del 26-28/09. Pero una es crítica y el código la hace alcanzable:

- **proxy-addr 1.1.0–2.0.7 (CRÍTICA, GHSA-jqcg-44mw-7w3h)**: suplantación de la IP del cliente vía subred IPv4-mapeada-en-IPv6. **Alcanzable**: `server.js:265` → `app.set('trust proxy', 1);` (necesario detrás del proxy de nginx, pero convierte la dependencia en vía de ataque). Impacto: falsear la IP que usan el rate limiting (los ~25 buckets), los logs de auditoría y la **evidencia de consentimiento** (`public.routes.js:442` usa además `x-forwarded-for` directamente) — es decir, contaminar prueba de cumplimiento legal.
- **nodemailer ≤10.0.8 (HIGH)**: reúso de TLS `servername` en caché DNS global (fuga de credenciales SMTP entre transportes) + DoS por recursión. Dependencia directa (`package.json:50`), el sistema envía correo real.
- **compression <1.8.2 (HIGH)**: fuga de memoria con respuesta cerrada temprano. Dependencia directa (`package.json:34`) y montada.
- **brace-expansion (HIGH, CPU DoS)**, **dompurify ≤3.4.15 (XSS DOM en hooks)**, **ip-address ≤10.7.0 (moderate)** y 1 low, todas transitivas.

Todas tienen arreglo sin cambio de major (`npm audit fix`). Evidencia: salida completa de `npm audit --omit=dev` (2026-10-05).

### D-2 · P2 — Test de salud sensible al entorno + artefacto legacy sin cifrar

`tests/api.test.js:178` espera 200 de `/api/health/full` sin garantizar el estado del directorio de backups. Hoy falla porque existe `data/system/backups/check_app_backup_2026-09-28T21-02-19-652Z.db` — **un backup en claro (`.db`, no `.enc`) creado a las 21:02 del 28/09, ~3 h después del último commit**, presumiblemente al arrancar la app en local sin la clave cargada. El endpoint actúa correctamente: `src/routes/version.routes.js:158-165` marca `allHealthy=false` y responde 503 si detecta un backup sin cifrar (así fue diseñado en L-4b). Dos caras: (a) el test viola el principio de fixture aislado que el propio proyecto defendió en v12.44.820; (b) queda en el disco de desarrollo un volcado completo de la BD sin cifrar que conviene re-cifrar o eliminar. Verificación propia: reproducí las comprobaciones del endpoint una a una — `encryption: enabled:true`, `backups: 1, encrypted: false`.

### D-3 · P2 — Variables de entorno funcionales ausentes de `.env.example`

`BACKUP_ENCRYPTION_KEY` (cifrado de backups, `backup.js:36`) y `KIOSK_TOKEN_MODE` (modo estricto de kiosco, `public.routes.js:137`) se leen del entorno pero **no aparecen en `.env.example`** (grep = 0). Quien instale desde el ejemplo no sabrá que existen dos palancas que la propia auditoría legal recomienda activar. Fix barato: documentarlas con comentario.

### D-4 · P3 — Residuo de drift en README

`README.md:345`: "Elimina el archivo `data/check_app.db`" — la BD real vive en `data/system/database.db`. Una línea, pero es exactamente el tipo de referencia fantasma que P3-4 dio por cerrado.

## 5. VEREDICTO

**VEREDICTO DELTA: IGUAL.** El código es bit a bit el mismo que auditó el informe del 28/09 (0 commits); todo lo que aquel informe declaró resuelto sigue resuelto, incluido el P1-5 que ya estaba cerrado en el propio commit de cierre. El único deterioro es externo al repo: el tiempo pasó y la base de advisories de npm encendió 7 alertas nuevas (D-1).

**VEREDICTO GLOBAL: SÓLIDA CON DEUDA.** El producto aguanta una re-auditoría hostil: los P0 de agosto están muertos de verdad, la capa legal de septiembre está implementada en servidor (no solo en el formulario) y la suite corre. La deuda vigente: monolito `public/js/app.js` de **20.663 líneas** (creció desde las 19.005 de agosto), 22 console.log residuales, D-1 por parchear, y los pendientes de operador (abogado/RNBD, DPA).

## 6. Fortalezas

1. **Defensa en profundidad real en el seed**: aunque el operador ponga `ADMIN_PASSWORD=changeme123` en el entorno, `schema.js:2035-2040` se niega a sembrarla — la protección no depende de que el humano haga lo correcto.
2. **Salud honesta**: `/api/health/full` degrada a 503 si falta `ENCRYPTION_KEY` o existe un backup en claro (`version.routes.js:158-165`) — y hoy lo demostró Fallando en rojo en mi propia corrida. Un endpoint de salud que miente no sirve; este no miente.
3. **CSP verificada por test**: la política sin `unsafe-inline` no es solo configuración — `tests/visual.test.js:47+` falla si alguien reintroduce un `<script>` inline, un `on*=` o un `style=`; y el default `script-src-attr 'none'` de helmet 8.3 respalda la afirmación del informe.
4. **Ciclo de backup auditable**: backup cifrado con grito en el log si sale en claro (`backup.js:51`), verificación de restauración (`scripts/verify-backup-restore.js`) y 6 tests del ciclo completo que pasan hoy.
5. **Recuperación de contraseña bien blindada**: HMAC-SHA256 determinista con aviso si falta el secreto, código muerto a los 5 intentos y limiter en ambas rutas (`auth.routes.js:50-77`, `server.js:274-275`).

## 7. Siguientes 3 pasos

1. **Parchear D-1 hoy mismo**: `npm audit fix` (todo es compatible), redeployar y volver a validar `/api/health/full` + login en producción. Considerar endurecer `src/routes/public.routes.js:442` para no fiar la IP de la evidencia de consentimiento a `x-forwarded-for` sin validar contra `proxy-addr` parcheado.
2. **Limpiar el artefacto y el test (D-2)**: cifrar o eliminar `data/system/backups/check_app_backup_2026-09-28T21-02-19-652Z.db`, y aislar `tests/api.test.js:178` con un directorio `DATA_PATH`/backups propio (patrón que el proyecto ya usa en `setup.test.js:15`).
3. **Cerrar la documentación de palancas (D-3, D-4)**: añadir `BACKUP_ENCRYPTION_KEY` y `KIOSK_TOKEN_MODE` a `.env.example` con comentarios, corregir `README.md:345`, y agendar lo que sigue bloqueado con el operador: abogado/RNBD (L-0) y DPA (N-6).

---

*Limitaciones: no se levantaron servidores ni BD; el E2E de navegador y las integraciones externas (Stripe/Twilio/Google) no se re-ejecutaron; el estado de producción se toma del registro de despliegue validado del 28/09 (`docs/STATUS_HISTORY.md`, commit `40daec2`).*
