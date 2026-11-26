# Auditoría externa 2026-11-25 — verificación y remediación

Informe de otro agente sobre Check Pro v12.44.845 (commit `e9d3546`), pegado por el dueño el 2026-11-25.
El informe original vive solo en el chat; este documento es la copia verificada.

## 1. Verificación del informe (solo lectura)

107 hallazgos revisados uno por uno contra el código: **77 confirmados, 29 con matices (problema real,
impacto menor o detalle inexacto) y 1 falso** (`App.showToast` sí existe). Casi nada se solapa con
`AUDITORIA-2026-11-13-COMPLETA.md`.

Conteos propios que coinciden con el informe: tests 455 pasan / 1 omitido; ESLint 2 errores + 617 avisos
(límite del CI 520); `npm audit --omit=dev` 0 vulnerabilidades.

### P0 confirmados leyendo el código

| ID | Hallazgo | Dónde |
|----|----------|------|
| S1 | `POST /api/import/execute` acepta `role` del cuerpo: un PRODUCTOR se hace ADMIN | `import.routes.js` |
| S1+ | La importación también actualiza grupos y eventos ajenos por nombre (no estaba en el informe) | `import.routes.js` |
| S2 | `PUT /users/:id/events` se auto-concede acceso a eventos ajenos | `users.routes.js` |
| S3 | `POST /groups/:groupId/users` mete a cualquier usuario en el grupo propio | `groups.routes.js` |
| S4 | `DELETE /events/:id/badge-logo` borra del disco la ruta que venga en la config | `events.routes.js` |
| S10 | Códigos de recuperación adivinables y contador de intentos evadible | `auth.routes.js`, `server.js` |
| S12 | `qr_token` (credencial de check-in) entregado sin autenticación | `networking.routes.js`, `public.routes.js` |
| D2 | Respaldos sin `data/events/*.db` — confirmado en producción (respaldos de 65 KB idénticos) | `src/utils/backup.js` |
| D9 | `session_speakers` no tiene CREATE TABLE | `sessions.routes.js`, `speakers.routes.js` |

### Matices que bajan la prioridad

- Motor de plugins (`vm`): inalcanzable hoy (`triggerHook` sin llamadores; nadie escribe `plugins.script`).
- Socket.io sin auth: real, pero sin DoS (el proceso sobrevive a `data = null`) y con datos limitados.
- FLUSHALL de Redis al apagar: solo aplica si hay Redis configurado; producción no lo tiene.
- Carreras de stock en juegos y asientos: no explotables en un solo proceso (handlers síncronos).
- CSRF: no explotable (la sesión va solo en `Authorization: Bearer`).
- `wheel.js:447`: no revienta (script clásico, global implícita); fuga de JWT en el editor 3D: no real.
- `App.showToast` existe → ese hallazgo del informe es FALSO.

## 2. Fase 0 — verdad de producción (solo lectura, 2026-11-25)

- Producción NO usa los stacks de Portainer: es `/opt/check/docker-compose.yml` con `build: .`, bind del
  repo completo (`/opt/check -> /usr/src/app`), volumen `node_modules`, `./data -> /usr/src/app/persistence`
  y `env_file: .env`. El `.env` del host tiene `JWT_SECRET` y `ENCRYPTION_KEY` estables → **el riesgo de
  llaves efímeras (I1) NO aplica**.
- El contenedor corre como **root** y `data/` con 777 (I2 confirmado en producción).
- **Redis no está configurado** → el FLUSHALL al apagar nunca corre (D1 inactivo).
- Respaldos: archivos `.db.enc` de 65.827 bytes idénticos cada 6 h; en disco hay **1 base de evento**
  (`data/events/d77eb0e3-….db` con 2 MB en WAL) fuera de esos respaldos → **D2 confirmado en producción**.
- `/opt/check/uploads` no existe (sin logos subidos todavía); `data/photos` y `data/uploads` existen.

## 3. Estado del plan

