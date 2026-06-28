# RSH Geocaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-independent Progressive Web App that lets students at Realschule am Hemberg find teacher-hidden geocaches near school using GPS distance/direction, a map, a codeword proof, and a photo — with progress stored locally.

**Architecture:** Static site (HTML + CSS + Vanilla JS ES modules), no build step. Pure logic (codeword check, geo math, caches parsing) lives in dependency-free ES modules unit-tested with Node's built-in test runner. Browser-only concerns (Geolocation, DeviceOrientation, IndexedDB, Leaflet map, camera, service worker) live in separate modules tested manually on real devices. Single-page app with view switching; school-branded high-contrast UI for outdoor readability.

**Tech Stack:** HTML5, CSS (custom properties), Vanilla JavaScript (ES modules), Leaflet 1.9.4 (vendored locally), IndexedDB, Service Worker + Web App Manifest, Node `--test` for unit tests.

**Prerequisites the engineer must have:** Node.js 18+ installed (`node --version`), `git`, and a way to serve the folder over HTTP for manual testing (`python -m http.server` or `npx serve`). The repo is already a git repository.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Marks project as ES modules, defines `npm test` → `node --test`. No dependencies. |
| `.gitignore` | Ignore OS/editor cruft. |
| `index.html` | App shell: all views (rules, list, map, detail) as hidden sections + nav. |
| `css/style.css` | School-color CSS variables, high-contrast outdoor-readable layout. |
| `js/app.js` | Entry point: wires modules, view router, GPS loop, renders. |
| `js/codeword.js` | Pure: normalize + check codeword. (tested) |
| `js/geo.js` | Pure: Haversine distance, bearing, distance formatting. (tested) |
| `js/caches.js` | Pure `parseCaches()` + browser `loadCaches()`. (parse tested) |
| `js/rules.js` | Rule texts (3 sections) + render helper. |
| `js/progress.js` | IndexedDB: done-status, doneAt, photos. (manual) |
| `js/location.js` | Geolocation `watchPosition` + DeviceOrientation wrappers. (manual) |
| `js/map.js` | Leaflet map, current-location + cache markers. (manual) |
| `js/detail.js` | Cache detail view: distance, arrow, photo capture, codeword, photos. (manual) |
| `data/caches.json` | Cache data (teachers edit). Ships with sample data. |
| `vendor/leaflet/leaflet.js` + `leaflet.css` | Vendored Leaflet (offline app-shell). |
| `img/` | Logo + PWA icons. |
| `manifest.webmanifest` | PWA manifest. |
| `service-worker.js` | Caches app shell (HTML/CSS/JS/caches.json/Leaflet) for offline load. |
| `tests/*.test.js` | Node unit tests for pure modules. |
| `README.md` | Run/test/host/QR instructions. |

---

## Task 1: Project setup + Node test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/smoke.test.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "rsh-geocaching",
  "version": "1.0.0",
  "description": "Geocaching-PWA für die Projektwoche der Realschule am Hemberg",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
# OS / editor
.DS_Store
Thumbs.db
*.swp
.idea/
.vscode/

# Node (none installed, but guard anyway)
node_modules/
```

- [ ] **Step 3: Write a smoke test to prove the harness runs**

Create `tests/smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test harness runs', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS — output contains `# pass 1` and `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore tests/smoke.test.js
git commit -m "chore: project setup and node test harness"
```

---

## Task 2: Codeword logic (TDD)

**Files:**
- Create: `js/codeword.js`
- Test: `tests/codeword.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/codeword.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCodeword, checkCodeword } from '../js/codeword.js';

test('normalize trims and lowercases', () => {
  assert.equal(normalizeCodeword('  Eichhörnchen  '), 'eichhörnchen');
  assert.equal(normalizeCodeword(null), '');
});

test('correct codeword matches regardless of case and spaces', () => {
  assert.equal(checkCodeword('  EICHHÖRNCHEN ', 'Eichhörnchen'), true);
});

test('wrong codeword does not match', () => {
  assert.equal(checkCodeword('Fuchs', 'Eichhörnchen'), false);
});

