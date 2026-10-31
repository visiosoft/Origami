import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { accentOf, type Branding } from './letterhead';
import type { DocBlock, DocStep } from './program-document';

/**
 * The Project Program as a PDF, laid out here (Oct 31) rather than converted
 * from HTML by Google Docs, which dropped most of the styling. Portrait US
 * Letter: a cover, an at-a-glance page, About Us, then each section flowing
 * on (a section starts a new page only when little room is left). Every page
 * after the cover carries a running head and a footer with page numbers.
 */

const W = 612, H = 792, M = 48; // page and margin, points
const TOP = H - 100, BOTTOM = 64; // the flow area between running head and footer
const INK = rgb(0.07, 0.1, 0.09), BODY = rgb(0.25, 0.29, 0.27), MUTED = rgb(0.45, 0.5, 0.48), RULE = rgb(0.9, 0.91, 0.9), FAINT = rgb(0.96, 0.97, 0.96);

/** Standard PDF fonts read Latin-1 only: quotes and dashes become their plain forms, anything else "?". */
const clean = (s: unknown) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/·/g, '·')
  .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');

function hexRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
/** A colour mixed with white: 0 = white, 1 = the colour. */
const tint = (c: RGB, k: number) => rgb(1 - (1 - c.red) * k, 1 - (1 - c.green) * k, 1 - (1 - c.blue) * k);

/** Text wrapped to a width, word by word; a word too long for a line is broken by letters. */
export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (let w of para.split(/ +/)) {
      while (font.widthOfTextAtSize(w, size) > maxW && w.length > 1) {
        if (line) { out.push(line); line = ''; }
        let n = w.length - 1;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxW) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      const next = line ? `${line} ${w}` : w;
      if (line && font.widthOfTextAtSize(next, size) > maxW) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

async function embedDataUrl(doc: PDFDocument, url?: string): Promise<PDFImage | null> {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(url || '');
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  return (m[1].toLowerCase() === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)).catch(() => null);
}

