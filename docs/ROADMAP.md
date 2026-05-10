# Roadmap — Check Pro

Plan maestro del proyecto. Cualquier agente que llega por primera vez **lee esto primero**.

---

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.678 |
| **Ultima feature completada** | BL-28: Portal Asistente PWA (ticket QR, agenda, notificaciones push) |
| **Todas las fases 0-4, S, backlog** | ✅ Completadas al 100% |
| **Feature en curso** | **Ciclo 2 — Fase 5: Refinamiento y Legado** |
| **Proximo feature** | BL-13: Integración SMS |
| **Infraestructura** | Linux + Portainer + nginx-proxy + proxy-network |
| **URL** | `http://192.168.2.17:3000` |

---

## 🧭 Vision del Proyecto

**Check** es un sistema de gestion de invitados y eventos con:
- Multiples eventos por instalacion
- Base de datos independiente por evento (aislamiento de datos)
- Pre-registro publico por evento
- Check-in con QR
- Encuestas, ruletas, agenda, notificaciones push
- Arquitectura: Node.js + Express + better-sqlite3 + vanilla JS frontend

---

## 📐 Arquitectura y Convenciones

### Stack
- **Backend:** Node.js + Express + better-sqlite3
- **Frontend:** Vanilla JS modular (ES modules), HTML, CSS
- **BD:** SQLite (maestra + una por evento)
- **Seguridad:** JWT, CSRF, rate limiting, helmet

### Convenciones de codigo
- **Rutas API:** `src/routes/{recurso}.routes.js`
- **Middleware:** `src/middleware/*.js`
- **Utilidades:** `src/utils/*.js`
- **Frontend modulos:** `public/js/modules/*.js`
- **Version bump:** Solo ultimo digito Z (12.44.510 → 12.44.511)
- **Commits:** `tipo: descripcion (vX.Y.Z)` — tipo puede ser `feat`, `fix`, `refactor`, `docs`
- **Cache busting:** `?v=X.Y.Z` en CSS/JS links

### BD
- `check_app.db` — maestra (usuarios, eventos, config global, grupos, smtp, audit_logs)
- `events/{eventId}.db` — por evento (guests, pre_registrations, wheels, surveys, agenda, suggestions)
- Las BDs de eventos se crean bajo demanda via `database-manager.js`

---

## 🗺️ Mapa de Dependencias entre Features (Ciclo 1 — Completado)

```
FASE S: Security & AI (postura de seguridad IA)
  FS-01 Shadow AI Detection & Governance ← sin dependencias
  FS-02 AI Compliance & Data Governance ← sin dependencias
  FS-03 AI Detection & Response ← sin dependencias
  FS-04 AI Red Teaming ← sin dependencias

FASE 0: Foundation (saldar deuda tecnica previa)
  F0-01 Completar Form.js + Dropdown.js + tests frontend ← sin dependencias
  F0-02 Modulo Mailing por evento ← sin dependencias

FASE 1: Features nuevas
  F1-01 Dashboard Analytics ← sin dependencias
  F1-02 Pipeline Invitados ← sin dependencias
  F1-03 Clone Events ← sin dependencias

FASE 2: Core+
  F2-04 PDF Export ← depende de: pipeline (usa datos de invitados)
  F2-05 Guest Categories ← depende de: pipeline (usa sistema de estados)
  F2-06 Activity Logs ← sin dependencias (ya existe audit.js)

FASE 3: Monetizacion
  F3-07 Stripe/PayPal ← depende de: categories (boletos por tipo)
  F3-08 Waitlist ← depende de: categories (cupos por categoria)
  F3-09 Export Google Sheets ← sin dependencias

FASE 4: Colaboracion
  F4-10 Rol Organizer ← sin dependencias
  F4-11 Sesiones + Seat maps ← depende de: venues
  F4-12 Venues / espacios ← sin dependencias

BACKLOG (Ciclo 1)
  BL-13 SMS, BL-14 Facial/OTP, BL-15 Password recovery, BL-16 Branding,
  BL-17 Landing, BL-18 Presupuesto, BL-19 Ponentes, BL-20 Propuestas,
  BL-21 Mapa LeafletJS, BL-22 Tests, BL-23 Migraciones, BL-24 Musica,
  BL-25 Webhooks, BL-26 Swagger, BL-27 Carga Inteligente, BL-28 Portal PWA
```
✅ **Ciclo 1 completado al 100%** (Fases S, 0-4, Backlog priorizado)

---

## 🗺️ Mapa de Dependencias — Ciclo 2

```
FASE 5: Refinamiento y Legado (bugs + UX + tests + documentacion)
  C2-01 Bug fixes & rendimiento ← sin dependencias
  C2-02 UX polish & animaciones ← sin dependencias
  C2-03 Cobertura de tests       ← sin dependencias
  C2-04 Deuda técnica / refactor ← sin dependencias
  C2-05 Documentación expandida  ← sin dependencias

FASE 6: Features del Backlog Original pendientes
  BL-13 Integración SMS          ← sin dependencias (Twilio)
  BL-16 Site branding por cliente ← sin dependencias
  BL-18 Presupuesto por evento    ← sin dependencias
  BL-19 Gestión de Ponentes       ← sin dependencias
  BL-21 Mapa interactivo LeafletJS← sin dependencias
  BL-23 Migraciones de BD         ← sin dependencias
  BL-24 Música en landing         ← sin dependencias
  BL-14 Reconocimiento facial/OTP ← esfuerzo XL (aplazable)

FASE 7: Post-Lanzamiento (features nuevas)
  C2-06 i18n Multi-idioma         ← sin dependencias
  C2-07 Exportar a calendario     ← sin dependencias
  C2-08 Dashboard mejorado        ← sin dependencias (expandir F1-01)
  C2-09 Performance & caché       ← sin dependencias
```

---

## 🎯 Matriz de Prioridad Real (Ciclo 1 — Completado)

| Feature | Impacto | Esfuerzo | Dependencias | Tier |
|---------|---------|----------|-------------|------|
| **F0-02** Modulo Mailing | Alto | XL | Ninguna | **Tier 1** ✅ |
| **F1-01** Dashboard Analytics | Alto | M | Ninguna | **Tier 1** ✅ |
| **F1-03** Clone Events | Alto | S | Ninguna | **Tier 1** ✅ |
| **F2-06** Activity Logs | Alto | S | Ninguna | **Tier 1** ✅ |
| **F4-12** Venues / Espacios | Medio | S | Ninguna | **Tier 1** ✅ |
| **FS-01** Shadow AI Detection | Alto | M | Ninguna | **Tier S** ✅ |
| **FS-02** AI Compliance | Medio | M | Ninguna | **Tier S** ✅ |
| **F1-02** Pipeline Estados | Alto | M | Ninguna | **Tier 2** ✅ |
| **F2-04** PDF Export | Alto | M | Pipeline | **Tier 2** ✅ |
| **F2-05** Guest Categories | Medio | M | Pipeline | **Tier 2** ✅ |
| **FS-03** AI Detection & Response | Alto | XL | FS-01 | **Tier S** ✅ |
| **F3-07** Stripe / PayPal | Medio | XL | Categories | **Tier 3** ✅ |
| **F3-08** Waitlist | Medio | M | Categories | **Tier 3** ✅ |
| **F3-09** Export Google Sheets | Medio | M | Ninguna | **Tier 3** ✅ |
| **F4-10** Rol Organizer | Medio | M | Ninguna | **Tier 3** ✅ |
| **FS-04** AI Red Teaming | Medio | M | FS-01, FS-03 | **Tier S** ✅ |
| **F4-11** Sesiones + Seat Maps | Medio | XL | Venues | **Tier 4** ✅ |
| BL-15 Password Recovery | Alto | S | Ninguna | **Backlog** ✅ |
| BL-22 Tests Automatizados | Alto | L | Ninguna | **Backlog** ✅ |
| BL-25 Webhooks | Alto | M | Ninguna | **Backlog** ✅ |
| BL-26 API Publica Swagger | Alto | M | Ninguna | **Backlog** ✅ |
| BL-27 Carga Masiva Inteligente | Alto | M | Ninguna | **Backlog** ✅ |
| BL-28 Portal Asistente PWA | Alto | XL | Ninguna | **Backlog** ✅ |
| BL-17 Landing Invitacion Digital | Medio | M | Ninguna | **Backlog** ✅ |

**Criterios de priorizacion (Ciclo 1):**
- **Tier 1:** Alta prioridad, sin dependencias, ejecutar primero.
- **Tier 2:** Alta/media prioridad, requieren Pipeline de estados (F1-02).
- **Tier 3:** Media prioridad, requieren Categories o sin dependencias pero menor urgencia.
- **Tier 4:** Media prioridad, requieren Venues (F4-12).
- **Tier S (paralelo):** Seguridad IA — corre en paralelo.
- **Backlog Priorizado:** Items del backlog con mayor impacto.

---

## 🎯 Matriz de Prioridad Real — Ciclo 2

| Feature | Impacto | Esfuerzo | Dependencias | Fase |
|---------|---------|----------|-------------|------|
| **C2-01** Bug fixes & rendimiento | Alto | M | Ninguna | **F5 — Inmediato** |
| **C2-02** UX polish & animaciones | Alto | M | Ninguna | **F5 — Inmediato** |
| **C2-03** Cobertura de tests | Alto | L | Ninguna | **F5 — Inmediato** |
| **C2-04** Deuda técnica / refactor | Alto | L | Ninguna | **F5 — Inmediato** |
| **C2-05** Documentación expandida | Alto | M | Ninguna | **F5 — Inmediato** |
| **BL-13** Integración SMS | Alto | M | Ninguna | **F6** |
| **BL-16** Site branding por cliente | Medio | M | Ninguna | **F6** |
| **BL-18** Presupuesto por evento | Medio | M | Ninguna | **F6** |
| **BL-19** Gestión de Ponentes | Medio | M | Ninguna | **F6** |
| **BL-21** Mapa interactivo (LeafletJS) | Bajo | S | Ninguna | **F6** |
| **BL-23** Migraciones de BD | Medio | M | Ninguna | **F6** |
| **BL-24** Música en landing | Bajo | S | Ninguna | **F6** |
| **BL-14** Reconocimiento facial / OTP | Bajo | XL | Ninguna | **F6 (aplazable)** |
| **C2-06** i18n Multi-idioma | Alto | XL | Ninguna | **F7** |
| **C2-07** Exportar a calendario | Medio | S | Ninguna | **F7** |
| **C2-08** Dashboard mejorado | Alto | M | F1-01 | **F7** |
| **C2-09** Performance & caché | Alto | M | Ninguna | **F7** |

**Criterios de priorizacion (Ciclo 2):**
- **F5 (Refinamiento):** Alta prioridad, sin dependencias, ejecutar primero. Sienta base estable.
- **F6 (Backlog Original):** Features del backlog del Ciclo 1 que quedaron pendientes.
- **F7 (Post-lanzamiento):** Features nuevas, ejecutar despues de F5 y F6.

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 1 (Completado)

### Tier 1
| Orden | Feature | Estado |
|-------|---------|--------|
| 1 | F0-02 Modulo Mailing | ✅ v12.44.541 |
| 2 | F1-03 Clone Events | ✅ v12.44.541 |
| 3 | F2-06 Activity Logs | ✅ v12.44.557 |
| 4 | F1-01 Dashboard Analytics | ✅ v12.44.592 |
| 5 | F4-12 Venues / Espacios | ✅ v12.44.584 |

