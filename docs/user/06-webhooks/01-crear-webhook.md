# Crear y gestionar webhooks

> **Versión:** v12.44.670+ | **Módulo:** Webhooks

## ¿Para qué sirve?
Conectar Check Pro con servicios externos (Slack, Discord, automatizaciones, CRMs) enviando datos en tiempo real cuando ocurren eventos.

## Requisitos previos
- [ ] Tener una URL donde recibir los datos (ej: webhook de Slack, Discord, o tu propio servidor)
- [ ] Rol **ADMIN** o **PRODUCTOR**

## Pasos

### 1. Crear un webhook
1. Ve a **Sistema** > pestaña **"Webhooks"**
2. Haz clic en **"+ Webhook"**
3. Completa:
   - **Nombre** — identifica la integración
   - **URL** — la dirección donde se enviarán los datos
   - **Secreto** — clave para verificar la autenticidad (se autogenera si lo dejas vacío)
   - **Eventos** — selecciona qué acciones dispararán el webhook

### 2. Eventos disponibles
Puedes elegir uno o varios:

| Evento | Cuándo se dispara |
|--------|-------------------|
| `guest.created` | Se crea un nuevo invitado |
| `guest.updated` | Se actualiza un invitado |
| `guest.checked_in` | Un invitado hace check-in |
| `guest.unchecked_in` | Se deshace un check-in |
| `event.created` | Se crea un evento |
| `event.updated` | Se actualiza un evento |
| `event.deleted` | Se elimina un evento |
| `payment.completed` | Se completa un pago |
| `pre_registration.created` | Un invitado se pre-registra |
| `survey.submitted` | Alguien responde una encuesta |

### 3. Probar el webhook
Después de crear el webhook, usa el botón **▶️ Test** para enviar un payload de prueba a la URL configurada.

### 4. Ver entregas
En el historial de entregas puedes ver:
- Fecha y hora de cada intento
- Estado (✅ éxito / ❌ fallo)
- Tiempo de respuesta
- Cuerpo de la respuesta

## Presets

### Slack
Haz clic en el botón **💬** al lado del campo URL para autocompletar con el formato de Slack. Luego solo cambia el ID del webhook.

### Discord
Haz clic en **🎮** para el formato de Discord. Cambia los IDs por los de tu canal.

## Formato del payload
```json
{
  "event": "guest.created",
  "timestamp": "2026-05-09T12:00:00.000Z",
  "data": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@email.com"
  }
}
```

## Verificación de firma
Cada payload incluye el header `X-Webhook-Signature` con una firma HMAC-SHA256. Puedes verificar la autenticidad usando el secreto que configuraste.

## Solución de problemas
- **"Error al enviar"** — verifica que la URL sea accesible desde el servidor
- **"Timeout"** — el servidor destino debe responder en menos de 10 segundos
- **Sin logs** — asegúrate de que el webhook esté ACTIVO y tenga al menos un evento seleccionado
