// Pure caches parsing/validation + a thin browser loader.

const REQUIRED_STRINGS = ['id', 'name', 'beschreibung', 'codewort'];

function validateCache(raw, index) {
  const where = `Eintrag ${index + 1}`;
  for (const field of REQUIRED_STRINGS) {
    if (typeof raw[field] !== 'string' || raw[field].trim() === '') {
      throw new Error(`${where}: Feld "${field}" fehlt oder ist leer.`);
    }
  }
  const lat = Number(raw.latitude);
  const lon = Number(raw.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`${where}: "latitude" ist ungültig (${raw.latitude}).`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error(`${where}: "longitude" ist ungültig (${raw.longitude}).`);
  }
  return {
    id: raw.id,
    name: raw.name,
    beschreibung: raw.beschreibung,
    codewort: raw.codewort,
    latitude: lat,
    longitude: lon
  };
}

export function parseCaches(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(data)) {
    throw new Error('caches.json muss eine Liste (Array) von Caches sein.');
  }
  const seen = new Set();
  return data.map((raw, i) => {
    const cache = validateCache(raw, i);
    if (seen.has(cache.id)) {
      throw new Error(`Die id "${cache.id}" kommt doppelt vor.`);
    }
    seen.add(cache.id);
    return cache;
  });
}

export async function loadCaches(url = 'data/caches.json') {
  const override = localStorage.getItem('rsh_caches_admin');
  if (override) {
    return parseCaches(override);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`caches.json konnte nicht geladen werden (HTTP ${res.status}).`);
  }
  return parseCaches(await res.text());
}
