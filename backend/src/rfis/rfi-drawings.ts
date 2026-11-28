import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { flattenPdf, toPage, type MarkupData } from '../file-room/markups';

/**
 * Nov 19 (Edward: "This looks good for RFIs, but can we include the relevant
 * drawings?"): after the RFI form, one page per referenced sheet -- the sheet
 * with the RFI's markups drawn in, cropped to the area around them, labelled.
 */
export interface DrawingSheet { bytes: Uint8Array; page: number; title: string; marks: { page: number; kind: string; data: MarkupData }[] }

/** The area (PDF points, bottom-left origin) around these markups, with room to read around them. */
export function cropAround(marks: { data: MarkupData }[], w: number, h: number, rotation: number): { x: number; y: number; width: number; height: number } {
  const pts = marks.flatMap((m) => (m.data?.points || []).map((p) => toPage(p, w, h, rotation)));
  if (!pts.length) return { x: 0, y: 0, width: w, height: h };
  // toPage gives top-left points; PDF boxes are bottom-left.
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => h - p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padX = Math.max(60, (x1 - x0) * 0.35), padY = Math.max(60, (y1 - y0) * 0.35);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  // At least a readable patch (about a fifth of the sheet), never off the page.
  const minW = w * 0.22, minH = h * 0.22;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

export async function appendDrawings(main: Uint8Array, sheets: DrawingSheet[]): Promise<Uint8Array> {
  if (!sheets.length) return main;
  const out = await PDFDocument.load(main, { ignoreEncryption: true });
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  for (const s of sheets) {
    const onPage = s.marks.filter((m) => m.page === s.page);
    const drawn = await PDFDocument.load(await flattenPdf(s.bytes, onPage), { ignoreEncryption: true });
    if (s.page < 1 || s.page > drawn.getPageCount()) continue;
    const [copy] = await out.copyPages(drawn, [s.page - 1]);
    const { width: w, height: h } = copy.getSize();
    const box = cropAround(onPage, w, h, copy.getRotation().angle);
    copy.setCropBox(box.x, box.y, box.width, box.height);
    copy.setMediaBox(box.x, box.y, box.width, box.height);
    // A label in the corner: which drawing and page this is.
    const size = Math.max(8, Math.min(14, box.width / 60));
    const label = s.title.slice(0, 120);
    const tw = font.widthOfTextAtSize(label, size);
    copy.drawRectangle({ x: box.x, y: box.y + box.height - size * 2, width: Math.min(box.width, tw + size * 1.4), height: size * 2, color: rgb(1, 1, 1), opacity: 0.9 });
    copy.drawText(label, { x: box.x + size * 0.7, y: box.y + box.height - size * 1.45, size, font, color: rgb(0.08, 0.13, 0.11) });
    out.addPage(copy);
  }
  return out.save();
}

// ---------------------------------------------------------------------------
// Nov 27 (Weekly Sync, Edward): the RFI report -- after the form, a table of
// contents of the callouts (item, type, label, plan location, origin, status,
// page), then one page per callout: the drawing cropped around it with its
// number and label, and the question under it; then photos from the notes.

export interface ReportItem {
  n: number; kind: string; label: string; sheet: string; origin: string; status: string;
  bytes: Uint8Array; page: number; mark: { page: number; kind: string; data: MarkupData };
  /** The other RFI markups on the same sheet page, drawn for context. */
  context?: { page: number; kind: string; data: MarkupData }[];
  cacheKey?: string;
}
export interface ReportPhoto { bytes: Uint8Array; mimeType: string; caption: string }
export interface TocRow { n: number; kind: string; label: string; sheet: string; origin: string; status: string; pdfPage: number }

export const TOC_ROWS_PER_PAGE = 26;
export const tocPageCount = (items: number) => (items ? Math.ceil(items / TOC_ROWS_PER_PAGE) : 0);

/** The table of contents: each item's page in the finished PDF. */
export function tocRows(items: Omit<TocRow, 'pdfPage'>[], formPages: number): TocRow[] {
  const first = formPages + tocPageCount(items.length) + 1;
  return items.map((it, i) => ({ n: it.n, kind: it.kind, label: it.label, sheet: it.sheet, origin: it.origin, status: it.status, pdfPage: first + i }));
}

/** Only characters the standard PDF fonts can draw. */
export const pdfSafe = (s: unknown) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E -ÿ–—‘’“”…•]/g, '');

