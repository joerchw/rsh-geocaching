// Cache detail view: live distance, direction arrow, photo capture, codeword check.

import { distanceMeters, bearingDegrees, formatDistance } from './geo.js';
import { checkCodeword } from './codeword.js';
import { addPhoto, getPhotos, markDone, isDone } from './progress.js';

let current = null;       // current cache object
let lastUserPos = null;   // { lat, lon }
let lastHeading = 0;      // device heading degrees
let miniMap = null;       // Leaflet map instance for the detail view
let miniUserMarker = null;
let miniFitted = false;   // whether we framed user+target once already

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
  miniFitted = false;
  const target = [current.latitude, current.longitude];
  miniMap = L.map('detail-map', { zoomControl: true, attributionControl: false }).setView(target, 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
  L.marker(target, { icon: targetDot() }).addTo(miniMap);
  // The container may have just become visible; fix tile sizing once it has layout.
  setTimeout(() => miniMap && miniMap.invalidateSize(), 0);
  setTimeout(() => miniMap && miniMap.invalidateSize(), 250);
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
  // Frame both points ONCE; afterwards leave the view alone so the user can
  // zoom and pan freely without it jumping back on every GPS update.
  if (!miniFitted) {
    miniMap.fitBounds([u, [current.latitude, current.longitude]], { padding: [30, 30], maxZoom: 17 });
    miniFitted = true;
  }
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
    const url = URL.createObjectURL(blob);
    img.onload = () => URL.revokeObjectURL(url); // free the blob URL once decoded
    img.src = url;
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
    <button id="photo-btn" type="button" class="btn btn-secondary btn-big">📷 Foto aufnehmen</button>
    <input id="photo-input" type="file" accept="image/*" capture="environment" hidden />
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
  container.querySelector('#photo-btn').addEventListener('click', () => photoInput.click());
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
