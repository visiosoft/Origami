import { escapeHtml } from '../email/shell';
import { NOTE_LABEL, type EstimateResult } from './estimate.calc';
import type { MoneyRights } from './estimate.money';

/**
 * The estimate letter (K8, Nov 13): the client's copy of an estimate on the
 * letterhead -- intro, description of work, scopes and their lines, the
 * inclusions / exclusions / assumptions, General Requirements, totals,
 * payment schedule, terms and signature blocks. What money it shows follows
 * the project's book type (the matching client role's data types, K7) and
 * the estimate's own "show client" switches. Tables and inline styles only,
 * so Google's HTML -> PDF conversion lays it out the same every time.
 */
export interface EstimateDocInput {
  estimate: {
    number: string; rev: number; title?: string | null; estimateDate?: string | null; status: string;
    intro?: string | null; descriptionOfWork?: string | null; terms?: string | null; closing?: string | null; additionalNotes?: string | null;
    showGrDetail?: boolean; showDiscount?: boolean; showDesignCost?: boolean;
    payments?: { id: string; label: string; mode: string; value: number }[] | null;
    acceptedAt?: string | null; signedName?: string | null; signatureImage?: string | null;
  };
  scopes: { id: string; title?: string | null; csiLabel?: string | null }[];
  lines: { id: string; scopeId: string; kind?: string | null; description?: string | null; pricing?: string | null }[];
  gr: { id: string; title?: string | null; included?: boolean }[];
  result: EstimateResult;
  money: MoneyRights;
  projectName: string;
  client: { name?: string | null; address?: string | null };
  brand: { companyName?: string; address?: string; phone?: string; email?: string; website?: string; accentColor?: string; logoDataUrl?: string };
}

