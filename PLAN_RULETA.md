# 🎰 PLAN INTEGRAL: RULETA DE SORTESOS PARA CHECK PRO

## 1. VISIÓN GENERAL DEL PROYECTO

Agregar una **Ruleta de Sorteos** interactiva al módulo de configuración de eventos, permitiendo:
- Personalización visual completa
- Selección de participantes desde múltiples fuentes de datos
- Modo manual de entrada
- Captura de leads
- Reportes y estadísticas

---

## 2. FUNCIONALIDADES PRINCIPALES

### 2.1 MÓDULO DE RULETA EN CONFIGURACIÓN

| Función | Descripción | Prioridad |
|---------|-------------|-----------|
| **Panel de Control** | Dashboard central de la ruleta | 🔴 ALTA |
| **Configuración Visual** | Colores, logos, sonidos, animaciones | 🔴 ALTA |
| **Gestión de Participantes** | Agregar/editar/remover participantes | 🔴 ALTA |
| **Selección de Fuente de Datos** | Elegir origen de participantes | 🔴 ALTA |
| **Historial de Giros** | Ver quién ha ganado | 🟡 MEDIA |
| **Compartir/Embed** | Código paraInsertar en web | 🟡 MEDIA |

### 2.2 FUENTES DE DATOS PARA PARTICIPANTES

```
┌─────────────────────────────────────────────────────────────┐
│                    SELECCIONAR PARTICIPANTES                 │
├─────────────────────────────────────────────────────────────┤
│  ○ Todos los invitados del evento (N=500)                  │
│  ○ Solo asistentes (check-in confirmado) (N=320)           │
│  ○ Solo pre-registrados (N=180)                             │
│  ○ Encuesta específica: [Seleccionar encuesta ▼]           │
│    └── Pregunta: "¿Qué taller te interesa?"                │
│        └── Respuestas: ["Taller A", "Taller B", etc]       │
│  ○ Grupo específico: [Seleccionar empresa ▼]               │
│  ○ Entrada manual (escribir nombres)                        │
│  ○ Importar desde archivo CSV/Excel                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 PERSONALIZACIÓN VISUAL

| Elemento | Opciones |
|----------|----------|
| **Colores de la ruleta** | Selector de color (hex/rgb) |
| **Colores de las divisiones** | Alternar 2 colores o usar gradiente |
| **Logo central** | Subir imagen o usardefault |
| **Color del puntero** | Selector de color |
| **Color de fondo** | Degradado o imagen |
| **Sonido al girar** | On/Off + volumen |
| **Efectos confeti** | On/Off al ganar |
| **Eliminar marca de agua** | Solo Premium |
| **Duración del giro** | 3s, 6s, 10s, 14s |

### 2.4 CAPTURA DE LEADS (NUEVO)

```
┌─────────────────────────────────────────────────────────────┐
│              MODAL DE CAPTURA PREVIA AL GIRO                │
├─────────────────────────────────────────────────────────────┤
│  Nombre: [________________] *                               │
│  Email: [________________] *                                │
│  Teléfono: [________________]                               │
│  Empresa: [________________]                                │
│  [ ] Acepto términos y condiciones                          │
│                                                             │
│              [ GIRAR RULETA ]                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. ARQUITECTURA TÉCNICA

### 3.1 BASE DE DATOS - NUEVAS TABLAS

```sql
-- Tabla principal de ruletas por evento
CREATE TABLE event_wheels (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    config JSON NOT NULL,  -- toda la config visual
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Participantes de la ruleta
CREATE TABLE wheel_participants (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    guest_id TEXT,  -- opcional, si viene de guests
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    custom_data JSON,  -- datos adicionales
    source TEXT NOT NULL,  -- 'guests', 'manual', 'survey', 'import'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
);

-- Historial de giros
CREATE TABLE wheel_spins (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    participant_id TEXT,
    winner_name TEXT,
    winner_email TEXT,
    spin_result TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
);

-- Captura de leads
CREATE TABLE wheel_leads (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
);
```

### 3.2 RUTAS API

