# Antigravity Bridge v12.37.21
# ESTATUS: REPARACION FORZADA (fix_db.js)
$VERSION = "12.37.21"
$REPO_ORIGINAL = "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CONTENEDOR_PRUEBAS = "C:\Users\carlo\check"

Write-Host "Iniciando REPARACION FORZADA Check Pro v$VERSION..." -ForegroundColor Cyan

# 1. Registro Original
Set-Location $REPO_ORIGINAL
git add .
git commit -m "Automated update: Check Pro v$VERSION - Forced Repair Script"
git push origin main
git tag "v$VERSION"
git push origin "v$VERSION"

# 2. Sincronizacion Contenedor Pruebas
Set-Location $CONTENEDOR_PRUEBAS
git pull origin main
git pull origin --tags

# 3. PARADA Y REPARACION
Write-Host "Deteniendo servidor para reparacion..." -ForegroundColor Red
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

Set-Location $REPO_ORIGINAL
Write-Host "Ejecutando node fix_db.js..." -ForegroundColor Yellow
node fix_db.js

# 4. REINICIO
Write-Host "Saneamiento completado. Reiniciando servidor v$VERSION..." -ForegroundColor Green
Start-Sleep -Seconds 1
# Iniciar servidor
node server.js
