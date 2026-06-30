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
  // The map is created while #view-detail is still display:none, so Leaflet's
  // cached size can be stale (0×0) at fit time. Recompute it first, otherwise
  // fitBounds frames against a wrong viewport and the zoom looks off.
  map.invalidateSize();
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
  // NB: `el` is an <svg>; SVGElement does not reflect the `hidden` IDL property,
  // so `el.hidden = false` would NOT remove the attribute. Toggle it explicitly.
  el.removeAttribute('hidden');
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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
