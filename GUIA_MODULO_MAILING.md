# Guía: Módulo de Mailing

> **Qué funcionalidades queremos, no cómo implementarlas.**

---

## 1. Estructura del Sistema

### Nombres del Módulo según el contexto:
- **En el SISTEMA (Admin)**: Se llama **"Email"**
- **En cada EVENTO**: Se llama **"Mailing"**

### Idea Principal
El sistema funciona así:

1. **En el SISTEMA (Admin)**: El módulo "Email" contiene la configuración global de cuentas, DNS, etc.
2. **En cada EVENTO**: El módulo "Mailing" es una copia del sistema para ese evento específico
3. **Cuando se crea un evento**, se crea una **COPIA EXACTA** del módulo "Email" del sistema
4. **El productor del evento** administra TODO desde su módulo "Mailing" del evento

---

## 2. El Módulo Contiene:

### 2.1 Cuentas SMTP/IMAP
Cada módulo puede tener sus propias cuentas de email:

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre identificador |
| Servidor SMTP | smtp.tudominio.com, etc. |
| Puerto SMTP | 587 (TLS) o 465 (SSL) |
| Usuario SMTP | usuario@tudominio.com |
| Contraseña SMTP | Contraseña o app password |
| Usar SSL/TLS | Sí/No |
| Servidor IMAP | imap.tudominio.com, etc. |
| Puerto IMAP | 993 |
| Usuario IMAP | usuario@tudominio.com |
| Contraseña IMAP | Contraseña |
| Usar SSL IMAP | Sí/No |
| Carpeta IMAP | INBOX, Sent, etc. |
| Nombre remitente | "Mi Empresa" |
| Email remitente | noreply@tudominio.com |
| Es cuenta por defecto | Sí/No |
| Activa | Sí/No |
| Límite diario | 1000 emails por día (por cuenta) |

**Funcionalidades:**
- Crear, editar, eliminar cuentas
- Probar conexión SMTP
- Probar conexión IMAP
- Activar/desactivar sin borrar
- Ver cuántos emails envió hoy
- **Instructivo de configuración** (ver sección 2.1.1)

---

#### 2.1.1 Instructivo de Configuración de Cuenta

Al crear o editar una cuenta, debe mostrarse un **instructivo paso a paso** dependiendo del proveedor:

**Para GMAIL:**
```
1. Ve a tu cuenta de Google → Seguridad
2. Habilita "Verificación en dos pasos"
3. Ve a "Contraseñas de aplicaciones"
4. Genera una nueva contraseña de 16 caracteres
5. Usa esa contraseña en "Contraseña SMTP"
6. Para IMAP: usa tu contraseña normal de Google
```

**Para OUTLOOK/HOTMAIL:**
```
1. Ve a configuración de cuenta de Microsoft
2. Habilita IMAP/POP
3. Genera una contraseña de aplicación si tienes 2FA
4. Usa esos datos en la configuración
```

**Para OTROS PROVEEDORES (genérico):**
```
1. Busca en la ayuda de tu proveedor: "configuración SMTP/IMAP"
2. Usually:
   - SMTP: smtp.tudominio.com, puerto 587 o 465
   - IMAP: imap.tudominio.com, puerto 993
3. Si tienes dudas, contacta a tu proveedor de email
```

**Botón de ayuda:** Must show this guide when user clicks "Necesito ayuda"

### 2.2 Visor de Mailbox (IMAP)
- Seleccionar cuenta IMAP
- Seleccionar carpeta (INBOX, Sent, Spam)
- Ver lista de mensajes
- Abrir y leer contenido
- Descargar adjuntos

### 2.3 Contactos
- Ver todos los invitados del evento
- Filtrar por estado (confirmados, pendientes, rechazados)
- Filtrar por grupo
- Contador por filtro

### 2.4 Plantillas (Biblioteca - Se eligen en el Compositor)

**IMPORTANTE:** Las plantillas NO son una sección separada del menú. Se eligen **dentro del Compositor** al crear un email o campaña.

#### Biblioteca de Plantillas de Eventos
Cuando se crea un evento, **se copian estas plantillas** a ese evento:

