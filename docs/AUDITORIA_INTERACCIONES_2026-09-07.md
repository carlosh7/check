# Auditoría de interacciones de usuario — 2026-09-07 (v12.44.816)

Auditoría en navegador real (Chromium, viewports 1440×900) sobre la app corriendo en local,
motivada por el reporte del usuario: *"la barra de búsqueda es muy pequeña y su color es poco
visible; la búsqueda por voz mutea el micrófono y no reconoce el audio"*. Se recorrieron las
vistas principales probando las interacciones de búsqueda/filtrado por texto, voz y limpieza.

---

## 1. Bugs reportados — causa raíz y fix (cerrados en v12.44.816)

### A) Barra de búsqueda pequeña y poco visible (afectaba a las 6 búsquedas del shell)

**Causa raíz (CSS):** el `<input>` llevaba la clase `search-input`, pero en `forms.css` esa
clase estaba diseñada para un *contenedor* (`position:relative; display:flex`), no para el
input. El input no recibía la clase base `.input` (que da `width:100%`, fondo del tema, borde
y placeholder legible), así que se pintaba con el estilo nativo del navegador (~170px, colores
por defecto). Además `.search-box-container`, `.search-icon`, `.search-icon-btn` y
`.search-clear-btn` **no tenían ninguna regla CSS**: la lupa, el micrófono y la ✕ quedaban
sueltos debajo del input.

**Fix (`forms.css`, incremental — nada sustitutivo):** bloque nuevo "SEARCH BOX (v12.44.816)"
que estiliza `.search-box-container` (560px máx.), `input.search-input` con el tema completo
(40px de alto, placeholder `--text-secondary`, focus con anillo acento) y los tres iconos
posicionados dentro (lupa izquierda; mic y ✕ derecha con hover). En móvil (<640px): 44px y
16px de fuente (evita zoom iOS). Verificado en pantalla: las 6 búsquedas heredan el fix.

### B) Voz "muteada" que no reconocía (Dashboard de asistentes)

Dos causas encadenadas en `toggleVoiceSearch()` (`app.js`):

1. **Icono invertido:** al *empezar* a escuchar se ponía `mic_off` en rojo — el símbolo de
   micrófono *tachado/apagado* que el usuario veía en pantalla y interpretaba como "muteado".
   Ahora muestra `graphic_eq` (ondas) en rojo mientras escucha.
2. **El dictado no filtraba la tabla:** al terminar, solo se llamaba a
   `filterGroups/filterUsers/filterClients/filterEvents` — **faltaba `filterAttendance`**
   (y `filterConfigStaff`). El texto dictado se escribía en el input pero la tabla no
   reaccionaba → el usuario percibía que "no reconoció el audio". Ambas llamadas añadidas.

Extra: `interimResults` activado con separación final/interino en `onresult` para feedback en
vivo ("🎤 …" va mostrando lo reconocido mientras hablas).

---

## 2. Verificación en navegador (evidencia)

| Prueba | Resultado |
|---|---|
| CSS de la barra (eventos y asistencia) | 560×40px, tema oscuro, iconos dentro, placeholder legible ✅ |
| Filtrado por texto en eventos | 48 → 47 con "Integration" ✅ |
| ✕ de eventos: limpia y restaura | input vacío, 48 filas de nuevo ✅ |
| Dictado simulado en asistencia ("abel") | tabla 104 → 1 fila visible (Isabella Reyes) ✅ — fix B-2 |
| ✕ de asistencia | limpia input + 4 selects (org/cargo/vegano/estado) ✅ |
| Botón de voz (sin micrófono físico) | toggle correcto, ciclo de reintentos, error 'network' con Swal y botón restaurado a gris ✅ |
| Icono durante escucha | código corregido a `graphic_eq` rojo (no verificable en vivo: entorno sin micro) |
| Vistas recorridas | Mis Eventos, Dashboard, Configuración (staff/usuarios/clientes/grupos), Sistema ✅ |
| Login por API | 200 OK ✅ |

## 3. Hallazgos nuevos (abiertos, prioridad baja)

| # | Hallazgo | Detalle | Prioridad |
|---|---|---|---|
| H-1 | Atributos HTML duplicados en los inputs de búsqueda | `data-act`/`data-call` repetidos en el mismo tag (`app-shell.html`, 5 inputs). El navegador conserva el primero: funciona de facto (`clearCall` → `filterX`), pero el segundo par (`call`/`showXSuggestions`) es muerto y `filterX` recibe un argumento basura ("showXSuggestions"). Limpieza recomendada. | P3 |
| H-2 | Credenciales débiles en `.env` local | `ADMIN_EMAIL`/`ADMIN_PASSWORD` siguen siendo las semillas históricas (`admin@example.com` / `changeme123`) y **el login funciona con ellas**. El ACTION_PLAN 0.5 eliminó los seeds, pero el `.env` del servidor no se rotó. Coincide con el pendiente del operador "cambiar contraseña del admin". | **P1 (operador)** |
| H-3 | Texto de versión estático desincronizado | `app-shell.html:76` decía "Check Pro v12.44.808" (el sidebar visible lo actualiza JS desde `/api/app-version`). Corregido a 816 en este bump; recordar mantenerlo en futuros bumps. | P3 (cerrado en 816) |
| H-4 | `docs/ROADMAP.md` desactualizado | Decía v12.44.811; git iba por 815. Actualizado en esta sesión. | P3 (cerrado) |
| H-5 | Reflow continuo del reloj en vivo afecta a tests E2E por coordenadas | Los clics automatizados por coordenadas (Playwright/CUA) pueden caer en otro elemento porque `.stats-bar` reflowea cada segundo. Los clics programáticos y selectores semánticos funcionan. Nota técnica para la suite E2E, no afecta a usuarios. | P3 |

