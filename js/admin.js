// Teacher admin module — loaded only by lehrer.html, not part of the student PWA.
import { parseCoordinate } from './geo.js';
import { startQrScanner } from './scan.js';
import { encodeCacheQrPayload, MAX_BESCHREIBUNG_BYTES } from './qr.js';
import './qrcode-setup.js';

const ADMIN_PASSWORD = 'CacheAdmin';
const LS_CACHES_KEY = 'rsh_caches_admin';
const LS_RULES_KEY = 'rsh_rules_admin';

let adminCaches = [];
let adminRules = [];

// --- Data ---

async function loadAdminCaches() {
  const override = localStorage.getItem(LS_CACHES_KEY);
  if (override) {
    try { return JSON.parse(override); } catch {}
  }
  const res = await fetch('data/caches.json');
  return res.json();
}

async function loadAdminRules() {
  const override = localStorage.getItem(LS_RULES_KEY);
  if (override) {
    try { return JSON.parse(override); } catch {}
  }
  const res = await fetch('data/rules.json');
  return res.json();
}

function saveAdminCaches(arr) {
  localStorage.setItem(LS_CACHES_KEY, JSON.stringify(arr, null, 2));
}

function saveAdminRules(arr) {
  localStorage.setItem(LS_RULES_KEY, JSON.stringify(arr, null, 2));
}

// --- Helpers ---

