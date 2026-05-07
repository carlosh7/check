# Postura de Seguridad IA — Check Pro

Basado en el documento **"Proteger los Sistemas de IA: Manual para Responsables de Seguridad"** de CrowdStrike.

---

## Resumen Ejecutivo

| Area | Estado | Prioridad |
|------|--------|-----------|
| Visibilidad y gobernanza de IA | ❌ No implementado | 🔴 Alta |
| Cumplimiento normativo | 🟡 Parcial (40%) | 🟡 Media |
| Gobernanza de datos | 🟡 Parcial (50%) | 🟡 Media |
| Deteccion y respuesta | 🟡 Parcial (30%) | 🔴 Alta |
| Red Teaming | 🟡 Parcial (25%) | 🟡 Media |

**Conclusion:** El proyecto tiene bases solidas de seguridad web tradicional (JWT, CSRF, rate limiting, helmet, validacion Zod, auditoria) pero **CERO implementacion de seguridad especifica para IA**. Las settings de IA pre-creadas en BD son un riesgo si se activan sin los controles adecuados.

---

## 1. Visibilidad y Gobernanza de IA ❌ CRITICO

| Documento dice | Nosotros |
|---|---|
| Inventariar sistemas de IA | ❌ No existe |
| Detectar Shadow AI | ❌ No existe |
| Politicas de uso de IA | ❌ No existen |
| Gobernanza de agentes | ❌ No existe |
| Concienciacion/formacion | ❌ No existe |

### Settings de IA en BD (huerfanas)

En `/home/carlosh/Check/database.js` lineas 339-343 existen 4 settings pre-creadas:

| Setting | Valor |
|---------|-------|
| `ai_enabled` | `1` (habilitado por defecto) |
| `ai_openrouter_key` | `''` (vacia) |
| `ai_model` | `google/gemini-2.0-flash-lite-preview-02-05:free` |
| `ai_system_prompt` | Texto de system prompt para asistente |

**Riesgo:** La configuracion de IA esta pre-creada en BD pero **no hay backend, frontend, ni logica que las use**. Si se activa sin los controles adecuados (validacion de prompts, rate limiting por usuario de IA, logs de consultas, deteccion de inyeccion de prompts), representa un riesgo de seguridad.

### Archivo de referencia

- `/home/carlosh/Check/securing-ai-systems-a-playbook-for-security-leaders-es-es.pdf` — PDF de CrowdStrike presente en el repo pero no integrado ni referenciado en codigo.

---

## 2. Cumplimiento Normativo 🟡 PARCIAL

| Documento dice | Nosotros |
|---|---|
| Inventariar sistemas IA | ❌ No existe |
| Clasificar por riesgo | ❌ No existe |
| Trazabilidad (logs inmutables) | ✅ Sistema completo de audit logs |
| Codificar uso aceptado | ❌ No existe |
| Involucrar legal/privacidad | 🟡 Politicas en BD pero no GDPR explicito |

### Lo que SI tenemos

| Componente | Archivo | Detalle |
|---|---|---|
| Audit logging completo | `/home/carlosh/Check/src/security/audit.js` | 20+ acciones predefinidas, tabla `audit_logs` con indices |
| Logging de autenticacion | `/home/carlosh/Check/src/routes/auth.routes.js` | Login exitoso/fallido, creacion usuario, cambio password |
| Logging CRUD | Multiples rutas | EVENT_CREATED, GUEST_CHECKIN, etc. |
| Politica de privacidad | `/home/carlosh/Check/database.js:290-310` | Texto legal completo en BD |
| Terminos y condiciones | `/home/carlosh/Check/database.js:312-327` | Texto legal completo en BD |
| Consentimiento en registro | `/home/carlosh/Check/database.js:111` | Campo `reg_require_agreement` |
| Editor de textos legales | `/home/carlosh/Check/src/routes/settings.routes.js:35-51` | Endpoint PUT/GET `/api/settings/legal` |
| Boton de baja (unsubscribe) | `/home/carlosh/Check/database.js:149,531-532` | Columnas `unsubscribed` y `unsubscribe_token` |
| Whitelist/Blacklist emails | `/home/carlosh/Check/database.js:81-86,118-119` | `reg_email_whitelist`, `reg_email_blacklist` |
| Logger con sanitizacion | `/home/carlosh/Check/src/utils/logger.js` | Sanitiza passwords, tokens, API keys |

### Lo que NO tenemos

