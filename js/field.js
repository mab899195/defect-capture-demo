// Field view: the inspector's defect list and the "Add defect" screen.

import { DEFECT_TYPES, CONDITION_STATES, typeLabel, statusLabel } from './constants.js';
import { addDefect, getInspector, setInspector } from './data.js';
import { createPinPicker } from './map.js';
import { csChip, esc, formatCoords, formatDateTime, icons, localIso, photoHtml, toast } from './ui.js';

const EVERYONE = '__all__';

// Revisit requests first (they need the inspector's attention), then worst
// condition, then newest.
function sortForField(defects) {
  return [...defects].sort((a, b) =>
    (b.engineerStatus === 'revisit') - (a.engineerStatus === 'revisit')
    || b.conditionState - a.conditionState
    || b.loggedAt.localeCompare(a.loggedAt));
}

function statusLine(d) {
  if (d.engineerStatus === 'revisit') {
    return `<span><span class="badge-revisit">${icons.flag('icon-sm')} Revisit requested</span></span>`;
  }
  if (!d.engineerStatus) return '<span class="defect-status pending">Awaiting engineer review</span>';
  return `<span class="defect-status">Engineer: ${esc(statusLabel(d.engineerStatus))}</span>`;
}

function defectCard(d, highlightId) {
  const revisit = d.engineerStatus === 'revisit';
  const classes = ['card', 'defect-card', revisit && 'is-revisit', d.id === highlightId && 'is-new'].filter(Boolean).join(' ');
  return `
    <article class="${classes}" id="card-${esc(d.id)}">
      <div class="defect-row">
        <div class="thumb">${photoHtml(d, `${typeLabel(d.type)} ${d.id}`)}</div>
        <div class="defect-main">
          <div class="defect-title-row">
            <h3 class="defect-title">${esc(typeLabel(d.type))}</h3>
            ${csChip(d.conditionState)}
          </div>
          <p class="defect-meta">${esc(d.id)} · ${esc(d.location || 'No location label')} · ${esc(formatDateTime(d.loggedAt))}</p>
          ${statusLine(d)}
        </div>
      </div>
      ${revisit && d.engineerComment ? `
        <div class="engineer-note">
          <p class="label">Engineer comment</p>
          <p>${esc(d.engineerComment)}</p>
        </div>` : ''}
    </article>`;
}

