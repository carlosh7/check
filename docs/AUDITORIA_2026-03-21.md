# AUDITORÍA INTEGRAL - CHECK PRO V12.2.2
**Fecha de auditoría:** 21/03/2026
**Auditor:** opencode

---

## 1. DUPLICIDAD DE CÓDIGO (CRÍTICO)

| Ubicación | Problema |
|-----------|----------|
| `app-shell.html:145-256` | **Vistas duplicadas**: `view-pre-registrations` aparece 2 veces |
| `app-shell.html:179-300` | **Vistas duplicadas**: `view-survey-manager` aparece 2 veces |
| `script.js:1216-1236` y `1731-1747` | **Función duplicada**: `switchEmailService()` definida 2 veces |
| `script.js:918-929` y `1238-1259` | **Función duplicada**: `loadSMTPConfig()` definida 2 veces |
| `script.js:932-955` y `1153-1190` | **Funciones duplicadas**: `loadIMAPConfig`, `saveIMAPConfig`, `testIMAPConnection` |
| `server.js` entero (1924 líneas) | **Monolito**: 60+ endpoints en un solo archivo sin modularización |
| Admin hardcodeado | `admin@check.com` / `admin123` en database.js:480 |

---

## 2. SEGURIDAD (CRÍTICO)

### 2.1 Vulnerabilidades Encontradas

| Gravedad | Problema | Ubicación |
|----------|----------|-----------|
| 🔴 CRÍTICO | Contraseñas en **texto plano** | `users.password`, `smtp_pass`, `imap_pass` |
| 🔴 CRÍTICO | CORS permite `*` (cualquier dominio) | `server.js:29` |
| 🔴 CRÍTICO | Inyección SQL potencial | `server.js` - queries concatenados en `tempImport` |
| 🟠 ALTO | `localStorage` guarda contraseña en texto plano | `script.js` - `LS.set('user', JSON.stringify(...))` |
| 🟠 ALTO | Rate limit excesivo (2000 peticiones/15min) | `server.js:427` |
| 🟠 ALTO | Puerto fijo sin SSL | `server.js:31` |
| 🟡 MEDIO | No hay validación de tipos de archivo en uploads | `server.js:454` |
| 🟡 MEDIO | No hay límite de tamaño de archivo | `multer` sin configuración |
| 🟡 MEDIO | No hay CSRF protection | Todo el sistema |
| 🟡 MEDIO | Tokens sin expiración (UUID v4) | Sistema de auth |
| 🟢 BAJO | Puerto 3000 expuesto en producción | `server.js` |

### 2.2 Credenciales por Defecto
```
Usuario: admin@check.com
Contraseña: admin123 (TEXTO PLANO)
```
**Riesgo**: Si el repo es público o hay breach, el sistema queda comprometido instantáneamente.

---

## 3. INCOHERENCIAS

| Categoría | Problema |
|-----------|----------|
| **IDs inconsistentes** | `getValidId('pr')` usa tabla inexistente vs `getValidId('password_resets')` |
| **Versiones desfasadas** | package.json dice v12.2.2 pero comentarios dicen v12.2.1 |
| **Migraciones sin control** | `ALTER TABLE` en try/catch sin version tracking |
| **Nomenclatura** | `group_users` vs `user_events` (relaciones inconsistentes) |
| **Estado null/undefined** | Mezcla de `null`, `undefined`, `''` en campos vacíos |
| **Rutas duplicadas** | `/api/app-version` definida 2 veces (líneas 950 y 1455) |

---

## 4. LIMITACIONES ACTUALES

| Área | Limitación |
|------|------------|
| **Base de datos** | SQLite sin replica, backup automático ni multi-tenant real |
| **Concurrencia** | Un solo proceso Node.js (no usa cluster/workers) |
| **Procesamiento** | Sin cola de trabajos para operaciones pesadas (exportar, PDFs) |
| **Archivos** | Sin CDN, compresión, ni validación robusta |
| **Búsqueda** | Sin índices en campos frecuentemente consultados |
| **Móvil** | PWA incompleto, offline support básico |
| **Testing** | Sin tests automatizados ni CI/CD |
| **Documentación** | Sin API docs (OpenAPI/Swagger) |
| **Logs** | Solo `console.log`, sin logs estructurados ni niveles |
| **Autenticación** | Sin 2FA, sin SSO, sin OAuth |
| **i18n** | Solo español |

