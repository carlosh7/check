# BLINDAJE Y EVIDENCIAS DE AUTORIZACIÓN — Modelo de dos carriles · Check Pro

**Fecha:** 23 de septiembre de 2026 · Complementa: [`00_INFORME_EJECUTIVO.md`](./00_INFORME_EJECUTIVO.md) (hallazgos C-1/C-2) · [`02_MARCO_NORMATIVO.md`](./02_MARCO_NORMATIVO.md)
**Pregunta que responde:** ¿Cómo se blinda Check Pro y qué evidencias de autorización tiene, cuando la mayor parte de los datos **llega importada por los organizadores** y solo una parte se registra en las landings?

> ⚠️ Material técnico-legal de trabajo. No sustituye asesoría de abogado colegiado.

---

## 1. Estado actual verificado (23-sep-2026)

| Vía de entrada de datos | ¿Se captura consentimiento? | ¿Queda evidencia? | Evidencia en código |
|---|---|---|---|
| Landing de registro del evento | 🟡 Checkbox visual ("Acepto la política…", `registro.html:127`) pero **no se valida en servidor** | ❌ **Cero**: nada escribe en `consent_logs`; `POST /api/public-register` ni lee el campo | `public.routes.js:304` |
| Importación de BD del organizador | ❌ No existe | ❌ **Cero**: el import no registra nada (ni siquiera log de auditoría); acción `GUEST_IMPORTED` declarada y nunca usada | `import.routes.js:662` (`/execute`), `audit.js:54` |
| Plus-ones (acompañantes) | ❌ No existe | ❌ Cero: se insertan sin consentimiento ni declaración del registrante | `public.routes.js:404-424` |
| Usuarios de la plataforma (signup) | ❌ No existe | ❌ Cero: no se pide aceptación de T&C ni política | `auth.routes.js:176-204` |

La infraestructura de almacenamiento de evidencias **ya existe** (tabla `consent_logs` con texto, IP, user-agent y fecha — `compliance.routes.js:168-181`) pero está vacía: nadie la alimenta.

**Respuesta directa a la pregunta:** hoy **no tenemos ninguna evidencia de autorización**. Pero el diseño correcto no requiere inventar nada grande: cada vía de entrada usa un mecanismo de blindaje distinto.

---

## 2. El modelo de dos carriles

### Carril A — Datos que entran por la landing: **autorización directa, prueba plena**

Aquí SÍ podemos (y debemos) obtener y conservar la autorización nosotros. La Ley 1581 (arts. 8-9) admite expresamente la autorización electrónica: enunciado específico + aceptación (el checkbox vale), **siempre que conservemos la prueba**. El paquete de evidencia válido es:

> **Quién** (titular) · **Qué aceptó** (texto o versión/hash de la política) · **Cuándo** (timestamp) · **Desde dónde** (IP + user-agent) · **Para qué** (tipo de consentimiento) · **En qué flujo** (evento/registro)

**Implementación (corrige C-1, incremental):**
1. `POST /api/public-register` exige `agreement=true` cuando el evento tenga `reg_require_agreement=1`; sin eso → 400.
2. En el mismo insert, escribir en `consent_logs` (columnas ya existentes):
   - `consent_type='data_treatment'`
   - `consent_text` = texto de la política del evento **+ hash SHA-256** del texto (prueba de versión exacta aceptada)
   - `ip_address` y `user_agent` (ya contemplados en el esquema)
3. Igual para cada **plus-one**: el registrante marca una declaración adicional *"Declaro que cuento con autorización de mis acompañantes para registrar sus datos"*, se guarda como consentimiento del plus-one con tipo `plus_one_declaration`, y se envía email de aviso al acompañante con opt-out.
4. **Signup de la plataforma**: aceptación de T&C + Política de Tratamiento registrada igual (usuario-productor).
5. **Export de consentimientos por evento** (CSV/PDF) desde el panel — el organizador (que es el *Responsable*) lo necesita para SU propia defensa; dárselo es valor de producto.
6. Retención: los consentimientos se conservan **la vida de la base de datos** (no los borra el job de retención — ver hallazgo C-9).

### Carril B — Datos importados por el cliente: **no tendrás NUNCA la autorización del titular — y eso es normal**

Es matemáticamente imposible que Check Pro demuestre la autorización de una lista que el organizador sube en CSV: la relación con el titular la tiene el organizador, que es el **Responsable** del tratamiento. Por eso el blindaje no es probatorio sino **contractual + de debida diligencia**. Es exactamente el modelo de Mailchimp/HubSpot/Eventbrite. Las 4 capas:

1. **Declaración exigida en CADA importación** (no una vez, cada vez): antes de ejecutar `POST /api/import/execute`, el organizador marca: *"Declaro y garantizo que cuento con la autorización previa, expresa e informada de los titulares de estos datos para su tratamiento, y que su origen es lícito."* Se registra con: usuario, timestamp, nombre del archivo, número de registros, IP. (La acción `GUEST_IMPORTED` ya existe en `audit.js` — solo falta usarla y añadir la attestation al flujo.) Esto convierte cada import en un **acto documentado de debida diligencia**.
2. **Garantía contractual** en los T&C de la plataforma + contrato de encargo (art. 18 Ley 1581): el organizador declara y garantiza la licitud y la autorización; **asume la responsabilidad** por reclamos de titulares por datos mal obtenidos; Check Pro puede suspender la cuenta ante abusos (reclamos masivos de opt-out, spam). Este traslado de responsabilidad es el corazón del blindaje económico.
3. **Aviso de la fuente en las comunicaciones (Ley 1335 — obligatorio, no opcional):** todo email de invitación hacia contactos importados debe decir **de dónde salieron sus datos** ("[Organizador] nos compartió tus datos para invitarte a [Evento]"), cómo se usan y **cómo darse de baja**. El unlink de desuscripción ya existe (`/api/public/unsubscribe/:token`, `public.routes.js:284`, y se respeta en envíos — `email.routes.js:908`); falta el bloque "¿por qué recibes esto?" en la plantilla.
4. **Válvulas de escape monitoreadas:** opt-out funcional (✅ ya existe), canal de supresión para cualquier titular que lo pida (complementar con C-7), y métricas de quejas/desuscripciones por organizador → suspensión de cuentas abusivas. El abuso del cliente NO es culpa de la plataforma si hubo controles y se actuó.

