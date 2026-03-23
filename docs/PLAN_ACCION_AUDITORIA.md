# PLAN DE ACCIÓN - AUDITORÍA MILITAR CHECK PRO

## Resumen Ejecutivo
| Prioridad | Problemas | Plazo |
|-----------|-----------|-------|
| P1 (Crítico) | 3 | Inmediato |
| P2 (Alto) | 8 | 1 semana |
| P3 (Medio) | 12 | 2 semanas |
| P4 (Bajo) | 6 | 1 mes |

---

## FASE 1: CORRECCIONES CRÍTICAS (Día 0-1)

### 1.1 JWT Secret Vulnerable
**Archivo**: `src/security/jwt.js`
```javascript
// ANTES (inseguro)
const JWT_SECRET = process.env.JWT_SECRET || 'check-pro-secret-key-change-in-production';

// DESPUÉS (seguro)
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET es requerido en producción');
}
const JWT_SECRET = process.env.JWT_SECRET;
```
**Acción**: 
- [ ] Modificar jwt.js
- [ ] Añadir JWT_SECRET al .env
- [ ] Actualizar docker-compose/portainer con secrets

### 1.2 HSTS Deshabilitado
**Archivo**: `server.js` línea 418
```javascript
// Cambiar de:
hsts: false
// A (cuando HTTPS esté listo):
hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
```
**Acción**:
- [ ] Documentar requisito de HTTPS para producción
- [ ] Preparar configuración para cuando se habilite HTTPS

### 1.3 SQL Injection en castId
**Archivo**: `src/utils/helpers.js`
```javascript
// Añadir validación estricta
function castId(table, id) {
    if (!id) throw new Error('ID requerido');
    // Validar formato UUID o número
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && 
        !/^\d+$/.test(id)) {
        throw new Error('ID inválido');
    }
    return id;
}
```
**Acción**:
- [ ] Revisar implementación actual de castId
- [ ] Añadir validación estricta
- [ ] Testear con inputs maliciosos

---

## FASE 2: PROBLEMAS ALTOS (Semana 1)

### 2.1 Eliminar Legacy Auth (x-user-id)
**Archivo**: `src/middleware/auth.js`

**Opción A - Depreciar gradualmente (Recomendado)**:
- Añadir header `X-Deprecation-Warning` cuando se use x-user-id
- Loguear uso de legacy auth
- En 30 días, rechazar completamente

**Opción B - Eliminar inmediatamente**:
```javascript
// Eliminar líneas 21-33 en auth.js
// Solo mantener JWT:
if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
        userId = decoded.userId;
    }
}
```
**Acción**:
- [ ] Decidir estrategia (gradual vs inmediata)
- [ ] Implementar
- [ ] Notificar a clientes de API

### 2.2 Rate Limiting por Endpoint
**Archivo**: `server.js`

```javascript
const authLimiter = rateLimit({
    windowMs: 15*60*1000,
    max: 10,  // Reducido de 50
    skip: skipLocal,
    message: { error: 'Demasiados intentos de login' }
});

const guestLimiter = rateLimit({
    windowMs: 15*60*1000,
    max: 50,
    skip: skipLocal
});

const emailLimiter = rateLimit({
    windowMs: 15*60*1000,
    max: 20,
    skip: skipLocal
});

// Aplicar a rutas específicas
app.use('/api/login', authLimiter);
app.use('/api/guests', guestLimiter);
app.use('/api/email', emailLimiter);
```
**Acción**:
- [ ] Crear limitadores específicos
- [ ] Aplicar a endpoints sensibles

### 2.3 Proteger Swagger UI
**Archivo**: `server.js`

```javascript
// Opción 1: Proteger con auth
app.use('/api-docs', authMiddleware(), swaggerUi.serve, swaggerUi.setup(...));

// Opción 2: Deshabilitar en producción
if (process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(...));
}
```
**Acción**:
- [ ] Configurar protección según entorno
- [ ] Actualizar portainer-stack.yml

### 2.4 Limitar Tamaño de Request
**Archivo**: `server.js`
```javascript
// Añadir límite de 10MB
app.use(express.json({ limit: '10mb' }));
```
**Acción**:
- [ ] Modificar línea 432
- [ ] Testear con payloads grandes

