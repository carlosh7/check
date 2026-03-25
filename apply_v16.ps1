$basePath = "c:\Users\carlo\OneDrive\Documentos\APP\Registro"
$htmlPath = Join-Path $basePath "app-shell.html"
$jsPath = Join-Path $basePath "script.js"

# 1. Update app-shell.html Toolbar
$tb = @'
                                     <!-- Barra de Herramientas de Campaña V12.16.0 -->
                                     <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-4 bg-white/5 p-3 rounded-2xl border border-white/10 shadow-xl overflow-hidden font-premium">
                                         <button onclick="App.editMailingTemplate()" class="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/10 transition-all shadow-sm">
                                             <span class="material-symbols-outlined text-sm">edit</span> Editar
                                         </button>
                                         <button onclick="App.saveMailingCampaign()" class="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/10 transition-all shadow-sm">
                                             <span class="material-symbols-outlined text-sm">save</span> Guardar
                                         </button>
                                         <button onclick="App.scheduleMailing()" class="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/10 transition-all shadow-sm">
                                             <span class="material-symbols-outlined text-sm">calendar_month</span> Programar
                                         </button>
                                         <button onclick="App.showSavedCampaigns()" class="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/10 transition-all shadow-sm font-premium">
                                             <span class="material-symbols-outlined text-sm">history</span> Historial
                                         </button>
                                     </div>
'@

$content = [System.IO.File]::ReadAllText($htmlPath)
$content = [System.Text.RegularExpressions.Regex]::Replace($content, '(?s)Barra de Herramientas de Campa.*?<!-- Barra de Herramientas de Campaa V12.15.0 -->.*?</div>', $tb)
[System.IO.File]::WriteAllText($htmlPath, $content)

# 2. Update script.js Logic
$logic = @'
    editMailingTemplate() {
        const tid = document.getElementById("mailing-template-selector").value;
        if (!tid) return Swal.fire("Atención", "Selecciona una plantilla para editar.", "info");
        this.navigate("templates");
        const check = (r = 0) => {
            const b = document.querySelector(`[onclick*="App.openTemplateEditor(\'${tid}\')"]`);
            if (b) b.click(); else if (r < 15) setTimeout(() => check(r + 1), 300);
        };
        check();
    },
    saveMailingCampaign() {
        const tid = document.getElementById("mailing-template-selector").value;
        const eid = document.getElementById("mailing-event-selector").value;
        const gs = (this.state.mailingGuests || []).filter(g => g.selected);
        if (!tid || gs.length === 0) return Swal.fire("Atención", "Selecciona plantilla y destinatarios.", "info");
        const camp = { id: Date.now(), name: `Campaña ${new Date().toLocaleString()}`, tid, eid, recipients: gs.map(g => g.email), date: new Date().toISOString() };
        const saved = JSON.parse(localStorage.getItem("check_saved_campaigns") || "[]");
        saved.push(camp);
        localStorage.setItem("check_saved_campaigns", JSON.stringify(saved));
        Swal.fire({ title: "¡Guardado!", text: "Campaña guardada en el historial local.", icon: "success", background: "var(--bg-card)", color: "var(--text-primary)", confirmButtonColor: "var(--primary)" });
    },
    showSavedCampaigns() {
        const saved = JSON.parse(localStorage.getItem("check_saved_campaigns") || "[]");
        if (saved.length === 0) return Swal.fire("Historial Vacío", "No hay campañas guardadas.", "info");
        const html = `<div class="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">${saved.reverse().map(c => `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all font-premium shadow-sm">
                <div class="flex flex-col text-left">
                    <span class="text-[11px] font-bold text-white">${c.name}</span>
                    <span class="text-[9px] text-slate-500">${c.recipients.length} destinatarios</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="App.loadCampaign(${c.id})" class="px-2 py-1 bg-[var(--primary)] text-white text-[9px] rounded-lg">Cargar</button>
                    <button onclick="App.deleteCampaign(${c.id})" class="px-2 py-1 bg-red-500/20 text-red-500 text-[9px] rounded-lg">Borrar</button>
                </div>
            </div>`).join("")}</div>`;
        Swal.fire({ title: "Historial de Campañas", html, background: "var(--bg-card)", color: "var(--text-primary)", showConfirmButton: false });
    },
    loadCampaign(id) {
        const saved = JSON.parse(localStorage.getItem("check_saved_campaigns") || "[]");
        const c = saved.find(x => x.id === id);
        if (!c) return;
        document.getElementById("mailing-template-selector").value = c.tid;
        document.getElementById("mailing-event-selector").value = c.eid;
        (this.state.mailingGuests || []).forEach(g => g.selected = c.recipients.includes(g.email));
        this.onTemplateChange();
        this.filterMailingGuests();
        Swal.close();
        this._notifyAction("Éxito", "Campaña cargada.", "success");
    },
    deleteCampaign(id) {
        let saved = JSON.parse(localStorage.getItem("check_saved_campaigns") || "[]");
        saved = saved.filter(x => x.id !== id);
        localStorage.setItem("check_saved_campaigns", JSON.stringify(saved));
        this.showSavedCampaigns();
    },
'@

$js = [System.IO.File]::ReadAllText($jsPath)
# Reemplazar editMailingTemplate
$js = [System.Text.RegularExpressions.Regex]::Replace($js, '(?m)^    editMailingTemplate\(\) \{.*?\},', $logic)
# Eliminar la vieja función saveMailingCampaign que ahora está en el bloque anterior
$js = [System.Text.RegularExpressions.Regex]::Replace($js, '(?m)^    saveMailingCampaign\(\) \{.*?\},', "")
[System.IO.File]::WriteAllText($jsPath, $js)

Write-Host "V12.16.0 Applied successfully"
