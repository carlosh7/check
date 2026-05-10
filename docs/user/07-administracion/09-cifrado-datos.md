# Cifrado de Datos Sensibles

## ¿Qué es?

Sistema de cifrado AES-256-GCM que protege datos sensibles (como passwords SMTP/IMAP)
almacenados en la base de datos. Los datos se cifran antes de guardarse y se descifran
solo cuando se necesitan usar (ej: enviar un email).

## ¿Para qué sirve?

- Protege credenciales SMTP/IMAP aunque alguien acceda a la base de datos
- Cumple con requisitos de seguridad GDPR (datos personales cifrados en reposo)
- Previene exposición de contraseñas en backups o exportaciones

## ¿Cómo funciona?

1. Se genera una clave maestra de 256 bits (`ENCRYPTION_KEY` en `.env`)
2. Al guardar un password SMTP/IMAP, se cifra con AES-256-GCM antes de escribirlo en la BD
3. Al leerlo para usar (enviar email, conectar IMAP), se descifra en memoria
4. Cada cifrado usa un IV único (vector de inicialización) para máxima seguridad
5. Los valores cifrados se identifican por el prefijo `$aes-gcm$`

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
```

Reemplaza `el_valor_generado_en_el_paso_anterior` con la clave que generaste.

### 3. Verificar que funciona

```bash
curl https://tudominio.com/api/deploy/encryption-status
```

Respuesta esperada:

```json
{ "enabled": true, "algorithm": "aes-256-gcm", "key_configured": true, "key_length": 256 }
```

### 4. Migrar passwords existentes

Si ya tenias cuentas de email configuradas antes de agregar la clave, sus passwords
siguen en texto plano. Para migrarlos:

```bash
curl -X POST https://tudominio.com/api/deploy/migrate-encryption
```

Respuesta esperada:

```json
{ "ok": true, "migrated": { "smtp": 3, "imap": 2 } }
```

(El numero indica cuantos passwords se convirtieron a cifrados.)

## Seguridad

- **Algoritmo:** AES-256-GCM (cifrado autenticado con integridad)
- **Vector de inicializacion unico:** Cada cifrado genera un IV aleatorio de 16 bytes
- **Tag de autenticacion:** 16 bytes que verifican que los datos no fueron alterados
- **Clave:** Derivada via SHA-256 de la variable `ENCRYPTION_KEY`
- **Formato en BD:** `$aes-gcm$<base64iv>.<hex_ciphertext>.<hex_tag>`

## Recuperacion ante perdida de clave

Si pierdes la `ENCRYPTION_KEY`, los passwords cifrados NO se podran recuperar.
Las cuentas de email dejaran de funcionar hasta que configures nuevas contraseñas.

**Recomendacion:** Guarda la clave en un gestor de contraseñas (Bitwarden, 1Password, etc.).