---

## 5. PLAN DE ACCIÓN - MEJORAS INMEDIATAS (1-2 semanas)

### 5.1 CRÍTICAS (hacer YA)

- [ ] **1. HASH DE CONTRASEÑAS**
  - Implementar bcryptjs (ya está en package.json)
  - Migrar contraseñas existentes con hash
  - Crear endpoint de reset masivo

- [ ] **2. ELIMINAR VISTAS DUPLICADAS**
  - app-shell.html:145-256 → eliminar primera instancia
  - app-shell.html:179-300 → eliminar segunda instancia
  - Mantener solo UNA de cada vista

- [ ] **3. ELIMINAR FUNCIONES DUPLICADAS**
  - script.js:1731-1747 → eliminar switchEmailService duplicada
  - Consolidar loadSMTPConfig, loadIMAPConfig en una sola implementación

- [ ] **4. CAMBIAR CREDENCIALES ADMIN**
  - Eliminar admin hardcodeado
  - Generar admin aleatorio en primera ejecución
  - Guardar en archivo .env

### 5.2 SEGURIDAD (1 semana)

- [ ] **5. CORS RESTRICTIVO**
  - Cambiar origin "*" a lista de dominios permitidos
  - Implementar whitelist en config

- [ ] **6. RATE LIMITING AJUSTADO**
  - Reducir de 2000 a 100 requests/15min para API
  - 5 requests/15min para login

- [ ] **7. VALIDACIÓN DE UPLOADS**
  - Tipos permitidos: jpg, png, pdf, xlsx
  - Límite: 5MB
  - Escaneo de contenido

- [ ] **8. HTTPS EN PRODUCCIÓN**
  - Usar Traefik o Nginx como proxy
  - Certificados Let's Encrypt automáticos

---

## 6. PLAN DE ACCIÓN - MODERNIZACIÓN (1-3 meses)

### 6.1 Refactorización de Arquitectura

```
MONOLITO ACTUAL (server.js 1924 líneas)
            ↓
MÓDULOS POR DOMINIO
├── /src
│   ├── /routes
│   │   ├── auth.routes.js      (login, signup, password)
│   │   ├── users.routes.js     (CRUD usuarios)
│   │   ├── events.routes.js    (eventos y invitados)
│   │   ├── email.routes.js     (SMTP, IMAP, mailing)
│   │   └── admin.routes.js     (settings, grupos)
│   ├── /controllers
│   ├── /services
│   │   ├── email.service.js
│   │   ├── auth.service.js
│   │   └── queue.service.js    (BullMQ)
│   ├── /models
│   │   └── db.js               (Better-sqlite3 o Prisma)
│   ├── /middleware
│   │   ├── auth.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validate.middleware.js
│   └── /utils
│       ├── logger.js
│       └── helpers.js
```

### 6.2 Base de Datos - PostgreSQL

```sql
-- Migrar de SQLite a PostgreSQL
-- Beneficios:
-- 1. Conexiones concurrentes reales
-- 2. Replica para HA
-- 3. Backups point-in-time
-- 4. Row-level security (multi-tenant)
-- 5. Búsqueda full-text
```

### 6.3 Autenticación Robusta

```
JWT con RS256 (asimétrico)
├── Access Token: 15 min
├── Refresh Token: 7 días
├── Rotación de tokens
├──/blacklist en Redis
└── Rate limiting por IP
```

---

## 7. SALTO TECNOLÓGICO - RECOMENDACIONES

### 7.1 Backend (Impacto Alto)

| Tecnología | Beneficio | Esfuerzo |
|------------|-----------|----------|
| **TypeScript** | Tipado estático, menos bugs, mejor DX | ⭐⭐⭐⭐ |
| **Fastify** | 30% más rápido que Express, built-in validation | ⭐⭐ |
| **Prisma ORM** | Type-safe, migrations automáticas, great DX | ⭐⭐⭐ |
| **Redis** | Cacheo, sesiones, cola de trabajos | ⭐⭐ |
| **BullMQ** | Cola de trabajos robusta (emails masivos, exports) | ⭐⭐ |
| **Zod** | Validación de schemas en runtime | ⭐ |

### 7.2 Frontend (Impacto Medio-Alto)