| Fase | Versión | Estado |
|------|---------|--------|
| 0 — verdad de producción | — | ✅ cerrada (arriba) |
| 1 — parche de seguridad | v12.44.846 | ✅ cerrada — `967645d`, desplegada y validada en vivo |
| 2 — respaldos y persistencia | v12.44.847 | ✅ cerrada — `10983ee`, desplegada y validada en vivo |
| 3 — funcionalidades rotas | v12.44.848 | ⏳ pendiente |
| 4 — CI verde y tests | v12.44.849 | ⏳ pendiente |

Cada fase cierra con: bump de versión (4 archivos), commit, tag, push, deploy por rsync + restart,
y validación en vivo en chek.smarteventos.co. Todo fix queda cubierto por un test.

## 4. Fase 1 — parche de seguridad (v12.44.846)

Reglas aplicadas: guards añadidos al lado del código existente (no se borra nada), causa raíz, nada de
hardcode, comentario `v12.44.846` en cada cambio.

| ID | Estado | Evidencia |
|----|--------|-----------|
| S1 | ✅ | `import.routes.js`: rol con lista cerrada, ADMIN solo si quien importa es ADMIN; un PRODUCTOR solo toca sus grupos, eventos y usuarios; asistentes solo a eventos propios (el informe no vio que la importación también editaba grupos y eventos ajenos por nombre) |
| S2 | ✅ | `users.routes.js` PUT `/:id/events`: cada evento debe pasar `hasEventAccess` |
| S3 | ✅ | `groups.routes.js`: listar exige pertenecer al grupo; añadir o quitar exige que el usuario ya comparta grupo y nunca es un ADMIN |
| S4 | ✅ | `events.routes.js`: ruta del logo validada al guardar y antes de borrar (solo dentro de `uploads/logos`) |
| S10 | ✅ | `server.js` (limitador cubre `password-reset-request`), `rate-limiter.js` (nadie exento por defecto, `RATE_LIMIT_EXEMPT_CIDRS`, clave sin User-Agent), `auth.routes.js` (cuenta obligatoria, código atado a la cuenta, `crypto.randomInt`) |
| S11 | ✅ parcial | `events.routes.js` (18 rutas con `:id`), `guests.routes.js` (8 rutas), `email.routes.js` (cuentas, plantillas, campañas, buzón y envío). Pendiente el resto de routers → Fase 3 |
| S12 | ✅ | `src/security/portal-token.js` (nuevo): token de portal firmado por asistente; el portal y el networking lo exigen y ya no entregan `qr_token` ajeno. Enlace para el organizador: `GET /api/guests/:eventId/portal-link/:guestId` |
| S7 | ✅ | `src/security/network-policy.js` (nuevo): webhooks, e-commerce e inteligencia rechazan destinos de red interna (`SSRF_ALLOWED_CIDRS` para excepciones); pruebas de correo solo a hosts públicos y puertos estándar (`MAIL_TEST_ALLOWED_HOSTS`) |
| S9 | ✅ | `ai-security.routes.js`: clave de OpenRouter enmascarada salvo ADMIN; registros ajenos solo ADMIN |
| H1 | ✅ | `captcha.js`: token opaco, la respuesta vive solo en el servidor |
| H2 | ✅ | `compliance.routes.js` y `guests.routes.js`: derecho al olvido con las columnas reales, también en la BD del evento |
| H3 | ✅ | `settings.routes.js`: filtro de secretos por patrón (salía `VAPID_PRIVATE_KEY`) |
| H4 | ✅ | `users.routes.js`, `auth.routes.js`, `jwt.js`: clave actual obligatoria; un cambio de clave cierra las sesiones abiertas (`users.token_valid_after`) |
| H5 | ✅ | `server.js`: el montaje de `/uploads` usa las opciones endurecidas |
| H7 | ✅ | `jwt.js` (secreto débil aborta el arranque en producción; lista negra fail-closed), `public.routes.js` (token de kiosco fail-closed y comparación en tiempo constante) |
| H8 | ✅ | `encryption.js`: ruta del logger corregida; IV de 12 bytes (lo cifrado antes sigue leyéndose) |
| H9 | ✅ | `users.routes.js`: logs sin contraseña ni secretos |
| H11 | ✅ | `settings.routes.js`: "aprobar a todos" solo aprueba cuentas PENDIENTES; "purgar" exige la contraseña del ADMIN |
| H13 | ✅ | `ai-security.routes.js`: inyección de prompt detectada → la consulta se rechaza (422) |
| D1 | ✅ | `server.js` + `redis-cache.js`: el apagado cierra Redis y las BDs de evento; ya no hace FLUSHALL |
| D8 | ✅ | `database-manager.js`: `transactions` sin la clave foránea a `guests(event_id)`; reconstrucción automática de la tabla en las BDs existentes |
| N1 | ✅ | `import.routes.js`: `.apply()` → `.run(...params)` (actualizar un cliente reventaba) |
| N3 | ✅ | `public.routes.js`: el kiosco ya no da 500 en `/kiosk/:eventId/event` |
| S13 | ✅ | `chatbot/engine.js`: `event_id` validado antes de abrir su BD |
| F1 | ✅ | `app.js:2663` (usaba `userId` inexistente) y `wheel.js:447` |
| G1 | ✅ parcial | `scripts/bump-version.js` (nuevo): una sola versión de `?v=` en `index.html`, `app-shell.html`, `app.js` y las páginas |

