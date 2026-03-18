---
description: Sincronización y Validación Automática (Regla de Oro) v10.5
---
// turbo-all
Este workflow automatiza la Regla de Oro de Check para asegurar que cada versión esté en GitHub y validada localmente.

1. Añadir cambios al área de preparación:
`git add .`

2. Crear un commit con la versión y descripción:
`git commit -m "v10.5.3 - Fix: Duplicate IDs in menu navigation"`

3. Crear tag de versión:
`git tag -a v10.5.3 -m "Check Pro v10.5.3 - Menu buttons fix"`

4. Subir cambios y tags a la rama principal:
`git push origin main --tags`

5. Actualizar la terminal local:
`git pull origin main`

6. Reiniciar el proceso del servidor (específico):
`taskkill /F /IM node.exe` (o usa el PID específico si lo conoces)
