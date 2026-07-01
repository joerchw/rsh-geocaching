import { parseCoordinate } from './geo.js';
import { loadStudentCaches, saveStudentCaches, generateStudentId } from './caches.js';
import { loadUsername } from './username.js';

let onDone = null;

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showError(errEl, msg) {
  errEl.textContent = msg;
  errEl.hidden = false;
}

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
        <input id="ef-lat" class="form-input" value="${esc(cache?.latitude ?? '')}" />
      </label>
      <label class="editor-label">Längengrad
        <input id="ef-lon" class="form-input" value="${esc(cache?.longitude ?? '')}" />
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
      id: cache?.id ?? generateStudentId(loadUsername()),
      name,
      beschreibung,
      codewort,
      latitude: lat,
      longitude: lon,
      ersteller: cache?.ersteller ?? loadUsername(),
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
