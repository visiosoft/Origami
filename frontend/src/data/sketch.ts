/**
 * A blank sheet to sketch on (Nov 10 sync: "a white page to draw on, saved
 * with the project"). It's a one-page PDF made here, so the drawing tools,
 * layers, RFIs and downloads all work on it like on any drawing. The page is
 * 11×17 landscape with a small title in the corner (which also names the sheet).
 */
const W = 1224; // 17 in × 72
const H = 792; // 11 in × 72

/** Plain text a PDF string can hold: printable ASCII, brackets and backslashes escaped. */
const pdfText = (s: string) => s.replace(/[^\x20-\x7E]/g, ' ').replace(/[\\()]/g, (c) => '\\' + c).slice(0, 120);

export function sketchTitle(project: string | null | undefined, when = new Date()) {
  const d = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `SK-${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')} Sketch${project ? ` - ${project}` : ''} - ${d}`;
}

export function blankSketchPdf(title: string): Uint8Array<ArrayBuffer> {
  const content = `BT /F1 10 Tf 0.45 g ${W - 36} 24 Td (${pdfText(title)}) Tj ET\n0.8 G 0.5 w 18 18 ${W - 36} ${H - 36} re S\n`;
  // Right-aligned would need font metrics; move the title left by its rough width instead.
  const shift = Math.min(W - 72, pdfText(title).length * 5.2);
  const body = content.replace(`${W - 36} 24 Td`, `${(W - 36 - shift).toFixed(1)} 24 Td`);
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${body.length} >>\nstream\n${body}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Title (${pdfText(title)}) /Creator (Origami) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out) as Uint8Array<ArrayBuffer>;
}

/** The file to upload: a name that sorts by time and can't clash. */
export function sketchFile(project: string | null | undefined, when = new Date()): File {
  const title = sketchTitle(project, when);
  const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')} ${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}`;
  return new File([blankSketchPdf(title)], `Sketch ${stamp}.pdf`, { type: 'application/pdf' });
}
