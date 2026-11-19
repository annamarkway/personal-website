const WORKER_URL = "https://annagpt-proxy.ammarkway.workers.dev";

const history = [];

function appendMessage(role, text) {
  const log = document.getElementById('agent-log');
  const wrapper = document.createElement('div');
  wrapper.className = 'agent-message ' + (role === 'user' ? 'agent-message-user' : 'agent-message-bot');
  const p = document.createElement('p');
  p.innerText = text;
  wrapper.appendChild(p);
  log.appendChild(wrapper);
  log.scrollTop = log.scrollHeight;
  return wrapper;
}

function setBubbleText(bubble, text) {
  const p = bubble.querySelector('p');
  p.className = '';
  p.removeAttribute('aria-label');
  p.innerText = text;
}

async function sendMessage(text) {
  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  const pending = appendMessage('bot', '');
  pending.classList.add('agent-message-pending');
  const dots = pending.querySelector('p');
  dots.className = 'typing-dots';
  dots.setAttribute('aria-label', 'AnnaGPT is typing');
  dots.innerHTML = '<span></span><span></span><span></span>';

  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    if (resp.status === 429) {
      setBubbleText(pending, "You've hit the question limit for now - please try again in a little while.");
      pending.classList.remove('agent-message-pending');
      pending.classList.add('agent-message-error');
      history.pop();
      return;
    }

    if (!resp.ok) {
      throw new Error('Request failed with status ' + resp.status);
    }

    const data = await resp.json();
    const reply = data.reply || "Sorry, I didn't get a response. Try again in a moment.";
    setBubbleText(pending, reply);
    pending.classList.remove('agent-message-pending');
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    setBubbleText(pending, "Something went wrong reaching the agent. Please try again, or use the Contact page.");
    pending.classList.remove('agent-message-pending');
    pending.classList.add('agent-message-error');
    history.pop();
  }
}

window.addEventListener('load', () => {
  const form = document.getElementById('agent-form');
  const input = document.getElementById('agent-input');

  const suggestions = document.getElementById('agent-suggestions');

  function ask(text) {
    if (input.disabled) return;
    if (suggestions) suggestions.hidden = true;
    input.value = '';
    input.disabled = true;
    sendMessage(text).finally(() => {
      input.disabled = false;
      input.focus();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    ask(text);
  });

  if (suggestions) {
    suggestions.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => ask(btn.innerText));
    });
  }
});
