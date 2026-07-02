# Lehrer-Veröffentlichen nach GitHub — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Lehrerbereich schreibt Caches und Regeltexte per Klick direkt über die GitHub-API in den `main`-Branch, statt dass der Lehrer den JSON-Export manuell auf GitHub einfügen muss.

**Architecture:** Neues Modul `js/github-publish.js` kapselt Token-Verwaltung (`localStorage`), ein Token-Eingabe-Modal und `publishFile()` (GitHub Contents API: `GET` für die aktuelle `sha`, dann `PUT` mit dem neuen, UTF-8-sicher base64-kodierten Inhalt). `js/admin.js` ersetzt den bisherigen „JSON exportieren"-Button in beiden Tabs (Caches, Regeln) durch „Veröffentlichen" plus kleine „Token ändern"- und „Verlauf ansehen"-Links; die bestehende `localStorage`-Override-Logik bleibt unverändert die lokale Wahrheit für die UI.

**Tech Stack:** Vanilla ES Modules, `fetch` gegen die GitHub REST API (Contents-Endpoint), `localStorage`, `node:test` für die reine Logik.

## Global Constraints

- Repo/Branch fest einprogrammiert: `joerchw/rsh-geocaching`, Branch `main`
- Commit-Messages auf Englisch (passend zur bisherigen Commit-Historie des Repos)
- Fehlermeldungen für die Lehrkraft auf Deutsch, ohne rohe HTTP-Jargon-Begriffe
- `lehrer.html` registriert keinen Service Worker — `js/github-publish.js` gehört nicht ins `APP_SHELL` von `service-worker.js`
- `btoa()` niemals direkt auf nicht-ASCII-Text anwenden (siehe `js/qrcode-setup.js`-Historie) — immer über `TextEncoder` first

**Run tests:** `npm test` (nicht `node --test tests/` — schlägt auf diesem Windows/Node-Setup mit dem bloßen Verzeichnisargument fehl; `npm test` funktioniert zuverlässig)

---

## Dateiübersicht

| Datei | Änderung |
|-------|----------|
| `js/github-publish.js` | Neu: Token-Verwaltung, `utf8ToBase64`, Token-Modal, `publishFile()` |
| `tests/github-publish.test.js` | Neu: Tests für Token-Wrapper und `utf8ToBase64` |
| `js/admin.js` | „JSON exportieren" → „Veröffentlichen" in beiden Tabs; `showExportModal` entfernt; „Token ändern"- und „Verlauf ansehen"-Links |

---

## Task 1: Token-Speicherung + `utf8ToBase64` in `js/github-publish.js` (TDD)

**Files:**
- Create: `js/github-publish.js`
- Test: `tests/github-publish.test.js`

**Interfaces:**
- Produces: `loadGithubToken(): string | null`, `saveGithubToken(token: string): void`, `clearGithubToken(): void`, `utf8ToBase64(str: string): string` — alle als benannte Exporte aus `js/github-publish.js`. Task 2 baut auf diesen vier Funktionen auf.

Context: Reine Logik, kein DOM, kein Netzwerk. `loadGithubToken`/`saveGithubToken`/`clearGithubToken` sind `localStorage`-Wrapper, analog zu `js/username.js` (`loadUsername`/`saveUsername`). `utf8ToBase64` behebt dieselbe Fehlerklasse, die schon einmal beim QR-Code-Encoding aufgetreten ist (`js/qrcode-setup.js`): `btoa()` allein verschluckt sich an Zeichen außerhalb von Latin-1/ASCII.

- [ ] **Step 1: Failing tests schreiben**

Erstelle `tests/github-publish.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGithubToken, saveGithubToken, clearGithubToken, utf8ToBase64 } from '../js/github-publish.js';

// Mock localStorage for Node.js (functions reference it lazily at call time, not import time)
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

test('loadGithubToken: liefert null wenn kein Token gespeichert ist', () => {
  global.localStorage.clear();
  assert.equal(loadGithubToken(), null);
});

test('saveGithubToken + loadGithubToken: round-trip', () => {
  global.localStorage.clear();
  saveGithubToken('github_pat_abc123');
  assert.equal(loadGithubToken(), 'github_pat_abc123');
});

test('saveGithubToken: trimmt Leerzeichen', () => {
  global.localStorage.clear();
  saveGithubToken('  github_pat_abc123  ');
  assert.equal(loadGithubToken(), 'github_pat_abc123');
});

test('clearGithubToken: entfernt gespeicherten Token', () => {
  global.localStorage.clear();
  saveGithubToken('github_pat_abc123');
  clearGithubToken();
  assert.equal(loadGithubToken(), null);
});

test('utf8ToBase64: roundtrip mit ASCII', () => {
  const encoded = utf8ToBase64('hello world');
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  assert.equal(decoded, 'hello world');
});

test('utf8ToBase64: roundtrip mit deutschen Umlauten', () => {
  const original = 'Bäckerei an der Grünstraße, Brötchen ß ü ö ä';
  const encoded = utf8ToBase64(original);
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  assert.equal(decoded, original);
});

test('utf8ToBase64: leerer String', () => {
  assert.equal(utf8ToBase64(''), '');
});
```

