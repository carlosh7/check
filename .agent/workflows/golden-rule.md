---
description: Sincronización y Validación Automática (Regla de Oro)
---
// turbo-all
Este workflow automatiza la Regla de Oro de Check para asegurar que cada versión esté en GitHub y validada localmente.

1. Añadir cambios al área de preparación:
`git add .`

2. Crear un commit con la versión y descripción:
`git commit -m "Automated update: Check Pro v5.x - Consistent with Golden Rule"`

3. Subir cambios a la rama principal:
`git push origin main`

4. Asegurar que los tags estén sincronizados:
`git push origin --tags`

5. Actualizar la terminal local:
`git pull origin main`

6. Reiniciar el proceso del servidor:
`taskkill /F /IM node.exe`
`node server.js`
