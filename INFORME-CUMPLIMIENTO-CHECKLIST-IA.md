# INFORME-CUMPLIMIENTO-CHECKLIST-IA.md — Check Pro v12.44.819

**Auditoría contra el protocolo de lanzamiento seguro para apps construidas con IA**
Protocolo: `~/.zcode/workspace/default/guia-lanzar-app-ia/CONSOLIDADO-para-agente.md` (Partes A–E)
Fecha: 2026-09-23 · Commit auditado: `a09d5ab` (v12.44.818, producción VPS) · Método: **solo lectura** + comandos ejecutados localmente. Producción NO tocada (regla del proyecto).

**Leyenda:** ✅ CUMPLE (evidencia ejecutada) · ⚠️ PARCIAL · ❌ NO CUMPLE · ➖ N/A (justificado) · 🔍 REQUIERE ACCESO (proxy/servidor)

---

## 0. ACTUALIZACIÓN v12.44.819 (2026-09-26) — hallazgos N-1..N-5 RESUELTOS con fixes aprobados por el operador

| Hallazgo | Antes | Ahora | Evidencia ejecutada |
|---|---|---|---|
| N-1 (B3) IA no declarada | ❌ | ✅ | §7 "Tratamiento mediante inteligencia artificial" en `/legal/privacidad`: asistente conversacional + análisis/predicción vía API de Google (Gemini); sin decisiones jurídicas automatizadas; derechos por canales ARCO (§5) |
| N-2 (B4) Terceros sin nombres | ⚠️ | ✅ | §8 de la política nombra: **Google** (Gemini/cuenta), **Stripe** (pago, PCI-DSS propia), **Twilio** (SMS/WhatsApp), proveedores de **email**, **hosting/BD** del operador |
| N-3 (B5) Sin borrado self-service | ⚠️ | ✅ | `POST /api/me/delete-account` (`auth.routes.js`): password + frase "ELIMINAR" → anonimiza (`eliminado+<uuid>@anulado.local`, `status='DELETED'`, password inutilizable, 2FA fuera); ADMIN → 403; consentimientos/bitácoras conservados. UI: "Exportar mis datos" + "Eliminar mi cuenta" en Sistema → Cuenta. Tests: `tests/launch-hardening.test.js` (8 tests) |
| N-4 (A20) 2 CVEs high | ⚠️ | ✅ | `npm audit fix` → multer **2.4.0**, sharp **0.35.4**; verificación: `npm audit --omit=dev` = **found 0 vulnerabilities** |
| N-5 (A12) Captcha no forzado | ⚠️ | ✅ | `public-register` valida `verifyCaptcha(captcha_token, captcha_answer)` antes de continuar; desafío visible en `registro.html/js` (un solo uso, se renueva al fallar); `GET /api/captcha` ahora pasa `req.ip` (antes clave 'unknown' compartida) con límite 30/10min y `429` al agotarse |
| N-6 (C) DPA en T&C | ⚠️ | 🔴 | Requiere abogado → agrupado con **L-0** |

**Marcador del protocolo tras v12.44.819: 19 ✅ / 5 ⚠️ / 0 ❌ / 2 N/A / 1 🔍.**
Tests: **345 passed / 1 skipped / 19 suites, exit 0**. El resto de este informe conserva
el detalle original de la auditoría del 2026-09-23 a modo histórico.

---

## 1. Resumen ejecutivo

| Estado | Ítems |
|---|---|
| ✅ Cumple | **19** — A1*, A2, A6, A7, A8, A10, A11, **A12**, A13, A14, A16, A18, **A20**, B1, B2, **B3**, **B4**, **B5**, D *(en negrilla: cerrados en v12.44.819 — sección 0)* |
| ⚠️ Parcial | **5** — A5, A9, A15, A17, C |
| ❌ No cumple | **0** — (B3 se resolvió en v12.44.819) |
| ➖ N/A | **2** — A3, A4 (SQLite local, no Supabase/RLS; equivalente cubierto por A6+A7) |
| 🔍 Requiere acceso | **1** — A19 (HTTPS/HSTS: lo fuerza Nginx Proxy Manager en producción, no el repo) |

