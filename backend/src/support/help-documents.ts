import { BadRequestException } from '@nestjs/common';

export const HELP_DOC_KINDS = ['sop', 'sla', 'disaster', 'policy', 'other'] as const;

/** A clean document entry, or a 400 with what's missing. Links must be http(s). */
export function cleanHelpDoc(raw: any): { title: string; kind: string; url: string; summary: string | null; order: number } {
  const title = String(raw?.title ?? '').trim().slice(0, 200);
  if (!title) throw new BadRequestException('Give the document a title.');
  const url = String(raw?.url ?? '').trim().slice(0, 1000);
  if (!/^https:\/\/\S+$/i.test(url)) throw new BadRequestException('Paste the document’s link (https://…), e.g. its Google Drive link.');
  const kind = (HELP_DOC_KINDS as readonly string[]).includes(raw?.kind) ? raw.kind : 'other';
  const summary = String(raw?.summary ?? '').trim().slice(0, 1000) || null;
  const order = Number.isFinite(Number(raw?.order)) ? Number(raw.order) : 0;
  return { title, kind, url, summary, order };
}
