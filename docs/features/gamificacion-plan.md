# Plan de Implementación: Gamificación / Live Polling (C11-01)

Inspirado en **Whova** — impacto alto, esfuerzo medio.

---

## 1. Visión General

Sistema de gamificación para eventos que incluye:
- **Live Polling**: Encuestas en vivo durante sesiones
- **Trivias / Quizzes**: Preguntas con respuesta múltiple y tiempo límite
- **Leaderboard**: Ranking de asistentes por puntuación
- **Insignias (badges)**: Logros automáticos por participación

Todo desde la PWA de Check, sin app nativa.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────┐
│                 Check App (API)                   │
│  polls.routes.js ─ leaderboard.routes.js ─ ...   │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │       Base de Datos         │
    │  polls / poll_votes /       │
    │  leaderboard / badges       │
    └─────────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │         Frontend            │
    │  Admin: crear encuestas     │
    │  Attendee: votar / trivia   │
    │  Live: resultados tiempo    │
    │  real (polling)             │
    └─────────────────────────────┘
```

---

## 3. Base de Datos

### Tablas en base maestra (event-scoped)

```sql
-- Encuestas en vivo
CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    session_id TEXT,                -- opcional, vinculado a agenda
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'single',     -- 'single' | 'multiple' | 'trivia' | 'rating' | 'open'
    status TEXT DEFAULT 'draft',    -- 'draft' | 'active' | 'closed'
    points INTEGER DEFAULT 10,      -- puntos por participar
    time_limit_seconds INTEGER,     -- límite para trivias (0 = sin límite)
    correct_answer TEXT,            -- para trivias (JSON array)
    created_at TEXT,
    updated_at TEXT
);

-- Opciones de encuesta
CREATE TABLE IF NOT EXISTS poll_options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    label TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_correct INTEGER DEFAULT 0,   -- para trivias
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

-- Votos
CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    guest_id TEXT,
    option_id TEXT,
    answer_text TEXT,               -- para tipo 'open'
    voted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (guest_id) REFERENCES guests(id)
);

-- Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (guest_id) REFERENCES guests(id),
    UNIQUE(event_id, guest_id)
);

-- Historial de puntos
CREATE TABLE IF NOT EXISTS point_history (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,                     -- 'poll', 'trivia', 'attendance', 'badge'
    reference_id TEXT,              -- poll_id, session_id, etc.
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
);

-- Insignias (definición por evento)
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🏆',
    criteria TEXT,                  -- JSON: { "type": "poll_count", "value": 5 }
    points_reward INTEGER DEFAULT 0
);

