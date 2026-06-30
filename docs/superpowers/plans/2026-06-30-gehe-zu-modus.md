# "Gehe zu"-Modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schüler können in der Schüler-App ein Navigationsziel direkt über Koordinaten eingeben
und zur bestehenden Navigationsansicht wechseln, um dorthin zu navigieren.

**Architecture:** Ein vierter Bottom-Nav-Button öffnet eine neue View `#view-goto` mit einem
Koordinaten-Formular (Breitengrad/Längengrad, Wiederverwendung von `parseCoordinate()`). Nach
gültiger Eingabe wird ein synthetisches Ziel-Objekt gebaut und an die bereits bestehende
Navigationsansicht (`renderDetail()` aus `js/detail.js`) übergeben — Karte, Pfeil, Distanz,
Spur funktionieren unverändert. `renderDetail()` blendet Log- und Info-Button aus, wenn das
Ziel kein Codewort bzw. keine Beschreibung hat. Das zuletzt eingegebene Ziel wird in
`localStorage` gespeichert und beim erneuten Öffnen vorausgefüllt.

**Tech Stack:** Vanilla ES Modules, Leaflet (bereits eingebunden), `node --test` für Unit-Tests,
`localStorage` für Persistenz.

**Referenz-Spec:** `docs/superpowers/specs/2026-06-30-gehe-zu-modus-design.md`

**Hinweis zu CSS:** Die Spec nennt `css/style.css` als zu ändernde Datei, aber kein Task in
diesem Plan fasst sie an. Das Formular in `js/goto.js` (Task 3) verwendet ausschließlich
bereits vorhandene, generische Klassen (`editor-label`, `form-input`, `coord-hint`, `error`,
`btn btn-primary btn-big`) — diese sind nicht an die Editor-View gebunden und funktionieren
unverändert in `#view-goto`. Es sind keine neuen Stilregeln nötig.

---

## Hinweis zu Tests

Dieses Projekt testet automatisiert nur **pure Logik** (z. B. `parseCoordinate()`,
`loadStudentCaches()`) — nicht die DOM-Wiring-Funktionen (z. B. `cache-editor.js`,
`renderDetail()`). Diesem Muster folgt auch dieser Plan: Die `localStorage`-Persistenz in
`js/goto.js` bekommt Unit-Tests (Task 1), die Formular-UI und die Änderungen an `detail.js`
werden manuell auf dem Smartphone verifiziert (Task 7).

`node --test` muss auf diesem Windows-Setup mit expliziten Dateipfaden aufgerufen werden
(das Verzeichnis-Form `node --test tests/` schlägt mit einem Modul-Auflösungsfehler fehl):

```bash
node --test tests/geo.test.js tests/caches.test.js tests/codeword.test.js tests/orientation.test.js tests/smoke.test.js tests/goto.test.js
```

---

### Task 1: `loadGotoTarget`/`saveGotoTarget` in `js/goto.js` (TDD)

**Files:**
- Create: `js/goto.js`
- Test: `tests/goto.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/goto.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGotoTarget, saveGotoTarget } from '../js/goto.js';

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

test('loadGotoTarget: liefert null, wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.equal(loadGotoTarget(), null);
});

test('loadGotoTarget: liefert null bei ungültigem JSON', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_goto_target', 'KAPUTT');
  assert.equal(loadGotoTarget(), null);
});

test('loadGotoTarget: liefert null, wenn latRaw/lonRaw fehlen', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_goto_target', JSON.stringify({ foo: 'bar' }));
  assert.equal(loadGotoTarget(), null);
});

test('saveGotoTarget + loadGotoTarget: round-trip', () => {
  global.localStorage.clear();
  saveGotoTarget('51.389567', '7.702367');
  const loaded = loadGotoTarget();
  assert.deepEqual(loaded, { latRaw: '51.389567', lonRaw: '7.702367' });
});

test('saveGotoTarget: überschreibt vorheriges Ziel', () => {
  global.localStorage.clear();
  saveGotoTarget('1', '2');
  saveGotoTarget('51.389567', 'N 7° 42.142′');
  const loaded = loadGotoTarget();
  assert.deepEqual(loaded, { latRaw: '51.389567', lonRaw: 'N 7° 42.142′' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/goto.test.js`
Expected: FAIL — `Cannot find module '../js/goto.js'` (file does not exist yet)

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/goto.js
const STORAGE_KEY = 'rsh_goto_target';