| # | Plantilla | Cuándo usarla |
|---|-----------|---------------|
| 1 | Invitación | Primera comunicación invitando al evento |
| 2 | Recordatorio 7 días | Una semana antes del evento |
| 3 | Recordatorio 3 días | Tres días antes del evento |
| 4 | Recordatorio 1 día | Un día antes del evento |
| 5 | Recordatorio horas | Horas antes del evento |
| 6 | Confirmación asistencia | Cuando el invitado confirma |
| 7 | Rechazo asistencia | Cuando el invitado decline |
| 8 | Cambio de fecha | Cuando cambia la fecha/hora |
| 9 | Cambio de ubicación | Cuando cambia el lugar |
| 10 | Cancelación evento | Cuando se cancela el evento |
| 11 | Agradecimiento post-evento | Después del evento |
| 12 | Encuesta post-evento | Para pedir feedback |

**Cada plantilla incluye:**
- Diseño visual completo (header, colors, footer)
- Texto de comunicación profesional
- Variables insertadas donde corresponde

**Acceso en el Compositor:**
- Click en "Elegir Plantilla" → Se despliega lista
- Al elegir, se carga automáticamente el diseño y contenido
- El usuario puede modificarlo después

---

## 3. Diseño de las Plantillas

### 3.1 Estilo: Corporativo Similar a la App

