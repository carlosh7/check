# Antigravity Bridge - Automated Deployment Script (Turbo-All)
# Version: 12.37.26 - Email Hub Reconstruction

Write-Host "Iniciando despliegue de version 12.37.26 (Email Hub Reconstruction)..." -ForegroundColor Cyan

# 1. Añadir y hacer commit en el repositorio original
Write-Host "1. Guardando cambios..." -ForegroundColor Yellow
git add .
git commit -m "Automated update: Check Pro v12.37.26 - Email Hub Reconstruction"

# 2. Subir a main
Write-Host "2. Subiendo a origin main..." -ForegroundColor Yellow
git push origin main

# 3. Crear el tag y subirlo
Write-Host "3. Creando y subiendo tag v12.37.26..." -ForegroundColor Yellow
git tag v12.37.26 HEAD
git push origin v12.37.26

# 4. Actualizar el contenedor de pruebas
Write-Host "4. Actualizando entorno de validacion en C:\Users\carlo\check..." -ForegroundColor Yellow
git -C C:\Users\carlo\check pull origin main
git -C C:\Users\carlo\check pull origin --tags

# 5. Reiniciar el servidor
Write-Host "5. Reiniciando el servidor Node.js..." -ForegroundColor Yellow
$proc = Get-Process node -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Matando procesos de Node..." -ForegroundColor Yellow
    taskkill /F /IM node.exe
} else {
    Write-Host "No hay procesos previos de node." -ForegroundColor Gray
}

Write-Host "Iniciando server.js en entorno de produccion/pruebas..." -ForegroundColor Yellow
Set-Location C:\Users\carlo\check
Start-Process -NoNewWindow node server.js

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "     DESPLIEGUE FINALIZADO EXISTOSAMENTE      " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Ya puedes validar en http://localhost:3000" -ForegroundColor Cyan
