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
