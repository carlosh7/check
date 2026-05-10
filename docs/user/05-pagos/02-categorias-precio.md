# Asignar precios a categorías

> **Versión:** v12.44.669+ | **Módulo:** Pagos

## ¿Para qué sirve?
Definir cuánto cuesta cada tipo de boleto en tu evento.

## Requisitos previos
- [ ] Pagos activados en el evento (ver [Configurar pagos](01-configurar-pagos.md))
- [ ] Categorías creadas

## Pasos
1. Ve a **Configuración del Evento** > pestaña **"Categorías"**
2. Busca la categoría a la que quieres asignar precio
3. Haz clic en el icono **✏️ Editar** de esa categoría
4. En el campo **"Precio ($)"**, ingresa el valor (ej: 50.00)
5. Guarda los cambios

## Comportamiento
| Precio | Resultado |
|--------|-----------|
| 0.00 | La categoría es **gratuita** — el invitado se registra sin pagar |
| > 0 | La categoría es **de pago** — el invitado debe pagar para registrarse |

## Ejemplo
- **VIP**: $100.00 — acceso prioritario, incluye comida
- **Regular**: $50.00 — entrada general
- **Staff**: $0.00 — gratuito para el equipo

## Notas
- El precio se muestra en la moneda configurada en los ajustes del evento
- Los invitados ven el precio al seleccionar la categoría en el formulario de registro
- Si la categoría tiene capacidad máxima, al agotarse se activa la lista de espera

## Ver también
- [Configurar pagos](01-configurar-pagos.md)
- [Categorías de invitados](../02-invitados/03-categorias.md)
