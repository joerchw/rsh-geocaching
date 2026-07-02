import { decodeCacheQrPayload } from './qr.js';
import { loadStudentCaches, saveStudentCaches, isKnownCacheId } from './caches.js';

// Starts the camera and a jsQR decode loop against `videoEl`/`canvasEl`.
// Calls `onDecode(cache)` once with a valid, parsed cache object (camera is stopped
// first). Calls `onInvalid()` for a recognized-but-not-ours QR code (scan continues).
// Calls `onError(message)` if the camera can't be used at all.
// Returns a `stop()` function that releases the camera; safe to call multiple times.
export function startQrScanner(videoEl, canvasEl, { onDecode, onInvalid, onError }) {
  let stream = null;
  let rafId = null;
  let stopped = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    onError?.('Scannen wird auf diesem Gerät nicht unterstützt.');
    return stop;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.play().catch(() => onError?.('Kamera-Vorschau konnte nicht gestartet werden.'));
      const ctx = canvasEl.getContext('2d');

      const tick = () => {
        if (stopped) return;
        if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
          canvasEl.width = videoEl.videoWidth;
          canvasEl.height = videoEl.videoHeight;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
          const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code) {
            try {
              const cache = decodeCacheQrPayload(code.data);
              stop();
              onDecode?.(cache);
              return;
            } catch {
              onInvalid?.();
            }
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    })
    .catch(() => {
      onError?.('Kamera-Zugriff verweigert. Bitte erlaube den Kamera-Zugriff in den Browser-Einstellungen.');
    });

  return stop;
}

// Opens the student-facing "scan a cache QR code" view (#view-scan). onDoneCb is
// called with 'imported' after a new cache was merged into rsh_student_caches, or
// 'back' if the user cancels or scanned a cache that was already present.
export function openScanView(onDoneCb) {
  const body = document.getElementById('scan-body');
  body.innerHTML = `
    <video id="scan-video" class="scan-video" autoplay playsinline muted></video>
    <canvas id="scan-canvas" hidden></canvas>
    <p id="scan-status" class="hint">Richte die Kamera auf den QR-Code</p>
    <p id="scan-error" class="error" hidden></p>
  `;
  const video = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  const statusEl = document.getElementById('scan-status');
  const errorEl = document.getElementById('scan-error');

  const stop = startQrScanner(video, canvas, {
    onDecode: (cache) => {
      errorEl.hidden = true;
      const existing = loadStudentCaches();
      if (isKnownCacheId(existing, cache.id)) {
        statusEl.textContent = 'Cache schon vorhanden';
        setTimeout(() => onDoneCb('back'), 900);
        return;
      }
      saveStudentCaches([...existing, cache]);
      statusEl.textContent = `„${cache.name}" übernommen!`;
      setTimeout(() => onDoneCb('imported'), 900);
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

  document.getElementById('scan-back').onclick = () => { stop(); onDoneCb('back'); };
}
