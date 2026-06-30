# Lokale Cache-Eingabe (Schüler-App) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schüler können in der Schüler-App eigene Caches anlegen, bearbeiten und löschen — lokal auf dem Gerät gespeichert, nahtlos in die bestehende Liste integriert.

**Architecture:** Eigene Caches landen in `localStorage` unter `rsh_student_caches` (separater Schlüssel von `rsh_caches_admin`). `loadCaches()` in `caches.js` führt beide Quellen zusammen; eigene Caches tragen `isStudent: true`. Eine neue View `#view-cache-editor` (analog zu `#view-detail`) enthält das Formular; die Editor-Logik liegt in `js/cache-editor.js`. Koordinaten-Eingabe akzeptiert Dezimalgrad und Grad Dezimalminuten via `parseCoordinate()` in `geo.js`.

**Tech Stack:** Vanilla ES Modules, `localStorage`, Leaflet (unverändert), `node:test` + `node:assert/strict` für Unit-Tests, `node --test` zum Ausführen.

**Run tests:** `node --test tests/` (alle Tests; einzeln: `node --test tests/geo.test.js`)

---

## Dateiübersicht

| Datei | Änderung |
|-------|----------|
| `js/geo.js` | + `parseCoordinate(str)` |
| `tests/geo.test.js` | + Tests für `parseCoordinate` |
| `js/caches.js` | + `loadStudentCaches`, `saveStudentCaches`, `generateStudentId`; `loadCaches` erweitert |
| `tests/caches.test.js` | + `localStorage`-Mock; + Tests für neue Funktionen |
| `css/style.css` | + Styles für Editor-View, Student-Badge, + Neuer Cache-Item |
| `index.html` | + `#view-cache-editor` Section |
| `js/cache-editor.js` | Neu: Editor-View-Logik |
| `js/app.js` | VIEWS erweitert; `showView` angepasst; `renderList` erweitert; `startCacheEditor` neu |
| `service-worker.js` | Cache-Name auf v13; `js/cache-editor.js` zu APP_SHELL |

---

## Task 1: `parseCoordinate` in `geo.js` (TDD)

**Files:**
- Modify: `js/geo.js`
- Test: `tests/geo.test.js`

Context: `geo.js` exportiert bereits `distanceMeters`, `bearingDegrees`, `formatDistance`, `angleDelta`, `normalizeHeading`. Tests laufen mit `node --test tests/geo.test.js`.

- [ ] **Step 1: Failing tests schreiben**

Füge am Ende von `tests/geo.test.js` hinzu:

```js
import { parseCoordinate } from '../js/geo.js';

// Dezimalgrad
test('parseCoordinate: Dezimalgrad mit Punkt', () => {
  assert.equal(parseCoordinate('51.389567'), 51.389567);
});

test('parseCoordinate: Dezimalgrad mit Komma (deutsche Tastatur)', () => {
  assert.equal(parseCoordinate('51,389567'), 51.389567);
});

test('parseCoordinate: negativer Dezimalgrad', () => {
  assert.equal(parseCoordinate('-7.702367'), -7.702367);
});

test('parseCoordinate: Dezimalgrad mit N-Präfix', () => {
  assert.equal(parseCoordinate('N 51.389567'), 51.389567);
});

test('parseCoordinate: Dezimalgrad mit S-Präfix → negativ', () => {
  assert.equal(parseCoordinate('S 51.389567'), -51.389567);
});

// Grad Dezimalminuten
test('parseCoordinate: GDM N-Präfix mit Grad-Symbol und Minute', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("N 51° 23.374'");
  assert.ok(result !== null, 'result should not be null');
  assert.ok(Math.abs(result - expected) < 1e-9, `expected ${expected}, got ${result}`);
});

test('parseCoordinate: GDM N-Suffix', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("51° 23.374' N");
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM ohne Sonderzeichen (N-Präfix, Leerzeichen)', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate('N51 23.374');
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM kompakt ohne Himmelsrichtung', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate('51°23.374');
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM mit Komma als Dezimaltrennzeichen', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("N 51° 23,374'");
  assert.ok(Math.abs(result - expected) < 1e-9);
});

// Ungültig
test('parseCoordinate: Buchstaben → null', () => {
  assert.equal(parseCoordinate('abc'), null);
});

test('parseCoordinate: leerer String → null', () => {
  assert.equal(parseCoordinate(''), null);
});

test('parseCoordinate: GDM mit Minuten >= 60 → null', () => {
  assert.equal(parseCoordinate("51° 60.000'"), null);
});

test('parseCoordinate: nicht-String → null', () => {
  assert.equal(parseCoordinate(null), null);
  assert.equal(parseCoordinate(51.5), null);
});
```

