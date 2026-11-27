import { useEffect, useState } from 'react';
import { api } from '../api';
import { FILE_ACCESS, fileAccessInfo, fileAudience, type FileAccess } from '../data/fileRoom';

/**
 * Nov 17 sync: every file says who it is for -- Internal (our team), Client,
 * or External (everyone on the project). The server hides a file from anyone
 * its tag doesn't include; this is how it shows and how staff change it.
 */
export function FileAccessChip({ access }: { access?: string | null }) {
  // Nov 27: one small chip per audience ticked (Internal · Client · External).
  const who = fileAudience(access);
  return (
    <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }} title={`Seen by: ${who.map((k) => fileAccessInfo(k).hint).join('; ')}`}>
      {who.map((k) => { const a = fileAccessInfo(k); return (
        <span key={k} className={'file-access is-' + a.key}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: a.bg, color: a.c, whiteSpace: 'nowrap' }}>
          <span aria-hidden>{a.icon}</span>{a.label}
        </span>
      ); })}
    </span>
  );
}

/**
 * Tick who the file(s) are for -- any combination (Nov 27). One file: each
 * tick saves at once. Several files (no value): tick, then Apply.
 */
export function FileAccessPicker({ value, onPick, busy }: { value?: string | null; onPick: (a: FileAccess[]) => void; busy?: boolean }) {
  const single = value !== undefined;
  const [picked, setPicked] = useState<FileAccess[]>(() => (single ? fileAudience(value) : ['internal']));
  useEffect(() => { if (single) setPicked(fileAudience(value)); }, [value, single]);
  const toggle = (k: FileAccess) => {
    const next = picked.includes(k) ? picked.filter((x) => x !== k) : FILE_ACCESS.map((x) => x.key).filter((x) => x === k || picked.includes(x));
    if (!next.length) return; // someone must see it
    setPicked(next);
    if (single) onPick(next);
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <div role="group" aria-label="Who sees it" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILE_ACCESS.map((a) => {
          const on = picked.includes(a.key);
          return (
            <button key={a.key} type="button" role="checkbox" aria-checked={on} disabled={busy} onClick={() => toggle(a.key)} title={a.hint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
                border: '1px solid ' + (on ? a.c : 'rgba(var(--rgb-shade), .14)'), background: on ? a.bg : 'var(--surface)', color: on ? a.c : 'var(--body)' }}>
              <span aria-hidden>{on ? '☑' : '☐'}</span><span aria-hidden>{a.icon}</span>{a.label}
            </button>
          );
        })}
      </div>
      {!single && <button type="button" disabled={busy} onClick={() => onPick(picked)} style={{ padding: '6px 12px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Apply</button>}
    </div>
  );
}

/**
 * Administrators, once: files from before the tags count as Internal, so
 * clients would stop seeing the build-set drawings. Preview which files would
 * be tagged Client, then apply. Nothing changes until Apply is pressed.
 */
export function BuildSetTagBanner({ onApplied }: { onApplied: () => void }) {
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.fileRoom.buildSetPlan>> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  useEffect(() => { api.fileRoom.buildSetPlan().then(setPlan).catch(() => setPlan(null)); }, []);
  if (done) return <div role="status" style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--c-d2ead3)', color: 'var(--success-deep)', fontSize: 12.5, marginBottom: 12 }}>{done}</div>;
  if (!plan || !plan.toClient) return null;
  const apply = async () => {
    setBusy(true);
    try {
      const r = await api.fileRoom.applyBuildSetPlan();
      setDone(`Tagged ${r.toClient} build-set file${r.toClient === 1 ? '' : 's'} Client — clients keep seeing their drawings.`);
      onApplied();
    } catch (e) { window.alert((e as Error).message || 'Could not apply'); }
    finally { setBusy(false); }
  };
  return (
    <div className="build-set-tag-banner" style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--amber-light, #FFF4D6)', border: '1px solid rgba(192,138,0,.3)', fontSize: 12.5, color: 'var(--ink)', marginBottom: 12, display: 'grid', gap: 8 }}>
      <div>
        <b>Files now say who they’re for</b> (🔒 Internal, 👤 Client, 🌐 External). Files from before count as Internal, so clients would stop seeing
        {' '}<b>{plan.toClient}</b> drawing file{plan.toClient === 1 ? '' : 's'} in the build sets. Tag those Client to keep things as they are.
      </div>
      {open && (
        <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
          {plan.projects.map((p) => <li key={p.projectId}>{p.project}: {p.files} file{p.files === 1 ? '' : 's'} → Client</li>)}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .18)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{open ? 'Hide the list' : 'Preview'}</button>
        {open && <button type="button" disabled={busy} onClick={apply} style={{ padding: '6px 14px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Applying…' : `Apply: tag ${plan.toClient} Client`}</button>}
      </div>
    </div>
  );
}
