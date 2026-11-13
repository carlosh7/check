// ===== Quiz en vivo (K1 — paridad Kahoot — v12.44.829) =====
// Página standalone: editor (con enlace compartido sin clave para quizzes publicados,
// misma política que la ruleta) + pantalla del anfitrión + vista del jugador.
// Sincronización: socket.io si está disponible + reserva por sondeo (version).

// ===== ESTADO =====
let API = '/api';
let quizId = null;          // uuid del quiz en la URL
let isPlayer = false;       // URL termina en /play
let quiz = null;            // {id,name,description,config}
let questions = [];         // [{id?,type,title,mediaUrl,timeLimit,pointsMode,answers:[{text,correct}]}]
let curQ = -1;              // pregunta abierta en el editor
let dirty = false;
let sound = true;
// juego en vivo (anfitrión)
let live = { sessionId: null, pin: null, st: null, timerId: null, pollId: null, revealed: false, soundOn: true, lastSeenVersion: 0 };
// jugador
let pl = { pin: null, playerId: null, nickname: null, st: null, pollId: null, answeredFor: null, avatar: '🐱' };
let socket = null;

const ANS_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']; // paridad Kahoot
const ANS_SHAPES = ['▲', '◆', '●', '■'];
const THEMES = [
  { name: 'Kahoot clásico', bg: '#1e1b4b', colors: ['#e21b3c', '#1368ce', '#d89e00', '#26890c'] },
  { name: 'Check Pro', bg: '#1e1b4b', colors: ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981'] },
  { name: 'Noche', bg: '#0f172a', colors: ['#64748b', '#94a3b8', '#fbbf24', '#38bdf8'] },
  { name: 'Bosque', bg: '#14532d', colors: ['#16a34a', '#84cc16', '#eab308', '#f97316'] },
  { name: 'Vino', bg: '#4a1220', colors: ['#e11d48', '#fb7185', '#f59e0b', '#a78bfa'] },
  { name: 'Océano', bg: '#0c4a6e', colors: ['#0ea5e9', '#22d3ee', '#fde047', '#fb7185'] },
  { name: 'Grafito', bg: '#18181b', colors: ['#e4e4e7', '#a1a1aa', '#facc15', '#22d3ee'] },
  { name: 'Ejecutivo', bg: '#16324f', colors: ['#4a7ba6', '#88b0cc', '#c9a227', '#2b4570'] }
];
const AVATARS = ['🐱', '🦊', '🐼', '🐸', '🦄', '🐙', '🦁', '🐨', '🐵', '🦉', '🐧', '🐷'];

// ===== UTILIDADES =====
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function() { t.classList.remove('show'); }, 2600); }
function getToken() { try { return localStorage.getItem('token') || null; } catch (e) { return null; } }

function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const tk = getToken();
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body }).then(function(r) {
    return r.json().then(function(j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; });
  });
}

// ===== SONIDOS (WebAudio sintetizado, sin archivos ni CDN) =====
let actx = null;
function ac() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function beep(freq, dur, type, vol, when) {
  if (!sound) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + (when || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.15));
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + (dur || 0.15) + 0.05);
}
function sTick() { beep(880, 0.07, 'square', 0.05); }
function sPop() { beep(520, 0.09, 'triangle', 0.1); beep(780, 0.1, 'triangle', 0.08, 0.06); }
function sCorrect() { beep(660, 0.12, 'sine', 0.12); beep(880, 0.14, 'sine', 0.12, 0.1); beep(1100, 0.2, 'sine', 0.12, 0.22); }
function sWrong() { beep(300, 0.18, 'sawtooth', 0.08); beep(200, 0.25, 'sawtooth', 0.08, 0.15); }
function sFanfare() { [523, 659, 784, 1047].forEach(function(f, i) { beep(f, 0.22, 'triangle', 0.14, i * 0.16); }); }

