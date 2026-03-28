@echo off
REM ============================================
REM CHECK PRO - Script de Configuración Automática
REM ============================================
REM Este script configura automáticamente el proyecto:
REM 1. Copia .env.example a .env (si no existe)
REM 2. Instala las dependencias con npm install
REM 3. Inicia el servidor
REM ============================================

echo.
echo ============================================
echo   CHECK PRO - Setup Automático
echo ============================================
echo.

REM === Paso 1: Verificar/Crear .env ===
if not exist ".env" (
    echo [1/3] Creando archivo .env desde .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo        ✓ Archivo .env creado
    ) else (
        echo        ⚠ Advertencia: No se encontró .env.example
    )
) else (
    echo [1/3] ✓ Archivo .env ya existe
)

echo.
echo [2/3] Instalando dependencias...
echo        Esto puede tomar varios minutos...
echo.

REM === Paso 2: Instalar dependencias ===
call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Error al instalar dependencias
    pause
    exit /b 1
)

echo.
echo        ✓ Dependencias instaladas correctamente

REM === Paso 3: Iniciar servidor ===
echo.
echo [3/3] Iniciando servidor...
echo.
echo ============================================
echo   Servidor iniciado en: http://localhost:3000
echo   Presiona Ctrl+C para detener
echo ============================================
echo.

call npm start
