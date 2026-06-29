import { loadCaches } from './caches.js';
import { distanceMeters, formatDistance } from './geo.js';
import { loadRules, renderRules, rulesAccepted, acceptRules } from './rules.js';
import { getDoneIds, clearAllProgress } from './progress.js';
import { watchLocation, watchHeading, requestOrientationPermission } from './location.js';
import { initMap, refreshMap, setCacheMarkers, setUserLocation, focusUser } from './map.js';
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
  // Detail is full-screen: hide the app header and bottom nav so the map fills.
  document.querySelector('.app-header').hidden = name === 'detail';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'detail';
  if (name === 'map') { refreshMap(); focusUser(); }
}

function setGpsStatus(text) {
  document.getElementById('gps-status').textContent = text;
}

function updateCoordsOverlay(pos) {
  const el = document.getElementById('user-coords');
  if (!el) return;
  el.textContent = `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}`;
  el.hidden = false;
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
  await renderDetail(cache, async (event) => {
    if (event === 'back') { activeCacheId = null; showView('list'); }
    if (event === 'done') { doneIds = await getDoneIds(); renderList(); refreshMarkers(); }
  });
  showView('detail');
  if (userPos) updateDetailLocation(userPos); // after the view is visible, so the map sizes correctly
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
      updateCoordsOverlay(pos);
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
  const ruleSections = await loadRules();
  renderRules(document.getElementById('rules-content'), ruleSections);
  document.getElementById('rules-accept').addEventListener('click', () => {
    acceptRules();
    showView('list');
  });

  document.getElementById('rules-reset').addEventListener('click', async () => {
    const input = prompt('Zum Zurücksetzen "reset" eingeben:');
    if (input === null || input.trim().toLowerCase() !== 'reset') return;
    await clearAllProgress();
    doneIds = new Set();
    renderList();
    refreshMarkers();
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

  // Tap coords overlay to copy to clipboard.
  const coordsEl = document.getElementById('user-coords');
  if (coordsEl) {
    coordsEl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(coordsEl.textContent);
        coordsEl.classList.add('copied');
        const orig = coordsEl.textContent;
        coordsEl.textContent = 'Kopiert!';
        setTimeout(() => { coordsEl.textContent = orig; coordsEl.classList.remove('copied'); }, 1200);
      } catch { /* clipboard not available */ }
    });
  }
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
