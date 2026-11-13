import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useApp } from '../AppContext';

type Who = { type: 'user' | 'role' | 'company'; id: string; name: string };
export interface FolderRule { path: string[]; pathKey: string; audience: string; people?: Who[] | null }

/**
 * Who may open a File Room folder (Nov 13): everyone on the project, staff
 * only, or chosen people, roles and companies. Covers the folders inside it.
 * Administrators and File Room managers always see everything.
 */
export function FolderAccessDialog({ projectId, path, current, onClose, onSaved }: { projectId: number; path: string[]; current?: FolderRule | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [audience, setAudience] = useState(current?.audience || 'everyone');
  const [picked, setPicked] = useState<Who[]>(current?.people || []);
  const [options, setOptions] = useState<Who[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // People who can sign in, their companies, and the roles (roles only for administrators).
    Promise.all([
      (api.people.list() as Promise<any>).catch(() => []),
      (api.roles.list() as Promise<any>).catch(() => []),
    ]).then(([people, roles]) => {
      const ppl: Who[] = (Array.isArray(people) ? people : []).filter((p: any) => p.userId).map((p: any) => ({ type: 'user' as const, id: String(p.userId), name: `${p.name}${p.company ? ` · ${p.company}` : ''}` }));
      const cos = [...new Set((Array.isArray(people) ? people : []).map((p: any) => String(p.company || '').trim()).filter(Boolean))].sort().map((c) => ({ type: 'company' as const, id: c, name: c }));
      const rls: Who[] = (Array.isArray(roles) ? roles : []).filter((r: any) => r.key !== 'admin').map((r: any) => ({ type: 'role' as const, id: String(r.key), name: String(r.name) }));
      setOptions([...rls, ...cos, ...ppl]);
    });
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const has = (w: Who) => picked.some((p) => p.type === w.type && p.id === w.id);
  const toggle = (w: Who) => setPicked((x) => (has(w) ? x.filter((p) => !(p.type === w.type && p.id === w.id)) : [...x, w]));
  const qn = q.trim().toLowerCase();
  const LABEL = { role: 'Role', company: 'Company', user: 'Person' } as const;
  const save = async () => {
    setBusy(true);
    try { await api.fileRoom.setFolderAccess({ projectId, path, audience, people: audience === 'picked' ? picked : [] }); toast(audience === 'everyone' ? 'Open to everyone on the project' : 'Folder access saved'); onSaved(); onClose(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };
  const radio = (v: string, label: string, hint: string) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, border: `1px solid ${audience === v ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)'}`, cursor: 'pointer' }}>
      <input type="radio" name="fa" checked={audience === v} onChange={() => setAudience(v)} style={{ marginTop: 3 }} />
      <span><b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</b><span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{hint}</span></span>
    </label>
  );
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Who can open this folder" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(var(--rgb-shade), 0.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto', display: 'grid', gap: 10, padding: 20, borderRadius: 16, background: 'var(--surface)', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Who can open “{path.join(' › ')}”</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Covers the folders inside it too. Administrators and people who manage the File Room always see everything.</div>
        {radio('everyone', 'Everyone on the project', 'As before: anyone who can see this project’s files')}
        {radio('internal', 'Staff only', 'Clients, subs and consultants don’t see it')}
        {radio('picked', 'Chosen people', 'Only the roles, companies and people you pick')}
        {audience === 'picked' && (
          <div style={{ display: 'grid', gap: 6 }}>
            {picked.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{picked.map((w) => <button key={`${w.type}:${w.id}`} type="button" onClick={() => toggle(w)} style={{ padding: '4px 10px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>{w.name} ✕</button>)}</div>}
            <input placeholder="Find a role, company or person…" aria-label="Find a role, company or person" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16 }} />
            <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 2 }}>
              {options.filter((w) => !qn || w.name.toLowerCase().includes(qn)).slice(0, 80).map((w) => (
                <label key={`${w.type}:${w.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 6px', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={has(w)} onChange={() => toggle(w)} />{w.name}<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{LABEL[w.type]}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.15)', background: 'var(--surface)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={busy || (audience === 'picked' && !picked.length)} onClick={() => void save()} style={{ padding: '9px 18px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