- [ ] **Step 2: Tests fehlschlagen sehen**

```
node --test tests/geo.test.js
```

Erwartetes Ergebnis: alle neuen Tests schlagen fehl mit `SyntaxError: The requested module '../js/geo.js' does not provide an export named 'parseCoordinate'` oder ähnlichem.

- [ ] **Step 3: `parseCoordinate` implementieren**

Füge am Ende von `js/geo.js` ein (nach `normalizeHeading`):

```js
export function parseCoordinate(str) {
  if (typeof str !== 'string') return null;
  // Normalize: trim, comma→period, collapse multiple spaces
  const s = str.trim().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!s) return null;

  // Extract and strip leading or trailing cardinal direction (N/S/E/W)
  const preMatch = s.match(/^([NSEWnsew])\s*(.*)/);
  const sufMatch = !preMatch ? s.match(/(.*?)\s*([NSEWnsew])$/i) : null;
  let card = '';
  let core = s;
  if (preMatch) {
    card = preMatch[1].toUpperCase();
    core = preMatch[2].trim();
  } else if (sufMatch) {
    card = sufMatch[2].toUpperCase();
    core = sufMatch[1].trim();
  }

  // Grad Dezimalminuten: DDD°MM.mmm or DDD MM.mmm (° or space as separator)
  const gdm = core.match(/^(\d{1,3})[°\s]\s*(\d{1,2}(?:\.\d+)?)['′]?\s*$/);
  if (gdm) {
    const deg = parseInt(gdm[1], 10);
    const min = parseFloat(gdm[2]);
    if (min >= 60) return null;
    const val = deg + min / 60;
    return (card === 'S' || card === 'W') ? -val : val;
  }

  // Dezimalgrad: optional sign, digits, optional decimal part, optional degree symbol
  const dd = core.match(/^([+-]?\d{1,3}(?:\.\d+)?)°?\s*$/);
  if (dd) {
    const val = parseFloat(dd[1]);
    if (!isFinite(val)) return null;
    if (card === 'S' || card === 'W') return -Math.abs(val);
    return val;
  }

  return null;
}
```

- [ ] **Step 4: Tests bestehen**

```
node --test tests/geo.test.js
```

Erwartetes Ergebnis: alle Tests bestehen (vorhandene + neue). Ausgabe endet mit `pass N`.

- [ ] **Step 5: Commit**

```
git add js/geo.js tests/geo.test.js
git commit -m "feat: add parseCoordinate for DD and GDM input formats"
```

---

## Task 2: Student-Cache-Funktionen in `caches.js` (TDD)

**Files:**
- Modify: `js/caches.js`
- Test: `tests/caches.test.js`

Context: `caches.js` exportiert `parseCaches` und `loadCaches`. `loadCaches` liest zuerst `localStorage.getItem('rsh_caches_admin')` als Override, dann fetcht es `data/caches.json`. Node.js hat kein `localStorage` — Mock nötig.

- [ ] **Step 1: localStorage-Mock + neue Tests schreiben**

Füge am Anfang von `tests/caches.test.js` direkt nach den Import-Zeilen ein:

```js
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
```

Dann füge am Ende der Datei hinzu:

