# AUDITORÍA COMPLETA DE CHECK PRO — 2026-11-13

**Método:** 6 agentes de auditoría en paralelo por dominio + los 3 de la sesión de juegos
(más el agente de pagos). Solo-lectura: cada hallazgo con archivo:línea y verificación
contra CREATE TABLE/INSERT o ejecución empírica en better-sqlite3 real.
**Cobertura:** TODO el proyecto — backend (todas las rutas), frontend (app.js 21k líneas,
módulos, páginas standalone), SPA shell, rutas públicas, seguridad de sistema.
**Estado de corrección:** los críticos de juegos/seguridad ya corregidos y desplegados
(v12.44.834→838). El resto queda como backlog priorizado en este documento.

---

## RESUMEN EJECUTIVO

| Dominio | Hallazgos | Críticos corregidos | Pendientes |
|---------|-----------|---------------------|------------|
| Juegos (Quiz/Fortuna/Raspa/Trivia/Slot) | 60+ | ✅ TODOS (v834-837, validados en vivo) | — |
| Pagos/Ecommerce/CRM 💰 | 9 | — | 9 (dinero — PRIORIDAD ALTA) |
| Mailing/Email/SMS/Push | 16 | — | 5 críticos + 5 seguridad (PRIORIDAD ALTA) |
| Encuestas/Gamificación/Contenido | 19 | — | 5 graves + 6 XSS (PRIORIDAD MEDIA) |
| Invitados/Check-in/Compliance | 13+1 | — | 2 graves (GDPR/security) + media |
| Sistema/Auth/Tenants/Plugins 🔐 | 17 | ✅ 3 SEC aplicados (v12.44.838) | 14 (escalada/secretos — PRIORIDAD ALTA) |
| SPA/Páginas públicas/Rutas | 6 | ✅ parcial (v12.44.838) | registro 500 + cachés (RÁPIDO) |
| Transversal ya corregido | ~12 | ✅ v12.44.834-838 | — |

**Clases sistémicas confirmadas** (buscarlas en cualquier código nuevo):
1. **CSP**: `style="` y `<style>` inline bloqueados → SIEMPRE `data-style`/CSS externo.
2. **JSON.parse(null)** devuelve null sin lanzar → SIEMPRE guard `if (str == null) return fallback`.
3. **better-sqlite3**: `run/all.apply(null/otro, ...)` = Illegal invocation → `stmt.all(...args)`.
4. **supertest**: los requests deben llevar el prefijo de montaje COMPLETO.
5. **fetchAPI** hace response.json() → para CSV/blobs usar fetch crudo + Authorization.
6. **DelegatedEvents** pasa solo data-a1..a4 (nunca el nodo) y `data-act="input"` no existe.
7. **Async sin try/catch** = request sin respuesta (unhandled rejection en Express 5).
8. **Restauración de pestañas de sub-grupo**: el Router no invoca switch*Tab → consumidor vivo o forzado.
9. **Caché**: bump SIEMPRE los ?v= de TODA página cuyo JS/CSS cambie (Cloudflare 4h + navegador 1d).

---

## 1. PAGOS/ECOMMERCE 💰 (9 hallazgos — DINERO, corregir primero)

1. **Cupón nunca aplicado al cargo Stripe** (payments.routes.js:63-102): el descuento solo va al registro local; Stripe cobra el total completo → cobro de más con recibos que no cuadran. Fix: `discounts: [{coupon}]` en la sesión o line_items prorrateados.
2. **Webhook marca completed ANTES de crear invitados, sin db.transaction()** (payments.routes.js:190-214): pago sin ticket irrecuperable (el guard pending salta los reintentos). Fix: envolver en db.transaction() y marcar completed al final.
3. **Cupón quemado al crear el checkout** (payments.routes.js:82): cada checkout abandonado consume un uso de max_uses. Fix: incrementar en el webhook de completion.
4. **Webhook de ecommerce sin verificación de firma** (ecommerce.routes.js:105): guarda webhook_secret y jamás lo usa → pedidos forjables. Fix: HMAC-SHA256 del body crudo contra el secreto.
5. **triggerWebhooks con argumentos invertidos** (payments.routes.js:215,240 y intelligence.routes.js:132): se pasa el UUID como tipo de evento → PAYMENT_COMPLETED nunca se dispara. Fix: firma correcta `triggerWebhooks(TIPO, data, eventId)`.
6. **changes.routes.js undo/redo sin roles ni ownership** (:17-35): cualquier rol aprobado deshace cambios de invitados de cualquier evento. Fix: authMiddleware(['ADMIN','PRODUCTOR']) + ownership.
7. **Metadata del carrito pisada** al completar (payments.routes.js:190): se pierde la trazabilidad del cupón. Fix: columna propia o merge.
8. **api_key de ecommerce expuesta en el listado** (ecommerce.routes.js:12): enmascarar.
9. **intelligence trigger manual mal llamado** (:132): mismo patrón de argumentos invertidos.

## 2. MAILING/EMAIL 📧 (16 hallazgos — 5 críticos CORREGIDOS ya en v12.44.838)

