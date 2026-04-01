# Antigravity Bridge v12.37.22
# ESTATUS: SANACION DEFINITIVA (Sincronizacion de Carpeta de Pruebas)
$VERSION = "12.37.22"
$REPO_ORIGINAL = "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CONTENEDOR_PRUEBAS = "C:\Users\carlo\check"

Write-Host "🚀 Iniciando SANACION Check Pro v$VERSION..." -ForegroundColor Cyan

# 1. Registro Original
Set-Location $REPO_ORIGINAL
git add .
git commit -m "Automated update: Check Pro v$VERSION - Final Synchronization & Quill Blindage"
git push origin main
git tag "v$VERSION"
git push origin "v$VERSION"

# 2. Sincronizacion Contenedor Pruebas
Write-Host "📥 Actualizando carpeta de pruebas en $CONTENEDOR_PRUEBAS..." -ForegroundColor Yellow
Set-Location $CONTENEDOR_PRUEBAS
git pull origin main
git pull origin --tags

# 3. PARADA Y SANACION (CRITICO)
Write-Host "🛑 Deteniendo servidor para saneamiento..." -ForegroundColor Red
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# REPARAR BASE DE DATOS DEL CONTENEDOR (La que tú ves)
Write-Host "🛠️ Saneando base de datos del CONTENEDOR..." -ForegroundColor Yellow
node "$REPO_ORIGINAL\fix_db.js" "$CONTENEDOR_PRUEBAS\data\check_app.db"

# REPARAR BASE DE DATOS DEL REPOSITORIO (Para el futuro)
Write-Host "🛠️ Saneando base de datos del REPOSITORIO..." -ForegroundColor Yellow
node "$REPO_ORIGINAL\fix_db.js" "$REPO_ORIGINAL\data\check_app.db"

# 4. REINICIO
Write-Host "✅ Sanacion completada exitosamente v$VERSION." -ForegroundColor Green
Write-Host "🚀 Iniciando servidor..." -ForegroundColor Cyan
node server.js
