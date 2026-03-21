# PLAN DE EJECUCIÓN - AUDITORÍA CHECK PRO
**Inicio:** 21/03/2026
**Estado:** POR INICIAR

---

## CÓMO USAR ESTE DOCUMENTO

Cada fase requiere:
1. **Leer** los pasos
2. **Ejecutar** lo que indica
3. **Verificar** que funciona
4. **Aprobar** o **reportar problema**
5. **Avanzar** a la siguiente fase

---

# FASE 0: PREPARACIÓN Y RESPALDO
**Complejidad:** ⭐ Muy baja
**Tiempo estimado:** 10 minutos
**Riesgo:** NINGUNO

## Pasos:

### 0.1 Hacer backup del proyecto
```bash
# En la carpeta del proyecto
cp -r . ../check_BACKUP_$(date +%Y%m%d_%H%M%S)
```
✅ Carpeta `_BACKUP_` creada

### 0.2 Verificar que no hay archivos sensibles en staging
```bash
git status
```
✅ Solo archivos del proyecto

### 0.3 Crear archivo de notas de cambios
Crear `docs/CHANGELOG_AUDITORIA.md` con:
```markdown
# Changelog de Auditoría
## 21/03/2026 - Inicio de auditoría

### Fase 0: Preparación
- Estado: [PENDIENTE/APROBADO/PROBLEMA]
- Notas:
```

---

## VERIFICACIÓN FASE 0:
- [ ] Backup creado
- [ ] git status limpio
- [ ] Archivo CHANGELOG creado

**¿Todo listo? Escribe "APROBAR FASE 0" para continuar.**

---

# FASE 1: LIMPIEZA DE REPOSITORIO
**Complejidad:** ⭐⭐ Baja
**Tiempo estimado:** 15 minutos
**Riesgo:** BAJO

## Objetivo:
Hacer el repositorio más seguro y profesional

## Pasos:

### 1.1 Actualizar .gitignore

Abrir `.gitignore` y reemplazar TODO el contenido con:

```gitignore
# Windows
[Dd]esktop.ini
Thumbs.db
$RECYCLE.BIN/
*.lnk

# VS Code
.vscode/
*.code-workspace
.history/

# Docker
docker-compose.override.yml

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Archivos de datos y configuración
*.xlsx
*.xls
*.csv
uploads/

# SQLite (INCLUYENDO WAL y SHM)
check_app.db
check_app.db-journal
check_app.db-shm
check_app.db-wal

# Variables de entorno (CRÍTICO)
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
```

### 1.2 Crear .env.example

Crear archivo `.env.example` en la raíz:

```env
# Puerto del servidor
PORT=3000

# Clave JWT (generar con: openssl rand -hex 32)
JWT_SECRET=tu_clave_aqui

# Base de datos (para futuro PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=check_production
DB_USER=check_user
DB_PASSWORD=tu_password_aqui

# SMTP (para envío de emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASS=tu_password
SMTP_SECURE=false

# URL de la aplicación
APP_URL=http://localhost:3000

# Admin inicial (cambiar después de instalar)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123
```

### 1.3 Crear .gitignore.local (opcional)

```gitignore
# Este archivo .gitignore.local NUNCA se commitea
# Úsalo para pruebas locales
.env
```

### 1.4 Remover archivos problemáticos del tracking (si existen)

```bash
# SI ya hay archivos .db-shm o .db-wal en git:
git rm --cached check_app.db-shm check_app.db-wal 2>/dev/null || echo "No estaban en git"

# Agregar .gitignore actualizado
git add .gitignore
git commit -m "chore: improve .gitignore - add .env, wal, shm files"
```

---

## VERIFICACIÓN FASE 1:
- [ ] `.gitignore` actualizado con `.env`, `*.db-wal`, `*.db-shm`
- [ ] `.env.example` creado
- [ ] `git status` muestra solo los cambios esperados

**¿Todo listo? Escribe "APROBAR FASE 1" para continuar.**

---

# FASE 2: ELIMINAR DUPLICADOS (HTML)
**Complejidad:** ⭐⭐⭐ Media
**Tiempo estimado:** 30 minutos
**Riesgo:** MEDIO (modifica UI)

## Objetivo:
Eliminar vistas duplicadas en `app-shell.html`

## Pasos:

### 2.1 Identificar duplicados