Variables de entorno nuevas (todas con default seguro): `RATE_LIMIT_EXEMPT_CIDRS`, `JWT_SECRET_MIN_LENGTH`,
`ALLOW_WEAK_JWT_SECRET`, `SSRF_ALLOWED_CIDRS`, `WEBHOOK_RESPONSE_LOG_MAX_BYTES`, `MAIL_TEST_ALLOWED_HOSTS`,
`PORTAL_TOKEN_SECRET`, `ERASURE_EXTRA_GUEST_COLUMNS`.

Evidencia local: `npm test` → 26 suites, 483 pasan, 1 omitido (antes 455); `npx eslint .` → 0 errores.

Incidencia durante la fase (sin efecto en producción): la primera versión del arreglo D8 dejó una coma
de más en el `CREATE TABLE` y la reconstrucción eliminó la tabla `transactions` de las 110 bases de
evento **locales** sin recrearla. Se corrigió antes de desplegar: la reconstrucción ahora restaura la
tabla original si la nueva no se crea o el conteo de filas no cuadra, y las 110 bases volvieron a
quedar con su tabla (verificadas con la vía real de la aplicación).

### Validación en vivo de la Fase 1 (2026-11-26, chek.smarteventos.co)

Deploy: 60 archivos con md5 idéntico local/producción; contenedor sano a los 18 s; `/api/health/full`
informa `version: 12.44.846`. Respaldo previo: archivos reemplazados en `~/check-backups/v12.44.846-*` y
copia consistente de las 2 bases de datos en `data/system/backups/predeploy-v12.44.846` (solo root).

Comprobaciones con peticiones reales, usando una cuenta PRODUCTOR de prueba (borrada al terminar, 0 restantes):

| Qué | Resultado |
|-----|-----------|
| Importar un usuario con role=ADMIN / importarse a sí mismo como ADMIN | rechazado; ningún usuario creado; el rol no cambia |
| Importar una empresa nueva | rechazado; nº de grupos sin cambios |
| Auto-asignarse un evento ajeno | 403 |
| Listar o manipular un grupo ajeno | 403 |
| Leer o cambiar la config de un evento ajeno | 403 (el ADMIN sigue en 200) |
| Guardar un logo con `../../` | 400; `.env` intacto y config sin cambios |
| Perfil de networking / portal sin token | 403 |
| Clave foránea inválida en la BD del evento | reparada al abrirse; integridad OK; 978 invitados |
| Kiosco `/kiosk/:id/event` | 200 con estadísticas (antes 500) |
| Clave de IA ante un PRODUCTOR | sin clave en claro |
| Tanteo de puerto interno por el test de correo | rechazado |
| CAPTCHA | token opaco |
| Cambiar la clave con la actual equivocada | 403 |
| Verificar código de recuperación sin indicar la cuenta | 400 |

