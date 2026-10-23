// Loads the sample data and keeps the session state in memory.
//
// Everything the user adds or changes lives only in the objects below, so a
// page reload brings the demo back to the sample data in data/*.json.

const projects = new Map(); // id -> project object (with its defects)
let index = null;

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

export async function loadIndex() {
  if (!index) index = await fetchJson('data/projects.json');
  return index.projects;
}

export async function loadProject(id) {
  if (projects.has(id)) return projects.get(id);
  const entries = await loadIndex();
  const entry = entries.find((p) => p.id === id);
  if (!entry) return null;
  const project = await fetchJson(entry.file);
  projects.set(id, project);
  return project;
}

export async function loadAllProjects() {
  const entries = await loadIndex();
  return Promise.all(entries.map((e) => loadProject(e.id)));
}

// Next id in the project's own sequence, for example D-09 after D-08.
function nextDefectId(project) {
  const sample = project.defects[0]?.id ?? 'D-00';
  const prefix = sample.replace(/\d+$/, '');
  const max = project.defects.reduce((m, d) => Math.max(m, parseInt(d.id.replace(/^\D+/, ''), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export function addDefect(project, fields) {
  const defect = {
    id: nextDefectId(project),
    engineerStatus: null,
    engineerComment: '',
    ...fields,
  };
  project.defects.push(defect);
  return defect;
}

export function saveDecision(project, defectId, status, comment) {
  const defect = project.defects.find((d) => d.id === defectId);
  if (!defect) return null;
  defect.engineerStatus = status;
  defect.engineerComment = comment;
  return defect;
}

// Session-only UI memory (current inspector name per project).
const inspectorByProject = new Map();
export const getInspector = (project) => inspectorByProject.get(project.id) ?? project.defaultInspector ?? '';
export const setInspector = (project, name) => inspectorByProject.set(project.id, name);