function generateId(caches) {
  const nums = caches
    .map(c => parseInt(c.id.replace('cache-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `cache-${String(next).padStart(2, '0')}`;
}

function validateCacheForm({ name, beschreibung, codewort, latitude, longitude }) {
  if (!name.trim()) return 'Name darf nicht leer sein.';
  if (!beschreibung.trim()) return 'Beschreibung darf nicht leer sein.';
  if (!codewort.trim()) return 'Codewort darf nicht leer sein.';
  const lat = parseCoordinate(latitude);
  const lon = parseCoordinate(longitude);
  if (lat === null || lat < -90 || lat > 90) return 'Breitengrad ungültig. z. B. 51.389567 oder N 51° 23.374′';
  if (lon === null || lon < -180 || lon > 180) return 'Längengrad ungültig. z. B. 7.702367 oder E 7° 42.142′';
  return null;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Tabs ---

function showTab(tab) {
  document.getElementById('tab-caches').classList.toggle('active', tab === 'caches');
  document.getElementById('tab-regeln').classList.toggle('active', tab === 'regeln');
  document.getElementById('panel-caches').hidden = tab !== 'caches';
  document.getElementById('panel-regeln').hidden = tab !== 'regeln';
}

// --- Export Modal ---

function showExportModal(json) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:500px;
                max-height:80vh;display:flex;flex-direction:column;gap:0.8rem">
      <h3 style="margin:0">JSON exportieren</h3>
      <p style="margin:0;font-size:0.9rem;color:#555">
        Kopiere diesen Text und füge ihn auf GitHub in die entsprechende Datei ein.
      </p>
      <textarea style="flex:1;min-height:200px;font-family:monospace;font-size:0.8rem;
                       border:2px solid #ccc;border-radius:8px;padding:0.6rem;resize:vertical"
                readonly>${esc(json)}</textarea>
      <div style="display:flex;gap:0.5rem">
        <button id="modal-copy" class="btn btn-primary" style="flex:1">Kopieren</button>
        <button id="modal-close" class="btn btn-ghost" style="flex:1">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('modal-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      const btn = document.getElementById('modal-copy');
      btn.textContent = 'Kopiert!';
      setTimeout(() => { btn.textContent = 'Kopieren'; }, 1500);
    } catch {
      alert('Clipboard nicht verfügbar – bitte manuell kopieren.');
    }
  });
  document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// --- Share Modal ---

function showShareModal(cache) {
  const { text, truncated } = encodeCacheQrPayload(cache);
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag(6, 4);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:420px;
                display:flex;flex-direction:column;gap:0.8rem;align-items:center">
      <h3 style="margin:0">${esc(cache.name)}</h3>
      <div class="qr-container">${svg}</div>
      <p style="margin:0;font-size:0.9rem;color:#555;text-align:center">
        Lass jemanden diesen Code scannen, um den Cache zu übernehmen
      </p>
      ${truncated ? `<p style="margin:0;font-size:0.85rem;color:#555;text-align:center">
        Beschreibung wird für den QR-Code gekürzt (${cache.beschreibung.length}/${MAX_BESCHREIBUNG_BYTES} Zeichen).
      </p>` : ''}
      <button id="share-modal-close" class="btn btn-ghost" style="width:100%">Schließen</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('share-modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// --- Scan Modal ---

function showScanModal(onDecoded) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.2rem;width:100%;max-width:420px;
                display:flex;flex-direction:column;gap:0.8rem">
      <h3 style="margin:0">Cache-QR scannen</h3>
      <video id="scan-modal-video" autoplay playsinline muted
             style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:#000"></video>
      <canvas id="scan-modal-canvas" hidden></canvas>
      <p id="scan-modal-error" class="error" hidden></p>
      <button id="scan-modal-close" class="btn btn-ghost" style="width:100%">Abbrechen</button>
    </div>`;
  document.body.appendChild(overlay);

  const video = document.getElementById('scan-modal-video');
  const canvas = document.getElementById('scan-modal-canvas');
  const errorEl = document.getElementById('scan-modal-error');

  const stop = startQrScanner(video, canvas, {
    onDecode: (cache) => {
      overlay.remove();
      onDecoded(cache);
    },
    onInvalid: () => {
      errorEl.textContent = 'Kein gültiger Cache-Code';
      errorEl.hidden = false;
    },
    onError: (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    },
  });

  const close = () => { stop(); overlay.remove(); };
  document.getElementById('scan-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// --- Cache Tab ---

function renderCacheList() {
  const panel = document.getElementById('panel-caches');
  panel.innerHTML = `
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <button id="btn-new-cache" class="btn btn-primary btn-big">+ Neuer Cache</button>
      <button id="btn-scan-cache" class="btn btn-secondary btn-big">📷 Scannen</button>
    </div>
    <div id="cache-edit-area"></div>
    <ul id="admin-cache-list" class="cache-list" style="margin-bottom:1rem"></ul>
    <button id="btn-export-caches" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">JSON exportieren</button>
    <button id="btn-restore-caches" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;

  const ul = document.getElementById('admin-cache-list');
  for (const cache of adminCaches) {
    const li = document.createElement('li');
    li.className = 'cache-item';
    li.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:0.3rem';
    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>${esc(cache.name)}</strong>
        <div style="display:flex;gap:0.4rem">
          <button class="btn btn-secondary" data-share="${esc(cache.id)}"
                  style="padding:0.35rem 0.75rem;font-size:0.9rem">📤</button>
          <button class="btn btn-secondary" data-edit="${esc(cache.id)}"
                  style="padding:0.35rem 0.75rem;font-size:0.9rem">✏️</button>
          <button class="btn btn-ghost" data-delete="${esc(cache.id)}"
                  style="padding:0.35rem 0.75rem;font-size:0.9rem;color:#b00020">🗑️</button>
        </div>
      </div>
      <small style="color:#555">${esc(cache.beschreibung.slice(0, 70))}${cache.beschreibung.length > 70 ? '…' : ''}</small>`;
    ul.appendChild(li);
  }

  document.getElementById('btn-new-cache').addEventListener('click', () => renderCacheForm(null));

  document.getElementById('btn-scan-cache').addEventListener('click', () => {
    showScanModal((cache) => {
      renderCacheForm({
        name: cache.name,
        beschreibung: cache.beschreibung,
        codewort: cache.codewort,
        latitude: cache.latitude,
        longitude: cache.longitude,
      });
    });
  });

  ul.addEventListener('click', e => {
    const shareId = e.target.closest('[data-share]')?.dataset.share;
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    if (shareId) {
      const cache = adminCaches.find(c => c.id === shareId);
      if (cache) showShareModal(cache);
    }
    if (editId) {
      renderCacheForm(adminCaches.find(c => c.id === editId) ?? null);
    }
    if (deleteId) {
      const name = adminCaches.find(c => c.id === deleteId)?.name ?? deleteId;
      if (confirm(`Cache „${name}" wirklich löschen?`)) {
        adminCaches = adminCaches.filter(c => c.id !== deleteId);
        saveAdminCaches(adminCaches);
        renderCacheList();
      }
    }
  });

  document.getElementById('btn-export-caches').addEventListener('click', () =>
    showExportModal(JSON.stringify(adminCaches, null, 2)));

  document.getElementById('btn-restore-caches').addEventListener('click', () => {
    if (confirm('Serverversion wiederherstellen? Alle lokalen Änderungen gehen verloren.')) {
      localStorage.removeItem(LS_CACHES_KEY);
      loadAdminCaches().then(data => { adminCaches = data; renderCacheList(); });
    }
  });
}

