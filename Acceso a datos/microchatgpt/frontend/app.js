const API_BASE = location.origin.includes(':5000')
  ? location.origin
  : 'http://localhost:5000';

// DOM
const convSelect = document.getElementById('convSelect');
const btnNewChat = document.getElementById('btnNewChat');

const chatEl = document.getElementById('chat');
const formEl = document.getElementById('chatForm');
const promptEl = document.getElementById('prompt');

const modelSelect = document.getElementById('modelSelect');
const refreshBtn = document.getElementById('refreshModels');

// Auth DOM
const userEl = document.getElementById('user');
const passEl = document.getElementById('pass');

const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const btnLogout = document.getElementById('btnLogout');
const statusEl = document.getElementById('status');

// State
let history = []; // legacy
let token = localStorage.getItem('token') || '';
let conversationId = localStorage.getItem('conversation_id') || null;

// ---- Guard para evitar dobles envíos si pulsas Enter rápido ----
let sending = false;

// Helpers
function addMessage(role, content) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = content;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function clearChat() {
  chatEl.innerHTML = '';
}

async function safeJson(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await response.json();
  const text = await response.text();
  return { error: text.slice(0, 300) || 'Non-JSON response' };
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function setAuthUI(logged) {
  btnLogout.style.display = logged ? '' : 'none';
  btnLogin.style.display = logged ? 'none' : '';
  btnRegister.style.display = logged ? 'none' : '';
  userEl.style.display = logged ? 'none' : '';
  passEl.style.display = logged ? 'none' : '';

  convSelect.style.display = logged ? '' : 'none';
  btnNewChat.style.display = logged ? '' : 'none';

  statusEl.textContent = logged
    ? 'sesión iniciada (guarda chats) ✅'
    : 'modo invitado (no guarda)';
}


// ---------------------
// ENTER para enviar (Shift+Enter salto de línea)
// ---------------------
if (promptEl && formEl) {
  promptEl.addEventListener('keydown', (e) => {
    // Evita líos con IME/composición (emoji/teclados asiáticos)
    if (e.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // Dispara submit de forma correcta
      if (typeof formEl.requestSubmit === 'function') {
        formEl.requestSubmit();
      } else {
        // fallback
        formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  });
}


// ---------------------
// Conversations
// ---------------------
async function refreshConversationList() {
  if (!token) return;

  const r = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() });
  const data = await safeJson(r);
  if (!r.ok) {
    addMessage('assistant', `Error listando conversaciones: ${data.error || r.statusText}`);
    return;
  }

  const convs = data.conversations || [];
  convSelect.innerHTML = '';

  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = convs.length ? 'Selecciona conversación…' : 'No hay conversaciones';
  convSelect.appendChild(opt0);

  for (const c of convs) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.title || 'Chat'} (#${c.id})`;
    convSelect.appendChild(opt);
  }

  if (conversationId) convSelect.value = String(conversationId);
}

async function openConversation(id) {
  conversationId = String(id);
  localStorage.setItem('conversation_id', conversationId);

  const r = await fetch(`${API_BASE}/api/conversations/${id}/messages`, { headers: authHeaders() });
  const data = await safeJson(r);
  if (!r.ok) {
    addMessage('assistant', `Error cargando mensajes: ${data.error || r.statusText}`);
    return;
  }

  // ✅ sincroniza modelo con la conversación
  if (data.conversation && data.conversation.model) {
    const m = data.conversation.model;
    if ([...modelSelect.options].some(o => o.value === m)) {
      modelSelect.value = m;
    }
  }

  clearChat();
  const msgs = data.messages || [];
  if (!msgs.length) {
    addMessage('assistant', 'Conversación vacía. Escribe para empezar.');
    return;
  }

  for (const m of msgs) {
    if (m.role === 'user' || m.role === 'assistant') addMessage(m.role, m.content);
  }
}

async function createNewChat() {
  const model = modelSelect.value || 'llama3.1:8b-instruct-q4_0';

  const r = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model, title: 'Chat' })
  });
  const data = await safeJson(r);
  if (!r.ok) {
    addMessage('assistant', `Error creando chat: ${data.error || r.statusText}`);
    return;
  }

  await refreshConversationList();
  convSelect.value = String(data.conversation_id);
  await openConversation(data.conversation_id);
}

btnNewChat.addEventListener('click', async () => {
  await createNewChat();
});

convSelect.addEventListener('change', async () => {
  const id = convSelect.value;
  if (!id) return;
  await openConversation(id);
});


// ---------------------
// Models
// ---------------------
async function fetchModels() {
  try {
    const r = await fetch(`${API_BASE}/api/models`);
    const data = await safeJson(r);

    if (!r.ok || !data.models || !Array.isArray(data.models)) return;

    modelSelect.innerHTML = '';

    const chatModels = data.models.filter(m => !m.name.toLowerCase().includes('embed'));

    chatModels.sort((a, b) => {
      const pa = parseFloat(a.details?.parameter_size) || 0;
      const pb = parseFloat(b.details?.parameter_size) || 0;
      return pb - pa;
    });

    for (const m of chatModels) {
      const opt = document.createElement('option');
      opt.value = m.name;

      const size = m.details?.parameter_size ? ` · ${m.details.parameter_size}` : '';
      opt.textContent = m.name + size;

      if (m.name.includes('llama3.1')) {
        opt.textContent += ' ⭐';
        opt.selected = true;
      }

      modelSelect.appendChild(opt);
    }
  } catch {}
}

