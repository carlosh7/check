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

### 🐳 Instalación con Docker (Recomendada)

Para una instalación completamente automática con Docker:

```bash
# 1. Clonar repositorio
git clone https://github.com/carlosh7/check.git
cd check

# 2. Construir y ejecutar
docker-compose up --build
```

El contenedor Docker hará todo automáticamente:
- ✅ Construirá la imagen con todas las dependencias
- ✅ Creará archivo `.env` si no existe
- ✅ Inicializará la base de datos automáticamente
- ✅ Creará usuario admin por defecto
- ✅ Iniciará el servidor en http://localhost:3000

**Credenciales por defecto:**
- **URL:** http://localhost:3000
- **Usuario:** admin@check.com
- **Contraseña:** admin123

Para más detalles, consulta [DOCKER_INSTALL.md](DOCKER_INSTALL.md).

### 🚀 Auto-Deploy con Webhooks

Cada vez que hagas `git push` al repositorio, la app se redeploya sola en Portainer.
Sigue estos pasos en orden. Si algo no entiendes, pregunta a tu administrador.

---

#### Paso 1: Revisa el archivo `.env`

**¿Qué es `.env`?** Es un archivo de texto donde se guardan configuraciones secretas
de la app (contraseñas, claves, URLs). Está en la carpeta raíz del proyecto.

**¿Dónde está?** En la misma carpeta donde están los archivos `server.js` y `package.json`.
Si ves archivos como `database.js`, `index.html`, `README.md`, el `.env` está ahí.

**¿Cómo lo abro?**

- **En Windows:**
  1. Abre el explorador de archivos
  2. Navega hasta la carpeta del proyecto
  3. Busca un archivo llamado `.env` (arranca con un punto)
     - Si no lo ves: haz clic en **Ver** (arriba) → marca la casilla **Elementos ocultos**
  4. Haz clic derecho sobre el archivo `.env` → **Abrir con** → **Bloc de notas**

- **En Linux o Mac:**
  1. Abre la terminal
  2. Escribe el siguiente comando y presiona Enter:
     ```bash
     nano .env
     ```

**¿Qué busco adentro?** Dentro del archivo busca una línea que diga:

```
DEPLOY_WEBHOOK_SECRET=...
```

Si ves esa línea, el secreto ya está generado. **No lo modifiques.**
Más abajo también verás:

```
# PORTAINER_WEBHOOK_URL=https://...
```

Esa línea empieza con `#` (está "comentada", la app no la lee). La vamos a activar en el Paso 3.

---

#### Paso 2: Activa el webhook en Portainer

**¿Qué es Portainer?** Es una aplicación web que administra los contenedores de tu servidor.
Normalmente se accede desde el navegador escribiendo una dirección como `https://tuservidor:9443`
(tu administrador te dará la dirección exacta).

1. Abre tu navegador (Chrome, Edge, Firefox, etc.)
2. Escribe la dirección de Portainer en la barra de direcciones (pregunta a tu administrador)
3. Inicia sesión con usuario y contraseña (si no los tienes, pídelos)
4. En el menú de la izquierda, haz clic en **Stacks**
5. Busca en la lista el stack de esta app (pregunta el nombre a tu administrador)
6. Haz clic en el nombre del stack para ver sus detalles
7. Desplázate hacia abajo con la rueda del mouse hasta ver una sección que dice **Webhook**
8. Haz clic en el botón **Enable**
9. Aparecerá una URL larga parecida a esta:
   ```
   https://tuservidor:9443/api/stacks/webhooks/abc123-456-def-789
   ```
10. **Copia esa URL completa** (la necesitas en el siguiente paso)
    - Selecciona toda la URL con el mouse
    - Presiona Ctrl+C (o clic derecho → Copiar)

---

#### Paso 3: Agrega la URL de Portainer al `.env`

1. Vuelve a abrir el archivo `.env` (igual que en el Paso 1)
2. Busca la línea que empieza con `# PORTAINER_WEBHOOK_URL=`
3. Borra el símbolo `#` (almohadilla) del inicio de esa línea
   - Así: `# PORTAINER_WEBHOOK_URL=https://...` → `PORTAINER_WEBHOOK_URL=https://...`
