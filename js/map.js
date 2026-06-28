// Leaflet map: online OSM tiles, current-location marker, cache markers.
// Leaflet (global `L`) is loaded via vendor/leaflet/leaflet.js in index.html.
// Uses divIcon markers so no Leaflet image assets are required.

// Default center until a GPS fix arrives — set to the school. ADJUST before the project week.
const DEFAULT_CENTER = [51.3890, 7.7025];
const DEFAULT_ZOOM = 16;

let map = null;
let userMarker = null;
let lastUserLatLng = null;
let hasCenteredOnUser = false;
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

  const NorthArrow = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', '');
      div.style.cssText = 'pointer-events:none;line-height:0;margin:8px;';
      div.innerHTML = `<svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="19" fill="rgba(255,255,255,0.88)" stroke="#ccc" stroke-width="1"/>
        <text x="20" y="9.5" text-anchor="middle" font-size="9" font-weight="800"
              fill="#c0392b" font-family="system-ui,sans-serif">N</text>
        <polygon points="20,12 15,22 25,22" fill="#c0392b"/>
        <polygon points="20,36 15,22 25,22" fill="#aaa"/>
        <circle cx="20" cy="22" r="2.5" fill="#fff" stroke="#777" stroke-width="1.2"/>
      </svg>`;
      return div;
    }
  });
  new NorthArrow().addTo(map);

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
  lastUserLatLng = [lat, lon];
  if (!userMarker) {
    userMarker = L.marker([lat, lon], { icon: dot('#1e88e5', 18) }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }
  // Center on the user the first time we get a fix (don't fight later panning).
  if (!hasCenteredOnUser) {
    map.setView([lat, lon], 16);
    hasCenteredOnUser = true;
  }
}

// Re-center the map on the user's current position (used when the map tab opens).
export function focusUser() {
  if (map && lastUserLatLng) map.setView(lastUserLatLng, map.getZoom());
}
