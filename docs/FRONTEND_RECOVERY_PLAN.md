# PLAN DE RECUPERACIÓN FRONTEND - CHECK PRO V12.2.3
## Fecha: 22/03/2026

---

## FASE 1: DIAGNÓSTICO Y ESTABILIZACIÓN (Día 1)

### 1.1 Inventario de Vistas y Funciones Rotas
- [ ] Identificar TODAS las vistas en `app-shell.html` ACTUAL
- [ ] Identificar TODAS las vistas que `script.js` llama pero NO existen
- [ ] Crear mapa de vistas existentes vs referenciadas

### 1.2 Inventario de IDs Rotos
- [ ] Comparar IDs de navegación en HTML vs JS
- [ ] `nav-btn-email-admin` → `nav-btn-smtp` (renombrado)
- [ ] Otros IDs inconsistentes

### 1.3 Scripts Temporales
- [ ] Eliminar `final-fix-script.js`
- [ ] Eliminar `unify-script.js`
- [ ] Eliminar `cleanup-app-shell.js`
- [ ] Eliminar `final-fix-v2.js`
- [ ] Eliminar `refactor-script.js` (si existe)
- [ ] Eliminar `refactor_script.ps1` (si existe)
- [ ] Eliminar `fix_ui.ps1` (si existe)

### 1.4 Backup del Estado Actual
- [ ] Crear commit con estado actual (malo pero documentado)
- [ ] Tag: `v12.2.3-broken-frontend`

---

## FASE 2: RESTAURACIÓN DE VISTAS BÁSICAS (Día 2-3)

### 2.1 Restaurar Sidebar Completo
- [ ] `nav-section-event` con:
  - Dashboard (admin)
  - Pre-inscripciones
  - Encuesta QR
  - Mailing
  - Cargar Excel/PDF
  - Eliminar evento
- [ ] Mantener el diseño nuevo del sidebar

### 2.2 Restaurar Vistas Principales
- [ ] `view-my-events` - Selector de eventos
- [ ] `view-admin` - Dashboard principal del evento
- [ ] `view-pre-registrations` - Pre-inscripciones
- [ ] `view-survey-manager` - Encuesta QR
- [ ] `view-system` - Gestión de usuarios
- [ ] `view-groups` - Empresas
- [ ] `view-legal` - Legales
- [ ] `view-account` - Mi cuenta
- [ ] `view-smtp` - Email admin

### 2.3 Verificar Navegación
- [ ] `App.navigate()` funciona para todas las vistas
- [ ] `App.navigateEmailSection()` para sub-vistas de email
- [ ] Botones del sidebar actualizan correctamente

---

## FASE 3: LIMPIEZA Y DISEÑO (Día 4-5)

### 3.1 Código Muerto
- [ ] Eliminar funciones duplicadas en script.js
- [ ] Eliminar vistas duplicadas en app-shell.html (si hay)
- [ ] Limpiar CSS no utilizado

### 3.2 Diseño Consistente
- [ ] Verificar que todas las vistas usan las mismas clases CSS
- [ ] Consistencia en: botones, cards, inputs, tablas
- [ ] Tema oscuro funciona en todas las vistas

### 3.3 UX/UI
- [ ] Animaciones de transición entre vistas
- [ ] Estados de loading
- [ ] Mensajes de error claros
- [ ] Responsive en móviles

---

## FASE 4: VALIDACIÓN Y TESTING (Día 6-7)

### 4.1 Pruebas Funcionales
- [ ] Login/logout
- [ ] Crear evento
- [ ] Importar Excel
- [ ] Check-in de invitado
- [ ] Ver QR
- [ ] Pre-inscripciones
- [ ] Encuesta QR
- [ ] Email config
- [ ] Exportar PDF/Excel

### 4.2 Git y Versionado
- [ ] Commit con cambios completos
- [ ] Tag: `v12.2.4`
- [ ] Push a origin/main
- [ ] Pull en terminal local
- [ ] Verificar en localhost:3000

---

## REGLAS DE ORO (OBLIGATORIAS)

### Antes de cada commit:
1. `git add .`
2. `git commit -m "mensaje descriptivo"`
3. `git push origin main`
4. `git pull origin main`
5. Reiniciar servidor
6. Probar en navegador (Ctrl+F5)

### No romper el ciclo:
- Si algo se rompe → investigar Y CORREGIR antes de continuar
- Si hay errores en consola → CORREGIR antes de continuar
- Si los tests fallan → CORREGIR antes de continuar

---

## MÉTRICAS DE ÉXITO

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas app-shell.html | ~400 (roto) | ~1200-1500 |
| Vistas funcionales | ~3 | ~10+ |
| Tests passing | 26/26 ✅ | 26/26 ✅ |
| Errores en consola | Muchos | 0 |

---

## COMANDOS RÁPIDOS

```bash
# Servidor
node server.js

# Tests
npm test

# Git (sigue la Regla de Oro)
git add . && git commit -m "mensaje" && git push origin main
git pull origin main
```

---

**Última actualización**: 22/03/2026
**Estado**: 🚧 FASE 1 - DIAGNÓSTICO
