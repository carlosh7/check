# Portal del Asistente (PWA)

> **Versión:** v12.44.678+ | **Módulo:** Portal

## ¿Para qué sirve?
Un portal móvil para que los invitados vean su ticket digital, la agenda del evento y reciban notificaciones. Funciona como una app instalable en el celular.

## Cómo accede el invitado
Cada invitado recibe un enlace único:

```
https://tudominio.com/mi-evento/portal?g={id-del-invitado}
```

Este enlace está en el email de confirmación y en el ticket digital.

## Qué incluye el portal

### 🎟️ Ticket digital
- Nombre del invitado
- Código QR para check-in
- Estado: ✅ Check-in realizado / ⏳ Pendiente

### 📋 Agenda
- Lista de sesiones del evento con hora y sala
- Solo visible si el evento tiene sesiones configuradas

### ℹ️ Información del evento
- Fecha y ubicación
- Notificaciones push (activación voluntaria)

## Instalar la app (Add to Home Screen)
1. Abre el portal en el celular (Chrome o Safari)
2. Aparecerá una barra: **"Instala esta app para acceso rápido"**
3. Toca **"Instalar"**
4. Se agrega un icono en la pantalla de inicio
5. La próxima vez abre como una app normal

## Notificaciones push
1. En la pestaña "Evento", toca **"Activar notificaciones"**
2. El navegador pedirá permiso — concederlo
3. A partir de ahí recibirás notificaciones cuando el organizador envíe actualizaciones

## Requisitos
- [ ] Invitado registrado en el evento
- [ ] (Opcional) Sesiones configuradas en el evento para mostrar agenda
- [ ] (Opcional) VAPID keys configuradas para notificaciones push

## Ver también
- [Check-in de invitados](../02-invitados/02-checkin.md)
- [Sesiones del evento](../01-eventos/02-configurar-evento.md)
