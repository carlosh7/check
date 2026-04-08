# Sincronización Automática Check Pro v12.44.288 (Docker)
Write-Host "Iniciando despliegue final (Regla de Oro - Docker Edition)..." -ForegroundColor Cyan

# 1. Sincronización de Repositorio Original
Write-Host "Paso 1: Sincronizando Git en Registro..." -ForegroundColor Yellow
git add .
git commit -m "Automated update: Check Pro v12.44.288 - Event Status Fix and Config Protection"
git push origin main
git tag v12.44.288 HEAD
git push origin v12.44.288

# 2. Actualización del Entorno Docker (Clon)
Write-Host "Paso 2: Actualizando clon y tags en C:\Users\carlo\check..." -ForegroundColor Yellow
git -C C:\Users\carlo\check pull origin main
git -C C:\Users\carlo\check pull origin --tags

# 3. Rebuild del Contenedor
Write-Host "Paso 3: Reconstruyendo contenedores Docker..." -ForegroundColor Yellow
Set-Location -Path C:\Users\carlo\check
docker-compose down
docker-compose up --build -d

# 4. Verificación
Write-Host "Paso 4: Validando salud del sistema..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Invoke-RestMethod -Uri http://localhost:3000/api/health

Write-Host "Despliegue Docker completado con éxito." -ForegroundColor Green
