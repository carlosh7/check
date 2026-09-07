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