// ===== CONFETI (propio, sin CDN — vive dentro de la vista del podio) =====
function burstConfetti() {
  const cv = $('jsccc'); if (!cv) return;
  const host = $('live-podio');
  const box = host.getBoundingClientRect();
  cv.width = box.width; cv.height = box.height;
  const cx2 = cv.getContext('2d');
  const colors = ['#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];
  const parts = [];
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: box.width / 2 + (Math.random() - 0.5) * 220, y: box.height * 0.32,
      vx: (Math.random() - 0.5) * 9, vy: Math.random() * -8 - 2,
      w: 5 + Math.random() * 7, h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  const t0 = Date.now();
  (function frame() {
    const dt = Date.now() - t0;
    cx2.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(function(p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.rot += p.vr;
      cx2.save(); cx2.translate(p.x, p.y); cx2.rotate(p.rot);
      cx2.fillStyle = p.c; cx2.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx2.restore();
    });
    if (dt < 3800) requestAnimationFrame(frame);
    else cx2.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ===== ARRANQUE =====
function reloadPage() { window.location.reload(); }

function init() {
  const path = window.location.pathname;
  const m = path.match(/\/quiz\/([a-f0-9-]{36})(\/play)?/i);
  if (!m) { showError('Enlace de quiz inválido'); return; }
  quizId = m[1];
  isPlayer = !!m[2] || new URLSearchParams(window.location.search).get('player') === '1';
  if (isPlayer) initPlayer();
  else initHost();
}

function showError(msg) {
  $('loading').classList.add('hidden');
  const er = $('error'); er.style.display = 'flex';
  $('errmsg').textContent = msg;
}

// ════════════════════════════ EDITOR + ANFITRIÓN ════════════════════════════

function initHost() {
  // carga por JWT (SPA) o por enlace público (quiz publicado)
  const p = getToken()
    ? api('/quizzes/' + quizId)
    : api('/quizzes/' + quizId + '/public');
  p.then(function(q) {
    quiz = { id: q.id, name: q.name, description: q.description, config: q.config || {}, eventId: q.event_id };
    questions = (q.questions || []).map(function(x) {
      return { id: x.id, type: x.type, title: x.title, mediaUrl: x.mediaUrl || null, timeLimit: x.timeLimit || 20, pointsMode: x.pointsMode || 'standard', answers: (x.answers || []).map(function(a) { return { text: a.text, correct: !!a.correct }; }) };
    });
    $('loading').classList.add('hidden');
    $('editor').classList.remove('hidden');
    $('quiz-name').value = quiz.name || '';
    applyConfigUI();
    renderThemes();
    renderAnsColors();
    renderQList();
    previewStage();
  }).catch(function(e) {
    if (/publicados/i.test(e.message)) showError('Este quiz no está publicado. Ábrelo desde la app (Configuración del evento → Quiz) y pulsa Comenzar, o publícalo para usar el enlace compartido.');
    else showError(e.message || 'Error al cargar el quiz');
  });
}

function cfgVal(key, def) { return quiz && quiz.config && quiz.config[key] !== undefined ? quiz.config[key] : def; }

function applyConfigUI() {
  const c = quiz.config || {};
  $('cfg-sq').checked = c.show_question_on_device === true; // Kahoot clásico: apagado
  $('cfg-snd').checked = c.play_sounds !== false;
  $('cfg-rct').checked = c.reactions !== false;
  $('cfg-tt').checked = c.show_title !== false;
  $('cfg-title').value = c.title || '';
  $('cfg-sd').checked = c.show_desc === true;
  $('cfg-desc').value = c.description || '';
  const bg = c.page_background_color || THEMES[0].bg;
  $('c-bg').value = bg; $('v-bg').textContent = bg;
  const cs = c.answer_colors || ANS_COLORS;
  cs.forEach(function(col, i) { const inp = $('c-ans-' + i); if (inp) inp.value = col; });
  const txt = c.text_color || '#ffffff';
  $('c-txt').value = txt; $('v-txt').textContent = txt;
}

function collectConfig() {
  return {
    show_question_on_device: $('cfg-sq').checked,
    play_sounds: $('cfg-snd').checked,
    reactions: $('cfg-rct').checked,
    show_title: $('cfg-tt').checked,
    title: $('cfg-title').value.trim(),
    show_desc: $('cfg-sd').checked,
    description: $('cfg-desc').value.trim(),
    page_background_color: $('c-bg').value,
    answer_colors: [0, 1, 2, 3].map(function(i) { return $('c-ans-' + i).value; }),
    text_color: $('c-txt').value
  };
}

// ── pestañas ──
function switchTab(name, el) {
  ['questions', 'options', 'design'].forEach(function(t) {
    $('tab-' + t).classList.toggle('hidden', t !== name);
  });
  document.querySelectorAll('.qz-sidebar__menu-item').forEach(function(m) { m.classList.remove('active'); });
  if (el) el.classList.add('active');
}

// ── preguntas ──
function renderQList() {
  const box = $('qlist');
  if (!questions.length) {
    box.innerHTML = '<p class="qz-hint" style="margin:0">Sin preguntas todavía. Agrega la primera con los botones ＋ de arriba.</p>';
    return;
  }
  box.innerHTML = questions.map(function(q, i) {
    return '<div class="qz-qcard' + (q.type === 'true_false' ? ' qz-qcard--vf' : '') + (i === curQ ? ' active' : '') + '" data-act="call" data-call="openQ" data-a1="' + i + '">' +
      '<span class="qz-qcard__num">' + (i + 1) + '</span>' +
      '<div class="qz-qcard__body"><div class="qz-qcard__title">' + esc(q.title || '(sin texto)') + '</div>' +
      '<div class="qz-qcard__meta">' + (q.type === 'true_false' ? 'V/F' : 'Quiz') + ' · ' + q.timeLimit + 's · ' + (q.pointsMode === 'double' ? 'x2' : q.pointsMode === 'none' ? 'sin pts' : 'std') + '</div></div></div>';
  }).join('');
}

function addQuestion(type) {
  const q = type === 'true_false'
    ? { type: 'true_false', title: '', timeLimit: 20, pointsMode: 'standard', answers: [{ text: 'Verdadero', correct: true }, { text: 'Falso', correct: false }] }
    : { type: 'quiz', title: '', timeLimit: 20, pointsMode: 'standard', answers: [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] };
  questions.push(q);
  curQ = questions.length - 1;
  dirty = true;
  renderQList(); renderQForm(); previewStage();
  const f = $('qform-title'); if (f) f.focus();
}

function openQ(i) {
  curQ = parseInt(i);
  renderQList(); renderQForm();
}

function closeQForm() { curQ = -1; renderQList(); renderQForm(); previewStage(); }

function currentQ() { return curQ >= 0 && curQ < questions.length ? questions[curQ] : null; }

function renderQForm() {
  const q = currentQ();
  const form = $('qform');
  if (!q) { form.classList.add('hidden'); return; }
  form.classList.remove('hidden');
  $('qform-num').textContent = String(curQ + 1);
  $('qform-type').value = q.type;
  $('qform-title').value = q.title || '';
  $('qform-time').value = String(q.timeLimit || 20);
  $('qform-points').value = q.pointsMode || 'standard';
  renderQAnswers();
  $('qform-add-answer').style.display = q.type === 'true_false' ? 'none' : 'block';
}

function renderQAnswers() {
  const q = currentQ(); if (!q) return;
  const box = $('qform-answers');
  box.innerHTML = q.answers.map(function(a, i) {
    const removable = q.type !== 'true_false' && q.answers.length > 2;
    return '<div class="qz-answer-row">' +
      '<span class="qz-ans-dot" style="background:' + ANS_COLORS[i % 4] + '">' + ANS_SHAPES[i % 4] + '</span>' +
      '<input id="qa-' + i + '" maxlength="150" placeholder="Respuesta ' + (i + 1) + '" value="' + esc(a.text) + '" data-act="input" data-call="onAnswerInput" data-a1="' + i + '">' +
      '<button class="qz-ans-ok' + (a.correct ? ' on' : '') + '" title="Marcar como correcta" data-act="call" data-call="toggleCorrect" data-a1="' + i + '">✔</button>' +
      (removable ? '<button class="qz-ans-del" title="Quitar" data-act="call" data-call="delAnswer" data-a1="' + i + '">✕</button>' : '') +
      '</div>';
  }).join('');
}

function onAnswerInput(i) {
  const q = currentQ(); if (!q) return;
  // DelegatedEvents pasa solo los args de data-* (no el nodo): leer por ID
  const el = $('qa-' + i); if (!el) return;
  q.answers[parseInt(i)].text = el.value;
  dirty = true;
  previewStage();
}

function toggleCorrect(i) {
  const q = currentQ(); if (!q) return;
  const idx = parseInt(i);
  q.answers[idx].correct = !q.answers[idx].correct;
  dirty = true;
  renderQAnswers(); previewStage();
}

function delAnswer(i) {
  const q = currentQ(); if (!q || q.type === 'true_false') return;
  q.answers.splice(parseInt(i), 1);
  dirty = true;
  renderQAnswers(); previewStage();
}

function addAnswer() {
  const q = currentQ(); if (!q || q.type === 'true_false') return;
  if (q.answers.length >= 4) { toast('Máximo 4 respuestas'); return; }
  q.answers.push({ text: '', correct: false });
  dirty = true;
  renderQAnswers();
  const last = $('qa-' + (q.answers.length - 1)); if (last) last.focus();
}

function onTypeChange(el) {
  const q = currentQ(); if (!q) return;
  const t = el ? el.value : $('qform-type').value;
  if (t === q.type) return;
  q.type = t;
  if (t === 'true_false') q.answers = [{ text: 'Verdadero', correct: true }, { text: 'Falso', correct: false }];
  else q.answers = [{ text: q.answers[0] ? q.answers[0].text : '', correct: q.answers[0] ? q.answers[0].correct : false }, { text: q.answers[1] ? q.answers[1].text : '', correct: q.answers[1] ? q.answers[1].correct : false }];
  dirty = true;
  renderQForm(); previewStage();
}

function delQuestion() {
  if (curQ < 0) return;
  if (!confirm('¿Eliminar la pregunta ' + (curQ + 1) + '?')) return;
  questions.splice(curQ, 1);
  dirty = true;
  closeQForm();
}

function dupQuestion() {
  const q = currentQ(); if (!q) return;
  const copy = JSON.parse(JSON.stringify(q));
  copy.id = null;
  questions.splice(curQ + 1, 0, copy);
  curQ = curQ + 1;
  dirty = true;
  renderQList(); renderQForm(); previewStage();
}

// tomar los valores del formulario hacia el modelo (sin guardar aún)
function syncQForm() {
  const q = currentQ(); if (!q) return;
  q.title = $('qform-title').value;
  q.timeLimit = parseInt($('qform-time').value) || 20;
  q.pointsMode = $('qform-points').value;
  q.answers.forEach(function(a, i) { const el = $('qa-' + i); if (el) a.text = el.value; });
}

function saveQuestion() {
  syncQForm();
  const q = currentQ(); if (!q) return;
  if (!q.title.trim()) { toast('La pregunta necesita texto'); return; }
  if (!q.answers.some(function(a) { return a.correct; })) { toast('Marca al menos una respuesta correcta'); return; }
  if (q.answers.some(function(a) { return !a.text.trim(); })) { toast('Toda respuesta necesita texto'); return; }
  dirty = true;
  closeQForm();
  toast('Pregunta lista. Recuerda pulsar 💾 Guardar.');
}

function applyToAll() {
  const t = parseInt($('qform-time').value) || 20;
  const p = $('qform-points').value;
  questions.forEach(function(q) { q.timeLimit = t; q.pointsMode = p; });
  dirty = true;
  renderQList();
  toast('Tiempo y puntos aplicados a todas las preguntas');
}

// ── diseño ──
function renderThemes() {
  const box = $('theme-ps');
  if (!box) return;
  box.innerHTML = THEMES.map(function(t, i) {
    return '<div class="qz-theme-dot" title="' + esc(t.name) + '" style="background:linear-gradient(135deg,' + t.colors.join(',') + ')" data-act="call" data-call="applyTheme" data-a1="' + i + '"></div>';
  }).join('');
}

function applyTheme(i) {
  const t = THEMES[parseInt(i)];
  $('c-bg').value = t.bg; $('v-bg').textContent = t.bg;
  t.colors.forEach(function(c, j) { const inp = $('c-ans-' + j); if (inp) { inp.value = c; } });
  dirty = true;
  previewStage();
}

function renderAnsColors() {
  const box = $('ans-cs');
  if (!box) return;
  const cs = (quiz.config && quiz.config.answer_colors) || ANS_COLORS;
  box.innerHTML = cs.map(function(c, i) {
    return '<div class="color-input"><span>' + ANS_SHAPES[i] + '</span><input type="color" id="c-ans-' + i + '" value="' + esc(c) + '" data-act="call" data-call="previewStage"></div>';
  }).join('');
}

// ── preview del escenario ──
function previewStage() {
  const c = quiz ? collectConfigStage() : collectConfig();
  const stage = $('stage');
  stage.style.background = c.page_background_color || THEMES[0].bg;
  const tt = $('cfg-tt').checked && $('cfg-title').value.trim();
  const sd = $('cfg-sd').checked && $('cfg-desc').value.trim();
  $('intro-title').textContent = tt || quiz.name || 'Quiz en vivo';
  $('intro-desc').textContent = sd || '';
  $('intro-desc').style.display = sd ? 'block' : 'none';
  const q = currentQ();
  const box = $('intro-preview');
  if (!q) {
    box.innerHTML = '<div class="qz-preview__shape" style="background:' + c.answer_colors[0] + '">▲</div>' +
      '<div class="qz-preview__shape" style="background:' + c.answer_colors[1] + '">◆</div>' +
      '<div class="qz-preview__shape" style="background:' + c.answer_colors[2] + '">●</div>' +
      '<div class="qz-preview__shape" style="background:' + c.answer_colors[3] + '">■</div>';
    return;
  }
  syncQForm();
  const qq = currentQ();
  const n = qq.type === 'true_false' ? 2 : 4;
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<div class="qz-preview__shape" style="background:' + c.answer_colors[i] + '">' + ANS_SHAPES[i] + ' ' + esc(qq.answers[i] ? qq.answers[i].text : '') + '</div>';
  }
  box.innerHTML = html;
}

// versión del collectConfig segura durante el juego (los inputs del editor siguen ahí)
function collectConfigStage() {
  try { return collectConfig(); } catch (e) { return (quiz && quiz.config) || {}; }
}

// ── guardar ──
function quizPayload(status) {
  return {
    name: $('quiz-name').value.trim() || 'Quiz sin nombre',
    description: $('cfg-desc').value.trim(),
    config: collectConfig(),
    status: status,
    questions: questions.map(function(q) {
      return { type: q.type, title: q.title.trim(), mediaUrl: q.mediaUrl, timeLimit: q.timeLimit, pointsMode: q.pointsMode, answers: q.answers.map(function(a) { return { text: a.text.trim(), correct: a.correct }; }) };
    })
  };
}

function saveQuiz(publish) {
  if (!$('quiz-name').value.trim()) { toast('Ponle un nombre al quiz'); return Promise.reject(new Error('nombre')); }
  const bad = questions.findIndex(function(q) { return !q.title.trim() || !q.answers.some(function(a) { return a.correct; }) || q.answers.some(function(a) { return !a.text.trim(); }); });
  if (bad >= 0) { curQ = bad; renderQList(); renderQForm(); toast('La pregunta ' + (bad + 1) + ' está incompleta'); return Promise.reject(new Error('incompleta')); }
  const body = quizPayload(publish ? 'published' : undefined);
  const logged = !!getToken();
  const p = logged
    ? api('/quizzes/' + quizId, { method: 'PUT', body: JSON.stringify(body) })
    : api('/quizzes/' + quizId + '/public-config', { method: 'PUT', body: JSON.stringify({ name: body.name, description: body.description, config: body.config, questions: body.questions }) });
  return p.then(function() {
    quiz.name = body.name;
    quiz.config = body.config;
    dirty = false;
    if (publish) quiz.status = 'published';
    toast('💾 Quiz guardado');
  });
}

// ── partida en vivo (anfitrión) ──

function startGame() {
  const finish = function() {
    const logged = !!getToken();
    const p = logged
      ? api('/quizzes/' + quizId + '/sessions', { method: 'POST', body: '{}' })
      : api('/quizzes/' + quizId + '/public-session', { method: 'POST', body: '{}' });
    p.then(function(r) {
      enterLive(r.id, r.pin);
    }).catch(function(e) { toast(e.message || 'No se pudo abrir la partida'); });
  };
  // guardar siempre antes de abrir (auto-publica como Kahoot al lanzar)
  saveQuiz(true).then(finish).catch(function(e) { if (e && (e.message === 'nombre' || e.message === 'incompleta')) return; finish(); });
}

function enterLive(sessionId, pin) {
  live.sessionId = sessionId; live.pin = pin;
  $('stage-intro').classList.add('hidden');
  $('live').classList.remove('hidden');
  showLiveView('lobby');
  $('lobby-pin').textContent = pin;
  // la página del anfitrión vive en /{slug}/quiz/{id} — el jugador está en la misma ruta + /play
  const joinUrl = window.location.origin + window.location.pathname.replace(/\/$/, '') + '/play?pin=' + pin;
  $('lobby-url').textContent = window.location.host + window.location.pathname.replace(/\/$/, '') + '/play';
  $('lobby-qr').src = API + '/quizzes/' + quizId + '/qr?pin=' + encodeURIComponent(pin) + '&size=340';
  $('lobby-qr').dataset.url = joinUrl;
  sPop();
  startHostPolling();
  connectSocket(sessionId);
  fetchHostStateOnce();
}

function showLiveView(name) {
  ['lobby', 'question', 'reveal', 'scoreboard', 'podio'].forEach(function(v) {
    $('live-' + v).classList.toggle('hidden', v !== name);
  });
  $('ctl-reveal').style.display = name === 'question' ? 'block' : 'none';
}

// sondeo del anfitrión: refresca SIEMPRE la vista corriente (v12.44.830: antes solo
// al cambiar versión, y el contador de la sala quedaba congelado cuando nadie más
// cambiaba el estado); durante pregunta trae conteos en vivo (1.2s)
function startHostPolling() {
  stopTimers();
  live.pollId = setInterval(function() {
    api('/quizzes/sessions/' + live.sessionId + '/host-state').then(function(st) {
      renderHostState(st);
      // los cambios de estado (lobby→question→reveal→…) se manejan por versión
      if (st.version !== live.lastSeenVersion) {
        live.lastSeenVersion = st.version;
        enterViewFromState(st);
      }
    }).catch(function(e) {
      if (/no encontrada/i.test(e.message)) { toast('La partida se cerró'); exitGame(); }
    });
  }, 1200);
}

function stopTimers() {
  if (live.pollId) { clearInterval(live.pollId); live.pollId = null; }
  if (live.timerId) { clearInterval(live.timerId); live.timerId = null; }
  if (pl.pollId) { clearInterval(pl.pollId); pl.pollId = null; }
}

function renderHostState(st) {
  live.st = st;
  if ($('live-lobby').classList.contains('hidden') === false) {
    // lobby: refresca jugadores
    $('lobby-count').textContent = st.playersCount;
    $('lobby-players').innerHTML = (st.players || []).map(function(p) {
      return '<span class="qz-lobby__chip">' + esc(p.nickname) + '</span>';
    }).join('');
    return;
  }
  if (st.status === 'question' && !$('live-question').classList.contains('hidden')) {
    renderQuestionCounts(st);
  }
  if (st.status === 'reveal' && !$('live-reveal').classList.contains('hidden')) {
    renderRevealCounts(st);
  }
}

function enterViewFromState(st) {
  // reacción a cambios de estado (socket o sondeo)
  if (st.status === 'lobby') {
    showLiveView('lobby');
    $('lobby-pin').textContent = st.pin;
    $('lobby-count').textContent = st.playersCount;
    $('lobby-players').innerHTML = (st.players || []).map(function(p) { return '<span class="qz-lobby__chip">' + esc(p.nickname) + '</span>'; }).join('');
  } else if (st.status === 'question') {
    showLiveView('question');
    renderQuestionFull(st);
    startHostTimer(st);
  } else if (st.status === 'reveal') {
    stopQuestionTimer();
    showLiveView('reveal');
    renderRevealFull(st);
    sCorrect();
  } else if (st.status === 'scoreboard') {
    showLiveView('scoreboard');
    renderScoreboard(st);
    $('btn-next').textContent = (st.currentIndex + 1 < st.totalQuestions) ? '➡️ Siguiente pregunta' : '🏆 Ver podio';
  } else if (st.status === 'ended') {
    showLiveView('podio');
    renderPodio(st);
  }
}

function renderQuestionFull(st) {
  $('q-progress').textContent = (st.currentIndex + 1) + ' / ' + st.totalQuestions;
  $('live-qtitle').textContent = st.question.title;
  const cs = collectConfigStage().answer_colors || ANS_COLORS;
  $('live-answers').innerHTML = st.question.answers.map(function(a, i) {
    return '<div class="qz-answer" id="la-' + i + '" style="background:' + (cs[i % 4] || ANS_COLORS[i % 4]) + '">' +
      '<span class="qz-answer__shape">' + ANS_SHAPES[i % 4] + '</span>' + esc(a.text) +
      '<span class="qz-answer__count" id="lac-' + i + '" style="display:none">0</span></div>';
  }).join('');
  live.revealed = false;
}

function renderQuestionCounts(st) {
  if (!st.answerCounts) return;
  st.answerCounts.forEach(function(n, i) {
    const el = $('lac-' + i);
    if (el) { el.style.display = 'block'; el.textContent = n; }
  });
}

function startHostTimer(st) {
  stopQuestionTimer();
  const total = (st.question.timeLimit || 20) * 1000;
  const startedAt = st.questionStartedAt ? new Date(st.questionStartedAt).getTime() : Date.now();
  const ring = $('timer-ring');
  const CIRC = 213.6;
  let lastTick = -1;
  live.timerId = setInterval(function() {
    const left = Math.max(total - (Date.now() - startedAt), 0);
    const secs = Math.ceil(left / 1000);
    $('timer-num').textContent = String(secs);
    ring.style.strokeDashoffset = String(CIRC * (1 - left / total));
    ring.style.stroke = secs <= 5 ? '#f87171' : '#34d399';
    if (secs <= 5 && secs !== lastTick && secs > 0) { lastTick = secs; sTick(); }
    if (left <= 0) {
      stopQuestionTimer();
      if (!live.revealed) { live.revealed = true; hostReveal(); }
    }
  }, 200);
}
function stopQuestionTimer() { if (live.timerId) { clearInterval(live.timerId); live.timerId = null; } }

function renderRevealFull(st) {
  $('reveal-title').textContent = st.question.title;
  const cs = collectConfigStage().answer_colors || ANS_COLORS;
  const counts = st.answerCounts || [];
  const maxCount = Math.max.apply(null, counts.concat([1]));
  $('reveal-answers').innerHTML = st.question.answers.map(function(a, i) {
    return '<div class="qz-answer' + (a.correct ? ' qz-answer--correct' : ' qz-answer--dim') + '" style="background:' + (cs[i % 4] || ANS_COLORS[i % 4]) + '">' +
      '<span class="qz-answer__shape">' + ANS_SHAPES[i % 4] + '</span>' + esc(a.text) +
      '<span class="qz-answer__count">' + (counts[i] || 0) + '</span>' +
      '<span class="qz-answer__bar" style="width:' + Math.round((counts[i] || 0) / maxCount * 100) + '%"></span></div>';
  }).join('');
  $('reveal-fastest').textContent = st.fastest
    ? ('⚡ El más rápido: ' + st.fastest.nickname + ' (' + Math.round(st.fastest.ms / 100) / 10 + 's) · ✅ ' + (st.correctCount || 0) + ' aciertos')
    : ('✅ ' + (st.correctCount || 0) + ' aciertos');
  $('ctl-reveal').style.display = 'none';
}

function renderRevealCounts(st) { /* los conteos ya llegan en renderRevealFull */ }

function renderScoreboard(st) {
  const top = st.top || [];
  const maxPts = Math.max.apply(null, top.map(function(p) { return p.points; }).concat([1]));
  $('scoreboard-list').innerHTML = top.map(function(p) {
    return '<div class="qz-score-row">' +
      '<span class="qz-score-row__rank">' + p.rank + '</span>' +
      '<span class="qz-score-row__nick">' + esc(p.nickname) + (p.streak > 1 ? ' 🔥' + p.streak : '') + '</span>' +
      '<span class="qz-score-row__pts">' + p.points + '</span>' +
      '</div>' +
      '<div class="qz-score-row__bar-wrap"><div class="qz-score-row__bar" style="width:' + Math.round(p.points / maxPts * 100) + '%"></div></div>';
  }).join('');
}

function renderPodio(st) {
  const top = st.top || scoreboardFromState();
  const cols = [
    { pos: 2, medal: '🥈' }, { pos: 1, medal: '🥇' }, { pos: 3, medal: '🥉' }
  ];
  $('podio-cols').innerHTML = cols.map(function(c) {
    const p = (top || []).find(function(x) { return x.rank === c.pos; });
    return '<div class="qz-podio__col qz-podio__col--' + c.pos + '">' +
      '<span>' + c.medal + '</span>' +
      '<span class="qz-podio__nick">' + esc(p ? p.nickname : '—') + '</span>' +
      '<span class="qz-podio__pts">' + (p ? p.points : 0) + ' pts</span>' +
      '<div class="qz-podio__block">' + c.pos + '</div></div>';
  }).join('');
  sFanfare();
  burstConfetti();
}
function scoreboardFromState() { return (live.st && live.st.top) || []; }

// controles del anfitrión
function hostShowQuestion(i) {
  api('/quizzes/sessions/' + live.sessionId + '/show-question', { method: 'POST', body: JSON.stringify({ index: parseInt(i) }) })
    .then(function() { fetchHostStateOnce(); })
    .catch(function(e) { toast(e.message); });
}
function hostReveal() {
  if (live.st && live.st.status !== 'question') return;
  api('/quizzes/sessions/' + live.sessionId + '/reveal', { method: 'POST', body: '{}' })
    .then(function() { fetchHostStateOnce(); }).catch(function(e) { toast(e.message); });
}
function hostScoreboard() {
  api('/quizzes/sessions/' + live.sessionId + '/scoreboard', { method: 'POST', body: '{}' })
    .then(function() { fetchHostStateOnce(); }).catch(function(e) { toast(e.message); });
}
function hostNext() {
  const st = live.st;
  if (!st) return;
  if (st.currentIndex + 1 < st.totalQuestions) {
    hostShowQuestion(st.currentIndex + 1);
  } else {
    api('/quizzes/sessions/' + live.sessionId + '/podio', { method: 'POST', body: '{}' })
      .then(function() { fetchHostStateOnce(); }).catch(function(e) { toast(e.message); });
  }
}
function fetchHostStateOnce() {
  api('/quizzes/sessions/' + live.sessionId + '/host-state').then(function(st) {
    live.st = st;
    enterViewFromState(st);
  }).catch(function() {});
}

function newSession() {
  if (live.sessionId) api('/quizzes/sessions/' + live.sessionId, { method: 'DELETE' }).catch(function() {});
  stopTimers();
  startGame();
}

function exitGame() {
  stopTimers();
  if (live.sessionId) {
    api('/quizzes/sessions/' + live.sessionId, { method: 'DELETE' }).catch(function() {});
  }
  live.sessionId = null; live.pin = null; live.st = null;
  $('live').classList.add('hidden');
  $('stage-intro').classList.remove('hidden');
  previewStage();
}

function toggleFS() {
  const el = document.documentElement;
  if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(function() {}); }
  else if (document.exitFullscreen) document.exitFullscreen();
}

function toggleSnd() {
  sound = !sound;
  const b = $('ctl-snd'); if (b) b.textContent = sound ? '🔊' : '🔇';
}

function exportCsv() {
  const doDl = function(tk) {
    fetch(API + '/quizzes/' + quizId + '/export-csv', { headers: tk ? { 'Authorization': 'Bearer ' + tk } : {} })
      .then(function(r) { if (!r.ok) throw new Error('No se pudo exportar'); return r.blob(); })
      .then(function(b) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'quiz_resultados.csv';
        a.click();
      }).catch(function(e) { toast(e.message || 'Inicia sesión en la app para exportar'); });
  };
  const tk = getToken();
  if (!tk) { toast('Inicia sesión en la app para exportar CSV'); return; }
  doDl(tk);
}

// ── socket.io (acelera la reserva por sondeo; si falla, el sondeo sigue solo) ──
function connectSocket(sessionId) {
  try {
    if (typeof io !== 'function') return;
    socket = io({ transports: ['websocket', 'polling'] });
    // el servidor ya expone 'join_event' para unirse a salas (src/socket/index.js):
    // la sala es 'quiz:{sessionId}' y también sirve para presencia sin romper nada
    socket.on('connect', function() { socket.emit('join_event', 'quiz:' + sessionId); });
    socket.on('quiz_state', function(msg) {
      if (!msg || msg.sessionId !== sessionId) return;
      fetchHostStateOnce();
    });
    socket.on('quiz_reaction', function(msg) { if (msg) pushReaction(msg.nickname, msg.emoji); });
    socket.on('quiz_player_joined', function(msg) { if (msg && msg.nickname) sPop(); });
  } catch (e) { /* sin socket, solo sondeo */ }
}

function pushReaction(nickname, emoji) {
  if ($('cfg-rct') && !$('cfg-rct').checked) return;
  const layer = $('reactions-layer'); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'qz-reaction';
  el.innerHTML = emoji + '<small>' + esc(nickname || '') + '</small>';
  layer.appendChild(el);
  while (layer.children.length > 8) layer.removeChild(layer.firstChild);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3300);
}

