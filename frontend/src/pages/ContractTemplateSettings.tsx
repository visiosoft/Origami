import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { RichTextEditor } from '../components/RichTextEditor';
import { CONTRACT_TYPES, typeLabel, type ContractTemplate, type ContractType } from '../data/contracts';

const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none' };
const btn = (primary = false): React.CSSProperties => ({ padding: '8px 15px', borderRadius: 999, border: primary ? 0 : '1px solid rgba(var(--rgb-shade), 0.14)', background: primary ? 'var(--ink)' : 'var(--surface)', color: primary ? 'var(--surface)' : 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });

/**
 * Settings -> Contract templates (admins): the starting wording for each
 * contract type. {{fields}} fill in from the project, the people and the
 * change order; {{initials}} marks where each signer must initial.
 */
export function ContractTemplateSettings() {
  const { toast } = useApp();
  const [list, setList] = useState<ContractTemplate[]>([]);
  const [fields, setFields] = useState<[string, string][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContractTemplate | null>(null);
  const load = () => api.contracts.templates().then((l) => { setList(l); if (!sel && l[0]) { setSel(l[0].id); setDraft(l[0]); } }).catch((e: Error) => toast('⚠ ' + e.message));
  useEffect(() => { void load(); api.contracts.types().then((t) => setFields(t?.mergeFields || [])).catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: ContractTemplate) => { setSel(t.id); setDraft(t); };
  const saved = list.find((t) => t.id === sel);
  const dirty = !!draft && (!saved || draft.name !== saved.name || draft.html !== saved.html || !!draft.isDefault !== !!saved.isDefault || draft.type !== saved.type);
  const save = async () => {
    if (!draft) return;
    try {
      const r = saved ? await api.contracts.saveTemplate(draft.id, draft) : await api.contracts.createTemplate(draft);
      toast('Template saved'); setSel(r.id); setDraft(r);
      setList(await api.contracts.templates());
    } catch (e) { toast('⚠ ' + (e as Error).message); }
  };
  const remove = async () => {
    if (!saved || !confirm(`Delete “${saved.name}”?`)) return;
    try { await api.contracts.removeTemplate(saved.id); const l = await api.contracts.templates(); setList(l); setSel(l[0]?.id || null); setDraft(l[0] || null); toast('Deleted'); }
    catch (e) { toast('⚠ ' + (e as Error).message); }
  };
  const [previewing, setPreviewing] = useState(false);
  /** Email yourself the template filled with sample details, with its PDF (Oct 30 sync: never send one out unseen). */
  const preview = async () => {
    if (!draft) return;
    setPreviewing(true);
    try { const r = await api.contracts.previewTemplate({ name: draft.name, type: draft.type, html: draft.html }); toast(`Preview sent to ${r.to} — open it to see what a client gets`); }
    catch (e) { toast('⚠ ' + (e as Error).message); }
    finally { setPreviewing(false); }
  };
  /** The contract's merge fields for the editor's "+ Insert field" list, with {{initials}} first. */
  const fieldGroups = [{ label: 'Signing', tokens: [{ key: 'initials', label: 'Initials box (every signer)' }] }, ...['contract', 'project', 'owner', 'party', 'company', 'changeOrder', 'subcontract'].map((g) => ({
    label: ({ contract: 'Contract', project: 'Project', owner: 'Owner', party: 'Other party', company: 'Our company', changeOrder: 'Change order', subcontract: 'Subcontract' } as Record<string, string>)[g],
    tokens: fields.filter(([k]) => k.startsWith(g + '.')).map(([k, l]) => ({ key: k, label: l })),
  })).filter((g) => g.tokens.length)];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.55 }}>
        The starting wording for each kind of contract. <b>{'{{fields}}'}</b> fill in from the project, the people and the change order; <b>{'{{initials}}'}</b> marks where every signer must initial. Have counsel review the wording before use.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select aria-label="Template" value={sel || ''} onChange={(e) => { const t = list.find((x) => x.id === e.target.value); if (t) pick(t); }} style={{ ...input, minWidth: 280 }}>
          {CONTRACT_TYPES.map((ty) => (
            <optgroup key={ty.key} label={ty.label}>
              {list.filter((t) => t.type === ty.key).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" style={btn()} onClick={() => { setSel(null); setDraft({ id: '', type: (draft?.type || 'owner') as ContractType, name: `New ${typeLabel(draft?.type || 'owner').toLowerCase()} template`, html: draft?.html || '', isDefault: false }); }}>+ New template</button>
      </div>
      {draft && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input aria-label="Template name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...input, flex: '1 1 240px' }} />
            <select aria-label="Contract type" value={draft.type} disabled={!!saved} onChange={(e) => setDraft({ ...draft, type: e.target.value as ContractType })} style={{ ...input, width: 230 }}>{CONTRACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />Default for this type</label>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Bring a contract in with <b>⤓ Word</b> (a .docx keeps its headings, numbered lists and tables) or paste it from Word or Google Docs. Then put the fields in with <b>+ Insert field</b> — owner name, project address, amounts — and they fill in when a contract is made.
          </div>
          <RichTextEditor value={draft.html} onChange={(html) => setDraft((d) => (d ? { ...d, html } : d))} minHeight={420} fields={fieldGroups} wordImport />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn(true)} disabled={!dirty} onClick={() => void save()}>Save</button>
            <button type="button" style={btn()} disabled={previewing || !draft.html.replace(/<[^>]+>/g, '').trim()} onClick={() => void preview()} title="Emails you the template filled with sample details, as a client gets it, with the PDF attached">{previewing ? 'Sending…' : 'Email me a preview'}</button>
            {saved && <button type="button" style={{ ...btn(), color: '#8E2E0A' }} onClick={() => void remove()}>Delete</button>}
            {saved?.updatedAt && <span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>Last saved {new Date(saved.updatedAt).toLocaleDateString()}{saved.updatedBy ? ` by ${saved.updatedBy}` : ''}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
