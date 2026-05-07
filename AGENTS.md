No se de donde vienes ni lo que tubiste que pasar para llegar hasta aqui, pero ahora estas aqui y tienes que hacer tu trabajo lo mejor posible.
Tomate un momento has una pausa, respira y luego continua.
Tomate tu tiempo para entender el proyecto y su funcionamiento. No te apresures a hacer cambios sin entender completamente el codigo.


# Directivas para el Agente

## COMPROMISO DEL AGENTE (LEER PRIMERO)

**Yo, como agente de IA, me comprometo a seguir TODAS estas reglas sin excepcion. Si violo alguna, el usuario tiene derecho a reclamarme.**

### Reglas Inquebrantables:

1. **Idioma:** Siempre respondo en espanol
2. **Razonamiento:** Siempre explico mi pensamiento en espanol (que busco, por que, que encontre)
3. **Versionado:** SIEMPRE incrementamos version y query strings despues de cambio significativo
4. **Flujo de Trabajo:** SIEMPRE sigo el checklist completo al final de cada tarea

### Comunicacion y Trabajo en Equipo (OBLIGATORIO)

**ANTES de hacer cualquier cambio de codigo:**
1. **EXPLICAR** que voy a hacer (plan)
2. **ESPERAR** tu confirmacion antes de actuar
3. **NO actuar solo** - trabajamos juntos paso a paso

**NUNCA:**
- Hacer cambios sin explicar primero
- Crear versiones sin confirmacion
- Asumir que se lo que necesitas

**Siempre pregunta antes de:**
- Modificar archivos de codigo
- Incrementar version
- Hacer commit/push
- Crear tags

**REGLA #1: NUNCA borrar ni simplificar funciones existentes**
- Las funciones existentes funcionan y tienen comportamiento probado
- Si necesitas refactorizar, crea la nueva función al lado, no reemplaces la original hasta que esté 100% verificada
- Prefiero tener código duplicado funcional a código "limpio" que no funciona
- Si ves código que parece "muerto", asume que está vivo hasta que demuestres lo contrario en producción
- Cualquier cambio en funciones de app.js debe ser incremental, nunca sustitutivo


---

## LECTURA OBLIGATORIA AL INICIAR

Cuando llegues a este proyecto por primera vez o retomes el trabajo:

1. **LEE** `docs/ROADMAP.md` — contiene el plan maestro, el estado actual y el proximo feature a implementar
2. **LEE** esta seccion de abajo para comandos rapidos
3. **VERIFICA** la version actual en `package.json` antes de asumir cualquier numero

### Comandos Rapidos

Cuando el usuario diga estas frases, responde asi:

| El usuario dice | Tu accion |
|----------------|-----------|
| "status del proyecto" | Lee ROADMAP.md + package.json → muestra version, feature en curso, ultimas completadas |
| "retoma el trabajo" | Lee ROADMAP.md → encuentra proximo feature pendiente → presenta plan para empezar |
| "plan completo" o "roadmap" | Lee ROADMAP.md → muestra el roadmap con fases y prioridades |
| "dame contexto" | Lee ROADMAP.md + AGENTS.md + ARQUITECTURA_SISTEMA.md → da resumen completo del proyecto |
| "que sigue" o "siguiente feature" | Lee ROADMAP.md → muestra el proximo feature a implementar segun el orden de fases |
| "evalua seguridad IA" | Lee docs/SECURITY_IA.md → muestra postura actual de seguridad IA, brechas y recomendaciones |
| "prioridades" | Lee ROADMAP.md → muestra la Matriz de Prioridad Real y el Orden de Ejecucion Sugerido para saber que feature implementar primero |

Flujo diario recomendado:
1. "retoma el trabajo" → yo presento plan
2. Tu confirmas o ajustas
3. Yo implemento, version bump, push
4. Tu Redeploy en Portainer y pruebas
5. "status del proyecto" para ver progreso
---

## Entorno Actual

### Configuracion del Servidor (Linux)

- **Sistema:** Ubuntu Linux
- **Ruta del repositorio:** `/home/carlosh/Check`
- **Docker:** Instalado (socket `/var/run/docker.sock`)
- **Portainer:** `https://localhost:9443`
- **App URL directa:** `http://192.168.2.17:3000`
- **Nginx Proxy Admin:** `http://192.168.2.17:81`
- **Dolibarr:** `http://192.168.2.17:8080`

### Credenciales

- **Check App:** admin@check.com / admin123
- **Nginx Proxy Manager:** admin@example.com / changeme (cambiar al primer login)
- **Portainer:** las que configuro el usuario

### Stack Docker

- `check-app` — contenedor Node.js con la app
- `nginx-proxy-manager` — reverse proxy
- Red compartida: `proxy-network`


---

## Flujo de Trabajo (Linux + Portainer)

### Ciclo Completo

```
TU explicas plan → YO explico plan y espero confirmacion
→ TU confirmas → YO implemento cambios
→ YO version bump + commit + push + tag
→ YO informo "listo para Redeploy"
→ TU haces Redeploy del stack check en Portainer
→ TU validas en http://192.168.2.17:3000
→ TU dices si funciona o si hay que ajustar
```