// ════════════════════════════ JUGADOR ════════════════════════════

function plSave() {
  try { sessionStorage.setItem('quiz_player', JSON.stringify({ pin: pl.pin, playerId: pl.playerId, nickname: pl.nickname })); } catch (e) {}
}
function plLoad() {
  try { return JSON.parse(sessionStorage.getItem('quiz_player') || 'null'); } catch (e) { return null; }
}
function plClear() { try { sessionStorage.removeItem('quiz_player'); } catch (e) {} }

function showPlView(name) {
  ['join', 'wait', 'game', 'between', 'podio'].forEach(function(v) {
    $('pl-' + v).classList.toggle('hidden', v !== name);
  });
}

function initPlayer() {
  $('loading').classList.add('hidden');
  $('player').classList.remove('hidden');
  pl.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  $('pl-avatar').textContent = pl.avatar;
  const saved = plLoad();
  const urlPin = new URLSearchParams(window.location.search).get('pin');
  if (saved && saved.playerId) {
    // reintento de sesión (mismo navegador/pestaña): validar contra el servidor
    pl.pin = saved.pin; pl.playerId = saved.playerId; pl.nickname = saved.nickname;
    api('/quizzes/public/session/' + encodeURIComponent(saved.pin) + '/state?playerId=' + encodeURIComponent(saved.playerId))
      .then(function(st) {
        if (st.me) { playerEnterGame(); } else { plClear(); showPlView('join'); }
      })
      .catch(function() { plClear(); showPlView('join'); });
    return;
  }
  if (urlPin) $('pl-pin').value = urlPin;
  showPlView('join');
  $('pl-nick').focus();
}