```
GET    /api/events/:id/wheels           - Listar ruletas del evento
POST   /api/events/:id/wheels           - Crear ruleta
GET    /api/wheels/:id                  - Obtener ruleta específica
PUT    /api/wheels/:id                  - Actualizar ruleta
DELETE /api/wheels/:id                  - Eliminar ruleta

GET    /api/wheels/:id/participants     - Listar participantes
POST   /api/wheels/:id/participants     - Agregar participante(s)
DELETE /api/wheels/:id/participants/:id - Eliminar participante
POST   /api/wheels/:id/import-csv       - Importar desde CSV

POST   /api/wheels/:id/spin             - Girar ruleta (API principal)
GET    /api/wheels/:id/spins            - Historial de giros

GET    /api/wheels/:id/leads            - Ver leads capturados
POST   /api/wheels/:id/capture-lead     - Capturar lead (público)
```

### 3.3 ESTRUCTURA DE CONFIG (JSON)

```json
{
  "name": "Ruleta Premios - Evento X",
  "visual": {
    "wheel_colors": ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
    "wheel_text_color": "#FFFFFF",
    "wheel_border_color": "#333333",
    "pointer_color": "#FF0000",
    "background_color": "#1a1a2e",
    "background_image": null,
    "center_logo": "/uploads/wheel-logo.png",
    "spin_duration": 6,
    "sound_enabled": true,
    "confetti_on_win": true
  },
  "data_source": {
    "type": "survey",
    "survey_id": "uuid-encuesta",
    "question_id": "uuid-pregunta",
    "answers": ["Taller A", "Taller B", "Taller C"]
  },
  "settings": {
    "remove_winner": false,
    "allow_duplicate_wins": true,
    "show_winner_modal": true,
    "require_lead_capture": true,
    "lead_fields": ["name", "email", "phone", "company"]
  },
  "publish": {
    "is_public": true,
    "share_url": "https://check.pro/w/abc123",
    "embed_code": "<iframe src='...'>"
  }
}
```

---

## 4. FRONTEND - COMPONENTES

### 4.1 VISTAS EN APP-SHELL.HTML

```
Configuración del Evento
├── Personal Asignado
├── Email del Evento
├── Agenda
├── 🎰 RULETA DE SORTESOS (NUEVO)
│   ├── Panel de Control
│   ├── Configuración Visual
│   ├── Participantes
│   ├── Captura de Leads
│   └── Reportes
```

### 4.2 COMPONENTES VISUALES

| Componente | Descripción |
|------------|-------------|
| `wheel-preview` | Vista previa de la ruleta |
| `wheel-editor` | Editor visual (colores, logos) |
| `participant-manager` | Tabla de participantes con filtros |
| `data-source-selector` | Selector de fuente de datos |
| `spin-modal` | Modal para hacer girar (pantalla completa) |
| `winner-modal` | Modal de celebración |
| `lead-capture-form` | Formulario de captura |
| `embed-code-generator` | Generador de código embed |
| `spin-history` | Tabla de historial |

---

## 5. PLAN DE IMPLEMENTACIÓN (FASES)

### FASE 1: FUNDAMENTO (Semanas 1-2)
**Objetivo:** Ruleta básica funcional

| Tarea | Horas | Estado |
|-------|-------|--------|
| Crear tablas en DB | 4h | ⬜ |
| Crear rutas API básicas | 8h | ⬜ |
| CRUD de ruletas | 6h | ⬜ |
| Panel de configuración UI | 8h | ⬜ |
| Motor de giro (frontend) | 12h | ⬜ |
| Integración con guests | 6h | ⬜ |

**Entregable:** Ruleta funcional con datos de invitados

---

### FASE 2: PERSONALIZACIÓN (Semanas 3-4)
**Objetivo:** Editor visual completo

| Tarea | Horas | Estado |
|-------|-------|--------|
| Selector de colores | 4h | ⬜ |
| Subir logo central | 4h | ⬜ |
| Fondos personalizados | 4h | ⬜ |
| Sonidos y efectos | 6h | ⬜ |
| Vista previa en tiempo real | 4h | ⬜ |
| Preview mode | 4h | ⬜ |

**Entregable:** Editor visual completo

---

### FASE 3: FUENTES DE DATOS (Semanas 5-6)
**Objetivo:** Múltiples fuentes de participantes

