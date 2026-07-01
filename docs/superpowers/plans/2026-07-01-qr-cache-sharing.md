# QR-Cache-Sharing (Schüler ↔ Schüler, Schüler → Lehrer) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eigene Schüler-Caches lassen sich per QR-Code zwischen Geräten weitergeben (Schüler ↔ Schüler direkt; Schüler → Lehrer als Vorlage für einen offiziellen Cache) — ganz ohne Netzwerk oder Server.

**Architecture:** Zwei vendorte Pure-JS-Libraries (`qrcode-generator` zum Erzeugen, `jsQR` zum Decodieren aus Kamera-Frames) werden wie Leaflet als globale `<script>`-Tags eingebunden. Ein neues Modul `js/qr.js` kapselt das JSON-Payload-Format (mit Marker-Feld `rshCache`, Beschreibung auf 400 Bytes gekürzt). Zwei neue Vollbild-Views (`#view-share`, `#view-scan`) in der Schüler-App zeigen bzw. scannen den QR-Code; ein neues Onboarding (`#view-username`) fragt einmalig einen Anzeigenamen ab, der Teil des Cache-ID-Schemas wird (Kollisionsschutz). Der Lehrerbereich bekommt ein Scan-Modal, das den bestehenden „Neuer Cache"-Formular-Flow vorbefüllt statt die Schüler-ID direkt zu übernehmen.

**Tech Stack:** Vanilla ES Modules, `localStorage`, `qrcode-generator@1.4.4` (vendored), `jsQR@1.4.0` (vendored), `getUserMedia`, `node:test` + `node:assert/strict` für Unit-Tests.

**Run tests:** `node --test tests/` (alle Tests; einzeln z. B. `node --test tests/qr.test.js`)

---

## Dateiübersicht

| Datei | Änderung |
|-------|----------|
| `vendor/qrcode/qrcode.js` | Neu: vendorte QR-Encode-Library (v1.4.4) |
| `vendor/jsqr/jsQR.js` | Neu: vendorte QR-Decode-Library (v1.4.0) |
| `js/qr.js` | Neu: `encodeCacheQrPayload`, `decodeCacheQrPayload`, `truncateDescriptionForQr` |
| `tests/qr.test.js` | Neu: Tests für `js/qr.js` |
| `js/username.js` | Neu: `loadUsername`, `saveUsername`, `hasUsername`, `renderUsernameForm` |
| `tests/username.test.js` | Neu: Tests für die Datenschicht von `js/username.js` |
| `js/caches.js` | `generateStudentId` auf Username-Slug + Zufallshex umgestellt; `isKnownCacheId` neu |
| `tests/caches.test.js` | `generateStudentId`-Tests auf neues Format umgestellt; Tests für `isKnownCacheId` |
| `js/cache-editor.js` | `ersteller`-Feld ergänzt, `generateStudentId(loadUsername())` |
| `js/share.js` | Neu: Teilen-View-Logik (QR anzeigen) |
| `js/scan.js` | Neu: `startQrScanner` (wiederverwendbare Kamera-Engine) + `openScanView` |
| `js/app.js` | VIEWS/`showView` erweitert; Username-Onboarding verdrahtet; Liste um Badge/📤/📷 erweitert |
| `js/admin.js` | `renderCacheForm`-Fix (`isNew`), Scan-Modal für Lehrer-Übernahme |
| `index.html` | `#view-username`, `#view-share`, `#view-scan`; „Name ändern"-Link; Vendor-`<script>`-Tags |
| `lehrer.html` | `<script src="vendor/jsqr/jsQR.js">` |
| `css/style.css` | Styles für neue Views, QR-Container, Kamera-Vorschau, Button-Zeile, `.link-btn` |
| `service-worker.js` | Cache-Version v15, neue Dateien zu `APP_SHELL` |

---

## Task 1: Vendor-Bibliotheken herunterladen

**Files:**
- Create: `vendor/qrcode/qrcode.js`
- Create: `vendor/jsqr/jsQR.js`

Context: Beide Libraries werden unverändert (nicht handbearbeitet) vendored, genau wie `vendor/leaflet/leaflet.js`. Beide sind reines JS ohne Abhängigkeiten und exponieren im klassischen `<script>`-Kontext (kein AMD/CommonJS vorhanden) automatisch eine globale Funktion — `qrcode` bzw. `jsQR` — weil ihr UMD-Wrapper bei fehlendem Modulsystem auf `window`/`self` zurückfällt (bereits verifiziert).

- [ ] **Step 1: Verzeichnisse anlegen und Dateien herunterladen**

```bash
mkdir -p vendor/qrcode vendor/jsqr
curl -s -o vendor/qrcode/qrcode.js "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"
curl -s -o vendor/jsqr/jsQR.js "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
```

- [ ] **Step 2: Größe verifizieren**

```bash
ls -la vendor/qrcode/qrcode.js vendor/jsqr/jsQR.js
```

Erwartetes Ergebnis: `vendor/qrcode/qrcode.js` ist ca. 56.694 Bytes, `vendor/jsqr/jsQR.js` ist ca. 256.885 Bytes. Falls eine Datei 0 Bytes oder eine HTML-Fehlerseite enthält, ist der Download fehlgeschlagen (Netzwerk prüfen).

- [ ] **Step 3: Globale Exports verifizieren**

```bash
grep -c "var qrcode = function" vendor/qrcode/qrcode.js
grep -c "function jsQR" vendor/jsqr/jsQR.js
```

Erwartetes Ergebnis: beide Befehle geben mindestens `1` aus.

- [ ] **Step 4: Commit**

```bash
git add vendor/qrcode/qrcode.js vendor/jsqr/jsQR.js
git commit -m "chore: vendor qrcode-generator and jsQR libraries"
```

---

## Task 2: `js/qr.js` — QR-Payload encode/decode (TDD)

**Files:**
- Create: `js/qr.js`
- Test: `tests/qr.test.js`

Context: Reine Logik, kein DOM, keine Kamera. Kapselt das JSON-Format, das im QR-Code steht: `{"rshCache":1,"id":...,"name":...,"beschreibung":...,"codewort":...,"latitude":...,"longitude":...,"ersteller":...}`. Die Beschreibung wird auf `MAX_BESCHREIBUNG_BYTES` (400, UTF-8, nach JSON-Escaping gemessen) begrenzt; alle anderen Felder bleiben immer vollständig.

- [ ] **Step 1: Failing tests schreiben**

