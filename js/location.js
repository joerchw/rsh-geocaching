// Browser Geolocation + DeviceOrientation wrappers.
// Pure math lives in geo.js; this file only touches browser APIs.

export function watchLocation(onUpdate, onError) {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation wird von diesem Browser nicht unterstützt.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    }),
    (err) => onError(err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

// iOS 13+ requires an explicit permission request triggered by a user gesture.
export async function requestOrientationPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true; // non-iOS browsers don't gate this
}

// Calls onHeading(degrees 0..360, where 0 = north) when device heading changes.
// Returns an unsubscribe function. Returns null if orientation is unsupported.
export function watchHeading(onHeading) {
  if (!('DeviceOrientationEvent' in window)) return null;
  const handler = (event) => {
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading; // iOS: already 0=N clockwise
    } else if (typeof event.alpha === 'number') {
      heading = (360 - event.alpha) % 360; // approximate
    }
    if (heading != null && !Number.isNaN(heading)) onHeading(heading);
  };
  window.addEventListener('deviceorientation', handler, true);
  return () => window.removeEventListener('deviceorientation', handler, true);
}
