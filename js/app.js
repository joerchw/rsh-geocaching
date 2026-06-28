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
