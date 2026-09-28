# Cifrado de Datos Sensibles

## ¿Qué es?

Sistema de cifrado AES-256-GCM que protege datos sensibles (passwords SMTP/IMAP, token de
Twilio y los BACKUPS completos de la base de datos). Los datos se cifran antes de guardarse
y se descifran solo cuando se necesitan usar (ej: enviar un email).

## ¿Para qué sirve?

- Protege credenciales SMTP/IMAP y de Twilio aunque alguien acceda a la base de datos
- Protege los BACKUPS: quedan cifrados (`.db.enc`), sin datos personales en claro en disco
- Cumple con requisitos de seguridad (datos personales cifrados en reposo, Ley 1581)
- Previene exposición de contraseñas en exportaciones

## ¿Cómo funciona?

1. Se genera una clave maestra de 256 bits (`ENCRYPTION_KEY` en `.env`)
2. Al guardar un password SMTP/IMAP o el token de Twilio, se cifra con AES-256-GCM antes
   de escribirlo en la BD
3. Al leerlo para usar (enviar email, enviar SMS), se descifra en memoria
4. Cada cifrado usa un IV único (vector de inicialización) para máxima seguridad
5. Los valores cifrados se identifican por el prefijo `$aes-gcm$`
6. **Backups (desde v12.44.820):** cada backup se comprime y cifra con
   `BACKUP_ENCRYPTION_KEY` (o `ENCRYPTION_KEY` si no hay dedicada) → archivo `.db.enc`.
   Sin clave definida, el backup queda en claro PERO el sistema lo grita: aviso en los
   logs, registro en auditoría (`ENCRYPTION_KEY_MISSING`) y el chequeo
   `/api/health/full` se marca en amarillo.

## Configuración

### 1. Generar clave de cifrado

Abre la terminal y ejecuta:

```bash
openssl rand -hex 32
```

Esto genera una clave de 64 caracteres hexadecimales.

### 2. Agregar al `.env`

Abre el archivo `.env` y agrega:

```env
ENCRYPTION_KEY=el_valor_generado_en_el_paso_anterior
BACKUP_ENCRYPTION_KEY=otra_clave_distinta_opcional_pero_recomendada
```

Reemplaza los valores con claves que generaste. Puedes usar la misma clave para todo,
pero la dedicada de backups te permite rotarla sin tocar las credenciales.

### 3. Verificar que funciona

```bash
curl https://tudominio.com/api/deploy/encryption-status
```

Respuesta esperada:

```json
{ "enabled": true, "algorithm": "aes-256-gcm", "key_configured": true, "key_length": 256 }
```

Y el estado general (incluye backups):

```bash
curl https://tudominio.com/api/health/full | jq .encryption
```

### 4. Migrar credenciales existentes

Al arrancar con `ENCRYPTION_KEY` definida, el sistema migra SOLO las credenciales de
Twilio que estaban en claro. Para las cuentas de email antiguas:

```bash
curl -X POST https://tudominio.com/api/deploy/migrate-encryption
```

Respuesta esperada:

```json
{ "ok": true, "migrated": { "smtp": 3, "imap": 2 } }
```

(El numero indica cuantos passwords se convirtieron a cifrados.)

## Verificar que los backups se pueden RESTAURAR (desde v12.44.820)

Un backup que no se puede restaurar no sirve. Verifícalo periódicamente:

```bash
node scripts/verify-backup-restore.js            # verifica el más reciente
node scripts/verify-backup-restore.js --all      # verifica todos los vigentes
node scripts/verify-backup-restore.js --create   # crea uno fresco y lo verifica
```

Salida esperada:

```
✓ [cifrado] check_app_backup_....db.enc — integrity: ok — usuarios:1 eventos:56 ...
✓ RESTAURACIÓN VERIFICADA: todos los backups probados se restauran correctamente.
```

## Seguridad

- **Algoritmo:** AES-256-GCM (cifrado autenticado con integridad)
- **Vector de inicializacion unico:** Cada cifrado genera un IV aleatorio de 16 bytes
- **Tag de autenticacion:** 16 bytes que verifican que los datos no fueron alterados
  (con la clave equivocada, el descifrado FALLA en lugar de devolver basura)
- **Clave:** Derivada via SHA-256 de las variables `ENCRYPTION_KEY` / `BACKUP_ENCRYPTION_KEY`
- **Formato en BD:** `$aes-gcm$<base64iv>.<hex_ciphertext>.<hex_tag>`
- **Formato de backups:** `$bkenc1$` + gzip + AES-256-GCM

## Recuperacion ante perdida de clave

Si pierdes la `ENCRYPTION_KEY`, las credenciales cifradas NO se podran recuperar
(las cuentas de email/SMS dejaran de funcionar hasta que configures nuevas).
Si pierdes `BACKUP_ENCRYPTION_KEY`, los backups `.db.enc` son irrecuperables.

**Recomendacion:** Guarda ambas claves en un gestor de contraseñas (Bitwarden, 1Password, etc.).