### Pasos detallados para el agente:

**Antes de codificar:**
- [ ] Leer ROADMAP.md para saber el estado actual
- [ ] Entender el objetivo del cambio
- [ ] Explicar plan al usuario en espanol
- [ ] Esperar confirmacion explicita del usuario

**Durante la implementacion:**
- [ ] Seguir convenciones del codigo existente
- [ ] Revisar codigo de referencia en repos analizados (si aplica)
- [ ] Informar progreso al usuario

**Al completar cambios (OBLIGATORIO):**

```bash
# 1. LEER version actual desde package.json
#    NUNCA asumir la version - siempre verificar con lectura directa

# 2. INCREMENTAR solo el ultimo digito (Z): 12.44.510 → 12.44.511
#    NUNCA incrementar el digito medio (Y)

# 3. ACTUALIZAR referencias de version:
#    - package.json → "version": "X.Y.Z"
#    - public/html/app-shell.html → "Check Pro vX.Y.Z"
#    - index.html → "vX.Y.Z"

# 4. HACER commit + push + tag
git add .
git commit -m "tipo: descripcion del cambio (vX.Y.Z)"
git push origin main
git tag vX.Y.Z HEAD
git push origin vX.Y.Z
```

**Despues del push:**
- [ ] Informar al usuario que los cambios estan listos
- [ ] Especificar version actual
- [ ] Enumerar los cambios realizados
- [ ] Indicar "Redeploy del stack check en Portainer y prueba en http://192.168.2.17:3000"


---

## Versionado del Proyecto (OBLIGATORIO)

La version actual esta en `package.json` campo `version` (formato: X.Y.Z)

**PROCEDIMIENTO OBLIGATORIO ANTES DE INCREMENTAR:**
1. **LEER** la version actual desde `package.json` usando la herramienta Read
2. **NUNCA asumir la version** - siempre verificar con lectura directa
3. **INCREMENTAR solo el ultimo digito (Z)**: si esta en 12.31.9 → 12.31.10
4. **NUNCA incrementar el digito medio (Y)**: NO hacer 12.31.9 → 12.32.0
5. **ACTUALIZAR** todos los archivos relevantes con la nueva version

| Archivo | Que cambiar | Ejemplo |
|---------|-------------|---------|
| `package.json` | `"version": "X.Y.Z"` | `"version": "12.16.8"` |
| `app-shell.html` | Texto version visible | `Check Pro v12.16.8` |
| `index.html` | `v=X.Y.Z` en CSS / texto version | `v=12.16.8` |

**NOTA:** `portainer-stack.yml` se modifica solo cuando hay necesidades especificas del stack.

**SIN este version bump, el navegador usa cache y NO ve los cambios.**

**EJEMPLO CORRECTO:**
- Version actual: 12.31.9
- Siguiente version: 12.31.10 ✅
- NO: 12.32.0 ❌


---

## Tags de Git (OBLIGATORIO)

**Cada vez que se incrementa la version en `package.json`, DEBE crearse un tag git:**

```bash
git tag v${VERSION} HEAD
git push origin v${VERSION}
```

**Ejemplo:** Si la version sube a 12.18.1:
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

## Documentacion Referenciada

| Archivo | Cuando leerlo |
|---------|---------------|
| `docs/ROADMAP.md` | **SIEMPRE primero** — plan maestro, estado actual, proximo feature |
| `WORKFLOW.md` | Si necesitas entender el flujo de deploy completo |
| `docs/repos-analysis.md` | Si vas a implementar una feature inspirada en otro repo |
| `docs/ARQUITECTURA_SISTEMA.md` | Si necesitas entender BD, rutas, estructura del sistema |
| `docs/SECURITY_IA.md` | Si trabajas en seguridad IA, brechas identificadas o plan de accion vs CrowdStrike |
| `docs/ESTRUCTURA_UI_CHECK_PRO.md` | Si trabajas en vistas del frontend |
| `server.js` | Backend principal (rutas API, configuracion) |
| `src/utils/database-manager.js` | Gestion de bases de datos por evento |
| `src/utils/backup.js` | Sistema de respaldos |
| `src/security/audit.js` | Logging de auditoria |
| `src/routes/*.routes.js` | Endpoints de la API |

**Regla:** No leas todo de golpe. Lee solo lo necesario para la tarea actual.


---

## Historial: Entorno Windows (Referencia)

Este proyecto tambien se desarrollo originalmente en Windows con el siguiente setup.
Se mantiene como referencia historica, pero **no es el entorno activo**.

- **Repositorio Original:** `C:\Users\carlo\OneDrive\Documentos\APP\Registro`
- **Contenedor de Pruebas:** `C:\Users\carlo\check`
- **Puente:** `antigravity_bridge.ps1` via opencode-cli
- **Comando:** `opencode-cli run "powershell.exe -ExecutionPolicy Bypass -File .\antigravity_bridge.ps1"`

Para el flujo Windows completo, revisar el git historico de este archivo.