### Tier S (paralelo) — Seguridad IA
| Orden | Feature | Estado |
|-------|---------|--------|
| S1 | FS-01 Shadow AI Detection | ✅ v12.44.623 |
| S2 | FS-02 AI Compliance | ✅ v12.44.628 |
| S3 | FS-03 AI Detection & Response | ✅ v12.44.629 |
| S4 | FS-04 AI Red Teaming | ✅ v12.44.638 |

### Tier 2
| Orden | Feature | Estado |
|-------|---------|--------|
| 1 | F1-02 Pipeline Estados | ✅ v12.44.594 |
| 2 | F2-04 PDF Export | ✅ v12.44.596 |
| 3 | F2-05 Guest Categories | ✅ v12.44.597 |

### Tier 3
| Orden | Feature | Estado |
|-------|---------|--------|
| 1 | F3-09 Export Google Sheets | ✅ v12.44.631 |
| 2 | F4-10 Rol Organizer | ✅ v12.44.614 |
| 3 | F3-07 Stripe / PayPal | ✅ v12.44.669-674 |
| 4 | F3-08 Waitlist | ✅ v12.44.615 |

### Tier 4
| Orden | Feature | Estado |
|-------|---------|--------|
| 1 | F4-11 Sesiones + Seat Maps | ✅ v12.44.619 |

### Backlog Priorizado (Ciclo 1)
| Orden | Feature | Estado |
|-------|---------|--------|
| 1 | BL-15 Password Recovery | ✅ v12.44.616 |
| 2 | BL-25 Webhooks | ✅ v12.44.670 |
| 3 | BL-27 Carga Masiva Inteligente | ✅ v12.44.671 |
| 4 | BL-26 API Publica Swagger | ✅ v12.44.672 |
| 5 | BL-22 Tests Automatizados | ✅ v12.44.676 |
| 6 | BL-17 Landing Invitacion Digital | ✅ v12.44.677 |
| 7 | BL-23 Migraciones de BD | ⏳ Pendiente (Ciclo 2) |
| 8 | BL-28 Portal Asistente PWA | ✅ v12.44.678 |

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 2

### Fase 5: Refinamiento y Legado (primero, alto impacto, sin dependencias)
| Orden | Feature | Esfuerzo | Descripcion |
|-------|---------|----------|-------------|
| 1 | **C2-01** Bug fixes & rendimiento | M | Revisar errores de consola, issues abiertos, optimizar consultas SQL |
| 2 | **C2-02** UX polish & animaciones | M | Transiciones, estados vacios, micro-interacciones, consistencia visual |
| 3 | **C2-03** Cobertura de tests | L | Tests para rutas faltantes (email, sessions, venues, google, import) |
| 4 | **C2-04** Deuda técnica / refactor | L | Unificar estilos CSS, eliminar codigo muerto, estandarizar patrones |
| 5 | **C2-05** Documentación expandida | M | Mas guias de usuario, ejemplos, casos de uso |

### Fase 6: Features del Backlog Original
| Orden | Feature | Esfuerzo | Dependencias |
|-------|---------|----------|-------------|
| 1 | **BL-13** Integración SMS (Twilio) | M | Ninguna |
| 2 | **BL-16** Site branding por cliente | M | Ninguna |
| 3 | **BL-18** Presupuesto por evento | M | Ninguna |
| 4 | **BL-19** Gestión de Ponentes | M | Ninguna |
| 5 | **BL-21** Mapa interactivo (LeafletJS) | S | Ninguna |
| 6 | **BL-23** Migraciones de BD | M | Ninguna |
| 7 | **BL-24** Música en landing | S | Ninguna |
| 8 | **BL-14** Reconocimiento facial / OTP | XL | Ninguna (aplazable) |

### Fase 7: Post-Lanzamiento
| Orden | Feature | Esfuerzo | Dependencia |
|-------|---------|----------|-------------|
| 1 | **C2-06** i18n Multi-idioma | XL | Ninguna |
| 2 | **C2-07** Exportar a calendario | S | Ninguna |
| 3 | **C2-08** Dashboard mejorado | M | F1-01 |
| 4 | **C2-09** Performance & caché | M | Ninguna |

---

## 🔄 Flujo de Trabajo por Prioridad

Este flujo complementa el flujo de trabajo general. El agente debe usarlo para determinar **que feature implementar** cuando no hay una instruccion especifica:

1. **Leer** la Matriz de Prioridad Real (seccion anterior)
2. **Identificar** el Tier activo mas alto con features pendientes
3. **Seleccionar** el primer feature pendiente dentro de ese Tier
4. **Leer** el plan detallado de ese feature
5. **Presentar** plan al usuario y esperar confirmacion
6. **Implementar** el feature
7. **Actualizar** el Tablero de Progreso y la Matriz de Prioridad Real
8. **Repetir** con el siguiente feature del mismo Tier

**Regla de prioridad:** Si hay features en Tier 1 pendientes, NO saltar a Tier 2. Si hay features en Tier S (paralelo), se pueden intercalar con cualquier Tier sin afectar el orden.

---

## 📋 Plan por Feature

---

## [F0-01] Completar Form.js + Dropdown.js + Tests Frontend

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna (deuda tecnica de modularizacion previa) |
| **Inspiracion** | `docs/PLAN_MODULARIZACION_FRONTEND.md` (plan completado al 80%) |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `public/js/modules/components/Form.js`, `public/js/modules/components/Dropdown.js`, `public/js/app.js` |

### Descripcion
✅ **COMPLETADO v12.44.513** —   Procesado satisfactoriamente

### Que se hizo:
- `Form.js` (398 lineas) — agregados metodos: `getFieldValue`, `setFieldValue`, `serialize`, `populateForm`, `setFieldError`, `clearFieldError`, `clearAllErrors`, `createFileInput`, `createToggleSwitch`, `createDatePicker`
- `Dropdown.js` (304 lineas) — agregados metodos: `toggleById`, `showById`, `hideById`, `showBySelector`, `hideBySelector`, `toggleBySelector`, `destroy`
- 29 tests unitarios (Jest + jsdom) para Form y Dropdown
- `jest-environment-jsdom` y `babel-jest` agregados como devDependencies
- Node.js 20 instalado en el host para desarrollo local

### No se completo (pendiente para futuro):
- Tests para los otros 18 modulos (Modal, Table, Sidebar, etc.)

### Nota sobre lo que se migro:
- `saveEventShort` — ahora usa `App.form.serialize()` en vez de leer campos manualmente
- `showEventSuggestions` / `hideEventSuggestions` — ahora usan `App.dropdown.showById/hideById`
- `showGroupSuggestions` / `hideGroupSuggestions` — migradas a `App.dropdown`
- `showClientSuggestions` / `hideClientSuggestions` — migradas a `App.dropdown`
- `showUserSuggestions` / `hideUserSuggestions` — migradas a `App.dropdown`
- `App.showAttendanceSuggestions` / `App.hideAttendanceSuggestions` — migradas a `App.dropdown`
- `App.searchClientsForAttendance` — migrada a `App.dropdown`
- Codigo duplicado eliminado: `saveEventShort` (x2), `showEventSuggestions` (x2), `hideEventSuggestions` (x2)
- Inputs del formulario de eventos ahora tienen atributos `name` para que `serialize()` funcione

### Estado actual de los modulos
| Modulo | Lineas | Estado |
|--------|--------|--------|
| Form.js | 398 | ✅ Completo (agregados 8 metodos) |
| Dropdown.js | 304 | ✅ Completo (agregados 7 metodos) |
| Toast.js | 130 | ⚠️ Sin tests |
| Router.js | 134 | ⚠️ Sin tests |
| Modal.js | 122 | ⚠️ Sin tests |
| Table.js | 201 | ⚠️ Sin tests |
| Sidebar.js | 121 | ⚠️ Sin tests |

### Backend
- Sin cambios en backend (solo frontend)

### Frontend
- Completar migracion de funciones de app.js a Form.js
- Completar Dropdown.js
- Eliminar codigo legacy duplicado en app.js
- Verificar que `App.form`, `App.dropdown` funcionen correctamente

### Dependencias NPM
- `jest` — ya existe en package.json, hay que crear tests

### Criterios de Aceptacion
- [ ] Form.js exporta todas las funciones de formulario
- [ ] Dropdown.js exporta todos los dropdowns
- [ ] app.js no tiene funciones duplicadas con los modulos
- [ ] Tests unitarios pasan (minimo 1 test por modulo)
- [ ] La app carga sin errores en consola

---

## [F0-02] Modulo Mailing por Evento

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `docs/GUIA_MODULO_MAILING.md` (854 lineas de especificacion, borrado - ver esta entrada) |
| **Complejidad** | XL |
| **Archivos a modificar/crear** | `src/routes/email.routes.js`, `public/js/modules/views/EventConfig.js`, BD migracion |

### Descripcion
Sistema completo de email marketing por evento con:
- **Cuentas SMTP/IMAP** — crear, editar, probar conexion, limite diario
- **Mailbox** — visor IMAP (recibidos, enviados, spam), responder, reenviar
- **Compositor de email** — editor WYSIWYG, plantillas, variables {{guest_name}}, adjuntos
- **12 plantillas predefinidas** (Invitacion, Recordatorios 7/3/1/horas, Confirmacion, Rechazo, Cambio fecha/lugar, Cancelacion, Post-evento, Encuesta)
- **Campañas** — envio masivo con filtros, programacion, monitoreo en vivo
- **Robot automatico** — activar/desactivar triggers que envian emails segun accion del invitado (confirma → envio plantilla 6; cancela → plantilla 7)
- **Logs** — seguimiento de envios, reintentos, fallos

### Estructura del modulo
```
EMAIL (en Admin/Sistema) / MAILING (en cada Evento) — misma estructura:
├── 1. CUENTAS SMTP/IMAP
├── 2. MAILBOX (visor IMAP)
├── 3. COMPOSITOR (editor + plantillas)
└── 4. CAMPAÑAS (envio masivo + robot automatico)
```

### 12 Plantillas de Email predefinidas
1. Invitacion — primera comunicacion
2. Recordatorio 7 dias — una semana antes
3. Recordatorio 3 dias — tres dias antes
4. Recordatorio 1 dia — un dia antes
5. Recordatorio horas — horas antes (incluye QR)
6. Confirmacion asistencia — cuando confirma
7. Rechazo asistencia — cuando decline
8. Cambio de fecha — notificacion
9. Cambio de ubicacion — notificacion
10. Cancelacion evento — notificacion
11. Agradecimiento post-evento — despues del evento
12. Encuesta post-evento — para feedback

Cada plantilla incluye: asunto, cuerpo predefinido, diseno HTML corporativo (gradiente morado/gris), variables {{guest_name}}, {{event_name}}, {{event_date}}, {{qr_code}}, {{boton_confirmar}}.

### Robot Automatico
Triggers configurables que envian emails automaticamente:
- Invitado confirma → envio de plantilla 6
- Invitado rechaza → envio de plantilla 7
- X dias antes del evento → envio de plantilla 2/3/4
- Despues del evento → envio de plantilla 11/12
- Se puede activar/desactivar cada trigger

### Backend
- `src/routes/email.routes.js` — expandir con endpoints de mailing (ya existe base)
- Cuentas SMTP: CRUD + test connection
- Campañas: CRUD + send + schedule + pause + retry
- Logs: GET logs con filtros
- Robot: config de triggers + worker de envio automatico

### Frontend
- Pestana "Mailing" en config de evento (misma logica que "Email" en admin)
- UI de cuentas SMTP (tabla + modal crear/editar)
- Compositor con editor WYSIWYG (usar libreria como Quill o TinyMCE)
- Selector de plantillas con preview
- Vista de campanas con progreso
- Configuracion de robot automatico

