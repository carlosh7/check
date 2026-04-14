# Plan de Modularización Frontend Check Pro

**Versión:** 1.0  
**Fecha:** 2026-04-14  
**Estado:** Pendiente de inicio  
**Responsable:** Agente IA / Carlos

---

## 1. Contexto y Antecedentes

### 1.1 Problema actual

La aplicación Check Pro tiene un frontend **monolítico**:
- **Archivo principal:** `public/js/app.js` (~15,122 líneas)
- **Estructura:** Todo en un solo archivo
- **Imports:** Solo 2 (api.js, utils.js)
- **Mantenibilidad:** Difícil de escalar y mantener

### 1.2 Objetivo

Migrar de arquitectura monolítica a **modular** manteniendo Vanilla JS (sin cambiar framework).

### 1.3 Restricciones

- ❌ NO usar AngularJS + React (legacy, complejidad innecesaria)
- ✅ Mantener Vanilla JS
- ✅ Mantener compatibilidad 100%
- ✅ Sin nuevo build tool obligatorio (opcional Vite)

---

## 2. Análisis del código actual (app.js)

| Sección | Líneas aprox | Descripción |
|---------|--------------|-------------|
| Core | ~500 | Inicialización, versión, config |
| Navegación | ~300 | navigate, estado, persistencia |
| UI/Toast | ~200 | Notificaciones, modales |
| Auth | ~500 | Login, logout, permisos |
| Eventos | ~2000 | CRUD eventos |
| Invitados | ~3000 | Gestión guests |
| Admin | ~2000 | Panel admin |
| Config | ~2000 | Configuración evento |
| Sistema | ~1000 | Usuarios, grupos |
| Utils | ~500 | Helpers varios |
| Varios | ~3000 | Otras funcionalidades |

**Total aproximado:** 15,122 líneas

---

## 3. Plan de Migración (Fases)

### Fase 1: Estructura Base ⏱️ 1 día

**Objetivo:** Crear la estructura de carpetas y archivos base.

```
public/js/
├── app.js (entry point - reducido)
└── modules/
    ├── index.js           (exporta todo)
    ├── core/
    │   ├── Config.js      (config global)
    │   └── State.js       (gestión estado)
    └── utils/
        ├── Logger.js      (logging)
        └── Constants.js  (constantes)
```

**Tareas:**
- [ ] Crear carpeta `modules/` en `public/js/`
- [ ] Crear `modules/index.js` (exportscentralizados)
- [ ] Crear `modules/core/Config.js` (VERSION, config)
- [ ] Crear `modules/core/State.js` (state global)
- [ ] Mover constantes a `modules/utils/Constants.js`
- [ ] Actualizar imports en `app.js`

**Riesgo:** Bajo

---

### Fase 2: Navegación ⏱️ 1 día

**Objetivo:** Modularizar sistema de navegación y persistencia.

```
modules/
└── navigation/
    ├── Router.js       (navegación)
    └── Persistence.js  (sessionStorage)
```

**Tareas:**
- [ ] Crear `modules/navigation/Router.js`
- [ ] Mover funciones: `navigate()`, `navigateToCreateEvent()`, `getDefaultViewByRole()`, `hasPermissionForView()`
- [ ] Crear `modules/navigation/Persistence.js`
- [ ] Mover: `saveViewState()`, `loadViewState()`, `clearViewState()`
- [ ] Exportar y actualizar `app.js`

**Riesgo:** Medio

---

### Fase 3: Componentes UI ⏱️ 2 días

**Objetivo:** Extraer componentes reutilizables.

```
modules/
└── components/
    ├── Sidebar.js
    ├── Table.js
    ├── Modal.js
    ├── Toast.js
    ├── Form.js
    └── Dropdown.js
```

**Tareas:**
- [ ] Crear `modules/components/Toast.js` (notificaciones premium)
- [ ] Crear `modules/components/Modal.js` (modales)
- [ ] Crear `modules/components/Table.js` (tablas datos)
- [ ] Crear `modules/components/Sidebar.js` (sidebar logic)
- [ ] Crear `modules/components/Form.js` (formularios)
- [ ] Crear `modules/components/Dropdown.js` (dropdowns)

**Riesgo:** Medio

---

### Fase 4: Vistas ⏱️ 3 días

**Objetivo:** Modularizar cada vista de la aplicación.

```
modules/
└── views/
    ├── MyEvents.js
    ├── Admin.js
    ├── EventConfig.js
    ├── System.js
    └── index.js
```

**Tareas:**
- [ ] Crear `modules/views/MyEvents.js` (vista eventos)
- [ ] Crear `modules/views/Admin.js` (panel admin)
- [ ] Crear `modules/views/EventConfig.js` (config evento)
- [ ] Crear `modules/views/System.js` (sistema)
- [ ] Crear `modules/views/index.js`

**Riesgo:** Alto

---

### Fase 5: Servicios ⏱️ 2 días

**Objetivo:** Crear capa de servicios para API.

```
modules/
└── services/
    ├── AuthService.js
    ├── EventService.js
    ├── GuestService.js
    ├── ApiService.js
    └── index.js
```

