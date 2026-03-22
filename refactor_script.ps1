$path = "c:\Users\carlo\OneDrive\Documentos\APP\Registro\script.js"
$content = Get-Content -Path $path -Raw -Encoding UTF8

# 1. Definir la cabecera con imports
$header = @"
import { LS, lazyLoad } from './src/frontend/utils.js';
import { API } from './src/frontend/api.js';

// MASTER SCRIPT V12.2.3 - ARQUITECTURA ESM 🛡️🚀💎
console.log("CHECK V12.2.3: Iniciando Sistema Modular...");
console.log('[INIT] Script loaded as ESM, LS available');

"@

# 2. Reemplazar la cabecera corrupta y redundante hasta window.App
# Buscamos la declaración de window.App = {
$pattern = "(?s)^.*?window\.App = \{"
$replacement = $header + "`nwindow.App = {"
$newContent = [regex]::Replace($content, $pattern, $replacement)

# 3. Insertar fetchAPI wrapper dentro de App
# Lo insertaremos justo después de constants: { ... }
if ($newContent -match "constants: \{ API_URL: '/api' \},") {
    $newContent = $newContent -replace "constants: \{ API_URL: '/api' \},", "constants: { API_URL: '/api' },`n    fetchAPI(endpoint, options) { return API.fetchAPI(endpoint, options); },"
}

# 4. Corregir codificaciones comunes corruptas
$corrections = @(
    @{p="ÃƒÂ­"; r="í"},
    @{p="ÃƒÂ³"; r="ó"},
    @{p="ÃƒÂ¡"; r="á"},
    @{p="ÃƒÂ©"; r="é"},
    @{p="ÃƒÂº"; r="ú"},
    @{p="ÃƒÂ±"; r="ñ"},
    @{p="Ãƒâ€œ"; r="Ó"},
    @{p="ÃƒÂ"; r="á"},
    @{p="Ã°Å¸â€ºÂ¡"; r="🛡️"},
    @{p="Ã°Å¸Å¡â‚¬"; r="🚀"},
    @{p="Ã°Å¸â€™Å½"; r="💎"}
)

foreach ($c in $corrections) {
    # Usamos [regex]::Escape para que los caracteres especiales no rompan el regex
    $newContent = $newContent -replace [regex]::Escape($c.p), $c.r
}

# 5. Asegurar consistencia de la versión en el state
$newContent = $newContent -replace "version: '12.2.2'", "version: '12.2.3'"

# Guardar de nuevo en UTF8 con BOM para Windows
[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
Write-Output "✓ Refactorización de script.js completada con éxito."
