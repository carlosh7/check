# Guía de Entregabilidad de Emails: SPF, DKIM y DMARC

Para que los correos enviados desde **Check Pro** lleguen a la bandeja de entrada y no a SPAM, es fundamental configurar correctamente el dominio en tu proveedor de DNS.

## 1. SPF (Sender Policy Framework)
Indica qué servidores están autorizados para enviar correos en nombre de tu dominio.

- **Qué hacer**: Añadir un registro TXT en tu DNS.
- **Ejemplo (si usas Gmail)**: 
  `v=spf1 include:_spf.google.com ~all`
- **Por qué**: Evita que otros suplanten tu identidad.

## 2. DKIM (DomainKeys Identified Mail)
Añade una firma digital a tus correos para que el receptor verifique que el mensaje no fue alterado.

- **Qué hacer**: Generar una clave DKIM en tu panel de administración de correo (ej. Google Workspace) y pegarla como un registro TXT en tu DNS.
- **Formato**: `google._domainkey.tudominio.com` con un valor largo de base64.

## 3. DMARC (Domain-based Message Authentication)
Le dice a los servidores receptores qué hacer si SPF o DKIM fallan (ej. poner en cuarentena o rechazar).

- **Qué hacer**: Añadir un registro TXT llamado `_dmarc`.
- **Recomendación inicial**: 
  `v=DMARC1; p=none; rua=mailto:admin@tudominio.com`
- **Por qué**: Te permite recibir reportes de quién está enviando correos en tu nombre.

## 4. Consejos de Contenido (Anti-SPAM)
- **Evitar palabras "gatillo"**: Como "Gratis", "Urgente", "Ganador", "$$$".
- **Enlace de Desuscripción**: Siempre incluirlo (será automatizado por Check Pro).
- **Reputación de IP**: No envíes miles de correos el primer día; empieza poco a poco ("Warm-up").

---
**Nota**: Este archivo es de seguimiento. Una vez configurados los DNS, puedes marcar estos puntos como completados.
