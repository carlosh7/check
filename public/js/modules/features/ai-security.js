/**
 * AI Security Module — Check Pro
 * Módulo de seguridad de IA: inventario, políticas, logs, alertas, stats, settings
 * Extraído de app.js para reducir monolito
 * @version 12.44.765
 */

export const AiSecurity = {
    aiLogsPage: 1,
    aiAlertsPage: 1,

    async loadAiSecurity(App) {
        this.switchAiSubTab(App, 'overview');
        this.loadAiLogs(App);
        this.loadAiAlerts(App);
        this.loadAiStats(App);
        this.loadAiSettings(App);
        try {
            var inventory = await App.fetchAPI('/security/ai/inventory') || [];
            var tbody = document.getElementById('ai-inventory-tbody');
            if (tbody) {
                if (inventory.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Sin sistemas de IA detectados</td></tr>';
                } else {
                    var riskColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
                    var statusLabels = { detected: 'Detectado', approved: 'Aprobado', blocked: 'Bloqueado' };
                    tbody.innerHTML = inventory.map(function(item) {
                        return '<tr class="hover:bg-white/[0.02] transition-colors">' +
                            '<td class="table-td font-medium text-white">' + App.esc(item.name || '') + (item.description ? '<br><span class="text-[10px] text-slate-500">' + App.esc(item.description) + '</span>' : '') + '</td>' +
                            '<td class="table-td text-slate-400">' + App.esc(item.type || '-') + '</td>' +
                            '<td class="table-td text-slate-400">' + App.esc(item.provider || '-') + '</td>' +
                            '<td class="table-td"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:' + (riskColors[item.risk_level] || '#64748b') + '30;color:' + (riskColors[item.risk_level] || '#64748b') + '">' + App.esc(item.risk_level || 'unknown') + '</span></td>' +
                            '<td class="table-td">' + App.esc(statusLabels[item.status] || item.status) + '</td>' +
                            '<td class="table-td text-xs text-slate-500">' + (item.detected_at ? new Date(item.detected_at).toLocaleDateString() : '-') + '</td>' +
                            '<td class="table-td"><button class="btn-icon text-red-400" onclick="App.deleteAiInventory(\'' + item.id + '\')"><span class="material-symbols-outlined text-sm">delete</span></button></td></tr>';
                    }).join('');
                }
            }
            var policies = await App.fetchAPI('/security/ai/policies') || [];
            var pList = document.getElementById('ai-policies-list');
            if (pList) {
                if (policies.length === 0) {
                    pList.innerHTML = '<p class="text-xs text-slate-500 italic">Sin politicas definidas</p>';
                } else {
                    pList.innerHTML = policies.map(function(p) {
                        var isActive = p.is_active === 1 || p.is_active === true;
                        return '<div class="flex justify-between items-start p-3 rounded-lg bg-[var(--bg-hover)]">' +
                            '<div class="flex-1 min-w-0">' +
                            '<div class="flex items-center gap-2 mb-1">' +
                            '<span class="text-sm font-medium text-white truncate">' + App.esc(p.name || '') + '</span>' +
                            '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ' + (isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400') + '">' + (isActive ? 'Activa' : 'Inactiva') + '</span></div>' +
                            (p.description ? '<p class="text-xs text-slate-500">' + App.esc(p.description) + '</p>' : '') +
                            (p.content ? '<p class="text-[10px] text-slate-600 mt-1 italic">' + App.esc(p.content.substring(0, 120)) + (p.content.length > 120 ? '...' : '') + '</p>' : '') + '</div>' +
                            '<div class="flex flex-col items-center gap-1 ml-2">' +
                            '<label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only peer" ' + (isActive ? 'checked' : '') + ' onchange="App.toggleAiPolicy(\'' + p.id + '\', this.checked)"><div class="w-8 h-4 rounded-full peer peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" style="background:#475569"></div></label>' +
                            '<div class="flex gap-1"><button class="btn-icon" onclick="App.editAiPolicy(\'' + p.id + '\')"><span class="material-symbols-outlined text-sm">edit</span></button>' +
                            '<button class="btn-icon text-red-400" onclick="App.deleteAiPolicy(\'' + p.id + '\')"><span class="material-symbols-outlined text-sm">delete</span></button></div></div></div>';
                    }).join('');
                }
            }
        } catch(e) { console.error('[AI] Error:', e.message); }
    },

    openAiInventoryModal(App) {
        Swal.fire({
            title: 'Agregar sistema de IA',
            html: '<input id="swal-ai-name" class="swal2-input" placeholder="Nombre (ej: ChatGPT, Copilot...)">' +
                  '<select id="swal-ai-type" class="swal2-input"><option value="llm">LLM / Chat</option><option value="image">Generacion de imagenes</option><option value="code">Asistente de codigo</option><option value="other">Otro</option></select>' +
                  '<input id="swal-ai-provider" class="swal2-input" placeholder="Proveedor (ej: OpenAI, Google...)">' +
                  '<select id="swal-ai-risk" class="swal2-input"><option value="low">Bajo</option><option value="medium" selected>Medio</option><option value="high">Alto</option></select>' +
                  '<textarea id="swal-ai-desc" class="swal2-textarea" placeholder="Descripcion del uso..."></textarea>',
            background: '#0f172a', color: '#fff',
            confirmButtonText: 'Agregar',
            showCancelButton: true,
            preConfirm: function() {
                var name = document.getElementById('swal-ai-name')?.value.trim();
                if (!name) { Swal.showValidationMessage('Nombre requerido'); return; }
                return {
                    name: name,
                    type: document.getElementById('swal-ai-type')?.value || 'llm',
                    provider: document.getElementById('swal-ai-provider')?.value || '',
                    risk_level: document.getElementById('swal-ai-risk')?.value || 'medium',
                    description: document.getElementById('swal-ai-desc')?.value || ''
                };
            }
        }).then(async function(result) {
            if (result.isConfirmed && result.value) {
                try {
                    await App.fetchAPI('/security/ai/inventory', { method: 'POST', body: JSON.stringify(result.value) });
                    AiSecurity.loadAiSecurity(App);
                } catch(e) { console.error('[AI] Error:', e.message); }
            }
        });
    },

    async deleteAiInventory(App, id) {
        var confirm = await Swal.fire({ icon: 'warning', title: 'Eliminar sistema?', showCancelButton: true, background: '#0f172a', color: '#fff' });
        if (!confirm.isConfirmed) return;
        try {
            await App.fetchAPI('/security/ai/inventory/' + id, { method: 'DELETE' });
            this.loadAiSecurity(App);
        } catch(e) { console.error('[AI] Error:', e.message); }
    },

    async toggleAiPolicy(App, id, isActive) {
        try {
            await App.fetchAPI('/security/ai/policies/' + id, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) });
            this.loadAiSecurity(App);
        } catch(e) { console.error('[AI] Error:', e.message); }
    },

    openAiPolicyModal(App, policy) {
        var isActive = policy ? (policy.is_active === 1 || policy.is_active === true) : true;
        Swal.fire({
            title: policy ? 'Editar politica' : 'Nueva politica',
            html: '<input id="swal-pol-name" class="swal2-input" placeholder="Nombre" value="' + App.esc(policy ? (policy.name || '') : '') + '">' +
                  '<input id="swal-pol-desc" class="swal2-input" placeholder="Descripcion" value="' + App.esc(policy ? (policy.description || '') : '') + '">' +
                  '<textarea id="swal-pol-content" class="swal2-textarea" placeholder="Contenido de la politica..." rows="6">' + App.esc(policy ? (policy.content || '') : '') + '</textarea>' +
                  '<label class="flex items-center gap-2 mt-2 text-sm" style="color:#fff"><input type="checkbox" id="swal-pol-active" ' + (isActive ? 'checked' : '') + ' class="checkbox-sm"> Politica activa</label>',
            background: '#0f172a', color: '#fff',
            confirmButtonText: policy ? 'Guardar' : 'Crear',
            showCancelButton: true,
            preConfirm: function() {
                var name = document.getElementById('swal-pol-name')?.value.trim();
                if (!name) { Swal.showValidationMessage('Nombre requerido'); return; }
                return {
                    name: name,
                    description: document.getElementById('swal-pol-desc')?.value || '',
                    content: document.getElementById('swal-pol-content')?.value || '',
                    is_active: document.getElementById('swal-pol-active')?.checked || false
                };
            }
        }).then(async function(result) {
            if (result.isConfirmed && result.value) {
                try {
                    if (policy) {
                        await App.fetchAPI('/security/ai/policies/' + policy.id, { method: 'PUT', body: JSON.stringify(result.value) });
                    } else {
                        await App.fetchAPI('/security/ai/policies', { method: 'POST', body: JSON.stringify(result.value) });
                    }
                    AiSecurity.loadAiSecurity(App);
                } catch(e) { console.error('[AI] Error:', e.message); }
            }
        });
    },

    async editAiPolicy(App, id) {
        var policies = await App.fetchAPI('/security/ai/policies') || [];
        var p = policies.find(function(x) { return x.id === id; });
        if (p) this.openAiPolicyModal(App, p);
    },

    async deleteAiPolicy(App, id) {
        var confirm = await Swal.fire({ icon: 'warning', title: 'Eliminar politica?', showCancelButton: true, background: '#0f172a', color: '#fff' });
        if (!confirm.isConfirmed) return;
        try {
            await App.fetchAPI('/security/ai/policies/' + id, { method: 'DELETE' });
            this.loadAiSecurity(App);
        } catch(e) { console.error('[AI] Error:', e.message); }
    },

    switchAiSubTab(App, subTabName) {
        var tabs = ['overview', 'logs', 'alerts', 'stats', 'settings'];
        tabs.forEach(function(t) {
            var btn = document.getElementById('ai-tab-' + t);
            var content = document.getElementById('ai-subtab-' + t);
            if (btn) {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ' + (t === subTabName ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-white/5 text-slate-400 hover:bg-white/10');
            }
            if (content) {
                content.classList.toggle('hidden', t !== subTabName);
            }
        });
        if (subTabName === 'logs') this.loadAiLogs(App);
        if (subTabName === 'alerts') this.loadAiAlerts(App);
        if (subTabName === 'stats') this.loadAiStats(App);
        if (subTabName === 'settings') this.loadAiSettings(App);
    },

    async loadAiLogs(App, direction) {
        if (!this.aiLogsPage) this.aiLogsPage = 1;
        if (direction === -1 && this.aiLogsPage > 1) this.aiLogsPage--;
        if (direction === 1) this.aiLogsPage++;
        var page = this.aiLogsPage;
        var userId = document.getElementById('filter-ai-log-user')?.value || '';
        var injectionOnly = document.getElementById('filter-ai-log-injection')?.value || '';
        try {
            var res = await App.fetchAPI('/security/ai/logs?page=' + page + '&limit=30&user_id=' + userId + '&injection_only=' + injectionOnly);
            var logs = res?.data || [];
            var total = res?.pagination?.total || 0;
            var tbody = document.getElementById('ai-logs-tbody');
            var countEl = document.getElementById('ai-logs-count');
            var prevBtn = document.getElementById('btn-ai-logs-prev');
            var nextBtn = document.getElementById('btn-ai-logs-next');
            if (countEl) countEl.textContent = total + ' registros';
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = (page * 30) >= total;
            if (!tbody) return;
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Sin consultas registradas</td></tr>';
            } else {
                tbody.innerHTML = logs.map(function(l) {
                    var riskColor = l.risk_score >= 0.9 ? '#ef4444' : l.risk_score >= 0.7 ? '#f59e0b' : l.risk_score >= 0.3 ? '#3b82f6' : '#10b981';
                    var snippet = (l.masked_prompt || l.prompt || '').substring(0, 80);
                    return '<tr class="hover:bg-white/[0.02] transition-colors">' +
                        '<td class="table-td text-xs text-slate-300">' + App.esc(l.user_name || l.user_id || '-') + '</td>' +
                        '<td class="table-td text-xs text-slate-400 max-w-[200px] truncate" title="' + App.esc(l.masked_prompt || l.prompt || '') + '">' + App.esc(snippet) + (snippet.length >= 80 ? '...' : '') + '</td>' +
                        '<td class="table-td"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:' + riskColor + '30;color:' + riskColor + '">' + (l.risk_score || 0).toFixed(2) + '</span></td>' +
                        '<td class="table-td">' + (l.injection_detected ? '<span class="text-red-400 text-xs font-bold">SI</span>' : '<span class="text-slate-600 text-xs">-</span>') + '</td>' +
                        '<td class="table-td text-xs text-slate-500">' + (l.duration_ms ? l.duration_ms + 'ms' : '-') + '</td>' +
                        '<td class="table-td text-xs text-slate-500">' + (l.created_at ? new Date(l.created_at).toLocaleString() : '-') + '</td>' +
                        '<td class="table-td"><button class="btn-icon" onclick="App.viewAiLogDetail(\'' + l.id + '\')" title="Ver detalle"><span class="material-symbols-outlined text-sm text-slate-400">visibility</span></button></td></tr>';
                }).join('');
            }
        } catch(e) { console.error('[AI_LOGS] Error:', e.message); }
    },

    async viewAiLogDetail(App, logId) {
        try {
            var log = await App.fetchAPI('/security/ai/logs/' + logId);
            if (!log) { Swal.fire({ icon: 'error', title: 'Error', text: 'Log no encontrado', background: '#0f172a', color: '#fff' }); return; }
            var riskColor = log.risk_score >= 0.9 ? '#ef4444' : log.risk_score >= 0.7 ? '#f59e0b' : log.risk_score >= 0.3 ? '#3b82f6' : '#10b981';
            Swal.fire({
                title: 'Detalle de consulta IA',
                html:
                    '<div class="text-left space-y-2 text-xs">' +
                    '<div><span class="font-bold text-slate-400">Usuario:</span> <span class="text-white">' + App.esc(log.user_name || log.user_id || '-') + '</span></div>' +
                    '<div><span class="font-bold text-slate-400">Modelo:</span> <span class="text-white">' + App.esc(log.model || '-') + '</span></div>' +
                    '<div><span class="font-bold text-slate-400">Riesgo:</span> <span class="font-bold" style="color:' + riskColor + '">' + (log.risk_score || 0).toFixed(2) + '</span></div>' +
                    '<div><span class="font-bold text-slate-400">Inyecci&oacute;n:</span> <span class="text-' + (log.injection_detected ? 'red-400' : 'green-400') + '">' + (log.injection_detected ? 'SI - ' + App.esc(log.injection_pattern || '') : 'NO') + '</span></div>' +
                    '<div><span class="font-bold text-slate-400">Duraci&oacute;n:</span> <span class="text-white">' + (log.duration_ms || 0) + 'ms</span></div>' +
                    '<div><span class="font-bold text-slate-400">Fecha:</span> <span class="text-slate-300">' + (log.created_at ? new Date(log.created_at).toLocaleString() : '-') + '</span></div>' +
                    '<hr class="border-slate-700">' +
                    '<div><span class="font-bold text-slate-400 block mb-1">Prompt:</span><div class="bg-slate-800 rounded p-2 text-slate-300 max-h-[150px] overflow-y-auto">' + App.esc(log.masked_prompt || log.prompt || '-') + '</div></div>' +
                    (log.masked_response ? '<div><span class="font-bold text-slate-400 block mb-1">Respuesta:</span><div class="bg-slate-800 rounded p-2 text-slate-300 max-h-[200px] overflow-y-auto">' + App.esc(log.masked_response) + '</div></div>' : '') +
                    '</div>',
                width: '600px',
                background: '#0f172a', color: '#fff',
                confirmButtonText: 'Cerrar'
            });
        } catch(e) { console.error('[AI_LOGS] Error:', e.message); }
    },

    async loadAiAlerts(App, direction) {
        if (!this.aiAlertsPage) this.aiAlertsPage = 1;
        if (direction === -1 && this.aiAlertsPage > 1) this.aiAlertsPage--;
        if (direction === 1) this.aiAlertsPage++;
        var page = this.aiAlertsPage;
        var severity = document.getElementById('filter-ai-alert-severity')?.value || '';
        try {
            var res = await App.fetchAPI('/security/ai/alerts?page=' + page + '&limit=30&severity=' + severity + '&acknowledged=0');
            var alerts = res?.data || [];
            var total = res?.pagination?.total || 0;
            var tbody = document.getElementById('ai-alerts-tbody');
            var countEl = document.getElementById('ai-alerts-count');
            var prevBtn = document.getElementById('btn-ai-alerts-prev');
            var nextBtn = document.getElementById('btn-ai-alerts-next');
            if (countEl) countEl.textContent = total + ' alertas';
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = (page * 30) >= total;
            if (!tbody) return;
            if (alerts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Sin alertas registradas</td></tr>';
            } else {
                var severityColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
                var severityLabels = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
                tbody.innerHTML = alerts.map(function(a) {
                    var sev = a.severity || 'medium';
                    var isAcknowledged = !!a.acknowledged_at;
                    return '<tr class="hover:bg-white/[0.02] transition-colors">' +
                        '<td class="table-td text-xs text-slate-400">' + App.esc(a.type || '-') + '</td>' +
                        '<td class="table-td"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:' + (severityColors[sev] || '#64748b') + '30;color:' + (severityColors[sev] || '#64748b') + '">' + App.esc(severityLabels[sev] || sev) + '</span></td>' +
                        '<td class="table-td text-xs text-slate-300 max-w-[200px] truncate" title="' + App.esc(a.description || '') + '">' + App.esc(a.title || '-') + '</td>' +
                        '<td class="table-td text-xs text-slate-400">' + App.esc(a.user_name || a.user_id || '-') + '</td>' +
                        '<td class="table-td">' + (isAcknowledged ? '<span class="text-green-400 text-xs">Atendida</span>' : '<span class="text-amber-400 text-xs font-bold">Pendiente</span>') + '</td>' +
                        '<td class="table-td text-xs text-slate-500">' + (a.created_at ? new Date(a.created_at).toLocaleString() : '-') + '</td>' +
                        '<td class="table-td">' + (!isAcknowledged ? '<button class="btn-icon text-green-400" onclick="App.acknowledgeAiAlert(\'' + a.id + '\')" title="Marcar como atendida"><span class="material-symbols-outlined text-sm">check_circle</span></button>' : '<span class="text-xs text-slate-600">-</span>') + '</td></tr>';
                }).join('');
            }
        } catch(e) { console.error('[AI_ALERTS] Error:', e.message); }
    },

    async acknowledgeAiAlert(App, alertId) {
        try {
            await App.fetchAPI('/security/ai/alerts/' + alertId + '/acknowledge', { method: 'POST' });
            this.loadAiAlerts(App);
            this.loadAiStats(App);
        } catch(e) { console.error('[AI_ALERTS] Error:', e.message); }
    },

    async loadAiStats(App) {
        try {
            var stats = await App.fetchAPI('/security/ai/stats');
            if (!stats) return;
            var qEl = document.getElementById('ai-stat-queries');
            var iEl = document.getElementById('ai-stat-injections');
            var aEl = document.getElementById('ai-stat-alerts');
            var pEl = document.getElementById('ai-stat-pending');
            var rEl = document.getElementById('ai-stat-risk');
            var uEl = document.getElementById('ai-stats-users');
            var tEl = document.getElementById('ai-stats-trend');
            if (qEl) qEl.textContent = stats.totalQueries || 0;
            if (iEl) iEl.textContent = stats.totalInjections || 0;
            if (aEl) aEl.textContent = stats.totalAlerts || 0;
            if (pEl) pEl.textContent = stats.pendingAlerts || 0;
            if (rEl) rEl.textContent = (stats.avgRiskScore || 0).toFixed(2);
            if (uEl) {
                var users = stats.byUser || [];
                if (users.length === 0) {
                    uEl.innerHTML = '<p class="text-xs text-slate-500 italic">Sin datos</p>';
                } else {
                    uEl.innerHTML = users.map(function(u) {
                        return '<div class="flex justify-between items-center text-xs"><span class="text-slate-300">' + App.esc(u.user_name || u.user_id || 'Desconocido') + '</span><span class="text-white font-bold">' + u.cnt + '</span></div>';
                    }).join('');
                }
            }
            if (tEl) {
                var trend = stats.dailyTrend || [];
                if (trend.length === 0) {
                    tEl.innerHTML = '<p class="text-xs text-slate-500 italic">Sin datos en los ultimos 30 días</p>';
                } else {
                    var maxVal = Math.max.apply(null, trend.map(function(d) { return d.cnt; })) || 1;
                    tEl.innerHTML = trend.map(function(d) {
                        var pct = (d.cnt / maxVal) * 100;
                        return '<div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-24 text-right">' + App.esc(d.date) + '</span><div class="flex-1 bg-slate-700 rounded h-3 overflow-hidden"><div class="bg-[var(--primary)] h-3 rounded transition-all" style="width:' + pct + '%"></div></div><span class="text-slate-300 w-6 text-left font-bold">' + d.cnt + '</span></div>';
                    }).join('');
                }
            }
        } catch(e) { console.error('[AI_STATS] Error:', e.message); }
    },

    async loadAiSettings(App) {
        try {
            var settings = await App.fetchAPI('/security/ai/settings');
            if (!settings) return;
            var enabledEl = document.getElementById('ai-setting-enabled');
            var keyEl = document.getElementById('ai-setting-key');
            var modelEl = document.getElementById('ai-setting-model');
            var promptEl = document.getElementById('ai-setting-prompt');
            if (enabledEl) enabledEl.checked = settings.ai_enabled === '1';
            if (keyEl) keyEl.value = settings.ai_openrouter_key || '';
            if (modelEl) modelEl.value = settings.ai_model || '';
            if (promptEl) promptEl.value = settings.ai_system_prompt || '';
        } catch(e) { console.error('[AI_SETTINGS] Error:', e.message); }
    },

    async saveAiSettings(App) {
        var enabled = document.getElementById('ai-setting-enabled')?.checked || false;
        var apiKey = document.getElementById('ai-setting-key')?.value || '';
        var model = document.getElementById('ai-setting-model')?.value || '';
        var prompt = document.getElementById('ai-setting-prompt')?.value || '';
        try {
            await App.fetchAPI('/security/ai/settings', {
                method: 'PUT',
                body: JSON.stringify({ ai_enabled: enabled ? '1' : '0', ai_openrouter_key: apiKey, ai_model: model, ai_system_prompt: prompt })
            });
            Swal.fire({ icon: 'success', title: 'Configuraci&oacute;n guardada', timer: 1500, showConfirmButton: false, background: '#0f172a', color: '#fff' });
        } catch(e) { console.error('[AI_SETTINGS] Error:', e.message); }
    }
};
