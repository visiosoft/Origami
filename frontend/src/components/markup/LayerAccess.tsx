import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

export type LayerAudience = 'everyone' | 'internal' | 'people';
export interface LayerPerson { type: 'user' | 'company'; id: string; name: string }
export interface LayerRule { layerKey: string; audience: LayerAudience; people?: LayerPerson[] }

/** The badge next to a restricted layer. */
export function layerBadge(rule?: LayerRule): string {
  if (!rule || rule.audience === 'everyone') return '';
  if (rule.audience === 'internal') return '🔒 Internal';
  const n = rule.people?.length || 0;
  return `👥 ${n === 1 ? rule.people![0].name : `${n} picked`}`;
}

let peopleCache: Promise<LayerPerson[]> | null = null;
/** People with a login, and every company on a People record, to pick from. */
function pickable(): Promise<LayerPerson[]> {
  if (!peopleCache) {
    peopleCache = (api.people.list() as Promise<any>).then((r) => {
      const rows: any[] = Array.isArray(r) ? r : Array.isArray(r?.rows) ? r.rows : [];
      const users = rows.filter((p) => p.userId).map((p) => ({ type: 'user' as const, id: String(p.userId), name: String(p.name || p.email || p.userId) }));
      const companies = [...new Set(rows.map((p) => String(p.company || '').trim()).filter((c) => c && c !== '—'))].map((c) => ({ type: 'company' as const, id: c.toLowerCase(), name: c }));
      return [...companies.sort((a, b) => a.name.localeCompare(b.name)), ...users.sort((a, b) => a.name.localeCompare(b.name))];
    }).catch(() => { peopleCache = null; return []; });
  }
  return peopleCache;
}

/**
 * Who sees one layer (Oct 30 sync): Everyone who can open the drawing, our
 * team only, or our team plus picked people / companies (e.g. one sub).
 */
export function LayerAccessEditor({ name, rule, onSave, onClose }: {
  name: string; rule?: LayerRule; onSave: (r: { audience: LayerAudience; people: LayerPerson[] }) => Promise<void>; onClose: () => void;
}) {
  const [audience, setAudience] = useState<LayerAudience>(rule?.audience || 'everyone');
  const [people, setPeople] = useState<LayerPerson[]>(rule?.people || []);
  const [options, setOptions] = useState<LayerPerson[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pickable().then(setOptions); }, []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return options.filter((o) => !people.some((p) => p.type === o.type && p.id === o.id) && (!s || o.name.toLowerCase().includes(s))).slice(0, 8);
  }, [options, people, q]);
  const save = async () => {
    setBusy(true);
    try { await onSave({ audience, people: audience === 'people' ? people : [] }); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <div className="mk-access" role="group" aria-label={`Who sees ${name}`}>
      {([['everyone', 'Everyone who can open the drawing'], ['internal', 'Our team only'], ['people', 'Our team + picked people or companies']] as const).map(([k, l]) => (
        <label key={k}><input type="radio" name={`aud-${name}`} checked={audience === k} onChange={() => setAudience(k)} /> {l}</label>
      ))}
      {audience === 'people' && (
        <div className="mk-access-pick">
          <div className="mk-access-chips">
            {people.map((p) => (
              <span key={p.type + p.id}>{p.type === 'company' ? '🏢 ' : ''}{p.name}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPeople(people.filter((x) => !(x.type === p.type && x.id === p.id)))}>×</button>
              </span>
            ))}
          </div>
          <input aria-label="Find a person or company" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person or company" />
          {hits.length > 0 && (
            <div className="mk-access-hits">
              {hits.map((h) => <button key={h.type + h.id} type="button" onClick={() => { setPeople([...people, h]); setQ(''); }}>{h.type === 'company' ? '🏢 ' : '👤 '}{h.name}</button>)}
            </div>
          )}
        </div>
      )}
      <div className="mk-access-actions">
        <button type="button" className="mk-btn" disabled={busy || (audience === 'people' && !people.length)} onClick={() => void save()}>Save</button>
        <button type="button" className="mk-btn is-text" onClick={onClose}>Cancel</button>
      </div>
      <p className="mk-muted">Admins and principals always see every layer.</p>
    </div>
  );
}