| Tecnología | Beneficio | Esfuerzo |
|------------|-----------|----------|
| **React 18 + Vite** | Componentes reutilizables, hot reload | ⭐⭐⭐ |
| **TanStack Query** | Cacheo automático, loading states | ⭐⭐ |
| **React Router 6** | Routing declarativo | ⭐ |
| **Tailwind CSS v4** | Build-time, mejor rendimiento | ⭐ |

### 7.3 Infraestructura

| Tecnología | Beneficio | Esfuerzo |
|------------|-----------|----------|
| **Docker Compose** | Ya existe, mejorar con profiles | ⭐ |
| **Traefik** | SSL automático, load balancing | ⭐⭐ |
| **Prometheus + Grafana** | Monitoring, alertas | ⭐⭐⭐ |
| **S3/R2** | Storage de archivos externo | ⭐⭐ |

### 7.4 DevOps

| Tecnología | Beneficio | Esfuerzo |
|------------|-----------|----------|
| **GitHub Actions** | CI/CD automatizado | ⭐⭐ |
| **Dependabot** | Updates automáticos de deps | ⭐ |
| **ESLint + Prettier** | Code quality (ya en package.json bcryptjs) | ⭐ |

---

## 8. SIMPLIFICACIÓN Y MEJOR LÓGICA

### 8.1 Consolidar Rutas

```javascript
// ANTES: Rutas dispersas
app.post('/api/signup', ...)
app.post('/signup', ...)  // DUPLICADA
app.post('/api/register', ...)

// DESPUÉS: RESTful consolidado
app.post('/api/auth/register', ...)    // signup
app.post('/api/auth/login', ...)       // login
app.post('/api/auth/password-reset', ...)  // reset
```

### 8.2 Migrations Centralizadas

```javascript
// database.js → migrator.js
const MIGRATIONS = [
  { version: '12.3.0', up: 'ALTER TABLE users ADD COLUMN last_login', down: '...' },
  { version: '12.4.0', up: 'CREATE INDEX idx_events_group', down: '...' },
];

// Ejecutar en orden, tracking en schema_migrations
```

### 8.3 Índices de Base de Datos

```sql
-- Agregar índices faltantes
CREATE INDEX idx_guests_event_email ON guests(event_id, email);
CREATE INDEX idx_guests_event_phone ON guests(event_id, phone);
CREATE INDEX idx_events_group ON events(group_id);
CREATE INDEX idx_users_email ON users(username);  -- Ya UNIQUE
CREATE INDEX idx_email_queue_status ON email_queue(status);
```

---

## 9. ROBUSTEZ Y CAPACIDAD DE ESCALAMIENTO

### 9.1 Estado Actual vs Futuro

```
ACTUAL:
┌─────────────────┐
│   Node.js       │
│   Express       │
│   (monolito)    │
│                 │
│   ┌───────────┐ │
│   │  SQLite   │ │
│   └───────────┘ │
└─────────────────┘

ESCALABLE:
┌─────────────────────────────────────────────────┐
│                   Traefik (SSL)                 │
│                  Load Balancer                 │
└─────────────────────┬───────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    ▼                 ▼                 ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│Worker 1 │     │Worker 2 │     │Worker N │  ← PM2/Cluster
│         │     │         │     │         │
│ Express │     │ Express │     │ Express │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
         ┌───────────────────┐
         │     Redis         │
         │  (Cache/Sessions) │
         └─────────┬─────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   ┌──────────┐       ┌──────────┐
   │PostgreSQL│       │  BullMQ  │
   │ Primary  │       │  (Jobs)  │
   └────┬─────┘       └──────────┘
        │
   ┌────┴────┐
   │Replica  │
   │ RO      │
   └─────────┘
```

### 9.2 API Versioning

```javascript
// /api/v1/users  → actual
// /api/v2/users  → nueva versión
// Mantener v1 por 6 meses para backwards compatibility
```

### 9.3 Health Checks

```javascript
// /health → Kubernetes/probes
app.get('/health', async (req, res) => {
  const db = checkDatabase();
  const redis = checkRedis();
  res.json({
    status: db && redis ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    checks: { db: !!db, redis: !!redis }
  });
});
```

---

## 10. ROADMAP SUGERIDO

### Fase 1: Supervivencia (1-2 semanas)
- [ ] Eliminar duplicados de código
- [ ] Implementar bcrypt para contraseñas
- [ ] Fix CORS y rate limiting
- [ ] Backup automático de SQLite