function fit(font: any, text: string, size: number, max: number) {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > max) t = t.slice(0, -1);
  return t + '…';
}
function wrap(font: any, text: string, size: number, max: number, lines: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const out: string[] = []; let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) { cur = next; continue; }
    if (cur) out.push(cur);
    cur = w;
    if (out.length >= lines) break;
  }
  if (cur && out.length < lines) out.push(cur);
  if (out.length === lines && words.join(' ').length > out.join(' ').length) out[lines - 1] = fit(font, out[lines - 1] + ' …', size, max);
  return out;
}

export async function appendReport(main: Uint8Array, rep: { number: string; question?: string | null; items: ReportItem[]; photos?: ReportPhoto[] }): Promise<Uint8Array> {
  const items = rep.items; const photos = rep.photos || [];
  if (!items.length && !photos.length) return main;
  const out = await PDFDocument.load(main, { ignoreEncryption: true });
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const reg = await out.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.04, 0.1, 0.07), muted = rgb(0.36, 0.42, 0.4), forest = rgb(0.09, 0.2, 0.15);

  // 1. Table of contents.
  const rows = tocRows(items, out.getPageCount());
  const cols = [{ k: '#', w: 26 }, { k: 'Type', w: 64 }, { k: 'Named label', w: 132 }, { k: 'Plan location', w: 132 }, { k: 'Origin', w: 80 }, { k: 'Status', w: 70 }, { k: 'Page', w: 36 }];
  for (let p = 0; p < tocPageCount(rows.length); p++) {
    const page = out.addPage([612, 792]);
    let y = 740;
    page.drawText(pdfSafe(`${rep.number} · Items on the drawings`), { x: 40, y, size: 16, font: bold, color: ink });
    y -= 16;
    page.drawText(pdfSafe(`${rows.length} item${rows.length === 1 ? '' : 's'} — each has its own page with the drawing cropped around it.`), { x: 40, y, size: 9.5, font: reg, color: muted });
    y -= 26;
    let x = 40;
    for (const c of cols) { page.drawText(c.k.toUpperCase(), { x, y, size: 7.5, font: bold, color: forest }); x += c.w; }
    y -= 6; page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.2, color: forest }); y -= 15;
    for (const r of rows.slice(p * TOC_ROWS_PER_PAGE, (p + 1) * TOC_ROWS_PER_PAGE)) {
      const vals = [String(r.n), r.kind, r.label || '—', r.sheet, r.origin || '—', r.status, String(r.pdfPage)];
      x = 40;
      vals.forEach((v, i) => { page.drawText(fit(i === 2 ? bold : reg, v, 9, cols[i].w - 6), { x, y, size: 9, font: i === 2 ? bold : reg, color: ink }); x += cols[i].w; });
      y -= 7; page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 0.4, color: rgb(0.86, 0.85, 0.82) }); y -= 15;
    }
  }

  // 2. One page per item.
  const flattened = new Map<string, PDFDocument>();
  for (const it of items) {
    try {
      const key = it.cacheKey || `${it.n}`;
      let drawn = flattened.get(key);
      if (!drawn) {
        const marks = (it.context?.length ? it.context : [it.mark]).filter((m) => m.page === it.page);
        drawn = await PDFDocument.load(await flattenPdf(it.bytes, marks), { ignoreEncryption: true });
        flattened.set(key, drawn);
      }
      if (it.page < 1 || it.page > drawn.getPageCount()) continue;
      const [copy] = await out.copyPages(drawn, [it.page - 1]);
      const { width: w, height: h } = copy.getSize();
      const rot = copy.getRotation().angle;
      const box = cropAround([it.mark], w, h, rot);
      copy.setCropBox(box.x, box.y, box.width, box.height);
      copy.setMediaBox(box.x, box.y, box.width, box.height);
      const size = Math.max(8, Math.min(16, box.width / 55));
      // The number on the drawing, next to the markup.
      const pts = (it.mark.data?.points || []).map((pt) => toPage(pt, w, h, rot));
      if (pts.length) {
        const cx = Math.max(...pts.map((q) => q[0])), cy = h - Math.min(...pts.map((q) => q[1]));
        const r = size * 1.1;
        const bx = Math.min(box.x + box.width - r, cx + r * 0.6), by = Math.min(box.y + box.height - r * 3.2, cy + r * 0.6);
        copy.drawCircle({ x: bx, y: by, size: r, color: forest, borderColor: rgb(1, 1, 1), borderWidth: 1.5 });
        const t = String(it.n); const tw = bold.widthOfTextAtSize(t, size);
        copy.drawText(t, { x: bx - tw / 2, y: by - size * 0.35, size, font: bold, color: rgb(1, 1, 1) });
      }
      // Top strip: item, type, label and sheet.
      const head = `${it.n} · ${it.kind}${it.label ? ` · ${it.label}` : ''}`;
      const sub = `${it.sheet} · ${it.origin || ''} · ${it.status}`;
      copy.drawRectangle({ x: box.x, y: box.y + box.height - size * 3.3, width: box.width, height: size * 3.3, color: rgb(1, 1, 1), opacity: 0.93 });
      copy.drawText(fit(bold, head, size, box.width - size * 1.4), { x: box.x + size * 0.7, y: box.y + box.height - size * 1.5, size, font: bold, color: ink });
      copy.drawText(fit(reg, sub, size * 0.75, box.width - size * 1.4), { x: box.x + size * 0.7, y: box.y + box.height - size * 2.75, size: size * 0.75, font: reg, color: muted });
      // Bottom strip: the question.
      if (rep.question?.trim()) {
        const qs = size * 0.8;
        const lines = wrap(reg, `Question: ${rep.question}`, qs, box.width - size * 1.4, 3);
        const hgt = qs * (lines.length * 1.35 + 1);
        copy.drawRectangle({ x: box.x, y: box.y, width: box.width, height: hgt, color: rgb(1, 1, 1), opacity: 0.93 });
        lines.forEach((ln, i) => copy.drawText(ln, { x: box.x + size * 0.7, y: box.y + hgt - qs * (1.3 + i * 1.35), size: qs, font: reg, color: ink }));
      }
      out.addPage(copy);
    } catch { /* a sheet that can't be read is left out; the table still lists it */ }
  }

  // 3. Photos from the notes, two to a page.
  for (let i = 0; i < photos.length; i += 2) {
    const page = out.addPage([612, 792]);
    page.drawText(pdfSafe(`${rep.number} · Photos from notes and updates`), { x: 40, y: 750, size: 12, font: bold, color: ink });
    for (let j = 0; j < 2 && i + j < photos.length; j++) {
      const ph = photos[i + j];
      try {
        const img = /png/i.test(ph.mimeType) ? await out.embedPng(ph.bytes) : await out.embedJpg(ph.bytes);
        const top = 730 - j * 350, maxW = 532, maxH = 310;
        const k = Math.min(maxW / img.width, maxH / img.height, 1);
        page.drawImage(img, { x: 40, y: top - img.height * k, width: img.width * k, height: img.height * k });
        page.drawText(fit(reg, ph.caption, 9, maxW), { x: 40, y: top - maxH - 14, size: 9, font: reg, color: muted });
      } catch { /* not an image pdf-lib can read */ }
    }
  }
  return out.save();
}
