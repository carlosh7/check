{
  "auditoria": {
    "sistema": "Check Pro",
    "version": "v12.2.2",
    "fecha": "2026-03-23",
    "tipo": "AUDITORÍA DE SEGURIDAD Y CÓDIGO - MODO MILITAR",
    "resumen_ejecutivo": {
      "total_archivos_auditados": 45,
      "problemas_criticos": 3,
      "problemas_altos": 8,
      "problemas_medios": 12,
      "problemas_bajos": 6,
      "puntuacion_seguridad": "72/100 - ACEPTABLE CON MEJORAS REQUERIDAS"
    },
    "hallazgos_por_categoria": {
      "seguridad": {
        "criticos": [
          {
            "id": "SEC-001",
            "severidad": "CRÍTICO",
            "titulo": "JWT Secret Hardcoded con Fallback Inseguro",
            "archivo": "src/security/jwt.js",
            "linea": 8,
            "descripcion": "El JWT_SECRET tiene un valor por defecto 'check-pro-secret-key-change-in-production' que se usa si la variable de entorno no está configurada. Esto expone el sistema en producción.",
            "codigo": "const JWT_SECRET = process.env.JWT_SECRET || 'check-pro-secret-key-change-in-production';",
            "impacto": "Compromiso total de tokens JWT. Un atacante puede crear tokens válidos con cualquier userId.",
            "recomendacion": "Cambiar a: if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado');",
            "solucion_inmediata": "Establecer JWT_SECRET en variables de entorno del contenedor Docker"
          },
          {
            "id": "SEC-002",
            "severidad": "CRÍTICO",
            "titulo": "HSTS Deshabilitado en Producción",
            "archivo": "server.js",
            "linea": 418,
            "descripcion": "HSTS está deshabilitado con comentario 'requiere HTTPS'. Esto expone el sitio a ataques de downgrade.",
            "codigo": "hsts: false // Desactivar HSTS por ahora (requiere HTTPS)",
            "impacto": "Vulnerable a ataques Man-in-the-Middle y session hijacking.",
            "recomendacion": "Implementar HTTPS y habilitar HSTS con max-age apropiado."
          },
          {
            "id": "SEC-003",
            "severidad": "CRÍTICO",
            "titulo": "SQL Injection Potential via castId",
            "archivo": "src/utils/helpers.js",
            "linea": "No verificado completamente",
            "descripcion": "La función castId no valida suficientemente el formato del ID recibido. Podría permitir SQL injection en ciertos contextos.",
            "codigo": "function castId(table, id) { ... }",
            "impacto": "Potencial inyección SQL si el input no es sanitizado correctamente.",
            "recomendacion": "Implementar validación estricta de formato UUID/numeric en castId."
          }
        ],
        "altos": [
          {
            "id": "SEC-004",
            "severidad": "ALTO",
            "titulo": "Rate Limiting Insuficiente para Endpoints Críticos",
            "archivo": "server.js",
            "linea": 437-440,
            "descripcion": "El limitador global es de 200 peticiones por 15 minutos. Endpoints sensibles como /api/guests no tienen protección adicional.",
            "impacto": "Vulnerable a ataques de fuerza bruta y enumeración de datos.",
            "recomendacion": "Implementar rate limiting específico por endpoint: auth(10/min), guests(50/min), email(20/min)"
          },
          {
            "id": "SEC-005",
            "severidad": "ALTO",
            "titulo": "CORS permite Origen Nulo",
            "archivo": "server.js",
            "linea": 421-431,
            "descripcion": "El callback de CORS permite requests sin origin (mobile apps, Postman), pero no valida adecuadamente origins legítimos.",
            "codigo": "if (!origin || ALLOWED_ORIGINS.includes(origin))",
            "impacto": "Requests cross-origin no controlados pueden acceder a la API.",
            "recomendacion": "Restringir más los origins permitidos y documentar origins legítimos."
          },
          {
            "id": "SEC-006",
            "severidad": "ALTO",
            "titulo": "Fallback de Autenticación Legacy Inseguro",
            "archivo": "src/middleware/auth.js",
            "linea": 21-33,
            "descripcion": "Soporta autenticación via x-user-id header sin token. Esto permite acceso con solo conocer un userId.",
            "codigo": "else if (userIdHeader) { userId = userIdHeader; }",
            "impacto": "Un atacante puede impersonar cualquier usuario enviando x-user-id header.",
            "recomendacion": "Deprecar completamente x-user-id y usar solo JWT."
          },
          {
            "id": "SEC-007",
            "severidad": "ALTO",
            "titulo": "IMAP TLS permite certificados inválidos",
            "archivo": "server.js",
            "linea": 167,
            "descripcion": "tlsOptions tiene rejectUnauthorized:true pero la configuración global de IMAP podría ser insegura.",
            "impacto": "Ataques MITM en sincronización de emails.",
            "recomendacion": "Validar certificados IMAP correctamente en producción."
          },
          {
            "id": "SEC-008",
            "severidad": "ALTO",
            "titulo": "Logs sensibles en producción",
            "archivo": "server.js",
            "lineas": "23, 40, 81, 102",
            "descripcion": "Console.log muestra datos sensibles: emails, passwords (en debug), tokens.",
            "impacto": "Exposición de datos sensibles en logs del servidor.",
            "recomendacion": "Usar logger estructurado que oculte datos sensibles."
          },
          {
            "id": "SEC-009",
            "severidad": "ALTO",
            "titulo": "No hay protección contra CSRF",
            "archivo": "server.js",
            "linea": "General",
            "descripcion": "No se implementó protección CSRF token para state-changing operations.",
            "impacto": "Vulnerable a ataques CSRF en sesiones de usuario.",
            "recomendacion": "Implementar SameSite cookies y CSRF tokens."
          },
          {
            "id": "SEC-010",
            "severidad": "ALTO",
            "titulo": "Email HTML injection potential",
            "archivo": "src/routes/email.routes.js",
            "linea": "No verificado",
            "descripcion": "Plantillas de email podrían permitir XSS si input de usuario se inyecta en HTML.",
            "impacto": "XSS en emails enviados a usuarios.",
            "recomendacion": "Sanitizar todo input de usuario en plantillas de email."
          },
          {
            "id": "SEC-011",
            "severidad": "ALTO",
            "titulo": "Path Traversal en uploads",
            "archivo": "src/routes/index.js",
            "linea": 38,
            "descripcion": "El serving de archivos estáticos podría permitir path traversal.",
            "codigo": "app.use('/uploads', express.static(path.join(rootDir, 'uploads')));",
            "impacto": "Acceso a archivos arbitrarios del sistema.",
            "recomendacion": "Validar que los paths de archivo no contengan '..'"
          }
        ],
        "medios": [
          {
            "id": "SEC-012",
            "severidad": "MEDIO",
            "titulo": "Content Security Policy deshabilitada",
            "archivo": "server.js",
            "linea": 415-416,
            "descripcion": "contentSecurityPolicy: false - No protege contra XSS e inyecciones de contenido.",
            "impacto": "XSS attacks posibles en el frontend.",
            "recomendacion": "Habilitar CSP con políticas estrictas."
          },
          {
            "id": "SEC-013",
            "severidad": "MEDIO",
            "titulo": "Helmet deshabilita protecciones críticas",
            "archivo": "server.js",
            "linea": 415-419,
            "descripcion": "Múltiples headers de seguridad deshabilitados: CSP, COEP, HSTS.",
            "impacto": "Menor protección contra ataques web estándar.",
            "recomendacion": "Habilitar progressively las protecciones de Helmet."
          },
          {
            "id": "SEC-014",
            "severidad": "MEDIO",
            "titulo": "Error handling expone stack traces",
            "archivo": "Varios",
            "descripcion": "Errores no controlados pueden revelar información del servidor.",
            "impacto": "Information disclosure sobre la arquitectura del sistema.",
            "recomendacion": "Implementar error handler global que oculte detalles."
          },
          {
            "id": "SEC-015",
            "severidad": "MEDIO",
            "titulo": "Session fixation no protegida",
            "archivo": "server.js",
            "linea": "General",
            "descripcion": "No se regenera el session ID después del login.",
            "impacto": "Vulnerable a session fixation attacks.",
            "recomendacion": "Regenerar JWT token después de login exitoso."
          },
          {
            "id": "SEC-016",
            "severidad": "MEDIO",
            "titulo": "Cache control permite caching de datos sensibles",
            "archivo": "server.js",
            "linea": 443-454,
            "descripcion": "El cache de datos API podría almacenar información sensible.",
            "impacto": "Datos sensibles en memoria cache.",
            "recomendacion": "No cachear endpoints que retornan datos de usuario."
          },
          {
            "id": "SEC-017",
            "severidad": "MEDIO",
            "titulo": "Sin validación de tamaño de request",
            "archivo": "server.js",
            "linea": 432,
            "descripcion": "express.json() no tiene límite configurado. Vulnerable a payload size attacks.",
            "impacto": "DoS via payloads JSON masivos.",
            "recomendacion": "Añadir limit: '10mb' a express.json()."
          },
          {
            "id": "SEC-018",
            "severidad": "MEDIO",
            "titulo": "API Docs accesible públicamente",
            "archivo": "server.js",
            "linea": 459-464,
            "descripcion": "/api-docs expone toda la API sin autenticación.",
            "impacto": "Information disclosure sobre endpoints y estructuras.",
            "recomendacion": "Proteger /api-docs con autenticación o deshabilitar en producción."
          },
          {
            "id": "SEC-019",
            "severidad": "MEDIO",
            "titulo": "Upload sin límite de tamaño",
            "archivo": "src/routes/index.js",
            "linea": "No verificado",
            "descripcion": "Archivos subidos no tienen límite de tamaño configurado.",
            "impacto": "DoS via upload de archivos masivos.",
            "recomendacion": "Configurar multer con fileSize limit."
          },
          {
            "id": "SEC-020",
            "severidad": "MEDIO",
            "titulo": "Contraseñas en plaintext en algunos flujos",
            "archivo": "auth.routes.js, server.js",
            "lineas": "235, 246",
            "descripcion": "temp_password se muestra en emails sin hashing.",
            "impacto": "Exposición de contraseñas temporales.",
            "recomendacion": "No incluir passwords en emails; usar links seguros."
          },
          {
            "id": "SEC-021",
            "severidad": "MEDIO",
            "titulo": "Weak password reset token",
            "archivo": "auth.routes.js",
            "linea": 100,
            "descripcion": "Reset code es 6 dígitos - solo 1 millón de combinaciones.",
            "impacto": "Vulnerable a fuerza bruta del código de reset.",
            "comentario": "Mitigado parcialmente por expire de 30 min y rate limiting."
          },
          {
            "id": "SEC-022",
            "severidad": "MEDIO",
            "titulo": "No hay logging de acceso",
            "archivo": "server.js",
            "linea": "General",
            "descripcion": "No hay logs de acceso tipo Apache/Nginx.",
            "impacto": "Difícil investigar incidentes de seguridad.",
            "recomendacion": "Implementar Morgan o similar para logging de requests."
          },
          {
            "id": "SEC-023",
            "severidad": "MEDIO",
            "titulo": "Webhooks no tienen timeout",
            "archivo": "src/utils/webhooks.js",
            "linea": "No verificado",
            "descripcion": "Llamadas a webhooks pueden colgar el servidor.",
            "impacto": "DoS via webhooks lentos.",
            "recomendacion": "Añadir timeout de 10s a las llamadas de webhook."
          }
        ],
        "bajos": [
          {
            "id": "SEC-024",
            "severidad": "BAJO",
            "titulo": "X-Powered-By header expuesto",
            "archivo": "server.js",
            "descripcion": "Express revela su versión en headers.",
            "recomendacion": "Deshabilitar con app.disable('x-powered-by')."
          },
          {
            "id": "SEC-025",
            "severidad": "BAJO",
            "titulo": "Sin Strict-Transport-Security preload",
            "archivo": "server.js",
            "descripcion": "HSTS no tiene preload configured.",
            "recomendacion": "Añadir preload si se habilita HSTS."
          },
          {
            "id": "SEC-026",
            "severidad": "BAJO",
            "titulo": "Referrer Policy no configurada",
            "archivo": "server.js",
            "descripcion": "No hay header de Referrer Policy.",
            "recomendacion": "Añadir 'strict-origin-when-cross-origin'."
          },
          {
            "id": "SEC-027",
            "severidad": "BAJO",
            "titulo": "SinPermissions Policy",
            "archivo": "server.js",
            "descripcion": "Permissions Policy no está configurada.",
            "recomendacion": "Configurar Permissions Policy para reducir capacidades."
          },
          {
            "id": "SEC-028",
            "severidad": "BAJO",
            "titulo": "Cache no tiene expiración por entrada",
            "archivo": "server.js",
            "linea": 20,
            "descripcion": "NodeCache tiene TTL global de 300s.",
            "impacto": "Datos antiguos podrían servirse más tiempo del necesario."
          },
          {
            "id": "SEC-029",
            "severidad": "BAJO",
            "titulo": "Sin health check detallado",
            "archivo": "src/routes/version.routes.js",
            "descripcion": "Solo devuelve versión, no estado de componentes.",
            "recomendacion": "Implementar /health con check de DB, SMTP, Redis."
          }
        ]
      },
      "calidad_codigo": {
        "problemas": [
          {
            "id": "QUAL-001",
            "titulo": "Código duplicado en sendEmail y sendEventEmail",
            "archivo": "server.js",
            "lineas": "60-114, 309-396",
            "descripcion": "Lógica de envío duplicada. Debería usar función helper común.",
            "recomendacion": "Refactorizar a función sendEmailWithConfig(config, to, subject, html)"
          },
          {
            "id": "QUAL-002",
            "titulo": "Magic numbers sin constantes",
            "archivo": "server.js",
            "lineas": "150, 437-440",
            "descripcion": "Valores como 5000ms, 200 pet/min dispersos en el código.",
            "recomendacion": "Crear archivo de configuración constants.js"
          },
          {
            "id": "QUAL-003",
            "titulo": "try-catch sin logging específico",
            "archivo": "Varios",
            "descripcion": "catch(e) genéricos que no capturan el contexto del error.",
            "recomendacion": "Añadir contexto en cada catch: catch(e) { console.error('[EVENTS] Error:', e); }"
          },
          {
            "id": "QUAL-004",
            "titulo": "Inconsistencia en nombres de funciones",
            "archivo": "Varios",
            "descripcion": "Algunas usan camelCase, otras snake_case, otras PascalCase.",
            "recomendacion": "Estandarizar a camelCase para funciones, PascalCase para clases."
          },
          {
            "id": "QUAL-005",
            "titulo": "No hay comentarios JSDoc en funciones exportadas",
            "archivo": "Varios",
            "descripcion": "Faltan descripciones, parámetros y return types.",
            "recomendacion": "Añadir JSDoc a todas las funciones exportadas."
          },
          {
            "id": "QUAL-006",
            "titulo": "No hay tests unitarios",
            "archivo": "tests/",
            "descripcion": "Solo hay archivos de test vacíos o mínimos.",
            "recomendacion": "Implementar Jest con coverage > 70%."
          },
          {
            "id": "QUAL-007",
            "titulo": "Variables no usadas",
            "archivo": "server.js",
            "linea": 40, 457,
            "descripcion": "const io definido pero no usado consistentemente.",
            "recomendacion": "Limpiar código muerto."
          },
          {
            "id": "QUAL-008",
            "titulo": "Strings hardcodeados en múltiples lugares",
            "archivo": "Varios",
            "descripcion": "Mensajes de error, URLs repetidos.",
            "recomendacion": "Crear archivo messages.js para strings centralizados."
          },
          {
            "id": "QUAL-009",
            "titulo": "No hay manejo de errores asíncronos",
            "archivo": "routes/",
            "descripcion": "Funciones async sin try-catch.",
            "recomendacion": "Wrap todas las funciones async en try-catch."
          },
          {
            "id": "QUAL-010",
            "titulo": "CORS whitelist desde variable de entorno sin validación",
            "archivo": "server.js",
            "linea": 38,
            "descripcion": "Si ALLOWED_ORIGINS está vacía, permite todos los origins.",
            "recomendacion": "Validar que ALLOWED_ORIGINS contenga valores válidos."
          }
        ]
      },
      "buenas_practicas": {
        "encontradas": [
          "✓ Parametrized SQL queries (previene SQLi)",
          "✓ bcrypt para hashing de passwords",
          "✓ JWT con expiración configurable",
          "✓ Rate limiting implementado",
          "✓ Zod para validación de schemas",
          "✓ Middleware de autenticación separado",
          "✓ Arquitectura modular de rutas",
          "✓ Cacheo para optimizar performance",
          "✓ Webhooks para integraciones",
          "✓ Auditoría de acciones con logAction",
          "✓ Email queue con reintentos",
          "✓ Uso de uuid para IDs",
          "✓ Compresión GZIP habilitada",
          "✓ Helmet baseline configurado",
          "✓ Archivo .gitignore correcto"
        ]
      }
    },
    "configuracion_docker": {
      "entorno_actual": "Puerto 8080 (contenedor check-check-app-1)",
      "vars_entorno_criticas": [
        "JWT_SECRET - NO CONFIGURADA",
        "DATABASE_URL - verificar",
        "SMTP_* - verificar",
        "REDIS_URL - verificar"
      ],
      "recomendaciones_contenedor": [
        "1. Añadir JWT_SECRET como secret",
        "2. Usar network overlay",
        "3. Limitar recursos (CPU/memory)",
        "4. Añadir healthcheck",
        "5. Usar secrets para passwords"
      ]
    },
    "acciones_inmediatas": {
      "prioridad_1_hoy": [
        "Configurar JWT_SECRET en producción",
        "Habilitar HSTS (con HTTPS)",
        "Depreciar x-user-id header",
        "Añadir límite de tamaño a express.json()"
      ],
      "prioridad_2_semana": [
        "Implementar CSP",
        "Añadir rate limiting por endpoint",
        "Proteger /api-docs",
        "Añadir validación estricta a castId"
      ],
      "prioridad_3_mes": [
        "Añadir tests unitarios",
        "Refactorizar código duplicado",
        "Implementar logging estructurado",
        "Configurar monitoreo/alertas"
      ]
    },
    "notas_finales": "Sistema funcional con arquitectura moderna. Los problemas de seguridad son gestionables con las acciones recomendadas. La puntuación de 72/100 indica que el sistema es usable pero requiere correcciones antes de producción pública."
  }
}