function playerJoin() {
  const pin = $('pl-pin').value.trim();
  const nick = $('pl-nick').value.trim();
  const err = $('pl-join-err');
  err.textContent = '';
  if (!/^\d{7}$/.test(pin)) { err.textContent = 'El PIN tiene 7 dígitos'; return; }
  if (!nick) { err.textContent = 'Escribe un apodo'; return; }
  api('/quizzes/public/session/' + encodeURIComponent(pin) + '/join', { method: 'POST', body: JSON.stringify({ nickname: nick }) })
    .then(function(r) {
      pl.pin = pin; pl.playerId = r.playerId; pl.nickname = r.nickname;
      plSave();
      sPop();
      playerEnterGame();
    })
    .catch(function(e) { err.textContent = e.message || 'No se pudo unir'; });
}

function playerEnterGame() {
  $('pl-nick-big').textContent = pl.nickname;
  $('pl-avatar').textContent = pl.avatar;
  showPlView('wait');
  startPlayerPolling();
  connectPlayerSocket();
}

function startPlayerPolling() {
  if (pl.pollId) clearInterval(pl.pollId);
  let lastVersion = -1;
  let socketLinked = false;
  pl.pollId = setInterval(function() {
    api('/quizzes/public/session/' + encodeURIComponent(pl.pin) + '/state?playerId=' + encodeURIComponent(pl.playerId))
      .then(function(st) {
        pl.st = st;
        if (!socketLinked && st.sessionId) {
          socketLinked = true;
          connectPlayerSocket(st.sessionId);
        }
        if (st.version !== lastVersion) { lastVersion = st.version; renderPlayerState(st); }
      })
      .catch(function(e) {
        if (/no encontrada/i.test(e.message)) { plClear(); stopTimers(); showPlView('join'); toast('La partida terminó'); }
      });
  }, 1200);
}

