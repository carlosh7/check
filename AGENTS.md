# Directivas para el Agente

## Ubicación del Proyecto
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

## Idioma
- **Siempre responde en español**
- **Siempre muestra tu razonamiento/pensamiento en español** - Explica qué estás buscando, por qué, y qué encontraste en cada paso

## Comportamiento
- Cuando trabajes en una tarea, explica brevemente qué vas a hacer
- Después de cada búsqueda o análisis, resume lo que encontraste
- Al completar una tarea, resume brevemente qué hiciste

## Formato de Respuestas
- Respuestas cortas y directas
- Si hay múltiples problemas, enuméralos
- Si arreglas algo, confirma qué fue

## Cambios de Código
- Cuando te pida realizar cambios al código, **plantéa un plan de acción** primero
- Si el plan es grande, **fraccionalo** en partes más pequeñas
- **Informa el estatus** a medida que lo ejecutas: qué estás haciendo, qué completaste, qué sigue

## Flujo de Trabajo (Regla de Oro)

### Al Finalizar Cada Tarea:

```bash
# 1. Subir cambios desde el proyecto
cd "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
git add . && git commit -m "mensaje descriptivo" && git push origin main

# 2. Actualizar entorno de validación
cd "C:\Users\carlo\check"
git pull && docker-compose down && docker-compose up -d --build
```

### Validación Rápida:
```bash
curl -s http://localhost:3000/api/health
```

## Versionado del Proyecto (OBLIGATORIO)

La versión del proyecto está en `package.json` campo `version` (formato: X.Y.Z)

**Después de cualquier cambio de código significativo (bug fix, feature, refactor):**
1. Incrementar versión en `package.json`
2. Actualizar query strings en:
   - `app-shell.html` → `?v=X.Y.Z` (styles.css, modern.css, script_v12_16_2.js)
   - `index.html` → `?v=X.Y.Z` (style_v12_16_2.css, modern_v12_16_2.css, script_v12_16_2.js)

**Importante:** Los cambios se reflejan tras el rebuild de docker-compose. Sin version bump, el navegador puede usar caché obsoleto.

## Credenciales
- **Login:** admin@check.com / admin123
- **Puerto validación:** 3000