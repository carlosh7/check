/**
 * Gamificación / Live Polling Module (C11-01)
 * Extraído de app.js para code splitting (C-02, P-03)
 */
import { API } from '../src/frontend/api.js';

const Gamification = window.GamificationModule = {

    loadGamification() {
        this.loadPolls();
        this.loadLeaderboard();
        this.loadBadges();
    },

    switchGamificationTab(tab) {
        document.querySelectorAll('[data-gamification-subtab]').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-gamification-subtab="${tab}"]`);
        if (btn) btn.classList.add('active');
        ['polls', 'leaderboard', 'badges'].forEach(id => {
            const el = document.getElementById('gamification-' + id);
            if (el) el.classList.toggle('hidden', id !== tab);
        });
    },

    loadPolls() {
        const eId = App.state.event?.id;
        if (!eId) return;
        const container = document.getElementById('poll-list');
        if (!container) return;
        API.fetchAPI('/polls/' + eId).then(polls => {
            if (!polls || polls.length === 0) {
                container.innerHTML = '<p class="text-xs text-slate-500 italic">No hay encuestas. Crea la primera.</p>';
                return;
            }
            container.innerHTML = polls.map(p => {
                const statusColor = p.status === 'active' ? 'text-green-400' : p.status === 'closed' ? 'text-red-400' : 'text-yellow-400';
                const statusLabel = p.status === 'active' ? 'Activa' : p.status === 'closed' ? 'Cerrada' : 'Borrador';
                let actions = '';
                if (p.status === 'draft') {
                    actions = `<button class="btn-secondary text-xs" onclick="App.editPoll('${p.id}')">Editar</button>
                               <button class="btn-primary text-xs" onclick="App.startPoll('${p.id}')">Activar</button>
                               <button class="btn-secondary text-xs text-red-400" onclick="App.deletePoll('${p.id}')">Eliminar</button>`;
                } else if (p.status === 'active') {
                    actions = `<button class="btn-primary text-xs" onclick="App.showPollResults('${p.id}')">Resultados</button>
                               <button class="btn-secondary text-xs" onclick="App.closePoll('${p.id}')">Cerrar</button>`;
                } else {
                    actions = `<button class="btn-secondary text-xs" onclick="App.showPollResults('${p.id}')">Ver resultados</button>
                               <button class="btn-secondary text-xs" onclick="App.deletePoll('${p.id}')">Eliminar</button>`;
                }
                return `<div class="card p-3 flex justify-between items-center">
                    <div><p class="text-sm font-semibold text-white">${App.esc(p.title)}</p>
                    <p class="text-xs text-slate-500">${p.type} · ${p.points} pts · <span class="${statusColor}">${statusLabel}</span></p></div>
                    <div class="flex gap-2">${actions}</div></div>`;
            }).join('');
        }).catch(() => { container.innerHTML = '<p class="text-xs text-red-400">Error al cargar encuestas</p>'; });
    },

    showPollEditor() {
        document.getElementById('gamification-polls').classList.add('hidden');
        document.getElementById('gamification-poll-editor').classList.remove('hidden');
        document.getElementById('poll-editor-title').value = '';
        document.getElementById('poll-editor-description').value = '';
        document.getElementById('poll-editor-type').value = 'single';
        document.getElementById('poll-editor-points').value = 10;
        document.getElementById('poll-editor-timer').value = 0;
        document.getElementById('poll-options-container').innerHTML = '';
        document.getElementById('poll-correct-answer-container').classList.add('hidden');
        App.loadSessionsSelect();
        App._initPollOptionListener();
        App._editingPollId = null;
    },

    editPoll(pollId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        API.fetchAPI('/polls/' + eId + '/' + pollId).then(poll => {
            if (!poll) return;
            App._editingPollId = pollId;
            document.getElementById('poll-editor-title').value = poll.title || '';
            document.getElementById('poll-editor-description').value = poll.description || '';
            document.getElementById('poll-editor-type').value = poll.type || 'single';
            document.getElementById('poll-editor-points').value = poll.points || 10;
            document.getElementById('poll-editor-timer').value = poll.time_limit_seconds || 0;
            const optContainer = document.getElementById('poll-options-container');
            optContainer.innerHTML = '';
            if (poll.options && poll.options.length > 0) {
                poll.options.forEach((opt, idx) => App.addPollOptionRow(opt.label || '', opt.is_correct === 1, idx));
            }
            if (poll.type === 'trivia') {
                document.getElementById('poll-correct-answer-container').classList.remove('hidden');
                App.updateCorrectAnswerOptions();
            }
            document.getElementById('gamification-polls').classList.add('hidden');
            document.getElementById('gamification-poll-editor').classList.remove('hidden');
        });
    },

    savePoll() {
        const eId = App.state.event?.id;
        if (!eId) return;
        const title = document.getElementById('poll-editor-title').value.trim();
        if (!title) { Swal.fire({ icon: 'warning', title: 'Título requerido' }); return; }
        const type = document.getElementById('poll-editor-type').value;
        const points = parseInt(document.getElementById('poll-editor-points').value) || 10;
        const timeLimit = parseInt(document.getElementById('poll-editor-timer').value) || 0;
        const sessionId = document.getElementById('poll-editor-session').value;
        const description = document.getElementById('poll-editor-description').value.trim();
        const options = [];
        document.querySelectorAll('#poll-options-container .poll-option-row').forEach(row => {
            const label = row.querySelector('.poll-option-input').value.trim();
            if (label) {
                const isCorrect = row.querySelector('.poll-option-correct') ? row.querySelector('.poll-option-correct').checked : false;
                options.push({ label, is_correct: isCorrect });
            }
        });
        const body = { title, type, points, time_limit_seconds: timeLimit, session_id: sessionId || null, description, options };
        if (type === 'trivia') {
            const correctIds = [];
            document.querySelectorAll('#poll-correct-options input:checked').forEach(cb => correctIds.push(cb.value));
            body.correct_answer = correctIds;
        }
        const url = App._editingPollId ? '/polls/' + eId + '/' + App._editingPollId : '/polls/' + eId;
        const method = App._editingPollId ? 'PUT' : 'POST';
        API.fetchAPI(url, { method, body: JSON.stringify(body) }).then(res => {
            if (res && res.success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: App._editingPollId ? 'Encuesta actualizada' : 'Encuesta creada', showConfirmButton: false, timer: 2000 });
                App._editingPollId = null;
                App.backToPollList();
            } else {
                Swal.fire({ icon: 'error', title: 'Error al guardar' });
            }
        }).catch(() => Swal.fire({ icon: 'error', title: 'Error al guardar' }));
    },

    backToPollList() {
        document.getElementById('gamification-poll-editor').classList.add('hidden');
        document.getElementById('gamification-poll-control').classList.add('hidden');
        document.getElementById('gamification-polls').classList.remove('hidden');
        this.loadPolls();
    },

    addPollOption() {
        const idx = document.querySelectorAll('#poll-options-container .poll-option-row').length;
        App.addPollOptionRow('', false, idx);
    },

    onPollTypeChange() {
        const type = document.getElementById('poll-editor-type').value;
        document.getElementById('poll-correct-answer-container').classList.toggle('hidden', type !== 'trivia');
        document.getElementById('poll-correct-options').innerHTML = '';
        if (type === 'trivia') App.updateCorrectAnswerOptions();
    },

    addPollOptionRow(label, isCorrect, idx) {
        const container = document.getElementById('poll-options-container');
        const div = document.createElement('div');
        div.className = 'poll-option-row flex items-center gap-2';
        div.innerHTML = `<input class="input-field flex-1 poll-option-input" type="text" placeholder="Opción ${idx + 1}" value="${App.esc(label)}">
            <label class="text-xs text-slate-400 flex items-center gap-1"><input class="poll-option-correct" type="checkbox" ${isCorrect ? 'checked' : ''}> Correcta</label>
            <button class="btn-secondary text-xs text-red-400" onclick="this.parentElement.remove()">✕</button>`;
        container.appendChild(div);
    },

    updateCorrectAnswerOptions() {
        const container = document.getElementById('poll-correct-options');
        container.innerHTML = '';
        document.querySelectorAll('#poll-options-container .poll-option-row').forEach((row, idx) => {
            const label = row.querySelector('.poll-option-input').value.trim() || ('Opción ' + (idx + 1));
            const cb = document.createElement('label');
            cb.className = 'flex items-center gap-1 text-xs text-slate-300';
            cb.innerHTML = `<input type="checkbox" value="opt_${idx}"> ${App.esc(label)}`;
            container.appendChild(cb);
        });
    },

    startPoll(pollId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        API.fetchAPI('/polls/' + eId + '/' + pollId + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'active' }) })
            .then(res => { if (res && res.success) { App.loadPolls(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Encuesta activada', showConfirmButton: false, timer: 2000 }); } });
    },

    closePoll(pollId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        API.fetchAPI('/polls/' + eId + '/' + pollId + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })
            .then(res => { if (res && res.success) { App.loadPolls(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Encuesta cerrada', showConfirmButton: false, timer: 2000 }); } });
    },

    deletePoll(pollId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        Swal.fire({ icon: 'warning', title: 'Eliminar encuesta?', text: 'Los votos también se eliminarán.', showCancelButton: true })
            .then(r => { if (!r.isConfirmed) return; API.fetchAPI('/polls/' + eId + '/' + pollId, { method: 'DELETE' }).then(res => { if (res && res.success) App.loadPolls(); }); });
    },

    showPollResults(pollId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        API.fetchAPI('/polls/' + eId + '/' + pollId + '/results').then(data => {
            const container = document.getElementById('poll-results-container');
            document.getElementById('poll-control-title').textContent = data.title || 'Resultados';
            let html = `<div class="flex gap-4 mb-3"><div class="card p-2 text-center"><p class="text-2xl font-bold text-white">${data.totalVotes}</p><p class="text-xs text-slate-400">Votos</p></div>`;
            if (data.type === 'trivia') html += `<div class="card p-2 text-center"><p class="text-2xl font-bold text-green-400">${data.correctCount}</p><p class="text-xs text-slate-400">Acertaron</p></div>`;
            html += '</div>';
            data.results.forEach(r => {
                const pct = r.percentage || 0;
                html += `<div class="card p-3"><div class="flex justify-between text-sm mb-1"><span>${App.esc(r.label)}</span><span>${r.count} (${pct}%)</span></div>
                    <div class="w-full bg-slate-700 rounded h-2"><div class="bg-blue-500 rounded h-2" style="width:${pct}%"></div></div></div>`;
            });
            if (data.recentVotes && data.recentVotes.length > 0) {
                html += '<p class="text-xs text-slate-500 mt-2">Últimos votos:</p>';
                data.recentVotes.forEach(v => {
                    html += `<div class="text-xs text-slate-400">${App.esc(v.guest_name || 'Anónimo')} · ${(v.voted_at || '').slice(0, 19)}</div>`;
                });
            }
            container.innerHTML = html;
            document.getElementById('gamification-polls').classList.add('hidden');
            document.getElementById('gamification-poll-control').classList.remove('hidden');
        });
    },

    loadLeaderboard() {
        const eId = App.state.event?.id;
        if (!eId) return;
        const container = document.getElementById('leaderboard-table-container');
        if (!container) return;
        API.fetchAPI('/leaderboard/' + eId).then(entries => {
            if (!entries || entries.length === 0) {
                container.innerHTML = '<p class="text-xs text-slate-500 italic">Sin datos de leaderboard aún</p>';
                return;
            }
            container.innerHTML = `<table class="w-full text-sm"><thead><tr class="text-left text-slate-400 border-b border-slate-700">
                <th class="py-1 px-2">#</th><th class="py-1 px-2">Nombre</th><th class="py-1 px-2">Organización</th>
                <th class="py-1 px-2 text-right">Puntos</th><th class="py-1 px-2 text-right">Insignias</th></tr></thead><tbody>
                ${entries.map((e, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                    return `<tr class="border-b border-slate-800"><td class="py-1 px-2">${medal}${i + 1}</td>
                        <td class="py-1 px-2 text-white">${App.esc(e.guest_name || 'Anónimo')}</td>
                        <td class="py-1 px-2 text-slate-400">${App.esc(e.organization || '')}</td>
                        <td class="py-1 px-2 text-right font-bold text-white">${e.points}</td>
                        <td class="py-1 px-2 text-right">${e.badges_count || 0}</td></tr>`;
                }).join('')}</tbody></table>`;
        }).catch(() => { container.innerHTML = '<p class="text-xs text-red-400">Error al cargar leaderboard</p>'; });
    },

    loadBadges() {
        const eId = App.state.event?.id;
        if (!eId) return;
        const container = document.getElementById('badge-list');
        if (!container) return;
        API.fetchAPI('/leaderboard/' + eId + '/badges').then(badges => {
            if (!badges || badges.length === 0) {
                container.innerHTML = '<p class="text-xs text-slate-500 italic">No hay insignias. Crea la primera.</p>';
                return;
            }
            container.innerHTML = badges.map(b =>
                `<div class="card p-3 flex justify-between items-center">
                    <div class="flex items-center gap-3"><span class="text-2xl">${b.icon || '🏆'}</span>
                    <div><p class="text-sm font-semibold text-white">${App.esc(b.name)}</p>
                    <p class="text-xs text-slate-500">${App.esc(b.description || '')} · ${b.earned_count || 0} obtenidas</p></div></div>
                    <button class="btn-secondary text-xs text-red-400" onclick="App.deleteBadge('${b.id}')">Eliminar</button>
                </div>`
            ).join('');
        }).catch(() => { container.innerHTML = '<p class="text-xs text-red-400">Error al cargar insignias</p>'; });
    },

    showBadgeCreator() {
        document.getElementById('badge-creator').classList.remove('hidden');
    },

    hideBadgeCreator() {
        document.getElementById('badge-creator').classList.add('hidden');
    },

    saveBadge() {
        const eId = App.state.event?.id;
        if (!eId) return;
        const name = document.getElementById('badge-creator-name').value.trim();
        if (!name) { Swal.fire({ icon: 'warning', title: 'Nombre requerido' }); return; }
        const icon = document.getElementById('badge-creator-icon').value.trim() || '🏆';
        const criteriaType = document.getElementById('badge-creator-criteria-type').value;
        const criteriaValue = parseInt(document.getElementById('badge-creator-criteria-value').value) || 5;
        const pointsReward = parseInt(document.getElementById('badge-creator-reward').value) || 0;
        const description = document.getElementById('badge-creator-description').value.trim();
        const body = { name, icon, description, points_reward: pointsReward, criteria: { type: criteriaType, value: criteriaValue } };
        API.fetchAPI('/leaderboard/' + eId + '/badges', { method: 'POST', body: JSON.stringify(body) }).then(res => {
            if (res && res.success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Insignia creada', showConfirmButton: false, timer: 2000 });
                this.hideBadgeCreator();
                this.loadBadges();
                document.getElementById('badge-creator-name').value = '';
                document.getElementById('badge-creator-description').value = '';
            }
        });
    },

    deleteBadge(badgeId) {
        const eId = App.state.event?.id;
        if (!eId) return;
        Swal.fire({ icon: 'warning', title: 'Eliminar insignia?', showCancelButton: true }).then(r => {
            if (!r.isConfirmed) return;
            API.fetchAPI('/leaderboard/' + eId + '/badges/' + badgeId, { method: 'DELETE' }).then(res => { if (res && res.success) App.loadBadges(); });
        });
    }
};

export default Gamification;
