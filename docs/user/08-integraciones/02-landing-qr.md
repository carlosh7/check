# Landing de invitación con QR

> **Versión:** v12.44.677+ | **Módulo:** Eventos

## ¿Para qué sirve?
Compartir una página de invitación digital para tu evento, con código QR que los invitados pueden escanear para registrarse.

## Cómo acceder
Cada evento tiene una página de invitación pública en:

```
https://tudominio.com/[slug-del-evento]/landing
```

o también:

```
https://tudominio.com/landing?event=[id-del-evento]
```

## Qué contiene la landing
- **Nombre del evento** y fecha formateada
- **Ubicación** y descripción
- **Cuenta regresiva** en tiempo real (días, horas, minutos, segundos)
- **Código QR** que lleva al formulario de registro
- **Botón "Confirmar asistencia"** que abre el registro público

## Código QR del evento
El QR se genera automáticamente y contiene el enlace de registro del evento. Puedes:

- **Escanearlo** para ir al formulario de registro
- **Descargarlo** con el botón "Descargar QR" para imprimirlo o compartirlo
- El QR cambia de contenido según el evento

## Compartir la invitación
1. Copia el enlace de la landing desde la barra de direcciones
2. Compártelo por WhatsApp, email, redes sociales, o imprime el QR
3. Los invitados escanean el QR y se registran directamente

## Requisitos
- [ ] Evento creado y público (status ACTIVE)
- [ ] Registro público habilitado en los ajustes del evento
- [ ] (Opcional) Categorías con precios si el evento requiere pago

## Ver también
- [Crear evento](../01-eventos/01-crear-evento.md)
- [Configurar evento](../01-eventos/02-configurar-evento.md)
- [Importar invitados](../02-invitados/01-importar.md)
