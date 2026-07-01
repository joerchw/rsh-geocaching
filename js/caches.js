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
  let serverCaches;
  if (override) {
    serverCaches = parseCaches(override);
  } else {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`caches.json konnte nicht geladen werden (HTTP ${res.status}).`);
    }
    serverCaches = parseCaches(await res.text());
  }
  const studentRaw = loadStudentCaches();
  const studentCaches = studentRaw.map((c) => ({ ...c, isStudent: true }));
  return [...serverCaches, ...studentCaches];
}

export function loadStudentCaches() {
  const raw = localStorage.getItem('rsh_student_caches');
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveStudentCaches(arr) {
  localStorage.setItem('rsh_student_caches', JSON.stringify(arr));
}

function slugifyUsername(username) {
  const slug = String(username ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return slug || 'schueler';
}

// 4 hex chars = 65536 combinations per slug — plenty for classroom-scale sharing,
// not designed as a general-purpose collision-resistant ID scheme.
export function generateStudentId(username) {
  const slug = slugifyUsername(username);
  const hex = Math.random().toString(16).slice(2).padEnd(4, '0').slice(0, 4);
  return `student-${slug}-${hex}`;
}

export function isKnownCacheId(studentCaches, id) {
  return studentCaches.some((c) => c.id === id);
}
