// Home page: one card per sample project.

import { loadAllProjects } from './data.js';
import { esc, icons } from './ui.js';

function projectCard(project) {
  const total = project.defects.length;
  const severe = project.defects.filter((d) => d.conditionState === 4).length;
  const revisit = project.defects.filter((d) => d.engineerStatus === 'revisit').length;
  const link = `?project=${encodeURIComponent(project.id)}`;
  return `
    <a class="card project-card" href="${link}" data-nav>
      <span class="chev">${icons.chevronRight()}</span>
      <div class="eyebrow">${esc(project.structureType)}</div>
      <h2>${esc(project.structureName)}</h2>
      <p class="office">${esc(project.designOffice)}</p>
      <div class="count-row">
        <span class="pill">${total} defect${total === 1 ? '' : 's'}</span>
        <span class="pill pill-severe">${severe} severe</span>
        <span class="pill pill-revisit">${revisit} revisit</span>
      </div>
      <p class="project-link">${esc(link)}</p>
    </a>`;
}

export async function renderHome() {
  const projects = await loadAllProjects();
  return `
    <div class="page home">
      <div class="home-top">
        <div class="brand"><span class="brand-mark">${icons.structure()}</span>Defect Capture</div>
        <span class="demo-pill">DEMO</span>
      </div>
      <h1>Projects</h1>
      <p class="home-intro">One project per structure. Each opens by its own link.</p>
      <div class="project-list">
        ${projects.map(projectCard).join('')}
      </div>
      <p class="home-foot">${icons.info()}<span>Demo with sample data. New entries and engineer changes reset when the page reloads.</span></p>
    </div>`;
}