function renderPlayerState(st) {
  const me = st.me;
  if (me) {
    $('pl-points').textContent = me.points;
  }
  if (st.status === 'lobby') { showPlView('wait'); return; }
  if (st.status === 'question') {
    if (me && me.lastAnswer && pl.answeredFor === st.question.id) {
      // ya respondí: mantener feedback hasta el revelado
      return;
    }
    showPlView('game');
    renderPlayerQuestion(st);
    return;
  }
  if (st.status === 'reveal') {
    pl.answeredFor = null;
    showPlView('between');
    renderMyRank(st, me);
    return;
  }
  if (st.status === 'scoreboard') { showPlView('between'); renderMyRank(st, me); return; }
  if (st.status === 'ended') {
    stopTimers();
    showPlView('podio');
    renderPlayerPodio(st, me);
  }
}

function renderPlayerQuestion(st) {
  const q = st.question;
  const showText = st.cfg && st.cfg.showQuestionOnDevice;
  $('pl-progress').textContent = (st.currentIndex + 1) + ' / ' + st.totalQuestions;
  $('pl-qtitle').textContent = showText ? q.title : '¡Mira la pantalla! 👀';
  $('pl-qtitle').style.display = showText ? 'block' : 'none';
  const box = $('pl-answers');
  box.classList.toggle('qz-pl-answers--vf', q.type === 'true_false');
  const vfIcons = ['✔', '✗'];
  box.innerHTML = q.answers.map(function(a, i) {
    const isVf = q.type === 'true_false';
    // en V/F el texto es siempre visible (como Kahoot); en quiz, solo con la opción activada
    const label = isVf ? esc(a.text) : (showText ? esc(a.text) : '');
    const shape = isVf ? vfIcons[i] : ANS_SHAPES[i % 4];
    return '<button class="qz-pl-answer" style="background:' + ANS_COLORS[i % 4] + '" data-act="call" data-call="playerAnswer" data-a1="' + i + '">' +
      '<span class="qz-answer__shape">' + shape + '</span>' + label + '</button>';
  }).join('');
  $('pl-feedback').classList.add('hidden');
  pl.answeredFor = null;
}

