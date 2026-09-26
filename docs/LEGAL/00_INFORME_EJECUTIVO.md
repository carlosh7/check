# INFORME EJECUTIVO — CUMPLIMIENTO LEGAL Y PROTECCIÓN DE DATOS · Check Pro v12.44.817

**Auditoría legal-compliance** · Fecha: 23 de septiembre de 2026 · Método: análisis estático del código con evidencia `archivo:línea` + investigación web (competencia y marco normativo)
**Documentos complementarios:** [`01_BENCHMARK_COMPETENCIA_LEGAL.md`](./01_BENCHMARK_COMPETENCIA_LEGAL.md) · [`02_MARCO_NORMATIVO.md`](./02_MARCO_NORMATIVO.md)

> ⚠️ **Aviso importante:** este informe es material técnico-legal de trabajo. NO sustituye la asesoría de un abogado colegiado en Colombia. Las decisiones con impacto jurídico (documentos contractuales, inscripción en el RNBD, respuestas ante la SIC) deben validarse con counsel profesional.

> ✅ **ACTUALIZACIÓN 2026-09-23 (v12.44.818) — FASE L IMPLEMENTADA (código):**
> **C-1 ✅** (consentimiento con prueba server-side + plus-ones + signup + export CSV + cierre de `/consent` público) ·
> **C-2 ✅** (kiosk search enmascara email siempre; token de kiosco opcional/estricto; `/qr/token` protegido; `by-id` minimizado — pendiente operador: generar tokens o activar `KIOSK_TOKEN_MODE=strict` en producción) ·
> **C-3 🟡** (plantillas `/legal/terminos|privacidad|cookies` publicadas + aceptación en signup; falta completar datos del responsable, validación de abogado y RNBD) ·
> **C-6 ✅ parcial** (rate limit en verify/reset-password; falta hashear código e intentos) ·
> **C-8 ✅ parcial** (`/api/me/export` + fix constante auditoría; falta baja de cuenta self-service y re-verificación de email) ·
> **C-10 ✅ parcial** (declaración plus-ones; captcha server-side pendiente) ·
> **C-4, C-5, C-7, C-9, C-11, C-12 🔴 abiertos** (ver FASE L en `ACTION_PLAN.md`: L-4b y siguientes).
> Detalle completo en `AUDIT_REPORT.md` (sección v12.44.818) y guía de usuario en `docs/user/13-cumplimiento-legal/`.

---

## 1. Resumen ejecutivo

La base de seguridad técnica de Check Pro es **notablemente superior a la de la competencia analizada**: bcrypt + política de contraseñas + 2FA TOTP, JWT con blacklist, rate limiting granular (~25 buckets), CSRF, CSP endurecida sin `unsafe-inline`, audit logging con IP/UA, módulo de compliance con clasificación de datos, export de portabilidad, derecho al olvido, registro de consentimientos y herramientas de retención. En pagos usamos Stripe Checkout por redirección (los datos de tarjeta NUNCA tocan nuestro servidor — alcance PCI mínimo SAQ-A). El opt-out de email existe y se respeta en los envíos.

Sin embargo, la auditoría destapa **huecos legales concretos** que hoy dejarían a la empresa sin defensa ante la SIC o ante un incidente:

1. **🔴 C-1 — No existe prueba del consentimiento en el registro público.** El checkbox "Acepto la política de tratamiento de datos personales" (`public/html/pages/registro.html:127-131`) es validación solo de cliente: el backend `POST /api/public-register` (`src/routes/public.routes.js:304`) **ni siquiera lee ese campo**, y nada escribe en la tabla `consent_logs` que ya existe. La Ley 1581 (arts. 8-9) pone la **carga de probar la autorización en el responsable**. Es el hallazgo legal más grave.
2. **🔴 C-2 — Tres endpoints públicos exponen datos personales de invitados sin autenticación.**
3. **🔴 C-3 — No existen los documentos legales del operador** (T&C, Política de Tratamiento de Datos, política de cookies, canal ARCO con plazos, contrato de encargo con productores) ni el registro en el **RNBD** de la SIC.
4. **🟠 C-4 a C-6** — Datos sensibles (alergias) sin tratamiento diferenciado; cifrado en reposo incompleto (backups sin cifrar, claves Twilio en claro en BD, fallback silencioso a texto plano sin `ENCRYPTION_KEY`); códigos de recuperación de 6 dígitos fuerza-bruteables por límites de tasa insuficientes.
5. **🟡 C-7 a C-12** — Derecho al olvido incompleto, sin ARCO self-service para usuarios de la plataforma, retención sin política por finalidad, captcha no aplicado en el registro público, menores sin gestión, verificación de HTTPS/HSTS en producción.

