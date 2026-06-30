import { parseCoordinate } from './geo.js';

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
