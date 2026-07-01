import { encodeCacheQrPayload, MAX_BESCHREIBUNG_BYTES } from './qr.js';
import { loadUsername } from './username.js';

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Opens the "share this cache as a QR code" view. onDoneCb is called with no
// arguments when the user taps back.
export function openShareView(cache, onDoneCb) {
  document.getElementById('share-title').textContent = cache.name;
  document.getElementById('share-back').onclick = () => onDoneCb();

  const { text, truncated } = encodeCacheQrPayload(cache);
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag(6, 4);

  const body = document.getElementById('share-body');
  body.innerHTML = `
    <p class="editor-label" style="text-align:center">von ${esc(cache.ersteller || loadUsername() || '–')}</p>
    <div class="qr-container">${svg}</div>
    <p class="hint" style="text-align:center">
      Lass jemanden diesen Code scannen, um den Cache zu übernehmen
    </p>
    ${truncated ? `<p class="hint" style="text-align:center">
      Beschreibung wird für den QR-Code gekürzt (${cache.beschreibung.length}/${MAX_BESCHREIBUNG_BYTES} Zeichen).
    </p>` : ''}
  `;
}
