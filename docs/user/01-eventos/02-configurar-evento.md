# Configurar evento

> **Versión:** v12.44.0+ | **Módulo:** Eventos

## ¿Para qué sirve?
Personalizar la configuración de un evento: desde el formulario de registro público hasta los colores de los tickets, restricciones de email y más.

## Acceso
1. En la lista de eventos, haz clic en el evento
2. Ve a la pestaña **"Configuración"** (icono de ajustes)
3. Aparecen las sub-pestañas de configuración

## Secciones de configuración

### Información del evento
Campos básicos: nombre, ubicación, descripción, fechas. Se editan desde **Ajustes > Información del Evento**.

### Registro público (Ajustes > Formulario de registro)
Configura cómo se ve el formulario que los invitados ven al registrarse:
- **Título** — texto principal del formulario
- **Mensaje de bienvenida** — texto que aparece antes del formulario
- **Mensaje de éxito** — texto después de registrarse
- **Política de datos** — texto legal que el invitado debe aceptar

**Campos visibles**: puedes mostrar/ocultar:
- Teléfono, Empresa, Cargo, Vegano, Género, Notas dietéticas
- **Aceptar términos** — obliga al invitado a marcar un checkbox

### Personalización visual (Ajustes > Personalización Visual)
- **Colores QR** — color oscuro y claro del código QR
- **Color de acento del ticket** — color del borde del ticket PDF
- **Logo del QR** — imagen central del código QR
- **Fondo del ticket** — imagen de fondo del ticket PDF

### Restricciones de email (Ajustes > Restricciones de Registro)
- **Whitelist** — solo emails de ciertos dominios pueden registrarse (ej: @miempresa.com)
- **Blacklist** — emails de ciertos dominios son bloqueados

### Pagos (Ajustes > Pasarela de Pagos)
- **Requerir pago** — activa venta de boletos
- **Moneda** — USD, EUR, MXN, etc.
- **Stripe Account ID** — para conectar tu cuenta de Stripe
- **PayPal Email** — para recibir pagos por PayPal

### Categorías
Las categorías se gestionan desde la pestaña **"Categorías"** del evento.
- Crea categorías como VIP, Regular, Staff
- Asigna **precio** a cada categoría (si el evento requiere pago)
- Define **capacidad máxima** para controlar aforo

## Guardar cambios
Todos los cambios se guardan con el botón **"Guardar Cambios"** al final de la página de Ajustes.

## Ver también
- [Crear evento](01-crear-evento.md)
- [Importar invitados](../02-invitados/01-importar.md)
- [Configurar pagos](../05-pagos/01-configurar-pagos.md)