const usd = (c: number | null | undefined) => {
  const v = (Number(c) || 0) / 100;
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const day = (d?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
const safeColor = (c?: string) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c! : '#173326');
const safeImg = (u?: string | null) => (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(u || '') ? u! : '');
const e = (v: unknown) => escapeHtml(String(v ?? ''));
const para = (t?: string | null) => (t && t.trim() ? `<div style="line-height:1.55;margin:0 0 12px">${e(t.trim()).replace(/\n/g, '<br>')}</div>` : '');
const H = (t: string) => `<div style="font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#778;font-weight:bold;margin:18px 0 6px">${e(t)}</div>`;

export function estimateHtml(d: EstimateDocInput): string {
  const { estimate: est, result: r, money: m } = d;
  const accent = safeColor(d.brand.accentColor);
  const logo = safeImg(d.brand.logoDataUrl);
  const lineOut = new Map(r.lines.map((l) => [l.id, l]));
  const scopeOut = new Map(r.scopes.map((s) => [s.id, s]));
  const open = m.cost && m.markup; // open book: cost and markup per line
  const td = 'padding:6px 4px;border-bottom:1px solid #eee;vertical-align:top';
  const num = `${td};text-align:right;white-space:nowrap`;
  const th = 'text-align:left;font-size:8.5pt;text-transform:uppercase;color:#778;border-bottom:1px solid #ccc;padding:6px 4px';

  const scopeRows = d.scopes.map((s, si) => {
    const so = scopeOut.get(s.id);
    const items = d.lines.filter((l) => l.scopeId === s.id && (!l.kind || l.kind === 'item'));
    const notes = d.lines.filter((l) => l.scopeId === s.id && l.kind && l.kind !== 'item' && (l.description || '').trim());
    const rows = items.map((l, li) => {
      const o = lineOut.get(l.id);
      const nis = l.pricing === 'nis';
      return `<tr><td style="${td};color:#778;width:36px">${si + 1}.${String(li + 1).padStart(2, '0')}</td>
        <td style="${td}">${e(l.description).replace(/\n/g, '<br>')}${nis ? ' <i style="color:#999">(not in scope)</i>' : ''}</td>
        ${open ? `<td style="${num}">${nis ? '' : usd(o?.cost)}</td><td style="${num}">${nis ? '' : usd(o?.markup)}</td>` : ''}
        ${m.price ? `<td style="${num}">${nis ? '—' : usd(o?.price)}</td>` : ''}</tr>`;
    }).join('');
    const byKind = new Map<string, string[]>();
    for (const n of notes) byKind.set(n.kind!, [...(byKind.get(n.kind!) || []), n.description!.trim()]);
    const noteHtml = [...byKind].map(([k, list]) => `<div style="margin:2px 0 4px"><b style="font-size:9pt;color:#556">${e(NOTE_LABEL[k as keyof typeof NOTE_LABEL] || k)}</b><ul style="margin:2px 0 0 18px;padding:0">${list.map((x) => `<li style="margin:1px 0">${e(x).replace(/\n/g, '<br>')}</li>`).join('')}</ul></div>`).join('');
    const cols = 2 + (open ? 2 : 0) + (m.price ? 1 : 0);
    return `<tr><td colspan="${cols - (m.price ? 1 : 0)}" style="padding:10px 4px 4px;font-weight:bold;border-bottom:1px solid #ccc">${si + 1}&nbsp;&nbsp;${e(s.csiLabel ? `${s.csiLabel} — ` : '')}${e(s.title || 'Scope')}</td>
      ${m.price ? `<td style="padding:10px 4px 4px;font-weight:bold;text-align:right;border-bottom:1px solid #ccc">${usd(so?.total)}</td>` : ''}</tr>
      ${rows}${noteHtml ? `<tr><td></td><td colspan="${cols - 1}" style="padding:4px 4px 8px;font-size:9.5pt">${noteHtml}</td></tr>` : ''}`;
  }).join('');

  const t = r.totals;
  const trow = (label: string, v: number | null | undefined, big = false) =>
    `<tr><td style="padding:5px 4px;${big ? 'font-weight:bold;font-size:12pt;border-top:2px solid #0B1A12' : ''}">${e(label)}</td><td style="padding:5px 4px;text-align:right;white-space:nowrap;${big ? 'font-weight:bold;font-size:12pt;border-top:2px solid #0B1A12' : ''}">${usd(v)}</td></tr>`;
  const grLines = est.showGrDetail && m.grDetail
    ? d.gr.filter((g) => g.included !== false).map((g) => trow(`   ${g.title || 'General requirement'}`, r.gr.find((x) => x.id === g.id)?.amount)).join('')
    : '';
  const totals = [
    m.subtotal ? trow('Subtotal', t.subtotal) : '',
    m.grTotal ? trow('General Requirements', t.grTotal) + grLines : '',
    m.grTotal && t.gl ? trow('General Liability', t.gl) : '',
    m.profit ? trow('Profit', t.profit) : '',
    m.contingency ? trow('Contractor contingency', t.contingency) : '',
    m.total ? trow('Total build cost', t.totalBuild, !est.showDiscount && !est.showDesignCost) : '',
    m.total && est.showDiscount && t.discount ? trow('Discounts & credits', -t.discount) : '',
    m.total && est.showDesignCost && t.designCost ? trow('Design cost', t.designCost) : '',
    m.total && (est.showDiscount || est.showDesignCost) ? trow('Total project cost', t.totalProject, true) : '',
  ].join('');
  const payments = m.total && (est.payments || []).length
    ? `${H('Payment schedule')}<table style="width:100%;border-collapse:collapse">${(est.payments || []).map((p, i) => `<tr><td style="${td}">${e(p.label)}${p.mode === 'pct' ? ` <span style="color:#778">(${e(p.value)}%)</span>` : ''}</td><td style="${num}">${usd(r.payments[i]?.amount)}</td></tr>`).join('')}</table>`
    : '';
  const sig = safeImg(est.signatureImage);
  return `<html><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;font-size:10.5pt;margin:0">
<table style="width:100%;border-collapse:collapse;border-bottom:3px solid ${accent}"><tr>
  <td style="vertical-align:top;padding-bottom:12px;font-size:9.5pt;color:#556;line-height:1.5">
    ${logo ? `<img src="${logo}" style="max-height:52px;max-width:210px;display:block;margin-bottom:6px">` : ''}
    <b style="font-size:13pt;color:#0B1A12">${e(d.brand.companyName)}</b><br>${e(d.brand.address)}<br>${e([d.brand.phone, d.brand.email, d.brand.website].filter(Boolean).join(' · '))}
  </td>
  <td style="vertical-align:top;text-align:right;padding-bottom:12px;line-height:1.6">
    <div style="font-size:20pt;font-weight:bold;color:${accent}">ESTIMATE</div>
    <b>${e(est.number)} · Rev ${e(est.rev)}</b><br>Date: ${e(day(est.estimateDate))}<br>Project: ${e(d.projectName)}
    ${d.client.name ? `<br>Prepared for: ${e(d.client.name)}` : ''}
  </td></tr></table>
${d.client.address ? `<div style="font-size:9.5pt;color:#556;margin-top:8px">${e(d.client.address).replace(/\n/g, '<br>')}</div>` : ''}
<div style="font-size:14pt;font-weight:bold;margin:16px 0 8px">${e(est.title || d.projectName)}</div>
${para(est.intro)}
${est.descriptionOfWork ? H('Description of work') + para(est.descriptionOfWork) : ''}
${H('Scope of work')}
<table style="width:100%;border-collapse:collapse">
  <tr><th style="${th}">#</th><th style="${th}">Description</th>${open ? `<th style="${th};text-align:right">Cost</th><th style="${th};text-align:right">Markup</th>` : ''}${m.price ? `<th style="${th};text-align:right">Amount</th>` : ''}</tr>
  ${scopeRows}
</table>
${totals ? `<table style="width:60%;margin:14px 0 0 auto;border-collapse:collapse">${totals}</table>` : ''}
${payments}
${est.terms ? H('Terms') + para(est.terms) : ''}
${est.additionalNotes ? H('Notes') + para(est.additionalNotes) : ''}
${para(est.closing)}
<table style="width:100%;border-collapse:collapse;margin-top:48px"><tr>
  <td style="width:48%;vertical-align:bottom;font-size:9.5pt;color:#556">
    ${sig ? `<img src="${sig}" style="max-height:60px;max-width:220px;display:block;margin-bottom:4px">` : ''}
    <div style="border-top:1px solid #0B1A12;padding-top:6px">Accepted by the client, name &amp; date${est.signedName ? `<br><b style="color:#0B1A12">${e(est.signedName)}${est.acceptedAt ? ` · ${e(day(est.acceptedAt))}` : ''}</b>` : ''}</div>
  </td>
  <td style="width:4%"></td>
  <td style="width:48%;vertical-align:bottom;font-size:9.5pt;color:#556"><div style="border-top:1px solid #0B1A12;padding-top:6px">For ${e(d.brand.companyName || 'the contractor')}, name &amp; date</div></td>
</tr></table>
</body></html>`;
}

/** The email that carries it. */
export function estimateEmailBody(d: { number: string; rev: number; title?: string | null; projectName: string; total: number | null; note?: string }) {
  return `
    ${d.note ? `<p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#43514D;">${e(d.note).replace(/\n/g, '<br>')}</p>` : ''}
    <p style="margin:0 0 4px;font-size:12px;color:#7E9B93;">${e(d.projectName)} · ${e(d.number)} Rev ${e(d.rev)}</p>
    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0B1A12;">${e(d.title || 'Estimate')}</p>
    ${d.total != null ? `<p style="margin:0 0 16px;font-size:13.5px;color:#0B1A12;">Total: <b>${usd(d.total)}</b></p>` : ''}
    <p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">The estimate is attached as a PDF. To accept it, open it with the button below and sign — or reply to this email with any questions.</p>`;
}