function renderCacheForm(cache) {
  const isNew = !cache?.id;
  const area = document.getElementById('cache-edit-area');
  area.innerHTML = `
    <div style="background:#f8f8f8;border-radius:12px;padding:1rem;margin-bottom:1rem;
                border:2px solid var(--rsh-blau)">
      <h3 style="margin:0 0 0.8rem">${isNew ? 'Neuer Cache' : 'Cache bearbeiten'}</h3>
      <label style="display:block;margin-bottom:0.6rem">Name
        <input id="f-name" class="form-input" value="${esc(cache?.name ?? '')}">
      </label>
      <label style="display:block;margin-bottom:0.6rem">Beschreibung
        <textarea id="f-desc" class="form-input" rows="2">${esc(cache?.beschreibung ?? '')}</textarea>
      </label>
      <label style="display:block;margin-bottom:0.6rem">Codewort
        <input id="f-code" class="form-input" value="${esc(cache?.codewort ?? '')}">
      </label>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.3rem">
        <label style="flex:1">Breitengrad
          <input id="f-lat" class="form-input" value="${esc(String(cache?.latitude ?? ''))}">
        </label>
        <label style="flex:1">Längengrad
          <input id="f-lon" class="form-input" value="${esc(String(cache?.longitude ?? ''))}">
        </label>
      </div>
      <p style="margin:0 0 0.6rem;font-size:0.85rem;color:#555">z. B. 51.389567 oder N 51° 23.374′</p>
      <button id="btn-gps" class="btn btn-ghost" style="width:100%;margin-bottom:0.8rem">
        📍 GPS-Position übernehmen
      </button>
      <p id="f-error" class="error" hidden></p>
      <div style="display:flex;gap:0.5rem">
        <button id="btn-save" class="btn btn-primary" style="flex:1">Speichern</button>
        <button id="btn-cancel" class="btn btn-ghost" style="flex:1">Abbrechen</button>
      </div>
    </div>`;

  document.getElementById('btn-gps').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById('f-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('f-lon').value = pos.coords.longitude.toFixed(6);
      },
      () => alert('GPS-Standort konnte nicht ermittelt werden.')
    );
  });

  document.getElementById('btn-cancel').addEventListener('click', () => { area.innerHTML = ''; });

  document.getElementById('btn-save').addEventListener('click', () => {
    const formData = {
      name: document.getElementById('f-name').value,
      beschreibung: document.getElementById('f-desc').value,
      codewort: document.getElementById('f-code').value,
      latitude: document.getElementById('f-lat').value,
      longitude: document.getElementById('f-lon').value,
    };
    const err = validateCacheForm(formData);
    const errEl = document.getElementById('f-error');
    if (err) { errEl.textContent = err; errEl.hidden = false; return; }
    errEl.hidden = true;
    const entry = {
      id: cache?.id ?? generateId(adminCaches),
      name: formData.name.trim(),
      beschreibung: formData.beschreibung.trim(),
      codewort: formData.codewort.trim(),
      latitude: parseCoordinate(formData.latitude),
      longitude: parseCoordinate(formData.longitude),
    };
    if (isNew) {
      adminCaches.push(entry);
    } else {
      const idx = adminCaches.findIndex(c => c.id === entry.id);
      if (idx !== -1) adminCaches[idx] = entry;
    }
    saveAdminCaches(adminCaches);
    area.innerHTML = '';
    renderCacheList();
  });
}

// --- Regeln Tab ---

function renderRulesList() {
  const panel = document.getElementById('panel-regeln');
  panel.innerHTML = `
    <div id="rules-edit-area"></div>
    <button id="btn-add-section" class="btn btn-ghost btn-big" style="margin-bottom:1rem">
      + Neuer Abschnitt
    </button>
    <button id="btn-export-rules" class="btn btn-ghost btn-big" style="margin-bottom:0.5rem">
      JSON exportieren
    </button>
    <button id="btn-restore-rules" class="btn btn-ghost btn-big">Serverversion wiederherstellen</button>`;

  const area = document.getElementById('rules-edit-area');
  for (let si = 0; si < adminRules.length; si++) {
    renderRuleSection(area, si);
  }

  document.getElementById('btn-add-section').addEventListener('click', () => {
    adminRules.push({ titel: 'Neuer Abschnitt', punkte: [''] });
    saveAdminRules(adminRules);
    renderRulesList();
  });

  document.getElementById('btn-export-rules').addEventListener('click', () =>
    showExportModal(JSON.stringify(adminRules, null, 2)));

  document.getElementById('btn-restore-rules').addEventListener('click', () => {
    if (confirm('Serverversion wiederherstellen? Alle lokalen Änderungen gehen verloren.')) {
      localStorage.removeItem(LS_RULES_KEY);
      loadAdminRules().then(data => { adminRules = data; renderRulesList(); });
    }
  });
}

