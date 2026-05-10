# Referencia Técnica de la API

## Información General

- **Base URL:** `https://check.app/api`
- **Formato:** JSON
- **Autenticación:** JWT (Bearer token) o `x-user-id` header (legacy)
- **API Keys:** Header `x-api-key` para endpoints públicos `/api/v1/*`

---

## Autenticación

### `POST /api/login`
Iniciar sesión.
```json
{ "username": "admin@check.com", "password": "admin123" }
```
→ `{ token, user: { id, username, role, display_name } }`

### `POST /api/signup`
Registrar nuevo usuario.
```json
{ "username": "...", "password": "...", "display_name": "..." }
```

### `POST /api/request-password-reset`
Solicitar recuperación de contraseña.

### `POST /api/reset-password`
Restablecer contraseña con token.

### `POST /api/2fa/setup`
Configurar 2FA TOTP. → `{ secret, qr_code }`

### `POST /api/2fa/verify`
Verificar código 2FA.

### `POST /api/2fa/disable`
Deshabilitar 2FA.

### `GET /api/2fa/status`
Estado del 2FA.

---

## Eventos

### `GET /api/events`
Listar eventos del usuario.

### `POST /api/events`
Crear evento.
```json
{ "name": "...", "date": "2026-12-31", "location": "..." }
```
→ `{ success: true, eventId: "uuid" }`

### `GET /api/events/:id`
Obtener evento.

### `PUT /api/events/:id`
Actualizar evento.

### `DELETE /api/events/:id`
Eliminar evento.

### `GET /api/events/:id/attendance`
Listar asistentes (con JOIN a categorías).

### `POST /api/events/:id/attendance`
Agregar asistente manualmente.

### `PUT /api/events/:id/attendance/:attendanceId`
Actualizar asistente.

### `DELETE /api/events/:id/attendance/:attendanceId`
Eliminar asistente.

### `POST /api/events/:id/clone`
Clonar evento.

### `POST /api/events/:id/database`
Crear BD independiente para evento.

### `DELETE /api/events/:id/database`
Eliminar BD independiente.

---

## Invitados

### `GET /api/guests/:eventId`
Listar invitados (con paginación y búsqueda).

### `POST /api/guests/checkin/:guestId`
Toggle check-in / uncheck-in.

### `POST /api/guests/otp/generate/:guestId`
Generar código OTP.

### `POST /api/guests/otp/verify`
Verificar OTP (check-in público).

### `PATCH /api/guests/:eventId/guest-status/:guestId`
Cambiar estado pipeline.
```json
{ "status": "confirmed", "notes": "..." }
```

### `PATCH /api/guests/:eventId/guest-category/:guestId`
Cambiar categoría.
```json
{ "category_id": "uuid" }
```

### `PUT /api/guests/:eventId/guests/:guestId/profile`
Actualizar perfil networking.

### `GET /api/guests/:eventId/pipeline`
Resumen del pipeline (conteo por estado).

### `GET /api/guests/:eventId/availability`
Cupos disponibles por categoría.

### `GET /api/guests/export-excel/:eventId`
Exportar a Excel.

### `GET /api/guests/:eventId/badges`
Generar PDF de gafetes.

### `GET /api/guests/:eventId/report`
Reporte PDF del evento.

### `GET /api/guests/:eventId/network`
Directorio networking (público).

### `GET /api/guests/:eventId/achievements/:guestId`
Logros de invitado (público).

### `POST /api/guests/:eventId/presence`
Heartbeat de presencia.

### `GET /api/guests/:eventId/editors`
Editores activos (C6-05).

### `GET /api/guests/by-id/:guestId`
Obtener invitado por ID (público).

### `GET /api/guests/:eventId/guests/:guestId/export`
Exportar datos GDPR.

### `DELETE /api/guests/:eventId/guests/:guestId/erase`
Eliminar datos GDPR.

---

## Estadísticas y BI

### `GET /api/analytics`
Dashboard global (admin).
Query: `?period=30` (días)

### `GET /api/stats/:eventId`
Estadísticas de evento.

### `GET /api/reports/:eventId`
Reporte de evento.

### `GET /api/bi/dashboard`
Dashboard BI completo.

### `GET /api/bi/trends`
Tendencias.
Query: `?period=30&compare=30`

### `GET /api/bi/export/:format`
Exportar BI (csv o json).

### `GET /api/health/system`
Health dashboard del sistema.

### `GET /api/performance/logs`
Logs de rendimiento.

---

## Webhooks

### `GET /api/webhooks`
Listar webhooks.