Erstelle `tests/qr.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BESCHREIBUNG_BYTES,
  truncateDescriptionForQr,
  encodeCacheQrPayload,
  decodeCacheQrPayload,
} from '../js/qr.js';

const cache = {
  id: 'student-mira-a8f3',
  name: 'Am Baum',
  beschreibung: 'Hinter der Bank am großen Baum.',
  codewort: 'Eiche',
  latitude: 51.389567,
  longitude: 7.702367,
  ersteller: 'Mira',
};

test('truncateDescriptionForQr: kurzer Text bleibt unverändert', () => {
  const result = truncateDescriptionForQr('Kurzer Text');
  assert.equal(result.text, 'Kurzer Text');
  assert.equal(result.truncated, false);
});

test('truncateDescriptionForQr: langer Text wird gekürzt und mit … versehen', () => {
  const long = 'A'.repeat(1000);
  const result = truncateDescriptionForQr(long);
  assert.equal(result.truncated, true);
  assert.ok(result.text.endsWith('…'));
  const enc = new TextEncoder();
  assert.ok(enc.encode(JSON.stringify(result.text)).length <= MAX_BESCHREIBUNG_BYTES);
});

test('truncateDescriptionForQr: respektiert ein eigenes Byte-Budget', () => {
  const result = truncateDescriptionForQr('A'.repeat(100), 20);
  assert.equal(result.truncated, true);
  const enc = new TextEncoder();
  assert.ok(enc.encode(JSON.stringify(result.text)).length <= 20);
});

test('encodeCacheQrPayload/decodeCacheQrPayload: Roundtrip erhält alle Felder', () => {
  const { text, truncated } = encodeCacheQrPayload(cache);
  assert.equal(truncated, false);
  const decoded = decodeCacheQrPayload(text);
  assert.deepEqual(decoded, cache);
});

test('encodeCacheQrPayload: ersteller wird null wenn nicht gesetzt', () => {
  const { text } = encodeCacheQrPayload({ ...cache, ersteller: undefined });
  const decoded = decodeCacheQrPayload(text);
  assert.equal(decoded.ersteller, null);
});

test('encodeCacheQrPayload: lange Beschreibung wird gekürzt, andere Felder bleiben vollständig', () => {
  const longCache = { ...cache, beschreibung: 'B'.repeat(1000) };
  const { text, truncated } = encodeCacheQrPayload(longCache);
  assert.equal(truncated, true);
  const decoded = decodeCacheQrPayload(text);
  assert.equal(decoded.id, longCache.id);
  assert.equal(decoded.latitude, longCache.latitude);
  assert.equal(decoded.longitude, longCache.longitude);
  assert.equal(decoded.codewort, longCache.codewort);
  assert.ok(decoded.beschreibung.length < longCache.beschreibung.length);
});

test('decodeCacheQrPayload: lehnt kaputtes JSON ab', () => {
  assert.throws(() => decodeCacheQrPayload('KAPUTT'), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt JSON ohne rshCache-Marker ab', () => {
  assert.throws(() => decodeCacheQrPayload(JSON.stringify({ foo: 'bar' })), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt Payload mit fehlendem Pflichtfeld ab', () => {
  const bad = { rshCache: 1, id: 'x', name: 'x', beschreibung: 'x', latitude: 1, longitude: 1 }; // kein codewort
  assert.throws(() => decodeCacheQrPayload(JSON.stringify(bad)), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt fremden QR-Inhalt (z. B. eine URL) ab', () => {
  assert.throws(() => decodeCacheQrPayload('https://example.com'), /Kein gültiger Cache-Code/);
});
```

- [ ] **Step 2: Tests fehlschlagen sehen**

```bash
node --test tests/qr.test.js
```

Erwartetes Ergebnis: Fehler wie `Cannot find module '../js/qr.js'`.

- [ ] **Step 3: `js/qr.js` implementieren**

Erstelle `js/qr.js`:

```js
// Encode/decode the JSON payload embedded in cache-sharing QR codes. Pure functions —
// no DOM, no camera, no QR-image rendering (that's js/share.js and js/scan.js).

export const MAX_BESCHREIBUNG_BYTES = 400;

// Shrinks `text` until JSON.stringify(text) fits within maxBytes (UTF-8), appending '…'
// if anything was cut. Returns the original text unchanged (truncated: false) if it
// already fits.
export function truncateDescriptionForQr(text, maxBytes = MAX_BESCHREIBUNG_BYTES) {
  const enc = new TextEncoder();
  const fits = (s) => enc.encode(JSON.stringify(s)).length <= maxBytes;
  if (fits(text)) return { text, truncated: false };
  let end = text.length;
  let candidate = text.slice(0, end) + '…';
  while (end > 0 && !fits(candidate)) {
    end--;
    candidate = text.slice(0, end) + '…';
  }
  return { text: candidate, truncated: true };
}

// Builds the JSON string embedded in a cache-sharing QR code. `beschreibung` is
// truncated if needed (see truncateDescriptionForQr); all other fields are used as-is.
export function encodeCacheQrPayload(cache) {
  const { text: beschreibung, truncated } = truncateDescriptionForQr(cache.beschreibung);
  const payload = {
    rshCache: 1,
    id: cache.id,
    name: cache.name,
    beschreibung,
    codewort: cache.codewort,
    latitude: cache.latitude,
    longitude: cache.longitude,
    ersteller: cache.ersteller ?? null,
  };
  return { text: JSON.stringify(payload), truncated };
}

// Parses and validates a scanned QR string. Throws Error('Kein gültiger Cache-Code')
// for anything that isn't a well-formed rshCache payload (broken JSON, missing marker,
// wrong field types) so callers can show a consistent error message.
export function decodeCacheQrPayload(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Kein gültiger Cache-Code');
  }
  if (!obj || typeof obj !== 'object' || obj.rshCache !== 1) {
    throw new Error('Kein gültiger Cache-Code');
  }
  const { id, name, beschreibung, codewort, latitude, longitude, ersteller } = obj;
  if (
    typeof id !== 'string' || typeof name !== 'string' ||
    typeof beschreibung !== 'string' || typeof codewort !== 'string' ||
    typeof latitude !== 'number' || typeof longitude !== 'number'
  ) {
    throw new Error('Kein gültiger Cache-Code');
  }
  return {
    id, name, beschreibung, codewort, latitude, longitude,
    ersteller: typeof ersteller === 'string' ? ersteller : null,
  };
}
```

- [ ] **Step 4: Tests bestehen**

```bash
node --test tests/qr.test.js
```

Erwartetes Ergebnis: alle 10 Tests bestehen.

- [ ] **Step 5: Commit**

