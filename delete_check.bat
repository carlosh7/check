@echo off
echo Intentando borrar carpeta check...
timeout /t 5 /nobreak > nul
rmdir /s /q "C:\Users\carlo\check"
if exist "C:\Users\carlo\check" (
    echo ERROR: No se pudo borrar la carpeta check
    echo Puede que esté siendo usada por otro proceso
    pause
) else (
    echo SUCCESS: Carpeta check eliminada exitosamente
)
timeout /t 2 /nobreak > nul