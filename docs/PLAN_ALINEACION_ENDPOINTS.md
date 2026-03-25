# PLAN DE TRABAJO - ALINEACIÓN DE ENDPOINTS Y FRONTEND

**Fecha:** 25-Marzo-2026  
**Estado:** Elaborado - Pendiente de ejecución

---

## 1. FUNCIONES DUPLICADAS

### 1.1 `removeUserFromEvent` - DUPLICADA
- **Ubicación 1:** script.js línea 481-490
- **Ubicación 2:** script.js línea 757-769
- **Análisis:** La versión de la línea 757 es más completa (tiene confirmación `_confirmAction` y usa `this.state.allUsers`). La versión de la línea 481 es más simple.
- **Acción:** Eliminar la versión de la línea 481 (más simple), mantener la línea 757 (más completa).

---

## 2. ENDPOINTS DESALINEADOS - MÓDULO EMAIL

### 2.1 `syncEmails`
- **Frontend actual:** `POST /emails/sync` (script.js línea 1224)
- **Backend correcto:** `GET /imap/sync`
- **Problema:** Ruta `/emails/sync` no existe en backend. El correcto es `/imap/sync` con GET
- **Acción:** Cambiar a `GET /imap/sync`

### 2.2 `startBroadcast`
- **Frontend actual:** `POST /emails/broadcast` (script.js línea 1420)
- **Backend correcto:** `POST /send-mass`
- **Problema:** La ruta `/emails/broadcast` no existe
- **Acción:** Cambiar endpoint a `/send-mass`

### 2.3 `controlMailingQueue`
- **Frontend actual:** `POST /emails/queue-control` (script.js línea 1443)
- **Backend correcto:** `POST /email-queue/:action`
- **Problema:** El prefijo `/emails` es incorrecto
- **Acción:** Cambiar a `/email-queue/${action}`

### 2.4 `updateMailingStats`
- **Frontend actual:** `GET /emails/queue-stats` (script.js línea 1463)
- **Backend correcto:** `GET /email-queue/stats`
- **Problema:** El prefijo `/emails` es incorrecto
- **Acción:** Cambiar a `/email-queue/stats`

---

## 3. ENDPOINTS DESALINEADOS - MÓDULO PRE-REGISTRATIONS

### 3.1 `updatePreRegStatus`
- **Frontend actual:** `PUT /pre-registrations/${id}/status` (script.js línea 2464)
- **Backend correcto:** `PUT /pre-registrations/:id/status` (events.routes.js)
- **Montaje backend:** `/api` + events.routes montado en `/api/events`
- **Problema:** La ruta es correcta en sí, pero falta verificar que el query string del evento no sea necesario
- **Acción:** Verificar que la ruta funcione correctamente con los IDs de pre-registration

---

## 4. FUNCIONES CON NOMBRES INCORRECTOS EN DELEGATION SWITCH

### 4.1 `assignUserToGroupFromSelector`
- **Línea en switch:** 2325
- **Función real:** `assignUserGroupFromSelector` (existe en App líneas 822-836)
- **Acción:** Cambiar `assignUserToGroupFromSelector` → `assignUserGroupFromSelector`

### 4.2 `closeUserSelectorGroup`
- **Línea en switch:** 2326
- **Función real:** `closeGroupSelector` (existe en App línea 842)
- **Acción:** Cambiar `closeUserSelectorGroup` → `closeGroupSelector`

### 4.3 `assignUserToEventFromSelector`
- **Línea en switch:** 2327
- **Función real:** No existe en App
- **Acción:** Verificar si debe ser `assignEventFromSelector` o si la función no existe

### 4.4 `closeUserSelectorEvent`
- **Línea en switch:** 2328
- **Función real:** No existe en App
- **Acción:** Verificar si debe ser `closeEventSelector`

### 4.5 `assignEventFromSelector`
- **Línea en switch:** 2343
- **Función real:** No existe en App
- **Acción:** Crear la función o verificar el nombre correcto

### 4.6 `navigateToCreateEvent`
- **Línea en switch:** 2344
- **Función real:** No existe en App
- **Acción:** Crear la función o verificar el nombre correcto

---

## 5. FUNCIONES HUÉRFANAS (definidas en switch pero no existen en App)

| Case en switch | ¿Existe en App? |
|---|---|
| `assignUserToGroupFromSelector` | No, es `assignUserGroupFromSelector` |
| `closeUserSelectorGroup` | No, es `closeGroupSelector` |
| `assignUserToEventFromSelector` | No |
| `closeUserSelectorEvent` | No |
| `assignEventFromSelector` | No |
| `navigateToCreateEvent` | No |

---

## 6. ORDEN DE EJECUCIÓN

### PASO 1: Verificar functions.js y estado actual
- Identificar todas las funciones huérfanas
- Documentar cuáles funciones existen realmente en App

### PASO 2: Corregir funciones duplicadas
- Eliminar `removeUserFromEvent` duplicada (línea 481-490)

### PASO 3: Corregir endpoints del módulo email
- `syncEmails`: `/emails/sync` → `/imap/sync`
- `startBroadcast`: `/emails/broadcast` → `/send-mass`
- `controlMailingQueue`: `/emails/queue-control` → `/email-queue/${action}`
- `updateMailingStats`: `/emails/queue-stats` → `/email-queue/stats`

### PASO 4: Corregir nombres en delegation switch
- `assignUserToGroupFromSelector` → `assignUserGroupFromSelector`
- `closeUserSelectorGroup` → `closeGroupSelector`
- Las demás requieren verificación de existencia

### PASO 5: Verificación
- Commit de cambios
- Reinicio del contenedor
- Prueba de funcionalidad

---

## 7. NOTAS

- El backend (email.routes.js) fue refactorizado con nuevas rutas (`/email-queue/`, `/send-mass`, `/accounts`, `/campaigns`)
- El frontend (script.js) aún usa las rutas antiguas (`/emails/`)
- El archivo script_v12_16_2.js parece tener cambios parciales pero aún tiene el problema de `/emails/sync` en vez de `/imap/sync`

---

** Elaborado:** 25-Marzo-2026  
**Siguiente paso:** Ejecutar PASOs 1-5 en orden
