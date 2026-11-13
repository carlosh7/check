(function() {
  if (window.ChatWidgetLoaded) return;
  window.ChatWidgetLoaded = true;


  const btn = document.createElement('button');
  btn.id = 'chat-widget-btn';
  btn.innerHTML = '💬';
  btn.onclick = function() { document.getElementById('chat-widget').classList.toggle('open'); };
  document.body.appendChild(btn);

  const widget = document.createElement('div');
  widget.id = 'chat-widget';
  widget.innerHTML = '<div id="chat-header"><span>🤖 Asistente Check</span><button id="chat-close">✕</button></div><div id="chat-messages"><div class="msg bot">¡Hola! Soy el asistente virtual. Pregúntame sobre el evento.</div></div><div id="chat-quick"></div><div id="chat-input-area"><input id="chat-input" placeholder="Escribe tu pregunta..."><button id="chat-send">Enviar</button></div>';
  document.body.appendChild(widget);

  document.getElementById('chat-close').onclick = function() { widget.classList.remove('open'); };
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  function addQuickReplies(replies) {
    const container = document.getElementById('chat-quick');
    container.innerHTML = '';
    if (!replies || !replies.length) return;
    replies.forEach(function(r) {
      const b = document.createElement('button');
      b.textContent = r;
      b.onclick = function() { sendMessage(r); };
      container.appendChild(b);
    });
  }

  function addMessage(text, role) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
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
    const eventId = window.CHAT_EVENT_ID || null;
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