export function mountField(container, project) {
  let inspector = getInspector(project);
  let highlightId = null;
  let closeScreen = null;

  container.innerHTML = `
    <div class="page field-view">
      <div class="list-head">
        <h2>My defects</h2>
        <label class="inspector-picker">Logged by <select id="inspector-select" aria-label="Show defects logged by"></select><span id="mine-count"></span></label>
      </div>
      <div class="defect-list" id="defect-list"></div>
    </div>
    <div class="bottom-bar">
      <div class="bottom-bar-inner">
        <button class="btn btn-primary btn-block" id="add-btn" type="button">${icons.camera()} Add defect</button>
      </div>
    </div>`;

  const select = container.querySelector('#inspector-select');
  const list = container.querySelector('#defect-list');
  const countEl = container.querySelector('#mine-count');

  function renderPicker() {
    const names = [...new Set(project.defects.map((d) => d.loggedBy))].sort();
    if (inspector && inspector !== EVERYONE && !names.includes(inspector)) names.unshift(inspector);
    select.innerHTML = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
      + `<option value="${EVERYONE}">Everyone</option>`;
    select.value = inspector || EVERYONE;
  }

  function renderList() {
    const mine = inspector === EVERYONE || !inspector
      ? project.defects
      : project.defects.filter((d) => d.loggedBy === inspector);
    const count = mine.length;
    countEl.textContent = `· ${count}`;

    list.innerHTML = count
      ? sortForField(mine).map((d) => defectCard(d, highlightId)).join('')
      : '<div class="empty">No defects logged yet. Tap <strong>Add defect</strong> to log the first one.</div>';
  }

  select.addEventListener('change', () => {
    inspector = select.value;
    setInspector(project, inspector);
    highlightId = null;
    renderList();
  });

  container.querySelector('#add-btn').addEventListener('click', () => {
    closeScreen = openAddScreen(project, inspector === EVERYONE ? '' : inspector, (defect) => {
      inspector = defect.loggedBy;
      setInspector(project, inspector);
      highlightId = defect.id;
      renderPicker();
      renderList();
      document.getElementById(`card-${defect.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast(`${defect.id} added. Kept for this session only.`);
    }, () => { closeScreen = null; });
  });

  renderPicker();
  renderList();

  return () => { if (closeScreen) closeScreen(); };
}

// ---------------------------------------------------------------------------
// Add defect screen (full screen overlay)
// ---------------------------------------------------------------------------

function openAddScreen(project, defaultName, onSubmit, onClose) {
  const state = {
    photoUrl: null,
    photoName: '',
    type: '',
    cs: null,
    latlng: { lat: project.map.center[0], lng: project.map.center[1] },
  };

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-labelledby', 'new-defect-title');
  screen.innerHTML = `
    <div class="screen-head">
      <h2 id="new-defect-title">New defect</h2>
      <button class="icon-btn" type="button" data-close aria-label="Cancel">${icons.close()}</button>
    </div>
    <form class="screen-body" id="defect-form" novalidate>
      <div class="screen-body-inner">
        <input type="file" id="photo-input" accept="image/*" class="sr-only" tabindex="-1">
        <div class="photo-row">
          <div class="photo-preview" id="photo-preview"><div class="no-photo">PHOTO</div></div>
          <div class="photo-side">
            <p class="photo-name" id="photo-name">No photo yet</p>
            <button class="btn" type="button" id="photo-btn">${icons.camera()} <span>Take photo</span></button>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="type-select">Defect type</label>
          <select class="select" id="type-select" required>
            <option value="" disabled selected>Select a type</option>
            ${DEFECT_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
          </select>
          <p class="field-error" data-error="type" hidden>Choose a defect type.</p>
        </div>

        <div class="field">
          <span class="field-label" id="cs-label">Condition state</span>
          <div class="cs-picker" role="radiogroup" aria-labelledby="cs-label">
            ${Object.entries(CONDITION_STATES).map(([n, c]) => `
              <button type="button" role="radio" aria-checked="false" class="cs-${n}" data-cs="${n}">
                <span class="num">${n}</span><span class="lbl">${c.label}</span>
              </button>`).join('')}
          </div>
          <p class="field-error" data-error="cs" hidden>Choose a condition state.</p>
        </div>

        <div class="field">
          <span class="field-label">Location <span class="coords" id="coords"></span></span>
          <div class="picker-map-wrap">
            <div class="picker-map" id="picker-map" aria-label="Map. Tap to place the defect pin."></div>
            <span class="map-hint">Tap the map to move the pin</span>
          </div>
          <div class="loc-actions">
            <button type="button" class="link-btn" id="gps-btn">${icons.locate('icon-sm')} Use my location</button>
          </div>
          <input class="input" id="location-input" placeholder="Element, e.g. Pier 2, east face (optional)" autocomplete="off">
        </div>

        <div class="field">
          <label class="field-label" for="notes-input">Notes</label>
          <textarea class="textarea" id="notes-input" placeholder="Size, extent, anything the engineer should know"></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="name-input"><span>Logged by <span class="req" aria-hidden="true">*</span></span></label>
          <input class="input" id="name-input" required autocomplete="name" placeholder="Your name" value="${esc(defaultName)}">
          <p class="field-error" data-error="name" hidden>Enter your name.</p>
        </div>
      </div>
    </form>
    <div class="screen-foot">
      <div class="screen-foot-inner">
        <button class="btn btn-primary btn-block" type="submit" form="defect-form">Submit defect</button>
      </div>
    </div>`;
  document.body.appendChild(screen);
  document.body.style.overflow = 'hidden';

  const $ = (sel) => screen.querySelector(sel);
  const photoInput = $('#photo-input');
  const coordsEl = $('#coords');
  const showCoords = () => { coordsEl.textContent = formatCoords(state.latlng.lat, state.latlng.lng); };
  showCoords();

  // Photo: opens the camera or photo library on phones, a file picker on desktop.
  $('#photo-btn').addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = URL.createObjectURL(file);
    state.photoName = file.name || 'photo.jpg';
    $('#photo-preview').innerHTML = `<img src="${state.photoUrl}" alt="Selected photo">`;
    $('#photo-name').textContent = `${state.photoName} · captured`;
    $('#photo-btn span').textContent = 'Retake photo';
  });

  $('#type-select').addEventListener('change', (e) => {
    state.type = e.target.value;
    e.target.classList.remove('invalid');
    $('[data-error="type"]').hidden = true;
  });

  screen.querySelectorAll('[data-cs]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cs = Number(btn.dataset.cs);
      screen.querySelectorAll('[data-cs]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      $('[data-error="cs"]').hidden = true;
    });
  });

  $('#name-input').addEventListener('input', (e) => {
    e.target.classList.remove('invalid');
    $('[data-error="name"]').hidden = true;
  });

  const picker = createPinPicker($('#picker-map'), project.map, state.latlng, (latlng) => {
    state.latlng = { lat: latlng.lat, lng: latlng.lng };
    showCoords();
  });
  requestAnimationFrame(() => picker.map.invalidateSize());

  $('#gps-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Location is not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => picker.setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => toast('Could not get your location. Tap the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });

  function close() {
    picker.map.remove();
    screen.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose();
  }
  function onKey(e) { if (e.key === 'Escape') cancel(); }
  function cancel() {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    close();
  }
  document.addEventListener('keydown', onKey);
  $('[data-close]').addEventListener('click', cancel);

  $('#defect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name-input').value.trim();
    const errors = [];
    if (!state.type) errors.push(['type', '#type-select']);
    if (!state.cs) errors.push(['cs', '.cs-picker']);
    if (!name) errors.push(['name', '#name-input']);
    errors.forEach(([key, sel]) => {
      $(`[data-error="${key}"]`).hidden = false;
      $(sel).classList.add('invalid');
    });
    if (errors.length) {
      $(errors[0][1]).scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const defect = addDefect(project, {
      photo: state.photoUrl,
      type: state.type,
      conditionState: state.cs,
      lat: Number(state.latlng.lat.toFixed(6)),
      lng: Number(state.latlng.lng.toFixed(6)),
      location: $('#location-input').value.trim(),
      notes: $('#notes-input').value.trim(),
      loggedBy: name,
      loggedAt: localIso(),
    });
    close();
    onSubmit(defect);
  });

  // Open the camera right away; the user can cancel and add the photo later.
  photoInput.click();

  return cancel;
}