```bash
git add js/qr.js tests/qr.test.js
git commit -m "feat: add QR payload encode/decode with description truncation"
```

---

## Task 3: `js/username.js` — Datenschicht (TDD)

**Files:**
- Create: `js/username.js`
- Test: `tests/username.test.js`

Context: Analog zu `rulesAccepted()`/`acceptRules()` in `js/rules.js`. Nur die reine `localStorage`-Datenschicht wird hier getestet; die DOM-Rendering-Funktion `renderUsernameForm` kommt in Task 5 hinzu (nicht unit-testbar, wie `cache-editor.js`).

- [ ] **Step 1: Failing tests schreiben**

Erstelle `tests/username.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUsername, saveUsername, hasUsername } from '../js/username.js';

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

test('loadUsername: liefert "" wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.equal(loadUsername(), '');
});

test('hasUsername: false wenn kein Name gesetzt', () => {
  global.localStorage.clear();
  assert.equal(hasUsername(), false);
});

test('saveUsername + loadUsername: round-trip', () => {
  global.localStorage.clear();
  saveUsername('Mira');
  assert.equal(loadUsername(), 'Mira');
  assert.equal(hasUsername(), true);
});

test('saveUsername: trimmt Leerzeichen', () => {
  global.localStorage.clear();
  saveUsername('  Mira  ');
  assert.equal(loadUsername(), 'Mira');
});

test('saveUsername: nur Leerzeichen → hasUsername bleibt false', () => {
  global.localStorage.clear();
  saveUsername('   ');
  assert.equal(hasUsername(), false);
});
```

- [ ] **Step 2: Tests fehlschlagen sehen**

```bash
node --test tests/username.test.js
```

Erwartetes Ergebnis: Fehler wie `Cannot find module '../js/username.js'`.

- [ ] **Step 3: `js/username.js` implementieren**

Erstelle `js/username.js`:

```js
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
```

- [ ] **Step 4: Tests bestehen**

```bash
node --test tests/username.test.js
```

Erwartetes Ergebnis: alle 5 Tests bestehen.

- [ ] **Step 5: Commit**

```bash
git add js/username.js tests/username.test.js
git commit -m "feat: add username storage layer"
```

---

## Task 4: `generateStudentId` auf Username-Schema umstellen (TDD)

**Files:**
- Modify: `js/caches.js`
- Modify: `tests/caches.test.js`
- Modify: `js/cache-editor.js`

Context: Bisher `generateStudentId(studentCaches)` (Array, zähler-basiert: `student-01`, `student-02`, …). Kollidiert beim Import zwischen Geräten. Neu: `generateStudentId(username)` (String) → `student-<slug>-<4-hex>`.

- [ ] **Step 1: Alte Tests ersetzen**

Ersetze in `tests/caches.test.js` die vier bestehenden `generateStudentId`-Tests:

```js
test('generateStudentId: erste ID ist student-01 für leeres Array', () => {
  assert.equal(generateStudentId([]), 'student-01');
});

test('generateStudentId: nächste ID nach student-01 ist student-02', () => {
  assert.equal(generateStudentId([{ id: 'student-01' }]), 'student-02');
});

test('generateStudentId: ignoriert Einträge mit fremdem ID-Präfix', () => {
  assert.equal(generateStudentId([{ id: 'cache-01' }, { id: 'cache-02' }]), 'student-01');
});

test('generateStudentId: wählt max+1 auch bei Lücken', () => {
  assert.equal(generateStudentId([{ id: 'student-03' }]), 'student-04');
});
```

durch:

```js
test('generateStudentId: Format ist student-<slug>-<4-hex>', () => {
  const id = generateStudentId('Mira');
  assert.match(id, /^student-mira-[0-9a-f]{4}$/);
});

test('generateStudentId: Username wird lowercased und Sonderzeichen entfernt', () => {
  const id = generateStudentId('Émile-Jöhn 2!');
  assert.match(id, /^student-[a-z0-9]{1,12}-[0-9a-f]{4}$/);
});

test('generateStudentId: Slug wird auf 12 Zeichen gekürzt', () => {
  const id = generateStudentId('einextremlangername');
  const slug = id.split('-')[1];
  assert.ok(slug.length <= 12, `slug "${slug}" sollte <= 12 Zeichen sein`);
});

test('generateStudentId: leerer/nur-Sonderzeichen-Username → Fallback "schueler"', () => {
  assert.match(generateStudentId('!!!'), /^student-schueler-[0-9a-f]{4}$/);
  assert.match(generateStudentId(''), /^student-schueler-[0-9a-f]{4}$/);
});
```

Füge außerdem am Ende der Datei neue Tests für die Duplikat-Erkennung beim Scannen hinzu:

```js
import { isKnownCacheId } from '../js/caches.js';

test('isKnownCacheId: true wenn die ID bereits vorhanden ist', () => {
  const existing = [{ id: 'student-mira-a8f3', name: 'Am Baum' }];
  assert.equal(isKnownCacheId(existing, 'student-mira-a8f3'), true);
});

test('isKnownCacheId: false wenn die ID noch nicht vorhanden ist', () => {
  const existing = [{ id: 'student-mira-a8f3', name: 'Am Baum' }];
  assert.equal(isKnownCacheId(existing, 'student-tom-1234'), false);
});

test('isKnownCacheId: false bei leerem Array', () => {
  assert.equal(isKnownCacheId([], 'student-mira-a8f3'), false);
});
```

- [ ] **Step 2: Tests fehlschlagen sehen**

```bash
node --test tests/caches.test.js
```

Erwartetes Ergebnis: die neuen Tests schlagen fehl (`generateStudentId`-Format passt nicht zum alten `student-01`-Schema; `isKnownCacheId` existiert noch nicht).

- [ ] **Step 3: `generateStudentId` in `js/caches.js` umschreiben**

Ersetze in `js/caches.js`:

```js
export function generateStudentId(studentCaches) {
  const nums = studentCaches
    .map((c) => parseInt(c.id.replace('student-', ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `student-${String(next).padStart(2, '0')}`;
}
```

durch:

```js
function slugifyUsername(username) {
  const slug = String(username ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return slug || 'schueler';
}

export function generateStudentId(username) {
  const slug = slugifyUsername(username);
  const hex = Math.random().toString(16).slice(2).padEnd(4, '0').slice(0, 4);
  return `student-${slug}-${hex}`;
}

export function isKnownCacheId(studentCaches, id) {
  return studentCaches.some((c) => c.id === id);
}
```

- [ ] **Step 4: Tests bestehen**

```bash
node --test tests/caches.test.js
```

