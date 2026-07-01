const USERNAME_KEY = 'rsh_username';

export function loadUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

export function saveUsername(name) {
  localStorage.setItem(USERNAME_KEY, String(name ?? '').trim());
}

export function hasUsername() {
  return loadUsername() !== '';
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Renders the one-time "what's your name" form into `container`. onDoneCb is called
// with no arguments once a non-empty name has been saved.
export function renderUsernameForm(container, onDoneCb) {
  container.innerHTML = `
    <p class="hint">Wie heißt du? Dein Name wird angezeigt, wenn du Caches mit anderen teilst.</p>
    <label class="editor-label">Name
      <input id="username-input" class="form-input" value="${esc(loadUsername())}" />
    </label>
    <p id="username-error" class="error" hidden></p>
    <button id="username-submit" type="button" class="btn btn-primary btn-big">Los geht's</button>
  `;
  document.getElementById('username-submit').addEventListener('click', () => {
    const name = document.getElementById('username-input').value.trim();
    const errEl = document.getElementById('username-error');
    if (!name) {
      errEl.textContent = 'Bitte gib deinen Namen ein.';
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    saveUsername(name);
    onDoneCb();
  });
}