refreshBtn.addEventListener('click', (e) => {
  e.preventDefault();
  fetchModels();
});


// ✅ guardar el modelo en la conversación al cambiar selector
modelSelect.addEventListener('change', async () => {
  if (!token || !conversationId) return;

  const model = modelSelect.value;
  try {
    await fetch(`${API_BASE}/api/conversations/${conversationId}/model`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ model })
    });
  } catch {
    // silencio
  }
});


// ---------------------
// Auth actions
// ---------------------
btnRegister.addEventListener('click', async () => {
  const username = userEl.value.trim();
  const password = passEl.value.trim();
  if (!username || !password) return addMessage('assistant', 'Falta usuario o contraseña');

  const r = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await safeJson(r);
  if (!r.ok) return addMessage('assistant', `Error register: ${data.error || r.statusText}`);

  token = data.token;
  localStorage.setItem('token', token);
  setAuthUI(true);

  clearChat();
  addMessage('assistant', 'Cuenta creada. Desde ahora el chat se guarda ✅');

  await loadLastConversation();
});

btnLogin.addEventListener('click', async () => {
  const username = userEl.value.trim();
  const password = passEl.value.trim();
  if (!username || !password) return addMessage('assistant', 'Falta usuario o contraseña');

  const r = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await safeJson(r);
  if (!r.ok) return addMessage('assistant', `Error login: ${data.error || r.statusText}`);

  token = data.token;
  localStorage.setItem('token', token);
  setAuthUI(true);

  clearChat();
  addMessage('assistant', 'Login correcto. Cargando tus chats…');

  await loadLastConversation();
});

btnLogout.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/logout`, { method: 'POST', headers: authHeaders() });
  } catch {}

  token = '';
  conversationId = null;
  history = [];

  localStorage.removeItem('token');
  localStorage.removeItem('conversation_id');

  setAuthUI(false);

  clearChat();
  addMessage('assistant', 'Sesión cerrada. Modo invitado.');
});


// ---------------------
// Persistencia: cargar última conversación
// ---------------------
async function loadLastConversation() {
  const r = await fetch(`${API_BASE}/api/last_conversation`, {
    headers: authHeaders()
  });
  const data = await safeJson(r);

  if (!r.ok) {
    addMessage('assistant', `No pude cargar conversaciones: ${data.error || r.statusText}`);
    return;
  }

  conversationId = data.conversation_id || null;
  if (conversationId) localStorage.setItem('conversation_id', String(conversationId));
  else localStorage.removeItem('conversation_id');

  // sincroniza el modelo si viene
  if (data.conversation && data.conversation.model) {
    const m = data.conversation.model;
    if ([...modelSelect.options].some(o => o.value === m)) {
      modelSelect.value = m;
    }
  }

  clearChat();

  if (!data.messages || data.messages.length === 0) {
    addMessage('assistant', 'Listo. Escribe tu primer mensaje para iniciar conversación.');
  } else {
    for (const m of data.messages) {
      if (m.role === 'user' || m.role === 'assistant') addMessage(m.role, m.content);
    }
  }

  await refreshConversationList();
  if (conversationId) convSelect.value = String(conversationId);
}


// ---------------------
// Chat submit
// ---------------------
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  // guard anti doble submit
  if (sending) return;

  const raw = promptEl.value;
  const text = raw.trim();
  if (!text) return;

  // ✅ LIMPIA SIEMPRE al enviar (antes del fetch)
  promptEl.value = '';
  promptEl.style.height = '';
  promptEl.focus();

  addMessage('user', text);

  const model = modelSelect.value || 'llama3.1:8b-instruct-q4_0';

  sending = true;
  try {
    const payload = { model, message: text };

    if (token) payload.conversation_id = conversationId; // null => backend crea
    else payload.history = history;

    const r = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await safeJson(r);

    if (r.ok) {
      const reply = data.reply || '(no reply)';
      addMessage('assistant', reply);

      if (token) {
        if (data.conversation_id && !conversationId) {
          conversationId = data.conversation_id;
          localStorage.setItem('conversation_id', String(conversationId));
          await refreshConversationList();
          convSelect.value = String(conversationId);
        }
      } else {
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: reply });
      }
    } else {
      addMessage('assistant', `Error: ${data.error || r.statusText}`);
    }
  } catch (err) {
    addMessage('assistant', `Network error: ${err.message}`);
  } finally {
    sending = false;
  }
});


// ---------------------
// Init
// ---------------------
setAuthUI(!!token);
addMessage('assistant', token
  ? 'Sesión detectada. Cargando tus chats…'
  : 'Modo invitado: no se guarda. Login para persistencia.'
);

fetchModels();

if (token) {
  loadLastConversation();
}