### `POST /api/webhooks`
Crear webhook.
```json
{ "name": "...", "url": "...", "events": ["guest.created", "guest.checked_in"] }
```

### `PUT /api/webhooks/:id`
Actualizar webhook.

### `DELETE /api/webhooks/:id`
Eliminar webhook.

### `POST /api/webhooks/:id/test`
Probar envío.

### `GET /api/webhooks/:id/logs`
Logs de entrega.

### `GET /api/webhooks/events/available`
Eventos disponibles.

---

## Pagos

### `POST /api/create-checkout-session`
Crear sesión de pago Stripe.

### `POST /api/webhooks/stripe`
Webhook de Stripe (raw body).

### `GET /api/coupons`
Listar cupones.

### `POST /api/coupons`
Crear cupón.

### `POST /api/coupons/validate`
Validar cupón.

### `POST /api/receipt/:transactionId`
Generar recibo PDF.

---

## Email / Mailing

### `GET /api/email/accounts`
Listar cuentas.

### `POST /api/email/accounts`
Crear cuenta SMTP/IMAP.

### `PUT /api/email/accounts/:id`
Actualizar cuenta.

### `DELETE /api/email/accounts/:id`
Eliminar cuenta.

### `POST /api/email/accounts/:id/test-smtp`
Probar conexión SMTP.

### `POST /api/email/accounts/:id/test-imap`
Probar conexión IMAP.

### `POST /api/email/send`
Enviar email individual.

### `POST /api/email/campaigns/:id/send`
Iniciar campaña.

---

## Historial de Cambios (C6-06)

### `GET /api/events/:eventId/changes`
Listar cambios. Query: `?limit=100`

### `POST /api/events/:eventId/changes/:changeId/undo`
Deshacer cambio.

### `POST /api/events/:eventId/changes/:changeId/redo`
Rehacer cambio.

---

## Deploy y Sistema

### `POST /api/deploy/webhook`
Webhook de GitHub para auto-deploy (C6-14). Raw body con firma HMAC.

### `GET /api/deploy/logs`
Logs de deploys.

### `GET /api/deploy/encryption-status`
Estado del cifrado (C6-17).

### `POST /api/deploy/migrate-encryption`
Migrar passwords existentes a cifrado.

### `POST /api/db/maintenance`
Mantenimiento de BD (analyze, vacuum, reindex).

---

## API Pública (v1)

Requiere API key via header `x-api-key`.

### `GET /api/v1/events`
Listar eventos públicos.

### `GET /api/v1/events/:id`
Obtener evento.

### `GET /api/v1/events/:id/guests`
Listar invitados del evento.

---

## Cumplimiento / GDPR

### `GET /api/compliance/classification`
Listar clasificaciones de datos.

### `POST /api/compliance/classification`
Agregar clasificación.

### `GET /api/compliance/access-logs`
Logs de acceso a datos.

---

## Multi-Tenant

### `GET /api/tenants`
Listar tenants (admin).

### `POST /api/tenants`
Crear tenant.

### `PUT /api/tenants/:id`
Actualizar tenant.

---

## Automatizaciones

### `GET /api/automation/rules`
Listar reglas.

### `POST /api/automation/rules`
Crear regla.

### `PUT /api/automation/rules/:id`
Actualizar regla.

### `DELETE /api/automation/rules/:id`
Eliminar regla.

---

## Proyectos / Propuestas Públicas

### `GET /api/proposals/:eventId`
Listar propuestas.

### `POST /api/proposals`
Crear propuesta.

### `POST /api/proposals/:id/vote`
Votar propuesta.

---

## WebSockets (Socket.IO)

Conexión automática al cargar la app. Eventos:

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `join_event` | C → S | Unirse a sala de evento |
| `leave_event` | C → S | Salir de sala |
| `editing_guest` | C → S | Editando invitado |
| `stop_editing` | C → S | Dejar de editar |
| `collab_update` | C → S | Guardar cambio |
| `presence_heartbeat` | C → S | Heartbeat (25s) |
| `update_stats` | S → C | Refrescar KPIs |
| `live_checkin` | S → C | Check-in en vivo |
| `guest_updated` | S → C | Otro usuario editó |
| `presence_update` | S → C | Editores activos |

---

## SDK Oficial

Disponible en `sdk/` como paquete npm local:

```bash
const { CheckClient } = require('./sdk');
const client = new CheckClient({ apiKey: 'ck_...', baseUrl: 'https://check.app' });
const events = await client.getEvents();
```

Incluye tipos TypeScript en `sdk/index.d.ts`.
