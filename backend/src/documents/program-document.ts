/**
 * The Project Program's content, as the page sends it: sections ("steps"),
 * each with blocks of rows. documents/program-pdf.ts lays it out as the PDF.
 */

export interface DocRow {
  label: string;
  /** kind: 'fields' | 'weeks' | 'list' */
  value?: string;
  /** kind: 'table' */
  budget?: string;
  actual?: string;
  notes?: string;
}

export interface DocBlock {
  title?: string;
  kind: 'fields' | 'table' | 'weeks' | 'list';
  note?: string;
  rows: DocRow[];
}

export interface DocStep {
  name: string;
  blurb?: string;
  blocks: DocBlock[];
  totals?: { budget: string; actual: string };
}
