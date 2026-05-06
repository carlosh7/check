No se de donde vienes ni lo que tubiste que pasar para llegar hasta aqui, pero ahora estas aqui y tienes que hacer tu trabajo lo mejor posible. 
Tomate un momento has una pausa, respira y luego continua.
Tomate tu tiempo para entender el proyecto y su funcionamiento. No te apresures a hacer cambios sin entender completamente el código.

   

# Directivas para el Agente

## COMPROMISO DEL AGENTE (LEER PRIMERO)

**Yo, como agente de IA, me comprometo a seguir TODAS estas reglas sin excepción. Si violo alguna, el usuario tiene derecho a reclamarme.**

### Reglas Inquebrantables:

1. **Idioma:** Siempre respondo en español
2. **Razonamiento:** Siempre explico mi pensamiento en español (qué busco, por qué, qué encontré)
3. **Versionado:** SIEMPRE incrementamos versión y query strings después de cambio significativo
4. **Flujo de Trabajo:** SIEMPRE sigo el checklist completo al final de cada tarea

### Comunicación y Trabajo en Equipo (OBLIGATORIO)

**ANTES de hacer cualquier cambio de código:**
1. **EXPLICAR** qué voy a hacer (plan)
2. **ESPERAR** tu confirmación antes de actuar
3. **NO actuar solo** - trabajamos juntos paso a paso

**NUNCA:**
- Hacer cambios sin explicar primero
- Crear versiones sin confirmación
- Asumir que sé lo que necesitas

**Siempre pregunta antes de:**
- Modificar archivos de código
- Incrementar versión
- Hacer commit/push
- Crear tags

---

## Ubicación del Proyecto
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

---

## Docker (Entorno de Producción/Pruebas)

El proyecto usa Docker con dos modalidades:
1. **docker-compose.yml** - Entorno local de desarrollo
2. **portainer-stack.yml** - Despliegue en Portainer (producción)

### Estructura de Persistencia de Datos

**IMPORTANTE:** Todas las bases de datos se almacenan en `/home/data_check` (host) que se mapea a `/usr/src/app/persistence` (contenedor).

```
/home/data_check/
├── system/          # Base de datos del sistema (usuarios, eventos, grupos, clientes, etc.)
├── events/         # Bases de datos independientes por evento
│   ├── {eventId1}.db   # DB del evento 1 (guests, pre_registrations, surveys, wheels, etc.)
│   └── {eventId2}.db   # DB del evento 2
└── uploads/        # Archivos subidos (logos, imágenes, etc.)
```

**Cada evento tiene su propia base de datos independiente** con las siguientes tablas:
- `guests` - Asistentes/importados
- `pre_registrations` - Registros desde la página pública
- `event_wheels` / `wheel_participants` / `wheel_spins` / `wheel_leads` - Ruletas de sorteos
- `surveys` / `survey_responses` - Encuestas
- `event_agenda` - Agenda del evento
- `guest_suggestions` - Sugerencias de invitados

### Portainer (Producción)

**El archivo `portainer-stack.yml` está en el repositorio y se puede editar si hay necesidades específicas.** Portainer tiene el stack configurado para usar este archivo; al hacer "Redeploy", el contenedor ejecuta `git clone` automáticamente para obtener los últimos cambios.

**Características del stack:**
- Crea automáticamente las carpetas `/system`, `/events`, `/uploads` al iniciar
- Ejecuta `git clone --depth 1` desde GitHub al iniciar/recrear el contenedor
- Monta `/home/data_check` del host a `/usr/src/app/persistence` del contenedor

**Para actualizar en Portainer:**
1. Hacer push de los cambios al repositorio GitHub
2. En Portainer, hacer "Redeploy" del stack (no copiar archivos, Portainer usa el archivo del repositorio)
3. Los datos persistentes se mantienen en `/home/data_check`

### docker-compose.yml (Desarrollo Local)

Ubicación del contenedor: `C:\Users\carlo\check`
No escribas en el Clon
### Comandos Docker:

```bash
# 1. Detener contenedor
docker-compose down

# 2. Reiniciar con los últimos cambios (rebuild)
docker-compose up --build -d

# 3. Ver logs
docker-compose logs -f

# 4. Ver estado
docker-compose ps
```

### Flujo de Actualización Completo (docker-compose local):
```bash
cd C:\Users\carlo\check

# Hacer pull de últimos cambios
git pull origin --tags

# Rebuild del contenedor
docker-compose down
docker-compose up --build -d

# Validar que funciona
curl -s http://localhost:3000/api/health
```

