// PDF export. The report is a list of sections drawn in order; each section
// receives a shared context (`ctx`) and moves `ctx.y` down as it draws.
//
// To add a section: write a function in sections.js and add it to
// REPORT_SECTIONS below. To add a field to every defect row: add an entry to
// DEFECT_FIELDS in sections.js.

import { headerSection, summarySection, defectsSection, drawRunningHeader, drawFooter } from './sections.js';
import { sortWorstFirst } from '../ui.js';

export const REPORT_SECTIONS = [headerSection, summarySection, defectsSection];

export const THEME = {
  text: '#15191E',
  text2: '#5B6470',
  border: '#DDE1E6',
  placeholder: '#C9CCC8',
  revisit: '#9A3F06',
};

const PAGE = { margin: 54, footer: 36 };

function createContext(doc, project) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const ctx = {
    doc,
    project,
    defects: sortWorstFirst(project.defects),
    exportedAt: new Date(),
    theme: THEME,
    page: {
      width,
      height,
      margin: PAGE.margin,
      contentWidth: width - PAGE.margin * 2,
      bottom: height - PAGE.margin - PAGE.footer,
    },
    y: PAGE.margin,
    pageNumberSlots: [], // where "Page X of Y" goes on each page, filled in at the end
    images: new Map(),   // defect id -> JPEG data URL (or null)

    // Start a new page if `h` points of content would not fit.
    ensureSpace(h) {
      if (ctx.y + h <= ctx.page.bottom) return;
      doc.addPage();
      ctx.y = drawRunningHeader(ctx);
    },
  };
  return ctx;
}

// Loads a photo and crops it to 4:3 so every row looks the same.
function loadPhoto(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const w = 480, h = 360;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const sw = w / scale, sh = h / scale;
      const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function exportPdf(project, sections = REPORT_SECTIONS) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const ctx = createContext(doc, project);

  const photos = await Promise.all(ctx.defects.map((d) => loadPhoto(d.photo)));
  ctx.defects.forEach((d, i) => ctx.images.set(d.id, photos[i]));

  for (const section of sections) await section(ctx);

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(ctx, i, total);
  }

  const date = ctx.exportedAt.toISOString().slice(0, 10);
  doc.save(`${slug(project.structureName)}-defects-${date}.pdf`);
  return doc;
}