**Veredicto:** base de seguridad sólida (helmet con CSP estricta, rate-limiting granular, bcrypt+política de contraseñas, SQL parametrizado, static whitelist) y una **Fase L legal (Ley 1581/2012) ya ejecutada hoy** con consentimiento evidenciado. Los huecos reales de cara a lanzar son 5: **2 vulnerabilidades high regresadas en dependencias**, **IA no declarada en la política de privacidad** (siendo que la app usa Gemini), **terceros sin nombres**, **captcha no forzado en registro público**, y los **pendientes de operador ya documentados** (P1-5 credenciales semilla en producción, L-0 abogado/RNBD, L-4b cifrado de backups). **Actualización v12.44.819: esos 5 huecos de código/texto quedaron cerrados (sección 0); solo quedan los pendientes de operador y L-0.**

---

## 2. Seguridad (Parte A del protocolo)

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| A1 | API keys ocultas | ✅* | `.gitignore:21-22` excluye `.env`/`.env.local`; `gitleaks` sobre 1.994 commits: 13 hallazgos, **todos benignos** (placeholders de `.env.example`/`setup.js` VAPID de ejemplo, `sk_test_placeholder` en `payments.routes.js`, falsos positivos verificados en `scripts/validate-production.js:115-127` que son `JSON.stringify` de respuestas). *Pendiente de operador crítico aparte: P1-5 (credenciales semilla en `.env` de PRODUCCIÓN, no verificable desde aquí). |
| A2 | Secrets purgados del historial | ✅ | Misma ejecución de gitleaks: **ningún secreto real en el historial** (conclusión coincide con `AUDIT_REPORT.md` §6 de agosto). No se requiere purga ni rotación por filtración de repo; PAT de GitHub ya sacado del YAML (P1-4 resuelto, rotación del PAT viejo sigue pendiente del operador). |
| A3 | Key pública de BD en cliente | ➖ | N/A: SQLite local con acceso solo desde el backend; no existe patrón Supabase (no hay key de BD en el frontend). |
| A4 | Row Level Security | ➖ | N/A: SQLite no tiene RLS. Equivalente implementado y verificado en A7 (filtros server-side + BD por evento). |
| A5 | Datos sensibles encriptados | ⚠️ | Parcial por hallazgo propio del proyecto **L-8/L-4b (ABIERTO)**: backups sin cifrar, claves Twilio en claro en `settings`, fallback silencioso sin `ENCRYPTION_KEY` (`AUDIT_REPORT.md` tabla Fase L). Fuente: `AUDIT_REPORT.md` L-8 — no re-verificado en código (marcado abierto por el propio proyecto hoy). |
| A6 | Auth forzada en servidor | ✅ | `authMiddleware` aplicado en **409 puntos** de routers (conteo con `grep -c`); auditoría runtime propia del proyecto verificó 401 sin token y 200 con token (`AUDIT_REPORT.md` §10); sin seeds de admin (wizard `/api/setup`, v12.44.802). |
| A7 | Acceso restringido a registros | ✅ | Spot-check: `GET /audit-logs` exige `authMiddleware(['ADMIN'])` (`public.routes.js:517`); BD separada por evento (`database-manager.js`); su auditoría verificó authZ runtime (§5). |
| A8 | Bloquear manipulación de campos | ✅ | `src/routes/auth.routes.js:190-192`: signup fuerza `const role = 'PRODUCTOR'` ignorando el rol del cliente (v12.44.802); cambios de rol/grupo reservados a ADMIN (P3-7 verificado server-side). |
| A9 | Cookies de sesión seguras | ⚠️ | La app **no usa cookies de sesión** (grep `httpOnly\|sameSite` en src/ y server.js: 0 resultados) → nada que asegurar por ese lado, PERO el JWT vive en **localStorage** (`public/js/modules/auth/SessionManager.js:12`, fallback en `public/js/src/frontend/api.js:23`) = token robable por XSS. Mitigación real: CSP sin `unsafe-inline` en ninguna directiva (A18). Recomendación futura: cookie `HttpOnly` o al menos mantener el guardián CSP anti-regresión. |
| A10 | Contraseñas hasheadas | ✅ | `bcrypt.hashSync(password, 10)` (`auth.routes.js:200` aprox.) + política central `src/security/password-policy.js` (prohíbe contraseñas expuestas, exige 10+ con mayús/minús/número, aplicada en setup/signup/reset/cambio — v12.44.802). |
| A11 | Límite de intentos de login | ✅ | `server.js:268-275`: `limiters.auth` sobre `/api/login`, `/api/signup`, `/api/setup`, `/api/password-reset`, `/api/verify-reset-code`, `/api/reset-password` (este último par añadido en L-4.1 de la Fase L de hoy). |
| A12 | Anti-bots | ⚠️ | Captcha propio SVG existe (`GET /api/captcha` + `POST /api/captcha/verify`, `public.routes.js:89-91,300-305`, módulo `src/security/captcha.js`) **pero `verifyCaptcha` NO se invoca dentro del flujo `public-register`** (grep: solo aparece en el par de endpoints de captcha). Rate-limit general mitiga. Hallazgo **N-5**. |
| A13 | SQL parametrizado | ✅ | Spot-check de TODAS las interpolaciones `${...}` en SQL de `src/`: `automation-v2.routes.js:112-115` valida contra allowlist (`allowed.includes(table)`); `public.routes.js:522-532` construye `where` con cláusulas fijas + `?`; `groups.routes.js:68-78` y `webhooks.js` arman `SET col = ?` con nombres de columna fijos y valores parametrizados. Sin inyección. Coincide con su auditoría §5 ("queries parametrizadas ✓" verificado runtime). |
| A14 | Validar inputs | ✅ | `express-validator` + `zod` en dependencias (`package.json`); suites de tests de validación activas (16 validation + 17 form en su auditoría §10). |
| A15 | Escapar contenido de usuario | ⚠️ | **417 usos de `innerHTML` en 19 archivos** de `public/js` (conteo con grep). Mitigaciones reales: CSP sin `unsafe-inline` (XSS de script bloqueado), helper `escJs`, guardián anti-regresión en `tests/visual.test.js` (prohíbe `<script>`/`<style>` inline). Riesgo residual: sinks con contenido de usuario requieren revisión caso a caso (fuera del alcance de esta pasada). |
| A16 | Subida de archivos restringida | ✅ | `multer` con `limits` + `fileFilter` en los 3 puntos de subida (`src/routes/index.js:67-71`, `album.routes.js:21-22`, `events.routes.js:871`); path-traversal guard en `/uploads` (su auditoría §6). Nota: los CVEs activos de multer van aparte en A20. |
| A17 | Recortar respuestas de API | ⚠️ | `/api/guests/by-id` minimizado y emails enmascarados en kiosk (L-2.2 de hoy) ✓, pero no hay revisión global de over-fetching; su auditoría detectó `SELECT * FROM guests` sin recorte en exports/badges. |
| A18 | Headers de seguridad | ✅ | `server.js:191-232`: helmet con **CSP sin `unsafe-inline` en ninguna directiva** (script/style-src-attr eliminados en v12.44.811), `frameguard: deny`, `noSniff`, `referrerPolicy: strict-origin-when-cross-origin`, `objectSrc: 'none'`, `baseUri`/`formAction: 'self'`. HSTS delegado conscientemente al proxy (`hsts: false` con comentario). |
| A19 | HTTPS forzado | 🔍 | En producción la app corre tras Nginx Proxy Manager (docker); el forzado de SSL/redirect 80→443/HSTS es configuración del proxy, **no verificable desde el repo**. Pendiente de verificación en NPM (o `curl -I http://<dominio>` esperando 301). |
| A20 | Escanear dependencias | ⚠️ | **REGRESIÓN**: `npm audit --omit=dev` HOY = **2 high** (era 0 en v12.44.808): `multer ≤2.2.0` (4 CVEs: DoS ×3 + file size limit bypass, GHSA-wc9g-mqfw-jrwm, qfvm-cv95-jqjf, qvfw-j98x-7q72, 535w-7cp7-47q4) y `sharp <0.35.4` (libheif GHSA-g89c-p67h-r497, 2jg2-4ch7-h545). **`npm audit fix` disponible**. gitleaks ✓ (A2). CI existe (`.github/workflows/ci.yml`, Fase 0). Hallazgo **N-4**. |

