import { BadRequestException } from '@nestjs/common';
import type { BundleItem } from '../database/entities';

/**
 * Client approval bundles (Nov 17 sync): what a client may be asked to
 * approve, how each item reads on their page, their answers, and the signed
 * record as HTML for the PDF.
 */
export const BUNDLE_KINDS = ['rfi', 'record', 'co'] as const;
export const isForRecord = (topic?: string | null) => ['Observation', 'Decision', 'FYI'].includes(String(topic || ''));
const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function rfiItem(r: { id: string; number: string; subject?: string | null; question?: string | null; answer?: string | null }): BundleItem {
  return { kind: 'rfi', id: r.id, label: `${r.number} — ${clip(r.subject, 120)}`, summary: clip(r.answer ? `Q: ${r.question || ''} · A: ${r.answer}` : r.question, 900) };
}
export function recordItem(t: { id: string; serial?: string | null; topicType?: string | null; subject?: string | null; description?: string | null }): BundleItem {
  return { kind: 'record', id: t.id, label: `${t.serial || t.topicType || 'Record'} — ${clip(t.subject || String(t.description || '').split('\n')[0], 120)}`, summary: clip(t.description, 900) };
}
export function coItem(c: { id: string; number: string; title?: string | null; description?: string | null; amount?: number | null }): BundleItem {
  const money = c.amount != null ? ` · ${Number(c.amount) < 0 ? '−' : ''}$${Math.abs(Number(c.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  return { kind: 'co', id: c.id, label: `${c.number} — ${clip(c.title, 120)}${money}`, summary: clip(c.description, 900) };
}

/** The client's answers, checked: every item approved or declined, and a reason for each decline. */
export function cleanDecisions(items: BundleItem[], raw: unknown): BundleItem[] {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, { decision?: string; note?: string }>;
  return items.map((it) => {
    const a = d[`${it.kind}:${it.id}`] || {};
    const decision = a.decision === 'approved' || a.decision === 'declined' ? a.decision : null;
    if (!decision) throw new BadRequestException(`Approve or decline “${it.label}”.`);
    const note = clip(a.note, 1000) || null;
    if (decision === 'declined' && !note) throw new BadRequestException(`Say why you’re declining “${it.label}”.`);
    return { ...it, decision, note };
  });
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const KIND = { rfi: 'RFI', record: 'For record', co: 'Change order' } as const;

/** The signed record, as HTML for the PDF. */
export function bundleHtml(b: { number: string; title: string; items: BundleItem[]; signedName?: string | null; signedAt?: string | null; signatureImage?: string | null }, project: string, company: string) {
  const sig = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.signatureImage || '') ? `<img src="${b.signatureImage}" style="height:70px">` : '';
  // Nov 19 (Edward): a table of contents first, then the detail of each item.
  const verdict = (it: BundleItem) => (it.decision === 'approved' ? 'Approved' : it.decision === 'declined' ? 'Declined' : '—');
  const rows = b.items.map((it, i) => `<tr><td>${i + 1}.</td><td>${esc(it.label)}</td><td>${KIND[it.kind]}</td><td class="${it.decision === 'approved' ? 'ok' : 'no'}">${verdict(it)}</td></tr>`).join('');
  const details = b.items.map((it, i) => `<div style="margin-top:18px;page-break-inside:avoid"><div class="muted" style="font-size:10px;text-transform:uppercase">${i + 1}. ${KIND[it.kind]}</div><div style="font-size:14px;font-weight:700;margin:2px 0 6px">${esc(it.label)}</div>${it.summary ? `<div style="white-space:pre-wrap;line-height:1.5">${esc(it.summary)}</div>` : ''}<div style="margin-top:6px"><span class="${it.decision === 'approved' ? 'ok' : 'no'}">${verdict(it)}</span>${it.note ? ` — ${esc(it.note)}` : ''}</div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Helvetica,Arial,sans-serif;color:#14201C;font-size:12px;margin:32px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left;vertical-align:top}th{font-size:10px;text-transform:uppercase;color:#6B7A73}.ok{color:#1E6B36;font-weight:700}.no{color:#8E2E0A;font-weight:700}.muted{color:#6B7A73}</style></head><body>`
    + `<div class="muted">${esc(company)} · ${esc(project)}</div><h1>${esc(b.number)} — ${esc(b.title)}</h1>`
    + `<h2 style="font-size:14px;margin:18px 0 0">Contents</h2><table><tr><th>#</th><th>Item</th><th>Type</th><th>Decision</th></tr>${rows}</table>`
    + `<h2 style="font-size:14px;margin:24px 0 0">Details</h2>${details}`
    + `<div style="margin-top:28px">${sig}<div><b>${esc(b.signedName || '')}</b> — signed electronically${b.signedAt ? ` on ${esc(b.signedAt.slice(0, 10))}` : ''}</div></div></body></html>`;
}
