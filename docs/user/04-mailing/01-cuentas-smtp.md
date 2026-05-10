# Configurar cuentas SMTP

> **Versión:** v12.44.541+ | **Módulo:** Mailing

## ¿Para qué sirve?
Conectar una cuenta de correo electrónico para poder enviar emails a los invitados desde el sistema.

## Requisitos previos
- [ ] Tener una cuenta de correo con acceso SMTP (Gmail, Outlook, o cualquier proveedor)
- [ ] Conocer los datos de conexión SMTP (servidor, puerto, usuario, contraseña)

## Pasos
1. Ve a **Sistema** > pestaña **"Email"** (o **Configuración del Evento** > **"Mailing"**)
2. Haz clic en **"Nueva Cuenta"**
3. Completa los campos:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Nombre | Identificador interno | "Mi cuenta Gmail" |
| Servidor SMTP | Host del proveedor | smtp.gmail.com |
| Puerto SMTP | 587 (TLS) o 465 (SSL) | 587 |
| Usuario SMTP | Tu correo completo | usuario@gmail.com |
| Contraseña SMTP | Contraseña o app password | **** |
| SSL | Activar si usas puerto 465 | No |

4. Haz clic en **"Probar conexión"** para verificar que los datos sean correctos
5. Si la prueba es exitosa, guarda la cuenta

## Configuración IMAP (opcional)
Para recibir y leer correos desde el sistema (bandeja de entrada), completa también los campos IMAP:
- Servidor IMAP (ej: imap.gmail.com)
- Puerto IMAP (993 con SSL)

## Límite diario
Cada cuenta tiene un límite de envío diario (default: 500 emails). Puedes ajustarlo según los límites de tu proveedor.

## Notas
- Para Gmail, usa una **contraseña de aplicación** (no tu contraseña normal)
- Verifica que tu proveedor permita conexiones SMTP
- Puedes configurar múltiples cuentas y elegir cuál usar para cada campaña

## Ver también
- [Plantillas de email](02-plantillas.md)
- [Campañas masivas](03-campanas.md)
- [Robot automático](04-robot-automatico.md)
