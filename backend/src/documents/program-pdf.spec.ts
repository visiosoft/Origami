import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';
import { buildProgramPdf, clean, fitText, wrap } from './program-pdf';
import type { Branding } from './letterhead';

const brand: Branding = {
  companyName: 'Origami Design + Build', tagline: '', logoDataUrl: '', accentColor: '#173326', address: '2140 Pine St, San Francisco, CA',
  phone: '(650) 761-4661', email: 'hello@origamidb.com', website: 'origamidb.com', footerNote: '', signatureName: '', signatureTitle: '',
  signatureDataUrl: '', footerLogoDataUrl: '', aboutUsText: 'We design and build homes.\n\nOne team from first sketch to final walk-through.',
  team: [{ name: 'Edward M.', title: 'Principal', photoDataUrl: '' }, { name: 'Sara R.', title: 'Project Manager', photoDataUrl: '' }], coverPhotoDataUrl: '',
};

describe('the Project Program PDF (Oct 31)', () => {
  it('wraps text to a width with the real font', async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrap('The quick brown fox jumps over the lazy dog again and again', f, 10, 120);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(f.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(120);
  });

  it('lays out a cover, an at-a-glance page, About Us and the sections, with page numbers', async () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({
      name: ['Site & Zoning', 'Design Goals', 'Spaces & Rooms', 'Budget', 'Schedule', 'Selections “and” finishes — long title that keeps going'][i],
      blurb: 'What we know so far, and what is still to decide with you.',
      blocks: [
        { title: 'Key facts', kind: 'fields' as const, rows: [{ label: 'Lot size', value: '5,200 sq ft' }, { label: 'Zoning', value: '' }, { label: 'Setbacks', value: 'Front 15 ft, sides 5 ft, rear 25 ft — check the corner lot rule with the planner before the schematic design starts' }] },
        { title: 'Costs', kind: 'table' as const, rows: Array.from({ length: 9 }, (_, k) => ({ label: `Line item ${k + 1} with a description`, budget: `$${(k + 1) * 1200}`, actual: k % 2 ? '' : `$${k * 900}`, notes: k === 3 ? 'Allowance; final price after selections' : '' })) },
        { title: 'Duration', kind: 'weeks' as const, rows: [{ label: 'Design', value: '8 weeks' }, { label: 'Permits', value: '3-6 months' }] },
        { title: 'Open questions', kind: 'list' as const, rows: [{ label: 'Q', value: 'Keep the garage?' }, { label: 'Q', value: 'Solar now or later?' }] },
      ],
      totals: { budget: '$54,000', actual: '$18,900' },
    }));
    const pdf = await buildProgramPdf({ brand, projectName: 'Lee Residence', subtitle: 'Kitchen remodel and rear addition', date: 'October 31, 2026', steps });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    if (process.env.PROGRAM_PDF_OUT) writeFileSync(process.env.PROGRAM_PDF_OUT, pdf);
  });

  it('long values fit their column and odd characters print as plain ones (Nov 20)', async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const fit = fitText('$1,234,567.89 including allowances', f, 9.5, 88);
    expect(fit.size).toBeLessThan(9.5);
    for (const l of fit.lines) expect(f.widthOfTextAtSize(l, fit.size)).toBeLessThanOrEqual(88);
    expect(clean('• Tile ™ €40 → Zoë Çelik Ł')).toBe("- Tile TM EUR40 -> Zoë Çelik L");
    const long = 'Selections, finishes, fixtures, appliances and every allowance the owner still has to choose before the permit set';
    const pdf = await buildProgramPdf({ brand, projectName: 'The Bartholomew-Fitzgerald Montgomery-Castellanos Residence at 1311 Countryside Court, Milpitas', date: 'Nov 20, 2026', steps: [{
      name: long, blurb: '', totals: { budget: '$12,345,678.90 (est.)', actual: '$1,234,567.89 to date' },
      blocks: [
        { title: 'Costs', kind: 'table' as const, rows: [{ label: long, budget: '$1,234,567.89 incl. allowance', actual: '$987,654.32 so far', notes: long }] },
        { title: 'Duration', kind: 'weeks' as const, rows: [{ label: 'Permits', value: '3-6 months, depending on the city planner and the structural review' }] },
      ],
    }] });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
