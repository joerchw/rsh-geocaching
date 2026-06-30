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
