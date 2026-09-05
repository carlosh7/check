# STATUS_HISTORY — Check Pro

Historial detallado y fechado de sesiones. La entrada más reciente va arriba.
(Regla: el estado vivo vive en `docs/ROADMAP.md`; el detalle fechado vive aquí, nunca en `AGENTS.md`.)

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