**Score de cumplimiento legal estimado: 45/100** (seguridad técnica ~75; formalización legal ~15). La competencia tampoco está bien (políticas sin menores, retención "80 años", plazos ARCO incumplibles) — **hay oportunidad real de diferenciarse siendo la primera boletería del sector con cumplimiento serio**: consentimiento con prueba versionada, aviso de brechas, retención por finalidad y PCI declarado.

---

## 2. Hallazgos detallados (con evidencia)

### 🔴 C-1 · Consentimiento de datos personales sin prueba ni enforcement server-side — **P0**

**Evidencia:**
- Checkbox solo en cliente: `public/html/pages/registro.html:127-131` (`input type="checkbox" id="reg-agreement" required`), activado/desactivado por evento vía `reg_require_agreement` (`public/js/pages/registro.js:141`).
- El backend `POST /api/public-register` (`src/routes/public.routes.js:304-442`) **no recibe ni valida `agreement`** y no registra ningún consentimiento: la línea 305 solo desestructura `event_id, name, email, phone, organization, position, gender, dietary_notes`.
- La tabla `consent_logs` existe con esquema correcto (`src/routes/compliance.routes.js:168-181`: guest_id, consent_type, consent_text, ip_address, user_agent, created_at) y el panel admin la consulta (`public/js/app.js:10524-10532`)… pero **ningún flujo de la aplicación escribe en ella**. El único `POST /api/compliance/consent` (línea 184) está **sin autenticación** y sin callers en el frontend de registro.
- Igual pasa con el **signup de la plataforma** (`src/routes/auth.routes.js:176-204`): no captura aceptación de T&C/política de privacidad.

**Norma:** Ley 1581 arts. 8-9 (autorización previa, expresa e informada; conservar prueba); Decreto 1377 arts. 3-13 (autorización por vía electrónica = enunciado específico + aceptación). La SIC sanciona no poder demostrar la autorización (hasta 2.000 SMLMV).

**Acción (incremental, sin borrar nada):**
1. En `public-register`: leer `agreement` del body; si `reg_require_agreement=1` y no viene `true` → 400. Registrar en `consent_logs` (consent_type='data_treatment', consent_text=policy del evento + versión/hash, ip, user_agent) para el invitado y cada plus_one.
2. En `/api/signup`: exigir campo `accepted_terms` + guardar registro de aceptación (texto/versión, IP, fecha).
3. Proteger `POST /compliance/consent` con firma HMAC o mover la escritura al backend (no dejarlo abierto).
4. Para pagos: registrar además el consentimiento en el flujo checkout (mismo estándar).

---

### 🔴 C-2 · Endpoints públicos que exponen datos personales de invitados — **P0**

**Evidencia:**
- `GET /api/kiosk/:eventId/search` (`src/routes/public.routes.js:122-137`): **sin autenticación**, busca por LIKE y devuelve `id, name, email, organization, checked_in` de hasta 20 invitados por consulta. Con solo conocer el ID del evento (visible en la URL de registro pública), cualquiera puede **enumerar la lista completa de invitados** con sus emails (a→b→c…). Además es función objetivo del kiosco, no bug: el diseño carece de control de dispositivo.
- `GET /api/guests/qr/:guestId/token` (`src/routes/public.routes.js:257-263`): sin auth, devuelve el `qr_token` → con él, `POST /kiosk/checkin` (línea 140) permite **check-in fraudulento / suplantación de asistencia**.
- `GET /api/portal/:guestId` (`src/routes/public.routes.js:94-117`): sin auth, devuelve nombre, email y `qr_token` de cualquier invitado cuyo ID se conozca.
- El QR del invitado codifica una URL pública por ID (`/api/guests/by-id/...`, línea 247): si los IDs son predecibles/secuenciales, el riesgo escala.