- [ ] **Step 2: Tests fehlschlagen sehen**

```bash
node --test tests/github-publish.test.js
```

Erwartetes Ergebnis: Fehler wie `Cannot find module '../js/github-publish.js'`.

- [ ] **Step 3: `js/github-publish.js` erstellen**

```js
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
```

- [ ] **Step 4: Tests bestehen**

```bash
node --test tests/github-publish.test.js
```

Erwartetes Ergebnis: alle 7 Tests bestehen.

- [ ] **Step 5: Alle Tests bestehen**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add js/github-publish.js tests/github-publish.test.js
git commit -m "feat: add GitHub token storage and UTF-8-safe base64 encoding"
```

---

## Task 2: Token-Modal + `publishFile()` in `js/github-publish.js`

**Files:**
- Modify: `js/github-publish.js`

**Interfaces:**
- Consumes: `loadGithubToken`, `saveGithubToken`, `clearGithubToken`, `utf8ToBase64` (Task 1, same file — no import needed, same module scope).
- Produces: `promptForToken(): Promise<string>` (resolves with the entered token once saved, rejects with `Error('Abgebrochen.')` on cancel), `publishFile(path: string, content: string, commitMessage: string): Promise<void>` (throws `Error` with a German, user-facing message on any failure). Task 3 calls both.

Context: DOM (Modal-Overlay, gleicher Stil wie `showScanModal`/`showShareModal` in `js/admin.js`) + Netzwerk (`fetch` gegen `api.github.com`). Nicht unit-testbar (kein Node-DOM, echter Netzwerkzugriff bräuchte einen echten Token mit Schreibrecht auf das echte Repo) — Verifikation erfolgt manuell in Task 3, größtenteils über einen abgefangenen `fetch`, ohne echte Schreibzugriffe auszulösen.

- [ ] **Step 1: Token-Modal und `publishFile` anhängen**

Füge am Ende von `js/github-publish.js` hinzu:

```js
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
  return fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
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
```

- [ ] **Step 2: Syntax prüfen**

```bash
node --check js/github-publish.js
```

Erwartetes Ergebnis: keine Ausgabe (gültige Syntax).

- [ ] **Step 3: Alle Tests bestehen**

```bash
npm test
```

Erwartetes Ergebnis: weiterhin alle Tests aus Task 1 bestehen (dieser Task fügt keine neuen Unit-Tests hinzu — DOM/Netzwerk-Code, Verifikation in Task 3).

- [ ] **Step 4: Commit**

```bash
git add js/github-publish.js
git commit -m "feat: add GitHub token modal and publishFile()"
```

---

## Task 3: In `js/admin.js` verdrahten

**Files:**
- Modify: `js/admin.js`

Context: `js/admin.js` hat aktuell `showExportModal(json)` (Zeilen ~79–112), aufgerufen von zwei Stellen: `btn-export-caches` in `renderCacheList()` und `btn-export-rules` in `renderRulesList()`. Beide werden ersetzt; `showExportModal` hat danach keine Aufrufer mehr und wird entfernt.

- [ ] **Step 1: Import ergänzen**

Ersetze in `js/admin.js`:

```js
import { parseCoordinate } from './geo.js';
import { startQrScanner } from './scan.js';
import { encodeCacheQrPayload, MAX_BESCHREIBUNG_BYTES } from './qr.js';
import './qrcode-setup.js';
```

durch:

```js
import { parseCoordinate } from './geo.js';
import { startQrScanner } from './scan.js';
import { encodeCacheQrPayload, MAX_BESCHREIBUNG_BYTES } from './qr.js';
import './qrcode-setup.js';
import { publishFile, clearGithubToken, promptForToken } from './github-publish.js';
```

- [ ] **Step 2: `showExportModal` entfernen**

Lösche in `js/admin.js` die komplette Funktion:

```js
// --- Export Modal ---