En `app-shell.html`, buscar:
- `view-pre-registrations` → aparece 2 veces
- `view-survey-manager` → aparece 2 veces

### 2.2 Analizar cada duplicado

Para cada uno, determinar cuál:
- Tiene más funcionalidades
- Está más actualizado
- Es el que realmente se usa en `script.js`

### 2.3 Eliminar el duplicado obsolete

Eliminar la versión que NO se usa.

### 2.4 Verificar que no hay errores de JavaScript

1. Abrir la app
2. Navegar a las secciones afectadas
3. Verificar que no hay errores en consola

---

## VERIFICACIÓN FASE 2:
- [ ] Solo existe UNA `view-pre-registrations`
- [ ] Solo existe UNA `view-survey-manager`
- [ ] La navegación funciona sin errores
- [ ] No hay elementos HTML flotantes sin cerrar

**¿Todo listo? Escribe "APROBAR FASE 2" para continuar.**

---

# FASE 3: ELIMINAR DUPLICADOS (JavaScript)
**Complejidad:** ⭐⭐⭐⭐ Media-Alta
**Tiempo estimado:** 45 minutos
**Riesgo:** MEDIO (puede romper funcionalidad)

## Objetivo:
Eliminar funciones duplicadas en `script.js`

## Pasos:

### 3.1 Identificar duplicados

Funciones que aparecen 2+ veces:
- `switchEmailService()` 
- `loadSMTPConfig()`
- `loadIMAPConfig()`
- `saveIMAPConfig()`
- `testIMAPConnection()`

### 3.2 Para cada función duplicada:

1. **Copiar ambas versiones** a un bloc de notas temporal
2. **Comparar** diferencias línea por línea
3. **Decidir** cuál es la versión "maestra" (la más completa)
4. **Fusionar** si hay funcionalidades diferentes
5. **Eliminar** las versiones antiguas
6. **Verificar** que no hay referencias rotas

### 3.3 Verificación completa

```bash
# En script.js, buscar funciones duplicadas después de cambios
grep -n "function switchEmailService" script.js
grep -n "function loadSMTPConfig" script.js
# Debería aparecer solo 1 vez cada una
```

### 3.4 Test funcional

1. Abrir la app
2. Ir a configuración de email
3. Probar cada tab (SMTP, IMAP)
4. Verificar que guardan y cargan correctamente

---

## VERIFICACIÓN FASE 3:
- [ ] `switchEmailService()` aparece 1 vez
- [ ] `loadSMTPConfig()` aparece 1 vez
- [ ] `loadIMAPConfig()` aparece 1 vez
- [ ] `saveIMAPConfig()` aparece 1 vez
- [ ] `testIMAPConnection()` aparece 1 vez
- [ ] Configuración de email funciona correctamente

**¿Todo listo? Escribe "APROBAR FASE 3" para continuar.**

---

# FASE 4: CORREGIR VERSIONES DE PAQUETES
**Complejidad:** ⭐⭐⭐ Media
**Tiempo estimado:** 20 minutos
**Riesgo:** BAJO

## Objetivo:
Fix `package.json` con versiones incorrectas

## Pasos:

### 4.1 Corregir package.json

Abrir `package.json` y cambiar:

**ANTES (incorrecto):**
```json
"nodemailer": "^8.0.3",
"bcryptjs": "^3.0.3",
```

**DESPUÉS (correcto):**
```json
"nodemailer": "^6.9.16",
"bcryptjs": "^2.4.3",
```

### 4.2 Verificar versiones disponibles

```bash
npm view nodemailer version
npm view bcryptjs version
```

### 4.3 Instalar versiones correctas

```bash
npm install
```

### 4.4 Verificar que todo funciona

```bash
npm start
# o
node server.js
```

---

## VERIFICACIÓN FASE 4:
- [ ] package.json tiene versiones válidas
- [ ] `npm install`顺利完成
- [ ] El servidor inicia sin errores

**¿Todo listo? Escribe "APROBAR FASE 4" para continuar.**

---

# FASE 5: MEJORAR SEGURIDAD BÁSICA
**Complejidad:** ⭐⭐⭐⭐ Media-Alta
**Tiempo estimado:** 1 hora
**Riesgo:** MEDIO-ALTO

## Objetivo:
Mejoras iniciales de seguridad

## Pasos:

### 5.1 Hacer backup de server.js
```bash
cp server.js server.js.backup
```

### 5.2 Cambiar CORS de "*" a lista blanca

En `server.js`, buscar la configuración de CORS:

**ANTES:**
```javascript
app.use(cors({
    origin: '*'
}));
```

**DESPUÉS:**
```javascript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
```

### 5.3 Reducir rate limiting

En `server.js`, buscar el rate limit:

**ANTES:**
```javascript
limiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000
})
```

**DESPUÉS:**
```javascript
limiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Reducido de 2000 a 200
    standardHeaders: true,
    legacyHeaders: false
})
```

### 5.4 Agregar validación de uploads

En `server.js`, buscar la configuración de multer:

**ANTES:**
```javascript
const upload = multer({ dest: 'uploads/' });
```

**DESPUÉS:**
```javascript
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});
```

### 5.5 Agregar helmet (headers de seguridad)

En `server.js`, después de importar helmet:

**ANTES:**
```javascript
const helmet = require('helmet');
```

**DESPUÉS (agregar después de imports):**
```javascript
app.use(helmet({
    contentSecurityPolicy: false, // Desactivar si rompe la app
    crossOriginEmbedderPolicy: false
}));
```

### 5.6 Verificar funcionamiento

```bash
npm start
```

Probar:
- Login desde localhost debe funcionar
- Login desde dominio externo debe dar error CORS
- Upload de archivo >5MB debe dar error
- Headers de seguridad visibles

---

## VERIFICACIÓN FASE 5:
- [ ] CORS permite solo orígenes configurados
- [ ] Rate limit reducido a 200 req/15min
- [ ] Uploads limitados a 5MB y tipos permitidos
- [ ] Helmet activo
- [ ] App funciona correctamente

**¿Todo listo? Escribe "APROBAR FASE 5" para continuar.**

---

# FASE 6: HASH DE CONTRASEÑAS
**Complejidad:** ⭐⭐⭐⭐⭐ Alta
**Tiempo estimado:** 2 horas
**Riesgo:** ALTO (puede bloquear usuarios)

## Objetivo:
Implementar bcrypt para almacenar contraseñas hasheadas

## Pasos:

### 6.1 Hacer backup de todo
```bash
cp server.js server.js.backup2
cp database.js database.js.backup
```

### 6.2 Crear script de migración de contraseñas

Crear `scripts/migrate_passwords.js`:

```javascript
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'check_app.db'));

console.log('🔐 Iniciando migración de contraseñas...');

// Obtener todos los usuarios
const users = db.prepare("SELECT id, username, password FROM users").all();
console.log(`📊 Encontrados ${users.length} usuarios`);

const saltRounds = 10;
let migrated = 0;
let alreadyHashed = 0;

const updateStmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");

const migrate = db.transaction(() => {
    for (const user of users) {
        // Verificar si ya está hasheado (bcrypt empieza con $2)
        if (user.password && user.password.startsWith('$2')) {
            alreadyHashed++;
            console.log(`  ✓ ${user.username} - ya hasheado`);
            continue;
        }
        
        // Hashear la contraseña
        const hashed = bcrypt.hashSync(user.password, saltRounds);
        updateStmt.run(hashed, user.id);
        migrated++;
        console.log(`  ✓ ${user.username} - migrado`);
    }
});

migrate();

console.log('\n📊 RESUMEN:');
console.log(`   Migrados: ${migrated}`);
console.log(`   Ya eran hash: ${alreadyHashed}`);
console.log('✅ Migración completada');

db.close();
```

### 6.3 Modificar server.js para usar bcrypt

**ANTES (línea de login):**
```javascript
const match = row.password === password;
```

**DESPUÉS:**
```javascript
const match = bcrypt.compareSync(password, row.password);
```

**ANTES (creación de usuario):**
```javascript
db.prepare("INSERT INTO users ... VALUES (?, ?, ?, ?, ?, ?)")
  .run(id, username, password, display_name, role, 'APPROVED');
```

**DESPUÉS:**
```javascript
const hashedPassword = bcrypt.hashSync(password, 10);
db.prepare("INSERT INTO users ... VALUES (?, ?, ?, ?, ?, ?)")
  .run(id, username, hashedPassword, display_name, role, 'APPROVED');
```

**ANTES (actualización de contraseña):**
```javascript
db.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, id);
```