```js
import {
  loadStudentCaches,
  saveStudentCaches,
  generateStudentId,
} from '../js/caches.js';

test('loadStudentCaches: liefert [] wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.deepEqual(loadStudentCaches(), []);
});

test('loadStudentCaches: liefert [] bei ungültigem JSON', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_student_caches', 'KAPUTT');
  assert.deepEqual(loadStudentCaches(), []);
});

test('saveStudentCaches + loadStudentCaches: round-trip', () => {
  global.localStorage.clear();
  const caches = [
    { id: 'student-01', name: 'Test', beschreibung: 'Desc', codewort: 'XY',
      latitude: 51.0, longitude: 7.0 }
  ];
  saveStudentCaches(caches);
  const loaded = loadStudentCaches();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'student-01');
  assert.equal(loaded[0].name, 'Test');
});

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

- [ ] **Step 2: Tests fehlschlagen sehen**

```
node --test tests/caches.test.js
```

Erwartetes Ergebnis: neue Tests schlagen fehl mit `SyntaxError: does not provide an export named 'loadStudentCaches'` o.ä.

- [ ] **Step 3: Neue Funktionen implementieren**

Füge in `js/caches.js` nach dem letzten `export`-Statement hinzu:

```js
export function loadStudentCaches() {
  const raw = localStorage.getItem('rsh_student_caches');
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveStudentCaches(arr) {
  localStorage.setItem('rsh_student_caches', JSON.stringify(arr));
}

export function generateStudentId(studentCaches) {
  const nums = studentCaches
    .map((c) => parseInt(c.id.replace('student-', ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `student-${String(next).padStart(2, '0')}`;
}
```

Ersetze außerdem die bestehende `loadCaches`-Funktion:

```js
export async function loadCaches(url = 'data/caches.json') {
  const override = localStorage.getItem('rsh_caches_admin');
  let serverCaches;
  if (override) {
    serverCaches = parseCaches(override);
  } else {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`caches.json konnte nicht geladen werden (HTTP ${res.status}).`);
    }
    serverCaches = parseCaches(await res.text());
  }
  const studentRaw = loadStudentCaches();
  const studentCaches = studentRaw.map((c) => ({ ...c, isStudent: true }));
  return [...serverCaches, ...studentCaches];
}
```

- [ ] **Step 4: Tests bestehen**

```
node --test tests/caches.test.js
```

Erwartetes Ergebnis: alle Tests bestehen. Beachte: `loadCaches` selbst wird nicht unit-getestet (fetcht Netzwerk) — das ist OK.

- [ ] **Step 5: Alle Tests bestehen**

```
node --test tests/
```

Alle 24+ Tests sollen bestehen.

- [ ] **Step 6: Commit**

```
git add js/caches.js tests/caches.test.js
git commit -m "feat: add student cache CRUD functions and merge into loadCaches"
```

---

## Task 3: CSS für Editor-View

**Files:**
- Modify: `css/style.css`

Context: `style.css` endet mit `.log-body { ... }`. Neuer Block wird danach angehängt. `.form-input` und `.btn-primary`, `.btn-big` sind bereits definiert — nutze sie in der Editor-View.

- [ ] **Step 1: CSS-Block anhängen**

Füge am Ende von `css/style.css` hinzu:

```css
/* --- Cache-Editor-View (Schüler lokale Caches) --- */
#view-cache-editor { padding: 0; display: flex; flex-direction: column; height: 100%; }

.editor-topbar {
  background: var(--rsh-gruen-dunkel); color: #fff;
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 0.9rem; flex: none;
}
.editor-back-btn {
  border: none; background: none; color: #fff;
  font-weight: 800; font-size: 1rem; cursor: pointer; padding: 0;
}
.editor-title { font-weight: 800; font-size: 1.1rem; }

.editor-body {
  flex: 1 1 auto; overflow-y: auto; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.7rem;
}
.editor-label {
  display: block; font-size: 0.9rem; font-weight: 700; color: #555;
}
.editor-label .form-input { margin-top: 0.2rem; }

.editor-coords-row { display: flex; gap: 0.5rem; }
.editor-coords-row .editor-label { flex: 1; }

.coord-hint { margin: 0; font-size: 0.8rem; color: #888; font-style: italic; }

.btn-danger {
  display: block; width: 100%;
  background: #fff; color: #b00020; border: 2px solid #b00020;
  border-radius: 10px; padding: 0.9rem 1.2rem; font-size: 1.1rem;
  font-weight: 700; cursor: pointer;
}

/* Student-Badge in der Cache-Liste */
.student-badge {
  font-size: 0.7rem; background: #fff3cd; border-radius: 4px;
  padding: 1px 4px; color: #7a5700; font-weight: 700;
  margin-left: 0.3rem; vertical-align: middle;
}
.student-edit-btn {
  border: none; background: none; font-size: 1.2rem; cursor: pointer;
  padding: 0.2rem 0.4rem; color: var(--rsh-blau-dunkel); flex: none;
}

/* „+ Neuer Cache"-Listeneintrag am Ende der Cache-Liste */
.cache-item-add {
  border: 2px dashed var(--rsh-gruen); border-radius: 12px;
  padding: 0.9rem; margin-bottom: 0.8rem;
  text-align: center; font-weight: 800; font-size: 1.1rem;
  color: var(--rsh-gruen-dunkel); cursor: pointer;
}
.cache-item-add:active { background: #f2faf0; }
```

- [ ] **Step 2: Visuell prüfen**

Öffne `index.html` im Browser (lokaler Dev-Server oder `file://`). Die bestehende Liste soll unverändert aussehen. Der neue CSS-Block fügt keine Elemente hinzu, nur Klassen-Styles.

- [ ] **Step 3: Commit**

```
git add css/style.css
git commit -m "feat: add CSS for cache editor view and student badge"
```

---

## Task 4: HTML-Markup für `#view-cache-editor`

**Files:**
- Modify: `index.html`

Context: `index.html` hat vier Views: `#view-rules`, `#view-list`, `#view-map`, `#view-detail`. Alle liegen als `<section>` in `<main>`. Die neue View wird als fünfte Section nach `#view-detail` eingefügt (vor dem schließenden `</main>`).

- [ ] **Step 1: Section einfügen**

Füge in `index.html` direkt vor `</main>` ein:

```html
    <!-- Cache-Editor-View (Schüler lokale Caches) -->
    <section id="view-cache-editor" class="view" hidden>
      <div class="editor-topbar">
        <button id="editor-back" class="editor-back-btn" type="button">‹ Zurück</button>
        <span id="editor-title" class="editor-title"></span>
      </div>
      <div id="editor-body" class="editor-body"></div>
    </section>
```

- [ ] **Step 2: Commit**

```
git add index.html
git commit -m "feat: add #view-cache-editor HTML skeleton"
```

---

## Task 5: `js/cache-editor.js` (neu)

**Files:**
- Create: `js/cache-editor.js`

Context: Diese Datei kapselt die gesamte Editor-Logik analog zu `detail.js`. Sie importiert `parseCoordinate` aus `./geo.js` und die Student-Cache-Funktionen aus `./caches.js`. Rein DOM-basiert — Unit-Tests würden Mocks für alle DOM-Operationen benötigen. Die reinen Logik-Funktionen (`parseCoordinate`, `loadStudentCaches` etc.) sind bereits in Tasks 1 und 2 getestet. Verifikation dieser Task erfolgt visuell in Task 6.

- [ ] **Step 1: Datei erstellen**

Erstelle `js/cache-editor.js` mit folgendem Inhalt:

```js
import { parseCoordinate } from './geo.js';
import { loadStudentCaches, saveStudentCaches, generateStudentId } from './caches.js';

let onDone = null;

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showError(errEl, msg) {
  errEl.textContent = msg;
  errEl.hidden = false;
}

// Opens the cache editor view. cache === null → new cache; cache object → edit mode.
// onDoneCb is called with 'back' | 'saved' | 'deleted' when the user finishes.
export function openCacheEditor(cache, onDoneCb) {
  onDone = onDoneCb;
  const isNew = cache === null;

  document.getElementById('editor-title').textContent =
    isNew ? 'Neuer Cache' : 'Cache bearbeiten';

  // Back button: onclick replaces any previous listener (avoids duplicates across calls).
  document.getElementById('editor-back').onclick = () => onDone('back');

  const body = document.getElementById('editor-body');
  body.innerHTML = `
    <label class="editor-label">Name
      <input id="ef-name" class="form-input" value="${esc(cache?.name ?? '')}" />
    </label>
    <label class="editor-label">Beschreibung
      <textarea id="ef-desc" class="form-input" rows="2">${esc(cache?.beschreibung ?? '')}</textarea>
    </label>
    <label class="editor-label">Codewort
      <input id="ef-code" class="form-input" value="${esc(cache?.codewort ?? '')}" />
    </label>
    <div class="editor-coords-row">
      <label class="editor-label">Breitengrad
        <input id="ef-lat" class="form-input" value="${cache?.latitude ?? ''}" />
      </label>
      <label class="editor-label">Längengrad
        <input id="ef-lon" class="form-input" value="${cache?.longitude ?? ''}" />
      </label>
    </div>
    <p class="coord-hint">z. B. 51.389567 oder N 51° 23.374′</p>
    <button id="ef-gps" type="button" class="btn btn-ghost btn-big">📍 GPS-Position übernehmen</button>
    <p id="ef-error" class="error" hidden></p>
    <button id="ef-save" type="button" class="btn btn-primary btn-big">Speichern</button>
    ${isNew ? '' : '<button id="ef-delete" type="button" class="btn-danger">🗑️ Cache löschen</button>'}
  `;

  document.getElementById('ef-gps').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('ef-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('ef-lon').value = pos.coords.longitude.toFixed(6);
      },
      () => alert('GPS-Standort konnte nicht ermittelt werden.')
    );
  });

  document.getElementById('ef-save').addEventListener('click', () => {
    const name = document.getElementById('ef-name').value.trim();
    const beschreibung = document.getElementById('ef-desc').value.trim();
    const codewort = document.getElementById('ef-code').value.trim();
    const lat = parseCoordinate(document.getElementById('ef-lat').value);
    const lon = parseCoordinate(document.getElementById('ef-lon').value);
    const errEl = document.getElementById('ef-error');

    if (!name) { showError(errEl, 'Name darf nicht leer sein.'); return; }
    if (!beschreibung) { showError(errEl, 'Beschreibung darf nicht leer sein.'); return; }
    if (!codewort) { showError(errEl, 'Codewort darf nicht leer sein.'); return; }
    if (lat === null || lat < -90 || lat > 90) {
      showError(errEl, 'Breitengrad ungültig. z. B. 51.389567 oder N 51° 23.374′'); return;
    }
    if (lon === null || lon < -180 || lon > 180) {
      showError(errEl, 'Längengrad ungültig. z. B. 7.702367 oder E 7° 42.142′'); return;
    }
    errEl.hidden = true;

    const studentCaches = loadStudentCaches();
    const entry = {
      id: cache?.id ?? generateStudentId(studentCaches),
      name,
      beschreibung,
      codewort,
      latitude: lat,
      longitude: lon,
    };

    if (isNew) {
      studentCaches.push(entry);
    } else {
      const idx = studentCaches.findIndex((c) => c.id === entry.id);
      if (idx !== -1) studentCaches[idx] = entry;
      else studentCaches.push(entry);
    }
    saveStudentCaches(studentCaches);
    onDone('saved');
  });

  if (!isNew) {
    document.getElementById('ef-delete').addEventListener('click', () => {
      if (!confirm(`Cache „${cache.name}" wirklich löschen?`)) return;
      const remaining = loadStudentCaches().filter((c) => c.id !== cache.id);
      saveStudentCaches(remaining);
      onDone('deleted');
    });
  }
}
```

- [ ] **Step 2: Commit**

```
git add js/cache-editor.js
git commit -m "feat: add cache-editor module for student cache create/edit/delete"
```

---

## Task 6: `js/app.js` erweitern

**Files:**
- Modify: `js/app.js`

Context: `app.js` hat `const VIEWS = ['rules', 'list', 'map', 'detail']` (Zeile 9), `showView()` (Zeile 15), `renderList()` (Zeile 38). Die Variablen `caches` (Zeile 10) und `doneIds` (Zeile 11) sind module-level und werden in der neuen `startCacheEditor`-Funktion direkt beschrieben.

- [ ] **Step 1: Import ergänzen**

Ersetze in `js/app.js` die erste Zeile des Import-Blocks:

```js
import { loadCaches } from './caches.js';
```

durch:

```js
import { loadCaches } from './caches.js';
import { openCacheEditor } from './cache-editor.js';
```

(Alle anderen Imports bleiben unverändert.)

- [ ] **Step 2: `VIEWS` erweitern**

Ersetze:

```js
const VIEWS = ['rules', 'list', 'map', 'detail'];
```

durch:

```js
const VIEWS = ['rules', 'list', 'map', 'detail', 'cache-editor'];
```

- [ ] **Step 3: `showView` anpassen**

Ersetze die Zeile:

```js
  document.querySelector('.app-header').hidden = name === 'detail';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail';