### Fase 2: Estabilidad (1 mes)
- [ ] TypeScript migration (gradual)
- [ ] Modularizar server.js
- [ ] Agregar índices faltantes
- [ ] Sistema de migrations versionado

### Fase 3: Escalabilidad (2-3 meses)
- [ ] PostgreSQL migration
- [ ] Redis para cache y sesiones
- [ ] BullMQ para jobs asíncronos
- [ ] Docker Compose optimizado

### Fase 4: Modernización (3-6 meses)
- [ ] Frontend con React
- [ ] API REST con OpenAPI docs
- [ ] CI/CD con GitHub Actions
- [ ] Monitoring con Prometheus/Grafana

---

## RESUMEN EJECUTIVO

| Categoría | Score (1-10) | Prioridad |
|-----------|--------------|-----------|
| Duplicidad | 3/10 | 🔴 CRÍTICA |
| Seguridad | 2/10 | 🔴 CRÍTICA |
| Consistencia | 5/10 | 🟠 ALTA |
| Escalabilidad | 4/10 | 🟠 ALTA |
| Modernidad | 3/10 | 🟡 MEDIA |

**Recomendación**: Priorizar Fase 1 inmediatamente. El código tiene buena base funcional pero la deuda técnica acumulada (especialmente en seguridad y duplicación) es significativa.

---

---

## 11. ANÁLISIS DEL REPOSITORIO GITHUB

### Repo: https://github.com/carlosh7/check

| Métrica | Valor |
|---------|-------|
| **Visibilidad** | PÚBLICO |
| **Stars** | 0 |
| **Watchers** | 0 |
| **Forks** | 0 |
| **Issues abiertos** | 0 |
| **Pull Requests** | 0 |
| **Commits totales** | 213 |
| **Tags/Releases** | 57 |

### ⚠️ ALERTA CRÍTICA DE SEGURIDAD

El repositorio es **PÚBLICO** y contiene:

1. **Credenciales hardcodeadas** visibles en el código:
   - `admin@check.com` / `admin123`
   - Configuración de base de datos

2. **Base de datos SQLite incluida** (¿o debería estar en .gitignore?):
   - `check_app.db`
   - `check_app.db-shm`
   - `check_app.db-wal`

3. **README expone credenciales por defecto**:
   ```
   Usuario: admin@check.com
   Contraseña: admin123
   ```

### Acciones Inmediatas Recomendadas:

```markdown
□ 1. VOLVER PRIVADO EL REPOSITORIO
   - Ir a Settings > Danger Zone > Change visibility
   - O usar: gh repo edit carlosh7/check --visibility private

□ 2. CREAR .env PARA CREDENCIALES
   - Crear archivo .env.example (template sin valores reales)
   - Agregar al .gitignore: check_app.db*, .env
   - Remover archivos de la base de datos del historial de git

□ 3. CREAR GITHUB SECRET PARA PRODUCCIÓN
   - Settings > Secrets and variables > Actions
   - Agregar SMTP_PASS, DB_PASSWORD, JWT_SECRET, etc.

□ 4. AGREGAR DEPENDABOT
   - Para actualizaciones automáticas de dependencias

□ 5. CREAR RELEASES CON CHANGELOG
   - El repo tiene 57 tags pero "No releases here"
   - Crear releases formales con notas de versión
```

### Revisión de .gitignore (ACTUAL)

```gitignore
# INCLUIDO ✓
check_app.db
check_app.db-journal
uploads/
node_modules/
*.xlsx, *.xls, *.csv

# PROBLEMAS ❌
- NO ignora: check_app.db-shm, check_app.db-wal
- NO ignora: package-lock.json (debería estar para reproducibilidad)
- MUY IMPORTANTE: .env NO existe ni está ignorado
```

### Mejoras sugeridas para .gitignore:

```gitignore
# SQLite
check_app.db
check_app.db-journal
check_app.db-shm    ← AGREGAR
check_app.db-wal    ← AGREGAR

# Environment (CRÍTICO)
.env
.env.local
.env.*.local

# Dependencias lock (DEBERÍA ESTAR)
# package-lock.json  ← QUITAR de ignore
```

---

## 12. DEPENDENCIAS - VULNERABILIDADES CONOCIDAS

### Revisión de dependencias clave:

