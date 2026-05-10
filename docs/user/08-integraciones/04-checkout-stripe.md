# Checkout con Stripe

> **Versión:** v12.44.674+ | **Módulo:** Pagos

## ¿Para qué sirve?
Vender boletos en línea. Los invitados pagan con tarjeta de crédito a través de Stripe antes de quedar registrados en el evento.

## Flujo completo

```
1. Admin: activa pagos + asigna precio a categorías
2. Visitante: accede al link de registro
3. Visitante: selecciona categoría + completa datos
4. Visitante: hace clic en "Pagar con Stripe"
5. Visitante: es redirigido a la página de pago de Stripe
6. Visitante: ingresa datos de tarjeta
7. Stripe: procesa el pago
8. Check Pro: webhook recibe confirmación
9. Check Pro: crea el invitado automáticamente
10. Visitante: ve mensaje de "Pago exitoso"
```

## Configurar Stripe

### En el servidor
Agrega las variables de entorno en el archivo `.env`:
```
STRIPE_SECRET_KEY=sk_live_tuclave
STRIPE_WEBHOOK_SECRET=whsec_tuclave
```

### En el panel de Stripe
1. Ve a **Developers > Webhooks** en tu dashboard de Stripe
2. Agrega un endpoint: `https://tudominio.com/api/webhooks/stripe`
3. Escucha el evento: `checkout.session.completed`
4. Copia el **Signing Secret** y ponlo en `STRIPE_WEBHOOK_SECRET`

## Precios por categoría
Ver [Asignar precios a categorías](../05-pagos/02-categorias-precio.md).

## Notas
- Stripe maneja todos los datos de tarjeta, ningún número de tarjeta pasa por nuestro servidor
- El webhook de Stripe verifica la firma criptográfica en cada petición
- Si el pago falla, el invitado puede intentar de nuevo

## Ver también
- [Configurar pagos](../05-pagos/01-configurar-pagos.md)
- [Precios por categoría](../05-pagos/02-categorias-precio.md)
