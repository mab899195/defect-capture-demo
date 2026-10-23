// Building blocks of the PDF report. Each section is `(ctx) => void` and
// advances ctx.y. Units are points (72 per inch) on a US Letter page.

import { CONDITION_STATES, csLabel, statusLabel, typeLabel } from '../constants.js';
import { formatDateTime, formatLongDate } from '../ui.js';

// The built-in PDF fonts cover Latin-1 only, so swap the few characters
// the app uses that fall outside it.
const pdfText = (s) => String(s ?? '')
  .replace(/−/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...');

function font(doc, size, style = 'normal', color = '#15191E') {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

// ---------------------------------------------------------------------------
// Defect row fields. Add an entry here to show another field on every row.
//   label:  shown above the value
//   value:  (defect, ctx) => string; empty values are skipped
//   width:  'col' (one of three columns) or 'full' (whole text column)
//   style:  optional (defect) => { color, bold }
// ---------------------------------------------------------------------------
export const DEFECT_FIELDS = [
  {
    label: 'Location',
    width: 'col',
    value: (d) => [`${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`, d.location].filter(Boolean).join('\n'),
  },
  {
    label: 'Logged by',
    width: 'col',
    value: (d) => `${d.loggedBy}, ${formatDateTime(d.loggedAt)}`,
  },
  {
    label: 'Engineer status',
    width: 'col',
    value: (d) => statusLabel(d.engineerStatus),
    style: (d) => ({ bold: true, color: d.engineerStatus === 'revisit' ? '#9A3F06' : '#15191E' }),
  },
  {
    label: 'Notes',
    width: 'full',
    value: (d) => d.notes,
  },
  {
    label: 'Engineer comment',
    width: 'full',
    value: (d) => d.engineerComment,
  },
];

// ---------------------------------------------------------------------------
// Header (first page)
// ---------------------------------------------------------------------------
export function headerSection(ctx) {
  const { doc, project, page, theme } = ctx;
  const x = page.margin;
  const right = page.width - page.margin;

  font(doc, 8.5, 'bold', theme.text2);
  doc.text('DEFECT REPORT', x, 62, { charSpace: 1 });

  font(doc, 24, 'bold', theme.text);
  doc.text(pdfText(project.structureName), x, 90);

  font(doc, 10.5, 'normal', theme.text2);
  doc.text(pdfText(`${project.designOffice} · Condition states per AASHTO element framework`), x, 108);

  font(doc, 10, 'normal', theme.text2);
  doc.text(`Exported ${formatLongDate(ctx.exportedAt)}`, right, 92, { align: 'right' });
  ctx.pageNumberSlots.push({ page: 1, x: right, y: 106 });

  doc.setDrawColor(theme.text);
  doc.setLineWidth(1.5);
  doc.line(x, 122, right, 122);
  ctx.y = 142;
}

// Compact header on pages 2 and later. Returns the y where content starts.
export function drawRunningHeader(ctx) {
  const { doc, project, page, theme } = ctx;
  const x = page.margin;
  const right = page.width - page.margin;
  font(doc, 11, 'bold', theme.text);
  doc.text(pdfText(project.structureName), x, 58);
  font(doc, 9, 'normal', theme.text2);
  doc.text(pdfText(`${project.designOffice} · Defect report`), x, 72);
  ctx.pageNumberSlots.push({ page: doc.getNumberOfPages(), x: right, y: 64 });
  doc.setDrawColor(theme.border);
  doc.setLineWidth(1);
  doc.line(x, 82, right, 82);
  return 100;
}

// ---------------------------------------------------------------------------
// Summary: total plus a count per condition state
// ---------------------------------------------------------------------------
export function summarySection(ctx) {
  const { doc, defects, page, theme } = ctx;
  const boxes = [
    { value: defects.length, label: 'Defects', color: theme.text },
    ...[4, 3, 2, 1].map((cs) => {
      const n = defects.filter((d) => d.conditionState === cs).length;
      return { value: n, label: `CS ${cs} ${csLabel(cs)}`, color: cs === 4 && n > 0 ? CONDITION_STATES[4].color : theme.text };
    }),
  ];
  const gap = 10;
  const w = (page.contentWidth - gap * (boxes.length - 1)) / boxes.length;
  const h = 54;
  ctx.ensureSpace(h + 20);

  boxes.forEach((b, i) => {
    const x = page.margin + i * (w + gap);
    doc.setDrawColor(theme.border);
    doc.setLineWidth(1);
    doc.roundedRect(x, ctx.y, w, h, 6, 6, 'S');
    font(doc, 18, 'bold', b.color);
    doc.text(String(b.value), x + 10, ctx.y + 24);
    font(doc, 8.5, 'normal', theme.text2);
    doc.text(b.label, x + 10, ctx.y + 42);
  });
  ctx.y += h + 22;
}

// ---------------------------------------------------------------------------
// Defect rows: photo on the left, fields on the right
// ---------------------------------------------------------------------------
const PHOTO_W = 126;
const PHOTO_H = 94.5;
const ROW_PAD = 14;
const COL_GAP = 14;

function csChipPdf(doc, cs, xRight, yTop) {
  const { color, text, label } = CONDITION_STATES[cs];
  const str = `CS ${cs} ${label}`;
  font(doc, 8.5, 'bold', text);
  const w = doc.getTextWidth(str) + 12;
  doc.setFillColor(color);
  doc.roundedRect(xRight - w, yTop, w, 16, 3, 3, 'F');
  doc.text(str, xRight - w + 6, yTop + 11);
  return w;
}

// Lays out the fields for one defect. With draw = false it only measures,
// so the row height is known before anything is drawn.
function layoutFields(ctx, d, x, y, width, draw) {
  const { doc, theme } = ctx;
  const colW = (width - COL_GAP * 2) / 3;
  const labelH = 11;
  const lineH = 11.5;
  let col = 0;
  let rowY = y;
  let rowH = 0;

  const flushRow = () => {
    if (col > 0) { rowY += rowH + 8; col = 0; rowH = 0; }
  };

  for (const field of DEFECT_FIELDS) {
    const value = pdfText(field.value(d, ctx));
    if (!value.trim()) continue;
    const full = field.width === 'full';
    if (full) flushRow();
    const w = full ? width : colW;
    const fx = full ? x : x + col * (colW + COL_GAP);
    const style = field.style?.(d) ?? {};

    font(doc, 9.5, style.bold ? 'bold' : 'normal', style.color ?? theme.text);
    const lines = doc.splitTextToSize(value, w);
    const h = labelH + lines.length * lineH;

    if (draw) {
      font(doc, 7.5, 'normal', theme.text2);
      doc.text(field.label.toUpperCase(), fx, rowY + 7, { charSpace: 0.4 });
      font(doc, 9.5, style.bold ? 'bold' : 'normal', style.color ?? theme.text);
      doc.text(lines, fx, rowY + labelH + 8, { lineHeightFactor: lineH / 9.5 });
    }

    rowH = Math.max(rowH, h);
    if (full) {
      col = 1; // forces flush on the next field
      flushRow();
    } else if (++col === 3) {
      flushRow();
    }
  }
  flushRow();
  return rowY - y;
}

function drawPhoto(ctx, d, x, y) {
  const { doc, theme } = ctx;
  const data = ctx.images.get(d.id);
  if (data) {
    doc.addImage(data, 'JPEG', x, y, PHOTO_W, PHOTO_H, undefined, 'FAST');
  } else {
    doc.setFillColor(theme.placeholder);
    doc.rect(x, y, PHOTO_W, PHOTO_H, 'F');
    font(doc, 7.5, 'bold', '#3E444B');
    doc.text('NO PHOTO', x + 8, y + PHOTO_H - 8);
  }
}

export function defectsSection(ctx) {
  const { doc, defects, page, theme } = ctx;
  const textX = page.margin + PHOTO_W + 18;
  const textW = page.width - page.margin - textX;
  const right = page.width - page.margin;

  if (!defects.length) {
    font(doc, 11, 'normal', theme.text2);
    doc.text('No defects recorded for this project.', page.margin, ctx.y + 12);
    ctx.y += 30;
    return;
  }

  for (const d of defects) {
    const titleH = 24;
    const fieldsH = layoutFields(ctx, d, textX, 0, textW, false);
    const rowH = Math.max(PHOTO_H, titleH + fieldsH) + ROW_PAD * 2;
    ctx.ensureSpace(rowH);

    const top = ctx.y + ROW_PAD;
    drawPhoto(ctx, d, page.margin, top);

    const chipW = csChipPdf(doc, d.conditionState, right, top);
    font(doc, 12.5, 'bold', theme.text);
    const title = doc.splitTextToSize(pdfText(`${d.id} · ${typeLabel(d.type)}`), textW - chipW - 10)[0];
    doc.text(title, textX, top + 12);

    layoutFields(ctx, d, textX, top + titleH, textW, true);

    ctx.y += rowH;
    doc.setDrawColor(theme.border);
    doc.setLineWidth(0.75);
    doc.line(page.margin, ctx.y, right, ctx.y);
  }
}

// ---------------------------------------------------------------------------
// Footer and page numbers (drawn on every page once the total is known)
// ---------------------------------------------------------------------------
export function drawFooter(ctx, pageNo, total) {
  const { doc, page, theme } = ctx;
  const y = page.height - page.margin + 6;
  const right = page.width - page.margin;

  doc.setDrawColor(theme.border);
  doc.setLineWidth(0.75);
  doc.line(page.margin, y - 16, right, y - 16);
  font(doc, 8.5, 'normal', theme.text2);
  doc.text('Generated by Defect Capture (demo)', page.margin, y);
  doc.text(pageNo < total ? `Continued on page ${pageNo + 1}` : 'End of report', right, y, { align: 'right' });

  const slot = ctx.pageNumberSlots.find((s) => s.page === pageNo);
  if (slot) {
    font(doc, 10, 'normal', theme.text2);
    doc.text(`Page ${pageNo} of ${total}`, slot.x, slot.y, { align: 'right' });
  }
}