**Norma:** deber de seguridad de la información (Ley 1581 art. 17 num. 7); acceso no autorizado = incidente notificable a la SIC (≈15 días hábiles) y a titulares si hay riesgo. Comparado con GDPR art. 32 (medidas técnicas proporcionales). Tuboleta, por contraste, blindó su QR (dinámico por app, sin capturas).

**Acción (incremental):**
1. Token de kiosco por evento: el productor genera un `kiosk_token` (en la config del evento), el kiosco lo envía en header/query; `/kiosk/*/search` y `/kiosk/checkin` lo validan. Mantener compatibilidad: aceptar el flujo actual solo si `NODE_ENV=development` o flag de evento `kiosk_open=1` (modificar incrementativamente: nueva validación con bypass controlado).
2. `/portal/:guestId` y `/guests/qr/:guestId(/token)`: exigir el `qr_token` como prueba de posesión (el invitado ya lo tiene en su boleta) o firmar los URLs (HMAC + expiración), y devolver mínimo necesario (sin email completo — enmascarar `j***@dominio`).
3. Revisar si los IDs de invitado son secuenciales (`getValidId`) → migrar a UUID en nuevas creaciones (no tocar existentes).

---

### 🔴 C-3 · Documentos legales del operador inexistentes + RNBD + contrato de encargo — **P0 (documental, no de código)**

**Evidencia:**
- Buscar "privacidad|términos|habeas" en el frontend solo arroja: el checkbox del registro, un editor de textos legales **por evento** (`app-shell.html:2169-2176`, defaults genéricos en `app.js:16099-16000` — "Habeas Data (Colombia). Sus datos se usarán para logística del evento."), y la pestaña de compliance. **No existe** página de Términos y Condiciones de la plataforma, ni Política de Tratamiento de Datos Personales del operador, ni política de cookies, ni canal formal de consultas/reclamos con plazos (10/15 días hábiles), ni manual interno de privacidad (obligatorio, Decreto 1377 art. 13).
- La doble condición del operador (Responsable de usuarios-productores / Encargado de los invitados de cada productor) **no está formalizada**: falta la cláusula de encargo (Ley 1581 art. 18) en los T&C B2B.
- No hay evidencia de inscripción en el **RNBD** (bases: usuarios, asistentes, staff, auditoría, consentimientos) ni del calendario de actualización anual (2 ene – 31 mar, Decreto 4288/2020).

**Acción (mixta código + legal):**
1. Redactar (con abogado) y publicar: T&C de la plataforma, Política de Tratamiento (con contenido mínimo Decreto 1377), política de cookies (aunque solo haya storage esencial de la PWA), canal ARCO (email dedicado tipo privacidad@…), aviso de menores.
2. Cláusula de **encargo del tratamiento** en los T&C para productores + plantilla de contrato B2B.
3. Inscribir las bases en el RNBD ante la SIC y agendar la actualización anual.
4. Agregar en la app rutas públicas `/legal/terminos`, `/legal/privacidad`, `/legal/cookies` y enlaces en footer del registro público y del shell.
5. Protocolo escrito de **notificación de brechas** (SIC + titulares) — escribirlo ANTES del primer incidente.

---

### 🟠 C-4 · Datos sensibles (salud/alimentarias) sin tratamiento diferenciado — **P1**

**Evidencia:** `dietary_notes`, `restricciones`, `vegano` en `guests` (`src/utils/database-manager.js:252-254`); el textarea "Alergias o restricciones alimentarias" en el registro (`registro.html:122`). Las alergias revelan condiciones de salud = **dato sensible** (Ley 1581 art. 6): requiere autorización explícita e informada diferenciada y seguridad reforzada. Hoy se recolectan bajo el mismo checkbox genérico (y a veces sin él, por C-1). El derecho al olvido (`compliance.routes.js:121`) sí las limpia del invitado, pero la clasificación interna (`data_classification`, schema.js:994) debe marcarlas `is_spi=1` y la política debe declararlas.

**Acción:** checkbox diferenciado y opcional para datos de salud en el registro (sin bloquear el envío si no se marca), clasificación en `data_classification`, mención expresa en la política del evento/plantilla.

---

### 🟠 C-5 · Cifrado en reposo incompleto y fallback silencioso — **P1**

