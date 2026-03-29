# Arquitectura del Sistema Check Pro v12.31.86

## Resumen del Proyecto

Sistema de gestión de invitados con soporte para múltiples bases de datos por evento. Cada evento puede tener su propia base de datos independiente para aislar sus datos.

---

## JERARQUÍA DE LA BASE DE DATOS

### Estructura de Archivos de Datos

```
data/
├── check_app.db              ← BASE DE DATOS MAESTRA (usuarios, eventos, configuración global)
│   ├── users                 → Usuarios del sistema
│   ├── groups                → Empresas/Grupos
│   ├── events                → Eventos (contiene campo has_own_db)
│   ├── user_events           → Relación usuarios-eventos
│   ├── settings              → Configuración global
│   ├── smtp_config           → Configuración de correo
│   ├── email_templates       → Plantillas de email
│   ├── audit_logs            → Logs de auditoría
│   └── guests*               → Tabla de compatibilidad (solo si evento NO tiene BD propia)
│
└── events/                   ← DIRECTORIO DE EVENTOS CON BD PROPIA
    ├── {event_id_1}.db      → BD independiente del evento 1
    │   ├── guests            → Invitados del evento 1
    │   ├── event_wheels      → Ruletas del evento 1
    │   ├── wheel_participants
    │   ├── wheel_spins
    │   ├── wheel_leads
    │   ├── surveys           → Encuestas del evento 1
    │   ├── survey_responses
    │   ├── event_agenda      → Agenda del evento 1
    │   └── guest_suggestions → Sugerencias del evento 1
    │
    ├── {event_id_2}.db      → BD independiente del evento 2
    └── {event_id_n}.db      → BD independiente del evento N
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                     BASE DE DATOS MAESTRA                       │
│                     (check_app.db)                              │
├─────────────────────────────────────────────────────────────────┤
│  users    │  groups  │  events (has_own_db)  │  settings      │
└───────────┴──────────┴───────────────────────┴────────────────┘
        │           │              │
        │           │              └─→ has_own_db = 0 ──→ USA BD MAESTRA
        │           │              └─→ has_own_db = 1 ──→ USA {event_id}.db
        │           │
        │           └─→ users + events ──→ ADMIN / PRODUCTOR
        │
        └─→ AUTHENTICATION (login/logout)
```

---

## ESTRUCTURA DE ARCHIVOS DEL PROYECTO

```
C:\Users\carlo\OneDrive\Documentos\APP\Registro\
├── package.json                    ← Versión actual: 12.31.86
├── server.js                       ← Servidor principal
├── database.js                     ← Configuración de BD + funciones
│
├── src/
│   ├── utils/
│   │   ├── database-manager.js     ← NUEVO: Gestor de BD por evento
│   │   ├── cache.js
│   │   ├── helpers.js
│   │   ├── emailQueue.js
│   │   ├── webhooks.js
│   │   └── logger.js
│   │
│   ├── routes/
│   │   ├── events.routes.js        ← MODIFICADO: Gestión de BD por evento
│   │   ├── guests.routes.js        ← MODIFICADO: Usa BD del evento
│   │   ├── public.routes.js        ← MODIFICADO: Registro usa BD del evento
│   │   ├── surveys.routes.js       ← MODIFICADO: Encuestas usan BD del evento
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── groups.routes.js
│   │   ├── email.routes.js
│   │   ├── push.routes.js
│   │   └── ...
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   └── csrf.js
│   │
│   ├── security/
│   │   ├── validation.js
│   │   ├── audit.js
│   │   ├── captcha.js
│   │   └── jwt.js
│   │
│   └── frontend/
│       ├── api.js
│       └── utils.js
│
├── public/
│   ├── js/
│   │   └── app.js                  ← MODIFICADO: Eliminado código duplicado
│   │
│   ├── html/
│   │   ├── app-shell.html          ← Interfaz principal
│   │   └── pages/
│   │       ├── login.html          ← Versión: 12.31.86
│   │       ├── registro.html       ← Versión: 12.31.86
│   │       ├── survey.html         ← Versión: 12.31.86
│   │       ├── ticket.html         ← Versión: 12.31.86
│   │       └── wheel.html          ← Versión: 12.31.86
│   │
│   └── css/
│       ├── styles.css
│       └── modern.css
│
└── data/
    ├── check_app.db               ← BD Maestra
    └── events/                    ← Directorio de BDs de eventos
        └── (archivos .db por evento)
```

---

## FLJO DE TRABAJO DEL SISTEMA

### 1. Creación de Evento

```
Frontend → POST /api/events {has_own_db: true}
              ↓
events.routes.js → Crea registro en BD maestra
                      ↓
              → Llama createEventDatabase(eventId)
                      ↓
database-manager.js → Crea data/events/{eventId}.db
                         ↓
                    Crea todas las tablas del evento
```

### 2. Registro Público de Invitado

```
Usuario → POST /api/public/register
              ↓
public.routes.js → Busca evento en BD maestra
                      ↓
              → Verifica has_own_db + existe BD del evento
                      ↓
              → SI tiene BD propia → usa {eventId}.db
              → NO tiene BD propia → usa check_app.db
                      ↓
              → Inserta invitado en la BD correspondiente
```

