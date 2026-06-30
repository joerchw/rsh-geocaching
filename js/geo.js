// Pure geographic math — no browser APIs, importable by tests.

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function bearingDegrees(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '–';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

// Smallest signed rotation (degrees, -180..180) to bring `current` onto `target`.
// Used to rotate the direction arrow the short way instead of spinning back
// ~359° when the bearing wraps across 0°.
export function angleDelta(target, current) {
  // Normalize current to 0..360 to handle unwrapped angles (e.g., 730° → 10°)
  const normalizedCurrent = ((current % 360) + 360) % 360;
  return ((target - normalizedCurrent + 540) % 360) - 180;
}

// Turns a DeviceOrientation-like event into an absolute compass heading
// (0 = north, clockwise) or null if no absolute reading is available.
// iOS exposes webkitCompassHeading (already absolute). Android only gives a
// trustworthy north reference when event.absolute === true.
export function normalizeHeading(e) {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return e.webkitCompassHeading;
  }
  if (e.absolute === true && typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  return null;
}

// Parses a coordinate string in decimal degrees (DD) or degrees decimal minutes (GDM).
// Accepts N/S/E/W prefixes or suffixes, comma as decimal separator, and optional
// degree/minute symbols. Returns a number (decimal degrees) or null on invalid input.
export function parseCoordinate(str) {
  if (typeof str !== 'string') return null;
  // Normalize: trim, comma→period, collapse multiple spaces
  const s = str.trim().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!s) return null;

  // Extract and strip leading or trailing cardinal direction (N/S/E/W)
  const preMatch = s.match(/^([NSEWnsew])\s*(.*)/);
  const sufMatch = !preMatch ? s.match(/(.*?)\s*([NSEWnsew])$/i) : null;
  let card = '';
  let core = s;
  if (preMatch) {
    card = preMatch[1].toUpperCase();
    core = preMatch[2].trim();
  } else if (sufMatch) {
    card = sufMatch[2].toUpperCase();
    core = sufMatch[1].trim();
  }

  // Grad Dezimalminuten: DDD°MM.mmm or DDD MM.mmm (° or space as separator)
  const gdm = core.match(/^(\d{1,3})[°\s]\s*(\d{1,2}(?:\.\d+)?)['′]?\s*$/);
  if (gdm) {
    const deg = parseInt(gdm[1], 10);
    const min = parseFloat(gdm[2]);
    if (min >= 60) return null;
    const val = deg + min / 60;
    return (card === 'S' || card === 'W') ? -val : val;
  }

  // Dezimalgrad: optional sign, digits, optional decimal part, optional degree symbol
  const dd = core.match(/^([+-]?\d{1,3}(?:\.\d+)?)°?\s*$/);
  if (dd) {
    const val = parseFloat(dd[1]);
    if (!isFinite(val)) return null;
    if (card === 'S' || card === 'W') return -Math.abs(val);
    return val;
  }

  return null;
}