**Características del diseño:**
- Colores: **Gris y Morado** (gradiente #8b5cf6 a #7c4dff - estilo actual de la app)
- Fuentes: DM Sans (la misma que usa la app)
- Header con logo de la empresa (gradiente gris-morado)
- Footer con datos de contacto y redes sociales
- Diseño responsive (se ve bien en móvil y desktop)
- Botones con estilo elegante color morado

### 3.2 Estructura Base de cada Plantilla

```html
<!-- ESTRUCTURA BASE -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{event_name}}</title>
    <style>
        /* Reset y estilos base */
        body { margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }
        /* Colores corporativos - Gris y Morado */
        .primary-color { color: #8b5cf6; }
        .bg-primary { background-color: #8b5cf6; }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background-color: #f5f5f5;">
    <!-- Contenedor principal -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center">
                <!-- Email container -->
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- HEADER con logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c4dff 100%); padding: 30px; text-align: center;">
                            <!-- Logo de la empresa -->
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{company_name}}</h1>
                        </td>
                    </tr>
                    
                    <!-- CONTENIDO -->
                    <tr>
                        <td style="padding: 40px 30px; color: #333333;">
                            <!-- Aquí va el contenido específico de cada plantilla -->
                        </td>
                    </tr>
                    
                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">
                                {{company_name}} - {{company_address}}
                            </p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">
                                © {{current_year}} Todos los derechos reservados
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

### 3.3 Texto de Comunicación para Cada Plantilla

#### PLANTILLA 1: Invitación
**Asunto:** Estás invitado a {{event_name}}

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

Te encantará este evento.

{{event_name}}

📅 {{event_date}}
🕐 {{event_time}}
📍 {{event_location}}

{{event_description}}

{{botón_confirmar}}

Si no puedes asistir, por favor háznoslo saber.

¡Te esperamos!
```

---

#### PLANTILLA 2: Recordatorio 7 días
**Asunto:** Recordatorio: {{event_name}} es en 7 días

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

Solo faltan 7 días para {{event_name}}!

📅 {{event_date}}
🕐 {{event_time}}
📍 {{event_location}}

¿Te acompañamos?

{{botón_confirmar}}

¡Te esperamos con gusto!
```

---

#### PLANTILLA 3: Recordatorio 3 días
**Asunto:** {{event_name}} - Recordatorio en 3 días

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

Faltan solo 3 días para {{event_name}} 🎉

📅 {{event_date}}
🕐 {{event_time}}
📍 {{event_location}}

Recuerda confirmar tu asistencia.

{{botón_confirmar}}

¡Nos vemos pronto!
```

---

#### PLANTILLA 4: Recordatorio 1 día
**Asunto:** Mañana es {{event_name}} - No olvides confirmar

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

¡Mañana es el gran día! {{event_name}}

📅 {{event_date}}
🕐 {{event_time}}
📍 {{event_location}}

Confirma tu asistencia si aún no lo has hecho.

{{botón_confirmar}}

¡Te esperamos mañana!
```

---

#### PLANTILLA 5: Recordatorio Horas
**Asunto:** {{event_name}} - Hoy a las {{event_time}}

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

¡Hoy te vemos en {{event_name}}!

📍 {{event_location}}
🕐 {{event_time}}

Tu código QR de acceso:

{{qr_code}}

¡Te esperamos!
```

---

#### PLANTILLA 6: Confirmación Asistencia
**Asunto:** Confirmación - {{event_name}}

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

¡Gracias por confirmar tu asistencia a {{event_name}}!

Te esperamos:

📅 {{event_date}}
🕐 {{event_time}}
📍 {{event_location}}

Tu código QR de acceso:

{{qr_code}}

Guarda este email para el día del evento.

¡hasta luego!
```

---

#### PLANTILLA 7: Rechazo Asistencia
**Asunto:** Entendido - {{event_name}}

**Cuerpo:**
```
Hola {{guest_first_name}},

Lamentamos que no puedas asistir a {{event_name}}.

Te informaremos sobre futuros eventos que podrían interesarte.

¡Gracias por tu sincera respuesta!

Saludos cordiales.
```

---

#### PLANTILLA 8: Cambio de Fecha
**Asunto:** Actualización: {{event_name}} ha cambiado de fecha

**Cuerpo:**
```
Hola {{guest_first_name}},

Te informamos que {{event_name}} ha cambiado de fecha.

📅 Nueva fecha: {{event_date}}
🕐 Nueva hora: {{event_time}}
📍 {{event_location}}

Por favor confirma tu asistencia con la nueva fecha.

{{botón_confirmar}}

Disculpa las inconveniencias.
```

---

#### PLANTILLA 9: Cambio de Ubicación
**Asunto:** Actualización: {{event_name}} - Nuevo lugar

**Cuerpo:**
```
Hola {{guest_first_name}},

Te informamos que la ubicación de {{event_name}} ha cambiado.

📍 Nuevo lugar: {{event_location}}
📌 Dirección: {{event_address}}

Mantén la misma hora: {{event_time}}

{{botón_confirmar}}

¡Te esperamos en el nuevo lugar!
```

---

#### PLANTILLA 10: Cancelación Evento
**Asunto:** Cancelación: {{event_name}}

**Cuerpo:**
```
Hola {{guest_first_name}},

Lamentamos informarte que {{event_name}} ha sido cancelado.

Te reembolsaremos cualquier pago realizado según las políticas del evento.

Disculpa las inconveniencias que esto pueda causarte.

Saludos cordales.
```

---

#### PLANTILLA 11: Agradecimiento Post-Evento
**Asunto:** Gracias por asistir a {{event_name}}

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

Gracias por acompañarnos en {{event_name}}.

Fue un placer compartir este momento contigo.

 Esperamos que hayas disfrutando de la experiencia.

¡Nos vemos en el próximo evento!

Saludos cordales.
```

---

#### PLANTILLA 12: Encuesta Post-Evento
**Asunto:** Cuéntanos tu experiencia - {{event_name}}

**Cuerpo:**
```
¡Hola {{guest_first_name}}!

Gracias por asistir a {{event_name}}.

Tu opinión es muy importante para nosotros. 
Ayúdanos a mejorar con tu retroalimentación.

{{botón_encuesta}}

Te tomó solo 2 minutos.

¡Gracias por tu tiempo!
```

---

### 3.4 Editor de Plantillas

El usuario debe poder editar las plantillas en:

**Modo Visual (WYSIWYG):**
- Editor visual tipo Word
- Arrastrar y soltar elementos
- Cambiar colores
- Cambiar imágenes
- Cambiar texto
- Ver preview en tiempo real
- Importar archivos imagenes

**Modo HTML:**
- Código fuente editable
- Para usuarios que saben HTML
- Validar que el HTML sea correcto

### 2.5 Campañas

**Crear campaña - Paso 1: Contenido**
- Elegir plantilla existente
- O crear email desde cero
- Editar asunto y cuerpo
- Previsualizar

**Crear campaña - Paso 2: Destinatarios**
- Elegir de contactos:
  - Todos los contactos
  - Solo confirmados
  - Solo pendientes
  - Solo un grupo específico
- Ver cuántos coinciden

**Crear campaña - Paso 3: Programación**
- Enviar ahora
- Programar para fecha/hora específica

**Estados de campaña:**
| Estado | Significado |
|--------|-------------|
| DRAFT | Guardada, no se ha enviado |
| SCHEDULED | Programada para fecha futura |
| SENDING | Enviándose actualmente |
| SENT | Completamente enviada |
| PAUSED | Pausada por el usuario |
| CANCELLED | Cancelada |

---

## 4. Variables en las Plantillas

El sistema reemplaza automáticamente:

### Del Contacto/Invitado
- {{guest_name}} - Nombre completo
- {{guest_first_name}} - Primer nombre
- {{guest_last_name}} - Apellido
- {{guest_email}} - Email
- {{guest_phone}} - Teléfono
- {{guest_company}} - Empresa
- {{guest_position}} - Cargo
- {{guest_group}} - Grupo
- {{guest_status}} - Estado
- {{qr_code}} - Imagen del QR
- {{qr_url}} - URL del QR

### Del Evento
- {{event_name}} - Nombre
- {{event_date}} - Fecha formateada
- {{event_time}} - Hora
- {{event_location}} - Ubicación
- {{event_address}} - Dirección
- {{event_venue}} - Recinto
- {{event_description}} - Descripción

### Del Sistema
- {{current_date}} - Fecha actual
- {{current_year}} - Año actual
- {{company_name}} - Nombre de la empresa
- {{company_address}} - Dirección de la empresa
- {{unsubscribe_link}} - Link cancelar
- {{view_online}} - Ver email online
- {{add_to_calendar}} - Agregar a calendario
- {{botón_confirmar}} - Botón para confirmar
- {{botón_rechazar}} - Botón para rechazar
- {{botón_encuesta}} - Botón para encuesta

---

## 5. Estructura de Vistas del Módulo

> **En SISTEMA (Admin):** Este módulo se llama **"Email"**
> **En EVENTOS:** Este módulo se llama **"Mailing"**
> Ambos tienen la MISMA estructura y funcionalidades.

```
MÓDULO (Email en Sistema / Mailing en Eventos)
│
│
├── 1. CUENTAS
│   ├── Lista de cuentas SMTP/IMAP
│   ├── Crear cuenta
│   ├── Editar cuenta
│   ├── Eliminar cuenta
│   └── Probar conexiones (SMTP + IMAP)
│
├── 2. MAILBOX
│   ├── Selector de cuenta (IMAP y SMTP)
│   │   └── Dropdown mostrando: Cuenta nombre (SMTP+IMAP / SMTP / IMAP)
│   ├── Selector de carpeta (Recibidos, Enviados, Borradores, Eliminados, Spam)
│   ├── Lista de mensajes (remitente, asunto, fecha, leído/no leído)
│   ├── ACCIONES DESDE MAILBOX:
│   │   ├── ✓ Nuevo Email → Se abre el Compositor
│   │   ├── ↩ Responder → Se abre el Compositor con respuesta
│   │   └── ✎ Ver detalles → Ver email completo
│   │
│   └── [COMPOSITOR DE EMAIL - Se abre para nuevo/responder]
│       ├── Cuenta para enviar: [Seleccionar cuenta SMTP ▼]
│       │   └── Lista de cuentas SMTP disponibles
│       ├── Para: Campo de destinatario
│       ├── Destinatarios:
│       │   ├── Elegir contacto individual
│       │   └── Elegir base de datos
│       │       ├── Todos los contactos
│       │       ├── Solo confirmados
│       │       ├── Solo pendientes
│       │       └── Por grupo específico
│       │   └── Filtrar: seleccionar grupos
│       ├── Asunto: Campo de texto
│       ├── Contenido:
│       │   ├── Elegir plantilla
│       │   │   ├── Lista de plantillas
│       │   │   └── Al elegir, se carga el contenido
│       │   └── O empezar en blanco
│       ├── Editor de contenido:
│       │   ├── Modo Visual (WYSIWYG)
│       │   └── Modo HTML (código fuente)
│       ├── Toggle: Ver diseño normal | Ver HTML
│       ├── Previsualizar
│       ├── Adjuntos (opcional)
│       ├── Enviar ahora
│       └── Guardar como borrador
│
└── 3. CAMPAÑAS
    ├── FILTRO: Ver campañas por cuenta
    │   └── Dropdown: [Todas las cuentas ▼] o [Cuenta específica]
    ├── Lista de campañas (con estado: borrador, programada, enviada, etc.)
    │   └── Cada campaña muestra: nombre, cuenta usada, fecha, estado, progreso
    ├── Crear campaña → Se abre el Compositor de Campaña
    ├── ACCIONES:
    │   ├── Ver progreso (enviados/total)
    │   ├── Ver logs (detalle de cada email)
    │   ├── Exportar logs (Excel/CSV)
    │   ├── Duplicar campaña
    │   ├── Reintentar fallidos
    │   ├── Pausar
    │   ├── Reanudar
    │   └── Cancelar
    │
    └── [COMPOSITOR DE CAMPAÑA]
        ├── Paso 0: Elegir cuenta (NUEVO)
        │   └── Cuenta para enviar: [Seleccionar cuenta SMTP ▼]
        │       └── Lista de cuentas SMTP disponibles
        │       └── Muestra: nombre, emails enviados hoy X/500
        │
        ├── Paso 1: Destinatarios
        │   ├── ┌─────────────────────────────────────────┐
        │   │  FILTRAR BASE DE DATOS:                    │
        │   │  ○ Todos los contactos (150)               │
        │   │  ○ Solo confirmados (80)                   │
        │   │  ○ Solo pendientes (50)                    │
        │   │  ○ Por grupo específico → [Seleccionar]   │
        │   │       ├─ VIP (30)                          │
        │   │       ├─ Prensa (15)                       │
        │   │       └─ Empleados (45)                    │
        │   │  └─────────────────────────────────────────┘
        │   └── Ver: "150 contactos seleccionados"      │
        │
        ├── Paso 2: Contenido
        │   ├── Asunto
        │   ├── Elegir plantilla
        │   │   └── Lista de plantillas
        │   └── O empezar en blanco
        │   ├── Editor de contenido:
        │   │   ├── Modo Visual (WYSIWYG)
        │   │   └── Modo HTML (código fuente)
        │   └── Toggle: Ver diseño normal | Ver HTML
        │
        ├── Paso 3: Programación
        │   ├── Enviar ahora
        │   └── Programar para fecha/hora
        │
        └── Vista de Monitoreo (cuando está enviando)
            ├── FILTRO: Ver por cuenta [Cuenta usada ▼]
            ├── Barra de progreso (X/Y enviados)
            ├── Enviados: X
            ├── Fallidos: X
            ├── Porcentaje: X%
            ├── Ver logs detalle
            ├── Exportar logs (Excel/CSV)
            └── Acciones: Pausar, Cancelar, Reintentar fallidos
```

---

## 5.1 Detalle del Compositor (Nuevo Email y Campaña)

El compositor es el mismo para mailbox (email individual) y campañas:

```
┌─────────────────────────────────────────────────────┐
│  COMPOSITOR                                         │
├─────────────────────────────────────────────────────┤
│  Para: [________________] [Elegir de BD]            │
│        ↓                                            │
│        Al hacer click en "Elegir de BD":            │
│        ├─ Todos los contactos (150)                 │
│        ├─ Confirmados (80)                          │
│        ├─ Pendientes (50)                           │
│        ├─ Rechazados (20)                           │
│        └─ Por grupo...                              │
│             └─ VIP (30)                             │
│             └─ Prensa (15)                          │
│             └─ Empleados (45)                       │
│                                                     │
│  Asunto: [________________]                         │
│                                                     │
│  [Elegir Plantilla ▼] [Empezar en blanco]           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ EDITOR DE CONTENIDO                          │   │
│  │ ┌──────────────┐ ┌──────────────┐           │   │
│  │ │  Modo Visual │ │  Modo HTML   │           │   │
│  │ └──────────────┘ └──────────────┘           │   │
│  │                                             │   │
│  │ [Área de edición con herramientas]          │   │
│  │ - Negrita, cursiva, subrayado               │   │
│  │ - Encabezados                               │   │
│  │ - Listas                                    │   │
│  │ - Insertar imagen                           │   │
│  │ - Insertar enlace                           │   │
│  │ - Insertar variables {{guest_name}}         │   │
│  │ - Insertar código QR                        │   │
│  │                                             │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ TOGGLE: [Diseño Normal] [HTML]         │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Previsualizar] [Adjuntos] [Guardar como plantilla] [Enviar prueba] │
│                                                     │
│  [Enviar ahora]  o  [Programar]                    │
└─────────────────────────────────────────────────────┘
```

---

## 6. Diseño Intuitivo y Fácil de Usar

### Principios de UX/UI

1. **Wizard de 3 pasos para campañas**
   - Paso claro con número (1, 2, 3)
   - Indicador visual de progreso
   - Botón "Siguiente" prominent
   - Botón "Atrás" disponible
   - No puede pasar al siguiente paso sin completar el actual

2. **Selectors claros**
   - Radio buttons para opciones excluyentes (todos/confimados/pendientes)
   - Dropdown para grupos
   - Labels claros encima de cada campo

3. **Feedback visual**
   - Loading spinner al enviar/probar conexión
   - Alertas de éxito (verde) y error (rojo)
   - Tooltips de ayuda en campos complejos

4. **Vista previa constante**
   - Botón "Previsualizar" siempre visible
   - Toggle diseño/HTML para ver ambos modos
   - Preview en tiempo real mientras edita

5. **Cantidades visibles**
   - Siempre mostrar "X contactos seleccionados"
   - Actualizar en tiempo real al filtrar

6. **Estados de campaña claros**
   - Badge con color por estado:
     - 🔵 Azul: Borrador
     - 🟡 Amarillo: Programada
     - 🔴 Rojo: Enviando
     - 🟢 Verde: Completada
     - ⚫ Gris: Cancelada

---

## 7. Instructivo de Configuración de Cuenta SMTP/IMAP

### ¿Cómo configurar una cuenta?

Al hacer click en "Crear Cuenta" o "Editar", mostrar:

```
┌─────────────────────────────────────────────────────┐
│  CONFIGURAR CUENTA DE EMAIL                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Nombre de la cuenta: [Mi Gmail]                   │
│                                                     │
│  ── CONFIGURACIÓN SMTP (Enviar) ──                 │
│  Servidor SMTP: [smtp.tudominio.com          ] ▼      │
│  Puerto SMTP:     [465                  ] ▼      │
│  Usuario:         [micorreo@tudominio.com   ]         │
│  Contraseña:      [•••••••••••••        ]         │
│  Usar SSL/TLS:    [✓]                             │
│                                                     │
│  ── CONFIGURACIÓN IMAP (Recibir) ──                │
│  Servidor IMAP:  [imap.tudominio.com           ] ▼   │
│  Puerto IMAP:    [993                    ] ▼     │
│  Usuario:        [micorreo@tudominio.com     ]        │
│  Contraseña:     [•••••••••••••          ]        │
│  Usar SSL/TLS:   [✓]                              │
│  Carpeta:        [INBOX                   ] ▼    │
│                                                     │
│  ── REMITENTE ──                                  │
│  Nombre:         [Mi Empresa            ]         │
│  Email:          [noreply@tudominio.com]          │
│                                                     │
│  ── OPCIONES ──                                   │
│  [✓] Cuenta por defecto                           │
│  [✓] Cuenta activa                                │
│  Límite diario: [500] emails                       │
│                                                     │
│  [?] Necesito ayuda para configurar                │
│                                                     │
│  [Probar conexión SMTP]  [Probar conexión IMAP]   │
│                                                     │
│              [Cancelar]    [Guardar]               │
└─────────────────────────────────────────────────────┘
```

### Al hacer click en "¿Necesito ayuda?":

```
┌─────────────────────────────────────────────────────┐
│  INSTRUCTIVO DE CONFIGURACIÓN                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  GMAIL                                              │
│  ─────────────────                                 │
│  1. Ve a myaccount.google.com → Seguridad         │
│  2. Habilita "Verificación en dos pasos"          │
│  3. En "Contraseñas de aplicaciones":             │
│     - Selecciona "Correo"                         │
│     - Genera la contraseña                        │
│  4. Usa esa contraseña de 16 caracteres          │
│     en el campo "Contraseña SMTP"                 │
│                                                     │
│  OUTLOOK / OFFICE 365                              │
│  ─────────────────────                             │
│  1. Ve a account.microsoft.com                    │
│  2. Seguridad avanzada                            │
│  3. Habilita autenticación MFA                    │
│  4. Contraseñas de aplicación → Nueva            │
│  5. Usa esa contraseña                            │
│                                                     │
│  OTROS PROVEEDORES                                 │
│  ─────────────────                                 │
│  Busca en la ayuda de tu proveedor:              │
│  "configuración SMTP/IMAP"                        │
│                                                     │
│  Ejemplo genérico:                                │
│  - SMTP: smtp.tudominio.com                       │
│         Puerto: 587 (TLS) o 465 (SSL)            │
│  - IMAP: imap.tudominio.com                       │
│         Puerto: 993 (SSL)                        │
│                                                     │
│  [Cerrar]                                          │
└─────────────────────────────────────────────────────┘
```

---

