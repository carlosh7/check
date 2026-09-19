# Benchmark — Check Pro vs BlastTickets (v12.44.817)

> **Fecha:** 2026-09-19 · **Fuente:** <https://www.info.blasttickets.com/> (landing informativa pública).
> **Nota metodológica:** análisis sobre la información publicada en su web; no se evaluó el producto por dentro. Los "✅ de Check" provienen del inventario funcional del repositorio a v12.44.817.

---

## Resumen Ejecutivo

BlastTickets es una plataforma **colombiana** (desde 2022) de ticketing y gestión para eventos en vivo, con IA como argumento de marca ("Donde los eventos se potencian con IA"). A diferencia de los competidores analizados en el Ciclo 11 (Partiful, RSVPify, Whova, Splash — ver `docs/repos-analysis.md`), BlastTickets está **muy focalizada en el ciclo venta → acceso**: entradas, pagos, control de puerta.

**Conclusión:** Check Pro ya cubre o supera a BlastTickets en engagement del asistente, gestión de invitados y amplitud funcional (gamificación, networking, badges, certificados, CRM, plugins, API pública). Las brechas reales están en el flanco **comercial y de operación en puerta**: red de promotores, multipasarela de pagos, check-in offline robusto, upsells y analítica con atribución.

---

## Qué es BlastTickets

### Ecosistema de 3 productos

| Producto | Qué hace |
|----------|----------|
| **Marketplace** | Publicación de eventos, multipasarela de pagos, upsellings/consumibles, UX orientada a conversión, URL con White Label |
| **Backoffice** | Panel autogestionable: configuración de eventos, dashboards y reportes, mapas interactivos, comunicación masiva, control de asistentes, promotores y descuentos |
| **BlastDoor** | Control de accesos: validación QR (<1s), app offline Android/iOS/PDA, dashboard de asistencia en vivo, equipos por rol y localidad, soporte 24/7 |

### Modelo de negocio (2 vías)

1. **Blasttickets (gestionado):** comisión por ticket; ellos operan tecnología, pagos y soporte al comprador.
2. **White Label:** cobro por uso de la plataforma, dirigido a organizadores con **+5.000 tickets/año**; recaudo a cuenta propia, marca y dominio propios.

Sin precios públicos; cotización vía WhatsApp (+57 322 376 3994).

### Métricas declaradas (para confianza comercial)

+300 eventos operados · +500K tickets emitidos · +20 implementaciones white label · +5M USD transaccionados.

---

## Gap Analysis — Check Pro vs BlastTickets

| Feature | BlastTickets | Check Pro v12.44.817 | Estado |
|---------|--------------|----------------------|--------|
| **Red de promotores** (links/códigos únicos, comisiones automáticas, rankings, metas) | ✅ | ❌ No existe | **Brecha** |
| **Multipasarela de pagos** (varias pasarelas, foco LATAM) | ✅ | ⚠️ Solo Stripe (`payments.routes.js`); PayPal planificado (F3-07) sin aterrizar | **Brecha parcial** |
| **Escáner offline / PDA** (check-in sin red, sync diferido, hardware PDA) | ✅ (BlastDoor) | ⚠️ PWA con offline, pero sin cola de check-ins ni sincronización diferida; sin soporte PDA | **Brecha parcial** |
| **Upsells / consumibles** en el checkout | ✅ | ❌ Hay carrito y cupones (`ecommerce.routes.js`), sin upsells explícitos | **Brecha** |
| **Analítica comercial** (ventas por hora/zona/canal, fuentes de tráfico, alertas automáticas) | ✅ | ⚠️ Dashboards BI + reportes IA, sin atribución de tráfico ni alertas automáticas | **Brecha parcial** |
| **Mapas 3D "desde la butaca"** + bloqueo de cortesías/holds | ✅ | ⚠️ 3D Planner + `seat-layouts.routes.js` existen (sin vista desde butaca ni estados hold/cortesía documentados) | **Evaluar** |
| White label / multi-tenant | ✅ | ✅ (`tenants.routes.js`) | A la par |
| Validación QR rápida + detección de duplicados | ✅ | ✅ (check-in QR, OTP, kiosco) | A la par |
| Comunicación masiva segmentada | ✅ | ✅ (email/SMS/WhatsApp/push programados y segmentados) | A la par o superior |
| Marketplace público de eventos (descubrimiento) | ✅ | ❌ (Check opera por evento con landing propia) | Fuera de foco actual |
| Engagement (gamificación, networking, encuestas, álbum, chatbot) | ❌ (no se menciona) | ✅ | **Check supera** |
| Badges, certificados, CRM, plugins, API pública | ❌ (no se menciona) | ✅ | **Check supera** |

---

## Candidatas al ROADMAP (detalle)

### C12-01 — Red de promotores/afiliados

