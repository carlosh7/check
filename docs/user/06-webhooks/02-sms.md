# SMS (Twilio)

> **Versión:** v12.44.688+ | **Módulo:** SMS

## ¿Para qué sirve?
Enviar mensajes de texto (SMS) a los invitados desde el sistema.

## Requisitos previos
- [ ] Cuenta de [Twilio](https://www.twilio.com) (plan gratuito disponible)
- [ ] Número telefónico verificado en Twilio
- [ ] Rol **ADMIN**

## Configuración
1. Ve a **Sistema** > pestaña **"SMS"**
2. Completa los datos de tu cuenta Twilio:
   - **Account SID** — desde tu consola de Twilio
   - **Auth Token** — desde tu consola de Twilio
   - **Número de origen** — el número Twilio que enviará los SMS
3. Activa **"Habilitar envío de SMS"**
4. Haz clic en **"Guardar"**

## Probar el envío
1. Después de guardar, haz clic en **"Probar envío"**
2. Ingresa un número de teléfono (con código de país, ej: +521234567890)
3. Haz clic en **"Enviar"**
4. Si todo funciona, recibirás un SMS de prueba

## Enviar SMS a un invitado
Desde la tabla de invitados, busca un invitado que tenga teléfono registrado y usa el botón de SMS para enviarle un mensaje con los detalles del evento.

## Costos
- Twilio cobra por SMS enviado (consulta sus tarifas)
- El plan gratuito de Twilio incluye crédito inicial para pruebas

## Ver también
- [Webhooks](01-crear-webhook.md)
