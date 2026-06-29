# Navigationsseite Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Detail-/Navigationsansicht eines Caches wird zu einer Vollbild-Karte mit Overlay-Leisten umgebaut (Pfeil, Distanz, Info, Zoom-/Zentrier-Buttons, Luftlinie, zurückgelegter Weg, Log-Vollbildfenster) und zwei Kompass-/Pfeil-Fehler werden behoben.

**Architecture:** Reine Geometrie/Heading-Logik kommt als testbare Funktionen nach `js/geo.js`. `js/location.js` nutzt absolute Geräteorientierung. `js/detail.js` wird neu aufgebaut und steuert eine dauerhafte Leaflet-Karte mit Overlay-Markup, das statisch in `index.html` liegt. `js/app.js` blendet Kopf-/Fußleiste in der Detailansicht aus.

**Tech Stack:** Vanilla ES-Module, Leaflet (global `L`), `node --test` für Unit-Tests reiner Funktionen, IndexedDB (`js/progress.js`, unverändert).

**Spec:** `docs/superpowers/specs/2026-06-29-navigationsseite-redesign-design.md`

---

## Dateiübersicht

- **`js/geo.js`** (Modify) — zwei neue reine Funktionen: `angleDelta` (B), `normalizeHeading` (A).
- **`tests/orientation.test.js`** (Create) — Unit-Tests für `angleDelta` und `normalizeHeading`.
- **`js/location.js`** (Modify) — `watchHeading` nutzt `deviceorientationabsolute` + `normalizeHeading` (A).
- **`css/style.css`** (Modify) — Stile für Vollbild-Navigationsansicht, Leisten, Buttons, Info-Popover, Log-Fenster (D, H, I, G).
- **`index.html`** (Modify) — Detail-Ansicht erhält statisches Overlay-Markup + Log-Fenster.
- **`js/detail.js`** (Rewrite) — Vollbild-Karte, Pfeil-Rotation (B), `fitBounds` (C), Luftlinie (E), Spur (F), Map-Buttons (H), Info-Popover (I), Log-Fenster (G).
- **`js/app.js`** (Modify) — Aufruf von `renderDetail` angepasst; Kopf-/Fußleiste in Detailansicht ausblenden (D).

---

### Task 1: Reine Winkel-Funktion `angleDelta` (B)