Pantalla de acceso en el navegador: render correcto (captura), `app.js?v=12.44.846`.

## 5. Fase 2 — respaldos y persistencia (v12.44.847)

| ID | Estado | Evidencia |
|----|--------|-----------|
| D2 | ✅ | `src/utils/backup.js`: cada respaldo incluye las BDs de evento (`check_event_backup_<fecha>_<id>.db.enc`) y los archivos subidos (`check_uploads_backup_<fecha>.tar.gz.enc`), cifrados con la misma clave. El verificador de restauración entiende los tres tipos. El segundo respaldo de `webhooks.js` (copia en caliente, sin cifrar) usa el sistema principal |
| I2 | ✅ | Dockerfile con usuario propio `checkapp` (uid 10001) y `USER`; compose con `user: "10001:10001"`; el script de arranque ya no hace `chmod -R 777` |
| I4 | ✅ | Logos en `DATA_PATH/uploads/logos` (antes en la carpeta del código, fuera del volumen); `/uploads/photos` se sirve desde `DATA_PATH/photos` (daba 404 en Docker) |
| I7 | ✅ | `docker-entrypoint.sh`: puertos comprobados con node (antes `/dev/tcp`, que no existe en sh: la comprobación fallaba siempre), ya no reescribe `APP_URL`/`ALLOWED_ORIGINS` del `.env`, no aborta si no puede escribir el `.env`. Dockerfile sin `npm install` con `|| echo` |
| I1 | ✅ | `portainer-stack*.yml`: el `.env` persiste junto a los datos. No aplica a producción, que usa `docker-compose.yml` con `env_file` |
| I10 | ✅ | `.dockerignore` excluye `coverage/`, `.zcode/`, `.agent/`, `.gemini/`, `portainer-stack-v2.yml` |
| P8 | parcial | `logger.js` respeta `DATA_PATH`. Pendiente: una escritura síncrona por línea de log y hash de claves dentro de transacciones |
| I6 | ⏳ | `deploy.routes.js` sin candado (producción no lo usa: se despliega por rsync) |

Pruebas: `tests/backup-restore.test.js` (12) cubre respaldo cifrado y restorable de eventos, paquete de
subidas y limpieza por antigüedad. El script de arranque se probó en un directorio aislado con cuatro
casos (`.env` sin permiso, `.env` escribible, secretos desde el entorno, datos sin permiso).
Guía de usuario: `docs/user/07-administracion/09-cifrado-datos.md`.

### Validación en vivo de la Fase 2 (2026-11-26)

- Migración de usuario: propiedad de `/opt/check/data` para uid 10001 y sin escritura para "otros" (era 777).
- Compose de producción: solo dos cambios (`user: "10001:10001"` y `HOME=/tmp`); contenedor recreado con `docker compose up -d`.
- Resultado: el proceso `node` corre con uid 10001; salud 200 a los 15 s; `/api/health/full` → `12.44.847`.
- Respaldo automático: aparece `check_event_backup_…_d77eb0e3-….db.enc` (237 KB, cifrado); restaurado en memoria da integridad OK y 978 invitados.
- `POST /api/system/backup` usa el sistema nuevo (2 archivos cifrados) y ya no escribe copias en claro en `./backups`.
- Las 9 variables del `.env` del host siguen llegando al contenedor. Logs activos. Captura de la pantalla de acceso correcta.
- Cambio de comportamiento: `DEPLOY_WEBHOOK_SECRET` ya no se autogenera (el script no puede escribir el `.env`). Si se usa el auto-despliegue por webhook, hay que definirlo en el entorno.

**Incidencia evitada:** al desplegar la lista de archivos del commit se copió el `docker-compose.yml` del
repositorio (plantilla de desarrollo) encima del de producción. Se detectó al revisar el compose antes de
recrear el contenedor; se restauró desde el respaldo (misma huella que el original) y solo se aplicaron los
dos cambios previstos. Regla desde aquí: el compose de producción nunca se despliega desde el repo.