**Qué te compra este blindaje (honestamente):**
- ✅ **Defensa de debida diligencia**: ante la SIC o un titular, demuestras que exigiste garantías documentadas en cada import, informaste la fuente y diste salida al titular. Eso distingue a una plataforma seria de quien encubre.
- ✅ **Traslado económico de responsabilidad** al organizador por contrato (indemnidad).
- ❌ **No es inmunidad**: si el organizador miente, el titular puede reclamar y la SIC puede investigar a ambos. Tu posición es la del encargado diligente que actuó bajo instrucciones documentadas — no la del responsable que no pidió nada.

---

## 3. El expediente que presentarías ante una queja (resumen operativo)

| Pregunta de la SIC / titular | Carril A (landing) | Carril B (importación) |
|---|---|---|
| ¿Tenías autorización? | Sí — fila de `consent_logs` con texto+hash, IP, UA, fecha | No la tengo; el Responsable la tiene — declaración de importación N° X firmada por el organizador |
| ¿Cómo la conservaste? | Tabla de consentimientos + política versionada | T&C aceptados en signup + registro por importación |
| ¿Le informaste al titular? | Política visible + checkbox informado | Email de invitación con aviso de fuente + opt-out (Ley 1335) |
| ¿Pudo ejercer derechos? | Export/supresión del invitado (compliance) | Opt-out ✅ + supresión bajo solicitud (C-7) |
| ¿De quién es la culpa si el dato era ilegal? | N/A | Del organizador — garantía y indemnidad contractuales |

---

## 4. Diferenciador de producto: "Kit de Cumplimiento" para organizadores

Los organizadores pequeños NO tienen políticas propias (el benchmark lo confirma: TuTicket y Ticketshows ni siquiera mencionan menores). Check Pro puede incluir con la cuenta:
1. Plantilla de Política de Tratamiento y aviso de privacidad editable por evento (el editor de textos legales ya existe — `app-shell.html:2169-2176`; reemplazar el default de 1 línea, `app.js:16099`, por una plantilla robusta — sin borrar el editor).
2. Export de consentimientos (prueba para el organizador como Responsable).
3. Reporte de desuscripciones por campaña.
Convierte el cumplimiento en argumento de venta, no en costo.

---

## 5. Backlog técnico propuesto (Fase L-1A y L-1B)

> ✅ **IMPLEMENTADO el 2026-09-23 (v12.44.818)** — ver estados por ítem y evidencia en
> `AUDIT_REPORT.md` y `docs/STATUS_HISTORY.md`. Pendiente del operador: L-1B.3 (cláusulas
> con abogado) y activar modo estricto de kiosco en producción si se desea.

| # | Ítem | Dónde | Esf. | Estado |
|---|---|---|---|---|
| L-1A.1 | Validar `agreement` server-side en `public-register` + insert en `consent_logs` (texto+hash+IP+UA) | `public.routes.js:304` | M | ✅ v12.44.818 |
| L-1A.2 | Declaración de autorización de acompañantes + email de aviso al plus-one | `public.routes.js` | S | ✅ v12.44.818 |
| L-1A.3 | Aceptación de T&C/política en `signup` con registro | `auth.routes.js` | S | ✅ v12.44.818 |
| L-1A.4 | Export de consentimientos por evento (panel compliance) | `compliance.routes.js` | S | ✅ v12.44.818 (CSV) |
| L-1B.1 | Modal de declaración obligatoria antes de `POST /import/execute` + log `GUEST_IMPORTED` con archivo/conteo | `import.routes.js:662` | M | ✅ v12.44.818 |
| L-1B.2 | Bloque "¿por qué recibes esto?" (fuente de datos) + opt-out en plantillas de invitación | `email.routes.js` | S | ✅ v12.44.818 (campañas) |
| L-1B.3 | Cláusulas de garantía/indemnidad en T&C de plataforma y contrato de encargo | Documento (con abogado) | M | 🟡 plantilla en `/legal/terminos` — validar con abogado |
| L-1B.4 | Métricas de quejas/opt-out por organizador + flujo de suspensión | Panel admin | S | 🔴 pendiente |

**Regla transversal:** todo incremental (regla #1 del proyecto). No se eliminan flujos existentes; se agregan validaciones y registros.

---

## 6. Limitaciones

- La declaración del organizador es la práctica estándar de la industria, pero su eficacia probatoria frente a la SIC para el carril B debe ser matizada por abogado (depende de cómo se documente el encargo).
- El email de aviso a plus-ones requiere SMTP configurado por evento; si no hay SMTP, registrar igualmente la declaración (la prueba queda en logs).
- Este documento no evalúa jurisdicciones distintas de Colombia (ver §2 LATAM del marco normativo cuando haya expansión real).
