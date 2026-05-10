(function() {
  if (window.ChatWidgetLoaded) return;
  window.ChatWidgetLoaded = true;

  var styles = document.createElement('style');
  styles.textContent = `
    #chat-widget-btn { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:50%; background:#7c3aed; color:#fff; border:none; cursor:pointer; box-shadow:0 4px 16px rgba(124,58,237,0.4); z-index:9999; font-size:24px; display:flex; align-items:center; justify-content:center; transition:transform 0.2s; }
    #chat-widget-btn:hover { transform:scale(1.1); }
    #chat-widget { position:fixed; bottom:90px; right:24px; width:360px; max-height:500px; background:#1e293b; border:1px solid #334155; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.4); z-index:9998; display:none; flex-direction:column; overflow:hidden; }
    #chat-widget.open { display:flex; }
    #chat-header { background:#7c3aed; color:#fff; padding:12px 16px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
    #chat-close { background:none; border:none; color:#fff; cursor:pointer; font-size:18px; }
    #chat-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; max-height:350px; }
    #chat-messages .msg { padding:8px 12px; border-radius:12px; max-width:85%; font-size:13px; line-height:1.4; }
    #chat-messages .msg.bot { background:#334155; color:#e2e8f0; align-self:flex-start; border-bottom-left-radius:4px; }
    #chat-messages .msg.user { background:#7c3aed; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
    #chat-input-area { display:flex; padding:8px; gap:8px; border-top:1px solid #334155; }
    #chat-input { flex:1; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:8px 12px; color:#e2e8f0; font-size:13px; outline:none; }
    #chat-input:focus { border-color:#7c3aed; }
    #chat-send { background:#7c3aed; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }
    #chat-send:hover { background:#6d28d9; }
    #chat-quick { display:flex; flex-wrap:wrap; gap:4px; padding:4px 12px 8px; }
    #chat-quick button { background:#334155; border:none; color:#94a3b8; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer; }
    #chat-quick button:hover { background:#475569; color:#e2e8f0; }
  `;
  document.head.appendChild(styles);

  var btn = document.createElement('button');
  btn.id = 'chat-widget-btn';
  btn.innerHTML = '💬';
  btn.onclick = function() { document.getElementById('chat-widget').classList.toggle('open'); };
  document.body.appendChild(btn);

  var widget = document.createElement('div');
  widget.id = 'chat-widget';
  widget.innerHTML = '<div id="chat-header"><span>🤖 Asistente Check</span><button id="chat-close">✕</button></div><div id="chat-messages"><div class="msg bot">¡Hola! Soy el asistente virtual. Pregúntame sobre el evento.</div></div><div id="chat-quick"></div><div id="chat-input-area"><input id="chat-input" placeholder="Escribe tu pregunta..."><button id="chat-send">Enviar</button></div>';
  document.body.appendChild(widget);

  document.getElementById('chat-close').onclick = function() { widget.classList.remove('open'); };
  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');

  function addQuickReplies(replies) {
    var container = document.getElementById('chat-quick');
    container.innerHTML = '';
    if (!replies || !replies.length) return;
    replies.forEach(function(r) {
      var b = document.createElement('button');
      b.textContent = r;
      b.onclick = function() { sendMessage(r); };
      container.appendChild(b);
    });
  }

  function addMessage(text, role) {
    var msgs = document.getElementById('chat-messages');
    var div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendMessage(msg) {
    if (!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    document.getElementById('chat-quick').innerHTML = '';
    var eventId = window.CHAT_EVENT_ID || null;
    fetch('/api/chatbot/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, event_id: eventId }) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success && d.response) {
          addMessage(d.response.text || d.response, 'bot');
          addQuickReplies(d.response.quickReplies);
        } else {
          addMessage('Lo siento, no pude procesar tu mensaje.', 'bot');
        }
      })
      .catch(function() { addMessage('Error de conexión. Intenta de nuevo.', 'bot'); });
  }

  sendBtn.onclick = function() { sendMessage(input.value); };
  input.onkeydown = function(e) { if (e.key === 'Enter') sendMessage(input.value); };
})();
