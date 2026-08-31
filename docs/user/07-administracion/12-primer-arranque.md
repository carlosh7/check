# 12. Primer arranque: asistente de configuración (wizard)

> Desde **v12.44.802**, Check Pro **no crea ningún usuario con credenciales precargadas**. La primera vez que abres una instalación nueva, un asistente (wizard) te guía para crear la cuenta de administrador con una contraseña fuerte.

## ¿Para qué sirve?

- Garantizar que cada instalación empieza con una cuenta de administrador **única y segura**, elegida por el operador.
- Eliminar el riesgo de credenciales conocidas/publicadas: si la app no tiene usuarios, solo el asistente puede crear el primero.
- Cerrar el asistente automáticamente: una vez creada la cuenta, el endpoint de setup queda desactivado (403) para siempre.

## Requisitos previos

- Instalación recién desplegada (Docker, `npm start` o `npm run setup`) **sin base de datos previa**.
- Acceso al navegador en la URL de la app (por defecto `http://localhost:3000`).

## Pasos

1. Abre la app en tu navegador. Como la instalación aún no tiene usuarios, verás la pantalla **"Configuración inicial"** en lugar del login.
2. Pulsa **Comenzar**.
3. Rellena el formulario:
   - **Tu nombre**: cómo se mostrará tu cuenta.
   - **Email**: será tu usuario de acceso.
   - **Contraseña**: mínimo **10 caracteres**, con al menos una **mayúscula**, una **minúscula** y un **número**. El indicador bajo el campo te va diciendo qué falta. Las contraseñas conocidas/publicadas (por ejemplo `admin123` o `changeme123`) se rechazan siempre.
   - **Confirmar contraseña**.
4. Pulsa **Crear cuenta de administrador**. Verás la pantalla **"¡Todo listo!"**.
5. Pulsa **Ir al inicio de sesión** y entra con tu email y tu nueva contraseña.
6. (Recomendado) Activa **2FA** desde tu perfil: Sistema → Mi Cuenta → configuración 2FA.

## Automatización headless (opcional)

Si despliegas sin interacción humana (CI, provisioning automático), puedes definir **ambas** variables en el entorno/`.env`:

```env
ADMIN_EMAIL=tu-correo@tudominio.com
ADMIN_PASSWORD=UnaClaveFuerte-2026
```

Con ambas definidas, el primer arranque crea ese admin directamente y el wizard no aparece. Si falta cualquiera de las dos, la app usa el wizard. Las contraseñas expuestas se rechazan incluso por esta vía.

## Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| No veo el wizard, veo el login normal | La base de datos ya tiene usuarios (instalación previa) | Es correcto: el wizard solo aparece en instalaciones sin usuarios. Usa tu cuenta habitual. |
| "Esta contraseña es pública/conocida y no puede usarse" | Elegiste una contraseña quemada (`admin123`, `changeme123`) | Elige otra contraseña que cumpla la política. |
| El wizard dice que la instalación ya tiene usuarios | Alguien (u otro proceso) ya creó el primer admin | Usa el login normal; si perdiste esa cuenta, revisa la guía de usuarios y roles. |
| Envía el formulario y no pasa nada | Servidor sin iniciar o error de red | Verifica que el servidor está corriendo (`docker logs check-app` o consola de `npm start`) y reintenta. |

## Notas técnicas (para referencia)

- Endpoint público de estado: `GET /api/setup/status` → `{ needsSetup: true|false }`.
- Creación del primer admin: `POST /api/setup/admin` (solo funciona con la tabla de usuarios vacía; con usuarios devuelve 403).
- La contraseña se valida con la política centralizada de `src/security/password-policy.js` y el evento queda registrado en el log de auditoría (`SETUP_ADMIN_CREATED`).
