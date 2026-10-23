// Shared render helpers: escaping, icons, chips, dates, sorting, toast.

import { CONDITION_STATES, csLabel, statusLabel } from './constants.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const svg = (paths, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  back: (c) => svg('<path d="m15 18-6-6 6-6"/>', c),
  chevronRight: (c) => svg('<path d="m9 18 6-6-6-6"/>', c),
  close: (c) => svg('<path d="M18 6 6 18M6 6l12 12"/>', c),
  camera: (c) => svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>', c),
  flag: (c) => svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>', c),
  download: (c) => svg('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>', c),
  info: (c) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>', c),
  locate: (c) => svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>', c),
  structure: (c) => svg('<path d="M3 20h18"/><path d="M5 20v-8l7-6 7 6v8"/><path d="M9 20v-5h6v5"/>', c),
};

export function csChip(cs, withLabel = false) {
  const text = withLabel ? `CS ${cs} · ${csLabel(cs)}` : `CS ${cs}`;
  return `<span class="cs-chip cs-${cs}">${text}</span>`;
}

export function csSquare(cs) {
  return `<span class="cs-square cs-${cs}" aria-label="Condition state ${cs}, ${csLabel(cs)}">${cs}</span>`;
}

// Status pill for the office list.
export function statusPill(status) {
  if (!status) return '<span class="pill pill-todo">To review</span>';
  const cls = status === 'revisit' ? 'pill pill-revisit' : 'pill';
  return `<span class="${cls}">${esc(statusLabel(status))}</span>`;
}

export function photoHtml(defect, alt = '') {
  if (!defect.photo) return '<div class="no-photo">NO PHOTO</div>';
  return `<img src="${esc(defect.photo)}" alt="${esc(alt)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'no-photo',textContent:'PHOTO'}))">`;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatDateTime = (iso) => dateTimeFmt.format(new Date(iso)).replace(' at ', ', ');
export const formatDate = (iso) => dateFmt.format(new Date(iso));
export const formatLongDate = (date) => longDateFmt.format(date);

// Local ISO string without timezone, matching the sample data format.
export function localIso(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:00`;
}

// "34.12731, −117.86509" with a typographic minus, as on the mockups.
export const formatCoords = (lat, lng) =>
  `${lat.toFixed(5)}, ${lng.toFixed(5)}`.replace(/-/g, '−');

// First part of the location label, for compact list rows ("Pier 2").
export const shortLocation = (loc) => (loc || '').split(',')[0].trim();

// Worst condition first, then oldest id first.
export function sortWorstFirst(defects) {
  return [...defects].sort((a, b) => b.conditionState - a.conditionState || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function csColor(cs) {
  return CONDITION_STATES[cs]?.color ?? '#999';
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}