function playerAnswer(i) {
  const st = pl.st; if (!st || !st.question) return;
  const buttons = document.querySelectorAll('#pl-answers .qz-pl-answer');
  buttons.forEach(function(b) { b.disabled = true; });
  api('/quizzes/public/answer', { method: 'POST', body: JSON.stringify({ pin: pl.pin, playerId: pl.playerId, questionId: st.question.id, answerIndex: parseInt(i) }) })
    .then(function(r) {
      pl.answeredFor = st.question.id;
      $('pl-points').textContent = r.totalPoints;
      const fb = $('pl-feedback');
      fb.classList.remove('hidden');
      if (r.isCorrect) {
        $('pl-fb-icon').textContent = '✅';
        $('pl-fb-text').textContent = '+' + (r.points + r.bonus) + (r.bonus > 0 ? ' 🔥racha ' + r.streak : '');
        $('pl-fb-text').className = 'qz-pl-fb-text qz-pl-fb-text--ok';
        sCorrect();
      } else {
        $('pl-fb-icon').textContent = '❌';
        $('pl-fb-text').textContent = 'Esta vez no…';
        $('pl-fb-text').className = 'qz-pl-fb-text qz-pl-fb-text--bad';
        sWrong();
      }
    })
    .catch(function(e) {
      toast(e.message || 'No se pudo enviar');
      buttons.forEach(function(b) { b.disabled = false; });
    });
}

