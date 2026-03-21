# Check Pro | Sistema de Gestión de Eventos

Una aplicación web moderna y elegante para la gestión y registro de invitados en eventos. Diseñada con un enfoque en la estética premium y la facilidad de uso.

## ✨ Características

- **Diseño Premium**: Interfaz moderna con efectos de glassmorphism y animaciones sutiles.
- **Modo Oscuro/Claro**: Soporte completo para temas visuales.
- **Importación de Datos**: Capacidad para importar listas de invitados desde archivos Excel (.xlsx, .xls) y CSV.
- **Contenedorizado**: Listo para ser desplegado con Docker.
- **Responsive**: Totalmente adaptable a dispositivos móviles y escritorio.
- **Seguridad**: Contraseñas hasheadas con bcrypt, CORS configurable, rate limiting.

## 🚀 Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **Base de datos**: SQLite (better-sqlite3)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Tiempo real**: Socket.io
- **Procesamiento Excel**: ExcelJS
- **Generación QR**: qrcode
- **Seguridad**: bcryptjs, helmet, express-rate-limit
- **Docker & Docker Compose**

## 🛠️ Cómo Ejecutar

### Opción 1: Node.js Directo

```bash
# Clonar repositorio
git clone https://github.com/carlosh7/check.git
cd check

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Iniciar servidor
npm start
```

### Opción 2: Docker

```bash
# Clonar repositorio
git clone https://github.com/carlosh7/check.git
cd check

# Ejecutar con Docker Compose
docker-compose up -d --build
```

### Acceso

Abre tu navegador en: `http://localhost:3000`

## 🔐 Seguridad

### Configuración de Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
PORT=3000
JWT_SECRET=genera_una_clave_unica
ALLOWED_ORIGINS=http://localhost:3000
```

### Credenciales de Administrador

> [!WARNING]
> **CAMBIAR LA CONTRASEÑA INMEDIATAMENTE DESPUÉS DEL PRIMER LOGIN**

Por defecto se crea un usuario administrador. Las credenciales iniciales están en `.env.example` (configuradas durante la instalación).

Para cambiar la contraseña:
1. Inicia sesión como administrador
2. Ve a Configuración > Mi Cuenta
3. Cambia la contraseña

## 📁 Estructura del Proyecto

```
├── index.html          # Página principal (login)
├── app-shell.html      # Aplicación principal (SPA)
├── registro.html       # Página de registro público
├── survey.html         # Página de encuestas QR
├── script.js          # Lógica de la aplicación
├── style.css          # Estilos
├── server.js          # Servidor Express (API)
├── database.js        # Esquema y operaciones de BD
├── sw.js              # Service Worker (PWA)
├── docs/              # Documentación
│   ├── AUDITORIA_*.md # Informe de auditoría
│   ├── CHANGELOG_*.md # Registro de cambios
│   └── EJECUCION_*.md # Plan de ejecución
├── scripts/           # Scripts auxiliares
│   └── migrate_passwords.js # Migración de contraseñas
├── .env.example       # Plantilla de configuración
├── .gitignore         # Archivos ignorados
├── package.json       # Dependencias
└── docker-compose.yml # Orquestación Docker
```

## 🔄 Migración de Contraseñas

Si necesitas migrar contraseñas legacy a bcrypt:

```bash
node scripts/migrate_passwords.js
```

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

Desarrollado con ❤️ para la gestión de eventos de alto nivel.