**Evidencia:**
- Módulo AES-256-GCM correcto (`src/security/encryption.js`), pero: `encrypt()` **devuelve el texto plano si `ENCRYPTION_KEY` no está definida** (`encryption.js:17-18`), sin alertar al operador; `decrypt()` también devuelve el dato crudo ante cualquier anomalía (líneas 29-44).
- Se usa para SMTP/IMAP (`encryption.js:74-91`), pero las **claves Twilio viven en texto plano** en `settings` (`src/routes/sms.routes.js:51`: `accountSid.setting_value, authToken.setting_value` sin cifrar).
- **Backups sin cifrar**: `src/utils/backup.js:24-31` copia la BD completa (todos los datos personales) a `data/system/backups/*.db` en texto claro, retención 7 días. La BD SQLite no usa cifrado en reposo (no hay SQLCipher).
- `migrateExistingPasswords()` solo cubre `email_accounts` — no hay migración/cifrado para settings de terceros.

**Norma:** deber de seguridad (Ley 1581 art. 17.7); PCI DSS v4.x exige cifrado de datos de autenticación en reposo (no aplicamos PAN, pero el principio rige para credenciales). 

**Acción:** cifrar `setting_value` de credenciales de terceros (Twilio) reutilizando `encryption.js`; fallar **ruidosamente** (o marcar estado `encryption.enabled=false` visible en el panel de salud) si falta `ENCRYPTION_KEY`; cifrar los backups (gzip + AES-GCM con la misma clave o clave dedicada `BACKUP_ENCRYPTION_KEY`); documentar cifrado a nivel disco en el VPS (LUKS) como capa adicional.

---

### 🟠 C-6 · Fuerza bruta contra códigos de recuperación + secreto de producción — **P1**

**Evidencia:**
- `/api/verify-reset-code` y `/api/reset-password` (`auth.routes.js:240-284`) **no tienen rate limiting propio**: en `server.js:268-271` el limiter `auth` (50/window) solo cubre `/api/login`, `/api/signup`, `/api/setup` y `/api/password-reset*` (prefijo que coincide con `password-reset-request` pero **no** con `verify-reset-code` ni `reset-password`). Quedan bajo `limiters.general` = **10.000 peticiones** (`src/middleware/rate-limiter.js:34`) → espacio de búsqueda de 10^6 códigos es atacable.
- El código se guarda en claro en `password_resets` (línea 217), sin contador de intentos, y `verify-reset-code` no liga código↔usuario.
- Además, hallazgo abierto **P1-5** del AUDIT_REPORT (línea 184): el `.env` de producción conserva credenciales semilla (`admin@example.com/changeme123`) — pendiente exclusivo del operador.

**Norma:** deber de seguridad (art. 17.7); un account-takeover masivo sería un incidente notificable.

**Acción:** aplicar `limiters.auth` a `/api/verify-reset-code` y `/api/reset-password`; guardar el código hasheado (bcrypt) + contador de intentos (máx. 5) + ligar email en la verificación; **operador: rotar YA la contraseña admin de producción** (P1-5).

---

### 🟡 C-7 · Derecho al olvido y portabilidad incompletos — **P1**

**Evidencia:** el erasure (`src/routes/compliance.routes.js:112-139`) anonimiza la fila `guests`, pero **no** toca: `registration_field_values` (campos personalizados, pueden contener PII), `plus_ones` (invitados hijos con nombre/email/teléfono), fotos del álbum (`uploads/photos/`, `album.routes.js:13`), ni `transactions` (guarda guest_name/guest_email — ojo: transacciones con obligación fiscal DIAN se retienen, se debe anonimizar solo lo no fiscal y documentarlo). El export (líneas 77-109) sí exporta el guest con sesiones, pero no `registration_field_values`.

**Acción:** ampliar erasure/export a `registration_field_values` y plus_ones (sesiones y álbum según política); para transacciones: borrar/anonimizar campos de persona dejando el registro contable (importes/fechas); documentar la excepción fiscal en la política de retención.

---

### 🟡 C-8 · Sin ARCO self-service para usuarios de la plataforma + bug de auditoría — **P2**