---

## CHECKLIST PARA CADA TAREA

Antes de comenzar cualquier tarea:
- [ ] Leer y entender el objetivo
- [ ] Si hay múltiples pasos, fraccionarlos en partes pequeñas
- [ ] Explicar el plan de acción en español

Durante la tarea:
- [ ] Informar progreso: qué estoy haciendo, qué completé, qué sigue

Al completar cualquier cambio de código:
- [ ] **INCREMENTAR VERSIÓN** en `package.json` (X.Y.Z)
- [ ] **ACTUALIZAR** `app-shell.html` → `?v=X.Y.Z`
- [ ] **ACTUALIZAR** `index.html` → `?v=X.Y.Z`
- [ ] **COMMIT** con mensaje descriptivo
- [ ] **PUSH** a origin main
- [ ] **PULL** en `C:\Users\carlo\check`
- [ ] **VALIDAR** con `curl -s http://localhost:3000/api/health`
- [ ] **CONFIRMAR** qué se hizo al usuario

---

## Flujo de Trabajo (Regla de Oro - ACTUALIZADO)

### ESTRUCTURA DE DIRECTORIOS:
- **REPOSITORIO ORIGINAL:** `C:\Users\carlo\OneDrive\Documentos\APP\Registro` (aquí se hacen los cambios)
- **CONTENEDOR DE PRUEBAS:** `C:\Users\carlo\check` (git clone solo para validación) No escribas en el contenedor 

### Pasos obligatorios después de CADA tarea (Modo Puerto/Local):

```bash
# 1. DESDE REPOSITORIO ORIGINAL (C:\Users\carlo\OneDrive\Documentos\APP\Registro)
#    - Hacer cambios en el código
#    - Incrementar versión en package.json si es cambio significativo
#    - Actualizar referencias de versión en index.html y app-shell.html
git add . && git commit -m "mensaje descriptivo" && git push origin main

# 2. CREAR TAG si fue version bump (desde repositorio original)
git tag v${VERSION} HEAD && git push origin v${VERSION}

# 3. DESDE CONTENEDOR DE PRUEBAS (C:\Users\carlo\check)
#    - Sincronizar con cambios del repositorio
git pull origin --tags

# 4. VERIFICAR si server.js cambió
git diff --name-only HEAD~1 | grep -q server.js && echo "SERVER CAMBIÓ - REINICIAR" || echo "OK"

# 5. Si server.js cambió o hay cambios en archivos del servidor:
#    - Matar procesos node existentes
#    - Reiniciar servidor node server.js

# 6. VALIDAR que servidor está funcionando
curl -s http://localhost:3000/api/health

# 7. INFORMAR al usuario que cambios están listos para validación
#    - Especificar versión actual
#    - Enumerar cambios realizados
#    - Proporcionar URL para pruebas: http://localhost:3000
```

### Modo Portainer (Producción):
```bash
# 1. DESDE REPOSITORIO ORIGINAL
#    - Hacer cambios en el código
#    - Incrementar versión en package.json si es cambio significativo
git add . && git commit -m "mensaje descriptivo" && git push origin main

# 2. CREAR TAG si fue version bump
git tag v${VERSION} HEAD && git push origin v${VERSION}

# 3. ACTUALIZAR STACK EN PORTAINER
#    - En Portainer, hacer "Redeploy" del stack
#    - El contenedor ejecuta git clone automáticamente

# 4. VALIDAR que el contenedor está funcionando
curl -s http://localhost:3000/api/health
```

**CRÍTICO:** El contenedor de pruebas (`C:\Users\carlo\check`) es solo para validación. Todos los cambios se hacen en el repositorio original. 
Si el sistema del Agente devuelve error de "fuera de workspace" al intentar operar en `C:\Users\carlo\check`, **DEBE** usar el parámetro `-C` desde el repositorio original:
- Ejemplo: `git -C C:\Users\carlo\check pull origin main`

**NOTA SOBRE POWERSHELL:** No uses `&&` para encadenar comandos; usa `;` (punto y coma) o ejecútalos por separado.

**VALIDACIÓN POR USUARIO:** Después de que el agente complete los pasos 1-6, el usuario valida manualmente en `http://localhost:3000`.



---

## Versionado del Proyecto (OBLIGATORIO)

La versión actual está en `package.json` campo `version` (formato: X.Y.Z)