```

durch:

```js
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail' || name === 'cache-editor';
```

- [ ] **Step 4: `renderList` erweitern**

Ersetze die gesamte `renderList`-Funktion:

```js
function renderList() {
  const list = document.getElementById('cache-list');
  list.innerHTML = '';
  const withDist = caches.map((c) => ({
    cache: c,
    dist: userPos ? distanceMeters(userPos.lat, userPos.lon, c.latitude, c.longitude) : null
  }));
  withDist.sort((a, b) => {
    if (a.dist == null) return 1;
    if (b.dist == null) return -1;
    return a.dist - b.dist;
  });
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

  // „+ Neuer Cache" at the end of the list
  const addLi = document.createElement('li');
  addLi.className = 'cache-item-add';
  addLi.textContent = '+ Neuer Cache';
  addLi.addEventListener('click', () => startCacheEditor(null));
  list.appendChild(addLi);
}
```

- [ ] **Step 5: `startCacheEditor` hinzufügen**

Füge direkt nach der `openDetail`-Funktion (nach Zeile ~77) ein:

```js
async function startCacheEditor(cache) {
  openCacheEditor(cache, async (event) => {
    if (event === 'back') { showView('list'); return; }
    // 'saved' or 'deleted': reload merged caches and re-render
    try {
      caches = await loadCaches();
    } catch (err) {
      console.error('Fehler beim Laden der Caches:', err);
    }
    doneIds = await getDoneIds();
    renderList();
    refreshMarkers();
    showView('list');
  });
  showView('cache-editor');
}
```

- [ ] **Step 6: Alle Tests bestehen**

```
node --test tests/
```

Alle Tests sollen bestehen (keine Code-Logik in app.js geändert, die Tests abdecken).

- [ ] **Step 7: Im Browser prüfen**

Starte einen lokalen HTTP-Server im Projektverzeichnis (z. B. `npx serve .` oder VS Code Live Server) und öffne `index.html`.

Prüfliste:
- [ ] Cache-Liste lädt normal
- [ ] Letzter Eintrag in der Liste ist „+ Neuer Cache" (grün gestrichelt)
- [ ] Klick auf „+ Neuer Cache" öffnet die Editor-View mit grüner Topbar „Neuer Cache"
- [ ] „‹ Zurück" kehrt zur Liste zurück ohne Speichern
- [ ] Formular mit Dezimalgrad-Koordinaten speichern → Cache erscheint in Liste mit „eigener"-Badge
- [ ] Formular mit GDM-Koordinaten speichern (`N 51° 23.374'`) → wird akzeptiert
- [ ] Ungültige Koordinate → Fehlermeldung erscheint, nicht gespeichert
- [ ] ✏️-Button auf eigenem Cache → Editor-View öffnet mit vorausgefüllten Feldern, Titel „Cache bearbeiten"
- [ ] „🗑️ Cache löschen" → Rückfrage erscheint; Bestätigen löscht, Abbrechen behält
- [ ] GPS-Button übernimmt Koordinaten in Felder