function renderMyRank(st, me) {
  const box = $('pl-myrank');
  if (!me) { box.innerHTML = '—'; return; }
  const medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : '';
  box.innerHTML = medal + ' Posición ' + me.rank + ' · ' + me.points + ' pts' +
    (me.streak > 1 ? ' · 🔥 racha ' + me.streak : '') +
    '<small>' + esc(me.nickname) + '</small>';
}

function renderPlayerPodio(st, me) {
  const box = $('pl-podio-me');
  if (me) {
    const medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : '🎉';
    box.innerHTML = medal + ' Quedaste en posición ' + me.rank + ' con ' + me.points + ' pts' +
      '<small>' + esc(me.nickname) + '</small>';
  } else {
    box.innerHTML = '¡Gracias por jugar!';
  }
  $('pl-podio-top').innerHTML = (st.top || []).map(function(p) {
    return '<div class="qz-pl-top-row"><span>' + p.rank + '. ' + esc(p.nickname) + '</span><b>' + p.points + '</b></div>';
  }).join('');
  sFanfare();
}

function playerReact(emoji) {
  const st = pl.st; if (!st) return;
  api('/quizzes/public/session/' + encodeURIComponent(pl.pin) + '/react', { method: 'POST', body: JSON.stringify({ playerId: pl.playerId, emoji: emoji }) })
    .catch(function(e) { if (/429|Espera/i.test(e.message)) { /* silencioso */ } });
}

