# ROLLBACK INSTRUCTIONS - App Shell Implementation

## ESTADO ACTUAL
- Branch: `main`
- Commit: `efa523b`
- Backup: `backup-before-app-shell` (contiene todo el código actual)

---

## OPCIONES DE ROLLBACK

### OPCION 1: Restaurar desde GitHub (Recomendada si Git local está corrupto)

1. Abrir navegador
2. Ir a: https://github.com/carlosh7/check
3. Buscar el botón verde **"main"** que dice "View all branches"
4. Hacer clic en **"branches"**
5. Buscar **"backup-before-app-shell"**
6. Hacer clic en **"Restore"** o **"Swap branch"** → seleccionar `main`
7. Confirmar la restauración

### OPCION 2: Restaurar desde terminal

```bash
# Ir al directorio del proyecto
cd C:\Users\carlo\OneDrive\Documentos\APP\Registro

# Verificar que estás en main
git status

# Si hay cambios sin guardar, descartarlos
git checkout -- .

# Restaurar desde el backup branch
git checkout backup-before-app-shell

# Forzar que main sea igual al backup
git push origin backup-before-app-shell --force

# O alternativamente, fusionar backup en main
git checkout main
git merge backup-before-app-shell --no-edit
git push origin main
```

---

## PLAN DE IMPLEMENTACION (feature/app-shell)

### PASO 1: Crear branch de desarrollo
```bash
cd C:\Users\carlo\OneDrive\Documentos\APP\Registro
git checkout -b feature/app-shell
```

### PASO 2: Crear archivo app-shell.html
- Copiar TODO el contenido de `<div id="app-container">...</div>` de index.html
- Incluir: sidebar, view-admin-simple, view-system-simple, view-groups, view-legal, view-account, view-smtp, modal-legal
- Guardar como: `app-shell.html`

### PASO 3: Modificar index.html
- Eliminar: `<div id="app-container">` y todo su contenido
- Eliminar: `<div id="modal-legal">`
- Mantener: `<div id="view-login">`, `<div id="loading-screen">`, `<script>`, `<link>`, `<style>`, `<body>`

### PASO 4: Modificar script.js
- Agregar función `loadAppShell()` que:
  - Fetch `/app-shell.html`
  - Insertar el HTML en `<body>` antes de `</body>`
  - Re-attach event listeners necesarios
  - Inicializar sockets
- Modificar `DOMContentLoaded` para:
  - Verificar sesión con `LS.get('user')`
  - Si hay sesión válida: `loadAppShell()` → luego `mostrarApp()`
  - Si no hay sesión: solo mostrar login

### PASO 5: Modificar server.js
- Agregar ruta para servir `app-shell.html`:
```javascript
app.get('/app-shell.html', express.static(path.join(__dirname, 'app-shell.html')));
```

### PASO 6: Testing

#### Test A: Login funcional
1. Abrir http://localhost:3000
2. Verificar que solo muestra login
3. Ingresar credenciales admin
4. Verificar que carga el app-shell
5. Verificar que muestra sidebar y menú de administración

#### Test B: Persistencia en refresh (F5)
1. Estar logueado en la aplicación
2. Presionar F5
3. Verificar que NO muestra flash de login
4. Verificar que mantiene la sesión

#### Test C: Logout
1. Estar logueado
2. Hacer clic en logout
3. Verificar que vuelve a pantalla de login pura
4. Verificar que NO carga el app-shell

#### Test D: Navegación
1. Usar botones del menú (sidebar)
2. Verificar que todas las vistas funcionan
3. Probar: System → Users, Groups, Legal, Account, SMTP
4. Probar: My Events, Admin

### PASO 7: Commit y merge
```bash
git add .
git commit -m "feat: app-shell architecture for security"
git checkout main
git merge feature/app-shell
git push origin main
```

---

## PUNTOS DE VERIFICACION

### Verificación 1: Archivos creados/modificados
Después del desarrollo, verificar:
- [ ] `app-shell.html` existe en el proyecto
- [ ] `index.html` NO contiene `<div id="app-container">`
- [ ] `index.html` contiene solo login y loading screen
- [ ] `script.js` tiene función `loadAppShell()`

### Verificación 2: Servidor responde
```bash
curl -s http://localhost:3000/ | grep "view-login"
curl -s http://localhost:3000/ | grep "app-container"  # debe estar vacío
curl -s http://localhost:3000/app-shell.html | grep "app-container"  # debe existir
```

### Verificación 3: Consola sin errores
- Login: sin errores en consola
- Después de login: sin errores en consola
- Refresh: sin errores en consola

---

## COMANDOS DE EMERGENCIA

### Si el servidor no inicia:
```bash
# Verificar syntax errors
node -c server.js
node -c script.js
```

### Si hay error de dependencias:
```bash
npm install
```

### Si Git tiene conflictos:
```bash
git status
# Resolver conflictos manualmente
git add .
git commit -m "resolve conflicts"
```

### Verificar que backup está actualizado:
```bash
git checkout backup-before-app-shell
git pull origin backup-before-app-shell
git checkout main
```

---

## CONTACTOS Y RECURSOS

- Repositorio: https://github.com/carlosh7/check
- Branch backup: backup-before-app-shell
- Branch desarrollo: feature/app-shell
- Branch main: main

---

## NOTAS IMPORTANTES

1. NO modificar `backup-before-app-shell` manualmente
2. Si el desarrollo falla en feature/app-shell, NO hacer merge a main
3. Siempre probar en modo incógnito para evitar caché
4. Si algo no funciona, contactar al desarrollador

---

Documento creado: 2026-03-20
Versión: 1.0
