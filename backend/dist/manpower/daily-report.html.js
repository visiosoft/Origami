"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportSectionsHtml = reportSectionsHtml;
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yn = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—');
const OPS = {
    procurement: 'Procurement / Delivery delay', changeOrder: 'Change order delay', rfi: 'RFI delay',
    scheduling: 'Scheduling / Sequencing delay', safety: 'Safety incident delay', siteCondition: 'Unknown site condition',
};
const OUTCOME = { passed: 'Passed', partial: 'Partial passed', conditional: 'Conditional passed with comments', failed: 'Failed' };
const REASON = { stop: 'Stop order', holiday: 'Holiday', ops: 'Operations delay', force: 'Force majeure delay' };
function delayLine(label, d) {
    if (!d?.on && !d?.details && !d?.getWell)
        return '';
    const when = d.getWell === 'known' && d.date ? `get well ${esc(d.date)}` : d.getWell === 'unknown' ? 'get well date unknown' : '';
    return `<li><b>${esc(label)}</b>${when ? ` — ${when}` : ''}${d.details ? `<br>${esc(d.details)}` : ''}${d.taskId ? ' <i>(task created)</i>' : ''}</li>`;
}
function delays(ops, force) {
    const lines = Object.entries(OPS).map(([k, l]) => (ops?.[k]?.on ? delayLine(l, ops[k]) : '')).join('') + (force?.on ? delayLine('Force majeure delay', force) : '');
    return lines ? `<ul style="margin:4px 0 0 18px;padding:0;">${lines}</ul>` : '';
}
function reportSectionsHtml(s, meta) {
    if (!s || typeof s !== 'object')
        return '';
    const h2 = (t) => `<h2 style="font-size:12pt;margin:16px 0 4px;border-bottom:1px solid #E6E9E4;padding-bottom:3px;">${esc(t)}</h2>`;
    const p = (t) => `<div style="font-size:10.5pt;margin:3px 0;">${t}</div>`;
    const a = s.activity || {};
    const noWork = a.worked === 'no';
    const out = [];
    out.push(h2('II. Activity'), p(`Did work occur today? <b>${yn(a.worked)}</b>`));
    if (noWork) {
        out.push(p(`Reason: <b>${esc(REASON[a.reason] || '—')}</b>`));
        if (a.reason === 'stop')
            out.push(p(`Ordered to stop by ${esc(a.stop?.by || '—')} as of ${esc(a.stop?.asOf || '—')}, projected to end ${a.stop?.endUnknown ? 'unknown' : esc(a.stop?.end || '—')}${a.stop?.details ? `<br>${esc(a.stop.details)}` : ''}`));
        if (a.reason === 'holiday')
            out.push(p(`Holiday ${esc(a.holiday?.start || '—')} to ${esc(a.holiday?.end || '—')}`));
        if (a.reason === 'ops' || a.reason === 'force')
            out.push(delays(a.reason === 'ops' ? a.ops : {}, a.reason === 'force' ? { ...a.force, on: true } : {}));
        out.push(p('<i>Sections III–IX: N/A — no work today.</i>'));
    }
    else {
        out.push(p(`Were there delays today? <b>${yn(a.delays)}</b>`));
        if (a.delays === 'yes')
            out.push(delays(a.dOps, a.dForce));
        out.push(p(`Site photos and videos uploaded today? <b>${yn(a.photos)}</b>`));
        const subs = s.subs || {};
        out.push(h2('IV. Subcontractors'), p(`Present today? <b>${yn(subs.present)}</b>`));
        if (subs.present === 'yes')
            for (const r of subs.rows || [])
                out.push(p(`<b>${esc(r.name || '—')}</b> · ${esc(r.headcount ?? '—')} people${r.from || r.to ? ` · ${esc(r.from || '?')}–${esc(r.to || '?')}` : ''}${r.work ? `<br>${esc(r.work)}` : ''}`));
        const ins = s.inspectors || {};
        out.push(h2('V. Inspectors'), p(`Present today? <b>${yn(ins.present)}</b>`));
        if (ins.present === 'yes')
            for (const r of ins.rows || [])
                out.push(p(`<b>${esc(r.authority || 'Inspector')}</b> — ${esc(OUTCOME[r.outcome] || 'no outcome')}${r.what ? `<br>${esc(r.what)}` : ''}`) + (r.outcome && r.outcome !== 'passed' ? `<ul style="margin:2px 0 0 18px;padding:0;">${delayLine('Follow-up', { ...r.delay, on: true })}</ul>` : '') + (r.card ? p(`Inspection card: ${esc(r.card.name)}`) : ''));
        const v = s.visitors || {};
        out.push(h2('VI. Site meeting & site visitors'), p(`Visitors today? <b>${yn(v.present)}</b>`));
        if (v.present === 'yes')
            for (const r of v.rows || [])
                out.push(p(`<b>${esc(r.type || 'Visitor')}</b>${r.name ? ` — ${esc(r.name)}` : ''}${r.details ? `<br>${esc(r.details)}` : ''}`));
        const d = s.deliveries || {};
        out.push(h2('VII. Deliveries'), p(`Delivery today? <b>${yn(d.present)}</b>${d.present === 'yes' ? ` · Transmittal completed? <b>${yn(d.transmittal)}</b>` : ''}`));
        if ((d.files || []).length)
            out.push(p(`Attached: ${d.files.map((f) => esc(f.name)).join(', ')}`));
        const e = s.equipment || {};
        out.push(h2('VIII. Equipment used'), p(`Equipment used today? <b>${yn(e.used)}</b>${e.used === 'yes' ? ` · Utilization form completed? <b>${yn(e.form)}</b>` : ''}`));
        if ((e.files || []).length)
            out.push(p(`Attached: ${e.files.map((f) => esc(f.name)).join(', ')}`));
        const notes = (s.notes || []).filter((n) => String(n?.text || '').trim());
        if (notes.length)
            out.push(h2('IX. Notes'), `<ul style="margin:4px 0 0 18px;padding:0;font-size:10.5pt;">${notes.map((n) => `<li>${esc(n.text)}${n.taskId ? ' <i>(task created)</i>' : ''}</li>`).join('')}</ul>`);
    }
    out.push(h2('X. Certification'));
    out.push(p(meta.onBehalfOf
        ? `I ${esc(meta.certifiedName || meta.onBehalfOf)} am completing this form on behalf of ${esc(meta.filer || '—')}. And I am certifying that the information contained in this report is true and correct to the best of my recollection. A copy of this report will be sent to ${esc(meta.filer || '—')} for record.`
        : 'I am certifying that the information contained in this report is true and correct to the best of my recollection.'));
    if (meta.signatureDataUrl && /^data:image\/png;base64,/.test(meta.signatureDataUrl))
        out.push(`<img src="${meta.signatureDataUrl}" alt="Signature" style="height:60px;margin-top:6px;">`);
    out.push(p(`${esc(meta.certifiedName || '—')} · signed ${esc(meta.signedAt ? new Date(meta.signedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : '—')}`));
    return out.join('\n');
}
//# sourceMappingURL=daily-report.html.js.map