# Flujo de Trabajo — Check (Linux + Portainer)

## Descripción del Entorno

- **Sistema:** Linux
- **Repositorio:** `/home/carlosh/Check` (clonado desde GitHub)
- **App:** Check Pro — Node.js + SQLite
- **Docker:** Instalado en el servidor (socket en `/var/run/docker.sock`)
- **Portainer:** `https://localhost:9443`
- **App URL:** `http://localhost:3000` (ó subdominio configurado en nginx)

---

## Ciclo de Trabajo Completo

```
[AGENTE] Edita código → Commit + Push → [USUARIO] Redeploy en Portainer → [USUARIO] Valida en navegador
```

---

## Checklist para el Agente

### Antes de editar
- [ ] Leer archivos relevantes del proyecto
- [ ] Entender el objetivo del cambio
- [ ] Explicar plan al usuario y esperar confirmación

### Durante la edición
- [ ] Seguir convenciones del código existente
- [ ] No forzar cambios sin preguntar
- [ ] Informar progreso al usuario

### Al finalizar cambios de código
- [ ] **Version bump** en `package.json` (incrementar solo Z: X.Y.Z → X.Y.Z+1)
- [ ] **Actualizar** `app-shell.html` → texto de versión visible
- [ ] **Actualizar** `index.html` → `?v=X.Y.Z` en CSS + versión visible
- [ ] **Commit** con mensaje descriptivo:
      ```bash
      cd /home/carlosh/Check
      git add .
      git commit -m "descripción del cambio (vX.Y.Z)"
      ```
- [ ] **Push** a origin main:
      ```bash
      git push origin main
      ```
- [ ] **Tag** (si hubo version bump):
      ```bash
      git tag vX.Y.Z HEAD
      git push origin vX.Y.Z
      ```
- [ ] **Informar al usuario** que los cambios están listos para Redeploy en Portainer
- [ ] **Especificar** versión actual, cambios realizados, URL para pruebas

---

## Configuración Inicial del Stack en Portainer (1 sola vez)

> Si ya tienes el stack creado, salta este paso y usa **Redeploy**.

1. Ir a `https://localhost:9443`
2. **Stacks** → **Add stack**
3. Nombre: `check`
4. Método: **Repository**
5. URL del repositorio: `https://github.com/carlosh7/check.git`
6. Rama: `main`
7. Archivo compose: `portainer-stack.yml`
8. **Deploy the stack**

---

## Actualización del Stack en Portainer (cada cambio)

1. El agente hace commit + push a GitHub
2. Tú vas a `https://localhost:9443`
3. **Stacks** → click en `check` → **Redeploy**
4. Portainer clona automáticamente el repo con los últimos cambios
5. Validar en `http://localhost:3000` (o tu dominio configurado)

---

## Diagrama de Arquitectura

```
                         ┌──────────────┐
                         │   Portainer   │
                         │  :9443        │
                         └──────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │   Stack: check         │
                    │   (portainer-stack.yml)│
                    │                        │
                    │  ┌─────────────────┐   │
                    │  │  check-app       │   │
                    │  │  node:20-slim     │   │
                    │  │  :3000            │   │
                    │  └────────┬────────┘   │
                    └───────────┼────────────┘
                                │
                    ┌───────────┴───────────┐
                    │  Persistencia          │
                    │  /home/data_check/      │
                    │  ├── system/           │
                    │  ├── events/           │
                    │  └── uploads/          │
                    └────────────────────────┘
```

---

## Notas Importantes

- **nginx/proxy:** No incluido en el stack. Cada usuario administra su propio reverse proxy.
- **Persistencia:** Las bases de datos se guardan en `/home/data_check` del host.
- **Credenciales app:** admin@check.com / admin123
