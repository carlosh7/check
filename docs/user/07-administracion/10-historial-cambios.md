# Historial de Cambios (Undo/Redo)

## ¿Qué es?

Sistema que registra automaticamente cada cambio importante que hagas en invitados
(check-in, estado, categoria) y eventos (edicion). Puedes ver el historial completo
y deshacer o rehacer cambios individuales.

## ¿Para qué sirve?

- Recuperar un check-in accidentaly revertido
- Deshacer un cambio de estado incorrecto en un invitado
- Restaurar la categoria anterior de un invitado
- Auditar quien hizo cada cambio y cuando

## ¿Que cambios se registran?

- Check-in / Uncheck-in de invitados
- Cambio de estado en el pipeline (lead, contacted, confirmed, attended...)
- Cambio de categoria de un invitado
- Actualizacion del perfil networking (bio, intereses, redes sociales)
- Edicion de datos del evento (nombre, fecha, ubicacion...)

## Endpoints

### Ver historial de un evento

```http
GET /api/events/{eventId}/changes?limit=100
```

Devuelve los ultimos cambios ordenados del mas reciente al mas antiguo.
Cada cambio incluye:

| Campo | Descripcion |
|-------|-------------|
| `id` | Identificador unico del cambio |
| `entity_type` | Tipo: `guest` o `event` |
| `entity_id` | ID del registro modificado |
| `action` | Accion realizada (`checked_in`, `status_changed`, `updated`, etc.) |
| `field_name` | Campo especifico que cambio |
| `old_value` | Valor anterior |
| `new_value` | Valor nuevo |
| `user_name` | Nombre del usuario que hizo el cambio |
| `undone` | `0` = activo, `1` = deshecho |
| `created_at` | Fecha y hora del cambio |

### Deshacer un cambio

```http
POST /api/events/{eventId}/changes/{changeId}/undo
```

Restaura el valor anterior del cambio. Por ejemplo:
- Deshacer un check-in → marca al invitado como no presente
- Deshacer un cambio de estado → restaura el estado anterior
- Deshacer un cambio de categoria → restaura la categoria anterior

### Rehacer un cambio

```http
POST /api/events/{eventId}/changes/{changeId}/redo
```

Vuelve a aplicar el cambio despues de haberlo deshecho.

## Notas

- No se puede deshacer un cambio que ya fue deshecho
- No se puede rehacer un cambio que no ha sido deshecho
- El historial se conserva permanentemente (no se purga automaticamente)