| Tarea | Horas | Estado |
|-------|-------|--------|
| Solo asistentes (check-in) | 4h | ⬜ |
| Solo pre-registrados | 4h | ⬜ |
| Por encuesta específica | 8h | ⬜ |
| Por grupo/empresa | 4h | ⬜ |
| Entrada manual | 4h | ⬜ |
| Importar CSV | 6h | ⬜ |

**Entregable:** Todas las fuentes de datos funcionando

---

### FASE 4: CAPTURA DE LEADS (Semanas 7-8)
**Objetivo:** Sistema de capture

| Tarea | Horas | Estado |
|-------|-------|--------|
| Formulario de captura | 6h | ⬜ |
| Validación de email | 4h | ⬜ |
| Guardar leads en DB | 4h | ⬜ |
| Descarga de leads CSV | 4h | ⬜ |
| Lead magnets (opcional) | 8h | ⬜ |

**Entregable:** Sistema completo de captura de leads

---

### FASE 5: PUBLISHING Y EXTRAS (Semanas 9-10)
**Objetivo:** Funcionalidades adicionales

| Tarea | Horas | Estado |
|-------|-------|--------|
| URL pública compartida | 4h | ⬜ |
| Código embed | 6h | ⬜ |
| Pantalla fullscreen para evento | 6h | ⬜ |
| Historial de giros | 4h | ⬜ |
| Estadísticas básicas | 6h | ⬜ |

**Entregable:** Ruleta lista para producción

---

### FASE 6: EXTRAS (Semanas 11-12) - OPCIONAL
**Objetivo:** Funciones adicionales

| Tarea | Horas | Estado |
|-------|-------|--------|
| Múltiples premios | 8h | ⬜ |
| Chances por participante | 6h | ⬜ |
| Trivia (similar a ruleta) | 16h | ⬜ |
| Dados virtuales | 8h | ⬜ |
| Sistema de planes (freemium) | 16h | ⬜ |

**Entregable:** Suite completa de sorteos

---

## 6. TIEMPO Y COSTO TOTAL ESTIMADO

| Fase | Semanas | Horas | Costo Estimado* |
|------|---------|-------|-----------------|
| Fase 1 | 2 | 50h | $750-1,000 |
| Fase 2 | 2 | 30h | $450-600 |
| Fase 3 | 2 | 34h | $510-680 |
| Fase 4 | 2 | 22h | $330-440 |
| Fase 5 | 2 | 30h | $450-600 |
| Fase 6 | 2 | 54h | $810-1,080 |
| **TOTAL** | **12 sem** | **220h** | **$3,300-4,400** |

*Costo estimado usando $15-20/hora (desarrollador Latam)

---

## 7. PRIORIDADES PARA EMPEZAR

### 🔴 PRIMERA SEMANA (MVP):
1. Crear tablas en DB
2. API básica de ruletas
3. Mostrar lista de guests como participantes
4. Ruleta visual básica funcional

### 🟡 SEGUNDA SEMANA:
1. Selector de colores
2. Personalización de logo
3. Guardar y cargar configuraciones
4. Botón de "Girar" funcional

### 🟢 TERCERA SEMANA:
1. Integración con encuestas
2. Entrada manual de participantes
3. Historial de ganadores
4. URL pública

---

## 8. EJEMPLO DE FLUJO DE USUARIO

```
1. Productor entra a Check Pro
2. Selecciona un evento
3. Va a Configuración → Ruleta de Sorteos
4. Crea nueva ruleta: "Ruleta de Premios"
5. Configura colores (rojo/dorado)
6. Selecciona fuente: "Todos los asistentes"
7. Personaliza: agrega logo, activa confeti
8. Guarda → Obtiene URL pública
9. During event: shows on projector
10. Guest scans QR → enters name → spins wheel
11. WINNER! Confetti + music + modal
12. Lead captured in system
13. Producer exports winner list
```

---

## 9. PREGUNTAS PARA ACLARAR

1. ¿Primer MVP solo para web o también para móvil?
2. ¿Los sonidos deben ser customizables o usar librería?
3. ¿Necesitamos integración con WhatsApp para notificar ganadores?
4. ¿El sistema de planes (freemium) es prioritario?

---

*Documento creado: 2026-03-26*
*Versión: 1.0*