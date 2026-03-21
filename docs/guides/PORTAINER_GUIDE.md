# Guía de Despliegue con Portainer 🚢

Para desplegar la **Check App** en Portainer de forma profesional, utilizaremos la función de **Stacks** (Docker Compose).

## Configuración de Portainer

1.  Copia el contenido del archivo `portainer-stack.yml` de este repositorio.
2.  En **Portainer**, ve a **Stacks** -> **Add stack**.
3.  Selecciona el **Web editor** y pega el contenido.
4.  Despliega la stack.

Alternativamente, usa el método de **Repository** apuntando a `https://github.com/carlosh7/check.git` y usa el archivo `docker-compose.yml` base.
