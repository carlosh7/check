# PLAN DE TRABAJO - Email System V3.0 (Dual Config)

## ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL SYSTEM ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   SMTP CONFIG (Para ENVIAR emails)                         │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ SMTP_HOST: smtp.gmail.com                          │   │
│   │ SMTP_PORT: 587                                     │   │
│   │ SMTP_USER: email@gmail.com                         │   │
│   │ SMTP_PASS: ************                            │   │
│   │ SMTP_SECURE: false                                │   │
│   │ FROM_NAME: Check Pro                              │   │
│   │ FROM_EMAIL: noreply@check.com                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   IMAP CONFIG (Para RECIBIR/LEER emails)                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ IMAP_HOST: imap.gmail.com                         │   │
│   │ IMAP_PORT: 993                                    │   │
│   │ IMAP_USER: email@gmail.com                         │   │
│   │ IMAP_PASS: ************                            │   │
│   │ IMAP_TLS: true                                    │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   EMAIL LOGS (Guarda todos los emails)                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ - Enviados (via SMTP)                             │   │
│   │ - Recibidos (via IMAP)                            │   │
│   │ - Borradores                                       │   │
│   │ - Papelera                                        │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Arreglar Mailing (Plantillas de Evento)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 1.1 | Crear/verificar tabla `event_email_templates` | `database.js` |
| 1.2 | Seed data para plantillas de evento | `database.js` |
| 1.3 | Cargar y mostrar en UI de Mailing | `script.js` |

---

## FASE 2: Configuración Dual SMTP + IMAP
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 2.1 | Nueva tabla `smtp_config` separada (SMTP only) | `database.js` |
| 2.2 | Nueva tabla `imap_config` (IMAP only) | `database.js` |
| 2.3 | Endpoint GET/PUT `smtp-config` (SMTP) | `server.js` |
| 2.4 | Endpoint GET/PUT `imap-config` (IMAP) | `server.js` |
| 2.5 | UI: Secciones separadas en SMTP Config | `app-shell.html` |
| 2.6 | UI: Formularios SMTP e IMAP independientes | `app-shell.html` |
| 2.7 | Botón "Probar SMTP" | `script.js` |
| 2.8 | Botón "Probar IMAP" | `script.js` |

---

## FASE 3: Editor Dual de Plantillas (WYSIWYG + HTML)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 3.1 | Agregar librería Quill.js | `app-shell.html` |
| 3.2 | UI: Pestañas "Código" / "Visual" | `app-shell.html` |
| 3.3 | Preview de email en tiempo real | `script.js` |
| 3.4 | Tooltips con variables disponibles | `app-shell.html` |

---

## FASE 4: Sistema de Buzón (Email Logs)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 4.1 | Nueva tabla `email_logs` | `database.js` |
| 4.2 | Integrar logging en nodemailer (enviados) | `server.js` |
| 4.3 | Función para sincronizar IMAP (recibidos) | `server.js` |
| 4.4 | Endpoint GET emails con filtros | `server.js` |
| 4.5 | Endpoint POST sincronizar IMAP | `server.js` |
| 4.6 | Endpoint DELETE/ move to trash | `server.js` |
| 4.7 | UI: Pestaña "Buzón" | `app-shell.html` |
| 4.8 | Sub-tabs: BandejaEntrada, Enviados, Borradores, Papelera | `app-shell.html` |
| 4.9 | Lista de correos con paginación | `script.js` |
| 4.10 | Modal ver correo (headers, body, adjuntos) | `script.js` |

---

## FASE 5: Crear/Editar Plantillas (Global + Evento)
| Paso | Descripción | Archivos |
|------|-------------|----------|
| 5.1 | Botón "Nueva Plantilla" en SMTP | `app-shell.html` |
| 5.2 | Modal con selector de tipo | `app-shell.html` |
| 5.3 | Endpoint POST/DELETE plantillas globales | `server.js` |
| 5.4 | Botón "Nueva Plantilla" en Mailing | `app-shell.html` |
| 5.5 | Selector de tipo: Confirmación, Bienvenida, etc | `app-shell.html` |
| 5.6 | Endpoint POST plantillas de evento | `server.js` |