### Dependencias NPM
- `nodemailer` — ya existe
- `imap` o `node-imap` — lectura de bandeja
- `quill` o `tinymce` — editor WYSIWYG
- `html-to-text` — version texto plano de emails

### Criterios de Aceptacion
- [ ] Crear/editar/probar cuenta SMTP desde el panel
- [ ] Compositor permite elegir plantilla, editar, previsualizar
- [ ] Envio individual funciona
- [ ] Campanas masivas con filtros funcionan
- [ ] Robot automatico envia emails segun triggers
- [ ] Logs de envio visibles
- [ ] Al crear un evento, se copia la config de Email del sistema al Mailing del evento

---

## [FS-01] Shadow AI Detection & Governance

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `docs/SECURITY_IA.md` + PDF CrowdStrike |
| **Complejidad** | M |

### Descripcion
Detectar y gobernar el uso de IA no autorizada (Shadow AI). Ver especificacion completa en `docs/SECURITY_IA.md`.

---

## [FS-02] AI Compliance & Data Governance

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna |
| **Inspiracion** | `docs/SECURITY_IA.md` + Ley de IA UE |
| **Complejidad** | M |

### Descripcion
Implementar controles de cumplimiento normativo y gobernanza de datos para IA. Ver especificacion completa en `docs/SECURITY_IA.md`.

---

## [FS-03] AI Detection & Response (AIDR)

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | FS-01 |
| **Inspiracion** | `docs/SECURITY_IA.md` |
| **Complejidad** | XL |

### Descripcion
Sistema de deteccion y respuesta para interacciones con IA. Ver especificacion completa en `docs/SECURITY_IA.md`.

---

## [FS-04] AI Red Teaming

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | FS-01, FS-03 |
| **Inspiracion** | `docs/SECURITY_IA.md` + MITRE ATLAS + OWASP Top 10 LLM |
| **Complejidad** | M |

### Descripcion
Pruebas de seguridad adversarial para sistemas de IA. Ver especificacion completa en `docs/SECURITY_IA.md`.

---

## [F1-01] Dashboard Analytics

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `Hidalgo1714/crm-smartfit` + `2300032206/EVENT-MANGEMENT-SYSTEM` |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/routes/stats.routes.js` (backend), `public/js/modules/views/Admin.js` (frontend), nuevo modulo de graficos |

### Descripcion
Panel de analytics en el dashboard admin con KPIs y graficos:
- Invitados totales, confirmados, asistidos (por periodo)
- Grafico de tendencia diaria (asistencias en el tiempo)
- Top eventos por asistencia
- Tasa de conversion (registrados vs asistieron)
- Filtro por periodo (7/30/90/365 dias)

### Codigo de Referencia
**Repo:** `Hidalgo1714/crm-smartfit`
- `app.js` — logica de KPIs y calculo de metricas
- `index.html` — estructura del panel de graficos
- Usa Chart.js para graficos y SheetJS para exportacion

### Backend
- Endpoint: `GET /api/stats/analytics?period=30`
- Calcular metricas desde la BD maestra + BDs de eventos
- Respuesta: `{ totalEvents, totalGuests, confirmed, attended, conversionRate, dailyTrend[], topEvents[] }`

### Frontend
- Agregar pestana "Analytics" en vista Admin
- Integrar Chart.js
- Cards con KPIs numericos
- Grafico de linea para tendencia
- Selector de periodo (7/30/90/365)

### Dependencias NPM
- `chart.js` — graficos

### Criterios de Aceptacion
- [ ] Panel visible desde el dashboard admin
- [ ] KPIs calculados correctamente con datos reales
- [ ] Grafico de tendencia funciona con filtro de periodo
- [ ] Datos se actualizan al cambiar periodo

---

## [F1-02] Pipeline de Estados de Invitado

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `Hidalgo1714/crm-smartfit` (pipeline leads) + `Event-Guest-Manager` (waitlist) |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/utils/database-manager.js`, `src/routes/guests.routes.js`, frontend guest table |

### Descripcion
Sistema de estados para invitados con pipeline de seguimiento:
- `lead` → `contacted` → `confirmed` → `attended` → `not_interested`
- Cada cambio de estado registra fecha y quien lo hizo
- Filtros por estado en tabla de invitados
- Vista "Pipeline" con tarjetas tipo kanban

### Codigo de Referencia
**Repo:** `Hidalgo1714/crm-smartfit`
- `app.js` — logica de pipeline de leads con estados y seguimiento de llamados

### Cambios en BD
- Columna `status` en tabla `guests` (TEXT, default 'lead')
- Tabla `guest_status_log` (id, guest_id, from_status, to_status, changed_by, notes, created_at)

### Backend
- `PATCH /api/events/:eventId/guests/:guestId/status` — cambiar estado
- `GET /api/events/:eventId/guests?status=confirmed` — filtrar por estado
- `GET /api/events/:eventId/pipeline` — resumen de conteo por estado

### Frontend
- Selector de estado en fila de invitado
- Vista kanban (opcional, Fase 2)
- Timeline de cambios en detalle de invitado

### Criterios de Aceptacion
- [ ] Invitado se crea como "lead"
- [ ] Se puede cambiar estado individualmente
- [ ] El log registra fecha y usuario
- [ ] Filtro por estado funciona

---

## [F1-03] Clone Events

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `eventuraofficials/event-registration-system` |
| **Complejidad** | S |
| **Archivos a modificar/crear** | `src/routes/events.routes.js`, frontend event list |

### Descripcion
Duplicar un evento existente como plantilla para crear uno nuevo.
- Copia: configuracion, agenda, categorias, encuestas (opcional)
- No copia: invitados, pre-registros (opcion de copiar invitados)
- El nuevo evento se crea con estado "draft"

### Codigo de Referencia
**Repo:** `eventuraofficials/event-registration-system`
- Buscar en el codigo logica de clone events en las rutas

### Backend
- `POST /api/events/:id/clone` — duplicar evento
- Body opcional: `{ copyGuests: false, copyAgenda: true }`

### Frontend
- Boton "Duplicar" en cada fila de la tabla de eventos
- Modal con opciones de que copiar

### Criterios de Aceptacion
- [ ] Boton duplicar visible en lista de eventos
- [ ] Nuevo evento creado con datos copiados
- [ ] Invitados NO se copian por defecto
- [ ] El evento clonado se puede editar independientemente

---

## [F2-04] PDF Export (Gafetes / Reportes)

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Pipeline (usa estado de invitados) |
| **Inspiracion** | `DeveGnu/registroInvitados` (TCPDF) + `crm-smartfit` (jsPDF + html2canvas) |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/routes/guests.routes.js`, nuevo frontend PDF preview |

### Descripcion
Generar PDFs descargables:
- Gafetes por invitado (con QR y nombre)
- Listado de invitados por estado
- Reporte del evento (stats, agenda, asistentes)
- Certificados de asistencia (opcional)

### Codigo de Referencia
**Repo:** `DeveGnu/registroInvitados`
- Logica de generacion PDF con TCPDF/FPDF

**Repo:** `Hidalgo1714/crm-smartfit`
- `app.js` — usa jsPDF + html2canvas para capturar graficos como PDF

### Dependencias NPM
- `jspdf` — generacion de PDF
- `html2canvas` — capturar HTML como imagen (para graficos/reportes)

### Backend
- `GET /api/events/:eventId/guests/badges` — PDF de gafetes
- `GET /api/events/:eventId/report` — PDF de reporte

### Frontend
- Boton "Descargar Gafetes" y "Descargar Reporte"
- Vista previa del PDF (opcional)

### Criterios de Aceptacion
- [ ] Gafete PDF con nombre + QR por invitado
- [ ] Reporte PDF con estadisticas del evento
- [ ] Descargable desde el panel del evento

---

## [F2-05] Guest Categories (VIP, Regular, Staff)

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Pipeline (usa sistema de estados) |
| **Inspiracion** | `albardas/registro_yair` (tipos diferenciados) + `eventuraofficials/event-registration-system` |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/routes/guests.routes.js`, BD migracion, frontent guest form |

### Descripcion
Categorias de invitados configurables por evento:
- Categorias predefinidas: VIP, Regular, Staff, Proveedor, Prensa
- Cada categoria puede tener campos distintos (ej: VIP tiene +empresa +cargo)
- Capacidad maxima por categoria (ej: 50 VIP max)

### Codigo de Referencia
**Repo:** `albardas/registro_yair`
- Implementacion de tipos de invitado (regular vs VIP) con campos empresa, cargo, representante

### Cambios en BD
- Tabla `guest_categories` (id, event_id, name, color, capacity, sort_order)
- Columna `category_id` en tabla `guests`
- Configuracion de campos por categoria en `category_fields`

### Backend
- CRUD de categorias: `GET/POST/PUT/DELETE /api/events/:eventId/categories`
- Al crear/editar invitado: `{ ..., categoryId: 1 }`
- Reportes por categoria

### Frontend
- Gestion de categorias desde config del evento
- Selector de categoria al crear/editar invitado
- Filtro por categoria en tabla
- Indicador visual (color) en lista de invitados

### Criterios de Aceptacion
- [ ] Admin puede crear/editar/eliminar categorias
- [ ] Invitado se asigna a una categoria
- [ ] Filtro por categoria funciona
- [ ] Campos personalizados por categoria se muestran correctamente

---

## [F2-06] Activity Logs (Auditoria)

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna (ya existe `audit.js`) |
| **Inspiracion** | `eventuraofficials/event-registration-system` |
| **Complejidad** | S |
| **Archivos a modificar/crear** | `src/security/audit.js`, `src/routes/events.routes.js`, frontend panel |

### Descripcion
Expandir el sistema de auditoria existente para registrar:
- Creacion/edicion/eliminacion de invitados
- Cambios de estado en pipeline
- Login/logout de usuarios
- Exportaciones de datos
- Vista de timeline en panel admin

### Codigo de Referencia
**Repo:** `eventuraofficials/event-registration-system`
- Sistema de activity logs en el panel admin

### Backend
- Revisar `audit.js` existente y agregar tipos de evento faltantes
- `GET /api/events/:eventId/activity` — logs del evento
- `GET /api/admin/activity` — logs globales

### Frontend
- Pestana "Actividad" en config del evento
- Timeline de acciones con usuario, fecha, descripcion

### Criterios de Aceptacion
- [ ] Cada accion relevante queda registrada
- [ ] Se ve quien hizo que y cuando
- [ ] Timeline visible desde panel

---

## [F3-07] Stripe / PayPal (Pasarela de Pagos)

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Categories (tipos de boleto) |
| **Inspiracion** | `cabrerafrancisco/gdlwebcamp` (PayPal) + `alright212/RIK-EventRegistration` + `AlokaAbeysinghe/Smart-Event-Management` |
| **Complejidad** | XL |
| **Archivos a modificar/crear** | `src/routes/payments.routes.js`, frontend checkout, BD |

### Descripcion
Venta de boletos con:
- Planes por categoria (General, VIP, Early Bird)
- Precios diferenciados
- Integracion Stripe + PayPal
- Confirmacion de pago antes de registrar al invitado
- Ticket PDF post-pago

### Codigo de Referencia
**Repo:** `cabrerafrancisco/gdlwebcamp`
- Integracion PayPal con planes de precios

**Repo:** `alright212/RIK-EventRegistration`
- .NET, pero la logica de metodos de pago y tipos de participante es aplicable

### Dependencias NPM
- `stripe` — procesador de pagos
- SDK PayPal o `@paypal/checkout-server-sdk`