**Files:**
- Modify: `js/geo.js`
- Test: `tests/orientation.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/orientation.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleDelta } from '../js/geo.js';

test('angleDelta takes the short way forward across 0', () => {
  // from 358° toward 2° must be +4°, NOT -356°
  assert.equal(angleDelta(2, 358), 4);
});

test('angleDelta takes the short way backward across 0', () => {
  assert.equal(angleDelta(358, 2), -4);
});

test('angleDelta is 0 for equal angles', () => {
  assert.equal(angleDelta(90, 90), 0);
});

test('angleDelta works with an unwrapped (large) current angle', () => {
  // current may have accumulated past 360 in the UI
  assert.equal(angleDelta(10, 730), 0); // 730 ≡ 10 (mod 360)
});

test('angleDelta result is always within -180..180', () => {
  for (let t = 0; t < 360; t += 17) {
    for (let c = 0; c < 360; c += 23) {
      const d = angleDelta(t, c);
      assert.ok(d > -180.0001 && d <= 180.0001, `delta ${d} out of range for ${t},${c}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/orientation.test.js`
Expected: FAIL — `angleDelta` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `js/geo.js`:

```js
// Smallest signed rotation (degrees, -180..180) to bring `current` onto `target`.
// Used to rotate the direction arrow the short way instead of spinning back
// ~359° when the bearing wraps across 0°.
export function angleDelta(target, current) {
  return ((target - current + 540) % 360) - 180;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/orientation.test.js`
Expected: PASS (the `angleDelta` tests; `normalizeHeading` tests are added in Task 2).

- [ ] **Step 5: Commit**

```bash
git add js/geo.js tests/orientation.test.js
git commit -m "feat: angleDelta for continuous arrow rotation (B)"
```

---

### Task 2: Reine Heading-Funktion `normalizeHeading` (A)

**Files:**
- Modify: `js/geo.js`
- Test: `tests/orientation.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/orientation.test.js`:

```js
import { normalizeHeading } from '../js/geo.js';

test('normalizeHeading prefers iOS webkitCompassHeading (already absolute)', () => {
  assert.equal(normalizeHeading({ webkitCompassHeading: 90 }), 90);
});

test('normalizeHeading converts absolute alpha to a compass heading', () => {
  // alpha 90 (counter-clockwise from east-ish) -> compass 270
  assert.equal(normalizeHeading({ alpha: 90, absolute: true }), 270);
});

test('normalizeHeading ignores non-absolute alpha', () => {
  assert.equal(normalizeHeading({ alpha: 90, absolute: false }), null);
});

test('normalizeHeading returns null when no usable data', () => {
  assert.equal(normalizeHeading({}), null);
  assert.equal(normalizeHeading({ alpha: null, absolute: true }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/orientation.test.js`
Expected: FAIL — `normalizeHeading` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `js/geo.js`:

```js
// Turns a DeviceOrientation-like event into an absolute compass heading
// (0 = north, clockwise) or null if no absolute reading is available.
// iOS exposes webkitCompassHeading (already absolute). Android only gives a
// trustworthy north reference when event.absolute === true.
export function normalizeHeading(e) {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return e.webkitCompassHeading;
  }
  if (e.absolute === true && typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/orientation.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add js/geo.js tests/orientation.test.js
git commit -m "feat: normalizeHeading for absolute compass heading (A)"
```

---

### Task 3: `location.js` nutzt absolute Orientierung (A)

**Files:**
- Modify: `js/location.js`

- [ ] **Step 1: Replace `watchHeading` to use absolute orientation**

In `js/location.js`, add the import at the top (below the file's leading comment):

```js
import { normalizeHeading } from './geo.js';
```

Replace the whole `watchHeading` function (and its leading comment) with:

```js
// Calls onHeading(degrees 0..360, where 0 = north) when device heading changes.
// Prefers the absolute orientation event so the arrow is correct regardless of
// how the phone was held when the page loaded. Returns an unsubscribe function,
// or null if orientation is unsupported.
export function watchHeading(onHeading) {
  if (!('DeviceOrientationEvent' in window)) return null;
  const eventName = ('ondeviceorientationabsolute' in window)
    ? 'deviceorientationabsolute'
    : 'deviceorientation';
  const handler = (event) => {
    const heading = normalizeHeading(event);
    if (heading != null) onHeading(heading);
  };
  window.addEventListener(eventName, handler, true);
  return () => window.removeEventListener(eventName, handler, true);
}
```

- [ ] **Step 2: Verify the existing tests still pass**

Run: `node --test`
Expected: PASS — all test files green (no test imports `location.js`, but this confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add js/location.js
git commit -m "fix: use absolute device orientation for compass heading (A)"
```

---

### Task 4: CSS für Vollbild-Navigation, Leisten, Buttons, Log-Fenster (D, H, I, G)

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Append the navigation-view styles**

Append to the end of `css/style.css`:

```css
/* --- Navigation (Detail) view: full-screen map with overlay bars --- */
#view-detail { padding: 0; height: 100%; position: relative; overflow: hidden; }
.nav-map { position: absolute; inset: 0; }

.nav-topbar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 1000;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
.nav-name {
  flex: 1; font-weight: 800; font-size: 1.1rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nav-dist { font-weight: 800; font-size: 1.1rem; color: var(--rsh-blau-dunkel); white-space: nowrap; }
.nav-arrow { transition: transform 0.2s ease; transform-origin: 50% 50%; flex: none; }
.nav-info-btn {
  flex: none; width: 34px; height: 34px; border-radius: 50%;
  border: 2px solid var(--rsh-blau-dunkel); background: #fff;
  color: var(--rsh-blau-dunkel); font-weight: 800; font-style: italic;
  font-family: Georgia, serif; font-size: 1.1rem; cursor: pointer;
}

.nav-info-pop {
  position: absolute; top: 56px; right: 0.7rem; z-index: 1001;
  max-width: 70%; background: rgba(255, 255, 255, 0.97);
  border-radius: 12px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  padding: 0.7rem 0.9rem; font-size: 0.95rem;
}
.nav-info-pop p { margin: 0.2rem 0 0; }
.nav-info-close {
  float: right; border: none; background: none; line-height: 1;
  font-size: 1.3rem; font-weight: 800; color: #999; cursor: pointer;
}

.nav-mapctrl {
  position: absolute; right: 0.6rem; bottom: 5rem; z-index: 1000;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.nav-mapctrl button {
  width: 46px; height: 46px; border-radius: 50%; border: none;
  background: rgba(255, 255, 255, 0.94); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  color: var(--rsh-blau-dunkel); font-size: 1.5rem; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.nav-botbar {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.6rem 0.9rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.18);
}
.nav-back-btn {
  border: none; background: none; color: var(--rsh-blau-dunkel);
  font-weight: 800; font-size: 1rem; cursor: pointer;
}
.nav-log-btn {
  border: none; background: var(--rsh-gruen-dunkel); color: #fff;
  font-weight: 800; font-size: 1rem; padding: 0.7rem 1.5rem;
  border-radius: 12px; cursor: pointer;
}

/* Full-screen Log window over the map */
.log-window {
  position: absolute; inset: 0; z-index: 1100;
  background: var(--rsh-weiss); display: flex; flex-direction: column;
}
.log-topbar {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 0.9rem; background: var(--rsh-gruen-dunkel); color: #fff;
}
.log-topbar .nav-back-btn { color: #fff; }
.log-title { font-weight: 800; font-size: 1.1rem; }
.log-body { flex: 1 1 auto; overflow-y: auto; padding: 1rem; }
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "feat: styles for full-screen navigation view + log window (D,H,I,G)"
```

---

### Task 5: `index.html` — statisches Overlay-Markup für die Detailansicht

**Files:**
- Modify: `index.html` (the `<section id="view-detail">` block)

- [ ] **Step 1: Replace the detail-view section**

In `index.html`, replace this block:

```html
    <!-- Detail view -->
    <section id="view-detail" class="view" hidden>
      <div id="detail-content"></div>
    </section>
```

with:

```html
    <!-- Detail / navigation view -->
    <section id="view-detail" class="view" hidden>
      <div id="nav-map" class="nav-map"></div>

      <div class="nav-topbar">
        <span id="nav-name" class="nav-name"></span>
        <span id="nav-dist" class="nav-dist">…</span>
        <svg id="nav-arrow" class="nav-arrow" width="30" height="30" viewBox="0 0 40 40"
             xmlns="http://www.w3.org/2000/svg" hidden>
          <polygon points="20,2 34,36 20,27 6,36" fill="#d6332b" stroke="#fff"
                   stroke-width="1.2" stroke-linejoin="round" />
        </svg>
        <button id="nav-info" class="nav-info-btn" type="button" aria-label="Beschreibung">i</button>
      </div>

      <div id="nav-info-pop" class="nav-info-pop" hidden></div>

      <div class="nav-mapctrl">
        <button id="nav-zoom-in" type="button" aria-label="Vergrößern">+</button>
        <button id="nav-zoom-out" type="button" aria-label="Verkleinern">−</button>
        <button id="nav-center" type="button" aria-label="Auf meinen Standort zentrieren">
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <line x1="12" y1="1.5" x2="12" y2="5" stroke="currentColor" stroke-width="2" />
            <line x1="12" y1="19" x2="12" y2="22.5" stroke="currentColor" stroke-width="2" />
            <line x1="1.5" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="2" />
            <line x1="19" y1="12" x2="22.5" y2="12" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>

      <div class="nav-botbar">
        <button id="nav-back" class="nav-back-btn" type="button">‹ Zurück</button>
        <button id="nav-log" class="nav-log-btn" type="button">📝 Log</button>
      </div>

      <div id="log-window" class="log-window" hidden>
        <div class="log-topbar">
          <button id="log-back" class="nav-back-btn" type="button">‹ Zurück</button>
          <span class="log-title">Log</span>
        </div>
        <div id="log-body" class="log-body"></div>
      </div>
    </section>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: static overlay markup for navigation view (D,H,I,G)"
```

---

### Task 6: `js/detail.js` neu aufbauen (B, C, E, F, G, H, I)

**Files:**
- Rewrite: `js/detail.js`

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `js/detail.js` with:

```js
// Cache navigation view: full-screen Leaflet map with overlay bars, a direction
// arrow (continuous rotation), a straight line to the cache, the traveled trail
// since opening, map controls, an info popover for the description, and a
// full-screen "Log" window (photo + codeword).

import { distanceMeters, bearingDegrees, formatDistance, angleDelta } from './geo.js';
import { checkCodeword } from './codeword.js';
import { addPhoto, getPhotos, markDone, isDone } from './progress.js';

let current = null;        // current cache object
let lastUserPos = null;    // { lat, lon }
let lastHeading = 0;       // device heading degrees (0 = north)
let arrowAngle = 0;        // continuous (unwrapped) applied arrow rotation
let onChanged = null;      // callback into app.js

let map = null;            // persistent Leaflet map for the navigation view
let userMarker = null;
let lineLayer = null;      // straight line user -> cache
let trailLayer = null;     // traveled path since opening this cache
let trailPoints = [];      // [[lat, lon], ...]
let fitted = false;        // whether we framed user+target once
let wired = false;         // static control buttons wired once

const TRAIL_MIN_MOVE_M = 3; // ignore GPS jitter below this many meters

function userDot() {
  return L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#1e88e5;border:3px solid #fff"></div>',
    iconSize: [18, 18], iconAnchor: [9, 9]
  });
}

function targetDot() {
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:50%;background:var(--rsh-blau-dunkel);border:3px solid #fff"></div>',
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
}

function initMap() {
  const target = [current.latitude, current.longitude];
  if (!map) {
    map = L.map('nav-map', { zoomControl: false, attributionControl: false }).setView(target, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  }
  // Reset per-cache layers so re-opening another cache starts clean.
  map.eachLayer((layer) => { if (layer instanceof L.Marker) layer.remove(); });
  if (lineLayer) { lineLayer.remove(); lineLayer = null; }
  if (trailLayer) { trailLayer.remove(); trailLayer = null; }
  userMarker = null;
  trailPoints = [];
  fitted = false;

  const blue = getComputedStyle(document.documentElement)
    .getPropertyValue('--rsh-blau-dunkel').trim() || '#2F4D6E';
  L.marker(target, { icon: targetDot() }).addTo(map);
  lineLayer = L.polyline([target, target], { color: blue, weight: 3, dashArray: '6,8', opacity: 0.8 }).addTo(map);
  trailLayer = L.polyline([], { color: '#e8731a', weight: 4, opacity: 0.9 }).addTo(map);

  map.setView(target, 16);
  // The container may have just become visible; fix tile sizing once it has layout.
  setTimeout(() => map && map.invalidateSize(), 0);
  setTimeout(() => map && map.invalidateSize(), 250);
  updateUserOnMap();
}

function updateUserOnMap() {
  if (!map || !lastUserPos) return;
  const u = [lastUserPos.lat, lastUserPos.lon];
  if (!userMarker) userMarker = L.marker(u, { icon: userDot() }).addTo(map);
  else userMarker.setLatLng(u);
}

function updateLine() {
  if (!lineLayer || !lastUserPos || !current) return;
  lineLayer.setLatLngs([[lastUserPos.lat, lastUserPos.lon], [current.latitude, current.longitude]]);
}

function updateTrail() {
  if (!trailLayer || !lastUserPos) return;
  const u = [lastUserPos.lat, lastUserPos.lon];
  const last = trailPoints[trailPoints.length - 1];
  if (!last || distanceMeters(last[0], last[1], u[0], u[1]) >= TRAIL_MIN_MOVE_M) {
    trailPoints.push(u);
    trailLayer.setLatLngs(trailPoints);
  }
}

function maybeFit() {
  if (fitted || !map || !lastUserPos || !current) return;
  map.fitBounds([[lastUserPos.lat, lastUserPos.lon], [current.latitude, current.longitude]],
    { padding: [50, 50], maxZoom: 17 });
  fitted = true;
}

function renderDistance() {
  const el = document.getElementById('nav-dist');
  if (!el || !current) return;
  el.textContent = lastUserPos
    ? formatDistance(distanceMeters(lastUserPos.lat, lastUserPos.lon, current.latitude, current.longitude))
    : '…';
}

function renderArrow() {
  const el = document.getElementById('nav-arrow');
  if (!el || !current || !lastUserPos) return;
  const target = bearingDegrees(lastUserPos.lat, lastUserPos.lon, current.latitude, current.longitude);
  const desired = (target - lastHeading + 360) % 360;
  // Accumulate the continuous angle so the arrow always rotates the short way.
  arrowAngle += angleDelta(desired, arrowAngle);
  el.style.transform = `rotate(${arrowAngle}deg)`;
  el.hidden = false;
}

// Called by app.js whenever a new GPS fix arrives.
export function updateDetailLocation(pos) {
  lastUserPos = pos;
  renderDistance();
  updateUserOnMap();
  updateLine();
  updateTrail();
  maybeFit();
  renderArrow();
}

// Called by app.js whenever device heading changes.
export function updateDetailHeading(heading) {
  lastHeading = heading;
  renderArrow();
}

function wireControls() {
  if (wired) return;
  wired = true;
  document.getElementById('nav-back').addEventListener('click', () => { if (onChanged) onChanged('back'); });
  document.getElementById('nav-info').addEventListener('click', () => {
    const pop = document.getElementById('nav-info-pop');
    pop.hidden = !pop.hidden;
  });
  document.getElementById('nav-zoom-in').addEventListener('click', () => map && map.zoomIn());
  document.getElementById('nav-zoom-out').addEventListener('click', () => map && map.zoomOut());
  document.getElementById('nav-center').addEventListener('click', () => {
    if (map && lastUserPos) map.setView([lastUserPos.lat, lastUserPos.lon], map.getZoom());
  });
  document.getElementById('nav-log').addEventListener('click', () => {
    document.getElementById('log-window').hidden = false;
  });
  document.getElementById('log-back').addEventListener('click', () => {
    document.getElementById('log-window').hidden = true;
  });
}

async function renderLogThumbs() {
  const wrap = document.getElementById('log-thumbs');
  if (!wrap || !current) return;
  wrap.innerHTML = '';
  const blobs = await getPhotos(current.id);
  for (const blob of blobs) {
    const img = document.createElement('img');
    const url = URL.createObjectURL(blob);
    img.onload = () => URL.revokeObjectURL(url); // free the blob URL once decoded
    img.src = url;
    wrap.appendChild(img);
  }
}

async function renderLogBody() {
  const body = document.getElementById('log-body');
  if (!body || !current) return;
  const done = await isDone(current.id);
  body.innerHTML = `
    <button id="log-photo-btn" type="button" class="btn btn-secondary btn-big">📷 Foto aufnehmen</button>
    <input id="log-photo-input" type="file" accept="image/*" capture="environment" hidden />
    <div id="log-thumbs" class="photo-thumbs"></div>
    <div class="log-codeword" style="margin-top:1rem">
      ${done
        ? '<p class="feedback-ok">✅ Cache gefunden!</p>'
        : `<input id="log-codeword-input" type="text" class="form-input" placeholder="Codewort vom Zettel" />
           <button id="log-codeword-submit" class="btn btn-primary btn-big" style="margin-top:0.5rem">
             Prüfen – Gefunden
           </button>
           <p id="log-codeword-feedback"></p>`}
    </div>
  `;

  const photoInput = body.querySelector('#log-photo-input');
  body.querySelector('#log-photo-btn').addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (file) { await addPhoto(current.id, file); await renderLogThumbs(); }
  });

  const submit = body.querySelector('#log-codeword-submit');
  if (submit) {
    submit.addEventListener('click', async () => {
      const input = body.querySelector('#log-codeword-input').value;
      const feedback = body.querySelector('#log-codeword-feedback');
      if (checkCodeword(input, current.codewort)) {
        await markDone(current.id);
        await renderLogBody();          // re-render to the done state; stay in the window
        if (onChanged) onChanged('done');
      } else {
        feedback.className = 'error';
        feedback.textContent = 'Codewort stimmt nicht – schau nochmal auf den Zettel.';
      }
    });
  }

  await renderLogThumbs();
}

export async function renderDetail(cache, onChangedCb) {
  current = cache;
  onChanged = onChangedCb;
  arrowAngle = 0;
  lastHeading = 0;

  document.getElementById('nav-name').textContent = cache.name;
  document.getElementById('nav-dist').textContent = '…';
  document.getElementById('nav-arrow').hidden = true;

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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Verify unit tests still pass**

Run: `node --test`
Expected: PASS — all test files green (detail.js is not unit-tested; this confirms imports resolve and nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add js/detail.js
git commit -m "feat: full-screen navigation view (B,C,E,F,G,H,I)"
```

---

### Task 7: `js/app.js` — Aufruf anpassen, Kopf-/Fußleiste ausblenden (D)

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Update `showView` to hide the header and bottom-nav in the detail view**

In `js/app.js`, replace the `showView` function:

```js
function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('bottom-nav').hidden = name === 'rules';
  if (name === 'map') { refreshMap(); focusUser(); }
}
```

with:

```js
function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  // Detail is full-screen: hide the app header and bottom nav so the map fills.
  document.querySelector('.app-header').hidden = name === 'detail';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail';
  if (name === 'map') { refreshMap(); focusUser(); }
}
```

- [ ] **Step 2: Update the `renderDetail` call in `openDetail`**

In `js/app.js`, replace the body of `openDetail`:

```js
async function openDetail(cacheId) {
  activeCacheId = cacheId;
  const cache = caches.find((c) => c.id === cacheId);
  await requestOrientationPermission();
  await renderDetail(cache, document.getElementById('detail-content'), async (event) => {
    if (event === 'back') { activeCacheId = null; showView('list'); }
    if (event === 'done') { doneIds = await getDoneIds(); renderList(); refreshMarkers(); }
  });
  showView('detail');
  if (userPos) updateDetailLocation(userPos); // after the view is visible, so the map sizes correctly
}
```

with (note: `renderDetail` now takes `(cache, onChanged)` — no container arg):

```js
async function openDetail(cacheId) {
  activeCacheId = cacheId;
  const cache = caches.find((c) => c.id === cacheId);
  await requestOrientationPermission();
  await renderDetail(cache, async (event) => {
    if (event === 'back') { activeCacheId = null; showView('list'); }
    if (event === 'done') { doneIds = await getDoneIds(); renderList(); refreshMarkers(); }
  });
  showView('detail');
  if (userPos) updateDetailLocation(userPos); // after the view is visible, so the map sizes correctly
}
```

- [ ] **Step 3: Verify unit tests still pass**

Run: `node --test`
Expected: PASS — all green.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: hide header/bottom-nav in full-screen detail view (D)"
```

---

### Task 8: Manuelle Verifizierung (Browser + Smartphone)

**Files:** none (verification only)

- [ ] **Step 1: Serve the app locally**

Run from the project root: `python -m http.server 8000`
Open `http://localhost:8000` in a desktop browser.

- [ ] **Step 2: Desktop checks (D, C, E, F, H, I, G)**

- Tippe in der Liste einen Cache an → Detailansicht öffnet sich **als Vollbild-Karte** ohne Kopf-/Fußleiste der App.
- Obere Leiste zeigt Name, Distanz, Pfeil und „i"-Button; untere Leiste „‹ Zurück" und „Log".
- Karte ist initial so gezoomt, dass Standort und Cache zu sehen sind (C) — bei Desktop-Geolocation ggf. grob.
- Gestrichelte Linie verbindet Standort und Cache (E).
- Buttons „+"/„−" zoomen, Fadenkreuz zentriert auf den Standort (H).
- „i" öffnet/schließt das Beschreibungs-Overlay (I).
- „Log" öffnet das Vollbild-Log-Fenster; Foto-Button und Codewort-Feld sind da. Falsches Codewort → Fehlermeldung; richtiges → „✅ Cache gefunden!" **bleibt im Fenster** (G). „‹ Zurück" schließt das Log-Fenster, „‹ Zurück" in der unteren Leiste führt zur Liste.

- [ ] **Step 3: Smartphone checks (A, B, F) — requires HTTPS**

Da DeviceOrientation HTTPS braucht: per Tunnel testen (z. B. `npx localtunnel --port 8000` oder Hosting auf der Ziel-Domain). Auf dem Smartphone:

- Beim Öffnen zeigt der Pfeil Richtung Cache, **unabhängig** davon, wie das Telefon beim Laden gehalten wurde (A).
- Beim langsamen Drehen über Norden hinweg dreht der Pfeil **stetig** weiter, ohne ~359°-Rücksprung (B).
- Beim Laufen zeichnet die **orange Spur** den zurückgelegten Weg; erneutes Öffnen des Caches setzt die Spur zurück (F).

- [ ] **Step 4: Run the full test suite one last time**

Run: `node --test`
Expected: PASS — all test files green.

- [ ] **Step 5: Final commit (only if verification surfaced fixes)**

If Steps 2–3 required code changes, commit them with a descriptive message. Otherwise no commit is needed (work already committed per task).

---

## Hinweise zur Umsetzung

- **DeviceOrientation/Leaflet sind nicht unit-testbar** in `node --test`; deshalb sind nur die reinen Funktionen (`angleDelta`, `normalizeHeading`) automatisiert getestet, der Rest manuell.
- **HTTPS-Pflicht:** Absolute Kompassdaten (A) und teils `capture` für die Kamera funktionieren nur über HTTPS bzw. `localhost`.
- **Bekannte Grenze:** Geräte ohne Magnetometer liefern kein absolutes Heading; der Pfeil wird dann angezeigt, dreht sich aber nicht. Das ist eine Hardwaregrenze, kein App-Fehler.