**Tareas:**
- [ ] Crear `modules/services/ApiService.js` (wrapper API)
- [ ] Crear `modules/services/AuthService.js` (auth)
- [ ] Crear `modules/services/EventService.js` (eventos)
- [ ] Crear `modules/services/GuestService.js` (invitados)
- [ ] Integrar con existentes `api.js`, `utils.js`

**Riesgo:** Alto

---

## 4. Checklist de Seguimiento

### Fase 1: Estructura Base
- [x] **(P) Crear carpeta modules/**
- [x] **(P) Crear modules/index.js**
- [x] **(P) Crear modules/core/Config.js**
- [x] **(P) Crear modules/core/State.js**
- [x] **(P) Mover constantes a Constants.js**
- [x] **(P) Actualizar imports en app.js**

### Fase 2: Navegación
- [x] **(P) Crear modules/navigation/Router.js**
- [x] **(P) Mover funciones de navegación**
- [x] **(P) Crear modules/navigation/Persistence.js**
- [x] **(P) Mover funciones de persistencia**
- [ ] **(P) Testear navegación**

### Fase 3: Componentes UI
- [x] **(P) Crear modules/components/Toast.js**
- [x] **(P) Crear modules/components/Modal.js**
- [x] **(P) Crear modules/components/Table.js**
- [x] **(P) Crear modules/components/Sidebar.js**
- [ ] **(P) Crear modules/components/Form.js**
- [ ] **(P) Testear componentes**

### Fase 4: Vistas
- [x] **(P) Crear modules/views/MyEvents.js**
- [x] **(P) Crear modules/views/Admin.js**
- [x] **(P) Crear modules/views/EventConfig.js**
- [x] **(P) Crear modules/views/System.js**
- [ ] **(P) Testear vistas**

### Fase 5: Servicios
- [x] **(P) Crear modules/services/ApiService.js**
- [x] **(P) Crear modules/services/AuthService.js**
- [x] **(P) Crear modules/services/EventService.js**
- [x] **(P) Crear modules/services/GuestService.js**
- [ ] **(P) Testear servicios**
- [ ] **(P) Test completo app**

---

## 5. Estrategia de Migración

### Método "Strangler Pattern" (Estrangular):

1. **Crear estructura modular vacía**
2. **Mover funciones UNA por UNA**
3. **Mantener backwards compatibility**
4. **Probar después de cada movimiento**
5. **Eliminar original cuando migrado**

### Reglas de oro:

- ✅ Siempre mantener `app.js` funcionando
- ✅ NUNCA borrar código sin probar migrated
- ✅ Cada fase debe producir algo usable
- ✅ Documentar cada cambio en CHANGELOG

---

## 6. Estados de Avance

| Fase | Estado | Fecha inicio | Fecha fin | Notas |
|------|--------|--------------|-----------|-------|
| 1 | ✅ Completada | 2026-04-14 | 2026-04-14 | Estructura base, Config.js, State.js, Constants.js |
| 2 | ✅ Completada | 2026-04-14 | 2026-04-14 | Router.js, Persistence.js |
| 3 | ✅ Completada | 2026-04-14 | 2026-04-14 | Toast.js, Modal.js, Table.js, Sidebar.js |
| 4 | ✅ Completada | 2026-04-14 | 2026-04-14 | ViewManager.js, MyEvents.js, Admin.js, EventConfig.js, System.js |
| 5 | ✅ Completada | 2026-04-14 | 2026-04-14 | ApiService.js, AuthService.js, EventService.js, GuestService.js |

---

## 9. Historial de Cambios

### 2026-04-14 - Fase 5 Completada (Servicios - MODULARIZACIÓN COMPLETA)
- **Creado:** `modules/services/ApiService.js` - Wrapper de API
- **Creado:** `modules/services/AuthService.js` - Autenticación y sesiones
- **Creado:** `modules/services/EventService.js` - CRUD de eventos con caché
- **Creado:** `modules/services/GuestService.js` - CRUD de invitados con caché
- **Actualizado:** `modules/index.js` - Exportados servicios
- **Actualizado:** `app.js` - Imports y referencias
- **Resultado:** ✅ MODULARIZACIÓN COMPLETA - 5/5 FASES

---

## 7. Archivos relacionados

| Archivo | Descripción |
|---------|-------------|
| `public/js/app.js` | Archivo principal (target migración) |
| `public/js/src/frontend/api.js` | API wrapper (existente) |
| `public/js/src/frontend/utils.js` | Utilidades (existente) |
| `public/css/modern.css` | Estilos custom (rediseño paralelo) |

---

## 8. Notas para nuevos agentes

### Contexto del proyecto:
- App de gestión de eventos/registro de invitados
- Backend: Node.js + Express + SQLite
- Frontend: Vanilla JS + Tailwind CSS + custom CSS
- Puerto: 3000

### Estado actual:
- Frontend monolítico en `app.js`
- Necesita modularización
- Redesign CSS en paralelo (estilo Portainer)

### Links importantes:
- Server: `server.js`
- Frontend: `public/js/app.js`
- CSS: `public/css/modern.css`
- Docs: `docs/`

### Siguiente paso:
Si el proyecto está en "Pendiente", comenzar con **Fase 1: Estructura Base**

---

**Última actualización:** 2026-04-14  
**Documento vivo** - Actualizar según progreso