# Check-in

> **Versión:** v12.44.0+ | **Módulo:** Invitados

## ¿Para qué sirve?
Registrar la asistencia de los invitados al evento, ya sea manualmente o mediante código QR.

## Requisitos previos
- [ ] Evento creado con invitados registrados
- [ ] Cada invitado tiene un código QR único (se genera automáticamente al registrarse)

## Pasos — Check-in manual

### Desde la tabla de invitados
1. Ve a **Configuración del Evento** > pestaña **"Invitados"**
2. Busca al invitado en la tabla
3. Haz clic en el botón **"Check-in"** en la fila del invitado
4. Se marca como **asistió** con la hora actual

### Desde el escáner QR
1. En la misma pestaña, haz clic en **"Escanear QR"**
2. Apunta la cámara al código QR del invitado (puede ser desde su teléfono o ticket impreso)
3. El sistema detecta automáticamente al invitado y marca su asistencia
4. Verás un mensaje verde de confirmación

## Historial de check-in
La tabla de invitados muestra:
- ✅ **Check-in realizado** — con fecha y hora exacta
- ⬜ **No ha llegado** — pendiente de asistencia
- Los filtros permiten ver solo los que asistieron o los pendientes

## Exportar asistencias
Puedes descargar el listado de asistentes desde el botón **"Exportar"** en la tabla de invitados. Formatos disponibles: Excel, CSV y PDF.

## Solución de problemas
- **El QR no se escanea** — el invitado puede mostrar el código desde su email de confirmación o desde el ticket digital
- **"Ya registrado"** — el invitado ya hizo check-in previamente
- **Cámara no disponible** — usa el check-in manual desde la tabla

## Ver también
- [Importar invitados](01-importar.md)
- [Exportar invitados](04-exportar.md)