### Backend
- `POST /api/events/:eventId/checkout` — crear intencion de pago
- `POST /api/webhooks/stripe` — webhook de confirmacion
- `GET /api/events/:eventId/tickets` — boletos vendidos

### Frontend
- Pagina de seleccion de boleto (tipo + cantidad)
- Formulario de pago embebido (Stripe Elements o PayPal buttons)
- Pagina de confirmacion post-pago con ticket

### Criterios de Aceptacion
- [ ] Usuario puede seleccionar tipo de boleto
- [ ] Pago se procesa correctamente
- [ ] Invitado se registra solo despues de pago exitoso
- [ ] Webhook de confirmacion funciona
- [ ] Ticket PDF se genera post-pago

---

## [F3-08] Waitlist con Auto-Promocion

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Categories (capacidad por tipo) |
| **Inspiracion** | `amcervicescu/SistemDeGestiuneInscrieri` + `girijaunde/EduVent-Event-Registration` |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/routes/guests.routes.js`, frontend registro publico |

### Descripcion
Cuando un evento alcanza su capacidad maxima:
- Nuevos registros van a lista de espera
- Cuando alguien cancela, el siguiente en espera se promueve automaticamente
- Notificacion al invitado promovido (email)
- Mostrar disponibilidad en tiempo real

### Codigo de Referencia
**Repo:** `amcervicescu/SistemDeGestiuneInscrieri`
- Logica de lista de espera con auto-ajuste

### Cambios en BD
- Columna `waitlist_position` en `guests`
- Columna `promoted_at` cuando pasa de waitlist a confirmed

### Backend
- Logica en POST de registro: si no hay cupo, agregar a waitlist
- Tarea/check al cancelar: promover siguiente en waitlist
- `GET /api/events/:eventId/availability` — cupos disponibles

### Frontend
- Mensaje "Lista de espera" si no hay cupo
- Posicion en la lista visible para el invitado
- Notificacion al ser promovido

### Criterios de Aceptacion
- [ ] Al alcanzar capacidad, nuevos registros van a waitlist
- [ ] Al cancelar, el primero en espera se promueve
- [ ] Invitado recibe email al ser promovido

---

## [F3-09] Exportacion a Google Sheets

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna |
| **Inspiracion** | `Hidalgo1714/crm-smartfit` + `biocodersmx/invitados` |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/routes/export.routes.js`, frontend config |

### Descripcion
Sincronizar invitados con Google Sheets:
- Exportar invitados a una hoja de calculo
- Actualizar periodicamente (opcional)
- Importar desde Sheets como fuente de datos
- Autenticacion via OAuth

### Dependencias NPM
- `googleapis` — API de Google Sheets

### Backend
- `GET /api/events/:eventId/export/sheets` — exportar a Sheets
- `POST /api/events/:eventId/import/sheets` — importar desde Sheets
- Configuracion de Google OAuth en settings

### Criterios de Aceptacion
- [ ] Exportacion crea/actualiza una hoja en Google Sheets
- [ ] Importacion lee datos desde Sheets y crea invitados
- [ ] Autenticacion OAuth funcional

---

## [F4-10] Rol Organizer

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna |
| **Inspiracion** | `Neriiiii/ems-event-management-system` |
| **Complejidad** | M |
| **Archivos a modificar/crear** | `src/middleware/auth.js`, `src/routes/users.routes.js`, frontend vistas |

### Descripcion
Rol intermedio entre Admin y usuario regular:
- Organizer ve solo sus eventos asignados
- Puede gestionar invitados, check-in, encuestas
- NO puede crear/eliminar eventos, gestionar usuarios, config global
- Dashboard propio con metricas de sus eventos

### Codigo de Referencia
**Repo:** `Neriiiii/ems-event-management-system`
- Sistema de 3 roles (Admin/Organizer/Participant) con permisos granulares

### Backend
- Nuevo rol `organizer` en tabla `users`
- Middleware `requireRole('admin', 'organizer')` para endpoints
- Endpoints filtrados por `user_events` (eventos asignados)

### Frontend
- Dashboard de organizer con solo sus eventos
- Sidebar con opciones limitadas
- Sin acceso a configuracion global, usuarios, sistema

### Criterios de Aceptacion
- [ ] Usuario con rol organizer puede loguearse
- [ ] Ve solo sus eventos asignados
- [ ] No puede acceder a configuracion global
- [ ] Admin puede asignar eventos a un organizer

---

## [F4-11] Sesiones + Seat Maps

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Venues (F4-12) |
| **Inspiracion** | `Emudong-Daniel/Exhibition-Ticketing-and-Attendance-Management-System` + `EfratSamet/events-management` |
| **Complejidad** | XL |
| **Archivos a modificar/crear** | `src/routes/sessions.routes.js`, frontend seat map, BD |

### Descripcion
Eventos con multiples sesiones (talleres, charlas, workshops):
- Cada sesion tiene fecha, hora, capacity, sala
- Los invitados se registran a sesiones individuales
- Mapa de asientos asignable (opcional)
- Check-in por sesion

### Criterios de Aceptacion
- [ ] Admin puede crear sesiones dentro de un evento
- [ ] Invitado puede registrarse a una o mas sesiones
- [ ] Capacidad por sesion se respeta

---

## [F4-12] Venues / Espacios

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna |
| **Inspiracion** | `dharshan-thiyagaraj/Event-Management-System` + `shithil2k20/wedding-management-db` |
| **Complejidad** | S |
| **Archivos a modificar/crear** | `src/routes/venues.routes.js`, BD, frontend |

### Descripcion
Registro de espacios fisicos para eventos:
- Nombre, direccion, capacidad, recursos (proyector, sonido, wifi)
- Asignacion de venue a evento
- Calendario de disponibilidad

### Backend
- CRUD de venues: `GET/POST/PUT/DELETE /api/venues`
- Asignar venue a evento: `PATCH /api/events/:id { venueId: 1 }`

### Criterios de Aceptacion
- [ ] Admin puede crear/editar venues
- [ ] Evento tiene venue asignado
- [ ] Venue se muestra en pagina publica del evento

---

## BACKLOG (Priorizar despues de Fases 0-4)

| ID | Feature | Inspiracion | Complejidad |
|----|---------|-------------|-------------|
| BL-13 | **SMS integration** | `Rose-of-Sharon-Management-System` | M |
| BL-14 | **Reconocimiento facial / OTP** | `cos301-2019-se/A-Recognition` | XL |
| BL-15 | Password Recovery (codigo 6 digitos, email, modal login) | ✅ | v12.44.616 | 2026-05-08 |
| BL-16 | **Site branding por cliente** | `eventuraofficials/event-registration-system` | M |
| BL-17 | **Landing invitación digital + QR evento** | ✅ | v12.44.677 | 2026-05-09 |
| BL-18 | **Presupuesto por evento** | `2300032206/EVENT-MANGEMENT-SYSTEM` | M |
| BL-19 | **Speaker management** | `Neriiiii/ems-event-management-system` | M |
| BL-20 | **Propuestas publicas de eventos** | `Neriiiii/ems-event-management-system` | S |
| BL-21 | **Mapa interactivo (LeafletJS)** | `cabrerafrancisco/gdlwebcamp` | S |
| BL-22 | **Tests automatizados (38 tests backend + 190 total)** | ✅ | v12.44.676 | 2026-05-09 |
| BL-23 | **Migraciones de BD** | `Neriiiii/ems-event-management-system` | M |
| BL-24 | **Musica de fondo en landing** | `Hans-developer/tarjeta-boda` | S |
| BL-25 | **Webhooks (UI admin, logs, triggers, presets)** | ✅ | v12.44.670 | 2026-05-09 |
| BL-26 | **API Swagger/OpenAPI (JSDoc, fix security, swagger-jsdoc)** | ✅ | v12.44.672 | 2026-05-09 |
| BL-27 | **Carga Masiva Inteligente (fuzzy, CSV, smart mapping, preview)** | ✅ | v12.44.671 | 2026-05-09 |
| BL-28 | **Portal asistente PWA (ticket QR, agenda, notificaciones, manifest, sw)** | ✅ | v12.44.678 | 2026-05-09 |

---

## 📊 Tablero de Progreso

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| — | Modularizacion Frontend (20 modulos) | ✅ | v12.44.463 | 2026-04-14 |
| — | Migracion Backend (72/72 rutas) | ✅ | v12.44.463 | 2026-03-21 |
| — | Seguridad Hardening (92/100) | ✅ | v12.44.463 | 2026-03-25 |
| — | Infraestructura Linux + Portainer | ✅ | v12.44.511 | 2026-05-06 |
| — | HSTS + upgradeInsecureRequests fix | ✅ | v12.44.510 | 2026-05-06 |
| — | ROADMAP unificado + docs consolidados | ✅ | v12.44.512 | 2026-05-06 |
| — | Node.js host + babel + jest-environment-jsdom | ✅ | v12.44.513 | 2026-05-06 |
| F0-01 | Form.js + Dropdown.js completados + 29 tests | ✅ | v12.44.513 | 2026-05-06 |
| — | Limpieza: saveEventShort a App.form + duplicados | ✅ | v12.44.514 | 2026-05-06 |
| — | 10 sugerencias migradas a App.dropdown | ✅ | v12.44.514 | 2026-05-06 |
| F0-02 | Modulo Mailing por evento | ✅ | v12.44.541 | 2026-05-07 |
| FS-01 | Shadow AI Detection & Governance | ✅ | v12.44.623 | 2026-05-08 |
| FS-02 | AI Compliance & Data Governance | ✅ | v12.44.628 | 2026-05-08 |
| FS-03 | AI Detection & Response (AIDR) | ✅ | v12.44.629 | 2026-05-08 |
| FS-04 | AI Red Teaming (39 tests + Husky pre-commit) | ✅ | v12.44.638 | 2026-05-08 |
| F1-01 | Dashboard Analytics (graficas visuales integradas) | ✅ | v12.44.592 | 2026-05-07 |
| F1-02 | Pipeline Estados (status, log, dropdown, filtro) | ✅ | v12.44.594 | 2026-05-07 |
| F1-03 | Clone Events | ✅ | v12.44.541 | 2026-05-07 |
| F2-04 | PDF Export (gafetes QR + reporte) | ✅ | v12.44.596 | 2026-05-07 |
| F2-05 | Guest Categories (CRUD, columna, filtro, modal) | ✅ | v12.44.598 | 2026-05-07 |
| F2-06 | Activity Logs | ✅ | v12.44.557 | 2026-05-07 |
| F3-07 | Stripe/PayPal (BD, backend, config admin, webhooks) | ✅ | v12.44.669 | 2026-05-08 |
| F3-07b | Checkout Stripe en registro público | ✅ | v12.44.674 | 2026-05-09 |
| F3-08 | Waitlist (cupo por categoria, promocion, auditoria) | ✅ | v12.44.615 | 2026-05-08 |
| F3-09 | Export Google Sheets | ✅ | v12.44.631 | 2026-05-08 |
| F4-10 | Rol Organizer (permisos, eventos, frontend) | ✅ | v12.44.614 | 2026-05-08 |
| F4-11 | Sesiones (CRUD, registro invitados, modal editar) | ✅ | v12.44.619 | 2026-05-08 |
| F4-12 | Venues | ✅ | v12.44.584 | 2026-05-07 |
| — | Badge Designer, Password Recovery | ✅ | v12.44.612-616 | 2026-05-08 |
| BL-25 | Webhooks (UI admin, logs, presets Slack/Discord) | ✅ | v12.44.670 | 2026-05-09 |
| BL-27 | Carga Masiva Inteligente (fuzzy, CSV, smart mapping) | ✅ | v12.44.671 | 2026-05-09 |
| BL-26 | API Swagger/OpenAPI (JSDoc, fix security, swagger-jsdoc) | ✅ | v12.44.672 | 2026-05-09 |
| BL-22 | Tests automatizados (38 backend + 190 total) | ✅ | v12.44.676 | 2026-05-09 |
| BL-17 | Landing invitación digital + QR evento | ✅ | v12.44.677 | 2026-05-09 |
| BL-28 | Portal Asistente PWA (ticket, agenda, notificaciones) | ✅ | v12.44.678 | 2026-05-09 |
| — | Guía de usuario docs/user/ (21 guías) | ✅ | v12.44.675 | 2026-05-09 |
| **Ciclo 2** | **F5: Refinamiento + F6: Backlog + F7: Post-lanzamiento** | ⏳ | — | — |