Erwartetes Ergebnis: alle Tests bestehen.

- [ ] **Step 5: `js/cache-editor.js` anpassen**

Ersetze den Import:

```js
import { parseCoordinate } from './geo.js';
import { loadStudentCaches, saveStudentCaches, generateStudentId } from './caches.js';
```

durch:

```js
import { parseCoordinate } from './geo.js';
import { loadStudentCaches, saveStudentCaches, generateStudentId } from './caches.js';
import { loadUsername } from './username.js';
```

Ersetze die Entry-Konstruktion im Speichern-Handler:

```js
    const studentCaches = loadStudentCaches();
    const entry = {
      id: cache?.id ?? generateStudentId(studentCaches),
      name,
      beschreibung,
      codewort,
      latitude: lat,
      longitude: lon,
    };
```

durch:

```js
    const studentCaches = loadStudentCaches();
    const entry = {
      id: cache?.id ?? generateStudentId(loadUsername()),
      name,
      beschreibung,
      codewort,
      latitude: lat,
      longitude: lon,
      ersteller: cache?.ersteller ?? loadUsername(),
    };
```

(Beim Bearbeiten eines bestehenden — auch eines importierten — Caches bleibt `ersteller` unverändert, weil `cache?.ersteller` Vorrang hat. Nur bei neuen Caches wird der aktuelle Username gesetzt.)

Dieser Schritt ist nicht unit-testbar (reines DOM-Modul, wie der Rest von `cache-editor.js`) — Verifikation erfolgt manuell in Task 10.

- [ ] **Step 6: Alle Tests bestehen**

```bash
node --test tests/
```

- [ ] **Step 7: Commit**

```bash
git add js/caches.js tests/caches.test.js js/cache-editor.js
git commit -m "feat: generate student cache IDs from username, track ersteller"
```

---

## Task 5: Username-Onboarding-UI

**Files:**
- Modify: `js/username.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

Context: Neue View `#view-username` erscheint einmalig nach der Regeln-Bestätigung, bevor `hasUsername()` wahr ist. Ein Link „Name: {username} (ändern)" landet unten in `#view-rules`. Kein Unit-Test (DOM-Wiring) — Verifikation manuell in Task 10.

- [ ] **Step 1: `renderUsernameForm` zu `js/username.js` hinzufügen**

Füge am Ende von `js/username.js` hinzu:

```js
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
```

- [ ] **Step 2: `#view-username` und „Name ändern"-Link in `index.html`**

Ersetze:

```html
    <!-- Rules view -->
    <section id="view-rules" class="view" hidden>
      <div id="rules-content"></div>
      <button id="rules-accept" class="btn btn-primary btn-big">Verstanden – los geht's</button>
      <button id="rules-reset" class="btn btn-ghost btn-big" style="margin-top:0.6rem">Fortschritt zurücksetzen</button>
    </section>

    <!-- List view -->
    <section id="view-list" class="view" hidden>
```

durch:

```html
    <!-- Rules view -->
    <section id="view-rules" class="view" hidden>
      <div id="rules-content"></div>
      <p class="hint" style="margin-top:0.6rem">
        Dein Name: <strong id="rules-username-display"></strong>
        <button id="rules-change-name" type="button" class="link-btn">ändern</button>
      </p>
      <button id="rules-accept" class="btn btn-primary btn-big">Verstanden – los geht's</button>
      <button id="rules-reset" class="btn btn-ghost btn-big" style="margin-top:0.6rem">Fortschritt zurücksetzen</button>
    </section>

    <!-- Username-Onboarding view -->
    <section id="view-username" class="view" hidden>
      <div id="username-body"></div>
    </section>

    <!-- List view -->
    <section id="view-list" class="view" hidden>
```

- [ ] **Step 3: `.link-btn`-Style in `css/style.css`**

Füge am Ende von `css/style.css` hinzu:

```css
.link-btn {
  border: none; background: none; color: var(--rsh-blau-dunkel);
  font-weight: 700; text-decoration: underline; cursor: pointer;
  padding: 0; font-size: inherit; font-family: inherit;
}
```

- [ ] **Step 4: `js/app.js` verdrahten**

Ersetze den Import:

```js
import { loadCaches } from './caches.js';
import { distanceMeters, formatDistance } from './geo.js';
import { loadRules, renderRules, rulesAccepted, acceptRules } from './rules.js';
```

durch:

```js
import { loadCaches } from './caches.js';
import { distanceMeters, formatDistance } from './geo.js';
import { loadRules, renderRules, rulesAccepted, acceptRules } from './rules.js';
import { loadUsername, saveUsername, hasUsername, renderUsernameForm } from './username.js';
```

Ersetze `VIEWS`:

```js
const VIEWS = ['rules', 'list', 'map', 'goto', 'detail', 'cache-editor'];
```

durch:

```js
const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor'];
```

Ersetze in `showView()`:

```js
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail' || name === 'cache-editor';
```

durch:

```js
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor';
```

Ersetze im `main()`-Block:

```js
  document.getElementById('rules-accept').addEventListener('click', () => {
    acceptRules();
    showView('list');
  });
```

durch:

```js
  document.getElementById('rules-accept').addEventListener('click', () => {
    acceptRules();
    showView(hasUsername() ? 'list' : 'username');
  });

  // Username onboarding
  renderUsernameForm(document.getElementById('username-body'), () => showView('list'));

  function updateUsernameDisplay() {
    document.getElementById('rules-username-display').textContent = loadUsername() || '–';
  }
  updateUsernameDisplay();
  document.getElementById('rules-change-name').addEventListener('click', () => {
    const next = prompt('Neuer Name:', loadUsername());
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    saveUsername(trimmed);
    updateUsernameDisplay();
  });
```

Ersetze die letzte Zeile in `main()`:

```js
  showView(rulesAccepted() ? 'list' : 'rules');
```

durch:

```js
  showView(rulesAccepted() ? (hasUsername() ? 'list' : 'username') : 'rules');
```

- [ ] **Step 5: Alle Tests bestehen**

```bash
node --test tests/
```

- [ ] **Step 6: Commit**

```bash
git add js/username.js index.html css/style.css js/app.js
git commit -m "feat: add username onboarding view and change-name link"
```

---

## Task 6: `js/share.js` — Teilen-Ansicht

**Files:**
- Create: `js/share.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

Context: Vollbild-View analog zu `#view-cache-editor` (gleiche `.editor-topbar`/`.editor-body`-Klassen, kein neues CSS-Gerüst nötig außer für den QR-Container). Nutzt die globale `qrcode(...)`-Funktion aus `vendor/qrcode/qrcode.js`.

