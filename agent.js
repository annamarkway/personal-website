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

async function sendMessage(text) {
  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  const pending = appendMessage('bot', 'Thinking...');
  pending.classList.add('agent-message-pending');

  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    if (resp.status === 429) {
      pending.querySelector('p').innerText = "You've hit the question limit for now - please try again in a little while.";
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
    pending.querySelector('p').innerText = reply;
    pending.classList.remove('agent-message-pending');
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    pending.querySelector('p').innerText = "Something went wrong reaching the agent. Please try again, or use the Contact page.";
    pending.classList.remove('agent-message-pending');
    pending.classList.add('agent-message-error');
    history.pop();
  }
}

window.addEventListener('load', () => {
  const form = document.getElementById('agent-form');
  const input = document.getElementById('agent-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.disabled = true;
    sendMessage(text).finally(() => {
      input.disabled = false;
      input.focus();
    });
  });
});
