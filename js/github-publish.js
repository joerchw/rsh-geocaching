const TOKEN_KEY = 'rsh_github_token';

export function loadGithubToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveGithubToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearGithubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// btoa() alone mangles non-ASCII text (each UTF-16 code unit truncated to its low
// byte) — the same class of bug that broke German umlauts in QR codes, see
// js/qrcode-setup.js. Encode as real UTF-8 bytes first, then base64 those bytes.
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const REPO = 'joerchw/rsh-geocaching';
const BRANCH = 'main';
const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

// Shows the token-entry modal (instructions + password input). Resolves with the
// entered token once saved; rejects with an Error if the user cancels.
export function promptForToken() {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:460px;
                  display:flex;flex-direction:column;gap:0.8rem">
        <h3 style="margin:0">GitHub-Zugriff einrichten</h3>
        <ol style="margin:0;padding-left:1.2rem;font-size:0.9rem;color:#555;line-height:1.5">
          <li>Auf github.com anmelden → Settings → Developer settings → Fine-grained tokens → Generate new token</li>
          <li>Repository access: nur <strong>joerchw/rsh-geocaching</strong> auswählen</li>
          <li>Permissions → Contents: <strong>Read and write</strong></li>
          <li>Token erzeugen und hier einfügen</li>
        </ol>
        <label style="display:block">Token
          <input id="gh-token-input" type="password" class="form-input" placeholder="github_pat_…" autocomplete="off">
        </label>
        <p style="margin:0;font-size:0.8rem;color:#888">
          Nur auf deinem eigenen Gerät eingeben, nicht auf einem gemeinsam genutzten Computer.
        </p>
        <p id="gh-token-error" class="error" hidden></p>
        <div style="display:flex;gap:0.5rem">
          <button id="gh-token-save" class="btn btn-primary" style="flex:1">Speichern</button>
          <button id="gh-token-cancel" class="btn btn-ghost" style="flex:1">Abbrechen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('gh-token-save').addEventListener('click', () => {
      const value = document.getElementById('gh-token-input').value.trim();
      const errEl = document.getElementById('gh-token-error');
      if (!value) { errEl.textContent = 'Bitte Token eingeben.'; errEl.hidden = false; return; }
      saveGithubToken(value);
      overlay.remove();
      resolve(value);
    });
    document.getElementById('gh-token-cancel').addEventListener('click', () => {
      overlay.remove();
      reject(new Error('Abgebrochen.'));
    });
  });
}

async function githubRequest(path, token, options = {}) {
  try {
    return await fetch(`${API_BASE}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Keine Verbindung zu GitHub möglich. Bitte Internetverbindung prüfen und erneut versuchen.');
  }
}

// Publishes `content` to `path` (e.g. 'data/caches.json') on the configured branch,
// creating a commit with `commitMessage`. Prompts for a token first if none is stored
// yet. Throws Error with a German, user-facing message on any failure; the stored
// token is cleared automatically on 401/403 so the next call re-prompts.
export async function publishFile(path, content, commitMessage) {
  let token = loadGithubToken();
  if (!token) {
    token = await promptForToken();
  }

  const getRes = await githubRequest(`${path}?ref=${BRANCH}`, token);
  if (getRes.status === 401 || getRes.status === 403) {
    clearGithubToken();
    throw new Error('Token ungültig oder ohne Schreibrecht. Bitte neuen Token eingeben und erneut versuchen.');
  }
  if (!getRes.ok) {
    throw new Error(`Datei konnte nicht geladen werden (HTTP ${getRes.status}).`);
  }
  const { sha } = await getRes.json();

  const putRes = await githubRequest(path, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: utf8ToBase64(content),
      sha,
      branch: BRANCH,
    }),
  });
  if (putRes.status === 401 || putRes.status === 403) {
    clearGithubToken();
    throw new Error('Token ungültig oder ohne Schreibrecht. Bitte neuen Token eingeben und erneut versuchen.');
  }
  if (putRes.status === 409) {
    throw new Error('Die Datei wurde inzwischen anderswo geändert. Bitte Seite neu laden und erneut versuchen.');
  }
  if (!putRes.ok) {
    const body = await putRes.json().catch(() => ({}));
    throw new Error(`Veröffentlichen fehlgeschlagen: ${body.message || `HTTP ${putRes.status}`}`);
  }
}
