// Browser Geolocation + DeviceOrientation wrappers.
// Pure math lives in geo.js; this file only touches browser APIs.

import { normalizeHeading } from './geo.js';

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
// Prefers the absolute orientation event so the arrow is correct regardless of
// how the phone was held when the page loaded. Returns an unsubscribe function,
// or null if orientation is unsupported.
export function watchHeading(onHeading) {
  if (!('DeviceOrientationEvent' in window)) return null;
  const eventName = ('ondeviceorientationabsolute' in window)
    ? 'deviceorientationabsolute'
    : 'deviceorientation';
  const handler = (event) => {
    const heading = normalizeHeading(event);
    if (heading != null) onHeading(heading);
  };
  window.addEventListener(eventName, handler, true);
  return () => window.removeEventListener(eventName, handler, true);
}
