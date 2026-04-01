# Bridge antigravity v12.37.23 (Radical Clean & Dual DB Fix)
Write-Host "--- REGLA DE ORO: CHECK PRO v12.37.23 ---" -ForegroundColor Cyan

$REPO_PATH = "C:\Users\carlo\OneDrive\Documentos\APP\Registro"
$CHECK_PATH = "C:\Users\carlo\check"
$VERSION = "12.37.23"

# 1. Sincronizar repositorio original
Set-Location $REPO_PATH
Write-Host "[GIT] Subiendo cambios del repositorio..."
git add .
git commit -m "Automated update: Check Pro v$VERSION - Radical IDs & Fallback"
git push origin main

# 2. Reparar Base de Datos (REPO) - Asegurar que fix_db.js exista
Write-Host "[DB] Saneando IDs en repositorio..."
node fix_db.js "$REPO_PATH\data\check_app.db"

# 3. Sincronizar C:\Users\carlo\check
Write-Host "[GIT] Sincronizando entorno de pruebas (check)..."
git -C $CHECK_PATH pull origin main

# 4. Reparar Base de Datos (CHECK)
Write-Host "[DB] Saneando IDs en entorno de pruebas..."
node fix_db.js "$CHECK_PATH\data\check_app.db"

# 5. Auditoría Final (RESULTADOS VISIBLES)
Write-Host "[AUDIT] Verificando integridad de IDs..."
node audit.js "$CHECK_PATH\data\check_app.db"

# 6. Reiniciar Servidor (Procedimiento Seguro)
Write-Host "[SERVER] Reiniciando procesos..."
taskkill /F /IM node.exe /T 2>$null
Start-Sleep -s 1

Set-Location $CHECK_PATH
Write-Host "[SERVER] Iniciando Check Pro en puerto 3000..."
# Iniciamos en segundo plano para no bloquear
Start-Process node -ArgumentList "server.js" -WindowStyle Normal

Write-Host "--- DESPLIEGUE COMPLETADO: v$VERSION ---" -ForegroundColor Green
Write-Host "Por favor, recarga el navegador. Cache limpiada automáticamente por versión."
