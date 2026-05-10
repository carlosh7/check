# Categorías de invitados

> **Versión:** v12.44.597+ | **Módulo:** Invitados

## ¿Para qué sirve?
Clasificar a los invitados por tipo (VIP, Regular, Staff, Prensa, etc.) para gestionarlos de forma diferenciada.

## Requisitos previos
- [ ] Evento creado

## Pasos

### Crear una categoría
1. Ve a **Configuración del Evento** > pestaña **"Categorías"**
2. Haz clic en **"Nueva Categoría"**
3. Completa:
   - **Nombre** — ej: VIP, Regular, Staff
   - **Color** — color identificativo (se muestra en la tabla)
   - **Capacidad máxima** — límite de invitados en esta categoría (0 = ilimitado)
   - **Orden** — posición en los listados
   - **Precio** — solo si el evento requiere pago (ej: $50.00 para VIP)
4. Guarda

### Asignar categoría a un invitado
1. En la tabla de invitados, busca al invitado
2. Haz clic en el selector de categoría en su fila
3. Selecciona la categoría deseada

### Filtrar por categoría
Usa el filtro de categoría en la parte superior de la tabla de invitados para ver solo los de un tipo específico.

## Capacidad y lista de espera
Si una categoría tiene capacidad máxima:
- Cuando se alcanza el límite, los nuevos invitados se colocan en **lista de espera** (waitlist)
- Si un invitado confirmado cancela, el primero en espera se promueve automáticamente
- El invitado promovido recibe notificación por email

## Precios (solo con pagos activos)
Si activaste pagos en el evento (ver [Configurar pagos](../05-pagos/01-configurar-pagos.md)):
- Cada categoría muestra un campo **"Precio"**
- Los invitados pagan según la categoría que seleccionan al registrarse
- Categorías con precio 0.00 son gratuitas

## Ver también
- [Configurar pagos](../05-pagos/01-configurar-pagos.md)
- [Importar invitados](01-importar.md)
