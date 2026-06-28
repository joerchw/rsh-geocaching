// Leaflet map: online OSM tiles, current-location marker, cache markers.
// Leaflet (global `L`) is loaded via vendor/leaflet/leaflet.js in index.html.
// Uses divIcon markers so no Leaflet image assets are required.

// Default center until a GPS fix arrives — set to the school. ADJUST before the project week.
const DEFAULT_CENTER = [51.4458, 7.6794];
const DEFAULT_ZOOM = 16;

let map = null;
let userMarker = null;
const cacheMarkers = new Map(); // cacheId -> L.Marker

function dot(colorVar, sizePx) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;
           background:${colorVar};border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [sizePx, sizePx],
    iconAnchor: [sizePx / 2, sizePx / 2]
  });
}

export function initMap(elementId) {
  if (map) return map;
  map = L.map(elementId).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  return map;
}

// Re-fixes Leaflet sizing when its container becomes visible.
export function refreshMap() {
  if (map) setTimeout(() => map.invalidateSize(), 0);
}

export function setCacheMarkers(caches, doneIds, onMarkerClick) {
  if (!map) return;
  for (const m of cacheMarkers.values()) m.remove();
  cacheMarkers.clear();
  for (const cache of caches) {
    const done = doneIds.has(cache.id);
    const marker = L.marker([cache.latitude, cache.longitude], {
      icon: dot(done ? 'var(--rsh-gruen)' : 'var(--rsh-blau-dunkel)', 22)
    }).addTo(map);
    marker.bindTooltip(cache.name);
    marker.on('click', () => onMarkerClick(cache.id));
    cacheMarkers.set(cache.id, marker);
  }
}

export function setUserLocation(lat, lon) {
  if (!map) return;
  if (!userMarker) {
    userMarker = L.marker([lat, lon], { icon: dot('#1e88e5', 18) }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }
}
