// Leaflet helpers: base map, numbered condition-state pins, pin-drop picker.
// Leaflet is loaded as a global (window.L) from the CDN in index.html.

import { CONDITION_STATES } from './constants.js';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createMap(el, { center, zoom }, options = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, ...options }).setView(center, zoom);
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  map.attributionControl.setPrefix(false);
  return map;
}

export function csIcon(cs, selected = false) {
  const { color, text } = CONDITION_STATES[cs];
  const size = selected ? 40 : 30;
  return L.divIcon({
    className: '',
    html: `<div class="pin-cs${selected ? ' selected' : ''}" style="background:${color};color:${text}">${cs}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const dropIcon = () => L.divIcon({
  className: 'pin-drop',
  html: '<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 32 27.5 32 17A15 15 0 0 0 2 17C2 27.5 17 43 17 43Z" fill="#15191E" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="5" fill="#fff"/></svg>',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

// Small map where a tap (or drag) moves a single pin. Calls onChange(latlng).
export function createPinPicker(el, view, start, onChange) {
  const map = createMap(el, view);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const marker = L.marker(start, { icon: dropIcon(), draggable: true, keyboard: false }).addTo(map);
  const update = (latlng) => {
    marker.setLatLng(latlng);
    onChange(latlng);
  };
  map.on('click', (e) => update(e.latlng));
  marker.on('dragend', () => onChange(marker.getLatLng()));
  return {
    map,
    setPosition(latlng) {
      update(L.latLng(latlng));
      map.setView(latlng, Math.max(map.getZoom(), 17));
    },
  };
}
