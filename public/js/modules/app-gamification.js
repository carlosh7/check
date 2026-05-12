/**
 * Gamificación / Live Polling Module (C11-01)
 * Cargado bajo demanda para code splitting (P-03)
 */
import { API } from '../src/frontend/api.js';
import { LS, lazyLoad } from '../src/frontend/utils.js';

const GamificationModule = window.GamificationModule = {
    VERSION: '12.44.758',

    init(App) {
        this.App = App;
    },

    loadGamification() {
        this.App.loadPolls();
        this.App.loadLeaderboard();
        this.App.loadBadges();
    },

    switchGamificationTab(tab) {
        document.querySelectorAll('[data-gamification-subtab]').forEach(function(b) { b.classList.remove('active'); });
        var btn = document.querySelector('[data-gamification-subtab="' + tab + '"]');
        if (btn) btn.classList.add('active');
        ['polls', 'leaderboard', 'badges'].forEach(function(id) {
            var el = document.getElementById('gamification-' + id);
            if (el) el.classList.toggle('hidden', id !== tab);
        });
    },

    loadPolls() {
        var eId = this.App.state.event?.id;
        if (!eId) return;
        var container = document.getElementById('poll-list');
        if (!container) return;
        API.fetchAPI('/polls/' + eId).then(function(polls) {
            if (!polls || polls.length === 0) {
                container.innerHTML = '<p class="text-xs text-slate-500 italic">No hay encuestas. Crea la primera.</p>';
                return;
            }
            var html = '';
            polls.forEach(function(p) {
                var statusColor = p.status === 'active' ? 'text-green-400' : p.status === 'closed' ? 'text-red-400' : 'text-yellow-400';
                var statusLabel = p.status === 'active' ? 'Activa' : p.status === 'closed' ? 'Cerrada' : 'Borrador';
                html += '<div class="card p-3 flex justify-between items-center">';
                html += '<div><p class="text-sm font-semibold text-white">' + App.esc(p.title) + '</p>';
                html += '<p class="text-xs text-slate-500">' + p.type + ' · ' + p.points + ' pts · <span class="' + statusColor + '">' + statusLabel + '</span></p></div>';
                html += '<div class="flex gap-2">';
                if (p.status === 'draft') {
                    html += '<button class="btn-secondary text-xs" onclick="App.editPoll(\'' + p.id + '\')">Editar</button>';
                    html += '<button class="btn-primary text-xs" onclick="App.startPoll(\'' + p.id + '\')">Activar</button>';
                    html += '<button class="btn-secondary text-xs text-red-400" onclick="App.deletePoll(\'' + p.id + '\')">Eliminar</button>';
                } else if (p.status === 'active') {
                    html += '<button class="btn-primary text-xs" onclick="App.showPollResults(\'' + p.id + '\')">Resultados</button>';
                    html += '<button class="btn-secondary text-xs" onclick="App.closePoll(\'' + p.id + '\')">Cerrar</button>';
                } else {
                    html += '<button class="btn-secondary text-xs" onclick="App.showPollResults(\'' + p.id + '\')">Ver resultados</button>';
                    html += '<button class="btn-secondary text-xs" onclick="App.deletePoll(\'' + p.id + '\')">Eliminar</button>';
                }
                html += '</div></div>';
            });
            container.innerHTML = html;
        }).catch(function() { container.innerHTML = '<p class="text-xs text-red-400">Error al cargar encuestas</p>'; });
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
        this.App.loadSessionsSelect();
        this.App._initPollOptionListener();
        this.App._editingPollId = null;
    },

    editPoll(pollId) {
        var eId = this.App.state.event?.id;
        if (!eId) return;
        API.fetchAPI('/polls/' + eId + '/' + pollId).then(function(poll) {
            if (!poll) return;
            this.App._editingPollId = pollId;
            document.getElementById('poll-editor-title').value = poll.title || '';
            document.getElementById('poll-editor-description').value = poll.description || '';
            document.getElementById('poll-editor-type').value = poll.type || 'single';
            document.getElementById('poll-editor-points').value = poll.points || 10;
            document.getElementById('poll-editor-timer').value = poll.time_limit_seconds || 0;
            var optContainer = document.getElementById('poll-options-container');
            optContainer.innerHTML = '';
            if (poll.options && poll.options.length > 0) {
                poll.options.forEach(function(opt, idx) {
                    this.App.addPollOptionRow(opt.label || '', opt.is_correct === 1, idx);
                });
            }
            if (poll.type === 'trivia') {
                document.getElementById('poll-correct-answer-container').classList.remove('hidden');
                this.App.updateCorrectAnswerOptions();
            }
            document.getElementById('gamification-polls').classList.add('hidden');
            document.getElementById('gamification-poll-editor').classList.remove('hidden');
        });
    },

    // ... more functions
};

export default GamificationModule;
