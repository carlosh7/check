# STATUS_HISTORY — Check Pro

Historial detallado y fechado de sesiones. La entrada más reciente va arriba.
(Regla: el estado vivo vive en `docs/ROADMAP.md`; el detalle fechado vive aquí, nunca en `AGENTS.md`.)


---

## 2026-09-06 (parte 2) — Deuda CSS estructural resuelta: estilos externalizados + CSP styleSrc estricta (v12.44.810)

### Qué se hizo
- **11 bloques <style> inline extraídos** (9 páginas, ~31KB) a /css/pages/*.css byte-exact
  preservando el orden de cascada: login-page, shell-page, calendar/kiosk/landing/portal/
  registro/ticket/wheel-page + print-badge (impresión de gafetes). Ahora cacheables,
  versionados y auditables.
- **CSP styleSrc SIN 'unsafe-inline'** (elementos <style>): un atacante que logre inyección
  HTML ya no puede meter hojas de estilo arbitrarias. Queda styleSrcAttr documentado para
  atributos style="" (los genera app.js dinámicamente — ligado a su modularización).
- **Ventanas de impresión de gafetes** (3 document.write en app.js): CSS externo +
  @page dinámico por CSSOM (adoptedStyleSheets — no sujeto a CSP).
- **SweetAlert2**: su <style> inyectado quedaba BLOQUEADO por la CSP nueva (regresión
  detectada y corregida en verificación): CSS oficial 11.14.5 cargado por link desde
  jsdelivr en index/app-shell/portal; popups verificados estilizados (512px/radius 5px).
- **Guardián anti-regresión**: tests/visual.test.js ahora prohíbe <style> inline en todas
  las páginas (10 tests nuevos — misma lógica que ya existía para <script>).

### Verificación
Navegador: hojas /css/pages/ cargadas con reglas aplicándose en las 9 páginas, 0 estilos
inline vivos, Swal estilizado, sin overflow móvil (375px). Producción: style-src sin
unsafe-inline en headers, CSS servido (200), wheel.html sin <style> inline, render y
flujo de error de registro verificados en vivo. Suite 310/311.

---

## 2026-09-06 — Auditoría responsive móvil/tablet + fixes UI/UX (v12.44.809)

### Metodología
Matriz 9 páginas (login, shell/admin, registro, ticket, survey, kiosk, wheel, portal, landing) ×
2 viewports (375×812 móvil, 768×1024 tablet) en navegador real, midiendo overflow horizontal,
elementos desbordados, touch targets (<40px), viewport meta efectivo y layout real. Admin probado
con sesión ADMIN autenticada (sidebar, vistas).

### Hallazgos y fixes (todos verificados en navegador + producción)
1. **app-shell.html sin meta viewport** (fragmento sin <head>): el admin completo en móvil/tablet
   renderizaba layout de 980px escalado (texto ilegible). Fix: meta viewport en el fragmento.
   Verificado: layout 375 real, sidebar off-canvas funcional (hamburguesa abre drawer de 375px),
   sin overflow en móvil ni tablet.
2. **wheel: panel de config de 320px fijos desbordaba +26px** en móvil. Fix: media query ≤768px
   apila el panel sobre la ruleta, canvas acotado a min(92vw,--ws), botones de opciones 44px.
3. **survey: radios de valoración con targets de 13-20px** (imposible-tap): CSS estático a 44px +
   5 labels generados por JS parcheados. Verificado 44x44 en navegador.
4. **portal bloqueaba el zoom** (user-scalable=no — anti-patrón accesibilidad en el teléfono del
   invitado). Habilitado. Kiosk se mantiene sin zoom (tablet dedicada, deliberado).
5. **login: botón mostrar-contraseña** con área táctil 44px (antes ~28px).
6. **Cache-busting inconsistente**: 65 referencias ?v= mezclaban 6 versiones (496→808) — los
   invitados podían recibir CSS viejo de caché. Unificadas a 12.44.809.

### Análisis CSS (sano en general)
- Sistema modular css/modules/ con breakpoints 640/768/1024 coherentes; tablas admin con
  .table-scroll overflow-x:auto ✓; páginas públicas mayormente fluidas sin overflow.
- Deuda conocida: registro/ticket/survey usan CSS inline propio sin media queries (funcionan por
  diseño fluido, pero heredan frágil); styleSrc CSP aún con unsafe-inline (ligado a modularización).

Tests 300/301 · ESLint 0 errores · deploy v12.44.809 en VPS validado (versión, health, viewport,
fixes wheel/survey servidos).

---

## 2026-09-06 — Duplicados en App, CVEs a 0, tramo 4 ESLint, auto-deploy (v12.44.808)

### Completado
- **P3-8 (hallazgo nuevo, crítico para deuda)**: 6 métodos definidos dos veces en el objeto App
  (fetchAPI, deleteEvent, deleteSurveyQuestion, switchEventTab, _confirmAction, loadMailingData) —
  la segunda definición sombreaba a la primera. Verificado caso por caso que la tardía (la viva)
  es la evolucionada; eliminadas las tempranas (comportamiento preservado). El guard
  `typeof Swal === 'undefined'` del _confirmAction temprano se fusionó en la tardía.
- **CVEs: 0 vulnerabilidades** (antes 5 moderadas): override uuid ≥11.1.1 en package.json para
  forzar exceljs/gaxios/googleapis-common fuera de la versión vulnerable (todas usan solo uuid.v4).
- **Tramo 4 ESLint**: 504 → 455 warnings, 0 errores. 26 handlers backend de-async (Express 5
  captura throws síncronos), var→let en 18 líneas seguras, initializers muertos fuera. Se
  CONSERVAN con decisión documentada: require-await en frontend/SDK (contrato público async),
  no-await-in-loop (escrituras SQLite secuenciales intencionales), 16 var con hoisting real
  entre bloques (convertir a let rompería el flujo), no-unused-vars restantes (requires con
  efectos de carga por orden de inicialización).
- **C6-14 auto-deploy (código listo)**: /api/deploy/webhook ahora soporta modo script
  (DEPLOY_SCRIPT_PATH) para hosts sin Portainer, con logs en deploy_logs; script
  scripts/vps-redeploy.sh creado. ACTIVACIÓN PENDIENTE DEL OPERADOR: requiere dar al contenedor
  acceso al host (socket docker o servicio host) — decisión de seguridad, no montado por defecto.

### Estado de tests
300/301 (17 suites). ESLint 0 errores / 455 warnings. Deploy v12.44.808 en VPS validado
(versión servida, health, CSP, auth 401).

---

## 2026-09-05 (parte 3) — Tramo 3 ESLint + Wizard 2FA + decisiones arquitectónicas (v12.44.806)

### Completado
- **ESLint tramo 3**: warnings 538 → 504, 0 errores. 16 imports muertos puros eliminados/recortados
  (bcrypt, uuid, castId, AUDIT_ACTIONS, CACHE_KEYS/del, AuditLog, verifyToken…), 52 bindings muertos
  de riesgo cero retirados (calls await conservadas, comparaciones puras y getElementById sin uso),
  7 sentencias puras muertas eliminadas. Composición del resto documentada: require-await 95 (contrato
  de API async — convertir rompería .then() de terceros), no-await-in-loop 78 (patrón secuencial de
  escrituras SQLite intencional), no-unused-vars restantes (requires con efectos de carga conservados
  por orden de inicialización). CI: --max-warnings=520.
- **Wizard 2FA (diferido cerrado)**: paso 4 opcional de 2FA TOTP. Backend: POST /api/setup/admin
  devuelve token de sesión (solo posible con users=0, transacción atómica). Frontend: paso 3 ofrece
  "Proteger con 2FA", paso 4 muestra QR + secreto, verifica código y activa. **Verificado E2E real**:
  servidor local limpio + navegador → admin creado → QR renderizado → código TOTP calculado con
  speakeasy → verificación OK → login exige código (requires2FA) → login con totp_token entrega JWT.
  Test de regresión en tests/setup.test.js (16 tests).
- **Decisiones documentadas en ARQUITECTURA_SISTEMA**: logger único (utils/logger estándar,
  middleware/logger = request-logger HTTP), cache (NodeCache base + Redis opcional con fallback).

### Hallazgos nuevos (documentados, no auto-fijables)
- **P3-7 (producto)**: permisos canEdit/canRemove calculados y sin usar en render de usuarios,
  chips de eventos/staff construidos y nunca renderizados, usableH ignorado en seat-layouts
  (posible desborde de mapa de asientos) — requieren decisión de producto.
- **Restricción CSP**: scriptSrcAttr/styleSrc no se pueden retirar sin modularizar app.js —
  los handlers inline se generan dinámicamente en strings HTML (innerHTML) en todo el monolito.

### Resolución de P3-7 (adenda, v12.44.807)
Decisión del operador: aplicar lo recomendado. Chips de borrador y filtros muertos eliminados;
permisos de usuarios verificados server-side (no había agujero); **seat-layouts valida ahora que
las filas quepan en la sala** (400 con mensaje claro en vez de plano desbordado). Deploy y
validación en producción OK.

### Estado de tests
300/301 (17 suites; +1 test de 2FA wizard). ESLint 0 errores / 499 warnings.

---

## 2026-09-05 (parte 2) — Tramo 2 ESLint + P2-1 cerrado + Redeploy y validación en producción (v12.44.805)

**Commits:** `3b9c018` (v12.44.804, endurecimiento integral) · `b40cc99` (v12.44.805, tramo 2 + P2-1)

### Pendientes del roadmap cerrados
- **ESLint tramo 2**: warnings 2086 → **538** (CI `--max-warnings=550`). Base: `eslint --fix`
  (no-var→let mecánico, 922 líneas de formato en 8 archivos frontend) + `caughtErrors: 'none'`
  justificado (616 `catch(e)` sin uso intencionales, auditados por clasificación de mensajes);
  args/vars sin uso siguen señalados para el tramo 3 (require-await 95, no-await-in-loop 78,
  no-unused-vars 129 asignaciones muertas reales).
- **P2-1 RESUELTO**: retirado el fallback `req.query.token` de `src/middleware/auth.js`.
  Verificado que ningún consumidor usa `?token=`. Test de producción: descarga con token falso
  por query → 401 (ignorado).
- **P2-4 verificado no reproducible**: `routes/index.js` define `logger` (línea 7) antes de uso.

### Redeploy en VPS Contabo (185.234.69.61, /opt/check — NO git: rsync + compose build)
- Backup previo del código en `/opt/check-backup-20260905-1806.tar.gz`.
- rsync con excludes estrictos: `.env`, `data/`, `persistence/`, `node_modules/`, `.git` nunca
  sincronizados; sin `--delete` para preservar archivos propios del VPS.
- `docker compose build` + renovación del volumen `check_node_modules` + recreación del contenedor.
- **Incidente resuelto**: el rsync sobrescribió el `docker-compose.yml` adaptado del VPS
  (127.0.0.1:13000:3000, ALLOWED_ORIGINS=chek.smarteventos.co) por el local (puerto 3000, en uso)
  → el contenedor no arrancó. Restaurado desde el backup en <2 min. **Lección: excluir
  `docker-compose.yml` del rsync o parametrizarlo por env.** Corregido en el flujo documentado.
- Otros proyectos del VPS (Nextcloud AIO, Dolibarr, Cueflow) intactos.

### Validación en producción real (interna 127.0.0.1:13000 + externa https://chek.smarteventos.co)
| Verificación | Resultado |
|---|---|
| /api/health interno y externo | ✅ 200 |
| Versión servida (index.html) | ✅ `v=12.44.805` |
| CSP `script-src` | ✅ sin `unsafe-inline` |
| CORS: LAN ajeno | ✅ 500 (bloqueado) |
| CORS: dominio propio | ✅ 200 |
| registro.js en vivo | ✅ carga, parsea (20.449 bytes) y ejecuta: sin evento → "Evento no encontrado" (antes: loading eterno por el error de parseo) |
| Ruleta (wheel) en vivo | ✅ canvas, `toast()` y `closeModal()` definidas, confetti cargado |
| Login en navegador real | ✅ formulario completo; toggle de contraseña funciona (script externalizado ejecuta) |
| `window.App` en producción | ✅ cargado + `sessionManager/eventManager/guestManager: true` (módulos cableados vivos) |
| Login con credenciales erróneas | ✅ 401 limpio |
| Descarga con token por query | ✅ 401 (fallback retirado) |
| Headers de seguridad | ✅ nosniff, DENY, HSTS |

### Notas
- La tabla `events` de producción está vacía — no hay eventos reales para probar el flujo de
  registro con carrito E2E; el despliegue se validó hasta el borde (JS ejecuta + API responde).
- Las páginas standalone referencian sus JS con `?v=12.44.804` (versión en que ese archivo
  cambió por última vez) — cache-busting correcto por archivo.
- Pendiente exclusivo del operador: **rotar el PAT de GitHub** (solo posible desde la web de
  GitHub) y **cambiar la contraseña del admin** (el admin de producción se creó por wizard;
  las credenciales no están en ningún archivo).

---

## 2026-09-05 — Endurecimiento integral de 5 fases (v12.44.804)

**Plan aprobado por el usuario:** análisis integral del proyecto → plan de resolución por fases (secretos/despliegue, seguridad de red y tokens, cableado de módulos, calidad, documentación).

### Fase 1 — Secretos y despliegue
- **`portainer-stack-v2.yml`** (nuevo, junto a `portainer-stack.yml` que queda como respaldo hasta verificación): token GitHub vía variable de entorno `GITHUB_PAT` de Portainer — nada literal en el YAML; guardia que aborta con mensaje claro si falta; Node 22 unificado con Dockerfile; **sin `chmod -R 777`** en la persistencia.
- **`docker-compose.yml`**: `env_file` con `required: false`, sin `container_name` fijo.
- **Pendiente del operador: rotar el PAT de GitHub** si alguna vez se pegó literal.

### Fase 2 — Seguridad de red y tokens
- **CORS** (`server.js`): política compartida `corsOriginCheck` para Express y Socket.io, evaluada en caliente. El auto-accept de IPs LAN ahora depende de `CORS_TRUST_LAN` (default: activo solo fuera de producción). Smoke test: LAN ajeno → 500, origen del propio host → 200, sin origen → 200.
- **Socket.io**: ya no arranca con `origin: '*'` ni muta `io.engine.opts.cors.origin` (cierra P3-5).
- **JWT por query string** (P2-1): `downloadBadges`/`downloadReport` en `app.js` usan fetch + header Authorization + blob; el fallback por query se conserva en `auth.js` por compatibilidad.
- **CSP** (P2-3 parcial): `scriptSrc` sin `'unsafe-inline'` — 11 scripts inline externalizados a `public/js/pages/*.js` (index, calendar, kiosk, landing, portal, registro×2, survey×2, ticket, wheel), misma posición, cuerpos byte-exactos. Restante documentado: `scriptSrcAttr`/`styleSrc` (≈450 handlers/estilos inline en app-shell).
- `findAvailablePort` ya no reescribe `.env` en producción.
- Plantilla de importación: contraseña de ejemplo cumple política (`Ejemplo2024Aa`); eliminado archivo vacío `70`; `package.json` `main` → `server.js`; `jspdf` se queda (sí se usa en 5 rutas backend).

### Hallazgo crítico colateral (P2-5) — registro público muerto desde v12.44.712
El script inline de `registro.html` tenía una **llave de cierre sobrante** (entró en el commit del carrito, `5baf26b` v12.44.712): todo el bloque dejaba de parsear en el navegador → el formulario público de registro quedaba en "loading" para siempre en producción. Corregido y verificado con babel/acorn. También corregidos en páginas públicas: `escJs` inexistente en portal (álbum), `toast` inexistente en wheel (ruleta), Leaflet cargado de unpkg.com bloqueado por CSP (landing → movido a cdn.jsdelivr.net), `closeModal` duplicado en wheel.

### Fase 3 — Cableado de módulos
- `SessionManager`, `EventManager`, `GuestManager` exportados en el barrel `public/js/modules/index.js` e integrados en `App` (`App.sessionManager/eventManager/guestManager`) — incremental, nada sustitutivo. Tests de módulos verdes.
- `?v=12.44.516` obsoleto → `?v=12.44.804` en los 25 imports de `app.js`.
- `public/js/src/frontend/api.js|utils.js` se quedan: `app.js` los importa activamente (duplicado documentado como deuda, no eliminado).

### Fase 4 — Calidad
- **ESLint: 8 errores → 0** (override ESM para 3 tests de módulos en `eslint.config.js`, globals de páginas, fix de parseo de wheel.js). Baseline de warnings en CI ajustada a 2100 (tramo 1 de la campaña: 2100 → 1000 → 500 → 100 → 0).
- **visual.test.js real** (P2-2): 20 tests estáticos (guardián CSP: ningún `<script>` inline + refs locales existentes) + modo live Playwright opcional contra `VISUAL_BASE_URL` (screenshots + errores de consola; se omite con aviso si no hay navegador).
- **`test:coverage` + `coverageThreshold`**: ratchet en 37% statements / 18% branches / 26% functions / 37% lines (cobertura real medida).
- **CVEs: 21 → 5** (`npm audit fix` + `nodemailer@10`; quedan solo moderadas transitive de uuid vía exceljs/googleapis — diferido, requiere majors).
- `console.log` de runtime de `socket/index.js` → `logger`; los de boot/migraciones/seed se conservan deliberadamente (corren antes del logger, visibilidad en docker logs).

### Fase 5 — Documentación
- `AUDIT_REPORT.md`: P2-1 mitigado, P2-2/P3-4/P3-5 resueltos, P2-3/P3-1/P3-3 parciales con detalle; nuevos P1-4 (token en stack), P2-5 (registro muerto), P3-6 (bugs de páginas).
- `ACTION_PLAN.md`: fila "Endurecimiento integral 12.44.804" en el registro.
- `README.md` y `docs/ARQUITECTURA_SISTEMA.md`: drift corregido (BD maestra real `data/system/database.db`, estructura real de archivos).

### Estado de tests
**299/299** (21 suites; 279 previos + 20 visuales estáticos; 1 live omitido sin navegador). ESLint 0 errores. Smoke E2E local verificado (health/CSP/CORS en producción y desarrollo).

### Pendiente para la próxima sesión
1. Operador: **rotar PAT de GitHub** y **cambiar la contraseña admin** de 192.168.2.17:3000.
2. Redeploy del stack check con `portainer-stack-v2.yml` (configurar `GITHUB_PAT` como variable del stack) y retirar `portainer-stack.yml` cuando esté verificado.
3. Continuar campaña ESLint (tramo 2: warnings 2100 → 1000) y CSP resto (scriptSrcAttr/styleSrc de app-shell).
4. Retirar fallback de token por query en `src/middleware/auth.js` una vez confirmado que nadie externo lo usa.

---

## 2026-08-30/31 — Seguridad de primer arranque (v12.44.802) + hardening de credenciales (v12.44.803)

**Commits:** `f56ba30` (seguridad, tag `v12.44.802`) · `ba0b5f2` (respaldo sesión anterior + `.zcode/` al `.gitignore`) · v12.44.803 (wizard Chrome + cero credenciales literales, tag `v12.44.803`)

### Hecho y verificado

- **Fin de credenciales expuestas (P1-2 de `AUDIT_REPORT.md`)**: retirados los seeds con
  `admin@check.com`/`admin123` de `src/utils/schema.js`, `database.js` y `setup.js`;
  `.env.example` y `ci.yml` sin valores expuestos. El seeding de admin ahora SOLO procede
  si `ADMIN_EMAIL` **y** `ADMIN_PASSWORD` están ambas definidas en el entorno
  (`seedAdminIfConfigured()`), y se niega si la contraseña es una de las expuestas.
- **Wizard de primer arranque**: `GET /api/setup/status` + `POST /api/setup/admin`
  (`src/routes/setup.routes.js`, rate-limited como login, auditado `SETUP_ADMIN_CREATED/REJECTED`).
  El POST solo funciona con la tabla `users` vacía (transacción); con usuarios → 403 siempre.
  UI de 3 pasos en `index.html` + `app.js` (`initApp()` consulta el estado antes de restaurar
  sesión; `App.showSetupWizard()`, guard en `App.showView`). Guía: `docs/user/07-administracion/12-primer-arranque.md`.
- **Política de contraseñas** (`src/security/password-policy.js`): mínimo 10 caracteres con
  mayúscula, minúscula y número; contraseñas expuestas (`admin123`, `changeme123`) prohibidas
  como contraseña nueva en setup/signup/reset/cambio/alta de usuarios (validation.js usa el
  schema fuerte centralizado).
- **Signup endurecido**: `POST /api/signup` ignora el rol del cliente — siempre `PRODUCTOR`.
- **Instalación Docker verificada** desde clon fresco de GitHub (build OK, entrypoint genera
  secrets, wizard E2E OK en contenedor, persistencia OK tras restart del contenedor).
- **v12.44.803**: el wizard y el login usan `autocomplete="username"` + atributos `name`
  para que Chrome sugiera y guarde la contraseña asociada al usuario; tests/CI/scripts
  **sin credenciales literales** (fixtures con contraseña aleatoria en runtime; CI usa
  `ci-run-${{ github.run_id }}-Aa1`). Responde a alerta de GitGuardian por pares
  email+contraseña sintéticos introducidos en v12.44.802 (falso positivo, higiene corregida).
- **Tests**: 279/279 en 16 suites (incluye `tests/setup.test.js` nuevo con BD temporal limpia).
- **Docs**: README/INSTALL sin credenciales por defecto; `AUDIT_REPORT.md` cierra P1-2;
  `ACTION_PLAN.md` cierra ítem 0.5 + registro "Hardening P1-2".

### Decisiones de la sesión

1. Sin bloqueo retroactivo de logins con contraseñas viejas (no existen instalaciones de
   terceros; el operador local cambia su contraseña tras desplegar).
2. Se conserva el seeding por env explícito (automatización headless Docker/CI), sin defaults.
3. Wizard simple sin 2FA en el flujo (la 2FA se activa después desde Mi Cuenta, como hoy).

### Pendiente (próxima sesión)

- **Hardening `docker-compose.yml`** (detectado en la verificación Docker):
  1. `env_file: .env` es obligatorio y rompe `docker compose up --build` en clon fresco
     (el `.env` no viene en el repo). Fix: `required: false` (Compose 2.24+) o confiar en el
     entrypoint, que ya crea el `.env` dentro del contenedor.
  2. `container_name: check-app` duro → conflicto si ya existe un contenedor con ese nombre.
     Quitar la línea (compose namespacea por proyecto).
  Menores: `version: '3.8'` obsoleto en compose; README enlaza `DOCKER_INSTALL.md` que no existe.
- Opcional: paso de 2FA en el wizard; cablear en el barrel los módulos respaldados
  (`SessionManager`, `EventManager`, `GuestManager` — hoy sin importar; por eso `ba0b5f2` no llevó bump).
- **Operador local**: cambiar la contraseña del admin de la instancia `192.168.2.17:3000`
  tras el Redeploy (la actual es una de las expuestas; la nueva debe cumplir la política).
- Nota: durante la sesión se detectó un `git reset` externo (~00:38 local) que descartó los
  docs del cierre; fueron re-creados en el commit de docs correspondiente.

---