- [ ] **Step 8: Commit**

```
git add js/app.js
git commit -m "feat: integrate cache editor into student app list view"
```

---

## Task 7: Service Worker v13

**Files:**
- Modify: `service-worker.js`

Context: `service-worker.js` hat `const CACHE_NAME = 'rsh-geocaching-v12'` und `APP_SHELL` als Array. Die neue Datei `js/cache-editor.js` muss gecacht werden; sonst schlägt der Offline-Modus fehl.

- [ ] **Step 1: Cache-Name und APP_SHELL aktualisieren**

Ersetze in `service-worker.js`:

```js
const CACHE_NAME = 'rsh-geocaching-v12';
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
const CACHE_NAME = 'rsh-geocaching-v13';
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
  'data/caches.json',
  'data/rules.json',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'manifest.webmanifest',
  'img/icon-192.png',
  'img/icon-512.png'
];
```

- [ ] **Step 2: Finale Tests**

```
node --test tests/
```

Alle Tests sollen bestehen.

- [ ] **Step 3: Commit**

```
git add service-worker.js
git commit -m "feat: bump SW to v13, add cache-editor.js to app shell"
```

---

## Abschluss: Spec-Coverage-Check

| Spec-Anforderung | Task |
|-----------------|------|
| `rsh_student_caches` localStorage-Schlüssel | Task 2 |
| IDs mit `student-` Präfix | Task 2 |
| `loadCaches()` mergt beide Quellen | Task 2 |
| `isStudent: true` Flag dynamisch | Task 2 |
| `parseCoordinate` DD + GDM | Task 1 |
| Coord-Hint unter den Feldern | Task 5 |
| N/S/E/W Vorzeichen-Regel | Task 1 |
| `#view-cache-editor` Vollbild (Header/Nav versteckt) | Task 3 + 6 |
| Editor-Topbar mit ‹ Zurück | Task 4 + 5 |
| Formularfelder + GPS-Button | Task 5 |
| Speichern-Validierung | Task 5 |
| Löschen mit confirm() | Task 5 |
| „eigener"-Badge in Liste | Task 3 + 6 |
| ✏️-Button mit stopPropagation | Task 6 |
| „+ Neuer Cache" am Listenende | Task 3 + 6 |
| Service Worker v13 | Task 7 |