- [ ] **Step 1: `js/share.js` erstellen**

```js
import { encodeCacheQrPayload, MAX_BESCHREIBUNG_BYTES } from './qr.js';
import { loadUsername } from './username.js';

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Opens the "share this cache as a QR code" view. onDoneCb is called with no
// arguments when the user taps back.
export function openShareView(cache, onDoneCb) {
  document.getElementById('share-title').textContent = cache.name;
  document.getElementById('share-back').onclick = () => onDoneCb();

  const { text, truncated } = encodeCacheQrPayload(cache);
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag(6, 4);

  const body = document.getElementById('share-body');
  body.innerHTML = `
    <p class="editor-label" style="text-align:center">von ${esc(cache.ersteller || loadUsername() || '–')}</p>
    <div class="qr-container">${svg}</div>
    <p class="hint" style="text-align:center">
      Lass jemanden diesen Code scannen, um den Cache zu übernehmen
    </p>
    ${truncated ? `<p class="hint" style="text-align:center">
      Beschreibung wird für den QR-Code gekürzt (${cache.beschreibung.length}/${MAX_BESCHREIBUNG_BYTES} Zeichen).
    </p>` : ''}
  `;
}
```

- [ ] **Step 2: `#view-share` in `index.html`**

Füge direkt vor `</main>` ein (nach `#view-cache-editor`):

```html
    <!-- Teilen-View (eigenen Cache als QR anzeigen) -->
    <section id="view-share" class="view" hidden>
      <div class="editor-topbar">
        <button id="share-back" class="editor-back-btn" type="button">‹ Zurück</button>
        <span id="share-title" class="editor-title"></span>
      </div>
      <div id="share-body" class="editor-body"></div>
    </section>
```

Füge das Vendor-Script vor dem App-Modul ein:

```html
  <script src="vendor/leaflet/leaflet.js"></script>
  <script src="vendor/qrcode/qrcode.js"></script>
  <script type="module" src="js/app.js"></script>
```

- [ ] **Step 3: CSS ergänzen**

Füge am Ende von `css/style.css` hinzu:

```css
/* --- Teilen-View (QR-Code) --- */
#view-share { padding: 0; display: flex; flex-direction: column; height: 100%; }
.qr-container { display: flex; justify-content: center; margin: 0.8rem 0; }
.qr-container svg { width: 100%; max-width: 280px; height: auto; }

.student-share-btn {
  border: none; background: none; font-size: 1.2rem; cursor: pointer;
  padding: 0.2rem 0.4rem; color: var(--rsh-blau-dunkel); flex: none;
}
```

- [ ] **Step 4: `js/app.js` verdrahten**

Ersetze den Import:

```js
import { openCacheEditor } from './cache-editor.js';
```

durch:

```js
import { openCacheEditor } from './cache-editor.js';
import { openShareView } from './share.js';
```

Ersetze `VIEWS`:

```js
const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor'];
```

durch:

```js
const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor', 'share'];
```

Ersetze in `showView()` beide Zeilen:

```js
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor';
```

durch:

```js
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor' || name === 'share';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor' || name === 'share';
```

Ersetze die Schleife in `renderList()`:

```js
  for (const { cache, dist } of withDist) {
    const done = doneIds.has(cache.id);
    const li = document.createElement('li');
    li.className = `cache-item${done ? ' done' : ''}`;
    li.innerHTML = `
      <span class="badge">${done ? '✅' : '⬜'}</span>
      <span class="info">
        <span class="name">${escapeHtml(cache.name)}${cache.isStudent ? '<span class="student-badge">eigener</span>' : ''}</span><br>
        <span class="desc">${escapeHtml(cache.beschreibung)}</span>
      </span>
      <span class="dist">${dist == null ? '–' : formatDistance(dist)}</span>
      ${cache.isStudent ? '<button class="student-edit-btn" type="button" aria-label="Bearbeiten">✏️</button>' : ''}
    `;
    li.addEventListener('click', () => openDetail(cache.id));
    if (cache.isStudent) {
      li.querySelector('.student-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startCacheEditor(cache);
      });
    }
    list.appendChild(li);
  }
```

durch:

```js
  for (const { cache, dist } of withDist) {
    const done = doneIds.has(cache.id);
    const li = document.createElement('li');
    li.className = `cache-item${done ? ' done' : ''}`;
    const badgeText = cache.isStudent
      ? (cache.ersteller && cache.ersteller !== loadUsername() ? `von ${escapeHtml(cache.ersteller)}` : 'eigener')
      : '';
    li.innerHTML = `
      <span class="badge">${done ? '✅' : '⬜'}</span>
      <span class="info">
        <span class="name">${escapeHtml(cache.name)}${cache.isStudent ? `<span class="student-badge">${badgeText}</span>` : ''}</span><br>
        <span class="desc">${escapeHtml(cache.beschreibung)}</span>
      </span>
      <span class="dist">${dist == null ? '–' : formatDistance(dist)}</span>
      ${cache.isStudent ? '<button class="student-edit-btn" type="button" aria-label="Bearbeiten">✏️</button>' : ''}
      ${cache.isStudent ? '<button class="student-share-btn" type="button" aria-label="Teilen">📤</button>' : ''}
    `;
    li.addEventListener('click', () => openDetail(cache.id));
    if (cache.isStudent) {
      li.querySelector('.student-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startCacheEditor(cache);
      });
      li.querySelector('.student-share-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startShare(cache);
      });
    }
    list.appendChild(li);
  }
```

Füge nach `startCacheEditor` eine neue Funktion hinzu:

```js
function startShare(cache) {
  openShareView(cache, () => showView('list'));
  showView('share');
}
```

- [ ] **Step 5: Alle Tests bestehen**

```bash
node --test tests/
```

- [ ] **Step 6: Commit**

```bash
git add js/share.js index.html css/style.css js/app.js
git commit -m "feat: add share view to show a cache as a QR code"
```

---

## Task 7: `js/scan.js` — Scan-Engine + Schüler-Scan-Ansicht

**Files:**
- Create: `js/scan.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

Context: `startQrScanner` ist die wiederverwendbare Kamera-Engine (später auch vom Lehrer-Flow in Task 8 genutzt); `openScanView` verdrahtet sie in `#view-scan` für den Schüler-Flow. Nutzt die globale `jsQR(...)`-Funktion. Keine Unit-Tests möglich (Kamera/Video) — Verifikation manuell in Task 10.

- [ ] **Step 1: `js/scan.js` erstellen**

