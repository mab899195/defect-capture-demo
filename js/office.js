// Office view: map of all defects, list sorted worst first, detail sheet
// where the engineer records a decision.

import { CONDITION_STATES, ENGINEER_STATUSES, typeLabel } from './constants.js';
import { saveDecision } from './data.js';
import { createMap, csIcon } from './map.js';
import {
  csChip, csSquare, esc, formatCoords, formatDate, formatDateTime, icons, photoHtml,
  shortLocation, sortWorstFirst, statusPill, toast,
} from './ui.js';

const desktop = window.matchMedia('(min-width: 900px)');

export function mountOffice(container, project) {
  let selectedId = null;
  let sheet = null; // { el, backdrop, close }
  const markers = new Map();

  container.innerHTML = `
    <div class="office-layout">
      <div class="office-map-col">
        <div class="office-map" id="office-map" role="region" aria-label="Map of defects"></div>
        <div class="legend" aria-label="Legend">
          ${[4, 3, 2, 1].map((cs) => `<span><i style="background:${CONDITION_STATES[cs].color}"></i>${cs} ${CONDITION_STATES[cs].label}</span>`).join('')}
        </div>
      </div>
      <div class="office-list-col">
        <div class="list-head">
          <h2 id="office-count"></h2>
          <span class="meta">Sorted: worst first</span>
        </div>
        <div class="defect-list" id="office-list"></div>
      </div>
    </div>`;

  const mapEl = container.querySelector('#office-map');
  const listEl = container.querySelector('#office-list');
  const map = createMap(mapEl, project.map);
  // On wide screens the detail panel sits at the right edge of the map.
  L.control.zoom({ position: desktop.matches ? 'topleft' : 'topright' }).addTo(map);

  // ---- Map pins ----------------------------------------------------------
  function renderMarkers() {
    markers.forEach((m) => m.remove());
    markers.clear();
    project.defects.forEach((d) => {
      const selected = d.id === selectedId;
      const marker = L.marker([d.lat, d.lng], {
        icon: csIcon(d.conditionState, selected),
        zIndexOffset: selected ? 1000 : d.conditionState * 100,
        title: `${d.id} · ${typeLabel(d.type)} · CS ${d.conditionState}`,
        alt: `${d.id}, condition state ${d.conditionState}`,
        riseOnHover: true,
      }).addTo(map);
      marker.on('click', () => select(d.id));
      markers.set(d.id, marker);
    });
  }

  function fitAll() {
    if (!project.defects.length) return;
    const bounds = L.latLngBounds(project.defects.map((d) => [d.lat, d.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 19 });
  }

  // ---- List --------------------------------------------------------------
  function renderList() {
    const sorted = sortWorstFirst(project.defects);
    container.querySelector('#office-count').textContent = `${sorted.length} defect${sorted.length === 1 ? '' : 's'}`;
    listEl.innerHTML = sorted.map((d) => `
      <button type="button" class="card office-item" data-id="${esc(d.id)}" aria-current="${d.id === selectedId}">
        ${csSquare(d.conditionState)}
        <span class="txt">
          <span class="t1">${esc(typeLabel(d.type))}${d.location ? ` · ${esc(shortLocation(d.location))}` : ''}</span>
          <span class="t2">${esc(d.id)} · ${esc(d.loggedBy)} · ${esc(formatDate(d.loggedAt))}</span>
        </span>
        ${statusPill(d.engineerStatus)}
      </button>`).join('')
      || '<div class="empty">No defects in this project yet.</div>';
  }

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.office-item');
    if (item) select(item.dataset.id);
  });

  // ---- Selection ---------------------------------------------------------
  function select(id) {
    selectedId = id;
    const defect = project.defects.find((d) => d.id === id);
    renderMarkers();
    renderList();
    if (!desktop.matches) window.scrollTo({ top: 0 });
    openSheet(defect);
    centerOnVisibleArea(defect);
  }

  // Center the pin in the part of the map the sheet does not cover.
  function centerOnVisibleArea(defect) {
    const latlng = L.latLng(defect.lat, defect.lng);
    const zoom = Math.max(map.getZoom(), project.map.zoom);
    const mapRect = mapEl.getBoundingClientRect();
    const headerBottom = document.querySelector('.proj-header')?.getBoundingClientRect().bottom ?? 0;
    const sheetRect = sheet?.el.getBoundingClientRect();
    const left = mapRect.left;
    const right = sheetRect && desktop.matches ? Math.min(mapRect.right, sheetRect.left) : mapRect.right;
    const top = Math.max(mapRect.top, headerBottom);
    const bottom = sheetRect && !desktop.matches ? Math.min(mapRect.bottom, sheetRect.top) : mapRect.bottom;

    if (bottom - top < 24 || right - left < 24) {
      map.setView(latlng, zoom);
      return;
    }
    const target = L.point((left + right) / 2 - mapRect.left, (top + bottom) / 2 - mapRect.top);
    const offset = target.subtract(L.point(mapRect.width / 2, mapRect.height / 2));
    const center = map.unproject(map.project(latlng, zoom).subtract(offset), zoom);
    map.setView(center, zoom, { animate: true });
  }

  // ---- Detail sheet ------------------------------------------------------
  function openSheet(defect) {
    closeSheet();
    const sorted = sortWorstFirst(project.defects);
    const position = sorted.findIndex((d) => d.id === defect.id) + 1;
    let status = defect.engineerStatus;

    const backdrop = desktop.matches ? null : document.createElement('div');
    if (backdrop) {
      backdrop.className = 'sheet-backdrop';
      document.body.appendChild(backdrop);
    }

    const el = document.createElement('section');
    el.className = 'sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Defect ${defect.id}`);
    el.innerHTML = `
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head">
        <span class="count">${esc(defect.id)} of ${sorted.length}</span>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icons.close()}</button>
      </div>
      <div class="sheet-body">
        <div class="sheet-photo">${photoHtml(defect, `Photo of ${defect.id}`)}</div>
        <div class="sheet-title-row">
          <h3>${esc(typeLabel(defect.type))}</h3>
          ${csChip(defect.conditionState, true)}
        </div>
        <div class="kv-grid">
          <div><p class="k">Location</p><p class="v mono">${formatCoords(defect.lat, defect.lng)}</p>${defect.location ? `<p class="v">${esc(defect.location)}</p>` : ''}</div>
          <div><p class="k">Logged</p><p class="v">${esc(defect.loggedBy)} · ${esc(formatDateTime(defect.loggedAt))}</p></div>
        </div>
        <p class="sheet-notes">${defect.notes ? esc(defect.notes) : '<span class="muted">No notes.</span>'}</p>

        <div class="sheet-section">
          <div class="field">
            <span class="field-label" id="status-label">Engineer status</span>
            <div class="status-picker" role="radiogroup" aria-labelledby="status-label">
              ${ENGINEER_STATUSES.map((s) => `
                <button type="button" role="radio" class="${s.id === 'revisit' ? 'revisit' : ''}" data-status="${s.id}" aria-checked="${s.id === status}">${s.label}</button>`).join('')}
            </div>
            <p class="field-error" data-error="status" hidden>Choose a status.</p>
          </div>
          <div class="field">
            <label class="field-label" for="comment-input">Comment to field</label>
            <textarea class="textarea" id="comment-input" placeholder="What should the field team know or do?">${esc(defect.engineerComment)}</textarea>
            <p class="field-error" data-error="comment" hidden>Add a comment so the inspector knows what to check on the revisit.</p>
          </div>
          <button class="btn btn-primary btn-block" type="button" data-save>Save decision</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const comment = el.querySelector('#comment-input');
    el.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        status = btn.dataset.status;
        el.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        el.querySelector('[data-error="status"]').hidden = true;
      });
    });
    comment.addEventListener('input', () => {
      comment.classList.remove('invalid');
      el.querySelector('[data-error="comment"]').hidden = true;
    });

    el.querySelector('[data-save]').addEventListener('click', () => {
      const text = comment.value.trim();
      if (!status) {
        el.querySelector('[data-error="status"]').hidden = false;
        return;
      }
      if (status === 'revisit' && !text) {
        comment.classList.add('invalid');
        el.querySelector('[data-error="comment"]').hidden = false;
        comment.focus();
        return;
      }
      saveDecision(project, defect.id, status, text);
      closeSheet();
      renderList();
      toast(`Decision saved for ${defect.id}. Kept for this session only.`);
    });

    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    el.querySelector('[data-close]').addEventListener('click', closeSheet);
    backdrop?.addEventListener('click', closeSheet);

    sheet = {
      el,
      close() {
        el.remove();
        backdrop?.remove();
        document.removeEventListener('keydown', onKey);
      },
    };
    el.querySelector('[data-close]').focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.close();
    sheet = null;
  }

  // ---- PDF export (button lives in the project header) -------------------
  const pdfBtn = document.getElementById('pdf-btn');
  const onPdf = async () => {
    pdfBtn.disabled = true;
    try {
      const { exportPdf } = await import('./pdf/report.js');
      await exportPdf(project);
    } catch (err) {
      console.error(err);
      toast('Could not create the PDF. Please try again.');
    } finally {
      pdfBtn.disabled = false;
    }
  };
  pdfBtn?.addEventListener('click', onPdf);

  renderMarkers();
  renderList();
  requestAnimationFrame(() => { map.invalidateSize(); fitAll(); });
  const onResize = () => map.invalidateSize();
  window.addEventListener('resize', onResize);

  return () => {
    closeSheet();
    window.removeEventListener('resize', onResize);
    pdfBtn?.removeEventListener('click', onPdf);
    map.remove();
  };
}
