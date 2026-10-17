import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AkPage, AkSeg, AkStats, akToday } from '../components/ActionKit';
import { Drawer } from '../components/manpowerUi';
import { groupBy, photoDate, weekOf, type PhotoCategories, type PhotoTrack, type ProgressPhoto, type UnsortedPhoto } from '../data/progressPhotos';
import './ProgressPhotos.css';

const PROJECT_KEY = 'origami.progressPhotos.project';
const TRACKS: [PhotoTrack, string][] = [['construction', 'Construction'], ['design', 'Design']];
type View = 'timeline' | 'category' | 'compare' | 'unsorted';
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const shortDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The details form shared by upload, sorting and the photo viewer. */
interface Meta { track: PhotoTrack; category: string; area: string; caption: string; clientVisible: boolean; takenOn?: string }

function MetaFields({ meta, set, cats, withDate }: { meta: Meta; set: (m: Meta) => void; cats: PhotoCategories | null; withDate?: boolean }) {
  const list = (meta.track === 'design' ? cats?.design : cats?.construction) || [];
  return (
    <>
      <label className="pp-field">Track
        <select value={meta.track} onChange={(e) => { const track = e.target.value as PhotoTrack; const first = (track === 'design' ? cats?.design : cats?.construction)?.[0]?.name || ''; set({ ...meta, track, category: first }); }}>
          {TRACKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="pp-field">Category
        <select value={meta.category} onChange={(e) => set({ ...meta, category: e.target.value })} aria-label="Category">
          {!list.some((c) => c.name === meta.category) && meta.category && <option value={meta.category}>{meta.category}</option>}
          {list.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </label>
      <label className="pp-field">Area / room<input value={meta.area} onChange={(e) => set({ ...meta, area: e.target.value })} placeholder="e.g. Kitchen, North elevation, Level 2" aria-label="Area" /></label>
      {withDate && <label className="pp-field">Date taken<input type="date" value={meta.takenOn || ''} onChange={(e) => set({ ...meta, takenOn: e.target.value })} aria-label="Date taken" /></label>}
      <label className="pp-field">Caption<textarea rows={2} value={meta.caption} onChange={(e) => set({ ...meta, caption: e.target.value })} placeholder="What it shows — e.g. Rough-in before drywall, all stub-outs capped" aria-label="Caption" /></label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--body)' }}>
        <input type="checkbox" checked={meta.clientVisible} onChange={(e) => set({ ...meta, clientVisible: e.target.checked })} /> Client can see {meta.clientVisible ? 'it' : 'it (staff only for now)'}
      </label>
    </>
  );
}

function Tile({ id, title, sub, flag, picked, onPick, onClick }: { id: string; title: string; sub?: string; flag?: string; picked?: boolean; onPick?: (v: boolean) => void; onClick: () => void }) {
  return (
    <button type="button" className={'pp-tile' + (picked ? ' is-picked' : '')} onClick={onClick} title={title}>
      <img src={api.progressPhotos.url(id, { thumb: true })} alt={title} loading="lazy" />
      {flag && <span className="pp-tile-flag">{flag}</span>}
      {onPick && <input type="checkbox" className="pp-tile-check" checked={!!picked} onClick={(e) => e.stopPropagation()} onChange={(e) => onPick(e.target.checked)} aria-label={`Select ${title}`} />}
      <span className="pp-tile-cap"><b>{title}</b>{sub}</span>
    </button>
  );
}

/**
 * Construction -> Progress Photos: every project's photos by track
 * (construction / design) and category, on a timeline, by category, or two
 * dates side by side. The files live in the project's File Room.
 */
export function ProgressPhotos() {
  const { toast, can } = useApp();
  const canManage = can('progress_photos', 'manage') || can('planroom', 'manage');
  const [params] = useSearchParams();
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectId, setProjectId] = useState<number | null>(() => Number(params.get('project')) || (() => { try { return Number(localStorage.getItem(PROJECT_KEY)) || null; } catch { return null; } })());
  const [cats, setCats] = useState<PhotoCategories | null>(null);
  const [data, setData] = useState<{ photos: ProgressPhoto[]; unsorted: UnsortedPhoto[] } | null>(null);
  const [track, setTrack] = useState<'all' | PhotoTrack>('all');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<View>('timeline');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.projects.list().then((r: any) => {
      const list = (Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name }));
      setProjects(list);
      setProjectId((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
    }).catch(() => setProjects([]));
    api.progressPhotos.categories().then(setCats).catch(() => setCats(null));
  }, []);
  const load = () => { if (projectId) api.progressPhotos.list(projectId).then(setData).catch((e: Error) => { setData({ photos: [], unsorted: [] }); toast('⚠ ' + (e.message || 'Could not load photos')); }); };
  useEffect(() => {
    setData(null); setCategory('');
    if (projectId) { try { localStorage.setItem(PROJECT_KEY, String(projectId)); } catch { /* ignore */ } }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const photos = data?.photos || [];
  const inTrack = photos.filter((p) => track === 'all' || p.track === track);
  const needle = q.trim().toLowerCase();
  const shown = inTrack.filter((p) => (!category || p.category === category) && (!needle || [p.category, p.area, p.caption, p.name, p.uploadedBy].join(' ').toLowerCase().includes(needle)));
  const countOf = (c: string) => inTrack.filter((p) => p.category === c).length;
  const catList = useMemo(() => {
    const base = track === 'design' ? cats?.design || [] : track === 'construction' ? cats?.construction || [] : [...(cats?.construction || []), ...(cats?.design || [])];
    const extra = [...new Set(inTrack.map((p) => p.category))].filter((c) => !base.some((b) => b.name === c)).map((name) => ({ name }));
    return [...base, ...extra];
  }, [cats, track, inTrack]);
  const thisWeek = weekOf(akToday());
  const covered = new Set(inTrack.map((p) => p.category)).size;
  const coverCats = (cats?.construction || []).filter((c) => c.cover);
  const index = shown.findIndex((p) => p.id === open);
  const current = index >= 0 ? shown[index] : null;

  const tile = (p: ProgressPhoto) => (
    <Tile key={p.id} id={p.id} title={p.caption || p.category} sub={[shortDay(p.takenOn), p.area].filter(Boolean).join(' · ')} flag={p.clientVisible ? 'Client' : undefined} onClick={() => setOpen(p.id)} />
  );

  return (
    <AkPage lead="Every project’s photos by stage — construction and design — on a timeline, by category, or two dates side by side. They’re kept in the project’s File Room."
      action={canManage && projectId ? <button type="button" className="ak-btn is-dark" onClick={() => setUploading(true)}>+ Add photos</button> : undefined}>
      <div className="ak-tools">
        <select className="ak-select" value={projectId ?? ''} onChange={(e) => setProjectId(Number(e.target.value) || null)} aria-label="Project">
          {!projects.length && <option value="">No projects</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <AkSeg<'all' | PhotoTrack> value={track} onChange={(t) => { setTrack(t); setCategory(''); }} options={[['all', 'All', photos.length], ...TRACKS.map(([k, l]) => [k, l, photos.filter((p) => p.track === k).length] as [PhotoTrack, string, number])]} />
        <AkSeg<View> value={view} onChange={setView} options={[['timeline', 'Timeline'], ['category', 'By category'], ['compare', 'Compare dates'], ...(canManage ? [['unsorted', 'Unsorted', data?.unsorted.length || 0] as [View, string, number]] : [])]} />
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, caption…" aria-label="Search photos" />
      </div>

      <AkStats items={[
        { key: 'all', label: 'Photos', value: data ? inTrack.length : '—', sub: track === 'all' ? 'construction and design' : TRACKS.find(([k]) => k === track)?.[1] },
        { key: 'week', label: 'This week', value: data ? inTrack.filter((p) => p.takenOn >= thisWeek).length : '—', sub: 'taken since Monday' },
        { key: 'cats', label: 'Categories covered', value: data ? `${covered} of ${catList.length}` : '—' },
        { key: 'last', label: 'Latest photo', value: inTrack[0] ? shortDay(inTrack[0].takenOn) : '—', sub: inTrack[0]?.category },
        ...(canManage ? [{ key: 'uns', label: 'Unsorted', value: data ? data.unsorted.length : '—', sub: 'in the File Room, no category yet', tone: data?.unsorted.length ? 'yellow' as const : undefined, onClick: () => setView('unsorted'), on: view === 'unsorted' }] : []),
      ]} />

      {track !== 'design' && view !== 'unsorted' && data && (
        <section className="ak-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Before it’s covered up</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Work that disappears behind walls and floors — photograph it before it’s closed in.</div>
          <div className="pp-cover">
            {coverCats.map((c) => { const n = photos.filter((p) => p.category === c.name).length; return <span key={c.name} className={n ? 'is-ok' : 'is-missing'}>{n ? '✓' : '!'} {c.name}{n ? ` · ${n}` : ' · none yet'}</span>; })}
          </div>
        </section>
      )}

      {view !== 'unsorted' && (
        <div className="pp-cats">
          <button type="button" className={'pp-cat' + (!category ? ' is-on' : '')} onClick={() => setCategory('')}>All categories <b>{inTrack.length}</b></button>
          {catList.map((c) => { const n = countOf(c.name); return <button type="button" key={c.name} className={'pp-cat' + (category === c.name ? ' is-on' : '') + (n ? '' : ' is-empty')} onClick={() => setCategory(category === c.name ? '' : c.name)}>{c.name} <b>{n}</b></button>; })}
        </div>
      )}

      {!projectId ? <section className="ak-card"><div className="ak-empty">Pick a project.</div></section>
        : !data ? <section className="ak-card"><div className="ak-empty">Loading…</div></section>
        : view === 'unsorted' ? <Unsorted rows={data.unsorted} cats={cats} onSorted={load} />
        : view === 'compare' ? <Compare photos={shown} onOpen={setOpen} />
        : !shown.length ? (
          <section className="ak-card"><div className="ak-empty">{photos.length ? 'No photos match.' : canManage ? 'No progress photos yet — “+ Add photos” to start, or sort the File Room’s photos under Unsorted.' : 'No progress photos have been shared yet.'}</div></section>
        ) : view === 'category' ? (
          groupBy([...shown].sort((a, b) => catList.findIndex((c) => c.name === a.category) - catList.findIndex((c) => c.name === b.category) || b.takenOn.localeCompare(a.takenOn)), (p) => p.category).map(([c, rows]) => (
            <div key={c} className="pp-group">
              <div className="pp-group-head"><h3>{c}</h3><span>{rows.length} photo{rows.length === 1 ? '' : 's'} · {shortDay(rows[rows.length - 1].takenOn)} – {shortDay(rows[0].takenOn)}</span></div>
              <div className="pp-grid">{rows.map(tile)}</div>
            </div>
          ))
        ) : (
          groupBy(shown, (p) => weekOf(p.takenOn)).map(([wk, rows]) => (
            <div key={wk} className="pp-group">
              <div className="pp-group-head"><h3>Week of {shortDay(wk)}</h3><span>{rows.length} photo{rows.length === 1 ? '' : 's'} · {[...new Set(rows.map((r) => r.category))].join(', ')}</span></div>
              {groupBy(rows, (p) => p.takenOn).map(([d, dayRows]) => (
                <div key={d} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '6px 0' }}>{day(d)}</div>
                  <div className="pp-grid">{dayRows.map(tile)}</div>
                </div>
              ))}
            </div>
          ))
        )}

      {current && <Viewer photo={current} cats={cats} canManage={canManage}
        onPrev={index > 0 ? () => setOpen(shown[index - 1].id) : undefined}
        onNext={index < shown.length - 1 ? () => setOpen(shown[index + 1].id) : undefined}
        onClose={() => setOpen(null)}
        onChanged={(p) => setData((d) => d && ({ ...d, photos: d.photos.map((x) => (x.id === p.id ? { ...x, ...p } : x)) }))}
        onDeleted={(id) => { setOpen(null); setData((d) => d && ({ ...d, photos: d.photos.filter((x) => x.id !== id) })); }} />}

      {uploading && projectId && <Upload projectId={projectId} cats={cats} defaultTrack={track === 'design' ? 'design' : 'construction'} defaultCategory={category}
        onClose={() => setUploading(false)} onDone={() => { setUploading(false); load(); }} />}
    </AkPage>
  );
}