**Evidencia:** export/erasure existen para **invitados** (admin-driven), pero el usuario de la cuenta no tiene "descargar mis datos" ni "eliminar mi cuenta y mis datos". El cambio de email (`auth.routes.js:327-343`) intenta auditar con `AUDIT_ACTIONS.USER_PROFILE_UPDATED` (línea 337) — **esa constante no existe** en `src/security/audit.js:41-73` (solo `USER_UPDATED`) → el log se pierde silenciosamente (queda como acción `undefined`/falla el insert dentro del try-catch). Además el cambio de email no re-verifica propiedad del nuevo correo (posible secuestro de notificaciones).

**Acción:** endpoint `GET /api/me/export` (portabilidad), flujo de baja propia con confirmación y periodo de gracia; corregir la constante a `USER_UPDATED`; re-verificación de email (token al nuevo correo antes de aplicar).

---

### 🟡 C-9 · Retención sin política por finalidad; limpieza borra auditoría — **P2**

**Evidencia:** `DELETE /api/compliance/retention/clean` (`compliance.routes.js:251-258`) borra `audit_logs` y `consent_logs` por antigüedad con un solo parámetro `days` (365 default). Los logs de auditoría/seguridad conviene retenerlos más (investigación de incidentes; la SIC puede pedir trazabilidad), y **la prueba del consentimiento debe durar la vida de la base** (no borrar consent_logs a 365 días). No hay política documentada de plazos por base de datos (asistentes, auditoría, transacciones fiscales).

**Acción:** separar políticas por tabla (audit: 12-24 meses; consent: vida de la base + 2 años; asistentes: evento + 2 años o según productor; transacciones: 5+ años por DIAN), exponer la política en el panel y en `/legal/privacidad`.

---

### 🟡 C-10 · Captcha existe pero no se aplica al registro público; sin verificación de email — **P2**

**Evidencia:** hay captcha (`src/security/captcha.js`, endpoints `public.routes.js:88,275`) pero `public-register` (línea 304) **no lo verifica**; con `limiters.general` de 10.000 se pueden inyectar registros falsos masivos (contaminación de bases = responsabilidad de manejo de datos de terceros no autorizados). No hay doble opt-in de email (alguien puede registrar a un tercero sin su autorización — la autorización del titular sería defectuosa).

**Acción:** exigir captcha verificado server-side en `public-register` (ya existe la infraestructura, solo cablear); opcionalmente email de confirmación (doble opt-in) como mejora.

---

### 🟡 C-11 · Menores de edad sin gestión — **P2**

**Evidencia:** el registro público no pregunta edad ni requiere representante; `reg_show_gender` existe pero no control de edad (Ley 1581 art. 7: tratamiento de menores proscrito salvo excepciones; eventos infantiles son caso real). Ningún competidor lo hace bien (TuTicket/Ticketshows omiten menores por completo) — oportunidad de diferenciación.

**Acción:** setting por evento `reg_min_age` + cláusula en plantilla de política (autorización del representante para <14/18 según el caso) + advertencia Ley 679/1336 en boletas/eventos (módulo imprimible para productores).

---

### 🟡 C-12 · Transporte: app HTTP plano; TLS delegado a Nginx — **P2 (verificar en producción)**

**Evidencia:** `http.createServer` (`server.js:131`), `hsts:false` y `upgradeInsecureRequests:null` deshabilitados deliberadamente para LAN (`server.js:217-221`). Correcto para el lab, pero en producción (VPS + Nginx Proxy Manager) hay que **verificar**: HTTPS forzado + HSTS habilitado en el vhost, y cookies/tokens nunca en query string (ya corregido en v12.44.805, AUDIT_REPORT P2-1 ✅).

**Acción:** checklist de producción (HSTS on, redirect 80→443, TLS ≥1.2), activar `upgradeInsecureRequests` cuando `NODE_ENV=production` detrás de TLS.

---

## 3. Lo que ya cumplimos bien (para el expediente)