| Aspecto | Impacto |
|---|---|
| Derecho al olvido (data deletion) | No hay endpoint para solicitar eliminacion de datos personales |
| Portabilidad de datos | No hay exportacion de datos personales en formato estandar |
| Consentimiento granular | Solo checkbox unico "acepto terminos" |
| Notificacion de brechas | No hay sistema para notificar violaciones de datos |
| DPO (Data Protection Officer) | No hay figura de DPO ni canal de contacto |
| Evaluacion de impacto (DPIA) | No hay proceso de evaluacion de impacto en privacidad |
| Registro de actividades de tratamiento (RAT) | No hay inventario de actividades de tratamiento de datos |

---

## 3. Gobernanza de Datos 🟡 PARCIAL

| Documento dice | Nosotros |
|---|---|
| Clasificacion y confidencialidad | ❌ No hay etiquetado PII/PHI/IP |
| Consentimiento y procedencia | 🟡 Consentimiento basico, sin procedencia |
| Limites de acceso Zero Trust | ✅ JWT + RBAC (5 roles) + CORS whitelist |
| Sanear datos de entrenamiento | ❌ No aplica (no hay training de modelos) |
| Segmentacion entornos | ✅ BD separadas por evento |

### Lo que SI tenemos

| Componente | Archivo | Detalle |
|---|---|---|
| Aislamiento de datos por evento | `/home/carlosh/Check/src/utils/database-manager.js` | BD SQLite independiente por evento |
| Autenticacion JWT | `/home/carlosh/Check/src/security/jwt.js` | Tokens con expiracion configurable |
| RBAC (5 roles) | `/home/carlosh/Check/src/middleware/auth.js` | ADMIN, PRODUCTOR, STAFF, CLIENTE, LOGISTICO |
| Proteccion CSRF | `/home/carlosh/Check/src/middleware/csrf.js` | Verificacion de Origin header + whitelist |
| CORS configurado | `/home/carlosh/Check/server.js:130-149` | Whitelist con soporte red local |
| Rate limiting | `/home/carlosh/Check/server.js:167-206` | 4 niveles: general, auth, guests, uploads |
| Helmet Security Headers | `/home/carlosh/Check/server.js:95-129` | CSP, HSTS, X-Frame-Options, etc. |
| Validacion Zod | `/home/carlosh/Check/src/security/validation.js` | Schemas para endpoints criticos |
| Captcha matematico | `/home/carlosh/Check/src/security/captcha.js` | Sin dependencias externas |
| Webhooks con HMAC | `/home/carlosh/Check/src/utils/webhooks.js` | Firma HMAC-SHA256 |
| Proteccion path traversal | `/home/carlosh/Check/src/routes/index.js:70-78` | Bloqueo `..`, `%2e%2e`, `//` |
| Upload seguro (Multer) | `/home/carlosh/Check/src/routes/index.js:33-55` | memoryStorage, 5MB limite, MIME whitelist |
| Limite payload JSON | `/home/carlosh/Check/server.js:151` | `express.json({ limit: '50mb' })` |
| Backups automatizados | `/home/carlosh/Check/src/utils/backup.js` | Cada 6 horas, retencion 7 dias |
| Error handler seguro | `/home/carlosh/Check/server.js:324-355` | Sin stack traces en produccion |

### Lo que NO tenemos

| Aspecto | Impacto |
|---|---|
| Clasificacion de datos | No hay etiquetado por sensibilidad (publico, interno, confidencial, restringido) |
| DLP (Data Loss Prevention) | No hay prevencion de perdida de datos en exportaciones/descargas |
| Etiquetado de campos sensibles | No hay metadatos que indiquen que campos son PII/SPI |
| Encriptacion en reposo | SQLite sin sqlcipher |
| Encriptacion de backups | Backups almacenados sin encriptar |
| Mascara de datos en UI | Datos sensibles se muestran completos en interfaz |
| Auditoria de acceso a datos | Solo audit de cambios (write), no de lecturas (read) |
| Gestion de sesiones | JWT sin blacklist, sin refresh tokens, sin revocacion |
| Politicas de retencion de datos | No hay configuracion de periodos de retencion |

---

## 4. Deteccion y Respuesta 🟡 PARCIAL

| Documento dice | Nosotros |
|---|---|
| Visibilidad runtime IA | ❌ No existe |
| Deteccion basada en comportamiento | ❌ No existe |
| Proteccion datos en tiempo real | ❌ No hay DLP |
| Respuesta automatizada | ❌ No existe |
| Integracion SOC/SIEM | ❌ No existe |