test('empty expected never matches', () => {
  assert.equal(checkCodeword('', ''), false);
  assert.equal(checkCodeword('   ', '   '), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/codeword.test.js`
Expected: FAIL — cannot find module `../js/codeword.js`.

- [ ] **Step 3: Write minimal implementation**

Create `js/codeword.js`:

```js
// Pure codeword logic — no browser APIs, importable by tests.

export function normalizeCodeword(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

export function checkCodeword(input, expected) {
  const normExpected = normalizeCodeword(expected);
  if (normExpected === '') return false;
  return normalizeCodeword(input) === normExpected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/codeword.test.js`
Expected: PASS — `# pass 4`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/codeword.js tests/codeword.test.js
git commit -m "feat: tolerant codeword check"
```

---

## Task 3: Geo math — distance, bearing, formatting (TDD)

**Files:**
- Create: `js/geo.js`
- Test: `tests/geo.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/geo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, bearingDegrees, formatDistance } from '../js/geo.js';

test('distance is zero for identical points', () => {
  assert.equal(distanceMeters(51, 7, 51, 7), 0);
});

test('0.01 degree latitude is about 1112 m', () => {
  const d = distanceMeters(51.0, 7.0, 51.01, 7.0);
  assert.ok(Math.abs(d - 1112) < 5, `expected ~1112, got ${d}`);
});

test('bearing due north is ~0 and due east is ~90', () => {
  assert.ok(Math.abs(bearingDegrees(0, 0, 1, 0) - 0) < 0.5);
  assert.ok(Math.abs(bearingDegrees(0, 0, 0, 1) - 90) < 0.5);
});

test('formatDistance shows meters under 1 km and km above', () => {
  assert.equal(formatDistance(500), '500 m');
  assert.equal(formatDistance(1500), '1,50 km');
  assert.equal(formatDistance(NaN), '–');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/geo.test.js`
Expected: FAIL — cannot find module `../js/geo.js`.

- [ ] **Step 3: Write minimal implementation**

Create `js/geo.js`:

```js
// Pure geographic math — no browser APIs, importable by tests.

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function bearingDegrees(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '–';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/geo.test.js`
Expected: PASS — `# pass 4`.

- [ ] **Step 5: Commit**

```bash
git add js/geo.js tests/geo.test.js
git commit -m "feat: haversine distance, bearing, distance formatting"
```

---

## Task 4: Caches parsing + validation (TDD) and sample data

**Files:**
- Create: `js/caches.js`
- Create: `data/caches.json`
- Test: `tests/caches.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/caches.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaches } from '../js/caches.js';

const valid = [
  {
    id: 'cache-01',
    name: 'Der alte Baum',
    beschreibung: 'Suche bei der großen Eiche.',
    latitude: 51.1234,
    longitude: 7.5678,
    codewort: 'Eichhörnchen'
  }
];

test('parses a valid cache array', () => {
  const result = parseCaches(valid);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cache-01');
  assert.equal(typeof result[0].latitude, 'number');
});

test('parses from a JSON string', () => {
  const result = parseCaches(JSON.stringify(valid));
  assert.equal(result[0].name, 'Der alte Baum');
});

test('rejects non-array input', () => {
  assert.throws(() => parseCaches({ id: 'x' }), /Liste/);
});

test('rejects a missing required field', () => {
  const bad = [{ id: 'c', name: '', beschreibung: 'b', latitude: 51, longitude: 7, codewort: 'k' }];
  assert.throws(() => parseCaches(bad), /name/);
});

test('rejects an out-of-range latitude', () => {
  const bad = [{ id: 'c', name: 'n', beschreibung: 'b', latitude: 999, longitude: 7, codewort: 'k' }];
  assert.throws(() => parseCaches(bad), /latitude/);
});

test('rejects duplicate ids', () => {
  const dup = [valid[0], valid[0]];
  assert.throws(() => parseCaches(dup), /doppelt|mehrfach|id/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/caches.test.js`
Expected: FAIL — cannot find module `../js/caches.js`.

- [ ] **Step 3: Write minimal implementation**

Create `js/caches.js`:

```js
// Pure caches parsing/validation + a thin browser loader.

const REQUIRED_STRINGS = ['id', 'name', 'beschreibung', 'codewort'];

function validateCache(raw, index) {
  const where = `Eintrag ${index + 1}`;
  for (const field of REQUIRED_STRINGS) {
    if (typeof raw[field] !== 'string' || raw[field].trim() === '') {
      throw new Error(`${where}: Feld "${field}" fehlt oder ist leer.`);
    }
  }
  const lat = Number(raw.latitude);
  const lon = Number(raw.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`${where}: "latitude" ist ungültig (${raw.latitude}).`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error(`${where}: "longitude" ist ungültig (${raw.longitude}).`);
  }
  return {
    id: raw.id,
    name: raw.name,
    beschreibung: raw.beschreibung,
    codewort: raw.codewort,
    latitude: lat,
    longitude: lon
  };
}

export function parseCaches(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(data)) {
    throw new Error('caches.json muss eine Liste (Array) von Caches sein.');
  }
  const seen = new Set();
  return data.map((raw, i) => {
    const cache = validateCache(raw, i);
    if (seen.has(cache.id)) {
      throw new Error(`Die id "${cache.id}" kommt doppelt vor.`);
    }
    seen.add(cache.id);
    return cache;
  });
}

export async function loadCaches(url = 'data/caches.json') {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`caches.json konnte nicht geladen werden (HTTP ${res.status}).`);
  }
  return parseCaches(await res.text());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/caches.test.js`
Expected: PASS — `# pass 6`.

- [ ] **Step 5: Create sample `data/caches.json`**

```json
[
  {
    "id": "cache-01",
    "name": "Beispiel: Der alte Baum",
    "beschreibung": "Suche bei der großen Eiche am Rand des Schulhofs.",
    "latitude": 51.4458,
    "longitude": 7.6794,
    "codewort": "Eichhörnchen"
  },
  {
    "id": "cache-02",
    "name": "Beispiel: Versteckte Bank",
    "beschreibung": "Schau unter der Holzbank im Park.",
    "latitude": 51.4471,
    "longitude": 7.6810,
    "codewort": "Specht"
  }
]
```

> NOTE for teachers: these are placeholder coordinates near the school. Replace `latitude`, `longitude`, `codewort`, `name`, `beschreibung` with real cache data before the project week.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS — `# pass 15` (smoke 1 + codeword 4 + geo 4 + caches 6).

- [ ] **Step 7: Commit**

```bash
git add js/caches.js tests/caches.test.js data/caches.json
git commit -m "feat: caches parsing/validation + sample data"
```

---

## Task 5: App shell HTML + school-color CSS theme

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#3C8A5B" />
  <title>RSH Geocaching</title>
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="app-header">
    <h1>RSH Geocaching</h1>
    <span id="gps-status" class="gps-status">GPS wird gesucht…</span>
  </header>

  <main>
    <!-- Rules view -->
    <section id="view-rules" class="view" hidden>
      <div id="rules-content"></div>
      <button id="rules-accept" class="btn btn-primary btn-big">Verstanden – los geht's</button>
    </section>

    <!-- List view -->
    <section id="view-list" class="view" hidden>
      <ul id="cache-list" class="cache-list"></ul>
    </section>

    <!-- Map view -->
    <section id="view-map" class="view" hidden>
      <div id="map"></div>
    </section>

    <!-- Detail view -->
    <section id="view-detail" class="view" hidden>
      <div id="detail-content"></div>
    </section>
  </main>

  <nav class="bottom-nav" id="bottom-nav" hidden>
    <button data-view="list" class="nav-btn">Liste</button>
    <button data-view="map" class="nav-btn">Karte</button>
    <button data-view="rules" class="nav-btn">Regeln</button>
  </nav>

  <!-- Leaflet must load as a classic script (global `L`) before the modules. -->
  <script src="vendor/leaflet/leaflet.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/style.css`**

```css
:root {
  --rsh-gruen: #62B24F;
  --rsh-gruen-dunkel: #3C8A5B;
  --rsh-blau: #6E9AC8;
  --rsh-blau-dunkel: #2F4D6E;
  --rsh-grau: #9E9E9E;
  --rsh-weiss: #FFFFFF;
  --text: #1c1c1c;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--rsh-weiss);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 18px;
  line-height: 1.4;
}

body { display: flex; flex-direction: column; min-height: 100vh; }

.app-header {
  background: var(--rsh-gruen-dunkel);
  color: var(--rsh-weiss);
  padding: 0.6rem 1rem;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.app-header h1 { font-size: 1.3rem; margin: 0; }
.gps-status { font-size: 0.85rem; opacity: 0.95; }

main { flex: 1 1 auto; overflow-y: auto; }
.view { padding: 1rem; }
#view-map { padding: 0; height: 100%; }
#map { width: 100%; height: 100%; min-height: 60vh; }

.btn {
  display: inline-block;
  border: none;
  border-radius: 10px;
  padding: 0.9rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-big { width: 100%; padding: 1.1rem; font-size: 1.25rem; }
.btn-primary { background: var(--rsh-gruen-dunkel); color: var(--rsh-weiss); }
.btn-secondary { background: var(--rsh-blau-dunkel); color: var(--rsh-weiss); }
.btn-ghost { background: #eef2f6; color: var(--rsh-blau-dunkel); }

.cache-list { list-style: none; margin: 0; padding: 0; }
.cache-item {
  border: 2px solid #e2e8ee;
  border-radius: 12px;
  padding: 0.9rem;
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  cursor: pointer;
}
.cache-item.done { border-color: var(--rsh-gruen); background: #f2faf0; }
.cache-item .info { flex: 1 1 auto; }
.cache-item .name { font-weight: 700; font-size: 1.1rem; }
.cache-item .desc { color: #555; font-size: 0.95rem; }
.cache-item .dist { font-size: 1.6rem; font-weight: 800; color: var(--rsh-blau-dunkel); white-space: nowrap; }
.badge { font-size: 1.5rem; }

.bottom-nav {
  display: flex;
  border-top: 2px solid #e2e8ee;
  background: var(--rsh-weiss);
}
.nav-btn {
  flex: 1;
  padding: 0.9rem;
  border: none;
  background: none;
  font-size: 1rem;
  font-weight: 700;
  color: var(--rsh-blau-dunkel);
  cursor: pointer;
}
.nav-btn.active { color: var(--rsh-gruen-dunkel); border-top: 3px solid var(--rsh-gruen-dunkel); }

/* Detail */
.detail-name { font-size: 1.4rem; font-weight: 800; margin: 0 0 0.3rem; }
.detail-dist { font-size: 3rem; font-weight: 900; color: var(--rsh-blau-dunkel); text-align: center; }
.detail-arrow { font-size: 4rem; text-align: center; transition: transform 0.2s ease; }
.detail-map { width: 100%; height: 220px; border-radius: 12px; margin: 0.6rem 0; }
.photo-thumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
.photo-thumbs img { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; }
.hint { background: #eef2f6; border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
.error { color: #b00020; font-weight: 700; }
.rules-section h2 { color: var(--rsh-gruen-dunkel); margin-bottom: 0.2rem; }
.feedback-ok { color: var(--rsh-gruen-dunkel); font-weight: 800; }
```

- [ ] **Step 3: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: app shell HTML and school-color theme"
```

---

## Task 6: Vendor Leaflet locally

**Files:**
- Create: `vendor/leaflet/leaflet.js`
- Create: `vendor/leaflet/leaflet.css`

- [ ] **Step 1: Download Leaflet 1.9.4 into the vendor folder**

Run (from project root):

```bash
mkdir -p vendor/leaflet
curl -L -o vendor/leaflet/leaflet.js  https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
curl -L -o vendor/leaflet/leaflet.css https://unpkg.com/leaflet@1.9.4/dist/leaflet.css
```

- [ ] **Step 2: Verify the files exist and are non-empty**

Run: `ls -l vendor/leaflet/`
Expected: `leaflet.js` (~140 KB) and `leaflet.css` (~14 KB), both non-zero size.

> NOTE: We use Leaflet `divIcon` markers (Task 9/10), so Leaflet's `images/` marker PNGs are NOT required. Do not reference `marker-icon.png`.

- [ ] **Step 3: Commit**

```bash
git add vendor/leaflet/leaflet.js vendor/leaflet/leaflet.css
git commit -m "chore: vendor Leaflet 1.9.4 for offline app shell"
```

---

## Task 7: Rules module + first-run gating

**Files:**
- Create: `js/rules.js`

- [ ] **Step 1: Create `js/rules.js`**

```js
// Rule texts (draft — finalized after the test phase) and rendering.

const RULES_ACCEPTED_KEY = 'rsh_rules_accepted_v1';

export const RULE_SECTIONS = [
  {
    titel: '🧭 Geocaching-Regeln',
    punkte: [
      'Suche den Cache vorsichtig und unauffällig – andere müssen ihn auch noch finden können.',
      'Lege den Cache (die Dose) genau dort wieder zurück, wo du ihn gefunden hast, und verstecke ihn wieder gut.',
      'Nimm nichts aus der Dose heraus und lass den Zettel mit dem Codewort drin.',
      'Trage deinen Fund in der App ein und mach ein Foto als Erinnerung.',
      'Hab Geduld – manchmal ist ein Cache gut versteckt. Aufgeben gilt nicht gleich!'
    ]
  },
  {
    titel: '⚠️ Sicherheit',
    punkte: [
      'Achte auf den Verkehr! Schau beim Gehen nicht nur aufs Handy.',
      'Bleibt als Gruppe zusammen und entfernt euch nicht vom vereinbarten Gebiet.',
      'Klettere nicht auf gefährliche Stellen (Mauern, Bäume, ans Wasser) – kein Cache ist ein Risiko wert.',
      'Bei Problemen oder wenn ihr euch verlaufen habt: Ruft eure Lehrerin oder euren Lehrer an.',
      'Achte auf das Wetter und zieh dich passend an.'
    ]
  },
  {
    titel: '🌳 Umwelt',
    punkte: [
      'Hinterlasse die Natur so, wie du sie vorgefunden hast – nimm deinen Müll wieder mit.',
      'Bleib möglichst auf den Wegen und zertrample keine Pflanzen.',
      'Stör keine Tiere und respektiere ihren Lebensraum.',
      'Sei rücksichtsvoll zu anderen Menschen, die unterwegs sind.'
    ]
  }
];

export function rulesAccepted() {
  return localStorage.getItem(RULES_ACCEPTED_KEY) === 'true';
}

export function acceptRules() {
  localStorage.setItem(RULES_ACCEPTED_KEY, 'true');
}

export function renderRules(container) {
  container.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent =
    'Die Karte braucht Internet. Entfernung und Richtung zum Cache funktionieren immer – auch ohne Netz.';
  container.appendChild(intro);

  for (const section of RULE_SECTIONS) {
    const wrap = document.createElement('div');
    wrap.className = 'rules-section';
    const h = document.createElement('h2');
    h.textContent = section.titel;
    wrap.appendChild(h);
    const ul = document.createElement('ul');
    for (const punkt of section.punkte) {
      const li = document.createElement('li');
      li.textContent = punkt;
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    container.appendChild(wrap);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/rules.js
git commit -m "feat: rule texts, first-run gating, render helper"
```

---

## Task 8: Progress store (IndexedDB)

**Files:**
- Create: `js/progress.js`

- [ ] **Step 1: Create `js/progress.js`**

```js
// IndexedDB-backed progress: done-status + photos per cache id.
// Falls back to in-memory if IndexedDB is unavailable, so the app never crashes.

const DB_NAME = 'rsh-geocaching';
const DB_VERSION = 1;
const STORE_PROGRESS = 'progress'; // key: cacheId -> { done, doneAt }
const STORE_PHOTOS = 'photos';     // key: auto -> { cacheId, blob, createdAt }

let dbPromise = null;
const memory = { progress: new Map(), photos: [] };
let useMemory = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      useMemory = true;
      reject(new Error('IndexedDB nicht verfügbar'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS);
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const s = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('byCache', 'cacheId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useMemory = true; reject(req.error); };
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

export async function markDone(cacheId) {
  const record = { done: true, doneAt: new Date().toISOString() };
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const r = tx(db, STORE_PROGRESS, 'readwrite').put(record, cacheId);
      r.onsuccess = res; r.onerror = () => rej(r.error);
    });
  } catch {
    useMemory = true;
    memory.progress.set(cacheId, record);
  }
}

export async function isDone(cacheId) {
  try {
    if (useMemory) return memory.progress.get(cacheId)?.done === true;
    const db = await openDb();
    return await new Promise((res) => {
      const r = tx(db, STORE_PROGRESS, 'readonly').get(cacheId);
      r.onsuccess = () => res(r.result?.done === true);
      r.onerror = () => res(false);
    });
  } catch {
    return memory.progress.get(cacheId)?.done === true;
  }
}

export async function getDoneIds() {
  try {
    if (useMemory) {
      return new Set([...memory.progress.entries()].filter(([, v]) => v.done).map(([k]) => k));
    }
    const db = await openDb();
    return await new Promise((res) => {
      const ids = new Set();
      const store = tx(db, STORE_PROGRESS, 'readonly');
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          if (cursor.value?.done) ids.add(cursor.key);
          cursor.continue();
        } else {
          res(ids);
        }
      };
      cursorReq.onerror = () => res(ids);
    });
  } catch {
    return new Set();
  }
}

export async function addPhoto(cacheId, blob) {
  const record = { cacheId, blob, createdAt: new Date().toISOString() };
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const r = tx(db, STORE_PHOTOS, 'readwrite').add(record);
      r.onsuccess = res; r.onerror = () => rej(r.error);
    });
  } catch {
    useMemory = true;
    memory.photos.push(record);
  }
}

export async function getPhotos(cacheId) {
  try {
    if (useMemory) return memory.photos.filter((p) => p.cacheId === cacheId).map((p) => p.blob);
    const db = await openDb();
    return await new Promise((res) => {
      const blobs = [];
      const index = tx(db, STORE_PHOTOS, 'readonly').index('byCache');
      const cursorReq = index.openCursor(IDBKeyRange.only(cacheId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { blobs.push(cursor.value.blob); cursor.continue(); }
        else { res(blobs); }
      };
      cursorReq.onerror = () => res(blobs);
    });
  } catch {
    return memory.photos.filter((p) => p.cacheId === cacheId).map((p) => p.blob);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/progress.js
git commit -m "feat: IndexedDB progress + photo storage with in-memory fallback"
```

---

## Task 9: Location + orientation wrappers

**Files:**
- Create: `js/location.js`

- [ ] **Step 1: Create `js/location.js`**

```js
// Browser Geolocation + DeviceOrientation wrappers.
// Pure math lives in geo.js; this file only touches browser APIs.

export function watchLocation(onUpdate, onError) {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation wird von diesem Browser nicht unterstützt.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    }),
    (err) => onError(err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

// iOS 13+ requires an explicit permission request triggered by a user gesture.
export async function requestOrientationPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true; // non-iOS browsers don't gate this
}

// Calls onHeading(degrees 0..360, where 0 = north) when device heading changes.
// Returns an unsubscribe function. Returns null if orientation is unsupported.
export function watchHeading(onHeading) {
  if (!('DeviceOrientationEvent' in window)) return null;
  const handler = (event) => {
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading; // iOS: already 0=N clockwise
    } else if (typeof event.alpha === 'number') {
      heading = (360 - event.alpha) % 360; // approximate
    }
    if (heading != null && !Number.isNaN(heading)) onHeading(heading);
  };
  window.addEventListener('deviceorientation', handler, true);
  return () => window.removeEventListener('deviceorientation', handler, true);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/location.js
git commit -m "feat: geolocation and device-orientation wrappers"
```

---

## Task 10: Map module (Leaflet)

**Files:**
- Create: `js/map.js`

- [ ] **Step 1: Create `js/map.js`**

```js
// Leaflet map: online OSM tiles, current-location marker, cache markers.
// Leaflet (global `L`) is loaded via vendor/leaflet/leaflet.js in index.html.
// Uses divIcon markers so no Leaflet image assets are required.

// Default center until a GPS fix arrives — set to the school. ADJUST before the project week.
const DEFAULT_CENTER = [51.4458, 7.6794];
const DEFAULT_ZOOM = 16;

let map = null;
let userMarker = null;
const cacheMarkers = new Map(); // cacheId -> L.Marker

function dot(colorVar, sizePx) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;
           background:${colorVar};border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [sizePx, sizePx],
    iconAnchor: [sizePx / 2, sizePx / 2]
  });
}

export function initMap(elementId) {
  if (map) return map;
  map = L.map(elementId).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  return map;
}

// Re-fixes Leaflet sizing when its container becomes visible.
export function refreshMap() {
  if (map) setTimeout(() => map.invalidateSize(), 0);
}

export function setCacheMarkers(caches, doneIds, onMarkerClick) {
  if (!map) return;
  for (const m of cacheMarkers.values()) m.remove();
  cacheMarkers.clear();
  for (const cache of caches) {
    const done = doneIds.has(cache.id);
    const marker = L.marker([cache.latitude, cache.longitude], {
      icon: dot(done ? 'var(--rsh-gruen)' : 'var(--rsh-blau-dunkel)', 22)
    }).addTo(map);
    marker.bindTooltip(cache.name);
    marker.on('click', () => onMarkerClick(cache.id));
    cacheMarkers.set(cache.id, marker);
  }
}

export function setUserLocation(lat, lon) {
  if (!map) return;
  if (!userMarker) {
    userMarker = L.marker([lat, lon], { icon: dot('#1e88e5', 18) }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/map.js
git commit -m "feat: Leaflet map with online tiles and divIcon markers"
```

---

## Task 11: Detail view (distance, arrow, photo, codeword)

**Files:**
- Create: `js/detail.js`

- [ ] **Step 1: Create `js/detail.js`**

```js
// Cache detail view: live distance, direction arrow, photo capture, codeword check.

import { distanceMeters, bearingDegrees, formatDistance } from './geo.js';
import { checkCodeword } from './codeword.js';
import { addPhoto, getPhotos, markDone, isDone } from './progress.js';

let current = null;       // current cache object
let lastUserPos = null;   // { lat, lon }
let lastHeading = 0;      // device heading degrees
let miniMap = null;       // Leaflet map instance for the detail view
let miniUserMarker = null;

// Called by app.js whenever a new GPS fix arrives.
export function updateDetailLocation(pos) {
  lastUserPos = pos;
  renderDistance();
  updateMiniMapUser();
}

function userDot() {
  return L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#1e88e5;border:3px solid #fff"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function targetDot() {
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:50%;background:var(--rsh-blau-dunkel);border:3px solid #fff"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function initMiniMap() {
  if (miniMap) { miniMap.remove(); miniMap = null; miniUserMarker = null; }
  const target = [current.latitude, current.longitude];
  miniMap = L.map('detail-map', { zoomControl: false, attributionControl: false }).setView(target, 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
  L.marker(target, { icon: targetDot() }).addTo(miniMap);
  setTimeout(() => miniMap && miniMap.invalidateSize(), 0);
  updateMiniMapUser();
}

function updateMiniMapUser() {
  if (!miniMap || !lastUserPos || !current) return;
  const u = [lastUserPos.lat, lastUserPos.lon];
  if (!miniUserMarker) {
    miniUserMarker = L.marker(u, { icon: userDot() }).addTo(miniMap);
  } else {
    miniUserMarker.setLatLng(u);
  }
  miniMap.fitBounds([u, [current.latitude, current.longitude]], { padding: [30, 30], maxZoom: 17 });
}

// Called by app.js whenever device heading changes.
export function updateDetailHeading(heading) {
  lastHeading = heading;
  renderArrow();
}

function renderDistance() {
  const el = document.getElementById('detail-dist');
  if (!el || !current) return;
  if (!lastUserPos) { el.textContent = 'wird ermittelt…'; return; }
  const d = distanceMeters(lastUserPos.lat, lastUserPos.lon, current.latitude, current.longitude);
  el.textContent = formatDistance(d);
}

function renderArrow() {
  const el = document.getElementById('detail-arrow');
  if (!el || !current || !lastUserPos) return;
  const target = bearingDegrees(lastUserPos.lat, lastUserPos.lon, current.latitude, current.longitude);
  const rotation = (target - lastHeading + 360) % 360;
  el.style.transform = `rotate(${rotation}deg)`;
  el.hidden = false;
}

async function renderPhotos() {
  const wrap = document.getElementById('photo-thumbs');
  if (!wrap || !current) return;
  wrap.innerHTML = '';
  const blobs = await getPhotos(current.id);
  for (const blob of blobs) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    wrap.appendChild(img);
  }
}

export async function renderDetail(cache, container, onChanged) {
  current = cache;
  const done = await isDone(cache.id);
  container.innerHTML = `
    <button id="detail-back" class="btn btn-ghost">‹ Zurück</button>
    <h2 class="detail-name">${escapeHtml(cache.name)}</h2>
    <p>${escapeHtml(cache.beschreibung)}</p>
    <div id="detail-arrow" class="detail-arrow" hidden>⬆️</div>
    <div id="detail-dist" class="detail-dist">wird ermittelt…</div>
    <div id="detail-map" class="detail-map"></div>
    <label class="btn btn-secondary btn-big" style="text-align:center;display:block">
      📷 Foto aufnehmen
      <input id="photo-input" type="file" accept="image/*" capture="environment" hidden />
    </label>
    <div id="photo-thumbs" class="photo-thumbs"></div>
    <div id="codeword-area" style="margin-top:1rem">
      ${done
        ? '<p class="feedback-ok">✅ Cache gefunden!</p>'
        : `<input id="codeword-input" type="text" placeholder="Codewort vom Zettel"
             style="width:100%;padding:0.9rem;font-size:1.1rem;border:2px solid #ccc;border-radius:10px" />
           <button id="codeword-submit" class="btn btn-primary btn-big" style="margin-top:0.5rem">
             Gefunden – Codewort prüfen
           </button>
           <p id="codeword-feedback"></p>`}
    </div>
  `;

  container.querySelector('#detail-back').addEventListener('click', () => onChanged('back'));

  const photoInput = container.querySelector('#photo-input');
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (file) { await addPhoto(cache.id, file); await renderPhotos(); }
  });

  const submit = container.querySelector('#codeword-submit');
  if (submit) {
    submit.addEventListener('click', async () => {
      const input = container.querySelector('#codeword-input').value;
      const feedback = container.querySelector('#codeword-feedback');
      if (checkCodeword(input, cache.codewort)) {
        await markDone(cache.id);
        feedback.textContent = '';
        await renderDetail(cache, container, onChanged); // re-render as done
        onChanged('done');
      } else {
        feedback.className = 'error';
        feedback.textContent = 'Codewort stimmt nicht – schau nochmal auf den Zettel.';
      }
    });
  }

  initMiniMap();
  renderDistance();
  await renderPhotos();
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Commit**

```bash
git add js/detail.js
git commit -m "feat: cache detail view with live distance, arrow, photo, codeword"
```

---

## Task 12: App entry point — wiring, router, list rendering, GPS loop

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Create `js/app.js`**

```js
import { loadCaches } from './caches.js';
import { distanceMeters, formatDistance } from './geo.js';
import { renderRules, rulesAccepted, acceptRules } from './rules.js';
import { getDoneIds } from './progress.js';
import { watchLocation, watchHeading, requestOrientationPermission } from './location.js';
import { initMap, refreshMap, setCacheMarkers, setUserLocation } from './map.js';
import { renderDetail, updateDetailLocation, updateDetailHeading } from './detail.js';

const VIEWS = ['rules', 'list', 'map', 'detail'];
let caches = [];
let doneIds = new Set();
let userPos = null;
let activeCacheId = null;

function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('bottom-nav').hidden = name === 'rules';
  if (name === 'map') refreshMap();
}

function setGpsStatus(text) {
  document.getElementById('gps-status').textContent = text;
}

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
        <span class="name">${escapeHtml(cache.name)}</span><br>
        <span class="desc">${escapeHtml(cache.beschreibung)}</span>
      </span>
      <span class="dist">${dist == null ? '–' : formatDistance(dist)}</span>
    `;
    li.addEventListener('click', () => openDetail(cache.id));
    list.appendChild(li);
  }
}

async function openDetail(cacheId) {
  activeCacheId = cacheId;
  const cache = caches.find((c) => c.id === cacheId);
  await requestOrientationPermission();
  await renderDetail(cache, document.getElementById('detail-content'), async (event) => {
    if (event === 'back') { activeCacheId = null; showView('list'); }
    if (event === 'done') { doneIds = await getDoneIds(); renderList(); refreshMarkers(); }
  });
  if (userPos) updateDetailLocation(userPos);
  showView('detail');
}

function refreshMarkers() {
  setCacheMarkers(caches, doneIds, openDetail);
}

function startGps() {
  watchLocation(
    (pos) => {
      userPos = pos;
      setGpsStatus('GPS aktiv');
      setUserLocation(pos.lat, pos.lon);
      renderList();
      if (activeCacheId) updateDetailLocation(pos);
    },
    (err) => setGpsStatus('Kein Standort – bitte Standortzugriff erlauben')
  );
  watchHeading((heading) => { if (activeCacheId) updateDetailHeading(heading); });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function main() {
  // Nav
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.addEventListener('click', () => showView(b.dataset.view)));

  // Rules
  renderRules(document.getElementById('rules-content'));
  document.getElementById('rules-accept').addEventListener('click', () => {
    acceptRules();
    showView('list');
  });

  // Load caches
  try {
    caches = await loadCaches();
  } catch (err) {
    document.getElementById('cache-list').innerHTML =
      `<li class="error">Fehler beim Laden der Caches: ${escapeHtml(err.message)}</li>`;
  }

  doneIds = await getDoneIds();
  initMap('map');
  refreshMarkers();
  renderList();
  startGps();

  showView(rulesAccepted() ? 'list' : 'rules');

  // Register service worker (after first paint)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

main();
```

- [ ] **Step 2: Manual smoke test in a browser**

Run a local HTTPS-like server (service worker + geolocation need a secure context; `localhost` counts as secure):

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. Verify:
- Rules screen appears on first load; clicking "Verstanden" shows the list.
- The two sample caches render in the list.
- Switching to "Karte" shows the map with two markers.
- Clicking a cache opens the detail view with a distance ("wird ermittelt…" until GPS) and a working codeword field (try `Eichhörnchen` for cache-01 → marks done).

Expected: all of the above work; no console errors except possibly geolocation if denied.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: app entry point, router, list rendering, GPS loop"
```

---

## Task 13: PWA manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `img/icon-192.png`, `img/icon-512.png` (from the school logo)

- [ ] **Step 1: Create PWA icons from the logo**

Generate two square PNG icons from `rsh_logo_original.png` (white background, centered). If ImageMagick is available:

```bash
mkdir -p img
magick rsh_logo_original.png -background white -gravity center -resize 192x192 -extent 192x192 img/icon-192.png
magick rsh_logo_original.png -background white -gravity center -resize 512x512 img/icon-512.png
```

If ImageMagick is not available, create two plain placeholder PNGs (solid green `#3C8A5B`) at 192×192 and 512×512 using any tool, and note that final icons come after the test phase. Verify both files exist and are non-empty: `ls -l img/`.

- [ ] **Step 2: Create `manifest.webmanifest`**

```json
{
  "name": "RSH Geocaching",
  "short_name": "RSH Cache",
  "description": "Geocaching für die Projektwoche der Realschule am Hemberg",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFFFFF",
  "theme_color": "#3C8A5B",
  "icons": [
    { "src": "img/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "img/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: Create `service-worker.js`**

```js
// Caches the app shell so the app loads offline. Map tiles stay online (network).
const CACHE_NAME = 'rsh-geocaching-v1';
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
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'manifest.webmanifest',
  'img/icon-192.png',
  'img/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache map tiles — always go to network.
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;

  // App shell: cache-first, fall back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 4: Manual test of offline app shell**

Run `python -m http.server 8000`, open `http://localhost:8000`, load it once, then in DevTools → Network set "Offline" and reload.
Expected: the app still loads (rules/list/detail work); only the map tiles are blank while offline. The done-status and any photos persist.

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest service-worker.js img/icon-192.png img/icon-512.png
git commit -m "feat: PWA manifest, icons, app-shell service worker"
```

---

## Task 14: README with run / test / host / QR instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# RSH Geocaching

Geocaching-Web-App (PWA) für die Projektwoche der Realschule am Hemberg.
Läuft im Browser auf iOS und Android. Kein App-Store, keine Installation nötig.

## Lokal testen

Voraussetzung: Node.js 18+ (nur für die Tests) und ein einfacher Webserver.

```bash
# Unit-Tests (reine Logik)
npm test

# App lokal starten (localhost gilt als sicherer Kontext)
python -m http.server 8000
# dann http://localhost:8000 öffnen
```

GPS, Kamera und Service Worker brauchen einen **sicheren Kontext** (HTTPS oder localhost).

## Caches pflegen (für Lehrer)

Die Caches stehen in `data/caches.json`. Pro Cache:

| Feld | Bedeutung |
|---|---|
| `id` | eindeutige Kennung (z. B. `cache-01`) |
| `name` | Anzeigename |
| `beschreibung` | kurzer Hinweis |
| `latitude` / `longitude` | Koordinaten (Dezimalgrad) |
| `codewort` | Wort vom Zettel in der Dose |

Koordinaten findet man z. B. per Rechtsklick in Google Maps oder auf openstreetmap.org.

## Veröffentlichen (Hosting)

Es ist eine statische Seite — alle Dateien auf einen HTTPS-Webspace kopieren. Empfehlung
für die Testphase: **Cloudflare Pages** (kostenlos, HTTPS). Final optional auf dem
Schul-Server `rsamhemberg.de`.

Nach dem Hochladen die URL als **QR-Code** erzeugen (z. B. mit einem Online-QR-Generator)
und an die Klasse verteilen. Schüler öffnen den Code und können die Seite optional
„zum Startbildschirm hinzufügen".

## Anpassung vor der Projektwoche

- `data/caches.json`: echte Caches eintragen.
- `js/map.js`: `DEFAULT_CENTER` / `DEFAULT_ZOOM` auf die Schule setzen.
- `css/style.css`: Schulfarben (CSS-Variablen unter `:root`) bei Bedarf feinjustieren.
- Regeltexte in `js/rules.js` nach der Testphase final festlegen.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with run, test, hosting, and QR instructions"
```

---

## Final verification

- [ ] **Run the full unit-test suite**

Run: `npm test`
Expected: PASS — all tests green (`# fail 0`).

- [ ] **Manual end-to-end check on a real phone**

Host the folder somewhere with HTTPS (or use a tunnel) and open it on at least one Android and one iOS device. Verify: rules → list → map → detail → photo capture → codeword "found" → list shows ✅, and the direction arrow reacts to turning (iOS will prompt for motion permission).

---

## Notes for the executor

- **No npm dependencies are installed.** `npm test` uses Node's built-in runner only. Do not run `npm install`.
- **Pure modules** (`codeword.js`, `geo.js`, `caches.js`) must stay free of browser globals so the Node tests keep working.
- **`DEFAULT_CENTER`** in `js/map.js` and the sample coordinates in `data/caches.json` are placeholders near the school — real values come from the teachers (a documented open point in the spec).
- **Direction arrow** is best-effort (DeviceOrientation); the large distance number is the primary navigation aid, per the spec.
