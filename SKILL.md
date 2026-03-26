# PROYECTO CHECK PRO

## Ubicación del Proyecto
```
C:\Users\carlo\OneDrive\Documentos\APP\Registro
```

## Entorno de Validación
```
C:\Users\carlo\check
```

## Flujo de Trabajo

1. **Editas código** → `C:\Users\carlo\OneDrive\Documentos\APP\Registro`
2. **Subes cambios:** `git add .` → `git commit -m "mensaje"` → `git push origin main`
3. **Validas en:** `C:\Users\carlo\check` → `git pull` → http://localhost:3000

## Al Finalizar Cada Tarea (Regla de Oro)

```bash
# 1. Subir cambios
cd "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
git add . && git commit -m "mensaje" && git push origin main

# 2. Actualizar entorno de validación
cd "C:\Users\carlo\check"
git pull
```

## Validación Rápida
```bash
curl -s http://localhost:3000/api/health
```

## Versionado (OBLIGATORIO)

Después de cualquier cambio de código significativo (bug fix, feature, refactorización):

1. Actualizar `package.json` campo `version` (formato: X.Y.Z)
2. Actualizar `app-shell.html` → `?v=X.Y.Z` en etiquetas de CSS/JS
3. Actualizar `index.html` → `?v=X.Y.Z` en etiquetas de CSS/JS
4. **CREAR TAG GIT:** `git tag vX.Y.Z` y `git push origin vX.Y.Z`

**Ejemplo:** 12.16.6 → 12.16.7 → `git tag v12.16.7` → `git push origin v12.16.7`

**SIN version bump, el navegador usa caché y NO ve los cambios.**

**SIN tag git, GitHub no refleja la versión real del código.**

## Tags Git (Verificar antes de crear)

```bash
# Ver últimos 5 tags
git tag --sort=-version:refname | head -5
```

**NUNCA crear un tag con versión inferior al último tag existente.**

## Credenciales
- **Login:** admin@check.com / admin123
- **Puerto:** 3000
