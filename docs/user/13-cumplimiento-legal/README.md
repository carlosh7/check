# 13 — Cumplimiento Legal (Fase L, v12.44.818-819)

Guía de las funciones de protección de datos (Ley 1581 de 2012) incorporadas en
v12.44.818 y ampliadas en v12.44.819 (secciones 8 y 9).
Base de análisis: `docs/LEGAL/` (informe ejecutivo, marco normativo y modelo de evidencias).

## 1. Consentimiento en el registro público (invitados)

- El checkbox **"Acepto la política de tratamiento de datos personales"** ahora se valida
  **en el servidor**: si el evento exige acuerdo (`reg_require_agreement`) y el invitado no lo
  marca, el registro se rechaza aunque manipulen la página.
- **Queda prueba de la autorización**: texto de la política aceptado (con hash de versión),
  fecha/hora, IP y navegador, guardados en el registro de consentimientos del evento.
- **Acompañantes (plus-ones):** al añadir acompañantes aparece una declaración
  ("Declaro que cuento con la autorización de mis acompañantes…") obligatoria. Cada
  acompañante recibe, si hay SMTP configurado, un email de aviso con canal de salida.

## 2. Aceptación de Términos al solicitar cuenta (organizadores)

- El formulario "Solicitar Cuenta" ahora exige aceptar los
  [Términos](/legal/terminos) y la [Política de Privacidad](/legal/privacidad).
- La aceptación queda registrada con fecha, IP y versión del documento.
- Cada usuario puede descargar sus datos y consentimientos desde
  `GET /api/me/export` (portabilidad, Ley 1581 / GDPR).

## 3. Declaración de autorización al importar datos (¡la más importante!)

Cuando importas tu base de invitados (Excel/CSV/Sheets), la plataforma te pide marcar:

> *"Declaro que cuento con la **autorización previa de los titulares** de estos datos
> personales para su tratamiento (Ley 1581 de 2012)."*

- Sin esa marca, la importación **no se ejecuta**.
- Cada importación queda **auditada**: quién, cuándo, qué archivo, cuántos registros.
- Este registro es tu defensa (y la de Check Pro) ante una queja de un titular o la SIC:
  demuestra que la plataforma exigió la garantía en cada importación.

## 4. Token de kiosco (nuevo, opcional pero recomendado)

Por defecto los kioscos de auto-check-in siguen funcionando como siempre, **pero los
emails ya no se muestran completos** (aparecen `j***@dominio`) para impedir que alguien
descargue la lista de invitados desde el buscador público.

Para blindar un kiosco:

1. Genera el token: `POST /api/events/<ID_EVENTO>/kiosk-token` (con sesión de admin/productor).
2. Abre el kiosco con `?kt=<TOKEN>` en la URL (o pégalo una vez; el navegador lo recuerda).
3. Mientras el evento tenga token, las búsquedas y check-ins sin token devuelven 403.
4. Para revocar: `DELETE /api/events/<ID_EVENTO>/kiosk-token`.

Los administradores pueden activar el modo estricto (kioscos sin token = bloqueados)
con la variable de entorno `KIOSK_TOKEN_MODE=strict`.

## 5. Emails masivos con fuente de datos y baja (Ley 1335)

Toda campaña de email ahora incluye, si la plantilla no trae su propio enlace de baja,
un pie legal: **por qué recibes este mensaje** (fuente de los datos), derecho de ARCO y
enlace **"No quiero recibir más mensajes"**. Los destinatarios dados de baja siguen
excluidos de los envíos.

## 6. Documentos legales públicos

Rutas públicas con plantillas listas para completar (marcadas como PLANTILLA —
validar con abogado antes del uso definitivo):

- `/legal/terminos` — Términos y Condiciones del servicio
- `/legal/privacidad` — Política de Tratamiento de Datos Personales
- `/legal/cookies` — Política de cookies y almacenamiento local

## 7. Export de consentimientos (panel de compliance)

En Compliance → Consentimientos: `GET /api/compliance/consent/<eventId>/export`
descarga un **CSV con la evidencia de autorización** de todos los registrados del evento
(fecha, tipo, aceptación, nombre, email, IP, texto+hash de la política). Úsalo como
expediente ante una queja o auditoría.

## 8. Verificación anti-robots en el registro público (v12.44.819)

El formulario de registro de invitados muestra ahora un **desafío matemático
anti-bots** ("Verificación anti-robots: 4 × 7 + 2 = ?"). Es obligatorio y se valida
**en el servidor** (`POST /api/public-register` rechaza el registro sin solución
válida); cada desafío es de un solo uso y expira a los 5 minutos. Tras un intento
fallido el desafío se renueva automáticamente. La generación está limitada por IP
(30 desafíos cada 10 minutos): si un visitante la agota, debe esperar unos minutos.

## 9. Mis datos: portabilidad y borrado de cuenta (v12.44.819)

En **Sistema → Cuenta** hay una tarjeta "Mis Datos (Ley 1581)" con dos botones:

- **Exportar mis datos**: descarga un JSON con tu perfil y tus consentimientos
  (`GET /api/me/export` — portabilidad, Ley 1581 / GDPR).
- **Eliminar mi cuenta**: pide tu contraseña y escribir **ELIMINAR** como
  confirmación. El borrado **anonimiza** tus datos de forma irreversible (email
  sustituido por un identificador no atribuible, nombre y teléfono fuera,
  contraseña inutilizable) y la cuenta queda inaccesible al momento. La evidencia
  de consentimientos y bitácoras se conserva por deber legal (Ley 1581). Las
  cuentas **ADMIN no pueden autodestruirse**: un administrador solo puede ser
  eliminado desde la gestión de usuarios por otro administrador.
