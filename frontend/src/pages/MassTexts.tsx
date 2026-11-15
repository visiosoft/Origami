import { useEffect, useMemo, useState } from 'react';
import { api, type MassRecipient } from '../api';
import { useApp } from '../AppContext';
import { onProject } from '../data/people';

type Person = { id: number; name: string; company?: string; kind?: string; role?: string; phone?: string; projects?: string[]; projectIds?: number[] | null };
type Deal = { id: string; name?: string; leadName?: string; stage?: string; phone?: string };
const field = { padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13, background: 'var(--surface)' } as const;
const pill = (on: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: on ? 'var(--forest)' : 'var(--mist)', color: on ? '#fff' : 'var(--forest)' }) as const;

/**
 * Mass texts (Nov 13 sync): pick people (by project, company, kind) and CRM
 * leads (by stage), write one message with {first name}, see who is skipped,
 * then each person gets their own text -- never a group thread.
 */
export function MassTexts() {
  const { toast, can } = useApp();
  const [people, setPeople] = useState<Person[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<{ key: string; label?: string; name?: string }[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [tab, setTab] = useState<'people' | 'leads'>('people');
  const [f, setF] = useState({ q: '', project: 0, company: '', kind: '', stage: '' });
  const [pickedPeople, setPickedPeople] = useState<Set<number>>(new Set());
  const [pickedLeads, setPickedLeads] = useState<Set<string>>(new Set());
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<MassRecipient[] | null>(null);
  const [batch, setBatch] = useState<Awaited<ReturnType<typeof api.sms.massGet>> | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.sms.massList>>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (api.people.list() as Promise<any>).then((r) => setPeople(Array.isArray(r) ? r : [])).catch(() => undefined);
    (api.projects.list() as Promise<any>).then((r) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: Number(p.id), name: String(p.name) })))).catch(() => undefined);
    (api.pipeline.list() as Promise<any>).then((r) => setDeals(Array.isArray(r) ? r : [])).catch(() => undefined);
    (api.pipeline.stages() as Promise<any>).then((r) => setStages(Array.isArray(r) ? r : [])).catch(() => undefined);
    api.sms.massList().then(setHistory).catch(() => undefined);
  }, []);
  // While sending: follow progress.
  useEffect(() => {
    if (!batch || batch.status !== 'sending') return;
    const t = setTimeout(() => { api.sms.massGet(batch.id).then(setBatch).catch(() => undefined); }, 2000);
    return () => clearTimeout(t);
  }, [batch]);

  const q = f.q.trim().toLowerCase();
  const shownPeople = useMemo(() => people.filter((p) => (!q || `${p.name} ${p.company || ''}`.toLowerCase().includes(q))
    && (!f.company || p.company === f.company) && (!f.kind || p.kind === f.kind)
    && (!f.project || onProject(p as any, { id: f.project, name: projects.find((x) => x.id === f.project)?.name || '' }))), [people, q, f, projects]);
  const shownDeals = useMemo(() => deals.filter((d) => (!q || `${d.name || d.leadName || ''}`.toLowerCase().includes(q)) && (!f.stage || d.stage === f.stage)), [deals, q, f.stage]);
  const companies = [...new Set(people.map((p) => p.company).filter((c): c is string => !!c && c !== '—'))].sort();
  const kinds = [...new Set(people.map((p) => p.kind).filter((k): k is string => !!k))].sort();
  const count = pickedPeople.size + pickedLeads.size;
  const pick = { people: [...pickedPeople], leads: [...pickedLeads] };
  const canLeads = can('pipeline', 'view');

  const toggleAll = () => {
    if (tab === 'people') { const all = shownPeople.every((p) => pickedPeople.has(p.id)); const n = new Set(pickedPeople); shownPeople.forEach((p) => (all ? n.delete(p.id) : n.add(p.id))); setPickedPeople(n); }
    else { const all = shownDeals.every((d) => pickedLeads.has(d.id)); const n = new Set(pickedLeads); shownDeals.forEach((d) => (all ? n.delete(d.id) : n.add(d.id))); setPickedLeads(n); }
    setPreview(null);
  };
  const check = async () => {
    setBusy(true);
    try { setPreview(await api.sms.massPreview(pick)); } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(false); }
  };
  const send = async () => {
    const n = preview?.filter((r) => r.status === 'waiting').length || 0;
    if (!confirm(`Send this to ${n} ${n === 1 ? 'person' : 'people'}, each on their own?`)) return;
    setBusy(true);
    try { const b = await api.sms.massSend(pick, body); setBatch(await api.sms.massGet(b.id)); setPreview(null); toast('Sending…'); api.sms.massList().then(setHistory).catch(() => undefined); }
    catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1100 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        One message to many people — each gets their own text, never a group thread. Use <b>{'{first name}'}</b> to greet each by name. Every text ends with “Reply STOP to opt out” and a link to their text settings; people who opted out are skipped.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }} className="mt-grid">
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={pill(tab === 'people')} onClick={() => setTab('people')}>People</button>
            {canLeads && <button type="button" style={pill(tab === 'leads')} onClick={() => setTab('leads')}>CRM leads</button>}
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)', alignSelf: 'center' }}>{count} picked</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Search" placeholder="Search names" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ ...field, flex: '1 1 160px' }} />
            {tab === 'people' ? (<>
              <select aria-label="Project" value={f.project} onChange={(e) => setF({ ...f, project: Number(e.target.value) })} style={field}><option value={0}>Any project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select aria-label="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} style={field}><option value="">Any company</option>{companies.map((c) => <option key={c}>{c}</option>)}</select>
              <select aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={field}><option value="">Anyone</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
            </>) : (
              <select aria-label="Stage" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} style={field}><option value="">Any stage</option>{stages.map((s) => <option key={s.key} value={s.key}>{s.label || s.name || s.key}</option>)}</select>
            )}
          </div>
          <button type="button" onClick={toggleAll} style={{ justifySelf: 'start', border: 0, background: 'none', color: 'var(--forest)', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Pick / unpick everyone shown</button>
          <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 2 }}>
            {tab === 'people' ? shownPeople.slice(0, 400).map((p) => (
              <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 4px', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={pickedPeople.has(p.id)} onChange={() => { const n = new Set(pickedPeople); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setPickedPeople(n); setPreview(null); }} />
                <span style={{ flex: 1, minWidth: 0 }}>{p.name}<span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.company && p.company !== '—' ? ` · ${p.company}` : ''}</span></span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.kind}</span>
              </label>
            )) : shownDeals.slice(0, 400).map((d) => (
              <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 4px', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={pickedLeads.has(d.id)} onChange={() => { const n = new Set(pickedLeads); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); setPickedLeads(n); setPreview(null); }} />
                <span style={{ flex: 1 }}>{d.name || d.leadName || d.id}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{stages.find((s) => s.key === d.stage)?.label || d.stage}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
          <label htmlFor="mt-body" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Message</label>
          <textarea id="mt-body" rows={6} value={body} onChange={(e) => { setBody(e.target.value); }} placeholder="Hi {first name}, …" style={{ ...field, fontSize: 14, resize: 'vertical' }} />
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{body.length} characters · “Reply STOP to opt out” and a settings link are added at the end.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy || !count} onClick={() => void check()} style={pill(false)}>Check the list</button>
            <button type="button" disabled={busy || !preview || !body.trim() || !preview.some((r) => r.status === 'waiting')} onClick={() => void send()} style={pill(true)}>Send</button>
          </div>
          {preview && (
            <div aria-label="Who gets it" style={{ fontSize: 12.5, display: 'grid', gap: 3 }}>
              <b>{preview.filter((r) => r.status === 'waiting').length} will get it{preview.some((r) => r.status === 'skipped') ? `, ${preview.filter((r) => r.status === 'skipped').length} skipped` : ''}</b>
              {preview.filter((r) => r.status === 'skipped').map((r) => <span key={r.type + r.id} style={{ color: 'var(--muted)' }}>{r.name} — {r.note}</span>)}
            </div>
          )}
          {batch && (
            <div aria-label="Sending" style={{ fontSize: 12.5, display: 'grid', gap: 4, padding: 10, borderRadius: 10, background: 'var(--mist)' }}>
              <b>{batch.status === 'sending' ? 'Sending…' : batch.status === 'stopped' ? 'Stopped' : 'Done'} — {batch.sent} sent{batch.failed ? `, ${batch.failed} failed` : ''}{batch.skipped ? `, ${batch.skipped} skipped` : ''}{batch.waiting ? `, ${batch.waiting} to go` : ''}</b>
              {batch.recipients.filter((r) => r.status === 'failed').map((r) => <span key={r.id} style={{ color: '#8E2E0A' }}>{r.name}: {r.note}</span>)}
              {batch.status === 'sending' && <button type="button" onClick={() => void api.sms.massStop(batch.id).then(() => api.sms.massGet(batch.id)).then(setBatch)} style={{ justifySelf: 'start', ...pill(false) }}>Stop</button>}
            </div>
          )}
          {!!history.length && (
            <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Sent before</div>
              {history.slice(0, 8).map((h) => (
                <button key={h.id} type="button" onClick={() => void api.sms.massGet(h.id).then(setBatch)} style={{ textAlign: 'left', border: 0, background: 'none', font: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '3px 0', color: 'var(--body)' }}>
                  {new Date(h.at).toLocaleDateString()} · {h.sent}/{h.total} · {h.body.slice(0, 60)}{h.body.length > 60 ? '…' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