| Paquete | Versión Actual | ¿Última? | Vulnerabilidades |
|---------|---------------|----------|-----------------|
| express | ^5.2.1 | 5.x | ✅ OK |
| better-sqlite3 | ^12.8.0 | 12.x | ⚠️ Revisar |
| nodemailer | ^8.0.3 | 6.x | ⚠️ Nodemailer 8.x es legacy |
| socket.io | ^4.8.3 | 4.x | ✅ OK |
| exceljs | ^4.4.0 | 4.x | ✅ OK |
| qrcode | ^1.5.4 | 1.x | ⚠️ Revisar |
| imap | ^0.8.19 | 0.8.x | ⚠️ Depreciado |
| mailparser | ^3.9.4 | 3.x | ✅ OK |
| bcryptjs | ^3.0.3 | 2.x | ⚠️ Considerar bcrypt |
| express-rate-limit | ^8.3.1 | 8.x | ✅ OK |
| helmet | ^8.1.0 | 8.x | ✅ OK |
| cors | ^2.8.6 | 2.x | ⚠️ Legacy (cors 3.x disponible) |

### ⚠️ Paquetes Problemáticos:

1. **nodemailer ^8.0.3**: Esta versión NO existe. La 6.x es estable, la 7.x nunca existió, la 8.x fue skipped a 6.x.
2. **imap ^0.8.19**: Paquete sin mantenimiento activo. Considerar `imap-simple` o reescribir con librería nativa.
3. **bcryptjs ^3.0.3**: NO existe. La versión estable es 2.x. Esto indica posible error en el package.json.

---

## 13. MÉTRICAS DE CÓDIGO

| Métrica | Valor |
|---------|-------|
| **server.js** | 1,924 líneas |
| **script.js** | ~2,500+ líneas (capped) |
| **app-shell.html** | ~1,500+ líneas (capped) |
| **database.js** | 617 líneas |
| **style.css** | 581 líneas |
| **Total HTMLs** | 5 archivos (index, registro, survey, app-shell, sw) |
| **Complejidad ciclomática** | ALTA (monolito) |

### Líneas por archivo (promedio ideal: <300):

- server.js: 1,924 ⚠️ CRÍTICO
- script.js: 2,500+ ⚠️ CRÍTICO  
- app-shell.html: 1,500+ ⚠️ CRÍTICO

**Recomendación**: Dividir en módulos de máximo 300-500 líneas cada uno.

---

## RESUMEN EJECUTIVO

| Categoría | Score (1-10) | Prioridad |
|-----------|--------------|-----------|
| Duplicidad | 3/10 | 🔴 CRÍTICA |
| Seguridad | 2/10 | 🔴 CRÍTICA |
| Consistencia | 5/10 | 🟠 ALTA |
| Escalabilidad | 4/10 | 🟠 ALTA |
| Modernidad | 3/10 | 🟡 MEDIA |
| GitHub/Repo | 4/10 | 🟠 ALTA |

**Recomendación**: Priorizar Fase 1 inmediatamente. El código tiene buena base funcional pero la deuda técnica acumulada (especialmente en seguridad y duplicación) es significativa.

---

## CHECKLIST DE ACCIONES PRIORITARIAS

### Inmediatas (Esta semana):
- [ ] Volver repo privado
- [ ] Fix .gitignore (agregar .env, .db-wal, .db-shm)
- [ ] Eliminar vistas duplicadas en app-shell.html
- [ ] Eliminar funciones duplicadas en script.js
- [ ] Fix package.json (versiones incorrectas)

### Corto plazo (2 semanas):
- [ ] Implementar bcrypt para contraseñas
- [ ] Crear archivo .env.example
- [ ] Agregar CORS restrictivo
- [ ] Reducir rate limiting

### Mediano plazo (1 mes):
- [ ] Modularizar server.js
- [ ] Agregar índices a BD
- [ ] Sistema de migrations
- [ ] Documentar API con JSDoc

### Largo plazo (3-6 meses):
- [ ] TypeScript migration
- [ ] PostgreSQL
- [ ] Redis + BullMQ
- [ ] Frontend con React/Vue

---

## NOTAS PERSONALES DEL DESARROLLADOR

(tu espacio para agregar observaciones, preguntas o decisiones)
<minimax:tool_call>
<invoke name="read">
<parameter name="filePath">C:\Users\carlo\OneDrive\Documentos\APP\Registro\.gitignore