| Obligación | Estado | Evidencia |
|---|---|---|
| Cifrado de contraseñas (bcrypt + política + prohibición de expuestas) | ✅ | `auth.routes.js:193`, `src/security/password-policy.js` |
| 2FA TOTP opcional + JWT HS256 con blacklist y limpieza | ✅ | `auth.routes.js:372-405`, `src/security/jwt.js` |
| Revocación de token al cerrar sesión | ✅ | `auth.routes.js:146-154` (H-7, v12.44.817) |
| Rate limiting granular + CSRF + CSP endurecida sin unsafe-inline + helmet | ✅ | `server.js:191-299` |
| Estáticos en whitelist (no exposición del repo) | ✅ | `server.js:336-353` (P0-2 resuelto) |
| Audit logging con IP/user-agent | ✅ | `src/security/audit.js` |
| Módulo compliance: clasificación de datos, access-log de datos confidenciales, export (portabilidad), erasure, retención | ✅ (parcial, ver C-7) | `src/routes/compliance.routes.js` |
| Pagos sin tocar PAN (Stripe Checkout redirección) → alcance SAQ-A | ✅ | `payments.routes.js:96-109` |
| Opt-out de email respetado en envíos masivos | ✅ | `email.routes.js:908` (`unsubscribed = 0`) |
| Cifrado de credenciales SMTP/IMAP | ✅ (condicionado, ver C-5) | `src/security/encryption.js` |
| Consent logs + aceptación de política configurable por evento | 🟡 infraestructura sí; enforcement/prueba no (C-1) | `compliance.routes.js:164-198` |
| Registro de auditoría del propio sistema (PWA, sin cookies de terceros) | ✅ | sin gtag/analytics externos (grep limpio) |

---

## 4. Mapa de cumplimiento (obligaciones del marco normativo vs. estado)

Resumido del checklist de 22 obligaciones de [`02_MARCO_NORMATIVO.md` §4](./02_MARCO_NORMATIVO.md):

| Obligación | Estado en Check Pro |
|---|---|
| 1. Autorización previa + prueba | ❌ C-1 (checkbox sin enforcement ni registro) |
| 2. Aviso de privacidad / política publicada | ❌ C-3 |
| 3. Manual interno de privacidad | ❌ C-3 |
| 4-5. RNBD inscripción + actualización anual | ❌ C-3 (verificar si la empresa ya registró; no hay evidencia en repo) |
| 6. Canal ARCO con plazos 10/15 días | ❌ C-3/C-8 |
| 7. Protocolo de notificación de brechas | ❌ C-3 (no documentado) |
| 8. Seguridad de la información | ✅ sólida en tránsito/acceso; 🟠 reposo (C-5) |
| 9. T&C sin cláusulas abusivas + reembolsos | ❌ C-3 (el negocio de eventos debe definirlas por productor) |
| 10. Confirmación de compra con constancia | 🟡 existe email transaccional; revisar contenido legal (condiciones de devolución) |
| 11. Marketing con opt-out (Ley 1335) | ✅ email; 🟡 SMS/push revisar leyenda de baja |
| 12. Política de cookies | ❌ C-3 (ventaja: no usamos cookies de tracking) |
| 13. Facturación electrónica DIAN | ❌ no integrada (decisión de negocio: emitir vs. proveedor tecnológico) |
| 14. PCI DSS vía pasarela (SAQ-A) | ✅ diseño correcto; mantener redirección pura (evitar iframe) |
| 15. Contrato de encargo con organizadores | ❌ C-3 |
| 16. Menores | ❌ C-11 |
| 17. Advertencias Ley 679/1336 | ❌ C-11 |
| 18. Transferencias internacionales (cláusulas con hosting/pasarela/email) | ❌ pendiente documental (proveedores: Contabo VPS, Stripe, SMTP) |
| 19. Retención y supresión por finalidad | 🟡 herramientas sí, política no (C-7/C-9) |
| 20-22. LATAM / ISO / monitoreo legislativo | ⏳ P2 (documentar cuando haya expansión real) |

---

## 5. Plan de acción propuesto (para integrar a ACTION_PLAN.md como "FASE L — Legal & Compliance")

