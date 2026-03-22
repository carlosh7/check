$path = "c:\Users\carlo\OneDrive\Documentos\APP\Registro\app-shell.html"
$content = [System.IO.File]::ReadAllText($path)

# 1. Indicador de Versión - Con Regex de .NET
$regex1 = [regex]'(</button>\s+</div>\s+)(</div>\s+</aside>)'
$versionTag = "`n                <div class=`"mt-4 text-center`">`n                    <span id=`"version-display`" class=`"text-[9px] font-bold text-text-muted uppercase tracking-widest opacity-50`">v12.2.2</span>`n                </div>`n            "
$content = $regex1.Replace($content, '$1' + $versionTag + '$2')

# 2. Limpiar view-admin (remover sidebar duplicado)
$regex2 = [regex]'(?s)<div id="view-admin" class="hidden admin-layout bg-slate-950 animate-fade">.*?<aside class="sidebar.*?</aside>'
$newHeader = '<div id="view-admin" class="hidden animate-fade overflow-y-auto w-full h-full p-8 md:p-12">`n        <div class="admin-layout-content max-w-7xl mx-auto">'
$content = $regex2.Replace($content, $newHeader)

# 3. Cerrar Divs y corregir tags al final de view-admin
$regex3 = [regex]'(<h2 class="flex items-center gap-2">.*?<tbody id="guests-tbody-admin">.*?</tbody>\s+</table>\s+</div>\s+</section>)'
$content = $regex3.Replace($content, '$1`n        </div>`n    ')

[System.IO.File]::WriteAllText($path, $content)
Write-Host "app-shell.html updated successfully with .NET Regex"
