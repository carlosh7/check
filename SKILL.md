# CHECK PRO — Checklist operativo

> **Nota:** este archivo ya NO define reglas del agente (eso lo hace `AGENTS.md`, fuente de
> verdad) ni contiene credenciales — el repo es público. Aquí queda solo el checklist de
> despliegue/validación.

## Reglas inquebrantables (resumen — detalle en AGENTS.md)

1. Idioma: siempre en español
2. Versionado: SIEMPRE bump + query strings tras cambio significativo
3. Flujo: seguir el checklist completo al final de cada tarea
4. NUNCA escribir credenciales en archivos versionados

## Checklist de despliegue (Linux + Portainer)

```bash
# 1. Commit + push + tag (versión leída SIEMPRE de package.json, nunca asumida)
git add . && git commit -m "tipo: descripcion (vX.Y.Z)" && git push origin main
git tag vX.Y.Z HEAD && git push origin vX.Y.Z

# 2. Redeploy del stack check en Portainer (https://localhost:9443)

# 3. Validar salud de la app
curl -s http://localhost:3000/api/health
```

**CRÍTICO:** si `server.js` cambió, el contenedor debe reconstruirse/redeployarse —
sin redeploy, la validación corre código antiguo.

## Versionado (obligatorio tras cambio significativo)

| Archivo | Qué cambiar |
|---------|-------------|
| `package.json` | `"version": "X.Y.Z"` (solo dígito Z) |
| `app-shell.html` | `?v=X.Y.Z` |
| `index.html` | `?v=X.Y.Z` |

Sin version bump, el navegador usa caché y NO ve los cambios.
Verificar tags existentes antes de crear nuevos: `git tag --sort=-version:refname | head -5`.
