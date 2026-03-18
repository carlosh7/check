# Reglas de Desarrollo del Proyecto "Check"

Para asegurar la estabilidad y sincronización del proyecto, se deben seguir las siguientes reglas obligatorias en cada intervención:

1.  **Sincronización de GitHub**: Después de realizar cualquier cambio en el código (backend, frontend o base de datos), se debe realizar un `git commit` descriptivo y un `git push` a la rama principal (`main`), acompañado de un nuevo tag de versión si es un hito importante.
2.  **Validación en Vivo**: Antes de dar por terminada una tarea, se debe validar la funcionalidad en `http://localhost:3000/` o en el entorno de despliegue activo, verificando que no haya errores en la consola del navegador ni en los logs del servidor.
3.  **Comunicación**: Todas las explicaciones y documentación deben ser en **español**, siguiendo las instrucciones globales del usuario.
4.  **Persistencia de Datos**: Cualquier cambio en el esquema de la base de datos debe incluir lógica de auto-migración en `database.js` para evitar pérdida de datos o fallos en instalaciones existentes.

*Estas reglas han sido establecidas a solicitud del usuario en la versión v4.9.* 破