export async function buildProgramPdf(opts: { brand: Branding; projectName: string; subtitle?: string; date?: string; steps: DocStep[] }): Promise<Buffer> {
  const { brand: b, steps } = opts;
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`${opts.projectName} - Project Program`));
  doc.setAuthor(clean(b.companyName || ''));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexRgb(accentOf(b));
  const [logo, cover, footLogo] = await Promise.all([embedDataUrl(doc, b.logoDataUrl), embedDataUrl(doc, b.coverPhotoDataUrl), embedDataUrl(doc, b.footerLogoDataUrl)]);

  let page: PDFPage = doc.addPage([W, H]);
  let y = TOP;
  const text = (s: string, x: number, yy: number, size: number, f = font, color = BODY) => page.drawText(clean(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size: number, f = font, color = BODY) => text(s, xr - f.widthOfTextAtSize(clean(s), size), yy, size, f, color);
  const newPage = () => { page = doc.addPage([W, H]); y = TOP; };
  /** Room for `h` points, else a new page; true when it turned the page. */
  const ensure = (h: number) => { if (y - h < BOTTOM) { newPage(); return true; } return false; };
  const fit = (img: PDFImage, maxW: number, maxH: number) => { const k = Math.min(maxW / img.width, maxH / img.height, 1); return { width: img.width * k, height: img.height * k }; };

  // ---------------------------------------------------------------- cover
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: accent });
  if (logo) { const s = fit(logo, 170, 60); page.drawImage(logo, { x: M, y: H - 40 - s.height, ...s }); }
  else text(b.companyName || '', M, H - 64, 16, bold, INK);
  let cy = H - 170;
  if (cover) {
    const s = fit(cover, W - 2 * M, 250);
    // Fitted inside a full-width band, centred.
    page.drawRectangle({ x: M, y: cy - 250, width: W - 2 * M, height: 250, color: FAINT });
    page.drawImage(cover, { x: M + (W - 2 * M - s.width) / 2, y: cy - 250 + (250 - s.height) / 2, ...s });
    cy -= 290;
  } else cy -= 40;
  text('PROJECT PROGRAM', M, cy, 10, bold, accent); cy -= 34;
  for (const line of wrap(opts.projectName, bold, 30, W - 2 * M)) { text(line, M, cy, 30, bold, INK); cy -= 36; }
  if (opts.subtitle) for (const line of wrap(opts.subtitle, font, 13, W - 2 * M)) { text(line, M, cy, 13, font, BODY); cy -= 18; }
  if (opts.date) { cy -= 6; text(opts.date, M, cy, 11, font, MUTED); }
  // Prepared by, at the foot of the cover.
  page.drawRectangle({ x: M, y: 112, width: 36, height: 3, color: accent });
  text(`Prepared by ${b.companyName || ''}`.trim(), M, 92, 10, bold, INK);
  const contact = [b.address, b.phone, b.email, b.website].filter(Boolean).join('  ·  ');
  for (const [i, line] of wrap(contact, font, 9, W - 2 * M).slice(0, 2).entries()) text(line, M, 76 - i * 12, 9, font, MUTED);

  // ---------------------------------------------------------------- at a glance
  const hasMoney = steps.some((s) => s.totals);
  newPage();
  text('At a glance', M, y, 20, bold, INK); y -= 18;
  text(`${steps.length} section${steps.length === 1 ? '' : 's'}`, M, y, 9.5, font, MUTED); y -= 24;
  const glanceHead = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: FAINT });
    text('#', M + 8, y, 8.5, bold, MUTED); text('SECTION', M + 34, y, 8.5, bold, MUTED);
    if (hasMoney) { right('BUDGET', W - M - 100, y, 8.5, bold, MUTED); right('ACTUAL', W - M - 8, y, 8.5, bold, MUTED); }
    y -= 22;
  };
  glanceHead();
  steps.forEach((s, i) => {
    const lines = wrap(s.name, font, 10.5, (hasMoney ? W - 2 * M - 230 : W - 2 * M - 50));
    const h = lines.length * 14 + 8;
    if (ensure(h)) glanceHead();
    text(String(i + 1), M + 8, y, 10.5, bold, accent);
    lines.forEach((l, k) => text(l, M + 34, y - k * 14, 10.5, font, INK));
    if (hasMoney && s.totals) { right(s.totals.budget || '-', W - M - 100, y, 10.5, font, INK); right(s.totals.actual || '-', W - M - 8, y, 10.5, font, BODY); }
    y -= h;
    page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.6, color: RULE });
  });

  // ---------------------------------------------------------------- about us
  const about = (b.aboutUsText || '').trim();
  if (about || (b.team || []).length) {
    newPage();
    text(`About ${b.companyName || 'us'}`, M, y, 20, bold, INK); y -= 28;
    for (const para of about.split(/\n{2,}/).filter((p) => p.trim())) {
      for (const line of wrap(para.replace(/\n/g, ' '), font, 10.5, W - 2 * M)) { ensure(15); text(line, M, y, 10.5, font, BODY); y -= 15; }
      y -= 8;
    }
    const team = b.team || [];
    if (team.length) {
      y -= 6; ensure(30); text('TEAM', M, y, 9, bold, accent); y -= 18;
      const colW = (W - 2 * M) / 4;
      for (let i = 0; i < team.length; i += 4) {
        ensure(130);
        for (const [j, t] of team.slice(i, i + 4).entries()) {
          const x = M + j * colW;
          const photo = await embedDataUrl(doc, t.photoDataUrl);
          if (photo) { const s = fit(photo, 84, 84); page.drawImage(photo, { x, y: y - 84 + (84 - s.height), ...s }); }
          else page.drawRectangle({ x, y: y - 84, width: 84, height: 84, color: FAINT });
          wrap(t.name, bold, 9.5, colW - 10).slice(0, 2).forEach((l, k) => text(l, x, y - 98 - k * 12, 9.5, bold, INK));
          wrap(t.title, font, 8.5, colW - 10).slice(0, 2).forEach((l, k) => text(l, x, y - 122 - k * 11, 8.5, font, MUTED));
        }
        y -= 150;
      }
    }
  }

  // ---------------------------------------------------------------- sections
  const blockFns = {
    heading: (block: DocBlock) => {
      if (block.title) { ensure(40); y -= 6; text(block.title, M, y, 11.5, bold, accent); y -= 15; }
      if (block.note) for (const l of wrap(block.note, font, 8.5, W - 2 * M)) { ensure(12); text(l, M, y, 8.5, font, MUTED); y -= 11; }
      if (block.note) y -= 3;
    },
  };
  const dash = (v?: string) => (String(v ?? '').trim() ? String(v) : '-');

  steps.forEach((step, i) => {
    // A section starts a page of its own only when there's little room left.
    if (i === 0 || y < BOTTOM + 220) newPage(); else y -= 18;
    page.drawRectangle({ x: M, y: y - 14, width: W - 2 * M, height: 40, color: tint(accent, 0.1) });
    page.drawRectangle({ x: M, y: y - 14, width: 4, height: 40, color: accent });
    text(`SECTION ${i + 1} OF ${steps.length}`, M + 16, y + 12, 8, bold, accent);
    text(wrap(step.name, bold, 15, W - 2 * M - 32)[0] || '', M + 16, y - 4, 15, bold, INK);
    y -= 38;
    if (step.blurb) { for (const l of wrap(step.blurb, font, 9.5, W - 2 * M)) { ensure(13); text(l, M, y, 9.5, font, BODY); y -= 13; } y -= 4; }

    for (const block of step.blocks) {
      blockFns.heading(block);
      if (!block.rows.length) continue;
      if (block.kind === 'table') {
        const cols = { desc: M + 6, budgetR: M + 330, actualR: M + 410, notes: M + 422 };
        const head = () => {
          page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: FAINT });
          text('DESCRIPTION', cols.desc, y, 7.5, bold, MUTED); right('BUDGET', cols.budgetR, y, 7.5, bold, MUTED);
          right('ACTUAL', cols.actualR, y, 7.5, bold, MUTED); text('NOTES', cols.notes, y, 7.5, bold, MUTED);
          y -= 18;
        };
        ensure(40); head();
        for (const r of block.rows) {
          const d = wrap(r.label, font, 9.5, 230), n = wrap(dash(r.notes), font, 8.5, W - M - cols.notes);
          const h = Math.max(d.length * 12, n.length * 11) + 8;
          if (ensure(h)) head();
          d.forEach((l, k) => text(l, cols.desc, y - k * 12, 9.5, font, INK));
          right(dash(r.budget), cols.budgetR, y, 9.5, font, INK);
          right(dash(r.actual), cols.actualR, y, 9.5, font, BODY);
          n.forEach((l, k) => text(l, cols.notes, y - k * 11, 8.5, font, MUTED));
          y -= h;
          page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.5, color: RULE });
        }
      } else if (block.kind === 'list') {
        for (const r of block.rows) {
          const lines = wrap(r.value || r.label, font, 9.5, W - 2 * M - 16);
          ensure(lines.length * 13 + 2);
          page.drawCircle({ x: M + 4, y: y + 3, size: 1.8, color: accent });
          lines.forEach((l, k) => text(l, M + 14, y - k * 13, 9.5, font, BODY));
          y -= lines.length * 13 + 3;
        }
      } else {
        // fields and weeks: label on the left, the answer beside it (weeks right-aligned).
        const labelW = 190;
        for (const r of block.rows) {
          const ls = wrap(r.label, font, 8.5, labelW - 10);
          const vs = block.kind === 'weeks' ? [dash(r.value)] : wrap(dash(r.value), font, 9.5, W - 2 * M - labelW - 6);
          const h = Math.max(ls.length * 11, vs.length * 12.5) + 8;
          ensure(h);
          ls.forEach((l, k) => text(l, M + 6, y - k * 11, 8.5, font, MUTED));
          if (block.kind === 'weeks') right(vs[0], W - M - 6, y, 9.5, font, String(r.value ?? '').trim() ? INK : MUTED);
          else vs.forEach((l, k) => text(l, M + labelW, y - k * 12.5, 9.5, font, String(r.value ?? '').trim() ? INK : MUTED));
          y -= h;
          page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.5, color: RULE });
        }
      }
      y -= 6;
    }
    if (step.totals) {
      ensure(34); y -= 4;
      page.drawRectangle({ x: M, y: y - 12, width: W - 2 * M, height: 28, color: FAINT });
      text('Budget subtotal', M + 10, y - 2, 9, font, MUTED); right(step.totals.budget || '-', M + 250, y - 2, 11, bold, accent);
      text('Actual to date', M + 290, y - 2, 9, font, MUTED); right(step.totals.actual || '-', W - M - 10, y - 2, 11, bold, INK);
      y -= 36;
    }
  });

  // ---------------------------------------------------------------- running head and footer (every page but the cover)
  const pages = doc.getPages();
  const head = [opts.projectName, 'Project Program'].filter(Boolean).join('  ·  ');
  const foot = [b.companyName, b.phone, b.email, b.website].filter(Boolean).join('  ·  ');
  pages.forEach((p, i) => {
    if (i === 0) return;
    page = p;
    if (logo) { const s = fit(logo, 90, 24); p.drawImage(logo, { x: M, y: H - 32 - s.height, ...s }); }
    else text(b.companyName || '', M, H - 46, 10, bold, INK);
    right(wrap(head, font, 8.5, 360)[0] || '', W - M, H - 44, 8.5, font, MUTED);
    p.drawLine({ start: { x: M, y: H - 58 }, end: { x: W - M, y: H - 58 }, thickness: 1.2, color: accent });
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: RULE });
    if (footLogo) { const s = fit(footLogo, 14, 14); p.drawImage(footLogo, { x: M, y: 24, ...s }); }
    text(wrap(foot, font, 8, 400)[0] || '', M + (footLogo ? 20 : 0), 28, 8, font, MUTED);
    right(`${i + 1} / ${pages.length}`, W - M, 28, 8.5, bold, accent);
  });

  return Buffer.from(await doc.save());
}