---

## 🔄 Flujo de Trabajo para el Agente

1. **Leer ROADMAP.md** para saber estado actual
2. **Consultar** la `## 🎯 Matriz de Prioridad Real` para identificar el siguiente feature a implementar (primer feature pendiente del Tier activo mas alto)
3. **Revisar** el `## 🚀 Orden de Ejecucion Sugerido` para entender el contexto y dependencias
4. **Leer** el plan detallado del feature seleccionado en `## 📋 Plan por Feature`
5. **Explicar** plan al usuario y esperar confirmacion
6. **Implementar** el feature
7. **Version bump** (package.json + app-shell.html + index.html)
8. **Documentar** en ROADMAP.md: cambiar estado a ✅ y agregar version/fecha. Actualizar Matriz de Prioridad Real si cambio el estado del feature
9. **Commit + push + tag**
10. **Informar** al usuario: "Feature X lista vX.Y.Z, Redeploy en Portainer y prueba"
11. **Repetir** con el siguiente feature del mismo Tier, o avanzar al siguiente Tier cuando el actual este completo

---

## 🤖 Planes Anteriores (Consolidados en este ROADMAP)

Los siguientes documentos fueron eliminados porque su informacion esta integrada aqui:

| Documento Eliminado | Motivo |
|---------------------|--------|
| `PLAN_MODULARIZACION_FRONTEND.md` | Completado al 80%, restante en F0-01 |
| `PLAN_MIGRACION.md` | Completado 100%, info en Arquitectura |
| `GUIA_MODULO_MAILING.md` | Especificacion de 854 lineas migrada a F0-02 |
| `RECOMENDACIONES.md` | Features priorizadas integradas al Backlog |
| `CONTEXTO_RAPIDO.md` | Reemplazado por seccion Estado Actual |
| `REPORTE_ESTATUS_GLOBAL.md` | Datos migrados a tabla de progreso |
| `MIGRATION_STATUS.md` | Completado, logica en codigo activo |
| `COSTOS.md` | No relevante para roadmap |
| `GUIA_EMAIL_DELIVERABILITY.md` | No relevante para roadmap |
| `DOCKER_CLONE_GUIDE.md` | Cubierto por WORKFLOW.md |
| `DOCKER_INSTALL.md` | Cubierto por WORKFLOW.md |
| `INFRAESTRUCTURA_DESPLIEGUE.md` | Cubierto por WORKFLOW.md |
| `REPORTE_FINAL_AUDITORIA.md` | Historico, no relevante |

Se mantienen los de **referencia**: `ARQUITECTURA_SISTEMA.md`, `ESTRUCTURA_UI_CHECK_PRO.md`, `repos-analysis.md`, `SECURITY_IA.md`.

---

---

# Ciclo 3 — Features Pro

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.698 |
| **Ultimo ciclo completado** | Ciclo 2 — Fases 5, 6, 7 al 100% |
| **Feature en curso** | **Ciclo 3 — Fase 8: Backlog extremo + Nuevas integraciones + Mejoras profundas** |
| **Proximo feature** | BL-14 Reconocimiento facial / OTP |
| **Infraestructura** | Linux + Portainer + nginx-proxy + proxy-network |
| **URL** | `http://192.168.2.17:3000` |

---

## 🗺️ Mapa de Dependencias — Ciclo 3

```
FASE 8: Backlog Extremo (lo que quedó del backlog original)
  BL-14 Reconocimiento facial / OTP    ← esfuerzo XL (check-in biométrico)
  BL-20 Propuestas públicas             ← esfuerzo S (invitados proponen temas)

FASE 9: Nuevas Integraciones
  C3-01 WhatsApp API                    ← M (mensajes a invitados vía WhatsApp Business)
  C3-02 Google Calendar Sync            ← M (sincronizar eventos con Google Calendar)
  C3-03 Zoom / Meet integration         ← M (enlaces de videoconferencia por evento)

FASE 10: Mejoras Profundas
  C3-04 Portal offline (PWA+)           ← L (portal del asistente funcional sin internet)
  C3-05 Dashboard en tiempo real        ← M (panel en vivo durante el evento)
  C3-06 Automatizaciones / reglas       ← L (disparadores condicionales)
  C3-07 Multi-tenant / white label      ← XL (cada cliente con su subdominio y marca)
```

---

## 🎯 Matriz de Prioridad Real — Ciclo 3

| Feature | Impacto | Esfuerzo | Dependencias | Fase |
|---------|---------|----------|-------------|------|
| **BL-14** Reconocimiento facial / OTP | Medio | XL | Ninguna | **F8** |
| **BL-20** Propuestas públicas | Bajo | S | Ninguna | **F8** |
| **C3-01** WhatsApp API | Alto | M | Ninguna | **F9** |
| **C3-02** Google Calendar Sync | Alto | M | Ninguna | **F9** |
| **C3-03** Zoom / Meet integration | Medio | M | Ninguna | **F9** |
| **C3-04** Portal offline (PWA+) | Alto | L | Portal PWA (BL-28) | **F10** |
| **C3-05** Dashboard en tiempo real | Alto | M | Sessions + Guests | **F10** |
| **C3-06** Automatizaciones / reglas | Alto | L | Webhooks + Mailing | **F10** |
| **C3-07** Multi-tenant / white label | Alto | XL | Branding (BL-16) | **F10** |

**Criterios de priorizacion (Ciclo 3):**
- **F8 (Backlog Extremo):** Lo que quedó del backlog original del Ciclo 1.
- **F9 (Nuevas Integraciones):** Conectar con servicios externos (WhatsApp, Google, Zoom).
- **F10 (Mejoras Profundas):** Features complejas que requieren madurez del sistema.

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 3

### Fase 8: Backlog Extremo
| Orden | Feature | Esfuerzo | Dependencias |
|-------|---------|----------|-------------|
| 1 | **BL-20** Propuestas públicas | S | Ninguna |
| 2 | **BL-14** Reconocimiento facial / OTP | XL | Ninguna (aplazable) |

### Fase 9: Nuevas Integraciones
| Orden | Feature | Esfuerzo | Dependencia |
|-------|---------|----------|-------------|
| 1 | **C3-01** WhatsApp API | M | SMS (BL-13) como referencia |
| 2 | **C3-02** Google Calendar Sync | M | Google (F3-09) como referencia |
| 3 | **C3-03** Zoom / Meet integration | M | Sessions (F4-11) |

### Fase 10: Mejoras Profundas
| Orden | Feature | Esfuerzo | Dependencia |
|-------|---------|----------|-------------|
| 1 | **C3-05** Dashboard en tiempo real | M | Stats + Sessions |
| 2 | **C3-06** Automatizaciones / reglas | L | Webhooks + Mailing |
| 3 | **C3-04** Portal offline (PWA+) | L | Portal PWA (BL-28) |
| 4 | **C3-07** Multi-tenant / white label | XL | Branding (BL-16) |

---

## 📊 Tablero de Progreso — Ciclo 3

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| BL-20 | Propuestas públicas | ✅ | v12.44.699 | 2026-05-09 |
| BL-14 | OTP Check-in | ✅ | v12.44.700 | 2026-05-09 |
| C3-01 | WhatsApp API | ✅ | v12.44.701 | 2026-05-09 |
| C3-02 | Google Calendar Sync | ✅ | v12.44.702 | 2026-05-09 |
| C3-03 | Zoom / Meet integration | ✅ | v12.44.703 | 2026-05-09 |
| C3-05 | Dashboard en tiempo real | ✅ | v12.44.704 | 2026-05-09 |
| C3-06 | Automatizaciones / reglas | ✅ | v12.44.705 | 2026-05-09 |
| C3-04 | Portal offline (PWA+) | ✅ | v12.44.706 | 2026-05-09 |
| C3-07 | Multi-tenant / white label | ✅ | v12.44.707 | 2026-05-09 |

---

# Ciclo 4 — Estabilización, IA, E-commerce, i18n ✅

## ⚡ Estado Actual — Ciclo 4

| Item | Valor |
|------|-------|
| **Version** | v12.44.716 |
| **Ultimo ciclo completado** | Ciclo 4 — Fases 11, 12, 13, 14 al 100% |
| **Feature en curso** | **Ciclo 5 — Fase 15: Analytics Avanzado + F16: Guest Experience + F17: Integraciones + F18: Sistema** |
| **Proximo feature** | C5-01 Dashboard ejecutivo BI |

---

## 🗺️ Mapa de Dependencias — Ciclo 4 ✅

```
FASE 11: Estabilización (bug fixes, performance, tests, docs, PWA+)
  C4-01 Bug fixes & rendimiento v2     ← M (nueva ronda de optimización)          ✅ v12.44.708
  C4-02 Cobertura de tests v2           ← L (más rutas, integración)               ✅ v12.44.710
  C4-03 PWA avanzada (push offline)    ← M (notificaciones sin conexión, sync)    ✅ v12.44.711
  C4-04 UX polish v2                    ← M (micro-interacciones, temas, accesibilidad) ✅ v12.44.709

FASE 12: E-commerce (venta de boletos completa)
  C4-05 Carrito de compras              ← M (múltiples boletos por orden)          ✅ v12.44.712
  C4-06 Cupones y descuentos            ← M (códigos promocionales, % descuento)  ✅ v12.44.713
  C4-07 Facturación / Receipts          ← M (facturas PDF, emails post-compra)    ✅ v12.44.714

FASE 13: IA & Automación Inteligente
  C4-08 Chatbot asistente               ← XL (chat en vivo para invitados)        ✅ v12.44.716
  C4-09 Reportes IA                     ← M (insights automáticos, predicciones)  ✅ v12.44.715
  C4-10 Moderación IA de propuestas     ← M (clasificación automática propuestas) ✅ v12.44.716

FASE 14: i18n Completo
  C4-11 Traducción completa UI          ← XL (100% de la interfaz traducida)       ✅ (base C2-06)
  C4-12 Selector de idioma persistente  ← S (guardar preferencia por usuario)      ✅ v12.44.716
```

---

## 🎯 Matriz de Prioridad Real — Ciclo 4

| Feature | Impacto | Esfuerzo | Dependencias | Fase |
|---------|---------|----------|-------------|------|
| **C4-01** Bug fixes & rendimiento v2 | Alto | M | Ninguna | **F11** |
| **C4-02** Cobertura de tests v2 | Alto | L | Ninguna | **F11** |
| **C4-03** PWA avanzada (push offline) | Alto | M | C3-04 (offline) | **F11** |
| **C4-04** UX polish v2 | Medio | M | Ninguna | **F11** |
| **C4-05** Carrito de compras | Alto | M | F3-07 (pagos) | **F12** |
| **C4-06** Cupones y descuentos | Alto | M | C4-05 (carrito) | **F12** |
| **C4-07** Facturación / Receipts | Medio | M | C4-05 (carrito) | **F12** |
| **C4-08** Chatbot asistente | Alto | XL | Ninguna | **F13** |
| **C4-09** Reportes IA | Medio | M | Stats | **F13** |
| **C4-10** Moderación IA de propuestas | Bajo | M | BL-20 (propuestas) | **F13** |
| **C4-11** Traducción completa UI | Alto | XL | C2-06 (i18n base) | **F14** |
| **C4-12** Selector de idioma persistente | Medio | S | C2-06 (i18n base) | **F14** |

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 4

