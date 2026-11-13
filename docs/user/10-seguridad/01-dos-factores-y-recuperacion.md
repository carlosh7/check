# Seguridad de tu cuenta

## Activar verificación en dos pasos (2FA)
1. Ve a **Perfil** (sidebar → tu nombre) → tarjeta **Seguridad**.
2. Click en **Activar 2FA** → el sistema te pide **confirmar tu contraseña actual** (desde v12.44.842: así nadie puede cambiar tu 2FA con una sesión abierta ajena).
3. Escanea el QR con Google Authenticator, Authy o similar.
4. Ingresa el código de 6 dígitos de la app → **Verificar y Activar**.
5. Desde ahora, al iniciar sesión te pedirá el código TOTP después de la contraseña.

> Para desactivarla: mismo lugar → **Desactivar 2FA** → confirma con tu **contraseña actual**.
> Si la contraseña no coincide, la 2FA no se toca.

## Recuperar contraseña olvidada
1. En la pantalla de login, click en **¿Olvidaste tu contraseña?**
2. Ingresa tu email → recibirás un **código de 6 dígitos** (válido 30 min).
3. Ingresa el código + tu nueva contraseña (mínimo 8 caracteres).
4. Vuelve al login e ingresa con la nueva clave.

> Requiere SMTP configurado por el administrador (Sistema → Email).