## 3. Legal app con IA (Parte B)

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| B1 | Política de privacidad publicada | ✅ | `/legal/terminos`, `/legal/privacidad`, `/legal/cookies` publicadas (`public/html/pages/legal-*.html`, L-3.2). Marcadas PLANTILLA — completar datos del responsable y validar con abogado (L-0, abierto). |
| B2 | Datos recopilados declarados | ✅ | Política con secciones de tratamiento y transferencias (`legal-privacidad.html` §7 verificado); enforcement real de consentimiento en signup/registro público con evidencia en BD (L-1A.1/A.3). |
| B3 | **Uso de IA declarado** | ❌ | **Hallazgo N-1**: `grep -in "inteligencia artificial\|IA\|chatbot" legal-privacidad.html` = **0 resultados**, siendo que la app tiene chatbot (`src/chatbot/engine.js`), módulos de predicción/recomendaciones, y modelo de IA configurado por defecto `google/gemini-2.0-flash-lite-preview-02-05` (`src/utils/schema.js:597`). Obligatorio declararlo antes de lanzar (multa citada en fuente: USD 5.000/usuario). |
| B4 | Terceros nombrados | ⚠️ | La política menciona terceros **genéricos** ("alojamiento, envío de correos, pasarelas de pago" — §7) pero **no los nombra**, y el código integra: Stripe, Twilio, Google (Gemini + googleapis), Nodemailer/IMAP (email), web-push, Redis. Hallazgo **N-2**. |
| B5 | Derecho al borrado | ⚠️ | Portabilidad self-service ✅ (`GET /api/me/export`, `auth.routes.js:343-357`). **Borrado de cuenta self-service NO existe**: solo `DELETE FROM users` por admin (`users.routes.js:374`). Campañas con opt-out (Ley 1335) ✓. Hallazgo **N-3**; conectar con L-4b (retención por tabla). |