```js
import { decodeCacheQrPayload } from './qr.js';
import { loadStudentCaches, saveStudentCaches, isKnownCacheId } from './caches.js';

// Starts the camera and a jsQR decode loop against `videoEl`/`canvasEl`.
// Calls `onDecode(cache)` once with a valid, parsed cache object (camera is stopped
// first). Calls `onInvalid()` for a recognized-but-not-ours QR code (scan continues).
// Calls `onError(message)` if the camera can't be used at all.
// Returns a `stop()` function that releases the camera; safe to call multiple times.
export function startQrScanner(videoEl, canvasEl, { onDecode, onInvalid, onError }) {
  let stream = null;
  let rafId = null;
  let stopped = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    onError('Scannen wird auf diesem Gerät nicht unterstützt.');
    return stop;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.play();
      const ctx = canvasEl.getContext('2d');

      const tick = () => {
        if (stopped) return;
        if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
          canvasEl.width = videoEl.videoWidth;
          canvasEl.height = videoEl.videoHeight;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
          const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code) {
            try {
              const cache = decodeCacheQrPayload(code.data);
              stop();
              onDecode(cache);
              return;
            } catch {
              onInvalid?.();
            }
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    })
    .catch(() => {
      onError('Kamera-Zugriff verweigert. Bitte erlaube den Kamera-Zugriff in den Browser-Einstellungen.');
    });

  return stop;
}

// Opens the student-facing "scan a cache QR code" view (#view-scan). onDoneCb is
// called with 'imported' after a new cache was merged into rsh_student_caches, or
// 'back' if the user cancels or scanned a cache that was already present.
export function openScanView(onDoneCb) {
  const body = document.getElementById('scan-body');
  body.innerHTML = `
    <video id="scan-video" class="scan-video" autoplay playsinline muted></video>
    <canvas id="scan-canvas" hidden></canvas>
    <p id="scan-status" class="hint">Richte die Kamera auf den QR-Code</p>
    <p id="scan-error" class="error" hidden></p>
  `;
  const video = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  const statusEl = document.getElementById('scan-status');
  const errorEl = document.getElementById('scan-error');

  startQrScanner(video, canvas, {
    onDecode: (cache) => {
      const existing = loadStudentCaches();
      if (isKnownCacheId(existing, cache.id)) {
        statusEl.textContent = 'Cache schon vorhanden';
        setTimeout(() => onDoneCb('back'), 900);
        return;
      }
      saveStudentCaches([...existing, cache]);
      statusEl.textContent = `„${cache.name}" übernommen!`;
      setTimeout(() => onDoneCb('imported'), 900);
    },
    onInvalid: () => {
      errorEl.textContent = 'Kein gültiger Cache-Code';
      errorEl.hidden = false;
    },
    onError: (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    },
  });

  document.getElementById('scan-back').onclick = () => onDoneCb('back');
}
```

- [ ] **Step 2: `#view-scan` in `index.html`**

Füge direkt vor `</main>` ein (nach `#view-share`):

```html
    <!-- Scan-View (fremden Cache-QR einlesen) -->
    <section id="view-scan" class="view" hidden>
      <div class="editor-topbar">
        <button id="scan-back" class="editor-back-btn" type="button">‹ Zurück</button>
        <span class="editor-title">Cache scannen</span>
      </div>
      <div id="scan-body" class="editor-body"></div>
    </section>
```

Füge das Vendor-Script vor dem App-Modul ein:

```html
  <script src="vendor/leaflet/leaflet.js"></script>
  <script src="vendor/qrcode/qrcode.js"></script>
  <script src="vendor/jsqr/jsQR.js"></script>
  <script type="module" src="js/app.js"></script>
```

- [ ] **Step 3: CSS ergänzen**

Füge am Ende von `css/style.css` hinzu:

```css
/* --- Scan-View (Kamera) --- */
#view-scan { padding: 0; display: flex; flex-direction: column; height: 100%; }
.scan-video {
  width: 100%; aspect-ratio: 1; object-fit: cover;
  border-radius: 12px; background: #000;
}
```

Ersetze die bestehenden `.cache-item-add`-Regeln:

```css
/* „+ Neuer Cache"-Listeneintrag am Ende der Cache-Liste */
.cache-item-add {
  border: 2px dashed var(--rsh-gruen); border-radius: 12px;
  padding: 0.9rem; margin-bottom: 0.8rem;
  text-align: center; font-weight: 800; font-size: 1.1rem;
  color: var(--rsh-gruen-dunkel); cursor: pointer;
}
.cache-item-add:active { background: #f2faf0; }
```

durch:

```css
/* „+ Neuer Cache" / „Scannen"-Buttons am Ende der Cache-Liste */
.cache-item-add-row { display: flex; gap: 0.6rem; list-style: none; margin-bottom: 0.8rem; }
.cache-item-add {
  flex: 1; border: 2px dashed var(--rsh-gruen); border-radius: 12px;
  padding: 0.9rem; text-align: center; font-weight: 800; font-size: 1.05rem;
  color: var(--rsh-gruen-dunkel); cursor: pointer; background: none; font-family: inherit;
}
.cache-item-add:active { background: #f2faf0; }
```

- [ ] **Step 4: `js/app.js` verdrahten**

Ersetze den Import:

```js
import { openShareView } from './share.js';
```

durch:

```js
import { openShareView } from './share.js';
import { openScanView } from './scan.js';
```

Ersetze `VIEWS`:

```js
const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor', 'share'];
```

durch:

```js
const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor', 'share', 'scan'];
```

Ersetze in `showView()` beide Zeilen:

```js
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor' || name === 'share';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor' || name === 'share';
```

durch:

```js
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor' || name === 'share' || name === 'scan';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor' || name === 'share' || name === 'scan';
```

Ersetze den „+ Neuer Cache"-Block am Ende von `renderList()`:

```js
  const addLi = document.createElement('li');
  addLi.className = 'cache-item-add';
  addLi.textContent = '+ Neuer Cache';
  addLi.addEventListener('click', () => startCacheEditor(null));
  list.appendChild(addLi);
}
```

durch:

```js
  const addRow = document.createElement('li');
  addRow.className = 'cache-item-add-row';
  addRow.innerHTML = `
    <button type="button" class="cache-item-add">+ Neuer Cache</button>
    <button type="button" class="cache-item-add">📷 Scannen</button>
  `;
  addRow.children[0].addEventListener('click', () => startCacheEditor(null));
  addRow.children[1].addEventListener('click', () => startScan());
  list.appendChild(addRow);
}
```

