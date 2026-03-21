# PLAN DE TRABAJO - Email System Enhancement V2.0

## FASE 1: Arreglar Plantillas de Evento (Mailing)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 1.1 | Verificar/crear tabla `event_email_templates` y seed data | `database.js` |
| 1.2 | Crear plantillas por defecto cuando se crea un evento | `database.js` |
| 1.3 | Cargar y mostrar plantillas de evento en Mailing | `script.js` |

---

## FASE 2: Crear/Editar Plantillas (SMTP Global)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 2.1 | Botón "Crear Nueva Plantilla" en SMTP Config | `app-shell.html` |
| 2.2 | Modal con selector: tipo de plantilla | `app-shell.html` |
| 2.3 | Endpoint POST para crear plantilla global | `server.js` |
| 2.4 | Endpoint DELETE para eliminar plantilla | `server.js` |

---

## FASE 3: Editor de Email Dual (WYSIWYG + HTML)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 3.1 | Agregar librería WYSIWYG (Quill.js) | `app-shell.html` |
| 3.2 | UI: Pestañas "Código" / "Visual" | `app-shell.html` |
| 3.3 | Preview de email en tiempo real | `script.js` |
| 3.4 | Tooltips con variables disponibles | `app-shell.html` |

---

## FASE 4: Buzón SMTP Completo (IMAP)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 4.1 | Nueva tabla `email_logs` | `database.js` |
| 4.2 | Integrar IMAP con nodemailer (recibidos) | `server.js` |
| 4.3 | Integrar SMTP (enviados) + logging | `server.js` |
| 4.4 | Endpoint GET emails (con paginación) | `server.js` |
| 4.5 | Endpoint GET/POST para sincronizar IMAP | `server.js` |
| 4.6 | UI: Pestaña "Buzón" en SMTP Config | `app-shell.html` |
| 4.7 | Sub-tabs: BandejaEntrada, Enviados, Borradores, Papelera | `app-shell.html` |
| 4.8 | Lista de correos con paginación | `script.js` |
| 4.9 | Modal para ver correo individual | `script.js` |
| 4.10 | Botón "Sincronizar" para recibir correos | `script.js` |

---

## FASE 5: Crear/Editar Plantillas de Evento (Mailing)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 5.1 | Botón "Crear Nueva Plantilla" en Mailing | `app-shell.html` |
| 5.2 | Selector de tipo: Confirmación, Bienvenida, etc | `app-shell.html` |
| 5.3 | Editor dual (WYSIWYG + HTML) | `app-shell.html` |
| 5.4 | Endpoint POST para crear plantilla evento | `server.js` |

---

## FASE 6: Configuración IMAP en SMTP Config
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 6.1 | Agregar campos IMAP en config SMTP | `app-shell.html` |
| 6.2 | Endpoint PUT para guardar config IMAP | `server.js` |
| 6.3 | Botón "Probar Conexión IMAP" | `script.js` |

---

## CONFIGURACIÓN REQUERIDA (IMAP)

El usuario necesitará configurar:
```
IMAP_HOST = imap.gmail.com (o del proveedor)
IMAP_PORT = 993
IMAP_USER = email@ejemplo.com
IMAP_PASS = contraseña (o App Password)
```

Para Gmail: Necesita "Contraseñas de aplicaciones"
https://support.google.com/accounts/answer/185833

---

## TIEMPO ESTIMADO POR FASE

| Fase | Descripción | Tiempo |
|------|-------------|--------|
| 1 | Arreglar Mailing | 30 min |
| 2 | Crear plantillas SMTP | 30 min |
| 3 | Editor dual | 45 min |
| 4 | Buzón IMAP | 2 horas |
| 5 | Crear plantillas Evento | 30 min |
| 6 | Config IMAP | 15 min |
| **TOTAL** | | **~4.5 horas** |

---

## VARIABLES DISPONIBLES PARA PLANTILLAS

### Globales (SMTP):
- `{{user_name}}` - Nombre del usuario
- `{{email}}` - Email del usuario
- `{{password}}` - Contraseña/contraseña temporal
- `{{role}}` - Rol del usuario
- `{{company_name}}` - Nombre de empresa
- `{{login_url}}` - URL de login
- `{{reset_url}}` - URL de restablecimiento
- `{{reset_code}}` - Código de verificación

### Por Evento (Mailing):
- `{{guest_name}}` - Nombre del invitado
- `{{guest_email}}` - Email del invitado
- `{{event_name}}` - Nombre del evento
- `{{event_date}}` - Fecha del evento
- `{{event_location}}` - Ubicación del evento
- `{{agenda}}` - Agenda formateada
- `{{qr_code}}` - Código QR de registro
- `{{checkin_time}}` - Hora de check-in

---

## RESPALDO

- Branch actual: `feature/app-shell`
- Branch backup: `backup-before-app-shell`
- Commit actual: `d5b4b07`

---

Documento creado: 2026-03-20
Versión: 2.0