function connectPlayerSocket(sessionId) {
  try {
    if (typeof io !== 'function') return;
    if (socket) { try { socket.disconnect(); } catch (e) {} }
    socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', function() { if (sessionId) socket.emit('join_event', 'quiz:' + sessionId); });
    socket.on('quiz_state', function(msg) { if (msg && msg.sessionId === sessionId) fetchPlayerStateOnce(); });
    socket.on('quiz_kicked', function() { plClear(); stopTimers(); showPlView('join'); toast('Fuiste expulsado de la partida'); });
  } catch (e) { /* solo sondeo */ }
}

function fetchPlayerStateOnce() {
  api('/quizzes/public/session/' + encodeURIComponent(pl.pin) + '/state?playerId=' + encodeURIComponent(pl.playerId))
    .then(function(st) { pl.st = st; renderPlayerState(st); })
    .catch(function() {});
}

// refresco instantáneo al volver a la pestaña (v12.44.830): los temporizadores
// quedan racionados en pestañas ocultas — al volver, traer el estado actual sin esperar
document.addEventListener('visibilitychange', function() {
  if (document.hidden) return;
  try {
    if (live.sessionId) { fetchHostStateOnce(); if (!live.pollId) startHostPolling(); }
    else if (pl.pin && pl.playerId) { fetchPlayerStateOnce(); if (!pl.pollId) startPlayerPolling(); }
  } catch (e) {}
});

// carga inicial
init();