> Propuesta pendiente de confirmación del operador. Orden por riesgo legal, no por dificultad. Todo incremental (regla #1): nada sustitutivo.

### L-0 · Decisiones del operador (bloqueante, sin código)
1. Rotar credenciales semilla de producción (P1-5 abierto) y verificar HTTPS/HSTS en el vhost de Nginx (C-12).
2. Definir identidad legal del operador (razón social, NIT, domicilio, email de privacidad) — es el insumo de TODOS los documentos.
3. Contratar/consultar abogado para validar los documentos de L-1 y la inscripción RNBD.

### L-1 · Consentimiento con prueba (P0, código) — C-1, C-4, C-10
1. `public-register`: validar `agreement` server-side + escribir `consent_logs` (texto/versión de política, IP, UA) para invitado y plus_ones. Esfuerzo M.
2. Checkbox diferenciado y opcional para datos de salud (alergias). Esfuerzo S.
3. Captcha server-side obligatorio en `public-register`. Esfuerzo S.
4. `signup`: aceptación registrada de T&C/política. Esfuerzo S.
5. Cerrar `POST /compliance/consent` abierto (firma interna). Esfuerzo S.

### L-2 · Cerrar exposición pública de datos (P0, código) — C-2
1. `kiosk_token` por evento para search/checkin (bypass solo dev). Esfuerzo M.
2. Portal/QR: exigir prueba de posesión (`qr_token`) y enmascarar email. Esfuerzo M.
3. Revisión de IDs secuenciales → UUID en nuevos registros. Esfuerzo S.

### L-3 · Documentos legales + ARCO + brechas (P0 documental / P1 código) — C-3, C-8
1. Redacción (abogado) y publicación de T&C, Política de Tratamiento, Cookies, Canal ARCO (plazos 10/15 días), Manual interno, Protocolo de brechas, Contrato de encargo. Esfuerzo M (con counsel).
2. Rutas públicas `/legal/*` + footer en registro y shell. Esfuerzo S.
3. ARCO self-service: `GET /api/me/export` + baja de cuenta con periodo de gracia. Esfuerzo M.
4. Fix `USER_PROFILE_UPDATED`→`USER_UPDATED` + re-verificación de email. Esfuerzo S.
5. Inscripción RNBD + calendario anual. Esfuerzo S (trámite).

### L-4 · Cifrado en reposo y hardening (P1, código) — C-5, C-6, C-7, C-9
1. Cifrar settings de Twilio con `encryption.js`; alerta visible si `ENCRYPTION_KEY` falta; backups cifrados. Esfuerzo M.
2. Rate limit + hash de código + intentos en recovery. Esfuerzo S.
3. Erasure/export completos (custom fields, plus_ones; transacciones anonimizadas salvo fiscal). Esfuerzo M.
4. Políticas de retención por tabla en el panel. Esfuerzo S.

### L-5 · Diferenciadores de mercado (P2, post-cumplimiento)
1. Página pública de eventos cancelados/estado de reembolsos (imitar LaTiquetera).
2. Módulo de advertencias Ley 679/1336 para productores + control de edad por evento.
3. Leyenda de baja en SMS/push comerciales (Ley 1335).
4. Términos por defecto de alta calidad por evento (plantilla robusta que reemplace el default "Habeas Data" de 1 línea, `app.js:16099`) — sin borrar el editor existente.
5. Evaluación ISO 27001 (la DIAN la exige a proveedores tecnológicos de facturación; señal comercial).

**Criterio de salida de la fase:** un tercero puede registrar un invitado real y obtener, ante solicitud ARCO, export+supresión **con prueba de consentimiento versionada**; el pentest de endpoints públicos no expone PII sin autorización; los 7 documentos legales publicados y RNBD inscrito.

---

## 6. Metodología y limitaciones

- **Código:** lectura directa de `server.js`, `database.js` (esquema vía grep), `src/security/*`, `src/middleware/*`, `src/routes/{auth,public,compliance,payments,users,email,sms}.routes.js`, `src/utils/{backup,email-service}.js`, frontend de registro y panel compliance. No se ejecutaron ataques reales contra producción (lab disponible si se pide validación dinámica).
- **Web:** 2 agentes de investigación (competencia: 7 plataformas, 44 tool-uses; marco normativo: verificación de vigencias 2024-2026). Lo no confirmable en fuente primaria quedó marcado **POR CONFIRMAR** en el doc de marco normativo.
- **Limitaciones:** no se auditaron credenciales reales ni configuración del VPS/Nginx de producción (fuera del repo); la validación de brechas C-2/C-6 es por lectura de código — recomiendo reproducir en el laboratorio antes de priorizar el fix.
- **Versionado:** este trabajo es documental; no modifica código ni `package.json` → sin version bump ni tag.
