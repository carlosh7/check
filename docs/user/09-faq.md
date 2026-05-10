# Preguntas frecuentes

> **Versión:** v12.44.674+

## General

### ¿Cómo recupero mi contraseña?
En la pantalla de inicio de sesión, haz clic en **"¿Olvidaste tu contraseña?"**. Ingresa tu correo y recibirás un código de 6 dígitos para restablecerla.

### ¿Puedo tener múltiples eventos?
Sí. Puedes crear tantos eventos como necesites. Cada evento es independiente con sus propios invitados y configuración.

## Invitados

### ¿Cuántos invitados puedo tener?
No hay límite. Cada evento puede tener miles de invitados. Los eventos grandes pueden usar una base de datos independiente para mejor rendimiento.

### ¿Puedo importar invitados desde Excel?
Sí. Ve a la pestaña **Invitados** del evento y haz clic en **"Importar"**. Soporta Excel (.xlsx), CSV y PDF.

### ¿Cómo evito que alguien se registre varias veces?
El sistema detecta duplicados por email automáticamente. También puedes activar restricciones por dominio de email en los ajustes del evento.

## Pagos

### ¿Qué necesito para cobrar?
Una cuenta de Stripe (para pagos con tarjeta). Opcionalmente PayPal Business. Configura las claves en el servidor y activa los pagos en los ajustes del evento.

### ¿El pago es seguro?
Sí. Los datos de la tarjeta nunca pasan por nuestro servidor. Stripe y PayPal manejan el pago directamente con sus propios sistemas de seguridad.

## Ruleta

### ¿Puedo hacer múltiples sorteos?
Sí. Cada ruleta permite girar múltiples veces. Si activas "Auto-remover ganador", los participantes ganadores se eliminan de la lista automáticamente.

### ¿Los participantes pueden girar desde su teléfono?
Sí. Comparte el link público de la ruleta y cualquier persona con el link puede girar desde su dispositivo.

## Mailing

### ¿Los emails llegan a la bandeja de entrada?
Depende de la configuración de tu cuenta SMTP y de las políticas del proveedor. Recomendamos usar un servicio transaccional como SendGrid o AWS SES para mejor entregabilidad.

### ¿Cuántos emails puedo enviar por día?
Depende del límite configurado en tu cuenta SMTP. Por defecto son 500 emails por día, pero puedes ajustarlo.

## Técnico

### ¿Qué navegadores soporta?
Chrome, Firefox, Safari y Edge en sus versiones actuales.

### ¿Hay app móvil?
No hay app nativa, pero la plataforma funciona correctamente en el navegador del teléfono.
