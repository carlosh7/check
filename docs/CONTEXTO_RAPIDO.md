# CONTEXTO RÁPIDO - Check Pro

## Estado actual: Modularización Frontend (Planificado)

### Información clave
- **App:** Check Pro - Gestión de eventos/registro de invitados
- **Puerto:** 3000
- **Login:** admin@check.com / admin123

### Stack tecnológico
- **Backend:** Node.js + Express + SQLite
- **Frontend:** Vanilla JS (monolítico) + Tailwind CSS + custom CSS
- **UI:** Dark mode, glassmorphism

### Problema identificado
Frontend en `public/js/app.js` (~15k líneas) es **monolítico**. Necesita modularización.

### Plan activo
Ver `docs/PLAN_MODULARIZACION_FRONTEND.md` para detalles completos.

### Fases:
1. ✅ Completada (2026-04-14) - Estructura modules/, Config.js, State.js, Constants.js
2. ✅ Completada (2026-04-14) - Router.js, Persistence.js
3. ✅ Completada (2026-04-14) - Toast.js, Modal.js, Table.js, Sidebar.js
4. ✅ Completada (2026-04-14) - ViewManager.js, MyEvents.js, Admin.js, EventConfig.js, System.js
5. ✅ Completada (2026-04-14) - ApiService.js, AuthService.js, EventService.js, GuestService.js

### Estado: MODULARIZACIÓN COMPLETA ✅ (20 módulos)

### Módulos disponibles en App:
- `App.router` - Navegación
- `App.persistence` - Persistencia
- `App.toast` - Notificaciones
- `App.modal` - Modales
- `App.table` - Tablas
- `App.sidebar` - Sidebar
- `App.form` - Formularios
- `App.dropdown` - Dropdowns
- `App.views` - Gestor de vistas
- `App.api` - API wrapper
- `App.auth` - Autenticación
- `App.events` - Eventos
- `App.guests` - Invitados

### Listo para probar

### Notas adicionales
- Redesign CSS (estilo Portainer) en paralelo
- NO usar AngularJS + React (descartado)
- Mantener Vanilla JS

---

**Último update:** 2026-04-14