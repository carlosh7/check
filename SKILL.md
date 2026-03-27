# SKILL CHECK PRO

## Información del Proyecto

### Ubicación del Proyecto
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

### Entorno de Validación
```
C:\Users\carlo\check (git clone del repositorio)
Puerto: 3000
```

### Credenciales
- **Login:** admin@check.com / admin123
- **Puerto validación:** 3000

---

## REGLAS INQUEBRANTABLES

1. **Idioma:** Siempre responder en español
2. **Razonamiento:** Siempre explicar el pensamiento en español
3. **Versionado:** SIEMPRE incrementar versión y query strings después de cambio significativo
4. **Flujo de Trabajo:** SIEMPRE seguir el checklist completo al final de cada tarea

---

## CHECKLIST PARA CADA TAREA

Antes de comenzar:
- [ ] Leer y entender el objetivo
- [ ] Fraccionar en partes pequeñas si hay múltiples pasos
- [ ] Explicar el plan de acción en español

Durante la tarea:
- [ ] Informar progreso: qué estoy haciendo, qué completé, qué sigue

Al completar cualquier cambio de código:
- [ ] **INCREMENTAR VERSIÓN** en `package.json` (X.Y.Z)
- [ ] **ACTUALIZAR** `app-shell.html` → `?v=X.Y.Z`
- [ ] **ACTUALIZAR** `index.html` → `?v=X.Y.Z`
- [ ] **ACTUALIZAR** `script_v12_16_2.js` → `const VERSION = 'X.Y.Z'`
- [ ] **COMMIT** con mensaje descriptivo
- [ ] **PUSH** a origin main
- [ ] **PULL** en `C:\Users\carlo\check`
- [ ] **VALIDAR** con `curl -s http://localhost:3000/api/health`
- [ ] **CREAR TAG** `git tag vX.Y.Z HEAD && git push origin vX.Y.Z`
- [ ] **CONFIRMAR** qué se hizo al usuario

---

## Flujo de Trabajo (Regla de Oro)

### Pasos obligatorios después de CADA tarea:

```bash
# 1. Desde C:\Users\carlo\OneDrive\Documentos\APP\Registro
git add . && git commit -m "mensaje descriptivo" && git push origin main

# 2. Desde C:\Users\carlo\check (ENTORNO DE VALIDACIÓN)
git pull

# 3. VERIFICAR si server.js cambió
git diff --name-only HEAD~1 | grep -q server.js && echo "SERVER CAMBIÓ - REINICIAR" || echo "OK"

# 4. Si server.js cambió:
#    - Matar procesos node existentes
#    - Reiniciar servidor: node server.js

# 5. VALIDAR
curl -s http://localhost:3000/api/health

# 6. CREAR TAG
git tag v${VERSION} HEAD && git push origin v${VERSION}
```

**CRÍTICO:** Si server.js cambió y no se reinicia el servidor, el entorno de validación sigue corriendo código antiguo.

**NOTA:** En este proyecto NO hay docker-compose. Solo git pull y reinicio manual.

---

## Versionado del Proyecto (OBLIGATORIO)

La versión actual está en `package.json` campo `version` (formato: X.Y.Z)

**REGLA:** Después de CUALQUIER cambio de código significativo:

| Archivo | Qué cambiar | Ejemplo |
|---------|--------------|---------|
| `package.json` | `"version": "X.Y.Z"` | `"version": "12.16.8"` |
| `app-shell.html` | `?v=X.Y.Z` | `?v=12.16.8` |
| `index.html` | `?v=X.Y.Z` | `?v=12.16.8` |
| `script_v12_16_2.js` | `const VERSION = 'X.Y.Z'` | `const VERSION = '12.16.8'` |

**SIN este version bump, el navegador usa caché y NO ve los cambios.**

---

## Tags de Git (OBLIGATORIO)

**Cada vez que se incrementa la versión en `package.json`, DEBE crearse un tag git:**

```bash
git tag v${VERSION} HEAD
git push origin v${VERSION}
```

**VERIFICAR tags existentes ANTES de crear nuevos:**
```bash
git tag --sort=-version:refname | head -5
```

**NUNCA saltar versiones en el secuencial de tags.**

---

## Formato de Respuestas
- Respuestas cortas y directas
- Si hay múltiples problemas, enumerarlos
- Si arreglas algo, confirmar qué fue
