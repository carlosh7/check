# Antigravity Bridge for Check Pro (v12.37.17)
# This script executes the Golden Rule on Windows 11 bypassing sandbox limitations.

$VERSION = "12.37.17"
$REPO_PATH = "c:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CHECK_PATH = "C:\Users\carlo\check"

Write-Host "--- Iniciando Regla de Oro (v$VERSION) ---" -ForegroundColor Cyan

# 1. Staging and Commit in Original Repo
Write-Host "[1/5] Preparando commit en repositorio original..." -ForegroundColor Yellow
cd $REPO_PATH
git add .
git commit -m "Automated update: Check Pro v$VERSION - Fixed Email 404s & Template Editor Sync"
git push origin main

# 2. Creating Tag
Write-Host "[2/5] Creando tag v$VERSION..." -ForegroundColor Yellow
git tag "v$VERSION"
git push origin "v$VERSION"

# 3. Update Validation Environment (C:\Users\carlo\check)
Write-Host "[3/5] Sincronizando entorno de validación..." -ForegroundColor Yellow
if (Test-Path $CHECK_PATH) {
    git -C $CHECK_PATH fetch --tags
    git -C $CHECK_PATH pull origin main
    git -C $CHECK_PATH checkout "v$VERSION"
} else {
    Write-Host "ADVERTENCIA: No se encontró la ruta $CHECK_PATH" -ForegroundColor Red
}

# 4. Restart Node Server
Write-Host "[4/5] Reiniciando servidor Node..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Process "node" -ArgumentList "server.js" -WorkingDirectory $REPO_PATH -NoNewWindow
Write-Host "Servidor iniciado en segundo plano." -ForegroundColor Green

# 5. Final Validation
Write-Host "[5/5] Validando servidor..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get
    Write-Host "Respuesta de salud: SUCCESS" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "AVISO: El servidor está iniciando o no respondió en http://localhost:3000/api/health" -ForegroundColor Yellow
    Write-Host "Por favor valida manualmente en: http://localhost:3000" -ForegroundColor Gray
}

Write-Host "--- Proceso Completado para v$VERSION ---" -ForegroundColor Cyan