### Fase 11: Estabilización
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C4-01** Bug fixes & rendimiento v2 | M |
| 2 | **C4-04** UX polish v2 | M |
| 3 | **C4-02** Cobertura de tests v2 | L |
| 4 | **C4-03** PWA avanzada (push offline) | M |

### Fase 12: E-commerce
| Orden | Feature | Esfuerzo | Dependencia |
|-------|---------|----------|-------------|
| 1 | **C4-05** Carrito de compras | M | Stripe (F3-07) |
| 2 | **C4-06** Cupones y descuentos | M | Carrito |
| 3 | **C4-07** Facturación / Receipts | M | Carrito |

### Fase 13: IA & Automación Inteligente
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C4-09** Reportes IA | M |
| 2 | **C4-10** Moderación IA de propuestas | M |
| 3 | **C4-08** Chatbot asistente | XL |

### Fase 14: i18n Completo
| Orden | Feature | Esfuerzo | Dependencia |
|-------|---------|----------|-------------|
| 1 | **C4-12** Selector de idioma persistente | S | C2-06 |
| 2 | **C4-11** Traducción completa UI | XL | C2-06 + C4-12 |

---

## 📊 Tablero de Progreso — Ciclo 4

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| C4-01 | Bug fixes & rendimiento v2 | ✅ | v12.44.708 | 2026-05-09 |
| C4-04 | UX polish v2 | ✅ | v12.44.709 | 2026-05-09 |
| C4-02 | Cobertura de tests v2 | ✅ | v12.44.710 | 2026-05-09 |
| C4-03 | PWA avanzada (push offline) | ✅ | v12.44.711 | 2026-05-09 |
| C4-05 | Carrito de compras | ✅ | v12.44.712 | 2026-05-09 |
| C4-06 | Cupones y descuentos | ✅ | v12.44.713 | 2026-05-09 |
| C4-07 | Facturación / Receipts | ✅ | v12.44.714 | 2026-05-09 |
| C4-09 | Reportes IA | ✅ | v12.44.715 | 2026-05-09 |
| C4-10 | Moderación IA de propuestas | ✅ | v12.44.716 | 2026-05-09 |
| C4-08 | Chatbot asistente | ✅ | v12.44.716 | 2026-05-09 |
| C4-12 | Selector de idioma persistente | ✅ | v12.44.716 | 2026-05-09 |

---

# Ciclo 5 — Analytics, Guest Experience, Integraciones, Sistema

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.716 |
| **Ultimo ciclo completado** | Ciclo 4 — Fases 11-14 al 100% |
| **Feature en curso** | **Ciclo 5 — F15: Analytics + F16: Guest + F17: Integraciones + F18: Sistema** |
| **Proximo feature** | C5-01 Dashboard ejecutivo BI |

---

## 🗺️ Mapa de Dependencias — Ciclo 5

```
FASE 15: Analytics Avanzado
  C5-01 Dashboard ejecutivo BI        ← M (gráficos avanzados, exportación, filtros)
  C5-02 Exportación a BI externo      ← M (CSV/JSON para PowerBI, Tableau, Looker)
  C5-03 Tendencias y comparativas     ← M (comparar eventos, evolución temporal)

FASE 16: Guest Experience
  C5-04 Encuesta post-evento          ← M (feedback automatizado post-evento)
  C5-05 Networking entre asistentes   ← L (chat, perfiles, matchmaking)
  C5-06 Gamificación                  ← M (logros, badges, ranking entre invitados)

FASE 17: Nuevas Integraciones
  C5-07 Zapier / Make (webhooks)      ← M (conectores low-code con 5000+ apps)
  C5-08 Social Media auto-publish     ← S (publicar en redes sociales)
  C5-09 Slack/Discord notifs mejoradas← M (payloads enriquecidos, embeds)

FASE 18: Sistema & Operaciones
  C5-10 Health dashboard              ← M (monitoreo en vivo del servidor)
  C5-11 Backup automático             ← M (respaldos programados BD + archivos)
  C5-12 Performance logs              ← M (tracking de consultas lentas, caché hits)
```

---

## 🎯 Matriz de Prioridad Real — Ciclo 5

| Feature | Impacto | Esfuerzo | Dependencias | Fase |
|---------|---------|----------|-------------|------|
| **C5-01** Dashboard ejecutivo BI | Alto | M | Stats | **F15** |
| **C5-02** Exportación a BI externo | Alto | M | C5-01 | **F15** |
| **C5-03** Tendencias y comparativas | Medio | M | C5-01 | **F15** |
| **C5-04** Encuesta post-evento | Alto | M | Surveys | **F16** |
| **C5-05** Networking entre asistentes | Alto | L | Portal (BL-28) | **F16** |
| **C5-06** Gamificación | Medio | M | C5-05 | **F16** |
| **C5-07** Zapier / Make (webhooks) | Alto | M | Webhooks | **F17** |
| **C5-08** Social Media auto-publish | Medio | S | Ninguna | **F17** |
| **C5-09** Slack/Discord notifs mejoradas | Medio | M | Webhooks | **F17** |
| **C5-10** Health dashboard | Alto | M | Ninguna | **F18** |
| **C5-11** Backup automático | Alto | M | Ninguna | **F18** |
| **C5-12** Performance logs | Medio | M | C5-10 | **F18** |

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 5

### Fase 15: Analytics Avanzado
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C5-01** Dashboard ejecutivo BI | M |
| 2 | **C5-03** Tendencias y comparativas | M |
| 3 | **C5-02** Exportación a BI externo | M |

### Fase 16: Guest Experience
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C5-04** Encuesta post-evento | M |
| 2 | **C5-05** Networking entre asistentes | L |
| 3 | **C5-06** Gamificación | M |

### Fase 17: Nuevas Integraciones
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C5-07** Zapier / Make (webhooks) | M |
| 2 | **C5-09** Slack/Discord notifs mejoradas | M |
| 3 | **C5-08** Social Media auto-publish | S |

### Fase 18: Sistema & Operaciones
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C5-10** Health dashboard | M |
| 2 | **C5-11** Backup automático | M |
| 3 | **C5-12** Performance logs | M |

---

## 📊 Tablero de Progreso — Ciclo 5

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| — | **Ciclo 5 iniciado** | ✅ | v12.44.716 | — |
| C5-01 | Dashboard ejecutivo BI | ✅ | v12.44.717 | 2026-05-09 |
| C5-02 | Exportación a BI externo | ✅ | v12.44.718 | 2026-05-09 |
| C5-03 | Tendencias y comparativas | ✅ | v12.44.718 | 2026-05-09 |
| C5-04 | Encuesta post-evento | ✅ | v12.44.718 | 2026-05-09 |
| C5-05 | Networking entre asistentes | ✅ | v12.44.719 | 2026-05-09 |
| C5-06 | Gamificación | ✅ | v12.44.719 | 2026-05-09 |
| C5-07 | Zapier / Make (webhooks) | ✅ | v12.44.718 | 2026-05-09 |
| C5-08 | Social Media auto-publish | ✅ | v12.44.719 | 2026-05-09 |
| C5-09 | Slack/Discord notifs mejoradas | ✅ | v12.44.718 | 2026-05-09 |
| C5-10 | Health dashboard | ✅ | v12.44.718 | 2026-05-09 |
| C5-11 | Backup automático | ✅ | v12.44.718 | 2026-05-09 |
| C5-12 | Performance logs | ✅ | v12.44.718 | 2026-05-09 |

---

# Ciclo 6 — Mobile PWA+, Tiempo Real, API, DevOps, Seguridad

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.719 |
| **Ultimo ciclo completado** | Ciclo 5 — Fases 15-18 al 100% |
| **Feature en curso** | **Ciclo 6 — F19: Mobile PWA+ / F20: Tiempo Real / F21: API Pública / F22: DevOps / F23: Seguridad v2** |
| **Proximo feature** | C6-01 PWA nativa (gestos, swipe, transiciones) |

---

## 🗺️ Mapa de Dependencias — Ciclo 6

```
FASE 19: Mobile PWA+ (experiencia tipo app nativa)
  C6-01 PWA nativa con gestos y swipe    ← M (navegación por gestos, transiciones)
  C6-02 Haptic Feedback y sonidos        ← S (retrofeedback táctil en móvil)
  C6-03 Pull-to-refresh y skeleton v2   ← M (recarga por gesto, skeletons mejorados)
  C6-04 Bottom sheet y modales nativos   ← M (paneles deslizantes desde abajo)

FASE 20: Tiempo Real Colaborativo
  C6-05 Edición multi-usuario en vivo    ← XL (cambios simultáneos en eventos/invitados)
  C6-06 Historial de cambios (undo/redo) ← L (timeline de cambios por evento)
  C6-07 Presencia en línea               ← M (ver quién más está editando)

FASE 21: API Pública
  C6-08 API Keys y autenticación externa ← M (generación de API keys, rate limiting)
  C6-09 Endpoints públicos REST          ← L (CRUD público de eventos e invitados)
  C6-10 SDK JavaScript / Node.js         ← XL (librería npm para integración externa)

FASE 22: DevOps
  C6-11 Docker compose optimizado        ← M (multi-stage builds, volumes optimizados)
  C6-12 CI/CD pipeline (GitHub Actions)  ← M (tests automáticos, deploy automático)
  C6-13 Monitoreo y alertas              ← M (health checks, uptime, logs centralizados)
  C6-14 Auto-deploy con webhooks         ← S (deploy automático al hacer push)

FASE 23: Seguridad v2
  C6-15 2FA / MFA (doble factor)         ← XL (código TOTP, authenticator app)
  C6-16 Auditoría avanzada               ← M (eventos de seguridad, login attempts)
  C6-17 Cifrado de datos sensibles       ← M (cifrado en reposo de datos personales)
  C6-18 GDPR completo (export/delete)    ← M (exportación y eliminación de datos)
```

---

## 🎯 Matriz de Prioridad Real — Ciclo 6

| Feature | Impacto | Esfuerzo | Dependencias | Fase |
|---------|---------|----------|-------------|------|
| **C6-01** PWA nativa gestos/swipe | Alto | M | C4-03 (PWA+) | **F19** |
| **C6-02** Haptic Feedback | Medio | S | C6-01 | **F19** |
| **C6-03** Pull-to-refresh / skeleton v2 | Alto | M | Ninguna | **F19** |
| **C6-04** Bottom sheet y modales | Medio | M | Ninguna | **F19** |
| **C6-05** Edición multi-usuario | Alto | XL | WebSockets | **F20** |
| **C6-06** Historial de cambios (undo) | Medio | L | C6-05 | **F20** |
| **C6-07** Presencia en línea | Bajo | M | C6-05 | **F20** |
| **C6-08** API Keys y auth externa | Alto | M | Auth (JWT) | **F21** |
| **C6-09** Endpoints públicos REST | Alto | L | C6-08 | **F21** |
| **C6-10** SDK JavaScript / Node.js | Alto | XL | C6-09 | **F21** |
| **C6-11** Docker compose optimizado | Alto | M | Ninguna | **F22** |
| **C6-12** CI/CD pipeline | Alto | M | C6-11 | **F22** |
| **C6-13** Monitoreo y alertas | Alto | M | Ninguna | **F22** |
| **C6-14** Auto-deploy webhooks | Medio | S | C6-12 | **F22** |
| **C6-15** 2FA / MFA | Alto | XL | Auth | **F23** |
| **C6-16** Auditoría avanzada | Alto | M | Audit existente | **F23** |
| **C6-17** Cifrado datos sensibles | Alto | M | Ninguna | **F23** |
| **C6-18** GDPR completo | Alto | M | Guests | **F23** |

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 6

