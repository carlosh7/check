# Edición Multi-Usuario en Vivo

## ¿Qué es?

Sistema de colaboración en tiempo real que permite a varios organizadores trabajar
simultáneamente en el mismo evento. Los cambios que hace un usuario se reflejan
instantáneamente para los demás.

## ¿Para qué sirve?

- Ver qué invitados están siendo editados por otros usuarios en este momento
- Recibir notificaciones cuando alguien actualiza un invitado
- Saber cuántas personas están viendo el evento actualmente
- Evitar conflictos al saber quién más está trabajando

## ¿Cómo funciona?

Usa Socket.IO para comunicación en tiempo real:

1. Al abrir un evento, te unes automáticamente a su "sala" virtual
2. Al hacer clic en un invitado, se avisa a los demás que lo estás editando
3. Cuando alguien guarda cambios, todos los conectados ven una notificación
4. Un "heartbeat" cada 25 segundos mantiene actualizada tu presencia
5. Al cerrar el evento o desconectarte, sales de la sala

## Indicadores visuales

En la parte superior de la página del evento, verás burbujas verdes con nombres
de los usuarios que están viendo o editando el evento actualmente:

```
🟢 María Pérez editando Juan García
🟢 Carlos López
```

Cada burbuja muestra el nombre del usuario y, si está editando un invitado,
el nombre del invitado que está modificando.

## Eventos Socket.IO

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `join_event` | Cliente → Servidor | Unirse a la sala del evento |
| `leave_event` | Cliente → Servidor | Salir de la sala del evento |
| `editing_guest` | Cliente → Servidor | Avisar que se está editando un invitado |
| `stop_editing` | Cliente → Servidor | Dejar de editar un invitado |
| `collab_update` | Cliente → Servidor | Notificar que se guardaron cambios |
| `guest_updated` | Servidor → Cliente | Cambio recibido de otro usuario |
| `presence_update` | Servidor → Cliente | Lista actualizada de usuarios activos |
| `presence_heartbeat` | Cliente → Servidor | Mantener presencia activa |

## API REST

```http
GET /api/guests/{eventId}/editors
```

Devuelve la lista actual de editores activos para un evento:

```json
{
  "editors": [
    { "userId": "...", "userName": "María Pérez", "guestId": "...", "guestName": "Juan García", "joinedAt": 1234567890 }
  ]
}
```
