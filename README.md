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

### 🚀 Instalación Automática (Recomendada)

Para una instalación completamente automática, simplemente:

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/carlosh7/check.git
   cd check
   ```

2. **Ejecuta el script de configuración:**
   - **Windows:** Haz doble clic en `setup.bat`
   - **Linux/Mac:** Ejecuta `node setup.js`

El script automático hará todo por ti:
- ✅ Verificará que Node.js esté instalado
- ✅ Creará el archivo `.env` si no existe
- ✅ Instalará todas las dependencias
- ✅ Inicializará la base de datos
- ✅ Creará el usuario admin por defecto
- ✅ Iniciará el servidor automáticamente

### 🔧 Instalación Manual

Si prefieres hacerlo manualmente:

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

## 🐛 Solución de Problemas Comunes

### Error 400 al acceder a `/api/events`
**Síntoma:** Después del login, la aplicación muestra error 400 al intentar cargar eventos.

**Causas posibles:**
1. Base de datos no inicializada
2. Usuario admin no creado
3. Problemas de autenticación JWT

**Solución:**
1. Detén el servidor (Ctrl+C)
2. Ejecuta el script de configuración automática:
   - Windows: `setup.bat`
   - Linux/Mac: `node setup.js`
3. El script reinicializará todo automáticamente

### Error "Cannot find module"
**Solución:**
```bash
npm install
```

### Error de puerto en uso
**Solución:**
```bash
# Cambia el puerto en .env
PORT=3001
```

### Problemas con la base de datos
**Solución:**
1. Elimina el archivo `data/check_app.db`
2. Ejecuta `node setup.js` para recrear la base de datos

## 📞 Soporte

Si encuentras problemas:
1. Revisa la sección de solución de problemas arriba
2. Ejecuta el script de configuración automática
3. Si persiste el problema, crea un issue en GitHub
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
