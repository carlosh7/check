# Plan de Migración Check Pro

## Estado Actual

### app.js (Legacy)
- **~15200 líneas**
- **~800+ funciones**
- Código monolítico original

### Módulos Existentes (~3300 líneas)
Los siguientes módulos ya están creados y se importan:

| Módulo | Líneas | Estado |
|--------|-------|--------|
| Toast.js | 130 | ✅ Implementado |
| Router.js | 134 | ✅ Funcional |
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

## Enfoque de Migración

### Opción A: Gran Migración (todo a la vez)
- Ventaja: Código limpio al final
- Desventaja: Riesgo alto de romper todo
- Tiempo: several días

### Opción B: Migración Gradual (función por función)
- Mantener app.js funcionando
- Gradually migrar funciones usadas frecuentemente
- Validar cada migración
- Riesgo bajo
- Tiempo: 1-2 semanas

### Opción C: Mantener Híbrido (estado actual)
- Módulos como abstracción
- Llamar a funciones legacy
- Solo agregar nuevas features
- Sin migración real del código legacy

## Recomendación

**Opción B** - Migración gradual por función:

1. **Funciones críticas** (primero):
   - showView() - navegación
   - renderEventsTable() - tabla eventos
   - loadEvents() - cargar eventos

2. **Funciones de uso frecuente** (segundo):
   - filterEvents(), buscar eventos
   - loadGuests(), cargar invitados
   - saveEvent(), guardar evento

3. **Funciones de utilidad** (tercero):
   - modal handlers
   - export/import
   - utilerías

4. **Resto** (último):
   - Funciones específicas por vista
   - Código no usado

## Acciones de cada migración

1. Identificar función a migrar en app.js
2. Implementar en módulo correspondiente
3. Replace llamada en app.js
4. Testear funcionalidad
5. Si OK → remove código legacy duplicado

## Progreso

| Función | Módulo Destino | Estado |
|---------|----------------|--------|
| _notifyAction | Toast.js | ✅ Completado |
| showView | Router.js | ⚠️ Parcial |
| renderEventsTable | Table.js | ⚠️ Parcial |
| showPremiumToast | Toast.js | ✅ Completado |