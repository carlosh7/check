# Roadmap — Check Pro

Plan maestro del proyecto. Cualquier agente que llega por primera vez **lee esto primero**.

---

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.558 |
| **Ultima feature completada** | F2-06: Activity Logs (timeline en Sistema) |
| **Feature en curso** | Ninguna |
| **Proximo feature** | F1-01: Dashboard Analytics |
| **Postura Seguridad IA** | 🔴 5 areas evaluadas vs CrowdStrike (ver `docs/SECURITY_IA.md`) |
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

## 🗺️ Mapa de Dependencias entre Features

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
  F2-06 Activity Logs ← sin dependencias (ya existe audit.js, hay que expandir)

FASE 3: Monetizacion
  F3-07 Stripe/PayPal ← depende de: categories (boletos por tipo)
  F3-08 Waitlist ← depende de: categories (cupos por categoria)
  F3-09 Export Google Sheets ← sin dependencias

FASE 4: Colaboracion
  F4-10 Rol Organizer ← sin dependencias
  F4-11 Sesiones + Seat maps ← depende de: venues
  F4-12 Venues / espacios ← sin dependencias

BACKLOG
  BL-13 SMS integration
  BL-14 Reconocimiento facial / OTP
  BL-15 Password recovery
  BL-16 Site branding por cliente
  BL-17 Landing invitacion digital
  BL-18 Presupuesto por evento
  BL-19 Speaker management
  BL-20 Propuestas publicas
  BL-21 Mapa interactivo (LeafletJS)
  BL-22 Tests automatizados (Jest)
  BL-23 Migraciones de BD
  BL-24 Musica de fondo en landing
  BL-25 Webhooks para integraciones externas
  BL-26 API REST publica documentada (Swagger)
  BL-27 Carga masiva inteligente (dup detect, field mapping)
  BL-28 Portal asistente PWA (boleto, agenda, networking)