-- Insignias obtenidas por asistentes
CREATE TABLE IF NOT EXISTS guest_badges (
    id TEXT PRIMARY KEY,
    badge_id TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    earned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    FOREIGN KEY (guest_id) REFERENCES guests(id)
);
```

### Índices

```sql
CREATE INDEX IF NOT EXISTS idx_polls_event ON polls(event_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_guest ON poll_votes(guest_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_event ON leaderboard(event_id);
CREATE INDEX IF NOT EXISTS idx_point_history_guest ON point_history(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_badges_guest ON guest_badges(guest_id);
```

---

## 4. API Endpoints

### Archivo: `src/routes/polls.routes.js`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/polls/:eventId` | Admin | Listar encuestas del evento |
| `POST` | `/api/polls/:eventId` | Admin | Crear encuesta |
| `GET` | `/api/polls/:eventId/:pollId` | Admin | Detalle de encuesta |
| `PUT` | `/api/polls/:eventId/:pollId` | Admin | Actualizar encuesta |
| `DELETE` | `/api/polls/:eventId/:pollId` | Admin | Eliminar encuesta |
| `PATCH` | `/api/polls/:eventId/:pollId/status` | Admin | Cambiar estado (draft→active→closed) |
| `GET` | `/api/polls/:eventId/:pollId/results` | Admin | Resultados en tiempo real |
| `GET` | `/api/public/polls/:eventId/active` | Público | Encuestas activas para asistentes |
| `POST` | `/api/public/polls/:pollId/vote` | Público | Votar (requiere guest_token) |

### Archivo: `src/routes/leaderboard.routes.js`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/leaderboard/:eventId` | Público | Top asistentes |
| `GET` | `/api/leaderboard/:eventId/guest/:guestId` | Público | Puntuación de un asistente |
| `GET` | `/api/leaderboard/:eventId/badges` | Público | Insignias disponibles y obtenidas |

### Auth pública para asistentes

Los endpoints públicos usan `guest_token` (el mismo que check-in por QR) para identificar al asistente sin necesidad de login completo.

```
POST /api/public/polls/:pollId/vote
Body: { guest_token: "...", option_id: "..." }
```

---

## 5. Frontend — Organizador (Admin)

### Panel de Encuestas (`config-content-polls`?)

Agregar pestaña "Gamificación" en configuración del evento con:

1. **Lista de encuestas**: tabla con título, tipo, estado, fecha, acciones
2. **Crear/Editar encuesta**: formulario con:
   - Título, descripción, tipo (single/multiple/trivia/rating)
   - Opciones (dinámicas, agregar/quitar)
   - Puntos por participar
   - Tiempo límite (para trivias)
   - Respuesta correcta (para trivias)
   - Vincular a sesión (opcional)
3. **Panel de control de encuesta activa**:
   - Botón "Activar" → aparece en PWA de asistentes
   - Resultados en tiempo real (gráfico de barras)
   - Botón "Cerrar" → muestra respuesta correcta (trivias)
4. **Leaderboard**: tabla con ranking, nombre, puntos, insignias

### Panel de Insignias

1. Lista de insignias predefinidas (asistencia, encuestas respondidas, trivias acertadas)
2. Crear insignias personalizadas por evento

---

## 6. Frontend — Asistente (PWA)

### Vista en PWA del asistente

Agregar sección "Participar" en el portal del asistente:

1. **Encuestas activas**: lista de polls activos
   - Cada poll muestra título, tiempo restante (si aplica)
   - Al votar, feedback visual inmediato
   - Para trivias: mostrar si acertó después de cerrar
2. **Leaderboard**: top 10 del evento
   - Posición actual del asistente
   - Puntos totales
3. **Mis insignias**: insignias obtenidas
4. **Notificaciones push**: cuando se activa un poll nuevo

---

## 7. Implementación — Orden sugerido

### Fase 1: Backend (DB + API)
- [ ] Agregar schema en `database-manager.js`
- [ ] Crear `src/routes/polls.routes.js` (CRUD + votación)
- [ ] Crear `src/routes/leaderboard.routes.js` (ranking + puntos)
- [ ] Registrar rutas en `server.js`

### Fase 2: Frontend Admin
- [ ] Pestaña "Gamificación" en configuración del evento (`app-shell.html` / `app.js`)
- [ ] Formulario de crear/editar encuesta
- [ ] Panel de control de encuesta activa con resultados
- [ ] Tabla de leaderboard

### Fase 3: Frontend Asistente (PWA)
- [ ] Sección "Participar" en portal del asistente
- [ ] Votar encuesta
- [ ] Ver leaderboard
- [ ] Ver insignias

### Fase 4: Live Polling en tiempo real
- [ ] WebSocket o polling periódico para resultados en vivo
- [ ] Notificaciones push para nuevas encuestas

---

## 8. Estimación

| Fase | Archivos | Esfuerzo |
|------|----------|----------|
| Fase 1: Backend | database-manager.js + 2 routes | ~3h |
| Fase 2: Admin | app-shell.html + app.js | ~4h |
| Fase 3: PWA | public html + js | ~3h |
| Fase 4: Tiempo real | ws + push | ~2h |
| **Total** | | **~12h** |

---

## 9. Integraciones existentes que se reutilizan

- **Notificaciones push**: `src/routes/push.routes.js` — ya implementado
- **Guest tokens**: sistema de check-in QR ya genera tokens
- **Sesiones/Agenda**: `sessions.routes.js` — para vincular polls a sesiones
- **PWA**: portal asistente ya existe
- **Ruleta existente**: `raffles.routes.js` — referencia de gamificación simple
