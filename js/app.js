// Entry point: routing by query string and the project page shell.
//
//   ./                              -> home (project list)
//   ./?project=bridge-demo          -> project, Field view
//   ./?project=bridge-demo&view=office -> project, Office view
//
// Navigation uses history.pushState, so session changes survive moving
// between pages. A full reload resets everything to the sample data.

import { loadProject } from './data.js';
import { renderHome } from './home.js';
import { mountField } from './field.js';
import { mountOffice } from './office.js';
import { esc, icons } from './ui.js';

const app = document.getElementById('app');
let cleanup = null; // teardown for the current view (maps, overlays)
let renderToken = 0;

export function navigate(url, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  render();
}

function teardown() {
  if (cleanup) cleanup();
  cleanup = null;
}

async function render() {
  const token = ++renderToken;
  const params = new URLSearchParams(location.search);
  const projectId = params.get('project');
  teardown();

  if (!projectId) {
    document.title = 'Defect Capture (demo)';
    app.innerHTML = '<div class="loading">Loading projects…</div>';
    try {
      const html = await renderHome();
      if (token === renderToken) app.innerHTML = html;
    } catch (err) {
      if (token === renderToken) showError('Could not load projects', err);
    }
    return;
  }

  app.innerHTML = '<div class="loading">Loading project…</div>';
  let project;
  try {
    project = await loadProject(projectId);
  } catch (err) {
    if (token === renderToken) showError('Could not load this project', err);
    return;
  }
  if (token !== renderToken) return;
  if (!project) {
    showError('Project not found', new Error(`There is no project with the id "${projectId}".`));
    return;
  }

  const view = params.get('view') === 'office' ? 'office' : 'field';
  renderProject(project, view);
}

function renderProject(project, view) {
  document.title = `${project.structureName} · ${view === 'office' ? 'Office' : 'Field'}`;
  app.innerHTML = `
    <div class="project ${view === 'office' ? 'office-mode' : 'field-mode'}">
      <header class="proj-header">
        <div class="proj-header-inner">
          <div class="proj-title-row">
            <a class="icon-btn back" href="./" data-nav aria-label="Back to projects">${icons.back()}</a>
            <div class="proj-titles">
              <h1>${esc(project.structureName)}</h1>
              <p>${esc(project.designOffice)}</p>
            </div>
            ${view === 'office' ? `<button class="btn pdf-btn" id="pdf-btn" type="button">${icons.download()} PDF</button>` : ''}
          </div>
          <div class="segmented" role="tablist" aria-label="View">
            <button type="button" role="tab" data-view="field" aria-selected="${view === 'field'}">Field</button>
            <button type="button" role="tab" data-view="office" aria-selected="${view === 'office'}">Office</button>
          </div>
        </div>
      </header>
      <main id="view"></main>
    </div>`;

  const header = app.querySelector('.proj-header');
  const setHeaderVar = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  setHeaderVar();
  const ro = new ResizeObserver(setHeaderVar);
  ro.observe(header);

  app.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === view) return;
      const url = `?project=${encodeURIComponent(project.id)}${btn.dataset.view === 'office' ? '&view=office' : ''}`;
      navigate(url, { replace: true });
    });
  });

  const container = app.querySelector('#view');
  const viewCleanup = view === 'office' ? mountOffice(container, project) : mountField(container, project);
  window.scrollTo(0, 0);
  cleanup = () => {
    ro.disconnect();
    if (viewCleanup) viewCleanup();
  };
}

function showError(title, err) {
  app.innerHTML = `
    <div class="error-box">
      <h2>${esc(title)}</h2>
      <p>${esc(err.message)}</p>
      <a class="btn" href="./" data-nav>Back to projects</a>
    </div>`;
}

// In-app links: <a data-nav href="...">
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-nav]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  navigate(link.getAttribute('href'));
});

window.addEventListener('popstate', render);

if (!window.L) {
  app.innerHTML = '<div class="error-box"><h2>Map library did not load</h2><p>Check your internet connection and reload the page.</p></div>';
} else {
  render();
}