Füge nach `startShare` eine neue Funktion hinzu:

```js
async function startScan() {
  openScanView(async (event) => {
    if (event === 'imported') {
      try {
        caches = await loadCaches();
      } catch (err) {
        console.error('Fehler beim Laden der Caches:', err);
      }
      doneIds = await getDoneIds();
      renderList();
      refreshMarkers();
    }
    showView('list');
  });
  showView('scan');
}
```

- [ ] **Step 5: Alle Tests bestehen**

```bash
node --test tests/
```

- [ ] **Step 6: Commit**

```bash
git add js/scan.js index.html css/style.css js/app.js
git commit -m "feat: add camera QR scanner and student scan view"
```

---

## Task 8: Lehrer-Flow — Scan-Modal in `admin.js`

**Files:**
- Modify: `js/admin.js`
- Modify: `lehrer.html`

Context: Der Lehrer scannt einen Schüler-QR-Code über ein Overlay-Modal (analog zu `showExportModal`). Statt die Schüler-ID zu übernehmen, wird das bestehende „Neuer Cache"-Formular mit den gescannten Feldern vorbefüllt; eine neue `cache-NN`-ID wird wie gewohnt vergeben. `ersteller` wird nicht übernommen (offizielle Caches haben kein Ersteller-Feld). Nicht unit-testbar (Kamera/DOM) — Verifikation manuell in Task 10.

- [ ] **Step 1: `renderCacheForm`-Fix (`isNew`)**

Ersetze in `js/admin.js`:

```js
function renderCacheForm(cache) {
  const isNew = cache === null;
```

durch:

```js
function renderCacheForm(cache) {
  const isNew = !cache?.id;
```

(`isNew` bedeutet jetzt „hat noch keine gespeicherte ID" statt „ist exakt `null`" — das erlaubt, das Formular mit vorbefüllten Feldern aber ohne ID zu öffnen, z. B. nach einem Scan. Die bestehenden Aufrufe `renderCacheForm(null)` und `renderCacheForm(adminCaches.find(...))` verhalten sich unverändert, weil `null` keine `id` hat und gefundene Caches immer eine haben.)

- [ ] **Step 2: Scan-Button + Modal**

Ersetze in `renderCacheList()`:

```js
  panel.innerHTML = `
    <button id="btn-new-cache" class="btn btn-primary btn-big" style="margin-bottom:1rem">+ Neuer Cache</button>
    <div id="cache-edit-area"></div>
    <ul id="admin-cache-list" class="cache-list" style="margin-bottom:1rem"></ul>
    <button id="btn-export-caches" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">JSON exportieren</button>
    <button id="btn-restore-caches" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

durch:

```js
  panel.innerHTML = `
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <button id="btn-new-cache" class="btn btn-primary btn-big">+ Neuer Cache</button>
      <button id="btn-scan-cache" class="btn btn-secondary btn-big">📷 Scannen</button>
    </div>
    <div id="cache-edit-area"></div>
    <ul id="admin-cache-list" class="cache-list" style="margin-bottom:1rem"></ul>
    <button id="btn-export-caches" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">JSON exportieren</button>
    <button id="btn-restore-caches" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;
```

Ersetze:

```js
  document.getElementById('btn-new-cache').addEventListener('click', () => renderCacheForm(null));
```

durch:

```js
  document.getElementById('btn-new-cache').addEventListener('click', () => renderCacheForm(null));

  document.getElementById('btn-scan-cache').addEventListener('click', () => {
    showScanModal((cache) => {
      renderCacheForm({
        name: cache.name,
        beschreibung: cache.beschreibung,
        codewort: cache.codewort,
        latitude: cache.latitude,
        longitude: cache.longitude,
      });
    });
  });
```

Füge den Import am Anfang von `js/admin.js` hinzu:

```js
import { parseCoordinate } from './geo.js';
```

durch:

```js
import { parseCoordinate } from './geo.js';
import { startQrScanner } from './scan.js';
```

Füge die `showScanModal`-Funktion direkt vor `// --- Cache Tab ---` ein:

```js
// --- Scan Modal ---

function showScanModal(onDecoded) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:420px;
                display:flex;flex-direction:column;gap:0.8rem">
      <h3 style="margin:0">Cache-QR scannen</h3>
      <video id="scan-modal-video" autoplay playsinline muted
             style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:#000"></video>
      <canvas id="scan-modal-canvas" hidden></canvas>
      <p id="scan-modal-error" class="error" hidden></p>
      <button id="scan-modal-close" class="btn btn-ghost" style="width:100%">Abbrechen</button>
    </div>`;
  document.body.appendChild(overlay);

  const video = document.getElementById('scan-modal-video');
  const canvas = document.getElementById('scan-modal-canvas');
  const errorEl = document.getElementById('scan-modal-error');

  const stop = startQrScanner(video, canvas, {
    onDecode: (cache) => {
      overlay.remove();
      onDecoded(cache);
    },
    onInvalid: () => {
      errorEl.textContent = 'Kein gültiger Cache-Code';
      errorEl.hidden = false;
    },
    onError: (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    },
  });

  const close = () => { stop(); overlay.remove(); };
  document.getElementById('scan-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}
```

- [ ] **Step 3: `lehrer.html` — Vendor-Script ergänzen**

Ersetze:

```html
  <script type="module" src="js/admin.js"></script>
```

durch:

```html
  <script src="vendor/jsqr/jsQR.js"></script>
  <script type="module" src="js/admin.js"></script>
```

- [ ] **Step 4: Alle Tests bestehen**

```bash
node --test tests/
```

- [ ] **Step 5: Commit**

```bash
git add js/admin.js lehrer.html
git commit -m "feat: add teacher QR scan-to-prefill for new caches"
```

---

## Task 9: Service Worker v15

**Files:**
- Modify: `service-worker.js`

Context: Neue Dateien müssen zum App-Shell-Cache hinzugefügt werden, sonst funktioniert der Offline-Modus nach diesem Release nicht mit den neuen Modulen. `lehrer.html`/`js/admin.js` waren nie Teil des App-Shells (kein Service-Worker-Register-Aufruf dort) und bleiben es.

- [ ] **Step 1: Cache-Name und `APP_SHELL` aktualisieren**

Ersetze:

```js
const CACHE_NAME = 'rsh-geocaching-v14';
const APP_SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/caches.js',
  'js/codeword.js',
  'js/geo.js',
  'js/rules.js',
  'js/progress.js',
  'js/location.js',
  'js/map.js',
  'js/detail.js',
  'js/cache-editor.js',
  'js/goto.js',
  'data/caches.json',
  'data/rules.json',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'manifest.webmanifest',
  'img/icon-192.png',
  'img/icon-512.png'
];
```

durch:

```js
const CACHE_NAME = 'rsh-geocaching-v15';
const APP_SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/caches.js',
  'js/codeword.js',
  'js/geo.js',
  'js/rules.js',
  'js/progress.js',
  'js/location.js',
  'js/map.js',
  'js/detail.js',
  'js/cache-editor.js',
  'js/goto.js',
  'js/qr.js',
  'js/username.js',
  'js/share.js',
  'js/scan.js',
  'data/caches.json',
  'data/rules.json',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/qrcode/qrcode.js',
  'vendor/jsqr/jsQR.js',
  'manifest.webmanifest',
  'img/icon-192.png',
  'img/icon-512.png'
];
```

- [ ] **Step 2: Finale Tests**

```bash
node --test tests/
```

Erwartetes Ergebnis: alle Tests bestehen.

- [ ] **Step 3: Commit**

```bash
git add service-worker.js
git commit -m "chore: bump service worker cache to v15, add QR-sharing files to app shell"
```

---

## Task 10: Manuelle Verifikation im Browser

**Files:** keine (Verifikation, kein Code)

Context: Kamera-/QR-Funktionen sind nicht unit-testbar. `getUserMedia` braucht einen „sicheren Kontext" — `http://localhost` funktioniert, eine LAN-IP (z. B. `http://192.168.x.x:8011`) **nicht** ohne HTTPS. Zum Testen auf zwei Geräten gleichzeitig entweder auf GitHub Pages (HTTPS) deployen oder pro Gerät einen eigenen `localhost`-Tunnel/USB-Debugging-Portforward nutzen.