---

## ESTRUCTURA DE LA UI

### SMTP Config (view-smtp)
```
┌─────────────────────────────────────────────────────────┐
│  SMTP CONFIG                                     [?]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📤 CONFIGURACIÓN SMTP (Envío)                    │   │
│  │                                                  │   │
│  │ Host: [smtp.gmail.com___________] Port: [587]   │   │
│  │ Usuario: [email@gmail.com________]              │   │
│  │ Contraseña: [••••••••__________] [Mostrar]      │   │
│  │ Secure: [✓] TLS                                 │   │
│  │ From Name: [Check Pro_______]                   │   │
│  │ From Email: [noreply@check.com__]               │   │
│  │                                                  │   │
│  │ [Probar Conexión SMTP] [Guardar SMTP]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📥 CONFIGURACIÓN IMAP (Recepción)                │   │
│  │                                                  │   │
│  │ Host: [imap.gmail.com___________] Port: [993]  │   │
│  │ Usuario: [email@gmail.com________]              │   │
│  │ Contraseña: [••••••••__________] [Mostrar]      │   │
│  │ TLS: [✓]                                        │   │
│  │                                                  │   │
│  │ [Probar Conexión IMAP] [Guardar IMAP]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [ SMTP ] [ Plantillas ] [ Agenda ] [ Buzón ]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Buzón (nueva pestaña)
```
┌─────────────────────────────────────────────────────────┐
│  📬 BUZÓN DE CORREO                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [📥 Bandeja (23)] [📤 Enviados (145)] [📝 Borradores] │
│  [🗑️ Papelera] [+ Nuevo] [🔄 Sincronizar]             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☑ │ De            │ Asunto           │ Fecha  │   │
│  │ ☑ │ Juan Pérez    │ Confirmación...  │ 10:30  │   │
│  │ ☑ │ María García  │ Bienvenido al... │ 09:15  │   │
│  │ ☐ │ Carlos López  │ Recordatorio...  │ Ayer   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📧 Detalles del Correo                           │   │
│  │                                                  │   │
│  │ De: Juan Pérez <juan@email.com>                 │   │
│  │ Para: noreply@check.com                         │   │
│  │ Fecha: 20 Mar 2026, 10:30                       │   │
│  │ Asunto: Confirmación de registro                │   │
│  │                                                  │   │
│  │ ─────────────────────────────────────────────   │   │
│  │                                                  │   │
│  │ [Contenido del email...]                        │   │
│  │                                                  │   │
│  │ [Responder] [Reenviar] [Eliminar] [Mover]      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## VARIABLES PARA PLANTILLAS

### Globales:
`{{user_name}}`, `{{email}}`, `{{password}}`, `{{role}}`, `{{company_name}}`, `{{login_url}}`, `{{reset_url}}`, `{{reset_code}}`

### Por Evento:
`{{guest_name}}`, `{{guest_email}}`, `{{event_name}}`, `{{event_date}}`, `{{event_location}}`, `{{agenda}}`, `{{qr_code}}`, `{{checkin_time}}`

---

## TIEMPO ESTIMADO

| Fase | Descripción | Tiempo |
|------|-------------|--------|
| 1 | Arreglar Mailing | 30 min |
| 2 | Config Dual SMTP+IMAP | 45 min |
| 3 | Editor Dual | 45 min |
| 4 | Buzón IMAP | 2 horas |
| 5 | Crear Plantillas | 30 min |
| **TOTAL** | | **~4 horas** |

---

## RESPALDO
- Branch: `feature/app-shell`
- Backup: `backup-before-app-shell`

---

## PRÓXIMOS PASOS
1. Aprobar plan
2. Comenzar FASE 1

---

Documento: PLAN_EMAIL_SYSTEM_V3.md
Fecha: 2026-03-20
Versión: 3.0