```

---

## 🎯 Matriz de Prioridad Real

Cruza todas las features del proyecto evaluando impacto, esfuerzo y dependencias para determinar el orden de ejecucion optimo. Los Tiers indican la prioridad: **Tier 1 primero, Tier 5 al final**. FASE S corre en paralelo.

| Feature | Impacto | Esfuerzo | Dependencias | Tier |
|---------|---------|----------|-------------|------|
| **F0-02** Modulo Mailing | Alto | XL | Ninguna | **Tier 1** |
| **F1-01** Dashboard Analytics | Alto | M | Ninguna | **Tier 1** |
| **F1-03** Clone Events | Alto | S | Ninguna | **Tier 1** |
| **F2-06** Activity Logs | Alto | S | Ninguna | **Tier 1** |
| **F4-12** Venues / Espacios | Medio | S | Ninguna | **Tier 1** |
| **FS-01** Shadow AI Detection | Alto | M | Ninguna | **Tier S (paralelo)** |
| **FS-02** AI Compliance & Data Governance | Medio | M | Ninguna | **Tier S (paralelo)** |
| **F1-02** Pipeline Estados Invitado | Alto | M | Ninguna | **Tier 2** |
| **F2-04** PDF Export | Alto | M | Pipeline (F1-02) | **Tier 2** |
| **F2-05** Guest Categories | Medio | M | Pipeline (F1-02) | **Tier 2** |
| **FS-03** AI Detection & Response | Alto | XL | FS-01 | **Tier S (paralelo)** |
| **F3-07** Stripe / PayPal | Medio | XL | Categories (F2-05) | **Tier 3** |
| **F3-08** Waitlist | Medio | M | Categories (F2-05) | **Tier 3** |
| **F3-09** Export Google Sheets | Medio | M | Ninguna | **Tier 3** |
| **F4-10** Rol Organizer | Medio | M | Ninguna | **Tier 3** |
| **FS-04** AI Red Teaming | Medio | M | FS-01, FS-03 | **Tier S (paralelo)** |
| **F4-11** Sesiones + Seat Maps | Medio | XL | Venues (F4-12) | **Tier 4** |
| BL-15 Password Recovery | Alto | S | Ninguna | **Backlog Priorizado** |
| BL-22 Tests Automatizados | Alto | L | Ninguna | **Backlog Priorizado** |
| BL-25 Webhooks | Alto | M | Ninguna | **Backlog Priorizado** |
| BL-26 API Publica Swagger | Alto | M | Ninguna | **Backlog Priorizado** |
| BL-27 Carga Masiva Inteligente | Alto | M | Ninguna | **Backlog Priorizado** |
| BL-28 Portal Asistente PWA | Alto | XL | Ninguna | **Backlog Priorizado** |
| BL-17 Landing Invitacion Digital | Medio | M | Ninguna | **Backlog Priorizado** |
| BL-23 Migraciones de BD | Medio | M | Ninguna | **Backlog Priorizado** |
| BL-13 SMS Integration | Medio | M | Ninguna | **Backlog** |
| BL-16 Site Branding | Medio | M | Ninguna | **Backlog** |
| BL-18 Presupuesto por Evento | Medio | M | Ninguna | **Backlog** |
| BL-19 Speaker Management | Medio | M | Ninguna | **Backlog** |
| BL-20 Propuestas Publicas | Bajo | S | Ninguna | **Backlog** |
| BL-21 Mapa Interactivo | Bajo | S | Ninguna | **Backlog** |
| BL-24 Musica de fondo | Bajo | S | Ninguna | **Backlog** |
| BL-14 Reconocimiento facial / OTP | Bajo | XL | Ninguna | **Backlog** |

**Criterios de priorizacion:**
- **Tier 1:** Alta prioridad, sin dependencias, ejecutar primero.
- **Tier 2:** Alta/media prioridad, requieren Pipeline de estados (F1-02).
- **Tier 3:** Media prioridad, requieren Categories o sin dependencias pero menor urgencia.
- **Tier 4:** Media prioridad, requieren Venues (F4-12).
- **Tier S (paralelo):** Seguridad IA — corre en paralelo, no bloquea ni es bloqueado por otras fases.
- **Backlog Priorizado:** Items del backlog con mayor impacto, ordenados por prioridad.
- **Backlog:** Items de menor impacto, ejecutar cuando los Tiers superiores esten completos.

---

## 🚀 Orden de Ejecucion Sugerido

### Tier 1 — Ahora mismo (sin dependencias, alto impacto)
| Orden | Feature | Descripcion | Por que primero |
|-------|---------|-------------|----------------|
| 1 | **F0-02** Modulo Mailing | Sistema completo de email marketing por evento: cuentas SMTP, mailbox, compositor con 12 plantillas, campanas masivas, robot automatico | Es el proximo feature planificado, complejidad XL pero sin dependencias. Desbloquea comunicacion con invitados |
| 2 | **F1-03** Clone Events | Duplicar eventos como plantilla con opciones de que copiar | Esfuerzo S, alta demanda, permite reutilizar configuraciones |
| 3 | **F2-06** Activity Logs | Expandir auditoria existente con timeline visible en panel | Esfuerzo S, ya existe `audit.js`, solo hay que expandir y crear UI |
| 4 | **F1-01** Dashboard Analytics | Panel de KPIs y graficos en dashboard admin con Chart.js | Visibilidad inmediata de metricas del negocio |
| 5 | **F4-12** Venues / Espacios | Registro de espacios fisicos con capacidad y recursos | Desbloquea F4-11 (Sesiones) |

### Tier S (paralelo) — Seguridad IA, corre simultaneo con otros Tiers
| Orden | Feature | Descripcion |
|-------|---------|-------------|
| S1 | **FS-01** Shadow AI Detection | Inventario de sistemas IA, deteccion de Shadow AI, politicas de uso |
| S2 | **FS-02** AI Compliance & Data Governance | Clasificacion de datos, derecho al olvido, portabilidad, auditoria de lecturas |
| S3 | **FS-03** AI Detection & Response | Monitoreo de prompts, deteccion de inyeccion, alertas, DLP |
| S4 | **FS-04** AI Red Teaming | Tests adversariales, dependency scanning, hardening |

### Tier 2 — Despues de Tier 1 (requieren Pipeline)
| Orden | Feature | Dependencia | Descripcion |
|-------|---------|-------------|-------------|
| 1 | **F1-02** Pipeline Estados | Ninguna directa (sienta base para F2-04, F2-05) | Sistema de estados lead → contacted → confirmed → attended con log |
| 2 | **F2-04** PDF Export | Pipeline (F1-02) | Gafetes con QR, reportes, certificados |
| 3 | **F2-05** Guest Categories | Pipeline (F1-02) | Categorias VIP, Regular, Staff con capacidad y campos personalizados |

### Tier 3 — Pronto (categorias o independientes)
| Orden | Feature | Dependencia | Descripcion |
|-------|---------|-------------|-------------|
| 1 | **F3-09** Export Google Sheets | Ninguna | Sincronizar invitados con Google Sheets via OAuth |
| 2 | **F4-10** Rol Organizer | Ninguna | Rol intermedio con permisos limitados a eventos asignados |
| 3 | **F3-07** Stripe / PayPal | Categories (F2-05) | Venta de boletos con planes y precios |
| 4 | **F3-08** Waitlist | Categories (F2-05) | Lista de espera con auto-promocion al cancelar |

### Tier 4 — Despues de Venues
| Orden | Feature | Dependencia | Descripcion |
|-------|---------|-------------|-------------|
| 1 | **F4-11** Sesiones + Seat Maps | Venues (F4-12) | Multiples sesiones por evento con mapa de asientos |

### Backlog Priorizado — Pendientes de planificar
| Orden | Feature | Complejidad | Descripcion |
|-------|---------|-------------|-------------|
| 1 | **BL-15** Password Recovery | S | Recuperacion de contrasena por email |
| 2 | **BL-25** Webhooks | M | Integraciones externas via webhooks |
| 3 | **BL-27** Carga Masiva Inteligente | M | Importacion con deteccion de duplicados |
| 4 | **BL-26** API Publica Swagger | M | Documentacion de API con Swagger |
| 5 | **BL-22** Tests Automatizados | L | Suite de tests con Jest |
| 6 | **BL-17** Landing Invitacion Digital | M | Landing page para invitacion |
| 7 | **BL-23** Migraciones de BD | M | Sistema de migraciones estructuradas |
| 8 | **BL-28** Portal Asistente PWA | XL | App progresiva para asistentes |

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
| BL-15 | **Password recovery** | `Event-Registration-System` (SirOsborn) | S |
| BL-16 | **Site branding por cliente** | `eventuraofficials/event-registration-system` | M |
| BL-17 | **Landing invitacion digital** | `Hans-developer/tarjeta-boda` | M |
| BL-18 | **Presupuesto por evento** | `2300032206/EVENT-MANGEMENT-SYSTEM` | M |
| BL-19 | **Speaker management** | `Neriiiii/ems-event-management-system` | M |
| BL-20 | **Propuestas publicas de eventos** | `Neriiiii/ems-event-management-system` | S |
| BL-21 | **Mapa interactivo (LeafletJS)** | `cabrerafrancisco/gdlwebcamp` | S |
| BL-22 | **Tests automatizados (Jest)** | `Pedrosandoval2/Event-Register-System` | L |
| BL-23 | **Migraciones de BD** | `Neriiiii/ems-event-management-system` | M |
| BL-24 | **Musica de fondo en landing** | `Hans-developer/tarjeta-boda` | S |
| BL-25 | **Webhooks para integraciones externas** | `docs/RECOMENDACIONES.md` | M |
| BL-26 | **API REST publica documentada (Swagger)** | `docs/RECOMENDACIONES.md` | M |
| BL-27 | **Carga masiva inteligente** | `docs/RECOMENDACIONES.md` | M |
| BL-28 | **Portal asistente PWA** | `docs/RECOMENDACIONES.md` | XL |

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
| FS-01 | Shadow AI Detection & Governance | ⏳ Pendiente | — | — |
| FS-02 | AI Compliance & Data Governance | ⏳ Pendiente | — | — |
| FS-03 | AI Detection & Response (AIDR) | ⏳ Pendiente | — | — |
| FS-04 | AI Red Teaming | ⏳ Pendiente | — | — |
| F1-01 | Dashboard Analytics | ⏳ Pendiente | — | — |
| F1-02 | Pipeline Invitados | ⏳ Pendiente | — | — |
| F1-03 | Clone Events | ✅ | v12.44.541 | 2026-05-07 |
| F2-04 | PDF Export | ⏳ Pendiente | — | — |
| F2-05 | Guest Categories | ⏳ Pendiente | — | — |
| F2-06 | Activity Logs | ✅ | v12.44.557 | 2026-05-07 |
| F3-07 | Stripe/PayPal | ⏳ Pendiente | — | — |
| F3-08 | Waitlist | ⏳ Pendiente | — | — |
| F3-09 | Export Google Sheets | ⏳ Pendiente | — | — |
| F4-10 | Rol Organizer | ⏳ Pendiente | — | — |
| F4-11 | Sesiones + Seat Maps | ⏳ Pendiente | — | — |
| F4-12 | Venues | ⏳ Pendiente | — | — |
| BL-13..28 | Backlog | ⏳ Pendiente | — | — |

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

## 📚 Documentacion Referenciada

| Archivo | Contenido |
|---------|-----------|
| `AGENTS.md` | Reglas, workflow, comandos rapidos |
| `WORKFLOW.md` | Guia de deploy en Portainer |
| `docs/repos-analysis.md` | Analisis completo de los 29 repos comparados |
| `docs/ARQUITECTURA_SISTEMA.md` | Arquitectura de BD y sistema |
| `docs/ESTRUCTURA_UI_CHECK_PRO.md` | Vistas del frontend |
| `docs/SECURITY_IA.md` | Postura de seguridad IA, brechas, plan de accion vs CrowdStrike |
| `server.js` | Backend principal |
| `src/utils/database-manager.js` | Gestion de BDs por evento |