## 4. SaaS B2B — responsable vs encargado (Parte C)

**Estado: ⚠️ (estructura existe, formalización pendiente).** Check Pro ES el caso del protocolo: los organizadores (clientes) cargan datos de SUS invitados → organizador = responsable, Check Pro = encargado. La relación ya se blinda del lado técnico (consentimiento evidenciado, import con declaración de autorización L-1B.1, pie de email + opt-out), pero falta la pieza contractual: cláusulas de encargado específicas (finalidad, confidencialidad post-relación, brechas+plazo, subprocesadores, destino de datos al terminar) dentro de los T&C — hoy plantillas sin validación de abogado (L-0). Hallazgo ligado **N-6**.

## 5. Evidencia de aceptación de términos (Parte D)

**Estado: ✅ (el mejor punto legal del proyecto).** `INSERT INTO consent_logs (…, consent_type, consent_given, consent_text, ip_address, user_agent)` (`auth.routes.js:210`) guarda texto del consentimiento + IP + user-agent + fecha; export CSV de consentimientos por evento (L-1A.4); documentos legales versionados en git (recuperables históricamente). Nota: el proyecto declara además "hash de política" en `AUDIT_REPORT.md` L-1 (no re-verificado columna a columna en esta pasada).

---

## 6. Hallazgos nuevos de esta auditoría (no estaban en AUDIT_REPORT.md)