### Lo que SI tenemos

| Componente | Archivo | Detalle |
|---|---|---|
| Health checks | `/home/carlosh/Check/src/routes/version.routes.js:18-95` | `/api/health`, `/api/health/redis`, `/api/health/full` |
| Monitoreo de emails | `/home/carlosh/Check/database.js:696-727` | Tablas `email_logs` y `email_queue` con reintentos |
| Webhook status tracking | `/home/carlosh/Check/src/utils/webhooks.js:177-202` | Resultados de envio con exito/fallo |
| Logging de errores global | `/home/carlosh/Check/server.js:324-355` | Logea IP, path, method por error |
| Prevencion de fuerza bruta | `/home/carlosh/Check/server.js:176-183,201-206` | Rate limit estricto en login, signup, password-reset |
| Deteccion de path traversal | `/home/carlosh/Check/src/routes/index.js:70-78` | Bloqueo y log de intentos |

### Lo que NO tenemos

| Aspecto | Impacto |
|---|---|
| Deteccion de anomalias en IA | No hay monitoreo de patrones anomalos (prompts inusuales, volumenes anormales) |
| SIEM / Monitoreo centralizado | No hay integracion con SIEM ni exportacion de logs |
| Alertas automatizadas | No hay sistema de alertas para eventos de seguridad |
| Deteccion de inyeccion de prompts | No hay validacion de prompts contra inyeccion |
| Rate limiting por usuario | Los rate limiters son por IP, no por usuario autenticado |
| Deteccion de account takeover | No hay deteccion de accesos desde ubicaciones inusuales |
| Incident response plan | No hay documentacion de procedimientos de respuesta a incidentes |
| Threat intelligence | No hay feeds de amenazas ni integracion con bases de datos de vulnerabilidades |

---

## 5. Red Teaming 🟡 PARCIAL

| Documento dice | Nosotros |
|---|---|
| Inyeccion de prompts | ❌ No existe |
| Filtracion de datos | ❌ No testeado |
| Manipulacion de salida | ❌ No testeado |
| Uso indebido de complementos | ❌ No testeado |
| Validacion comportamiento agentes | ❌ No existe |

### Lo que SI tenemos

| Componente | Archivo | Detalle |
|---|---|---|
| Tests de validacion Zod | `/home/carlosh/Check/tests/security.test.js` | 25+ tests de schemas de validacion |
| Tests de helpers de seguridad | `/home/carlosh/Check/tests/helpers.security.test.js` | Sanitizacion, SQL injection, path traversal |
| Tests de CSRF middleware | `/home/carlosh/Check/tests/middleware.test.js` | Allowed origins, GET/POST, paths |
| Tests de logger sanitization | `/home/carlosh/Check/tests/security.test.js:8-79` | Redaccion de passwords, tokens |
| Validacion de entrada con Zod | `/home/carlosh/Check/src/security/validation.js` | Schemas para login, signup, eventos, invitados, etc. |

### Lo que NO tenemos

| Aspecto | Impacto |
|---|---|
| Tests de penetracion | No hay pruebas automatizadas (OWASP ZAP, etc.) |
| Red teaming para IA | No hay pruebas adversariales de modelos (jailbreaking, prompt injection, data poisoning) |
| Validacion de modelos de IA | No hay evaluacion de sesgo, precision o robustness |
| Fuzzing de API | No hay tests de fuzzing en endpoints |
| Dependency scanning | No hay escaneo automatizado de vulnerabilidades en dependencias |
| SAST/DAST | No hay analisis estatico (SAST) ni dinamico (DAST) |
| Security hardening tests | No hay tests de configuracion de headers, CSP, CORS |
| Pruebas de carga/estres | No hay pruebas de resistencia contra DoS/DDoS |

---

## Features Planificadas (FASE S)

### [FS-01] Shadow AI Detection & Governance

| Campo | Valor |
|---|---|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | Ninguna |
| **Inspiracion** | `docs/SECURITY_IA.md` + PDF CrowdStrike |
| **Complejidad** | M |

**Descripcion:** Detectar y gobernar el uso de IA no autorizada (Shadow AI) en el entorno:
- Inventario de modelos/agentes de IA en uso
- Deteccion de extensiones de navegador y herramientas SaaS con IA
- Politicas de uso aceptado de IA
- Panel de gobernanza con listado de sistemas de IA detectados

**Backend:**
- Endpoint `GET /api/security/ai/inventory` — listar sistemas de IA detectados
- Endpoint `POST /api/security/ai/policies` — gestionar politicas de uso