**PROCEDIMIENTO OBLIGATORIO ANTES DE INCREMENTAR:**
1. **LEER** la versión actual desde `package.json` usando la herramienta Read
2. **NUNCA asumir la versión** - siempre verificar con lectura directa
3. **INCREMENTAR solo el último dígito (Z)**: si está en 12.31.9 → 12.31.10
4. **NUNCA incrementar el dígito medio (Y)**: NO hacer 12.31.9 → 12.32.0
5. **ACTUALIZAR** todos los archivos relevantes con la nueva versión

| Archivo | Qué cambiar | Ejemplo |
|---------|--------------|---------|
| `package.json` | `"version": "X.Y.Z"` | `"version": "12.16.8"` |
| `app-shell.html` | Texto versión visible | `Check Pro v12.16.8` |
| `index.html` | `?v=X.Y.Z` en CSS | `?v=12.16.8` |
| `script_v12_XX_X.js` | `const VERSION = 'X.Y.Z'` | `const VERSION = '12.16.8'` |

**NOTA:** `portainer-stack.yml` se modifica solo cuando hay necesidades específicas del stack (cambios en puertos, volúmenes, variables de entorno, etc.). Para cambios de código normales NO se toca.

**SIN este version bump, el navegador usa caché y NO ve los cambios.**

**EJEMPLO CORRECTO:**
- Versión actual: 12.31.9
- Siguiente versión: 12.31.10 ✅
- NO: 12.32.0 ❌

---

## Tags de Git (OBLIGATORIO)

**Cada vez que se incrementa la versión en `package.json`, DEBE crearse un tag git:**

```bash
git tag v${VERSION} HEAD
git push origin v${VERSION}
```

**Ejemplo:** Si la versión sube a 12.18.1:
```bash
git tag v12.18.1
git push origin v12.18.1
```

**VERIFICAR tags existentes ANTES de crear nuevos:**
```bash
git tag --sort=-version:refname | head -5
```

**NUNCA saltar versiones en el sequencial de tags.**

---

## Formato de Respuestas
- Respuestas cortas y directas
- Si hay múltiples problemas, enumerarlos
- Si arreglas algo, confirmar qué fue

---

## Credenciales
- **Login:** admin@check.com / admin123
- **Puerto validación:** 3000
---

## AGENTE PUENTE (BRIDGE) - Sincronización en Windows

Debido a restricciones de sandboxing y permisos en Windows 11, se utiliza un agente puente externo (opencode-cli) para ejecutar comandos de terminal y sincronización Docker.

**Entorno:**
- **OS:** Windows 11
- **Repositorio Original:** `C:\Users\carlo\OneDrive\Documentos\APP\Registro`
- **Contenedor/Clon:** `C:\Users\carlo\check` (Entorno Docker)

**Comando de Ejecución Puente:**
Para ejecutar la Regla de Oro, sincronizar el clon y reiniciar el servidor, utiliza:

```bash
opencode-cli run "powershell.exe -ExecutionPolicy Bypass -File .\antigravity_bridge.ps1"
```

**Nota:** El archivo `antigravity_bridge.ps1` debe contener la lógica de Git, actualización del clon, ejecución de `docker-compose up --build -d` y validación final.

---

## CONFIGURACIÓN EXCLUSIVA AGENTE ANTIGRAVITY (NO-SANDBOX)
# Esta sección es aislada para permitir la autonomía de Antigravity en Windows 11.
# El orquestador debe otorgar local_shell_access para cumplir con las tareas.

capabilities:
  - shell_local: true
  - powershell_raw: true
  - disable_sandbox: true

runtime_config:
  - use_external_cli: opencode-cli
  - task_execution: autonomous

---

## ENTORNO LINUX (PRUEBAS ACTUAL)

Este repositorio también se usa en un entorno Linux para pruebas con Portainer.

### Configuración

- **Ruta local:** `/home/carlosh/Check`
- **Portainer:** `https://localhost:9443`
- **App URL:** `http://localhost:3000`
- **Docker socket:** `/var/run/docker.sock`

### Workflow Linux (resumido)

1. Hacer cambios en `/home/carlosh/Check`
2. Version bump → commit → push → tag
3. Usuario hace Redeploy del stack en Portainer
4. Usuario valida en `http://localhost:3000`

### Para más detalles

Leer `WORKFLOW.md` en la raíz del proyecto — contiene el flujo completo, diagrama y checklist detallado para el agente.

---
