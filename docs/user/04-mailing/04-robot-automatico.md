# Robot automático

> **Versión:** v12.44.541+ | **Módulo:** Mailing

## ¿Para qué sirve?
Automatizar el envío de emails según las acciones de los invitados, sin intervención manual.

## Cómo funciona
El robot monitorea los eventos del invitado y dispara emails automáticos según reglas configurables.

## Triggers disponibles

| Acción del invitado | Email que se envía |
|---------------------|-------------------|
| Se registra | Plantilla 1 — Invitación |
| Confirma asistencia | Plantilla 6 — Confirmación |
| Rechaza invitación | Plantilla 7 — Rechazo |
| Faltan 7 días | Plantilla 2 — Recordatorio |
| Faltan 3 días | Plantilla 3 — Recordatorio |
| Faltan 1 día | Plantilla 4 — Recordatorio |
| Faltan horas | Plantilla 5 — Recordatorio con QR |
| Después del evento | Plantilla 11 — Agradecimiento |

## Configuración
1. Ve a **Mailing** > **"Robot Automático"**
2. Activa o desactiva cada trigger según necesites
3. Selecciona qué plantilla usar para cada trigger
4. Guarda la configuración

## Notas
- El robot funciona aunque no estés conectado
- Cada trigger se puede activar/desactivar individualmente
- Los emails se envían desde la cuenta SMTP configurada por defecto
- Los recordatorios automáticos solo se envían a invitados que aún no han respondido

## Ver también
- [Cuentas SMTP](01-cuentas-smtp.md)
- [Plantillas](02-plantillas.md)
- [Campañas masivas](03-campanas.md)
