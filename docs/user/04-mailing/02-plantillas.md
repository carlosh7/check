# Plantillas de email

> **Versión:** v12.44.541+ | **Módulo:** Mailing

## ¿Para qué sirve?
Usar y personalizar plantillas predefinidas para enviar emails a los invitados.

## Plantillas disponibles

| # | Plantilla | Cuándo se usa |
|---|-----------|---------------|
| 1 | **Invitación** | Primera comunicación con el invitado |
| 2 | **Recordatorio 7 días** | Una semana antes del evento |
| 3 | **Recordatorio 3 días** | Tres días antes |
| 4 | **Recordatorio 1 día** | Un día antes |
| 5 | **Recordatorio horas** | Horas antes (incluye QR) |
| 6 | **Confirmación asistencia** | Cuando el invitado confirma |
| 7 | **Rechazo asistencia** | Cuando el invitado decline |
| 8 | **Cambio de fecha** | Notificación de cambio |
| 9 | **Cambio de ubicación** | Notificación de cambio de lugar |
| 10 | **Cancelación evento** | Si el evento se cancela |
| 11 | **Agradecimiento post-evento** | Después del evento |
| 12 | **Encuesta post-evento** | Para feedback |

## Personalizar una plantilla
1. Ve a **Mailing** > **"Plantillas"**
2. Selecciona la plantilla a editar
3. Puedes modificar:
   - **Asunto** del email
   - **Cuerpo** del mensaje (editor de texto)
4. Las variables como `{{guest_name}}`, `{{event_name}}`, `{{qr_code}}` se reemplazan automáticamente

## Previsualizar
Antes de enviar, puedes previsualizar cómo se verá el email en diferentes dispositivos.

## Notas
- Las plantillas del sistema se pueden editar pero no eliminar
- Puedes crear plantillas personalizadas desde cero
- Las variables disponibles: `{{guest_name}}`, `{{event_name}}`, `{{event_date}}`, `{{event_location}}`, `{{qr_code}}`, `{{boton_confirmar}}`

## Ver también
- [Campañas masivas](03-campanas.md)
- [Robot automático](04-robot-automatico.md)
