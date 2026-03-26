# Directivas para el Agente

## COMPROMISO DEL AGENTE (LEER PRIMERO)

**Yo, como agente de IA, me comprometo a seguir TODAS estas reglas sin excepción. Si violo alguna, el usuario tiene derecho a reclamarme.**

### Reglas Inquebrantables:

1. **Idioma:** Siempre respondo en español
2. **Razonamiento:** Siempre explico mi pensamiento en español (qué busco, por qué, qué encontré)
3. **Versionado:** SIEMPRE incrementamos versión y query strings después de cambio significativo
4. **Flujo de Trabajo:** SIEMPRE sigo el checklist completo al final de cada tarea

---

## Ubicación del Proyecto
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

---

## CHECKLIST PARA CADA TAREA

Antes de comenzar cualquier tarea:
- [ ] Leer y entender el objetivo
- [ ] Si hay múltiples pasos, fraccionarlos en partes pequeñas
- [ ] Explicar el plan de acción en español

Durante la tarea:
- [ ] Informar progreso: qué estoy haciendo, qué completé, qué sigue

Al completar cualquier cambio de código:
- [ ] **INCREMENTAR VERSIÓN** en `package.json` (X.Y.Z)
- [ ] **ACTUALIZAR** `app-shell.html` → `?v=X.Y.Z`
- [ ] **ACTUALIZAR** `index.html` → `?v=X.Y.Z`
- [ ] **COMMIT** con mensaje descriptivo
- [ ] **PUSH** a origin main
- [ ] **PULL** en `C:\Users\carlo\check`
- [ ] **VALIDAR** con `curl -s http://localhost:3000/api/health`
- [ ] **CONFIRMAR** qué se hizo al usuario

---

## Flujo de Trabajo (Regla de Oro)

### Pasos obligatorios después de CADA tarea:

```bash
# 1. desde C:\Users\carlo\OneDrive\Documentos\APP\Registro
git add . && git commit -m "mensaje descriptivo" && git push origin main

# 2. desde C:\Users\carlo\check (ENTORNO DE VALIDACIÓN)
git pull

# 3. VALIDAR
curl -s http://localhost:3000/api/health
```

**NOTA:** En este proyecto NO hay docker-compose. Solo git pull.

---

## Versionado del Proyecto (OBLIGATORIO)

La versión actual está en `package.json` campo `version` (formato: X.Y.Z)

**REGLA:** Después de CUALQUIER cambio de código significativo (bug fix, feature, refactor, cleanup):

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

**Ejemplo:** Si la versión sube a 12.18.1:
```bash
git tag v12.18.1
git push origin v12.18.1
```

**VERIFICAR tags existentes ANTES de crear nuevos:**
```bash
git tag --sort=-version:refname | head -5
```

**NUNCA saltar versiones en el sequencial de tags.**

---

## Formato de Respuestas
- Respuestas cortas y directas
- Si hay múltiples problemas, enumerarlos
- Si arreglas algo, confirmar qué fue

---

## Credenciales
- **Login:** admin@check.com / admin123
- **Puerto validación:** 3000

---

## Nota sobre Entorno de Validación

El código se valida en `C:\Users\carlo\check` (git clone del repositorio).
El servidor Node corre en puerto 3000.
No hay Docker en este proyecto.
