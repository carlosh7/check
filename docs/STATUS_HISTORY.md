# STATUS_HISTORY — Check Pro

Historial detallado y fechado de sesiones. La entrada más reciente va arriba.
(Regla: el estado vivo vive en `docs/ROADMAP.md`; el detalle fechado vive aquí, nunca en `AGENTS.md`.)

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