- **Qué ofrece BlastTickets:** links y códigos únicos por promotor, comisiones automáticas, rankings y metas.
- **Qué hay hoy en Check:** cupones/descuentos (`ecommerce.routes.js`) pero sin atribución de venta a un tercero ni cálculo de comisiones.
- **Alcance estimado (Esfuerzo L):** tabla de promotores por evento, código/link único con tracking (utm/prefix en registro público), atribución de ventas e invitados por promotor, cálculo de comisiones y ranking. Rutas nuevas tipo `promoters.routes.js` + vista en Config. Evento.

### C12-02 — Multipasarela de pagos local

- **Qué ofrece BlastTickets:** multipasarela orientada al mercado colombiano/latinoamericano.
- **Qué hay hoy en Check:** Stripe completo (checkout, webhooks, confirmación antes de registrar invitado); PayPal lleva desde F3-07 sin aterrizar (no hay SDK en dependencias).
- **Alcance estimado (Esfuerzo M/L):** abstracción de gateway (adaptador común checkout/webhook/reembolso) sobre el que enchufar PayPal primero y luego pasarelas LATAM (Mercado Pago, PayU, Wompi/PSE). Credenciales por pasarela en `.env`/config por tenant — nunca en código.

### C12-03 — Check-in offline con sincronización diferida (escáner/PDA)

- **Qué ofrece BlastTickets:** BlastDoor valida QR en <1s, funciona offline, Android/iOS/PDA, con detección de duplicados y dashboard de asistencia en vivo.
- **Qué hay hoy en Check:** check-in QR + WebSocket en vivo + kiosco; la PWA del portal asistente es offline-capable, pero el **flujo de escaneo** no está diseñado para operar sin red.
- **Alcance estimado (Esfuerzo M):** cola local (IndexedDB) de check-ins sin conexión, sincronización diferida al recuperar red, resolución de duplicados/conflictos (mismo QR escaneado offline en varias puertas), indicador de estado online/offline en la vista de escaneo, y guía de hardware PDA (lectores Android).

### C12-04 — Upsells / consumibles en checkout

- **Qué ofrece BlastTickets:** upsellings y consumibles en el flujo de compra, orientados a aumentar el ticket promedio.
- **Qué hay hoy en Check:** carrito de compras, cupones, tiers de precio, facturación PDF.
- **Alcance estimado (Esfuerzo M):** catálogo de productos extras por evento (merch, consumibles, upgrades), ofertados como paso previo al pago en el registro público, reflejados en el receipt.

### C12-05 — Atribución por fuente de tráfico + alertas automáticas de ventas

- **Qué ofrece BlastTickets:** ventas por hora/zona/canal, fuentes de tráfico, alertas automáticas, comparativas entre eventos.
- **Qué hay hoy en Check:** dashboards analytics/ejecutivo, tendencias, reportes IA; sin captura de UTM ni alertas automáticas.
- **Alcance estimado (Esfuerzo M):** capturar parámetros UTM/referrer en el registro público y almacenarlos por invitado, dashboard de conversión por canal, y reglas de alerta (email/push) sobre ritmo de ventas.

### C12-06 — Evaluar mejora de seating visual

- **Qué ofrece BlastTickets:** mapas 3D interactivos por sala/sector/aforo con "vista desde la butaca", editor propio de layouts y bloqueo de cortesías/holds.
- **Qué hay hoy en Check:** 3D Planner (React) + `seat-layouts.routes.js` con drag-drop.
- **Alcance estimado (Esfuerzo M, prioridad baja):** partir de un inventario de qué falta exactamente (vista desde butaca, estados hold/cortesía por asiento) antes de proponer desarrollo.

---

## Aprendizajes de modelo de negocio (no son código)

1. **Dos vías de monetización claras:** comisión por ticket (producto gestionado) vs white label por uso (+5.000 tickets/año, recaudo y marca propios). Check ya tiene el multi-tenant técnico, así que la vía white label está a medio camino.
2. **Vender con métricas de confianza:** +300 eventos / +500K tickets / +5M USD en la landing. Equivalente para SmartEventos: nº de eventos operados, asistentes registrados, taux de check-in.
3. **Canal de contacto simple:** WhatsApp directo para cotizar, sin formularios friccionales.
4. **"Datos propiedad del organizador"** como argumento de venta — Check ya lo cumple por diseño (BD SQLite por evento, exportación BI).

---

## Recomendación

Abordar **C12-03 (check-in offline)** y **C12-02 (multipasarela)** como prioritarias: robustecen el core operativo (la puerta) y desbloquean ventas en LATAM respectivamente. **C12-01 (promotores)** como tercera por su alto valor comercial con esfuerzo mayor. Las propuestas formalizadas viven en `docs/ROADMAP.md` → Ciclo 12.