function showExportModal(json) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:500px;
                max-height:80vh;display:flex;flex-direction:column;gap:0.8rem">
      <h3 style="margin:0">JSON exportieren</h3>
      <p style="margin:0;font-size:0.9rem;color:#555">
        Kopiere diesen Text und füge ihn auf GitHub in die entsprechende Datei ein.
      </p>
      <textarea style="flex:1;min-height:200px;font-family:monospace;font-size:0.8rem;
                       border:2px solid #ccc;border-radius:8px;padding:0.6rem;resize:vertical"
                readonly>${esc(json)}</textarea>
      <div style="display:flex;gap:0.5rem">
        <button id="modal-copy" class="btn btn-primary" style="flex:1">Kopieren</button>
        <button id="modal-close" class="btn btn-ghost" style="flex:1">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('modal-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      const btn = document.getElementById('modal-copy');
      btn.textContent = 'Kopiert!';
      setTimeout(() => { btn.textContent = 'Kopieren'; }, 1500);
    } catch {
      alert('Clipboard nicht verfügbar – bitte manuell kopieren.');
    }
  });
  document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
```

(Die Zeile `// --- Share Modal ---` direkt danach bleibt unverändert stehen.)

- [ ] **Step 3: Caches-Tab — Button und Links ersetzen**

Ersetze in `renderCacheList()`:

```js
    <div id="cache-edit-area"></div>
    <ul id="admin-cache-list" class="cache-list" style="margin-bottom:1rem"></ul>
    <button id="btn-export-caches" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">JSON exportieren</button>
    <button id="btn-restore-caches" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

durch:

```js
    <div id="cache-edit-area"></div>
    <ul id="admin-cache-list" class="cache-list" style="margin-bottom:1rem"></ul>
    <button id="btn-publish-caches" class="btn btn-primary btn-big" style="margin-bottom:0.5rem">Veröffentlichen</button>
    <div style="display:flex;gap:1rem;margin-bottom:0.8rem;font-size:0.85rem">
      <a href="https://github.com/joerchw/rsh-geocaching/commits/main/data/caches.json"
         target="_blank" rel="noopener" class="link-btn">Verlauf ansehen</a>
      <button id="btn-token-caches" type="button" class="link-btn">Token ändern</button>
    </div>
    <button id="btn-restore-caches" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

- [ ] **Step 4: Caches-Tab — Klick-Handler ersetzen**

Ersetze:

```js
  document.getElementById('btn-export-caches').addEventListener('click', () =>
    showExportModal(JSON.stringify(adminCaches, null, 2)));
```

durch:

```js
  document.getElementById('btn-publish-caches').addEventListener('click', async () => {
    const btn = document.getElementById('btn-publish-caches');
    btn.disabled = true;
    btn.textContent = 'Veröffentliche…';
    try {
      await publishFile(
        'data/caches.json',
        JSON.stringify(adminCaches, null, 2),
        'chore: update caches.json via Lehrerbereich'
      );
      btn.textContent = 'Veröffentlicht!';
      setTimeout(() => { btn.textContent = 'Veröffentlichen'; btn.disabled = false; }, 1500);
    } catch (err) {
      btn.textContent = 'Veröffentlichen';
      btn.disabled = false;
      if (err.message !== 'Abgebrochen.') alert(err.message);
    }
  });

  document.getElementById('btn-token-caches').addEventListener('click', () => {
    clearGithubToken();
    promptForToken().catch(() => {});
  });
```

- [ ] **Step 5: Regeln-Tab — Button und Links ersetzen**

Ersetze in `renderRulesList()`:

```js
    <button id="btn-add-section" class="btn btn-ghost btn-big" style="margin-bottom:1rem">
      + Neuer Abschnitt
    </button>
    <button id="btn-export-rules" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">
      JSON exportieren
    </button>
    <button id="btn-restore-rules" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

durch:

```js
    <button id="btn-add-section" class="btn btn-ghost btn-big" style="margin-bottom:1rem">
      + Neuer Abschnitt
    </button>
    <button id="btn-publish-rules" class="btn btn-primary btn-big" style="margin-bottom:0.5rem">
      Veröffentlichen
    </button>
    <div style="display:flex;gap:1rem;margin-bottom:0.8rem;font-size:0.85rem">
      <a href="https://github.com/joerchw/rsh-geocaching/commits/main/data/rules.json"
         target="_blank" rel="noopener" class="link-btn">Verlauf ansehen</a>
      <button id="btn-token-rules" type="button" class="link-btn">Token ändern</button>
    </div>
    <button id="btn-restore-rules" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

- [ ] **Step 6: Regeln-Tab — Klick-Handler ersetzen**

Ersetze:

```js
  document.getElementById('btn-export-rules').addEventListener('click', () =>
    showExportModal(JSON.stringify(adminRules, null, 2)));
```

durch:

```js
  document.getElementById('btn-publish-rules').addEventListener('click', async () => {
    const btn = document.getElementById('btn-publish-rules');
    btn.disabled = true;
    btn.textContent = 'Veröffentliche…';
    try {
      await publishFile(
        'data/rules.json',
        JSON.stringify(adminRules, null, 2),
        'chore: update rules.json via Lehrerbereich'
      );
      btn.textContent = 'Veröffentlicht!';
      setTimeout(() => { btn.textContent = 'Veröffentlichen'; btn.disabled = false; }, 1500);
    } catch (err) {
      btn.textContent = 'Veröffentlichen';
      btn.disabled = false;
      if (err.message !== 'Abgebrochen.') alert(err.message);
    }
  });

  document.getElementById('btn-token-rules').addEventListener('click', () => {
    clearGithubToken();
    promptForToken().catch(() => {});
  });
```

- [ ] **Step 7: Alle Tests bestehen**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add js/admin.js
git commit -m "feat: replace JSON export with direct GitHub publish in teacher admin"
```

- [ ] **Step 9: Manuelle Verifikation im Browser (ohne echten Schreibzugriff)**

DOM/Netzwerk-Code ist nicht unit-testbar; hier wird alles außer dem tatsächlichen
Schreibzugriff auf das echte Repo geprüft, damit kein Testcommit im echten Repo
landet.

Starte einen lokalen Server (z. B. `python -m http.server 8011`), öffne
`lehrer.html`, melde dich an (Passwort `CacheAdmin`), öffne die Browser-Konsole und
fange `fetch` ab, bevor du „Veröffentlichen" klickst:

```js
const realFetch = window.fetch;
window.fetch = (...args) => { console.log('FETCH CALL:', args); return Promise.reject(new Error('abgefangen für Test')); };
```

Prüfliste:
- [ ] „Veröffentlichen" klicken ohne gespeicherten Token → Token-Modal öffnet sich
      mit der nummerierten Anleitung
- [ ] Leeres Token speichern → Fehlermeldung „Bitte Token eingeben.", Modal bleibt offen
- [ ] Token eingeben und speichern → Modal schließt, Button wechselt zu
      „Veröffentliche…", dann (wegen des abgefangenen `fetch`) Fehlermeldung per
      `alert()`, Button kehrt zu „Veröffentlichen" zurück
- [ ] Konsole zeigt den abgefangenen Aufruf: URL beginnt mit
      `https://api.github.com/repos/joerchw/rsh-geocaching/contents/data/caches.json?ref=main`,
      Header enthält `Authorization: Bearer <eingegebener Token>`
- [ ] „Abbrechen" im Token-Modal → kein Fehler-Alert, Button kehrt sauber zu
      „Veröffentlichen" zurück
- [ ] „Token ändern" klicken → Modal öffnet sich erneut (alter Token wurde verworfen)
- [ ] „Verlauf ansehen" klickt zu `github.com/joerchw/rsh-geocaching/commits/main/data/caches.json`
      (neuer Tab)
- [ ] Dieselbe Prüfliste im Regeln-Tab wiederholen (`btn-publish-rules`,
      `btn-token-rules`, Verlauf-Link zeigt auf `rules.json`)
- [ ] `window.fetch = realFetch;` in der Konsole ausführen, um den Abfang-Patch
      wieder zu entfernen

**Echter Schreibtest:** Ein tatsächlicher Commit ins echte Repo (mit einem echten,
vom Lehrer erzeugten Fine-grained-Token) sollte einmal bewusst von einem Menschen
durchgeführt werden, nicht automatisiert — das erzeugt einen echten, sichtbaren
Commit im gemeinsam genutzten Repo.

---

## Abschluss: Spec-Coverage-Check

| Spec-Anforderung | Task |
|-------------------|------|
| `js/github-publish.js` mit Token-Verwaltung | Task 1 |
| `utf8ToBase64` mit Umlaut-Testabdeckung | Task 1 |
| Token-Modal mit Anleitung | Task 2 |
| `publishFile()` (GET sha → PUT) | Task 2 |
| 401/403 → Token löschen + Fehlermeldung | Task 2 |
| 409-Konflikt → Fehlermeldung | Task 2 |
| „Veröffentlichen"-Button ersetzt „JSON exportieren" (Caches + Regeln) | Task 3 |
| „Veröffentliche…"-Zustand während der Anfrage | Task 3 |
| „Veröffentlicht!"-Bestätigung | Task 3 |
| „Token ändern"-Link | Task 3 |
| „Verlauf ansehen"-Link (Caches + Regeln) | Task 3 |
| `showExportModal` entfernt | Task 3 |
| Lokaler Override bleibt bei Fehlern unangetastet | Task 2 (kein Schreibzugriff auf `rsh_caches_admin`/`rsh_rules_admin` in `publishFile`) |