**DESPUÉS:**
```javascript
const hashedPassword = bcrypt.hashSync(password, 10);
db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, id);
```

### 6.4 Ejecutar migración

```bash
node scripts/migrate_passwords.js
```

### 6.5 Verificar que login funciona

```bash
npm start
# Probar login con admin@check.com / admin123
```

---

## VERIFICACIÓN FASE 6:
- [ ] Script de migración creado
- [ ] Migration ejecutada sin errores
- [ ] Login funciona con contraseña existente
- [ ] Nuevos usuarios se crean con hash
- [ ] Cambio de contraseña genera hash nuevo

**⚠️ IMPORTANTE:** Si el login falla después de la migración:
```bash
# Restaurar backup
cp server.js.backup2 server.js
# Reportar error
```

**¿Todo listo? Escribe "APROBAR FASE 6" para continuar.**

---

# FASE 7: COMMIT Y DOCUMENTACIÓN
**Complejidad:** ⭐ Fácil
**Tiempo estimado:** 15 minutos
**Riesgo:** NINGUNO

## Objetivo:
Guardar cambios y documentar

## Pasos:

### 7.1 Crear commit

```bash
git add .
git status
# Verificar que solo incluye los cambios esperados
git commit -m "chore(audit): fase 1-6 - seguridad y limpieza

- Fix .gitignore y agregar .env
- Eliminar vistas duplicadas en app-shell.html
- Eliminar funciones duplicadas en script.js
- Corregir versiones de paquetes npm
- Implementar CORS restrictivo y rate limiting
- Migrar contraseñas a bcrypt

Fases aprobadas por el desarrollador."
```

### 7.2 Actualizar CHANGELOG

En `docs/CHANGELOG_AUDITORIA.md`:
```markdown
## 21/03/2026 - Completado

### Fase 1: Limpieza de Repositorio ✅
- .gitignore actualizado
- .env.example creado

### Fase 2: Eliminación de duplicados HTML ✅
- view-pre-registrations: 1 sola
- view-survey-manager: 1 sola

### Fase 3: Eliminación de duplicados JS ✅
- switchEmailService: 1 sola
- loadSMTPConfig: 1 sola
- [etc...]

### Fase 4: Corrección de paquetes ✅
- nodemailer: 6.9.16
- bcryptjs: 2.4.3

### Fase 5: Seguridad básica ✅
- CORS restrictivo
- Rate limit: 200 req/15min
- Upload: 5MB max, tipos limitados
- Helmet habilitado

### Fase 6: Hash de contraseñas ✅
- bcryptjs implementado
- Migración ejecutada
```

---

## VERIFICACIÓN FASE 7:
- [ ] Commit creado exitosamente
- [ ] CHANGELOG actualizado
- [ ] Backups eliminados o renombrados

**¿Todo listo? Escribe "APROBAR FASE 7" para continuar a FASE AVANZADA".**

---

# NOTAS DE EJECUCIÓN

## Si algo sale mal:

```bash
# Restaurar desde backup
cp server.js.backup server.js

# Ver qué cambió
git diff server.js.backup server.js

# Descartar todos los cambios
git checkout -- .
```

## Comandos útiles:

```bash
# Ver estado
git status

# Ver qué archivos cambiaron
git diff --stat

# Ver log de commits
git log --oneline -10

# Crear backup rápido
cp server.js server.js.bak_$(date +%Y%m%d)
```

---

## PRÓXIMAS FASES (Pendientes)

Una vez completadas las fases 0-7:
- **Fase 8:** Modularización de server.js
- **Fase 9:** Índices de base de datos
- **Fase 10:** Sistema de migrations
- **Fase 11:** Migración a TypeScript
- **Fase 12:** Migración a PostgreSQL
- **Fase 13:** Frontend con React

---

## ESTADO DE PROGRESO

| Fase | Estado | Fecha Aprobación |
|------|--------|------------------|
| 0 - Preparación | PENDIENTE | - |
| 1 - Repositorio | PENDIENTE | - |
| 2 - Duplicados HTML | PENDIENTE | - |
| 3 - Duplicados JS | PENDIENTE | - |
| 4 - Paquetes | PENDIENTE | - |
| 5 - Seguridad básica | PENDIENTE | - |
| 6 - Hash contraseñas | PENDIENTE | - |
| 7 - Commit/Doc | PENDIENTE | - |