4. Reemplaza la URL de ejemplo con la URL que copiaste en el Paso 2
   - Borra `https://tuservidor:9443/api/stacks/webhooks/ID_WEBHOOK` y pega la tuya (Ctrl+V)
5. Guarda los cambios:
   - **Bloc de notas:** Ctrl+G (o Archivo → Guardar)
   - **nano:** Ctrl+O, luego Enter, luego Ctrl+X para salir
6. Debe verse así (con tu URL real):
   ```
   PORTAINER_WEBHOOK_URL=https://tuservidor:9443/api/stacks/webhooks/abc123-456-def-789
   ```

---

#### Paso 4: Configura el webhook en GitHub

GitHub necesita saber a qué dirección avisar cuando hagas push. Vamos a decírselo.

1. Abre tu navegador y ve a tu repositorio en GitHub (`https://github.com/tu-usuario/tu-repositorio`)
2. Haz clic en la pestaña **Settings** (arriba a la derecha, al lado de "Insights")
3. En el menú de la izquierda, haz clic en **Webhooks** (está en la sección "Code and automation")
4. Haz clic en el botón verde **Add webhook**
5. Completa el formulario con estos datos:

   | Campo | Qué poner |
   |-------|-----------|
   | **Payload URL** | `https://tudominio.com/api/deploy/webhook` (reemplaza `tudominio.com` con la URL real de tu app) |
   | **Content type** | Selecciona `application/json` |
   | **Secret** | Copia el valor de `DEPLOY_WEBHOOK_SECRET` que está en tu `.env` (el texto largo después del `=`) |
   | **SSL verification** | Deja marcado "Enable SSL verification" |
   | **Which events** | Selecciona **"Just the push event"** (la segunda opción) |
   | **Active** | Debe estar marcado (lo está por defecto) |

   > ⚠️ **Importante:** El "Secret" debe ser **exactamente igual** al que está en tu `.env`.
   > Abre el `.env`, selecciona el texto después del `=` en la línea `DEPLOY_WEBHOOK_SECRET=...`,
   > cópialo (Ctrl+C) y pégalo en el campo "Secret" de GitHub (Ctrl+V).

6. Haz clic en el botón verde **Add webhook** (al final del formulario)

---

#### Paso 5: Prueba que funciona

Vamos a simular un cambio y verificar que todo el proceso funcione.

1. Abre el archivo `README.md` (este mismo archivo) con un editor de texto
2. Agrega un espacio o una línea en blanco al final (no importa qué cambio, solo queremos activar el proceso)
3. Guarda el archivo
4. Abre la terminal (o símbolo del sistema en Windows)
5. Navega hasta la carpeta del proyecto escribiendo:
   ```bash
   cd ruta/del/proyecto
   ```
   (reemplaza `ruta/del/proyecto` con la ubicación real de tu proyecto)
6. Ejecuta estos comandos uno por uno:
   ```bash
   git add .
   git commit -m "prueba auto-deploy"
   git push
   ```
7. Ve a GitHub: **Settings** → **Webhooks** → haz clic en el webhook que creaste
8. Deberías ver un **checkmark verde (✅)** en la lista de entregas (Recent Deliveries)
9. En Portainer, abre el stack de la app y verás que se está redeployando solo
10. Espera unos segundos (30-60) y la app estará actualizada con tus cambios

---

#### Paso 6: Revisa los logs si algo falla

Si el auto-deploy no funciona, revisa el historial de intentos:

1. Abre la terminal
2. Ejecuta:
   ```bash
   curl https://tudominio.com/api/deploy/logs
   ```
   (reemplaza `tudominio.com` con tu dominio real)

Esto mostrará una lista con cada intento de deploy. Cada intento tiene un estado:

| Estado | Significado |
|--------|-------------|
| `received` | Llegó el aviso, se está procesando |
| `skipped` | El push no fue a la rama principal (main/master) |
| `deploying` | Se llamó a Portainer correctamente |
| `error` | Algo falló (revisa el mensaje de error) |

---

**Resumen final:** Una vez seguidos estos 6 pasos, tu flujo diario será solo:
```bash
git add .
git commit -m "descripción del cambio"
git push
```

Y la app se actualiza sola. Ya no necesitas abrir Portainer para redeployar.

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