- [ ] **Step 1: Lokalen Server starten**

```bash
python -m http.server 8011
```

Öffne `http://localhost:8011/index.html` und `http://localhost:8011/lehrer.html` (Passwort `CacheAdmin`) in zwei Browser-Tabs.

- [ ] **Step 2: Schüler-Onboarding prüfen**

- [ ] Nach „Verstanden – los geht's" erscheint die Username-Ansicht (falls noch kein Name gesetzt)
- [ ] Leerer Name → Fehlermeldung, kein Weiterkommen
- [ ] Name eingeben → Cache-Liste erscheint
- [ ] In der Regeln-Ansicht steht „Dein Name: {Name} (ändern)"; „ändern" öffnet einen Prompt und übernimmt den neuen Namen

- [ ] **Step 3: Eigenen Cache anlegen und teilen**

- [ ] „+ Neuer Cache" und „📷 Scannen" stehen nebeneinander über der Liste
- [ ] Neuen Cache anlegen → Badge zeigt „eigener"
- [ ] 📤-Icon am eigenen Cache antippen → Teilen-Ansicht zeigt „von {dein Name}" und einen QR-Code
- [ ] Bei einer sehr langen Beschreibung (> 400 Bytes) erscheint der Kürzungs-Hinweistext

- [ ] **Step 4: Scannen (zwei Geräte oder zwei Tabs mit Kamera-Zugriff)**

- [ ] „📷 Scannen" öffnet die Kamera-Vorschau
- [ ] Kamera-Zugriff verweigern → Fehlertext erscheint, kein Absturz
- [ ] Gültigen Cache-QR scannen → kurze Erfolgsmeldung, Cache erscheint in der Liste mit „von {Ersteller-Name}"
- [ ] Denselben QR-Code erneut scannen → „Cache schon vorhanden", kein doppelter Eintrag
- [ ] Einen beliebigen anderen QR-Code (z. B. eine URL) scannen → „Kein gültiger Cache-Code", Scan läuft weiter
- [ ] Importierten Cache über ✏️ bearbeiten und speichern → Badge zeigt weiterhin „von {Ersteller-Name}" (nicht „eigener")

- [ ] **Step 5: Lehrer-Flow**

- [ ] Im Lehrerbereich, Tab „Caches": „📷 Scannen" öffnet ein Modal mit Kamera-Vorschau
- [ ] Gültigen Schüler-Cache-QR scannen → Modal schließt, Formular „Neuer Cache" öffnet sich vorbefüllt (Name/Beschreibung/Codewort/Koordinaten)
- [ ] Speichern → neuer Eintrag mit `cache-NN`-ID erscheint in der Admin-Liste (nicht mit der gescannten Schüler-ID)
- [ ] „Abbrechen" im Scan-Modal schließt es ohne Änderungen

- [ ] **Step 6: Offline-Smoke-Test**

- [ ] Seite einmal laden (Service Worker registriert sich, Konsole zeigt keine Fehler)
- [ ] DevTools → Application → Service Workers: Cache-Version ist `rsh-geocaching-v15`
- [ ] Netzwerk auf „Offline" stellen, Seite neu laden → App-Shell lädt weiterhin (Karte bleibt leer, das ist erwartet)

---

## Abschluss: Spec-Coverage-Check

| Spec-Anforderung | Task |
|-------------------|------|
| Vendorte `qrcode-generator` + `jsQR` Libraries | Task 1 |
| QR-Payload-Format mit `rshCache`-Marker | Task 2 |
| Beschreibung auf 400 Bytes gekürzt, andere Felder immer vollständig | Task 2 |
| Auto-Version (typeNumber 0) + Level M | Task 6 (`qrcode(0, 'M')`) |
| Username-Onboarding, einmalig nach Regeln | Task 5 |
| „Name ändern"-Link in der Regeln-Ansicht | Task 5 |
| ID-Schema `student-<slug>-<hex>` | Task 4 |
| `ersteller`-Feld, bleibt bei Edits unverändert | Task 4 |
| Duplikat-Erkennung als reine, getestete Funktion | Task 4 (`isKnownCacheId`) |
| Badge „eigener" / „von {ersteller}" | Task 6 |
| 📤-Icon pro eigenem Cache → Teilen-Ansicht | Task 6 |
| 📷-Scannen-Button über der Liste → Scan-Ansicht | Task 7 |
| Duplikat-Erkennung beim Scannen | Task 7 |
| Ungültiger QR-Code → Hinweis, Scan läuft weiter | Task 7 |
| Kamera-Berechtigung verweigert → Fehlertext | Task 7 |
| Lehrer-Scan → Formular vorbefüllt, neue `cache-NN`-ID | Task 8 |
| Kein automatischer GitHub-Sync | (bewusst nicht Teil dieses Plans) |
| Service Worker v15 mit allen neuen Dateien | Task 9 |