/** Add photos: pick or take them, each dated from the camera, then one set of details for all. */
function Upload({ projectId, cats, defaultTrack, defaultCategory, onClose, onDone }: { projectId: number; cats: PhotoCategories | null; defaultTrack: PhotoTrack; defaultCategory: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const first = (t: PhotoTrack) => (t === 'design' ? cats?.design : cats?.construction)?.[0]?.name || '';
  const [meta, setMeta] = useState<Meta>({ track: defaultTrack, category: defaultCategory || first(defaultTrack), area: '', caption: '', clientVisible: false });
  const [files, setFiles] = useState<{ file: File; url: string; date: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);
  const add = async (list: FileList | null) => {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const rows = await Promise.all(picked.map(async (file) => ({ file, url: URL.createObjectURL(file), date: await photoDate(file) })));
    setFiles((cur) => [...cur, ...rows].slice(0, 20));
  };
  const save = async () => {
    if (!files.length || !meta.category) return;
    setBusy(true);
    try {
      const r = await api.progressPhotos.upload(projectId, files.map((f) => f.file), { ...meta, takenOn: files[0].date }, files.map((f) => f.date));
      toast(`${r.uploaded} photo${r.uploaded === 1 ? '' : 's'} added to ${meta.category}`);
      onDone();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Upload failed')); }
    finally { setBusy(false); }
  };
  return (
    <Drawer title="Add progress photos" subtitle="Up to 20 at a time. Each photo keeps the date it was taken (from the camera) — change it if needed." width={560} onClose={onClose}
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="ak-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ak-btn is-dark" disabled={busy || !files.length || !meta.category} onClick={save}>{busy ? 'Uploading…' : `Add ${files.length || ''} photo${files.length === 1 ? '' : 's'}`}</button>
      </div>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="ak-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          + Choose or take photos
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} aria-label="Photos" />
        </label>
        {files.length > 0 && (
          <div className="pp-thumbs">
            {files.map((f, i) => (
              <figure key={f.url}>
                <img src={f.url} alt={f.file.name} />
                <input type="date" value={f.date} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label={`Date taken for ${f.file.name}`} />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ border: 0, background: 'none', color: '#8E2E0A', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </figure>
            ))}
          </div>
        )}
        <MetaFields meta={meta} set={setMeta} cats={cats} />
      </div>
    </Drawer>
  );
}

/** One photo full size, its details (editable by staff), previous / next, download, delete. */
function Viewer({ photo, cats, canManage, onPrev, onNext, onClose, onChanged, onDeleted }: {
  photo: ProgressPhoto; cats: PhotoCategories | null; canManage: boolean; onPrev?: () => void; onNext?: () => void; onClose: () => void;
  onChanged: (p: ProgressPhoto) => void; onDeleted: (id: string) => void;
}) {
  const { toast } = useApp();
  const [meta, setMeta] = useState<Meta>({ track: photo.track, category: photo.category, area: photo.area, caption: photo.caption, clientVisible: photo.clientVisible, takenOn: photo.takenOn });
  const [busy, setBusy] = useState(false);
  useEffect(() => setMeta({ track: photo.track, category: photo.category, area: photo.area, caption: photo.caption, clientVisible: photo.clientVisible, takenOn: photo.takenOn }), [photo.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft') onPrev?.(); else if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, onPrev, onNext]);
  const dirty = meta.track !== photo.track || meta.category !== photo.category || meta.area !== photo.area || meta.caption !== photo.caption || meta.clientVisible !== photo.clientVisible || meta.takenOn !== photo.takenOn;
  const save = async () => {
    setBusy(true);
    try { onChanged(await api.progressPhotos.update(photo.id, { ...meta })); toast('Photo saved'); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this photo? It is removed from the File Room too.')) return;
    try { await api.progressPhotos.remove(photo.id); onDeleted(photo.id); toast('Photo deleted'); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not deleted')); }
  };
  return createPortal(
    <div className="pp-light" role="dialog" aria-label="Photo" onClick={onClose}>
      <div className="pp-light-img" onClick={(e) => e.stopPropagation()}>
        <img src={api.progressPhotos.url(photo.id)} alt={photo.caption || photo.category} />
        {onPrev && <button type="button" className="pp-light-nav is-prev" onClick={onPrev} aria-label="Previous photo">‹</button>}
        {onNext && <button type="button" className="pp-light-nav is-next" onClick={onNext} aria-label="Next photo">›</button>}
      </div>
      <div className="pp-light-side" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{photo.category}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{day(photo.takenOn)}{photo.uploadedBy ? ` · added by ${photo.uploadedBy}` : ''}</div>
          </div>
          <button type="button" className="ak-btn" style={{ height: 32 }} onClick={onClose} aria-label="Close">✕</button>
        </div>
        {canManage ? <MetaFields meta={meta} set={setMeta} cats={cats} withDate /> : (
          <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.6 }}>{[photo.area, photo.caption].filter(Boolean).join(' — ') || 'No caption'}</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && <button type="button" className="ak-btn is-dark" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}
          <a className="ak-btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={api.progressPhotos.url(photo.id, { download: true })}>Download</a>
          {canManage && <button type="button" className="ak-btn" style={{ color: '#8E2E0A' }} onClick={remove}>Delete</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Photos in the File Room with no category yet (e.g. from daily reports): pick some, give them details. */
function Unsorted({ rows, cats, onSorted }: { rows: UnsortedPhoto[]; cats: PhotoCategories | null; onSorted: () => void }) {
  const { toast } = useApp();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<Meta>({ track: 'construction', category: cats?.construction?.[0]?.name || '', area: '', caption: '', clientVisible: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!meta.category && cats?.construction?.[0]) setMeta((m) => ({ ...m, category: cats.construction[0].name })); }, [cats]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return <section className="ak-card"><div className="ak-empty">Nothing to sort — every photo in this project’s File Room has a category.</div></section>;
  const sort = async () => {
    setBusy(true);
    try { const r = await api.progressPhotos.classify([...picked], { ...meta }); toast(`${r.sorted} photo${r.sorted === 1 ? '' : 's'} sorted into ${meta.category}`); setPicked(new Set()); onSorted(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not sorted')); }
    finally { setBusy(false); }
  };
  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <section className="ak-card" style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--body)' }}>Photos already in the File Room (from daily reports and uploads) without a category. Tick some, choose where they belong, and they move into that category’s folder.</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}><MetaFields meta={meta} set={setMeta} cats={cats} /></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="ak-btn" onClick={() => setPicked(picked.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}>{picked.size === rows.length ? 'Clear selection' : 'Select all'}</button>
          <button type="button" className="ak-btn is-dark" disabled={!picked.size || busy || !meta.category} onClick={sort}>{busy ? 'Sorting…' : `Sort ${picked.size || ''} into ${meta.category || '…'}`}</button>
        </div>
      </section>
      <div className="pp-grid">
        {rows.map((r) => <Tile key={r.id} id={r.id} title={r.name} sub={[r.updatedAt && shortDay(r.updatedAt.slice(0, 10)), r.folderPath.join(' / ')].filter(Boolean).join(' · ')} picked={picked.has(r.id)} onPick={(v) => toggle(r.id, v)} onClick={() => toggle(r.id, !picked.has(r.id))} />)}
      </div>
    </div>
  );
}

/** Two dates side by side -- the same category (and area, if chosen) then and now. */
function Compare({ photos, onOpen }: { photos: ProgressPhoto[]; onOpen: (id: string) => void }) {
  const areas = [...new Set(photos.map((p) => p.area).filter(Boolean))].sort();
  const [area, setArea] = useState('');
  const pool = photos.filter((p) => !area || p.area === area);
  const dates = [...new Set(pool.map((p) => p.takenOn))].sort();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const from = a && dates.includes(a) ? a : dates[0] || '';
  const to = b && dates.includes(b) ? b : dates[dates.length - 1] || '';
  if (dates.length < 2) return <section className="ak-card"><div className="ak-empty">Comparing needs photos on at least two dates — pick a category with more photos, or add some.</div></section>;
  const side = (d: string, set: (v: string) => void, label: string) => (
    <section className="ak-card" style={{ padding: 14, display: 'grid', gap: 10, alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</b>
        <select className="ak-select" value={d} onChange={(e) => set(e.target.value)} aria-label={`${label} date`}>{dates.map((x) => <option key={x} value={x}>{day(x)}</option>)}</select>
      </div>
      <div className="pp-grid">{pool.filter((p) => p.takenOn === d).map((p) => <Tile key={p.id} id={p.id} title={p.caption || p.category} sub={p.area} onClick={() => onOpen(p.id)} />)}</div>
    </section>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {areas.length > 0 && (
        <div className="ak-tools">
          <select className="ak-select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area"><option value="">Every area</option>{areas.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tip: pick a category above, then an area, to see the same spot then and now.</span>
        </div>
      )}
      <div className="pp-compare">{side(from, setA, 'Before')}{side(to, setB, 'After')}</div>
    </div>
  );
}
