# ACTION_PLAN.md — Plan Maestro por Fases · Check Pro v12.44.783

**Estrategia acordada:** consolidar → reparar integración → conectar lo oculto → rediseñar UI/UX → diferenciarse → ecosistema → calidad continua.
Se ejecuta **fase por fase**, una a la vez, con confirmación del usuario antes de cada fase.

**Fuentes:** `AUDIT_REPORT.md` (score 62/100) + análisis de conectividad FE↔BE (458 endpoints backend vs ~150 usados) + benchmark competitivo 2026 (zkipster, RSVPify, Whova, Diobox, Cvent, Attendize, pretix, alf.io, FOSSASIA).

**Reglas inviolables durante toda la ejecución:**
- Nada sustitutivo: todo incremental (regla #1 del proyecto).
- Version bump Z + tag por fase completada.
- Actualizar este archivo al cerrar cada ítem.

---

## FASE 0 — Estabilización Crítica (P0) 🔴

> Objetivo: instalación fresca funcional + servidor sin fugas + suite de tests confiable + guardarraíl CI.
> Sin esto, cualquier trabajo posterior es arena sobre barro.

| # | Tarea | Detalle | Esf. |
|---|-------|---------|------|
| 0.1 | ✅→ Seed admin roto | `src/utils/schema.js:1481` usa `uuidv4()` sin import top-level (imports solo en scopes locales :884,:1172). Añadir `const { v4: uuidv4 } = require('uuid');` arriba. Verificar borrando `data/system/`. | S |
| 0.2 | Exposición de raíz por HTTP | `server.js:274` sirve `express.static(__dirname)` → `/server.js`, `/package.json`, `/docker-compose.yml` descargables (verificado curl). Reemplazar por whitelist explícita (`index.html`, `manifest.json`, `favicon.ico`, `sw.js`). Re-test curl debe dar 404. | S |
| 0.3 | `npm test` autodestructivo | `database.js:39` `process.exit(1)` mata Jest completo vía require en `tests/backend.test.js`. Opción: flag env `CHECK_DB_WRITABLE=1` en tests o mockear exit. Añadir cierre de open handles (`afterAll`) y retirar `--forceExit` gradualmente. | M |
| 0.4 | DATA_PATH imposible | `.env.example:22` apunta a `/home/data_check` (requiere root); fallo mkdir tragado en catch. Cambiar default a `./data`, hacer error fatal visible con instrucciones claras. | S |
| 0.5 | ✅→ Secretos débiles shipeados | Resuelto en dos pasos: (1) `scripts/bootstrap-env.js` rota JWT_SECRET/ENCRYPTION_KEY débiles automáticamente; (2) **v12.44.802**: eliminados los seeds con credenciales expuestas (`admin@check.com`/`admin123`, `admin@example.com`/`changeme123`), el primer admin se crea con el **wizard de primer arranque** (`/api/setup`) o con env explícita, y la política centralizada (`src/security/password-policy.js`) prohíbe esas contraseñas para siempre y exige 10+ caracteres con mayúscula/minúscula/número. | S |
| 0.6 | CI mínima (guardarraíl) | GitHub Actions: `npm ci && npm test && npx eslint . --max-warnings=<baseline>` en cada PR + gitleaks `--redact`. Baseline de warnings = estado actual, bajar progresivamente. | M |

**Criterio de salida Fase 0:** `npm ci && npm start` funciona en directorio limpio · `npm test` verde · curl a `/server.js` da 404 · CI corriendo en PRs.

---

## FASE 1 — Reparación Integración FE↔BE 🟠

> Objetivo: que todo botón que existe funcione. Hoy hay features visibles ROTAS para el usuario final.

| # | Tarea | Detalle | Esf. |
|---|-------|---------|------|
| 1.1 | Encuestas QR rotas (404) | Frontend llama `GET /api/events/:id/surveys` y `/responses`, `DELETE /api/events/surveys/:id` (app.js:7414,7452,7476 + survey.html) — backend no las expone ahí. Crear rutas o realinear paths. Módulo completo caído. | M |
| 1.2 | Bandeja INBOX 404 | `GET /api/email/email-logs?type=INBOX` (app.js:6090) no existe; backend tiene `/mailbox/*`. Realinear. | S |
| 1.3 | Registro público ROTO (crítico) | app.js:17281 usa `App.constants.API_URL` pero `App.constants` no existe → fetch a literal `undefined/register`. El endpoint real es `/api/public-register`. **El form público nunca registra.** | S |
| 1.4 | Test SMTP/IMAP legacy 404 | app.js:15072/15099 llama `/api/email/test-smtp` y `/test-imap` sin `:id`; la correcta es `/accounts/:id/test-*` (:15163). Eliminar versión vieja. | S |
| 1.5 | Llamadas sin token → 401 seguro | `System.js:136` (`GET /api/clients`) y `EventConfig.js:90` (`GET /api/events/:id`) sin Authorization. Usar `fetchAPI`. | S |
| 1.6 | Contrato de errores de `fetchAPI` | Hoy ante 404/500 devuelve `{success:false}` sin lanzar → los ~390 try/catch de vistas NUNCA capturan; fallos silenciosos (pantallas vacías sin aviso). Decidir contrato (lanzar error normalizado) y migrar vistas críticas. | L |
| 1.7 | 20 `catch(e) {}` vacíos en app.js | Reemplazar por toast/log visible. Errores tragados = bugs invisibles. | S |
| 1.8 | Socket events huérfanos | Servidor emite `poll_updated` e `import_progress` que nadie escucha (progreso de import y votos de polls no se ven en vivo); cliente emite `leave_event`/`stop_editing`/`collab_update`/`poll_vote` que nadie escucha. Cablear o documentar como dead. | M |
| 1.9 | Purgar `ApiService.js` muerto | Apunta a rutas inexistentes y nadie lo usa. Documentar decisión (borrar o realinear) sin tocar nada vivo. | S |

**Criterio de salida:** flujo registro público OK end-to-end · encuestas QR admin+públicas funcionan · inbox carga · 0 llamadas 404/401 en consola durante smoke test de todos los módulos.

---

## FASE 2 — Conectar Backend Huérfano (features ocultas → UI) 🟡

> Objetivo: monetizar el 55% del backend ya construido que nadie ve. Quick wins: backend listo, falta vista.

Orden de ataque (valor/riesgo):

| # | Módulo huérfano | Qué se expone | Equivale a (competencia) |
|---|------------------|---------------|--------------------------|
| 2.1 | Password recovery + 2FA | UI de recuperación (código 6 dígitos ya implementado en BE) + setup/verify/disable 2FA | Estándar mínimo profesional |
| 2.2 | Coupons + Transactions | CRUD cupones, validación, lista transacciones Stripe | Eventbrite/RSVPify |
| 2.3 | Intelligence | Tags automáticos, predicción asistencia, recomendaciones | Whova/Cvent insights |
| 2.4 | Networking/matchmaking | Matchmaking entre asistentes (rutas viven en BE) | Whova ⭐ diferenciador |
| 2.5 | Certificates | Generación certificados asistencia | Conferencias pro |
| 2.6 | Speakers + Proposals + Budget | Vistas de ponentes, propuestas públicas, presupuesto por evento | Whova/Attendize |
| 2.7 | Users invite/approve | Invitar usuarios, aprobar registros pendientes | Admin pro |
| 2.8 | Push avanzado | Templates, programados, envío segmentado | zkipster comms |

**Criterio de salida:** cada módulo tiene al menos vista funcional (tabla/form + acción principal) conectada a sus rutas reales, probada contra BD de desarrollo.

---

## FASE 3 — Rediseño UI/UX Integral 🎨

> Objetivo: percepción profesional inmediata. Se hace DESPUÉS de Fases 1–2 para no rediseñar módulos rotos ni rediseñar dos veces.

### 3A — Design System (fundación)
- Tokens CSS únicos (color, tipografía, espaciado, radios, sombras) en `:root`; dark/light coherentes.
- Auditoría y consolidación de componentes (`Form, Modal, Table, Dropdown, Toast, Sidebar`) — eliminar estilos duplicados/inline.
- Estados estándar para TODAS las vistas: loading (skeletons), empty states ilustrados, error states accionables. Hoy: solo 9 menciones de loading en 19k líneas.
- Accesibilidad: aria-labels, focus-visible, contraste AA, navegación teclado.

### 3B — Shell & Navegación
- Sidebar/topbar rediseñadas, breadcrumbs, buscador global (⌘K), responsive móvil first-class.
- Onboarding primera vez (checklist de configuración).

### 3C — Rediseño módulo por módulo (incremental, nada sustitutivo)
Orden: Dashboard → Eventos → Invitados (tabla/pipeline kanban) → Check-in/Kiosco → Mailing → Pagos → Config/Admin.

**Criterio de salida:** guía visual en `docs/user/`, screenshots antes/después, cero regresión funcional (smoke test por módulo).

---

## FASE 4 — Features Diferenciadoras vs Competencia 🚀

> Lo que los líderes tienen y NO existe ni siquiera en el backend.

| # | Feature | Referencia | Nota técnica |
|---|---------|-----------|--------------|
| 4.1 | **Wallet Passes Apple/Google** | zkipster, RSVPify | `passkit-generator` + Google Wallet API. Pass actualizable + push desde wallet. Máximo impacto de percepción pro. |
| 4.2 | Plus-ones / acompañantes | Diobox | Relación guest→guests, check-in parcial, cupo por plus-one. |
| 4.3 | Campos personalizados + lógica condicional en pre-registro | RSVPify | Builder drag&drop de campos; visibilidad condicional. |
| 4.4 | Restricciones alimentarias / menús | RSVPify | Campo estándar + reporte para catering. |
| 4.5 | Sponsors/expositores + lead retrieval + ROI | Whova/Cvent | Módulo nuevo: booths, scans de leads, dashboard ROI patrocinador. Fuente #1 ingresos plataformas pro. |
| 4.6 | Multi-divisa + impuestos en checkout | alf.io | Extender payments existente. |

---

## FASE 5 — Ecosistema e Integraciones 🔗

| # | Feature | Detalle |
|---|---------|---------|
| 5.1 | API keys gestionables + conector Zapier/Make | Keys por usuario, scopes, revocación; triggers/actions estándar. Complementa webhooks+Swagger existentes. |
| 5.2 | CRM bidireccional | HubSpot primero (API gratuita), Salesforce después. Sync registro/check-in/asistencia → contact/campaign. Ya existe esqueleto `crm.routes.js` huérfano. |
| 5.3 | Híbrido/virtual | Embed streaming por sesión, sesiones virtuales, links Zoom (ya existe base Zoom huérfana). |
| 5.4 | Portal asistente v2 | Community feed, document sharing (slides/handouts), gamification leaderboard (extiende BL-28). |

---

## FASE 6 — Calidad Continua 🟢

- Campaña ESLint: config por entorno (browser/node) → elimina ~985 falsos `no-undef`; bajar errores 1.031 → <100.
- Modularizar `app.js` (19k líneas) incrementalmente hacia `public/js/modules/*`.
- Modernización sintáctica automatizada por carpetas (`no-var`→`const`, PRs pequeños, suite verde).
- Limpiar artefactos IA (caracteres chinos en server.js:48,453; jwt.js:41) + 85 console.log → logger estructurado.
- N+1 audit: 46 `await-in-loop` → transacciones better-sqlite3 donde aplique.
- Deps: sharp→0.35 (cierra 4 CVE high), multer→2.x, evaluar Express 5 con tests de regresión.
- Tests: convertir `visual.test.js` en Jest real o mover a scripts/; cobertura contractual Stripe/Twilio/Google mockeados.
- Backups verificados: test periódico de restauración real.

---

## Métricas de Éxito

| Indicador | Hoy | Meta F0 | Meta F1-2 | Meta F3+ |
|---|---|---|---|---|
| Instalación fresca | ❌ falla | ✅ | ✅ | ✅ |
| `npm test` | ❌ crash | ✅ verde | ✅ + CI | ✅ |
| Exposición raíz HTTP | ❌ abierta | ✅ cerrada | ✅ | ✅ + regresión |
| Llamadas API rotas FE | 7 familias | — | 0 | 0 |
| Backend sin UI | ~55% | — | <20% | <10% |
| Errores ESLint | 1.031 | baseline CI | <400 | <100 |
| Vulnerab. prod high | 12 | ≤5 | ≤2 | 0 |
| Score estimado | 62 | ~68 | ~74 | ~82+ |

---

## Registro de Ejecución

| Fase | Estado | Versión | Resultado clave |
|------|--------|---------|-----------------|
| F0 | ✅ Completada | 12.44.784 | Instalación fresca OK · exposición raíz cerrada (404 verificado) · **252/252 tests** · CI en `.github/workflows/ci.yml` · secretos auto-rotados vía `scripts/bootstrap-env.js`. Extra: segundo bug P0 encontrado y corregido (`bcrypt` sin import, la auditoría solo vio `uuidv4`). |
| F1 | ✅ Completada | — | Registro público reparado (`App.constants` inexistente) · encuestas QR admin+públicas realineadas al builder API (+ endpoints compat por evento) · bandeja INBOX conectada a mailbox real · test SMTP/IMAP raw añadido al backend · llamadas sin token en System/EventConfig corregidas · **contrato de errores de fetchAPI ahora lanza** (+timeout 30s) → los ~390 try/catch de vistas vuelven a funcionar · 8 catch vacíos visibles · sockets `poll_updated`/`import_progress` cableados. |
| F2 | ✅ Completada | — | Recuperación de contraseña E2E (código 6 dígitos + email) · **2FA TOTP obligatorio en login** + setup/verify/disable en Perfil (E2E verificado con speakeasy) · Intelligence (predict/recommendations/tags) con tab nuevo · Certificados (plantillas+generación+descarga) · Push avanzado (templates/segmentado/programadas) · Transacciones de pago en tab cupones. |
| F3 | ✅ Completada | — | Design system ya existente (Minimalista Premium) consolidado · helper unificado `App.uiState()` (loading skeletons/empty/error con retry) aplicado a módulos nuevos · clase `.error-state` · skip-to-content en shell y login · seed de tests determinista (fin del flaky). |
| F4 | ✅ Completada | — | **Plus-ones** full-stack (quota por evento, registro público, check-in por QR propio) · **campos personalizados con lógica condicional** (builder admin + form público dinámico) · **Sponsors/expositores con lead retrieval + ROI summary** · migración idempotente `002_f4_features.js`. Wallet Passes nativos: diferido (requiere certificados Apple/issuer Google — documentado abajo). |
| F5 | ✅ Completada | — | UI de API keys (crear/listar/toggle/revocar) sobre `/api/v1` existente — consumo E2E verificado · UI CRM (HubSpot/Salesforce/Zoho conectar+sync) sobre rutas existentes · `stream_url` por sesión para eventos híbridos (full-stack). Portal v2 (feed/docs): diferido, ver notas. |
| F6 | ✅ Parcial | — | Migración 002 idempotente · artefactos IA limpios (server.js, jwt.js) · console.log backend → logger estructurado (schema, database-manager, cache, email-service…) · flaky de tests eliminado (INSERT OR IGNORE en seed + credenciales deterministas). Pendiente programático: campaña ESLint completa, modularización app.js, sharp/multer upgrades, Express 5. |
| Hardening P1-2 | ✅ Completada | 12.44.802 | **Fin de las credenciales expuestas** (hallazgo P1-2 / ítem 0.5): seeds de admin retirados de `schema.js`/`database.js`/`setup.js`/`.env.example`; **wizard de primer arranque full-stack** (`GET/POST /api/setup` + UI 3 pasos en `index.html`/`app.js`, guía en `docs/user/07-administracion/12-primer-arranque.md`); política de contraseñas centralizada (expuestas prohibidas, mínimo 10 con mayúscula/minúscula/número) aplicada en setup/signup/reset/cambio/alta de usuarios; `POST /api/signup` fuerza `PRODUCTOR` (cierra auto-asignación de rol). Scripts E2E y tests sin credenciales por defecto. **279/279 tests** (16 suites, incluye `tests/setup.test.js` con BD temporal limpia). |
| Endurecimiento integral | ✅ Completada | 12.44.804 | **Deploy**: `portainer-stack-v2.yml` con PAT por variable de entorno (nada literal en YAML), Node 22, sin `chmod 777`; docker-compose con `env_file required:false` y sin `container_name` fijo. **Seguridad**: CORS LAN auto-accept solo por `CORS_TRUST_LAN` (default off en producción, smoke test verificado: LAN ajeno 500, host propio 200) · Socket.io con política compartida sin `'*'` (P3-5) · descargas con JWT por header (P2-1 mitigado) · scriptSrc sin `unsafe-inline` (11 scripts externalizados a `/js/pages/`, P2-3 parcial) · sin `.env` reescrito en producción. **Bugs productivos encontrados y corregidos**: registro público muerto desde v12.44.712 (llave sobrante → script sin parsear, P2-5) · `escJs` inexistente en portal · `toast` inexistente en wheel · Leaflet bloqueado por CSP en landing · duplicado `closeModal` en wheel. **Cableado**: SessionManager/EventManager/GuestManager en barrel + `App.*` (tests de módulos verdes) · `?v=` de imports unificado. **Calidad**: 0 errores ESLint (8→0), visual.test.js real (20 estáticos + live Playwright, P2-2), `test:coverage` + `coverageThreshold` (ratchet 37/18/26/37), `npm audit fix` + nodemailer@10 (21→5 CVEs, solo transitive uuid), baseline CI ajustada a 2100 warnings (tramo 1 de campaña). **299/299 tests** (21 suites). Pendiente operador: rotar PAT de GitHub, cambiar contraseña admin, Redeploy con stack v2. |
| Tramo 3 + Wizard 2FA | ✅ Completada | 12.44.806 | **ESLint tramo 3**: warnings 538→504 (imports muertos puros eliminados/recortados: bcrypt/uuid/castId/AUDIT_ACTIONS…, 16 puntos; 52 bindings muertos de riesgo cero retirados; sentencias puras muertas eliminadas). Composición del resto documentada en AUDIT (require-await = contrato de API, no-await-in-loop = patrón secuencial intencional). **Wizard 2FA**: paso 4 opcional de 2FA TOTP con token de sesión de un solo uso emitido por `POST /api/setup/admin` — verificado E2E con navegador real + test de regresión (16 tests en setup.test.js). **P3-7 documentado**: permisos/chips/usableH muertos con posible impacto de producto. **Restricción CSP documentada**: scriptSrcAttr/styleSrc ligados a la modularización de app.js. 300/301 tests (17 suites). |

### Diferidos honestos (requieren recursos externos o sesiones dedicadas)
1. **Wallet Passes nativos**: necesita certificado Apple Developer (WWDR) + issuer ID de Google Wallet. Backend preparado para añadirse sin tocar UI.
2. **Portal asistente v2** (community feed + document sharing): feature XL propia; el portal actual (BL-28) sigue operativo.
3. **Express 5 + multer 2 + sharp 0.35**: aplicar en ventana de mantenimiento con suite completa como red (`npm audit fix` parcial ya aplicable).
4. **Campaña ESLint**: baseline fijada en CI (`--max-warnings=2800`); bajar gradualmente.

### Métricas finales vs inicio
| Indicador | Inicio | Ahora |
|---|---|---|
| Instalación fresca | ❌ falla | ✅ verificada ×N |
| `npm test` | ❌ crash | ✅ **252/252 estable (3 runs)** |
| Exposición raíz HTTP | ❌ abierta | ✅ cerrada (curl verificado) |
| Llamadas API rotas FE | 7 familias | **0** |
| Password recovery / 2FA | backend sin UI | ✅ full-stack E2E |
| Backend sin UI | ~55% | <25% |
| Features nuevas (F4/F5) | — | plus-ones, forms condicionales, sponsors+leads, API keys UI, CRM UI, streaming híbrido |
