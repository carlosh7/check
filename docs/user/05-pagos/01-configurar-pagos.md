# Configurar pagos (Stripe / PayPal)

> **Versión:** v12.44.669+ | **Módulo:** Pagos

## ¿Para qué sirve?
Vender boletos para tu evento. Los invitados pagan antes de registrarse.

## Requisitos previos
- [ ] Cuenta de **Stripe** (para pagos con tarjeta) — https://stripe.com
- [ ] (Opcional) Cuenta de **PayPal Business**
- [ ] `STRIPE_SECRET_KEY` configurada en el servidor (variable de entorno)
- [ ] Categorías de invitados creadas (VIP, Regular, etc.)

## Pasos

### 1. Activar pagos en el evento
1. Ve a **Configuración del Evento** > **Ajustes** > **"Pasarela de Pagos"**
2. Activa **"Requerir pago para registrarse"**
3. Selecciona la **moneda** (USD, EUR, MXN, etc.)
4. (Opcional) Ingresa tu **Stripe Account ID** o **PayPal Email**
5. Guarda cambios

### 2. Asignar precios a categorías
Ve a la pestaña **"Categorías"** del evento y asigna un precio a cada categoría (ver [Precios por categoría](02-categorias-precio.md)).

### 3. El flujo del invitado
1. El invitado accede al link de registro del evento
2. Completa sus datos y selecciona una categoría (con precio)
3. Hace clic en **"Pagar con Stripe"**
4. Es redirigido a la página de pago de Stripe
5. Ingresa los datos de su tarjeta
6. Al pagar exitosamente, el sistema lo registra automáticamente como invitado
7. Recibe un email de confirmación con su código QR

## Webhook de Stripe
Para que el pago automático funcione:
1. En tu panel de Stripe, ve a **Developers > Webhooks**
2. Agrega un endpoint: `https://tudominio.com/api/webhooks/stripe`
3. Escucha el evento: `checkout.session.completed`
4. Stripe verificará la firma automáticamente

## Ver también
- [Precios por categoría](02-categorias-precio.md)
- [Categorías de invitados](../02-invitados/03-categorias.md)