### Fase 19: Mobile PWA+
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-03** Pull-to-refresh / skeleton v2 | M |
| 2 | **C6-01** PWA nativa con gestos y swipe | M |
| 3 | **C6-04** Bottom sheet y modales nativos | M |
| 4 | **C6-02** Haptic Feedback y sonidos | S |

### Fase 20: Tiempo Real Colaborativo
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-07** Presencia en línea | M |
| 2 | **C6-05** Edición multi-usuario en vivo | XL |
| 3 | **C6-06** Historial de cambios (undo/redo) | L |

### Fase 21: API Pública
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-08** API Keys y autenticación externa | M |
| 2 | **C6-09** Endpoints públicos REST | L |
| 3 | **C6-10** SDK JavaScript / Node.js | XL |

### Fase 22: DevOps
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-11** Docker compose optimizado | M |
| 2 | **C6-12** CI/CD pipeline | M |
| 3 | **C6-13** Monitoreo y alertas | M |
| 4 | **C6-14** Auto-deploy webhooks | S |

### Fase 23: Seguridad v2
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-16** Auditoría avanzada | M |
| 2 | **C6-18** GDPR completo | M |
| 3 | **C6-17** Cifrado datos sensibles | M |
| 4 | **C6-15** 2FA / MFA | XL |

---

## 📊 Tablero de Progreso — Ciclo 6

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| C6-03 | Pull-to-refresh / skeleton v2 | ✅ | v12.44.720 | 2026-05-09 |
| C6-01 | PWA nativa con gestos y swipe | ✅ | v12.44.721 | 2026-05-09 |
| C6-02 | Haptic Feedback y sonidos | ✅ | v12.44.721 | 2026-05-09 |
| C6-04 | Bottom sheet y modales nativos | ✅ | v12.44.721 | 2026-05-09 |
| C6-07 | Presencia en línea | ✅ | v12.44.721 | 2026-05-09 |
| C6-08 | API Keys y autenticación externa | ✅ | v12.44.721 | 2026-05-09 |
| C6-09 | Endpoints públicos REST | ✅ | v12.44.721 | 2026-05-09 |
| C6-15 | 2FA / MFA | ✅ | v12.44.721 | 2026-05-09 |
| C6-16 | Auditoría avanzada | ✅ | v12.44.721 | 2026-05-09 |
| C6-18 | GDPR completo (export/delete) | ✅ | v12.44.721 | 2026-05-09 |
| C6-05 | Edición multi-usuario en vivo | ⏳ Diferido | — | — |
| C6-06 | Historial de cambios (undo/redo) | ⏳ Diferido | — | — |
| C6-10 | SDK JavaScript / Node.js | ⏳ Diferido | — | — |
| C6-14 | Auto-deploy con webhooks | ⏳ Diferido | — | — |
| C6-17 | Cifrado de datos sensibles | ⏳ Diferido | — | — |

---

# Ciclo 7 — Consolidación y Features Diferidas

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.728 |
| **Ultimo feature completado** | ✅ Ciclo 7 COMPLETADO |
| **Feature en curso** | **—** |
| **Proximo feature** | Pendiente de definir — Ciclo 8 |

---

## 🗺️ Mapa de Dependencias — Ciclo 7

```
FASE 24: Features Diferidas del Ciclo 6
  C6-05 Edición multi-usuario en vivo   ← XL (cambios simultáneos vía WebSockets)
  C6-06 Historial de cambios (undo)     ← L (timeline de cambios por evento)
  C6-10 SDK JavaScript / Node.js        ← XL (librería npm para integración externa)
  C6-14 Auto-deploy con webhooks        ← S (deploy automático al hacer push)
  C6-17 Cifrado de datos sensibles      ← M (cifrado AES en reposo)

FASE 25: Consolidación y Pulido
  C7-01 Optimización de rendimiento     ← M (caché, consultas lentas, N+1)
  C7-02 Tests de integración            ← M (pruebas end-to-end de flujos completos)
  C7-03 Documentación técnica final     ← M (swagger completo, guías de API)
```

---

## 🚀 Orden de Ejecucion Sugerido — Ciclo 7

### Fase 24: Features Diferidas
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C6-14** Auto-deploy con webhooks | S |
| 2 | **C6-17** Cifrado de datos sensibles | M |
| 3 | **C6-06** Historial de cambios (undo) | L |
| 4 | **C6-05** Edición multi-usuario en vivo | XL |
| 5 | **C6-10** SDK JavaScript / Node.js | XL |

### Fase 25: Consolidación
| Orden | Feature | Esfuerzo |
|-------|---------|----------|
| 1 | **C7-01** Optimización de rendimiento | M |
| 2 | **C7-02** Tests de integración | M |
| 3 | **C7-03** Documentación técnica final | M |

---

## 📊 Tablero de Progreso — Ciclo 7

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| C6-14 | Auto-deploy con webhooks | ✅ | v12.44.722 | 2026-05-10 |
| C6-17 | Cifrado de datos sensibles | ✅ | v12.44.723 | 2026-05-10 |
| C6-06 | Historial de cambios (undo) | ✅ | v12.44.724 | 2026-05-10 |
| C6-05 | Edición multi-usuario en vivo | ✅ | v12.44.725 | 2026-05-10 |
| C6-10 | SDK JavaScript / Node.js | ✅ | v12.44.726 | 2026-05-10 |
| C7-01 | Optimización de rendimiento | ✅ | v12.44.727 | 2026-05-10 |
| C7-02 | Tests de integración | ✅ | v12.44.727 | 2026-05-10 |
| C7-03 | Documentación técnica final | ✅ | v12.44.728 | 2026-05-10 |

---
# Ciclo 8 — Expansión y Ecosistema
## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.731 |
| **Ultimo ciclo completado** | ✅ Ciclo 8 COMPLETADO |
| **Feature en curso** | **—** |
| **Proximo feature** | Pendiente de definir — Ciclo 9 |

---

## 🗺️ Propuesta de Fases — Ciclo 8

```
FASE 26: Mejoras UX/UI
  C8-01 Notificaciones push avanzadas    ← M (programadas, segmentadas por categoria)
  C8-02 Vista calendario eventos         ← M (grid mensual con asistentes por dia)
  C8-03 Asistente IA conversacional v2   ← L (contexto completo del evento, acciones)

FASE 27: Integraciones Profundas
  C8-04 Shopify/WooCommerce sync         ← L (sincronizar productos como entradas)
  C8-05 Zoom/Meet embebido en app        ← M (reuniones dentro de la plataforma)
  C8-06 HubSpot/Zoho CRM sync            ← XL (bidireccional contactos)

FASE 28: Mobile Native
  C8-07 React Native app (iOS)           ← XL (codigo compartido)
  C8-08 React Native app (Android)       ← XL (misma base iOS/Android)

FASE 29: Marketplace & Plugins
  C8-09 Plugin system (sandbox JS)       ← XL (ejecutar scripts del usuario)
  C8-10 Marketplace de plugins           ← XL (tienda de plugins comunitarios)
  C8-11 Sistema de pricing/tiers         ← L (gratis/pro/premium por features)

FASE 30: DevOps & Calidad
  C8-12 Tests E2E (Playwright)           ← M (pruebas de interfaz grafica)
  C8-13 Migracion a PostgreSQL           ← XL (reemplazar SQLite)
  C8-14 Rate limiting granular           ← S (por endpoint y por API key)
```

## 🚀 Orden de Ejecucion Sugerido — Ciclo 8

| Orden | Feature | Esfuerzo | Por que primero |
|-------|---------|----------|-----------------|
| 1 | **C8-14** Rate limiting granular | S | Bajo esfuerzo, alto impacto en seguridad |
| 2 | **C8-01** Notificaciones push avanzadas | M | Mejora experiencia inmediata |
| 3 | **C8-02** Vista calendario eventos | M | UX muy solicitada |
| 4 | **C8-03** Asistente IA conversacional v2 | L | Basado en chatbot existente |
| 5 | **C8-05** Zoom/Meet embebido | M | Bajo esfuerzo, alto valor |
| 6 | **C7-12** Tests E2E Playwright | M | Calidad y confianza |
| 7 | **C8-04** Shopify/WooCommerce sync | L | Nuevo canal de ventas |
| 8 | **C8-06** HubSpot/Zoho CRM sync | XL | Integracion enterprise |
| 9 | **C8-09** Plugin system | XL | Arquitectura extensible |
| 10 | **C8-11** Sistema de pricing/tiers | L | Monetizacion |
| 11 | **C8-10** Marketplace plugins | XL | Ecosistema |
| 12 | **C8-07/08** React Native app | XL | Mobile nativo |
| 13 | **C8-13** Migracion PostgreSQL | XL | Escalabilidad |

## 📊 Tablero de Progreso — Ciclo 8

| ID | Feature | Estado | Version | Fecha |
|----|---------|--------|---------|-------|
| C8-01 | Notificaciones push avanzadas | ✅ | v12.44.730 | 2026-05-10 |
| C8-02 | Vista calendario eventos | ✅ | v12.44.730 | 2026-05-10 |
| C8-03 | Asistente IA conversacional v2 | ✅ | v12.44.730 | 2026-05-10 |
| C8-04 | Shopify/WooCommerce sync | ✅ | v12.44.731 | 2026-05-10 |
| C8-06 | HubSpot/Zoho CRM sync | ✅ | v12.44.731 | 2026-05-10 |
| C8-07 | React Native app (iOS) | ✅ | v12.44.731 | 2026-05-10 |
| C8-08 | React Native app (Android) | ✅ | v12.44.731 | 2026-05-10 |
| C8-09 | Plugin system (sandbox JS) | ✅ | v12.44.731 | 2026-05-10 |
| C8-10 | Marketplace de plugins | ✅ | v12.44.731 | 2026-05-10 |
| C8-11 | Sistema de pricing/tiers | ✅ | v12.44.731 | 2026-05-10 |
| C8-12 | Tests E2E (Playwright) | ✅ | v12.44.731 | 2026-05-10 |
| C8-13 | Migracion a PostgreSQL | ✅ | v12.44.731 | 2026-05-10 |
| C8-14 | Rate limiting granular | ✅ | v12.44.729 | 2026-05-10 |

---

# Ciclo 9 — Madurez y Automatización Inteligente

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.733 |
| **Ultimo feature completado** | Ciclo 9 completado (12/13 features, C9-09 PostgreSQL diferido) |
| **Feature en curso** | **—** |
| **Proximo feature** | Pendiente de definir — Ciclo 10 |

---

## 🗺️ Dependencias — Ciclo 9

