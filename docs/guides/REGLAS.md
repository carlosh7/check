# Reglas de Desarrollo del Proyecto "Check"

Para asegurar la estabilidad y sincronización del proyecto, se deben seguir las siguientes reglas obligatorias en cada intervención:

## 🏆 La Regla de Oro (Sincronización Total)
En **cada cambio o versión**, se debe seguir estrictamente este orden:
1.  **Actualizar GitHub**: Realizar `git add`, `git commit` y `git push` (con tags si aplica).
2.  **Validar Sincronización**: Verificar que los cambios en el repositorio remoto (`origin/main`) coincidan con lo esperado.
3.  **Actualizar Terminal**: Ejecutar `git pull` en la terminal de trabajo para asegurar que el código local esté refrescado.
4.  **Verificación Final**: Reiniciar el servidor (`server.js`) y validar en `http://localhost:3000/` (usando `Ctrl + F5` en el navegador).

## 📋 Reglas Generales
1.  **Comunicación**: Todas las explicaciones y documentación deben ser en **español**.
2.  **Persistencia de Datos**: Cualquier cambio en el esquema debe ser manejado en `database.js` evitando la pérdida de información.
3.  **Implementación**: Los planes de trabajo (`implementation_plan.md`) **DEBEN** incluir una sección obligatoria de "Sincronización y Validación GitHub".

*Estas reglas son de cumplimiento obligatorio y han sido institucionalizadas en la versión v5.0.* 破
