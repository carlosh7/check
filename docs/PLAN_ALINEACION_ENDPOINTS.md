# REPORTE COMPLETO Y PLAN DE ACCIÓN - ALINEACIÓN Y PURGA

**Fecha:** 25-Marzo-2026  
**Proyecto:** Check Pro  
**Contenedor:** C:\Users\carlo\check (localhost:3000)  
**Código fuente:** C:\Users\carlo\OneDrive\Documentos\APP\Registro

---

## 1. ESTADO ACTUAL DEL SISTEMA

### 1.1 Arquitectura del Contenedor (localhost:3000) ✅

| Componente | Archivo | Prefijo | Estado |
|---|---|---|---|
| Frontend | `script_v12_16_2.js` (V12.16.4) | `/email/` | ✅ Modular |
| Backend | `src/routes/index.js` + `src/routes/*.routes.js` | `/api/email/` | ✅ Modular |
| Servidor | `server.js` | - | ✅ Activo |

### 1.2 Arquitectura Legacy (en C:\Users\carlo\OneDrive\Documentos\APP\Registro)

| Componente | Archivo | Prefijo | Estado |
|---|---|---|---|
| Frontend | `script.js` (V12.16.2) | `/emails/` | ❌ Legacy |
| Backend | `server_backup_full.js` | `/api/emails/` | ❌ Legacy |
| Servidor | `server_backup_full.js` (inline routes) | - | ❌ Legacy |

---

## 2. HALLAZGOS CRÍTICOS

### 2.1 PROYECTO ORIGINAL (Registro) vs CONTENEDOR (check)

| Aspecto | Registro | Contenedor (check) |
|---|---|---|
| Frontend | `script.js` con `/emails/` | `script_v12_16_2.js` con `/email/` |
| Backend | `server_backup_full.js` | `server.js` + `src/routes/` |
| Email prefijos | `/emails/` | `/api/email/` |
| Rutas email | Inline en server_backup_full | Modular en email.routes.js |
| Versión | V12.16.2 | V12.16.4 |

### 2.2 FUNCIONES DUPLICADAS EN script.js (Registro)

| Función | Ubicación | Observación |
|---|---|---|
| `removeUserFromEvent` | Línea 481-490 y 757-769 | DUPLICADA |
| `syncEmails` | Línea 1221 | Versión legacy |
| `startBroadcast` | Línea 1408 | Versión legacy (duplicada en nuevo) |
| `controlMailingQueue` | Línea 1441 | Versión legacy (duplicada en nuevo) |
| `updateMailingStats` | Línea 1461 | Versión legacy (duplicada en nuevo) |
| Sistema mailing nuevo | Líneas ~5115-5210 | `sendMassEmail`, `controlQueue`, `updateQueueStats` |

### 2.3 ARCHIVOS OBSOLETOS EN EL PROYECTO (Registro)

**Scripts legacy:**
- `script.js` (V12.16.2 - legacy, usar `script_v12_16_2.js`)
- `script_prev.js` (backup antiguo)
- `script_prev_utf8.js` (backup antiguo)
- `script_v12_16_2.js` (NUEVO - debe mantenerse)

**Servers legacy:**
- `server_backup_full.js` (LEGACY - usar `server.js`)

**Otros archivos obsoletos:**
- `logic_v16.js` (?)
- `server.js` (puede tener diferencias con el del contenedor)

### 2.4 FUNCIONES CON NOMBRES INCORRECTOS EN DELEGATION SWITCH

| Case en switch | Función real | Corrección |
|---|---|---|
| `assignUserToGroupFromSelector` | `assignUserGroupFromSelector` | Renombrar |
| `closeUserSelectorGroup` | `closeGroupSelector` | Renombrar |
| `assignUserToEventFromSelector` | No existe | Crear o eliminar |
| `closeUserSelectorEvent` | No existe | Crear o eliminar |
| `assignEventFromSelector` | No existe | Crear o eliminar |
| `navigateToCreateEvent` | No existe | Crear o eliminar |

### 2.5 BUG ENCONTRADO EN script_v12_16_2.js (contenedor)

**Línea 2022:** `/email/emails/sync` - DOBLE PREFIJO ❌
- Debería ser: `/email/imap/sync`

---

## 3. PLAN DE ACCIÓN

### FASE 1: Sincronizar proyecto Registro con Contenedor

**Paso 1.1:** Copiar archivos correctos del contenedor al proyecto
- [ ] `C:\check\script_v12_16_2.js` → `C:\Registro\script_v12_16_2.js` (reemplazar)
- [ ] `C:\check\src\routes\*` → `C:\Registro\src\routes\` (sincronizar)
- [ ] `C:\check\server.js` → `C:\Registro\server.js` (reemplazar)

**Paso 1.2:** Corregir bug de doble prefijo
- [ ] En `script_v12_16_2.js` línea 2022: `/email/emails/sync` → `/email/imap/sync`

### FASE 2: Purga de archivos legacy

**Archivos a ELIMINAR:**
- [ ] `C:\Registro\script.js` (V12.16.2 legacy)
- [ ] `C:\Registro\script_prev.js` (backup antiguo)
- [ ] `C:\Registro\script_prev_utf8.js` (backup antiguo)
- [ ] `C:\Registro\server_backup_full.js` (legacy monolith)

**Archivos a MANTENER:**
- [ ] `C:\Registro\script_v12_16_2.js` (V12.16.4 - versión actual)
- [ ] `C:\Registro\server.js` (contenedor actualizado)
- [ ] `C:\Registro\src\routes\*` (sistema modular)

### FASE 3: Limpiar funciones duplicadas

**En script_v12_16_2.js:**
- [ ] Eliminar `removeUserFromEvent` duplicada (buscar cuál eliminar)
- [ ] Eliminar `syncEmails` legacy (líneas ~2019-2025) si ya existe versión nueva
- [ ] Eliminar `startBroadcast` legacy (líneas ~2270-2305) si ya existe `sendMassEmail`
- [ ] Eliminar `controlMailingQueue` legacy (líneas ~2499-2517) si ya existe `controlQueue`
- [ ] Eliminar `updateMailingStats` legacy (líneas ~2519-2543) si ya existe `updateQueueStats`

### FASE 4: Corregir delegation switch

- [ ] `assignUserToGroupFromSelector` → `assignUserGroupFromSelector`
- [ ] `closeUserSelectorGroup` → `closeGroupSelector`
- [ ] Investigar y crear o eliminar funciones faltantes

### FASE 5: Verificación

- [ ] Commit de cambios
- [ ] Copiar al contenedor C:\check
- [ ] Reiniciar contenedor
- [ ] Probar funcionalidades de email
- [ ] Probar delegation switch

---

## 4. NOTAS IMPORTANTES

1. **El contenedor check usa la versión correcta** (V12.16.4 con sistema modular)
2. **El proyecto Registro tiene versión legacy** (V12.16.2 con sistema monolith)
3. **El script_v12_16_2.js del contenedor tiene un bug** en la línea 2022

---

## 5. PREGUNTAS PENDIENTES

1. ¿`logic_v16.js` es un archivo en uso o es legacy?
2. ¿Las funciones faltantes en delegation switch (`assignUserToEventFromSelector`, etc.) deben crearse o eliminarse del switch?

---

**Elaborado:** 25-Marzo-2026  
**Próximo paso:** Confirmar plan y comenzar Fase 1