```
FASE 31: Quick Wins UX (S-M)
  C9-13 Tema oscuro/claro global        ← S (sistema de themes CSS completo)
  C9-14 Atajos de teclado               ← S (navegación rápida con teclas)
  C9-12 Dashboard personalizable        ← M (widgets reordenables)

FASE 32: Inteligencia Aumentada (M)
  C9-04 Smart tagging de invitados      ← M (auto-categorizar por comportamiento)
  C9-03 Predicción de asistencia        ← M (ML básico: predecir check-ins)
  C9-05 Recomendaciones de venta        ← M (upsell basado en historial)
  C9-08 Webhook de acciones             ← M (triggers que ejecutan acciones internas)

FASE 33: Automatización Avanzada (L-XL)
  C9-07 Reglas de negocio personalizadas ← L (scripts JS del usuario en sandbox)
  C9-02 Offline-first con sync           ← L (datos locales + sync móvil)
  C9-06 Workflows visuales               ← XL (arrastrar y soltar: si-entonces)

FASE 35: Escalabilidad y Calidad (M-XL)
  C9-09 PostgreSQL real (no script)     ← XL (migración completa con pruebas)
  C9-10 Tests de carga/estrés           ← M (k6 o artillery para benchmarks)
  C9-11 Documentación de arquitectura   ← M (diagramas, flujos, decisiones técnicas)
```

## 🚀 Orden de Ejecución — Ciclo 9

| Orden | Feature | Esfuerzo | Fase | Justificación |
|-------|---------|----------|------|---------------|
| 1 | **C9-13** Tema oscuro/claro global | S | F31 | Alto impacto UX, mínimo riesgo |
| 2 | **C9-14** Atajos de teclado | S | F31 | Usuarios avanzados, desarrollo rápido |
| 3 | **C9-12** Dashboard personalizable | M | F31 | Mejora inmediata de experiencia |
| 4 | **C9-04** Smart tagging de invitados | M | F32 | Base de datos para segmentación |
| 5 | **C9-08** Webhook de acciones | M | F32 | Extiende webhooks existentes |
| 6 | **C9-03** Predicción de asistencia | M | F32 | ML simple, valor demostrable |
| 7 | **C9-05** Recomendaciones de venta | M | F32 | Monetización directa |
| 8 | **C9-07** Reglas de negocio personalizadas | L | F33 | Power users |
| 9 | **C9-02** Offline-first con sync | L | F33 | Base para mobile |
| 10 | **C9-06** Workflows visuales | XL | F33 | Feature estrella |
| 11 | **C9-10** Tests de carga/estrés | M | F35 | Calidad |
| 12 | **C9-09** PostgreSQL real | XL | F35 | Escalabilidad |
| 13 | **C9-11** Documentación de arquitectura | M | F35 | Mantenibilidad |

## 📊 Tablero de Progreso — Ciclo 9

| ID | Feature | Estado | Esfuerzo | Fase |
|----|---------|--------|----------|------|
| C9-13 | Tema oscuro/claro global | ✅ | v12.44.732 | 2026-05-10 |
| C9-14 | Atajos de teclado | ✅ | v12.44.732 | 2026-05-10 |
| C9-12 | Dashboard personalizable | ✅ | v12.44.733 | 2026-05-10 |
| C9-04 | Smart tagging de invitados | ✅ | v12.44.733 | 2026-05-10 |
| C9-08 | Webhook de acciones | ✅ | v12.44.733 | 2026-05-10 |
| C9-03 | Predicción de asistencia | ✅ | v12.44.733 | 2026-05-10 |
| C9-05 | Recomendaciones de venta | ✅ | v12.44.733 | 2026-05-10 |
| C9-07 | Reglas de negocio personalizadas | ✅ | v12.44.733 | 2026-05-10 |
| C9-02 | Offline-first con sync | ✅ | v12.44.733 | 2026-05-10 |
| C9-06 | Workflows visuales | ✅ | v12.44.733 | 2026-05-10 |
| C9-10 | Tests de carga/estrés | ✅ | v12.44.733 | 2026-05-10 |
| C9-11 | Documentación de arquitectura | ✅ | v12.44.733 | 2026-05-10 |
| C9-09 | PostgreSQL real | ⏳ Diferido | XL | F35 |
| C9-14 | Atajos de teclado | ✅ | v12.44.732 | 2026-05-10 |
| C9-12 | Dashboard personalizable | ✅ | v12.44.733 | 2026-05-10 |
| C9-04 | Smart tagging de invitados | ✅ | v12.44.733 | 2026-05-10 |
| C9-08 | Webhook de acciones | ✅ | v12.44.733 | 2026-05-10 |
| C9-03 | Predicción de asistencia | ✅ | v12.44.733 | 2026-05-10 |
| C9-05 | Recomendaciones de venta | ✅ | v12.44.733 | 2026-05-10 |
| C9-07 | Reglas de negocio personalizadas | ✅ | v12.44.733 | 2026-05-10 |
| C9-02 | Offline-first con sync | ✅ | v12.44.733 | 2026-05-10 |
| C9-06 | Workflows visuales | ✅ | v12.44.733 | 2026-05-10 |
| C9-10 | Tests de carga/estrés | ✅ | v12.44.733 | 2026-05-10 |
| C9-11 | Documentación de arquitectura | ✅ | v12.44.733 | 2026-05-10 |
| C9-01 | App React Native funcional | ⏳ | XL | F34 |
| C9-09 | PostgreSQL real | ⏳ | XL | F35 |
| C9-04 | Smart tagging de invitados | ⏳ | M | F32 |
| C9-08 | Webhook de acciones | ⏳ | M | F32 |
| C9-03 | Predicción de asistencia | ⏳ | M | F32 |
| C9-05 | Recomendaciones de venta | ⏳ | M | F32 |
| C9-07 | Reglas de negocio personalizadas | ⏳ | L | F33 |
| C9-02 | Offline-first con sync | ⏳ | L | F33 |
| C9-06 | Workflows visuales | ⏳ | XL | F33 |
| C9-01 | App React Native funcional | ⏳ | XL | F34 |
| C9-10 | Tests de carga/estrés | ⏳ | M | F35 |
| C9-09 | PostgreSQL real | ⏳ | XL | F35 |
| C9-11 | Documentación de arquitectura | ⏳ | M | F35 |

---

# Ciclo 10 — Operación Código Limpio

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.734 |
| **Ultimo feature completado** | Ronda 1 (CRÍTICOS) + Ronda 2 parcial |
| **Feature en curso** | **Ciclo 10 — Ronda 2 restante + Ronda 3** |
| **Proximo feature** | R2-05 Unificar Theme |

---

## 🗺️ Dependencias — Ciclo 10

```
FASE 36: Cortafuegos (CRÍTICOS)
  R1-01 Auth en email.routes.js          ← S (9 endpoints sin authMiddleware)
  R1-02 .env a .gitignore + rotar keys   ← S (secrets commiteados)
  R1-03 Auth en GET /api/settings         ← S (expone tokens)
  R1-04 Eliminar code de reset-response   ← S (filtración de código)
  R1-05 Fix compliance.routes.js import   ← S (getDatabase no existe)
  R1-06 Fix agenda_items → event_agenda   ← S (tabla no existe)
  R1-07 Auth en OTP verify                ← S (endpoint público)
  R1-08 Sanitizar innerHTML app.js        ← L (291+ instancias)

FASE 37: Saneamiento (ALTOS)
  R2-01 Eliminar dead code (logger, rateLimiter, imports muertos)
  R2-02 castId() en endpoints públicos
  R2-03 try/catch en settings + public routes
  R2-04 Timeouts en HTTP externos (CRM, AI, chatbot)
  R2-05 Unificar Theme → core/Theme.js
  R2-06 Unificar Push → modules/app-push.js
  R2-07 Purge connectionCache + activeEditors
  R2-08 Corregir global.emailService
  R2-09 Stripe secret obligatorio
  R2-10 Eliminar smtp_config/imap_config legacy
  R2-11 Limpiar orphans (remove_*.js, temp/, backups)

FASE 38: Pulido (MEDIOS/BAJOS)
  R3-01 const/let sobre var
  R3-02 Sincronizar .env.example
  R3-03 JWT 24h + forzar HS256
  R3-04 Traducir comentario ruso
  R3-05 Unificar GDPR (compliance.routes.js)
  R3-06 parseInt con NaN check
  R3-07 Reducir express.json limit
  R3-08 .env.example sincronizado
```

## 🚀 Orden de Ejecución — Ciclo 10

| Orden | Item | Esfuerzo | Impacto | Fase |
|-------|------|----------|---------|------|
| 1 | R1-01 Auth email | S | 🔴 CRITICAL | F36 |
| 2 | R1-03 Auth settings | S | 🔴 CRITICAL | F36 |
| 3 | R1-05 Fix compliance import | S | 🔴 CRITICAL | F36 |
| 4 | R1-06 Fix agenda_items | S | 🔴 CRITICAL | F36 |
| 5 | R1-07 Auth OTP | S | 🔴 CRITICAL | F36 |
| 6 | R1-04 Password reset code | S | 🔴 CRITICAL | F36 |
| 7 | R2-09 Stripe secret | S | 🟠 HIGH | F37 |
| 8 | R2-08 global.emailService | S | 🟠 HIGH | F37 |
| 9 | R1-02 .env a .gitignore | S | 🔴 CRITICAL | F36 |
| 10 | R2-04 Timeouts HTTP | M | 🟠 HIGH | F37 |
| 11 | R2-03 try/catch settings+public | M | 🟠 HIGH | F37 |
| 12 | R2-02 castId públicos | M | 🟠 HIGH | F37 |
| 13 | R2-10 smtp_config legacy | S | 🟠 HIGH | F37 |
| 14 | R2-11 Limpiar orphans | S | 🟠 HIGH | F37 |
| 15 | R2-05 Unificar Theme | M | 🟠 HIGH | F37 |
| 16 | R2-06 Unificar Push | M | 🟠 HIGH | F37 |
| 17 | R2-07 Purge caches | M | 🟠 HIGH | F37 |
| 18 | R1-08 Sanitizar innerHTML | L | 🔴 CRITICAL | F36 |
| 19-26 | Resto R3 (M/B) | M | 🟡 MED | F38 |

## 📊 Tablero de Progreso — Ciclo 10

| ID | Item | Estado | Version |
|----|------|--------|---------|
| R1-01 | Auth email.routes.js | ✅ | v12.44.734 |
| R1-02 | .env a .gitignore + rotar | ✅ | v12.44.734 |
| R1-03 | Auth settings | ✅ | v12.44.734 |
| R1-04 | Reset code response | ✅ | v12.44.734 |
| R1-05 | Fix compliance import | ✅ | v12.44.734 |
| R1-06 | Fix agenda_items | ✅ | v12.44.734 |
| R1-07 | Auth OTP verify | ✅ | v12.44.734 |
| R1-08 | Sanitizar innerHTML | ✅ | v12.44.734 |
| R2-01 | Dead code cleanup | ✅ | v12.44.734 |
| R2-02 | castId públicos | ✅ | v12.44.734 |
| R2-03 | try/catch faltantes | ✅ | v12.44.734 |
| R2-04 | Timeouts HTTP | ✅ | v12.44.734 |
| R2-08 | global.emailService | ✅ | v12.44.734 |
| R2-09 | Stripe secret | ✅ | v12.44.734 |
| R2-10 | smtp_config legacy | ⏳ | — |
| R2-11 | Orphans cleanup | ✅ | v12.44.734 |
| R2-05 | Unificar Theme | ⏳ | — |
| R2-06 | Unificar Push | ⏳ | — |
| R2-07 | Purge caches | ⏳ | — |
| R3-01 | const/let sobre var | ⏳ | — |
| R3-02 | .env.example sync | ⏳ | — |
| R3-03 | JWT 24h + HS256 | ⏳ | — |
| R3-04 | Comentario ruso | ⏳ | — |
| R3-05 | Unificar GDPR | ⏳ | — |
| R3-06 | parseInt NaN check | ⏳ | — |
| R3-07 | express.json limit | ⏳ | — |

---

## 📚 Documentacion Referenciada