**CORREGIDOS**: require roto en email-service.js (ningún email transaccional salía,
incluida la recuperación de contraseña — 1 línea); colisión de id en el scheduler
(campañas SCHEDULED nunca se enviaban); edición de cuenta SMTP borraba las 2
contraseñas (probado empíricamente el patrón corregido).

**PENDIENTES (prioridad alta):**
- **Compositor y wizard con IDs fantasma** (app.js:17863+5, 18220+4): `mailing-composer-body`/`wizard-composer-body` no existen en el shell → toda campaña sale con cuerpo vacío. Fix: leer `mailing-body-html` real (línea 1005 del shell) o volcar Quill.
- **XSS por HTML crudo de email externo en el buzón** (app.js:17661): `msg.html` sin sanitizar (sin DOMPurify en el proyecto) → JS remoto en sesión admin. Fix: iframe sandbox (el preview ya usa iframe).
- **Descarga de adjuntos rota** (app.js:17692): fetchAPI hace response.json() sobre bytes. Fix: fetch crudo + blob + Authorization.
- **"Enviar email de prueba" falla siempre** (app.js:17845): body sin JSON.stringify (y lee el ID fantasma).
- **Endpoint duplicate de campañas muerto** (email.routes.js:1594): columnas fantasma (group_id/send_type/total_count no existen; la real es recipient_group_id).
- Menores: XSS en listado de campañas (17549), null-concat en cola (966), widget mailing muerto (9672), logger TDZ latente en push (16), case legacy (7550), processNext sin catch (1525).

## 3. ENCUESTAS/GAMIFICACIÓN/CONTENIDO 🧠 (19 hallazgos — 5 graves)

1. **XSS almacenado PÚBLICO en Propuestas** (app.js:14004): title/guest_name sin escapar enviados sin auth → JS en sesión del admin. Fix: App.esc().
2. **El builder de encuestas no persiste nada** (surveys.routes.js:96-106 vs frontend): el zod exige `{label}` y enum distinto; el frontend manda strings/null/otros tipos → POST siempre 400 → preguntas se pierden al recargar. Fix: alinear contrato.
3. **Editor de polls roto + sobrescritura** (app-gamification.js:68-70): métodos inexistentes (loadSessionsSelect/_initPollOptionListener) + `_editingPollId` sin resetear → "Nueva" hace PUT sobre la anterior. Fix: definir/quitar y resetear antes.
4. **Botón eliminar punto de agenda muerto** (app.js:6602,6626): `data-action` → `data-act="removeParent"`. Fix: 1 palabra (hecha en v12.44.838 el 2º sitio; falta el 1º).
5. **La agenda editada nunca se guarda** (PUT /agenda huérfano + id duplicado en loadConfigAgenda): fix = botón Guardar + corregir id.
6. **Cambio de estado de propuestas muerto** (app.js:14008): data-a1 literal mal citado. Fix: 1 línea (hecha en v12.44.838 junto al 4).
7. **XSS vía filename del álbum** (album.routes.js:19 + app.js:13316): el invitado público controla la extensión inyectada cruda en el src del img que aprueba el admin; SVG pasa el filtro. Fix: whitelist .jpg/.png/.webp + App.esc.
8-12. **XSS admin→admin** en Budget (12879), Speakers (13914), Survey templates (11153), Builder (11204/11250), Agenda times (6597): App.esc() mecánico.
13. **Export CSV de encuestas 401 siempre** (app.js:11376): window.open no envía Authorization. Fix: fetch crudo + blob.
14. toggleSurveyPreview stub vacío. 15. Promesas sin catch en gamificación. 16. 4 handlers síncronos sin try (inconsistencia JSON/HTML). 19. Certificados: título/subtítulo nunca se guardan (backend lee name/config, frontend manda title/subtitle).

## 4. INVITADOS/CHECK-IN/COMPLIANCE 👥 (13+1 hallazgos)

1. **Export GDPR deprecated SIN auth** (guests.routes.js:945): entregaba PII + qr_token (credencial del check-in público) a cualquiera — **ELIMINADO en v12.44.838**.
2. **Compliance portabilidad/olvido 404 siempre** (compliance.routes.js:79,138): usa getEventConnection (null sin sharding) en vez de getEventDb → el derecho al olvido de L-fase roto en el caso por defecto. Fix: getEventDb (PENDIENTE — legal, prioridad alta).
3. **Descarga JSON GDPR basura** (app.js:10813): concatenación dentro del string literal — **CORREGIDO v12.44.838**.
4. **switchConfigTab oculta solo 16 de 28 pestañas** (app.js:11008): secciones apiladas al salir de network/album/budget/etc. — **CORREGIDO v12.44.838** (derivado del DOM).
5. **Sugerencias de asistencia con ID equivocado** (app.js:11031→20075): mostraba el dropdown de grupos — **CORREGIDO v12.44.838**.
6. Excel: workbook fuera del try (parcial, ya mejorado). 7. castId sin guard → invitados huérfanos con event_id NULL (condicional). 8. /:eventId/network directorio con PII sin sesión (verificar diseño). 9-14. menores/latentes.
13. **XSS nombres de invitados** (registro público sin sanitizar → innerHTML en asistencia del admin): plausible, medio-alta. Pendiente App.esc.

