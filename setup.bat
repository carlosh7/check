@echo off
REM ============================================
REM CHECK PRO - Inicio Automático
REM ============================================
REM Solo haz doble clic en este archivo
REM El resto se hace automáticamente
REM ============================================

echo.
echo ============================================
echo   CHECK PRO - Iniciando configuración...
echo ============================================
echo.

REM Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado o no está en el PATH
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js detectado: %node_version%
echo.

REM Ejecutar script de configuración
echo 🔧 Ejecutando configuración automática...
echo.

node setup.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error durante la configuración
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Configuración completada exitosamente!
echo ============================================
echo.
pause
