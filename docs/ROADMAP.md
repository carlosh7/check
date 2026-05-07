# Roadmap — Check Pro

Plan maestro del proyecto. Cualquier agente que llega por primera vez **lee esto primero**.

---

## ⚡ Estado Actual

| Item | Valor |
|------|-------|
| **Version** | v12.44.512 |
| **Ultima feature completada** | Consolidacion de planes: ROADMAP unificado, docs historicos eliminados |
| **Feature en curso** | Ninguna |
| **Proximo feature** | F0-01: Completar Form.js + Dropdown.js + tests frontend |
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
FASE 1: Foundation
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
```

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
La modularizacion del frontend quedo al 80%. Hay que:
- Completar `Form.js` (233 lineas, estado ⚠️ Parcial) — migrar funciones de formulario de app.js
- Completar `Dropdown.js` (275 lineas, estado ⚠️ Parcial) — migrar dropdowns restantes
- Agregar tests unitarios con Jest para los 20 modulos
- Verificar que no haya codigo duplicado entre app.js legacy y los modulos
- Probar que todas las vistas carguen correctamente con los modulos

### Estado actual de la modularizacion
| Modulo | Lineas | Estado |
|--------|--------|--------|
| Toast.js | 130 | ✅ |
| Router.js | 134 | ✅ |
| Modal.js | 122 | ⚠️ Parcial |
| Table.js | 201 | ⚠️ Parcial |
| Sidebar.js | 121 | ⚠️ Parcial |
| Form.js | 233 | ⚠️ Parcial |
| Dropdown.js | 275 | ⚠️ Parcial |
| ViewManager.js | 135 | ⚠️ Parcial |
| MyEvents.js | 168 | ⚠️ Parcial |
| Admin.js | 201 | ⚠️ Parcial |
| EventConfig.js | 139 | ⚠️ Parcial |
| System.js | 202 | ⚠️ Parcial |
| ApiService.js | 134 | ⚠️ Parcial |
| AuthService.js | 158 | ⚠️ Parcial |
| EventService.js | 238 | ⚠️ Parcial |
| GuestService.js | 253 | ⚠️ Parcial |
| State.js | 152 | ⚠️ Parcial |
| Config.js | 62 | ⚠️ Parcial |
| Constants.js | 102 | ⚠️ Parcial |
| Persistence.js | 133 | ⚠️ Parcial |

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
| — | ROADMAP unificado + docs consolidados | ✅ | v12.44.511 | 2026-05-06 |
| F0-01 | Completar Form.js + Dropdown.js + tests | ⏳ Pendiente | — | — |
| F0-02 | Modulo Mailing por evento | ⏳ Pendiente | — | — |
| F1-01 | Dashboard Analytics | ⏳ Pendiente | — | — |
| F1-02 | Pipeline Invitados | ⏳ Pendiente | — | — |
| F1-03 | Clone Events | ⏳ Pendiente | — | — |
| F2-04 | PDF Export | ⏳ Pendiente | — | — |
| F2-05 | Guest Categories | ⏳ Pendiente | — | — |
| F2-06 | Activity Logs | ⏳ Pendiente | — | — |
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
2. **Buscar** el proximo feature pendiente (primer `⏳ Pendiente` en orden de fases)
3. **Leer** el plan de ese feature en este documento
4. **Explicar** plan al usuario y esperar confirmacion
5. **Implementar** el feature
6. **Version bump** (package.json + app-shell.html + index.html)
7. **Documentar** en ROADMAP.md: cambiar estado a ✅ y agregar version/fecha
8. **Commit + push + tag**
9. **Informar** al usuario: "Feature X lista vX.Y.Z, Redeploy en Portainer y prueba"
10. **Repetir** con el siguiente feature

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

Se mantienen los de **referencia**: `ARQUITECTURA_SISTEMA.md`, `ESTRUCTURA_UI_CHECK_PRO.md`, `repos-analysis.md`.

---

## 📚 Documentacion Referenciada

| Archivo | Contenido |
|---------|-----------|
| `AGENTS.md` | Reglas, workflow, comandos rapidos |
| `WORKFLOW.md` | Guia de deploy en Portainer |
| `docs/repos-analysis.md` | Analisis completo de los 29 repos comparados |
| `docs/ARQUITECTURA_SISTEMA.md` | Arquitectura de BD y sistema |
| `docs/ESTRUCTURA_UI_CHECK_PRO.md` | Vistas del frontend |
| `server.js` | Backend principal |
| `src/utils/database-manager.js` | Gestion de BDs por evento |
