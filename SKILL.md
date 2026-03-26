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


# PROYECTO CHECK PRO

## Ubicación
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

## Flujo de Trabajo

1. **Editas código** → `C:\Users\carlo\OneDrive\Documentos\APP\Registro`
2. **Subes cambios:** `git add .` → `git commit -m "mensaje"` → `git push origin main`
3. **Validas en:** `C:\Users\carlo\check` → `git pull` → http://localhost:3000

## Al Finalizar Cada Tarea (Regla de Oro)

```bash
# 1. Subir cambios
cd "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
git add . && git commit -m "mensaje" && git push origin main

# 2. Actualizar entorno de validación
cd "C:\Users\carlo\check"
git pull && docker-compose down && docker-compose up -d --build
```

## Validación Rápida
```bash
curl -s http://localhost:3000/api/health
```

## Versionado (OBLIGATORIO)

Después de cualquier cambio de código significativo (bug fix, feature, refactorización):

1. Actualizar `package.json` campo `version` (formato: X.Y.Z)
2. Actualizar `app-shell.html` → `?v=X.Y.Z` en etiquetas de CSS/JS
3. Actualizar `index.html` → `?v=X.Y.Z` en etiquetas de CSS/JS

**Ejemplo:** 12.16.6 → 12.16.7

## Credenciales
- **Login:** admin@check.com / admin123
- **Puerto:** 3000
