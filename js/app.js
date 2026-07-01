import { loadCaches } from './caches.js';
import { distanceMeters, formatDistance } from './geo.js';
import { loadRules, renderRules, rulesAccepted, acceptRules } from './rules.js';
import { loadUsername, saveUsername, hasUsername, renderUsernameForm } from './username.js';
import { getDoneIds, clearAllProgress } from './progress.js';
import { watchLocation, watchHeading, requestOrientationPermission } from './location.js';
import { initMap, refreshMap, setCacheMarkers, setUserLocation, focusUser } from './map.js';
import { renderDetail, updateDetailLocation, updateDetailHeading } from './detail.js';
import { openCacheEditor } from './cache-editor.js';
import { openShareView } from './share.js';
import { openGotoForm } from './goto.js';

const VIEWS = ['rules', 'username', 'list', 'map', 'goto', 'detail', 'cache-editor', 'share'];
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
  document.querySelector('.app-header').hidden = name === 'detail' || name === 'cache-editor' || name === 'share';
  document.getElementById('bottom-nav').hidden = name === 'rules' || name === 'username' || name === 'detail' || name === 'cache-editor' || name === 'share';
  if (name === 'map') { refreshMap(); focusUser(); }
  // Re-render the form every time the goto tab is opened, so it picks up the
  // last-saved target and resets validation state (e.g. after coming back from nav).
  if (name === 'goto') { openGotoForm(startGotoNav); }
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

  const addLi = document.createElement('li');
  addLi.className = 'cache-item-add';
  addLi.textContent = '+ Neuer Cache';
  addLi.addEventListener('click', () => startCacheEditor(null));
  list.appendChild(addLi);
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

function startShare(cache) {
  openShareView(cache, () => showView('list'));
  showView('share');
}

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

  showView(rulesAccepted() ? (hasUsername() ? 'list' : 'username') : 'rules');

  // Register service worker (after first paint)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

main();
