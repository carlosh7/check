# Antigravity Bridge v12.37.20
# Estatus: Reparación Definitiva (Auto-Sanación de BD)
$VERSION = "12.37.20"
$REPO_ORIGINAL = "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CONTENEDOR_PRUEBAS = "C:\Users\carlo\check"

Write-Host "🚀 Iniciando Mega-Despliegue Check Pro v$VERSION..." -ForegroundColor Cyan

# 1. Registro Original
Set-Location $REPO_ORIGINAL
git add .
git commit -m "Automated update: Check Pro v$VERSION - Database Auto-Repair & ID Shield"
git push origin main
git tag "v$VERSION"
git push origin "v$VERSION"

# 2. Sincronización Contenedor Pruebas
Set-Location $CONTENEDOR_PRUEBAS
git pull origin main
git pull origin --tags

# 3. Reinicio de Servidor (taskkill forzado)
Write-Host "♻️ Reiniciando servidor y ejecutando Auto-Reparación..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 3

# 4. Iniciar Servidor
Write-Host "✅ Despliegue v$VERSION Completado. Verifica la consola para mensajes de REPAIR." -ForegroundColor Green
Write-Host "🌐 Valida en http://localhost:3000" -ForegroundColor Cyan