### 3. Consulta de Invitados (Admin)

```
Admin → GET /api/guests/{eventId}
            ↓
guests.routes.js → Llama getEventDb(eventId)
                      ↓
              → Determina qué BD usar
                      ↓
              → Consulta en la BD correcta
```

---

## TABLAS POR BASE DE DATOS

### BD Maestra (check_app.db)

| Tabla | Función |
|-------|---------|
| `users` | Usuarios del sistema (admin, productores) |
| `groups` | Empresas/Organizaciones |
| `events` | Metadatos de eventos + `has_own_db` |
| `user_events` | Relación usuarios-eventos |
| `settings` | Configuración global |
| `smtp_config` | Configuración de correo |
| `email_templates` | Plantillas de email globales |
| `password_resets` | Recuperación de contraseñas |
| `audit_logs` | Logs de auditoría |
| `webhooks` | Configuración de webhooks |

### BD de Evento (events/{eventId}.db)

| Tabla | Función |
|-------|---------|
| `guests` | Invitados registrados en el evento |
| `pre_registrations` | Pre-registros del evento |
| `event_wheels` | Ruletas del evento |
| `wheel_participants` | Participantes de ruletas |
| `wheel_spins` | Historial de giros |
| `wheel_leads` | Leads captados |
| `surveys` | Encuestas del evento |
| `survey_responses` | Respuestas de encuestas |
| `event_agenda` | Agenda del evento |
| `guest_suggestions` | Sugerencias de invitados |

---

## RESUMEN VISUAL

```
┌──────────────────────────────────────────────────────────────────┐
│                        CHECK APP v12.31.86                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────────────────────────────┐  │
│  │  USUARIOS   │      │           EVENTOS                   │  │
│  │  (ADMIN)    │      │                                     │  │
│  └─────────────┘      │  ┌─────────────┐  ┌──────────────┐  │  │
│         │             │  │  Evento A   │  │  Evento B    │  │  │
│         │             │  │ (BD propia) │  │ (BD propia)  │  │  │
│         ▼             │  └─────────────┘  └──────────────┘  │  │
│  ┌─────────────┐      │        │                │           │  │
│  │   EVENTOS   │      │        ▼                ▼           │  │
│  │ (maestra)   │      │  ┌──────────┐    ┌──────────┐      │  │
│  │             │      │  │event_A.db│    │event_B.db│      │  │
│  │ has_own_db  │──────┼─▶│ guests   │    │ guests   │      │  │
│  │ = 0/1       │      │  │ wheels   │    │ surveys  │      │  │
│  └─────────────┘      │  │ surveys  │    │ agenda   │      │  │
│         │             │  │ agenda   │    │ ...      │      │  │
│         ▼             │  └──────────┘    └──────────┘      │  │
│  ┌─────────────┐      └─────────────────────────────────────┘  │
│  │  guests     │                     │                          │
│  │ (compatib.) │◀────────────────────┘                          │
│  └─────────────┘        (si no tiene BD propia)                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## BENEFICIOS DEL SISTEMA

1. **Aislamiento de datos**: Cada evento tiene sus propios datos
2. **Escalabilidad**: Puedo eliminar la BD de un evento sin afectar otros
3. **Rendimiento**: Consultas más rápidas al tener BDs más pequeñas
4. **Personalización**: Cada evento puede tener su propia configuración
5. **Backwards Compatibility**: Los eventos antiguos siguen funcionando con BD maestra

---

## ENDPOINTS DE GESTIÓN

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/events/:id/database` | GET | Verificar estado de BD del evento |
| `/api/events/:id/database` | POST | Crear BD independiente para evento |
| `/api/events/:id/database` | DELETE | Eliminar BD independiente del evento |

---

## HISTORIAL DE VERSIONES

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 12.31.86 | 2026-03-29 | Fase 6: Pruebas finales |
| 12.31.85 | 2026-03-29 | Fase 5: Rutas de encuestas, sugerencias y agenda |
| 12.31.84 | 2026-03-29 | Fase 4: Rutas de invitados |
| 12.31.83 | 2026-03-29 | Fase 3: Crear eventos con BD propia |
| 12.31.82 | 2026-03-29 | Fase 2: Sistema de gestión de múltiples BD |
| 12.31.81 | 2026-03-29 | Fase 1: Limpieza y código duplicado |
| 12.31.80 | 2026-03-28 | Versión base |

---

## CÓMO USAR EL SISTEMA

### 1. Crear evento con BD propia

Enviar `has_own_db: true` al crear evento:
```json
{
  "name": "Mi Evento",
  "date": "2026-04-15",
  "location": "Mi Ubicación",
  "has_own_db": true
}
```

O activar después usando el endpoint:
```bash
curl -X POST http://localhost:3000/api/events/{eventId}/database
```

### 2. Estructura de datos

- BD maestra: `data/check_app.db`
- BD de eventos: `data/events/{event_id}.db`

### 3. Verificar estado de BD del evento

```bash
curl http://localhost:3000/api/events/{eventId}/database
```

---

*Documento generado el 29 de marzo de 2026*
*Sistema Check Pro v12.31.86*