## 5. SISTEMA/AUTH/TENANTS 🔐 (17 hallazgos — 3 SEC críticos CORREGIDOS en v12.44.838)

**CORREGIDOS**: (1) sync offline v2: roles + filtro de tenant (fuga masiva de PII cerrada);
(2) GET /settings ya no expone secretos de terceros (verificado en vivo: 0 secretos con valor).

**PENDIENTES (seguridad — prioridad alta):**
1. **Escalada PRODUCTOR cross-tenant** (users.routes.js:265/338/382): cambiar contraseñas de ajenos, degradar/eliminar ADMINs. Fix: exigir pertenencia al grupo como el GET.
2. **Auto-agregarse a cualquier grupo** (groups.routes.js:117): habilitador de la escalada — **CORREGIDO v12.44.838** (assertGroupAccess + DELETE de miembros).
3. **Webhooks globales sin check de propiedad** (webhooks.routes.js:145,218,274): PRODUCTOR manipula webhooks globales ajenos y lee su secreto HMAC.
4. **Plugins: instalación sin ownership + esquema roto** (plugins.routes.js:27-48; tabla plugins divergente entre database.js:1298 y database-manager.js:532 — install SIEMPRE 500): unificar CREATE + ownership.
5. **2FA disable/setup sin confirmación de contraseña** (auth.routes.js:574-599).
6. **apikeys: scopes NULL = bypass + claves en texto plano** (apikeys.routes.js:140).
7. Menores de rate/auth: password-reset sin limiter inline, verify sin username no cuenta intentos, HMAC con fallback inseguro sin JWT_SECRET, skip LAN en limiters, deploy JSON fuera de try.

## 6. SPA/PÁGINAS PÚBLICAS 🌐 (6 accionables)

1. **`/:evento/registro` devuelve 500 SIEMPRE** (index.js:133): sirve registro.html raíz que no existe; el real vive en public/html/pages/. Página pública rota de plano. Fix: servir pages/registro.html (respetando el comentario de server.js:434 sobre variables del scope) o eliminar la ruta y dejar el fallback.
2. quiz.html sigue en quiz.js?v=831 tras el fix v836 de hoy → bump a 837.
3. fortuna-play.html en ?v=836 con fixes v837 → bump.
4. landing.html carga chat-widget.js SIN cache-buster tras el fix de hoy → ?v=837.
5. survey/portal/kiosk/ticket/landing: DelegatedEvents?v=818 (fix v824 de teclas no llega) → bump.
6. raspa.html/raspa-play: ?v inconsistente (832 vs 836) → uniformar en el próximo bump.
7. app.js: los 30 imports internos congelados en ?v=818 (Router.js cambió HOY, api.js el 11-nov) → cada fix del shell tarda hasta 1 día en propagarse. **Pendiente: bump de los imports internos de app.js en el próximo deploy.**

## 7. LIMPIO (verificado sin hallazgos)

- Stripe webhook: firma verificada + body crudo antes del parser + idempotencia por status pending.
- Precios SIEMPRE recalculados en el servidor (nunca del body del cliente).
- Mailing: secretos SMTP/IMAP cifrados en reposo y enmascarados en respuestas; data-call de la pestaña Mailing 100% vivos; B1/B2/async limpios en el alcance.
- Encuestas/Gamificación: B1/B2 limpios en el alcance.
- Invitados: B1/B2 limpios en el alcance; modal OTP/check-in/QR vivos.
- Sistema: setup wizard bien blindado; 2FA TOTP correcto en login; middleware auth lee rol de BD; signup fuerza PRODUCTOR; castId robusto; tenants públicos limitados.
- Páginas standalone: HTML estático 100% limpio de CSP (0 style=, 0 on*=); data-call resuelve al 100% en las 13 páginas que lo usan; orden de rutas correcto; recursos inexistentes: ninguno.
- Plugins: doble prepare (ineficiencia, no bug).

## 8. LECCIONES SISTÉMICAS (aplicar en todo código nuevo de Check)

1. CSP: `data-style`/CSSOM, nunca `style=` ni `<style>` ni `on*=`.
2. `JSON.parse(x)`: SIEMPRE guard `if (x == null) return fallback` + `|| fallback`.
3. better-sqlite3: `stmt.all(...args)`, jamás `.apply(null/otro, ...)`.
4. supertest: prefijo de montaje completo en cada request.
5. fetchAPI = JSON; para texto/blobs fetch crudo + Authorization.
6. DelegatedEvents: handlers leen por ID; data-act solo del catálogo integrado.
7. Handlers async de Express: try/catch SIEMPRE (o responden 500 del error handler global).
8. Router: restaurar pestañas SOLO vía switch*Tab (nunca desocultar paneles directo).
9. Caché: bump ?v= de toda página tocada + de los imports internos de app.js.
10. Secretos: nunca en respuestas JSON (mascarar) ni en texto plano (cifrar con encryption.js).
