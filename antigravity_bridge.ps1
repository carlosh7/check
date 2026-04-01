# Antigravity Bridge v12.37.19
# Estatus: Estabilización Crítica (Corrección de IDs y Seguridad)
$VERSION = "12.37.19"
$REPO_ORIGINAL = "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CONTENEDOR_PRUEBAS = "C:\Users\carlo\check"

Write-Host "🚀 Iniciando Despliegue Check Pro v$VERSION..." -ForegroundColor Cyan

# 1. Registro Original
Set-Location $REPO_ORIGINAL
git add .
git commit -m "Automated update: Check Pro v$VERSION - Security & ID Null Fix"
git push origin main
git tag "v$VERSION"
git push origin "v$VERSION"

# 2. Sincronización Contenedor Pruebas
Set-Location $CONTENEDOR_PRUEBAS
git pull origin main
git pull origin --tags

# 3. Reinicio de Servidor (taskkill forzado)
Write-Host "♻️ Reiniciando servidor..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# 4. Iniciar Servidor
# Se asume que el usuario ejecutará esto desde la terminal con opencode-cli
Write-Host "✅ Despliegue v$VERSION Completado." -ForegroundColor Green
Write-Host "🌐 Valida en http://localhost:3000/api/health" -ForegroundColor Cyan