### 2.5 Sanitizar Logs
**Crear**: `src/utils/logger.js`
```javascript
function sanitizeForLog(data) {
    const sensitive = ['password', 'token', 'jwt', 'secret', 'smtp_pass', 'imap_pass'];
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
        if (sensitive.some(s => key.toLowerCase().includes(s))) {
            sanitized[key] = '[REDACTED]';
        }
    }
    return sanitized;
}
```
**Acción**:
- [ ] Crear logger util
- [ ] Reemplazar console.log sensibles

### 2.6 CSRF Protection
**Archivo**: `server.js`
```javascript
const csrf = require('csurf');
app.use(csrf({ cookie: true }));
// Incluir csrf token en respuestas de login
```
**Acción**:
- [ ] Añadir csurf
- [ ] Integrar con frontend

### 2.7 Path Traversal Protection
**Archivo**: `src/routes/index.js`
```javascript
app.use('/uploads', (req, res, next) => {
    if (req.path.includes('..')) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
}, express.static(path.join(rootDir, 'uploads'), {
    dotfiles: 'deny',
    index: false
}));
```
**Acción**:
- [ ] Implementar middleware de protección

### 2.8 Timeout para Webhooks
**Archivo**: `src/utils/webhooks.js`
```javascript
// Añadir timeout de 10 segundos
const response = await fetch(url, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
});
```
**Acción**:
- [ ] Modificar función triggerWebhooks

---

## FASE 3: PROBLEMAS MEDIOS (Semana 2)

### 3.1 Habilitar CSP (Content Security Policy)
```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    }
}));
```

### 3.2 Health Check Completo
**Archivo**: `src/routes/health.routes.js` (nuevo)
```javascript
router.get('/health', async (req, res) => {
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: await checkDatabase(),
        smtp: await checkSMTP(),
        cache: checkCache()
    };
    res.json(checks);
});
```

### 3.3 Logging de Access (Morgan)
```javascript
const morgan = require('morgan');
app.use(morgan('combined', { 
    stream: { write: msg => logger.info(msg.trim()) }
}));
```

### 3.4 Configurar Multer con Límites
```javascript
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        if (ext) cb(null, true);
        else cb(new Error('Tipo de archivo no permitido'));
    }
});
```

---

## FASE 4: MEJORAS DE CALIDAD (Mes 1)

### 4.1 Tests Unitarios (Jest)
- [ ] Configurar Jest
- [ ] Coverage objetivo: 70%
- [ ]测试: auth, validation, helpers

### 4.2 Refactorizar Código Duplicado
- [ ] Unificar sendEmail
- [ ] Extraer constantes
- [ ] Crear messages.js

### 4.3 Documentación JSDoc
- [ ] Documentar todas las funciones exportadas
- [ ] Generar documentación automática

---

## VERIFICACIÓN Y DESPLIEGUE

### Checklist de Seguridad Pre-Deploy
- [ ] JWT_SECRET configurado en producción
- [ ] HTTPS habilitado (o documentado para producción)
- [ ] Legacy auth depreciado
- [ ] Rate limiting implementado
- [ ] CSP configurado
- [ ] Logs sanitizados
- [ ] Tests pasando
- [ ] Health check funcionando

### Scripts de Verificación
```bash
# Verificar JWT
grep -n "check-pro-secret-key" src/security/jwt.js

# Verificar HSTS
grep -n "hsts:" server.js

# Verificar rate limiting
grep -n "rateLimit" server.js
```

---

## CRONOGRAMA

```
Semana 1: P1 (Críticos) + P2 parcial
Semana 2: P2 completo + P3 parcial
Semana 3: P3 completo + P4 parcial
Semana 4: P4 + Testing + Deploy
```

---

## RESPONSABLES
| Tarea | Responsable |
|--------|-------------|
| JWT Secret | DevOps |
| Rate Limiting | Backend Dev |
| CSP/Helmet | Backend Dev |
| Testing | QA |
| Documentación | Tech Writer |

---

## RECURSOS
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Express Security: https://expressjs.com/en/advanced/best-practice-security.html
- Helmet Docs: https://helmetjs.github.io/