export function loadGotoTarget() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj?.latRaw === 'string' && typeof obj?.lonRaw === 'string') {
      return { latRaw: obj.latRaw, lonRaw: obj.lonRaw };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGotoTarget(latRaw, lonRaw) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ latRaw, lonRaw }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/goto.test.js`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add js/goto.js tests/goto.test.js
git commit -m "feat: add Gehe-zu target persistence (loadGotoTarget/saveGotoTarget)"
```

---

### Task 2: HTML für `#view-goto` und 4. Bottom-Nav-Button

**Files:**
- Modify: `index.html:31-37` (insert new section between `#view-map` and `#view-detail`)
- Modify: `index.html:93-97` (bottom-nav)

- [ ] **Step 1: Insert the `#view-goto` section**

In `index.html`, insert this new section directly after the closing `</section>` of
`#view-map` (after line 35 `<div id="user-coords" ...>` and its closing `</section>` on
line 35-36) and before the `<!-- Detail / navigation view -->` comment:

```html
    <!-- Gehe-zu view: coordinate entry, then switches to the navigation view -->
    <section id="view-goto" class="view" hidden>
      <div id="goto-body"></div>
    </section>

```

- [ ] **Step 2: Add the 4th bottom-nav button**

In `index.html`, change:

```html
  <nav class="bottom-nav" id="bottom-nav" hidden>
    <button data-view="list" class="nav-btn">Liste</button>
    <button data-view="map" class="nav-btn">Karte</button>
    <button data-view="rules" class="nav-btn">Regeln</button>
  </nav>
```

to:

```html
  <nav class="bottom-nav" id="bottom-nav" hidden>
    <button data-view="list" class="nav-btn">Liste</button>
    <button data-view="map" class="nav-btn">Karte</button>
    <button data-view="rules" class="nav-btn">Regeln</button>
    <button data-view="goto" class="nav-btn">📍 Gehe zu</button>
  </nav>
```

- [ ] **Step 3: Manually verify the markup is valid**

Open `index.html` in a browser (or run a local static server) and confirm the page still loads
without console errors. `#view-goto` will stay empty/hidden until Task 3 and Task 5 wire it up —
that's expected at this point.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add #view-goto markup and 4th bottom-nav button"
```

---

### Task 3: Formular-Logik `openGotoForm()` in `js/goto.js`

**Files:**
- Modify: `js/goto.js` (append to the file created in Task 1)

- [ ] **Step 1: Append the form-rendering function**

Add to the end of `js/goto.js` (the existing `loadGotoTarget`/`saveGotoTarget` stay unchanged):

```javascript
import { parseCoordinate } from './geo.js';

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showError(errEl, msg) {
  errEl.textContent = msg;
  errEl.hidden = false;
}

