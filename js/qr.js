// Encode/decode the JSON payload embedded in cache-sharing QR codes. Pure functions —
// no DOM, no camera, no QR-image rendering (that's js/share.js and js/scan.js).

export const MAX_BESCHREIBUNG_BYTES = 400;

// Shrinks `text` until JSON.stringify(text) fits within maxBytes (UTF-8), appending '…'
// if anything was cut. Returns the original text unchanged (truncated: false) if it
// already fits.
export function truncateDescriptionForQr(text, maxBytes = MAX_BESCHREIBUNG_BYTES) {
  const enc = new TextEncoder();
  const fits = (s) => enc.encode(JSON.stringify(s)).length <= maxBytes;
  if (fits(text)) return { text, truncated: false };
  if (!fits('…')) return { text: '', truncated: true };
  // Binary search for the longest prefix (plus ellipsis) that still fits maxBytes.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(text.slice(0, mid) + '…')) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { text: text.slice(0, lo) + '…', truncated: true };
}

// Builds the JSON string embedded in a cache-sharing QR code. `beschreibung` is
// truncated if needed (see truncateDescriptionForQr); all other fields are used as-is.
export function encodeCacheQrPayload(cache) {
  const { text: beschreibung, truncated } = truncateDescriptionForQr(cache.beschreibung);
  const payload = {
    rshCache: 1,
    id: cache.id,
    name: cache.name,
    beschreibung,
    codewort: cache.codewort,
    latitude: cache.latitude,
    longitude: cache.longitude,
    ersteller: cache.ersteller ?? null,
  };
  return { text: JSON.stringify(payload), truncated };
}

// Parses and validates a scanned QR string. Throws Error('Kein gültiger Cache-Code')
// for anything that isn't a well-formed rshCache payload (broken JSON, missing marker,
// wrong field types) so callers can show a consistent error message.
export function decodeCacheQrPayload(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Kein gültiger Cache-Code');
  }
  if (!obj || typeof obj !== 'object' || obj.rshCache !== 1) {
    throw new Error('Kein gültiger Cache-Code');
  }
  const { id, name, beschreibung, codewort, latitude, longitude, ersteller } = obj;
  if (
    typeof id !== 'string' || typeof name !== 'string' ||
    typeof beschreibung !== 'string' || typeof codewort !== 'string' ||
    typeof latitude !== 'number' || typeof longitude !== 'number'
  ) {
    throw new Error('Kein gültiger Cache-Code');
  }
  return {
    id, name, beschreibung, codewort, latitude, longitude,
    ersteller: typeof ersteller === 'string' ? ersteller : null,
  };
}