function renderRuleSection(container, si) {
  const section = adminRules[si];
  const div = document.createElement('div');
  div.style.cssText =
    'background:#f8f8f8;border-radius:12px;padding:1rem;margin-bottom:1rem;border:2px solid #e2e8ee';

  const pointsHtml = section.punkte.map((p, pi) => `
    <div style="display:flex;gap:0.4rem;margin-bottom:0.4rem">
      <input class="form-input punkt-input" style="flex:1" value="${esc(p)}"
             data-si="${si}" data-pi="${pi}">
      <button class="btn btn-ghost del-punkt" data-si="${si}" data-pi="${pi}"
              style="padding:0.35rem 0.65rem;color:#b00020">✕</button>
    </div>`).join('');

  div.innerHTML = `
    <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem;align-items:center">
      <input class="form-input section-titel" value="${esc(section.titel)}"
             data-si="${si}" style="flex:1;font-weight:700">
      <button class="btn btn-ghost del-section" data-si="${si}"
              style="padding:0.35rem 0.65rem;color:#b00020">🗑️</button>
    </div>
    <div class="punkte-list">${pointsHtml}</div>
    <button class="btn btn-ghost add-punkt" data-si="${si}"
            style="width:100%;margin-top:0.4rem">+ Punkt hinzufügen</button>`;
  container.appendChild(div);

  div.querySelector('.section-titel').addEventListener('change', e => {
    adminRules[si].titel = e.target.value;
    saveAdminRules(adminRules);
  });

  div.querySelector('.del-section').addEventListener('click', () => {
    if (adminRules.length <= 1) { alert('Mindestens ein Abschnitt muss vorhanden sein.'); return; }
    if (confirm(`Abschnitt „${adminRules[si].titel}" löschen?`)) {
      adminRules.splice(si, 1);
      saveAdminRules(adminRules);
      renderRulesList();
    }
  });

  div.querySelectorAll('.punkt-input').forEach(input => {
    input.addEventListener('change', e => {
      adminRules[parseInt(e.target.dataset.si)].punkte[parseInt(e.target.dataset.pi)] = e.target.value;
      saveAdminRules(adminRules);
    });
  });

  div.querySelectorAll('.del-punkt').forEach(btn => {
    btn.addEventListener('click', e => {
      const s = parseInt(e.target.dataset.si);
      const p = parseInt(e.target.dataset.pi);
      if (adminRules[s].punkte.length <= 1) { alert('Mindestens ein Punkt muss vorhanden sein.'); return; }
      adminRules[s].punkte.splice(p, 1);
      saveAdminRules(adminRules);
      renderRulesList();
    });
  });

  div.querySelector('.add-punkt').addEventListener('click', e => {
    adminRules[parseInt(e.target.dataset.si)].punkte.push('');
    saveAdminRules(adminRules);
    renderRulesList();
  });
}

// --- Init ---

async function main() {
  const pwInput = document.getElementById('pw-input');

  document.getElementById('btn-login').addEventListener('click', () => {
    if (pwInput.value === ADMIN_PASSWORD) {
      document.getElementById('login-form').hidden = true;
      document.getElementById('admin-area').hidden = false;
    } else {
      document.getElementById('pw-error').textContent = 'Falsches Passwort.';
      pwInput.value = '';
      pwInput.focus();
    }
  });

  pwInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });

  document.getElementById('tab-caches').addEventListener('click', () => showTab('caches'));
  document.getElementById('tab-regeln').addEventListener('click', () => showTab('regeln'));

  [adminCaches, adminRules] = await Promise.all([loadAdminCaches(), loadAdminRules()]);

  renderCacheList();
  renderRulesList();
  showTab('caches');
}

main();