**Frontend:**
- Panel "Seguridad IA" en configuracion global
- Tabla de inventario con tipo, modelo, datos que procesa, riesgo

**Criterios de Aceptacion:**
- [ ] Inventario visible de sistemas de IA en el entorno
- [ ] Politicas de uso aceptado configurables
- [ ] Alertas cuando se detecta IA no autorizada

---

### [FS-02] AI Compliance & Data Governance

| Campo | Valor |
|---|---|
| **Prioridad** | 🟡 Media |
| **Dependencias** | Ninguna |
| **Inspiracion** | `docs/SECURITY_IA.md` + Ley de IA UE |
| **Complejidad** | M |

**Descripcion:** Implementar controles de cumplimiento normativo y gobernanza de datos para IA:
- Clasificacion de datos por sensibilidad (publico, interno, confidencial, restringido)
- Etiquetado de campos PII/SPI en BD
- Derecho al olvido (endpoint de eliminacion de datos personales)
- Portabilidad de datos (exportacion en formato estandar)
- Logs de acceso a datos (auditoria de lecturas, no solo escrituras)

**Cambios en BD:**
- Tabla `data_classification` (table_name, column_name, classification, notes)
- Columna `data_classification` en metadata de tablas
- Endpoint `DELETE /api/guests/:id/personal-data` — derecho al olvido
- Endpoint `GET /api/guests/:id/export` — portabilidad

**Criterios de Aceptacion:**
- [ ] Campos PII identificados y etiquetados en BD
- [ ] Usuario puede solicitar eliminacion de sus datos
- [ ] Exportacion de datos personales en JSON
- [ ] Logs de acceso a datos sensibles (lectura)

---

### [FS-03] AI Detection & Response (AIDR)

| Campo | Valor |
|---|---|
| **Prioridad** | 🔴 Alta |
| **Dependencias** | FS-01 (inventario de IA) |
| **Inspiracion** | `docs/SECURITY_IA.md` |
| **Complejidad** | XL |

**Descripcion:** Sistema de deteccion y respuesta para interacciones con IA:
- Monitoreo de prompts y respuestas de LLM
- Deteccion de inyeccion de prompts
- Rate limiting por usuario para consultas de IA
- Alertas automatizadas para comportamiento anomalo
- DLP para datos sensibles en prompts/salidas

**Backend:**
- Middleware de validacion de prompts contra inyeccion
- Endpoint `POST /api/ai/chat` — con logging y deteccion
- Endpoint `GET /api/security/ai/logs` — consultas de IA registradas
- Sistema de alertas: `POST /api/security/alerts`

**Criterios de Aceptacion:**
- [ ] Prompts validados contra inyeccion antes de enviar a LLM
- [ ] Logs de todas las consultas de IA con usuario, prompt, respuesta
- [ ] Alertas configuradas para comportamiento anomalo
- [ ] Datos sensibles enmascarados en logs

---

### [FS-04] AI Red Teaming

| Campo | Valor |
|---|---|
| **Prioridad** | 🟡 Media |
| **Dependencias** | FS-01, FS-03 |
| **Inspiracion** | `docs/SECURITY_IA.md` + MITRE ATLAS + OWASP Top 10 LLM |
| **Complejidad** | M |

**Descripcion:** Pruebas de seguridad adversarial para sistemas de IA:
- Tests automatizados de inyeccion de prompts
- Pruebas de filtracion de datos
- Validacion de comportamiento de agentes
- Escaneo de dependencias (npm audit en CI)
- Tests de hardening (headers CSP, CORS, etc.)

**Tests:**
- `tests/ai/` — carpeta nueva con tests de seguridad de IA
- Tests de jailbreaking, prompt injection, data exfiltration
- Integracion con `npm audit` en CI

**Criterios de Aceptacion:**
- [ ] Tests de inyeccion de prompts pasan
- [ ] Tests de filtracion de datos pasan
- [ ] npm audit sin vulnerabilidades criticas
- [ ] Tests de hardening de headers pasan

---

## Referencias

- `/home/carlosh/Check/securing-ai-systems-a-playbook-for-security-leaders-es-es.pdf` — Documento original de CrowdStrike
- `MITRE ATLAS` — https://atlas.mitre.org/
- `OWASP Top 10 LLM` — https://owasp.org/www-project-top-10-for-llm-applications/
- `OWASP Top 10 Agentic` — https://genai.owasp.org/
