# Directivas para el Agente

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

## Versionado del Proyecto
- La versión del proyecto está en `package.json` campo `version` (formato: X.Y.Z)
- **Cada cambio significativo debe actualizar la versión** siguiendo semver:
  - **PATCH (Z)**: Bug fixes menores, cambios pequeños
  - **MINOR (Y)**: Nuevas funcionalidades, mejoras
  - **MAJOR (X)**: Cambios que rompen compatibilidad
- **Archivos a actualizar con cada version bump:**
  - `package.json` - versión
  - `app-shell.html` - en etiquetas de CSS/JS (styles.css?v=X, modern.css?v=X, script_v12_16_2.js?v=X)
  - `index.html` - si tiene referencias de versión
- **Al hacer commit**, incluir el cambio de versión en el mensaje
- **Antes de finalizar**, ejecutar: `git add . && git commit -m "vX.Y.Z: descripción"`
