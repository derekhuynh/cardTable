import { sendMessage } from './rtc.js';

window.log = function (msg) {
  const el = document.getElementById('consoleWindow');
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  // Limit to last 100 messages
  while (el.children.length > 100 && el.firstChild) el.removeChild(el.firstChild);
};

// Attach event listener to the input box for typing commands/messages
(function setupConsoleInput() {
  const input = document.getElementById('consoleInput') as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      window.log && window.log(`[me]: ${input.value}`);
      sendMessage({ type: "chat", text: input.value });
      input.value = '';
    }
  });
})();