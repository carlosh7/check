# Script PowerShell para forzar eliminación de carpeta bloqueada
Write-Host "🔍 Intentando eliminar carpeta: C:\Users\carlo\check" -ForegroundColor Yellow

# Verificar si la carpeta existe
if (Test-Path "C:\Users\carlo\check") {
    Write-Host "✅ Carpeta encontrada" -ForegroundColor Green
    
    # Intentar eliminar recursivamente
    try {
        Write-Host "🗑️  Eliminando carpeta..." -ForegroundColor Yellow
        Remove-Item -Path "C:\Users\carlo\check" -Recurse -Force -ErrorAction Stop
        Write-Host "✅ Carpeta eliminada exitosamente!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error al eliminar: $_" -ForegroundColor Red
        
        # Intentar método alternativo
        Write-Host "🔄 Intentando método alternativo..." -ForegroundColor Yellow
        try {
            # Usar cmd para eliminar
            cmd.exe /c "rd /s /q `"C:\Users\carlo\check`""
            
            if (Test-Path "C:\Users\carlo\check") {
                Write-Host "❌ Aún no se pudo eliminar. La carpeta está bloqueada por el sistema." -ForegroundColor Red
                Write-Host "💡 Sugerencias:" -ForegroundColor Cyan
                Write-Host "   1. Reiniciar la computadora" -ForegroundColor Cyan
                Write-Host "   2. Desactivar OneDrive temporalmente" -ForegroundColor Cyan
                Write-Host "   3. Usar modo seguro de Windows" -ForegroundColor Cyan
            } else {
                Write-Host "✅ Carpeta eliminada con método alternativo!" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "❌ Todos los métodos fallaron." -ForegroundColor Red
        }
    }
} else {
    Write-Host "✅ La carpeta ya no existe." -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Verificación final:" -ForegroundColor Yellow
if (Test-Path "C:\Users\carlo\check") {
    Write-Host "❌ La carpeta C:\Users\carlo\check todavía existe" -ForegroundColor Red
} else {
    Write-Host "✅ La carpeta C:\Users\carlo\check ha sido eliminada" -ForegroundColor Green
}