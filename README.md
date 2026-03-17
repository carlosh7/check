# Check | Registro de Invitados

Una aplicación web moderna y elegante para la gestión y registro de invitados en eventos. Diseñada con un enfoque en la estética premium y la facilidad de uso.

## ✨ Características

- **Diseño Premium**: Interfaz moderna con efectos de glassmorphism y animaciones sutiles.
- **Modo Oscuro/Claro**: Soporte completo para temas visuales.
- **Importación de Datos**: Capacidad para importar listas de invitados desde archivos Excel (.xlsx, .xls) y CSV.
- **Contenedorizado**: Listo para ser desplegado con Docker.
- **Responsive**: Totalmente adaptable a dispositivos móviles y escritorio.

## 🚀 Tecnologías Utilizadas

- **HTML5 & CSS3** (Vanilla CSS)
- **JavaScript** (ES6+)
- **SheetJS** (Para procesamiento de Excel)
- **Docker & Docker Compose**

## 🛠️ Cómo Ejecutar

### Requisitos Previos

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Pasos para el despliegue

1. Clona el repositorio:
   ```bash
   git clone https://github.com/carlosh7/check.git
   cd check
   ```

2. Ejecuta la aplicación con Docker Compose:
   ```bash
   docker-compose up -d --build
   ```

3. Accede a la aplicación en:
   `http://localhost:3000`

## 📁 Estructura del Proyecto

- `index.html`: Estructura principal de la aplicación.
- `style.css`: Estilos y sistema de diseño.
- `script.js`: Lógica de navegación, temas e importación.
- `Dockerfile`: Configuración de la imagen de Nginx.
- `docker-compose.yml`: Orquestación del contenedor.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---
Desarrollado con ❤️ para la gestión de eventos de alto nivel.
