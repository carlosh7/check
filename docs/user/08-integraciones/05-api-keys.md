# API Keys (integraciones externas)

**Sistema → Integraciones → API Keys → ➕ Generar key**
1. Nombre (ej: "Zapier") y scopes (permisos: events:read, guests:read…).
2. **Copia la key inmediatamente** (solo se muestra una vez, formato `ck_…`).
3. El sistema externo consume la API v1 con header `X-API-Key`:
   - `GET /api/v1/events` · `GET /api/v1/events/:id` · `GET /api/v1/events/:id/guests`
4. Puedes **activar/desactivar** o **revocar** keys cuando quieras (iconos en la fila).

> Límite de uso por key incluido (rate limiting por hora).