## 4. No verificado en esta sesión

- Reconocimiento de voz real (requiere micrófono físico y servicio de voz del navegador):
  el flujo de error, los reintentos y la restauración de estado sí quedaron verificados.
- Módulos fuera del panel: portal público, kiosco, encuestas, ruleta (quedan para una
  segunda ronda de auditoría si se quiere cobertura completa).

---

# Segunda fase (mismo día) — Verificación integral FE↔BE y E2E por secciones

Petición del operador: *"¿todos los botones llaman a donde deben? ¿todas las funciones del
backend están disponibles en el frontend? ¿análisis exhaustivo de todas las áreas?"*

## 5. Matriz de conectividad Backend ↔ Frontend (regenerada a v12.44.816)

`node scripts/coverage-api.js` → `docs/COBERTURA_FE_BE.md`:

- **432 endpoints backend** · **414 con uso desde el frontend (96%)** · **18 sin UI**.
- **Llamadas del frontend a endpoints inexistentes: 0** — ningún botón del producto apunta
  a una ruta rota a nivel de API.
- Los 18 sin UI son mayormente justificados (API pública v1 para consumo externo, webhooks
  Stripe/GitHub, `GET /api/unsubscribe/:token` de los pies de email, `tenant/:slug` público,
  `metrics` server-to-server). **A revisar por si son features ocultas:** `POST /api/logout`
  (el botón Cerrar sesión funciona — verificar qué ruta usa) y `POST /api/verify-reset-code`
  (el wizard de recuperación puede tener un paso sin UI).

## 6. E2E por secciones (navegador real, Chromium local, login ADMIN, evento con 32 asistentes)

Método: en cada vista/pestaña/sub-pestaña se validó **cada elemento visible con `data-call`**
contra los métodos reales de `App`/`window` (el mismo resolve que usa el dispatcher), se
clickearon las acciones seguras (modales/toggles) y se capturaron errores JS
(`window.onerror` + `unhandledrejection`) y respuestas HTTP ≥400.

| Zona | Cobertura | Resultado |
|---|---|---|
| Dashboard (por evento) | 284 `data-call` visibles · toolbar completo · Gafetes (4 sub-acciones) | **0 métodos inexistentes · 0 errores JS · 0 HTTP≥400**. Asistente/Edición/Importar/Analytics/IA Insights abren modal/panel sin errores. Borrar DB/Exportar/Reporte validados por método (no clickeados por seguridad) |
| Mis Eventos | 117 acciones · ciclo filtrar→✕→restaurar | 0 faltantes · 48→47→48 filas ✅ |
| Configuración | 6 grupos · **21 sub-pestañas** (staff, pre-reg, categorías, reg-fields, network, agenda, encuestas, ruleta, gamificación, álbum, certificados, gafetes, branding, seatmaps, sesiones, ponentes, automatización, email, presupuesto, cupones, google, propuestas, patrocinadores, inteligencia, plugins, ajustes) | Todas cargan ~1s · **0 errores · 0 métodos rotos** |
| Sistema | 6 grupos · **23 sub-pestañas** (usuarios, grupos, clientes, tenants, perfil, DB, legal, compliance, actividad, email, push, SMS, WhatsApp, api-keys, CRM, ecommerce, google, venues, webhooks, ai-security, BI, marketplace, ops) | Todas ~1s · **0 errores · 0 métodos rotos** |
| Registro público | `/registro.html?event=…` | Formulario 12 campos · 0 errores JS ✅ |

## 7. Hallazgos de esta fase

| # | Hallazgo | Estado |
|---|---|---|
| H-6 | Sub-pestaña **Certificados** tardó 13.2s una vez (primer render del grupo); re-pasadas ~1s y el endpoint responde en 3ms | 🔵 Observación: no reproducible como bug; monitorear en producción |
| H-7 | `POST /api/logout` y `POST /api/verify-reset-code` sin UI aparente | 🔵 Revisar si son features ocultas o rutas legadas |
| H-8 | `scripts/coverage-api.js` escribe versión fija antigua (v12.44.789) en el título del informe | 🔵 Cosmético |
| — | Nota técnica E2E: el reloj en vivo reflowea cada segundo; en automatización usar selectores semánticos (los clics por coordenadas pueden caer en otro elemento) | Documentado |