// Renders the coordinate form into #goto-body and wires the "Los geht's" button.
// onDoneCb is called with a synthetic target object once valid coordinates are submitted.
export function openGotoForm(onDoneCb) {
  const saved = loadGotoTarget();
  const body = document.getElementById('goto-body');
  body.innerHTML = `
    <label class="editor-label">Breitengrad
      <input id="goto-lat" class="form-input" value="${esc(saved?.latRaw ?? '')}" />
    </label>
    <label class="editor-label">Längengrad
      <input id="goto-lon" class="form-input" value="${esc(saved?.lonRaw ?? '')}" />
    </label>
    <p class="coord-hint">z. B. 51.389567 oder N 51° 23.374′</p>
    <p id="goto-error" class="error" hidden></p>
    <button id="goto-start" type="button" class="btn btn-primary btn-big">Los geht's</button>
  `;

  document.getElementById('goto-start').addEventListener('click', () => {
    const latRaw = document.getElementById('goto-lat').value.trim();
    const lonRaw = document.getElementById('goto-lon').value.trim();
    const lat = parseCoordinate(latRaw);
    const lon = parseCoordinate(lonRaw);
    const errEl = document.getElementById('goto-error');

    if (lat === null || lat < -90 || lat > 90) {
      showError(errEl, 'Breitengrad ungültig. z. B. 51.389567 oder N 51° 23.374′'); return;
    }
    if (lon === null || lon < -180 || lon > 180) {
      showError(errEl, 'Längengrad ungültig. z. B. 7.702367 oder E 7° 42.142′'); return;
    }
    errEl.hidden = true;

    saveGotoTarget(latRaw, lonRaw);
    onDoneCb({
      id: 'goto-target',
      name: 'Gehe zu',
      beschreibung: '',
      codewort: null,
      latitude: lat,
      longitude: lon,
    });
  });
}
```

The top of `js/goto.js` now needs the `parseCoordinate` import added alongside the existing
code — place `import { parseCoordinate } from './geo.js';` at the very top of the file (above
`const STORAGE_KEY = ...`), not inline where shown above.

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `node --test tests/goto.test.js`
Expected: PASS — all 5 tests still green (the import and new function don't affect
`loadGotoTarget`/`saveGotoTarget`)

- [ ] **Step 3: Manually verify in the browser**

Serve the project locally, navigate to the (still unreachable via nav until Task 5) state is
fine to skip — this function will be exercised end-to-end in Task 7's manual verification.
Confirm only that the file has no syntax errors: `node --check js/goto.js`
Expected: no output (exits 0)

- [ ] **Step 4: Commit**

```bash
git add js/goto.js
git commit -m "feat: add Gehe-zu coordinate form rendering and validation"
```

---

### Task 4: `detail.js` — Log-/Info-Button bedingt ausblenden

**Files:**
- Modify: `js/detail.js:220-242` (the `renderDetail` function)

- [ ] **Step 1: Replace `renderDetail()`**

In `js/detail.js`, replace the existing `renderDetail` function:

```javascript
export async function renderDetail(cache, onChangedCb) {
  current = cache;
  onChanged = onChangedCb;
  arrowAngle = 0;
  lastHeading = 0;

  document.getElementById('nav-name').textContent = cache.name;
  document.getElementById('nav-dist').textContent = '…';
  document.getElementById('nav-arrow').setAttribute('hidden', ''); // <svg>: see renderArrow

  const pop = document.getElementById('nav-info-pop');
  pop.innerHTML = `<button class="nav-info-close" type="button" aria-label="Schließen">×</button>
                   <p>${escapeHtml(cache.beschreibung)}</p>`;
  pop.hidden = true;
  pop.querySelector('.nav-info-close').addEventListener('click', () => { pop.hidden = true; });

  document.getElementById('log-window').hidden = true;

  wireControls();
  initMap();
  renderDistance();
  await renderLogBody();
}
```

with:

```javascript
export async function renderDetail(cache, onChangedCb) {
  current = cache;
  onChanged = onChangedCb;
  arrowAngle = 0;
  lastHeading = 0;

  document.getElementById('nav-name').textContent = cache.name;
  document.getElementById('nav-dist').textContent = '…';
  document.getElementById('nav-arrow').setAttribute('hidden', ''); // <svg>: see renderArrow

  // Ad-hoc "Gehe zu" targets have no beschreibung/codewort — hide the controls that
  // depend on them instead of showing an empty info popup or a non-functional log.
  const hasInfo = !!cache.beschreibung;
  document.getElementById('nav-info').hidden = !hasInfo;
  const pop = document.getElementById('nav-info-pop');
  if (hasInfo) {
    pop.innerHTML = `<button class="nav-info-close" type="button" aria-label="Schließen">×</button>
                     <p>${escapeHtml(cache.beschreibung)}</p>`;
    pop.querySelector('.nav-info-close').addEventListener('click', () => { pop.hidden = true; });
  }
  pop.hidden = true;

  const hasLog = !!cache.codewort;
  document.getElementById('nav-log').hidden = !hasLog;
  document.getElementById('log-window').hidden = true;

  wireControls();
  initMap();
  renderDistance();
  if (hasLog) await renderLogBody();
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `node --test tests/geo.test.js tests/caches.test.js tests/codeword.test.js tests/orientation.test.js tests/smoke.test.js tests/goto.test.js`
Expected: PASS — `detail.js` has no existing unit tests, so this just confirms no regression
elsewhere

- [ ] **Step 3: Check the file has no syntax errors**

Run: `node --check js/detail.js`
Expected: no output (exits 0)

- [ ] **Step 4: Commit**

```bash
git add js/detail.js
git commit -m "feat: hide nav-log/nav-info when target has no codewort/beschreibung"
```

---

### Task 5: `js/app.js` — Gehe-zu-View verdrahten

**Files:**
- Modify: `js/app.js:1-26` (imports, VIEWS, showView)
- Modify: `js/app.js:93-107` (add `startGotoNav` after `startCacheEditor`)

- [ ] **Step 1: Add the import**

Change:

```javascript
import { openCacheEditor } from './cache-editor.js';
```

to:

```javascript
import { openCacheEditor } from './cache-editor.js';
import { openGotoForm } from './goto.js';
```

- [ ] **Step 2: Add `'goto'` to VIEWS**

Change:

```javascript
const VIEWS = ['rules', 'list', 'map', 'detail', 'cache-editor'];
```

to:

```javascript
const VIEWS = ['rules', 'list', 'map', 'goto', 'detail', 'cache-editor'];
```

- [ ] **Step 3: Render the form whenever the goto view is shown**

Change `showView`:

```javascript
function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  // Detail is full-screen: hide the app header and bottom nav so the map fills.
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail' || name === 'cache-editor';
  if (name === 'map') { refreshMap(); focusUser(); }
}
```

to:

```javascript
function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  // Detail is full-screen: hide the app header and bottom nav so the map fills.
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail' || name === 'cache-editor';
  if (name === 'map') { refreshMap(); focusUser(); }
  // Re-render the form every time the goto tab is opened, so it picks up the
  // last-saved target and resets validation state (e.g. after coming back from nav).
  if (name === 'goto') { openGotoForm(startGotoNav); }
}
```

- [ ] **Step 4: Add `startGotoNav`**

After the existing `startCacheEditor` function:

```javascript
async function startCacheEditor(cache) {
  openCacheEditor(cache, async (event) => {
    if (event === 'back') { showView('list'); return; }
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

add:

```javascript
async function startGotoNav(target) {
  // activeCacheId also drives whether startGps() forwards live GPS/heading updates
  // to the nav view (see startGps below) — it must be truthy while this nav is open.
  activeCacheId = target.id;
  await requestOrientationPermission();
  await renderDetail(target, async (event) => {
    if (event === 'back') { activeCacheId = null; showView('goto'); }
  });
  showView('detail');
  if (userPos) updateDetailLocation(userPos); // after the view is visible, so the map sizes correctly
}
```

- [ ] **Step 5: Run the full test suite**

Run: `node --test tests/geo.test.js tests/caches.test.js tests/codeword.test.js tests/orientation.test.js tests/smoke.test.js tests/goto.test.js`
Expected: PASS

- [ ] **Step 6: Check the file has no syntax errors**

Run: `node --check js/app.js`
Expected: no output (exits 0)

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat: wire Gehe-zu view into app.js (VIEWS, showView, startGotoNav)"
```

---

### Task 6: Service Worker v14

**Files:**
- Modify: `service-worker.js:2` (cache version)
- Modify: `service-worker.js:16` (APP_SHELL — add `js/goto.js`)

- [ ] **Step 1: Bump the cache version**

Change:

```javascript
const CACHE_NAME = 'rsh-geocaching-v13';
```

to:

```javascript
const CACHE_NAME = 'rsh-geocaching-v14';
```

- [ ] **Step 2: Add `js/goto.js` to the app shell**

Change:

```javascript
  'js/detail.js',
  'js/cache-editor.js',
```

to:

```javascript
  'js/detail.js',
  'js/cache-editor.js',
  'js/goto.js',
```

- [ ] **Step 3: Check the file has no syntax errors**

Run: `node --check service-worker.js`
Expected: no output (exits 0)

- [ ] **Step 4: Commit**

```bash
git add service-worker.js
git commit -m "chore: bump service worker cache to v14, add js/goto.js to app shell"
```

---

### Task 7: Manuelle Verifizierung (Nutzer, Smartphone)

**Files:** none — this task only verifies the behavior built in Tasks 1-6.

- [ ] **Step 1: Open the app and tap "📍 Gehe zu" in the bottom nav**

Expected: The coordinate form appears with empty (or previously-saved, on repeat visits)
latitude/longitude fields, a hint text, and a "Los geht's" button. No GPS button is present.

- [ ] **Step 2: Submit invalid input**

Type `abc` into the latitude field, leave longitude empty, tap "Los geht's".
Expected: Red error message appears below the fields; the view does not change.

- [ ] **Step 3: Submit a valid coordinate**

Enter `51.389567` (latitude) and `7.702367` (longitude), tap "Los geht's".
Expected: App switches to the full-screen navigation view. Header and bottom-nav are hidden.
Map, direction arrow, and distance behave exactly as for a real cache. The title at the top
shows "Gehe zu". Neither the Log button (📝) nor the Info button (i) are visible in the top/
bottom bars.

- [ ] **Step 4: Walk around / move and confirm live tracking**

Expected: distance updates, direction arrow rotates, orange trail is drawn — same as the
existing cache navigation behavior, confirming `activeCacheId` correctly enables live updates
for the synthetic target.

- [ ] **Step 5: Tap "‹ Zurück"**

Expected: Returns to the `#view-goto` coordinate form (not the cache list), with the
just-used coordinates pre-filled (`51.389567` / `7.702367`).

- [ ] **Step 6: Close and reopen the app, tap "📍 Gehe zu" again**

Expected: The form still shows `51.389567` / `7.702367`, confirming `localStorage`
persistence survives a reload.

- [ ] **Step 7: Confirm regular caches are unaffected**

Open a real cache (server or student) from the list. Expected: Log button and Info button
(if the cache has a `beschreibung`) are visible and work as before; "Zurück" returns to the
cache list as before.
