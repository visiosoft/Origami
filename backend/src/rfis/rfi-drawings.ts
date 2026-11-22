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