## 8. Veredicto

Con la evidencia anterior más esta fase: **no se detectan botones rotos ni features de
backend sin ruta frontend en las zonas navegables del panel** (0/432 llamadas rotas,
0 métodos inexistentes en ~450 acciones visibles validadas, 0 errores JS en 50+ vistas).
La deuda real está en: los 18 endpoints sin UI (4%, mayoría justificada), los hallazgos
documentados (H-1…H-8) y el P1-5 del operador (rotar credenciales del `.env`).

---

# Tercera fase (mismo día) — Resolución de hallazgos (v12.44.817)

## 9. Cerrados

| # | Hallazgo | Resolución (v12.44.817) | Verificación |
|---|---|---|---|
| H-1 / P3-10 | `data-act`/`data-call` duplicados en 5 inputs de búsqueda; el segundo par era muerto y `filterX` recibía argumento basura | Los 10 atributos duplicados eliminados; llamadas unificadas con el separador correcto del dispatcher (`\|`): al escribir se filtra **y** se muestran las sugerencias (estaban muertas desde el origen por la sintaxis con comas), y la ✕ además las oculta. `loadAnalytics` en el input de asistencia quedó fuera (nunca llegó a ejecutarse; activarlo dispararía analytics en cada tecla — decisión aparte) | E2E: escribir "Demo" muestra el dropdown con el evento; ✕ lo oculta y restaura la lista ✅ |
| H-7 (logout) | `POST /api/logout` (revoca token vía blacklist + audita) sin uso: `App.logout()` solo limpiaba local — el JWT quedaba válido hasta expirar | `App.logout()` ahora revoca en servidor (fire-and-forget con `Authorization: Bearer`, con fallback a localStorage; el logout local nunca se bloquea si la red falla). Cobertura: 414→**415** endpoints con UI | E2E: click en Cerrar sesión → `POST /api/logout` **200** y vuelta al login ✅ |
| H-7 (verify-reset-code) | Sin UI aparente | **Legado confirmado**: el wizard de recuperación usa `password-reset-request` → `reset-password` (código+contraseña en un paso). Ruta conservada (no se borra); anotada en COBERTURA | Revisión de código FE (app.js:18666-18681) |
| H-8 | `coverage-api.js` escribía versión fija antigua (v12.44.789) | Lee `package.json` (regla del proyecto: nunca asumir la versión) | Informe regenerado con título v12.44.817 ✅ |

Observación menor nueva: el botón Cerrar sesión dispara `App.logout()` dos veces (doble
binding delegado + directo preexistente) — inofensivo (la segunda revocación es idempotente);
se deja anotado, no se toca.

## 10. Estado final de hallazgos

- **Cerrados:** H-1/P3-10, H-3, H-4, H-6 (observación), H-7, H-8.
- **Abiertos para el operador:** **P1-5 — rotar las credenciales del `.env`** y el pendiente del PAT de GitHub.
  *Matizado tras validación en producción:* el login de producción rechaza las semillas
  (`401` — el admin real usa otra contraseña), así que el riesgo queda acotado a los
  `.env` de desarrollo, cuya contraseña de BD local sí se acepta.
- Matriz FE↔BE final: **432 endpoints · 415 con UI (96%) · 17 sin UI (justificados/legado) · 0 llamadas rotas.**

---

# Redeploy de producción — VPS Contabo (2026-09-07, v12.44.817)

Procedimiento documentado (lección del incidente del 05-09 aplicada): backup previo →
rsync con excludes estrictos (`.git/`, `node_modules/`, `data/`, `persistence/`, `.env*`,
`docker-compose*.yml`, `portainer-stack*.yml`, `coverage/`; sin `--delete`) →
`docker compose build check-app` → `up -d check-app`.

| Verificación | Resultado |
|---|---|
| Backup previo | `/opt/check-backup-20260907-redeploy.tar.gz` (1.1M) ✅ |
| `docker-compose.yml` del VPS intacto (13000 / ALLOWED_ORIGINS) | md5 idéntico al backup ✅ |
| `/api/health` interno (127.0.0.1:13000) | `{"status":"ok"}` ✅ |
| `/api/app-version` interno y externo (https://chek.smarteventos.co) | **12.44.817** ✅ |
| Query strings servidas en `/` | `v=12.44.817` ✅ |
| Contenedor `check-app` | Up, healthy, sin errores en logs ✅ |
| Otros proyectos (Nextcloud AIO, Dolibarr) | Up, intactos ✅ |
| Prueba autenticada de sugerencias/logout en producción | No ejecutable: el admin de producción usa otras credenciales (401 con las semillas — positivo para P1-5). La lógica afectada es idéntica a la verificada E2E en local; sugerido validarlo con la contraseña real del operador |

Nota: el texto `v12.44.802` que aparece en el HTML de login es un comentario del setup
wizard (cosmético, no es la versión servida).