| ID | Sev | Hallazgo | Evidencia |
|---|---|---|---|
| N-1 | **P1** | Uso de IA (Gemini/chatbot/intelligence) NO declarado en política de privacidad | grep legal-privacidad.html = 0; `schema.js:597` `ai_model = google/gemini…` |
| N-4 | **P1** | Regresión de dependencias: 2 CVEs high en producción (multer, sharp); fix disponible | `npm audit --omit=dev` → 2 high (detalle en A20) |
| N-2 | P2 | Terceros mencionados genéricamente, sin nombres (Stripe/Twilio/Google/Gemini/email) | `legal-privacidad.html` §7 vs dependencias reales |
| N-5 | P2 | Captcha implementado pero no forzado en `public-register` | grep `verifyCaptcha` solo en endpoints de captcha, no en el handler de registro |
| N-3 | P2 | Sin autogestión de borrado de cuenta (solo admin) | grep rutas `/me/*`: 2fa setup/verify/disable + export; sin delete |
| N-6 | P2 | Faltan cláusulas de encargado (DPA) en T&C con organizadores | T&C = plantilla sin revisión legal (L-0) |

## 7. Pendientes ya documentados por el proyecto (confirmados, NO cerrados aquí)

- 🔴 **P1-5 (crítico, solo operador):** `.env` de producción con credenciales semilla `admin@example.com`/`changeme123` aceptadas por login. Rotar YA.
- 🔴 **L-0:** completar plantillas legales con datos del responsable + revisión de abogado + inscripción RNBD (ene–mar).
- 🔴 **L-4b:** cifrar backups, cifrar claves Twilio en `settings`, alerta sin `ENCRYPTION_KEY`, retención por tabla.
- 🟡 **Kiosco:** generar tokens por evento y/o activar `KIOSK_TOKEN_MODE=strict` en producción (L-2 pendiente de operador).

## 8. Acciones recomendadas (para aprobación — NO aplicadas en esta auditoría)

1. **Ya (P1):** `npm audit fix` (cierra multer + sharp), suite completa verde, bump de versión. 
2. **Ya (P1, texto):** añadir sección "Tratamiento mediante inteligencia artificial" a `/legal/privacidad` + nombrar terceros en §7 (texto final con abogado).
3. **Corto (P2):** exigir `verifyCaptcha` en `public-register` (y evaluar en búsqueda de kiosco).
4. **Corto (P2):** borrado de cuenta self-service con retención por tabla (ata con L-4b).
5. **Operador:** P1-5 rotar credenciales, tokens de kiosco, L-0 abogado/RNBD, verificar HTTPS/HSTS en NPM (A19).

---
*Auditoría de verificación (checklist IA) — 2026-09-23. Sin modificaciones de código. Tests: no re-ejecutados en esta pasada (último estado declarado por el proyecto: 337/337 en v12.44.818 — NO VERIFICADO aquí).*

**Re-verificación 2026-09-26 (solo lectura):** (1) `npm test` → **337 passed / 1 skipped / 18 suites, exit 0** en 2 de 3 corridas (la 1.ª tuvo 1 suite fallida no identificada → test inestable a investigar). (2) `npm audit --omit=dev` → confirma **2 high** (multer, sharp), `npm audit fix` disponible. (3) Los hallazgos **N-1, N-2, N-3 y N-5 siguen ABIERTOS** en el árbol de trabajo: `grep` de IA/terceros en `legal-privacidad.html` = 0 resultados; `verifyCaptcha` solo en endpoints de captcha (no en `public-register`); único `DELETE FROM users` en `users.routes.js:374` (admin). Nada de la sección 8 ha sido aplicado aún.
