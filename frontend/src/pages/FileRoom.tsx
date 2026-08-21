import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  extStyle, filesIn, filesUnder, isImage, pathKey, prettySize, shortDate, subfoldersOf,
  type FileRoomData, type FileRoomFile,
} from '../data/fileRoom';

const BG = "'Bricolage Grotesque', serif";
const EMPTY: FileRoomData = { projects: [], categories: [], files: [], folders: [] };

const card: React.CSSProperties = {
  background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)',
};

const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontFamily: 'inherit',
  fontSize: 12.5, color: '#0B1A12', outline: 'none',
};

const FolderIcon = ({ size = 15, c = '#7E9B93' }: { size?: number; c?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

/**
 * File Room — browse a project's documents by folder, upload, and manage
 * revisions. Files live in the connected Google Drive; the folder tree and
 * version grouping are held here.
 */
export function FileRoom() {
  const { can, toast } = useApp();
  const canManage = can('planroom', 'manage');
  const isNarrow = useWindowWidth() < 900;

  const [data, setData] = useState<FileRoomData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  // ['all'] or [projectId, ...folderNames]
  const [path, setPath] = useState<string[]>(['all']);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [latestOnly, setLatestOnly] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderTreeFor, setNewFolderTreeFor] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = () => {
    api.fileRoom.list()
      .then((d) => setData({ ...EMPTY, ...(d as FileRoomData) }))
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.google.status().then((s) => setStorageReady(!!s?.connected)).catch(() => setStorageReady(false));
  }, []);

  const atRoot = path[0] === 'all';
  const projectId = atRoot ? null : Number(path[0]);
  const folder = atRoot ? [] : path.slice(1);
  const project = data.projects.find((p) => p.id === projectId);

  // ---- what the current folder holds -------------------------------------

  const visibleFiles = useMemo(() => {
    const base = atRoot
      ? data.files
      : filesIn(data.files, projectId as number, folder);
    const q = search.trim().toLowerCase();
    return base
      .filter((f) => (latestOnly ? f.isLatest !== false : true))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [data, atRoot, projectId, folder, search, latestOnly, sortDir]);

  const visibleFolders = useMemo(() => {
    if (atRoot) {
      return data.projects
        .map((p) => ({ key: String(p.id), name: p.name, count: filesUnder(data.files, p.id, []).length }))
        .sort((a, b) => (sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
    }
    return subfoldersOf(data, projectId as number, folder)
      .map((name) => ({
        key: name,
        name,
        count: filesUnder(data.files, projectId as number, [...folder, name]).length,
      }))
      .sort((a, b) => (sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [data, atRoot, projectId, folder, sortDir]);

  const selected = data.files.find((f) => f.id === selectedFileId) || null;
  const versions = useMemo(
    () => (selected?.groupId ? data.files.filter((f) => f.groupId === selected.groupId) : selected ? [selected] : [])
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    [data.files, selected],
  );

  const stats = useMemo(() => {
    const week = Date.now() - 7 * 864e5;
    const recent = data.files.filter((f) => Date.parse(f.updatedAt || '') > week).length;
    const bytes = data.files.reduce((n, f) => n + (Number(f.size) || 0), 0);
    return { total: data.files.length, recent, storage: prettySize(bytes) };
  }, [data.files]);

  // ---- actions ------------------------------------------------------------

  /** Pull in whatever is sitting in the project's Drive folder. */
  const sync = async (id: number, quiet = false) => {
    setSyncing(true);
    try {
      const r = await api.fileRoom.sync(id);
      if (!quiet || r.added || r.removed || r.updated) {
        toast(r.added || r.removed || r.updated
          ? `Drive synced — ${r.added} added, ${r.updated} updated, ${r.removed} removed`
          : 'Already up to date with Drive');
      }
      load();
    } catch (e) {
      if (!quiet) toast('⚠ ' + ((e as Error).message || 'Sync failed'));
    } finally { setSyncing(false); }
  };

  // Opening a project reconciles it with Drive, so files added there show up.
  const syncedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!projectId || !storageReady || syncedFor.current === projectId) return;
    syncedFor.current = projectId;
    sync(projectId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, storageReady]);

  const openFolder = (segment: string) => setPath((p) => [...p, segment]);
  const jumpTo = (depth: number) => setPath((p) => p.slice(0, depth + 1));

  const sendFiles = async (files: File[]) => {
    if (!files.length) return;
    if (atRoot || !projectId) { toast('⚠ Open a project first — files belong to one'); return; }
    if (!storageReady) { toast('⚠ Connect a Google account under Settings → Integrations to store files'); return; }
    setUploading(files.map((f) => f.name));
    try {
      await api.fileRoom.upload(projectId, folder, files);
      toast(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
      load();
      setUploadOpen(false);
    } catch (e) {
      toast('⚠ ' + ((e as Error).message || 'Upload failed'));
    } finally {
      setUploading([]);
    }
  };

  const createFolder = async (forProject: number, parent: string[], name: string) => {
    if (!name.trim()) return;
    try {
      await api.fileRoom.createFolder(forProject, parent, name.trim());
      toast('Folder created');
      load();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not create folder')); }
    setNewFolderName(''); setNewFolderOpen(false); setNewFolderTreeFor(null);
  };

  const act = (p: Promise<unknown>, ok: string) =>
    p.then(() => { toast(ok); load(); }).catch((e: Error) => toast('⚠ ' + (e.message || 'Failed')));

  if (loading) return <div style={{ padding: 24, fontSize: 13, color: '#7E9B93' }}>Loading File Room…</div>;

  // ---- tree ---------------------------------------------------------------

  const treeRow = (
    label: string, count: number | null, active: boolean, onClick: () => void,
    opts: { indent?: number; chevron?: 'open' | 'closed' | null; onChevron?: () => void } = {},
  ) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
        marginLeft: opts.indent ?? 0, background: active ? '#DCE7DE' : 'transparent',
        color: active ? '#173326' : '#43514D', fontWeight: active ? 700 : 500, fontSize: 12,
      }}
    >
      {opts.chevron !== undefined && opts.chevron !== null && (
        <span
          onClick={(e) => { e.stopPropagation(); opts.onChevron?.(); }}
          style={{ fontSize: 8, color: '#9AA39D', transition: 'transform 0.15s', transform: opts.chevron === 'open' ? 'rotate(180deg)' : 'none' }}
        >▼</span>
      )}
      <FolderIcon c={active ? '#173326' : '#7E9B93'} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== null && <span style={{ fontSize: 10.5, color: '#7E9B93', fontWeight: 600 }}>{count}</span>}
    </div>
  );

  const tree = (
    <div style={{ ...card, width: isNarrow ? '100%' : 250, flexShrink: 0, padding: 10, maxHeight: isNarrow ? 260 : 'calc(100vh - 210px)', overflowY: 'auto' }}>
      {treeRow('All Files', data.files.length, atRoot, () => setPath(['all']))}
      <div style={{ height: 1, background: 'rgba(20,8,31,0.06)', margin: '8px 2px' }} />
      {data.projects.map((p) => {
        const open = !!openProjects[p.id];
        const isActive = projectId === p.id && folder.length === 0;
        return (
          <div key={p.id}>
            {treeRow(p.name, filesUnder(data.files, p.id, []).length, isActive, () => setPath([String(p.id)]), {
              chevron: open ? 'open' : 'closed',
              onChevron: () => setOpenProjects((s) => ({ ...s, [p.id]: !s[p.id] })),
            })}
            {open && (
              <>
                {subfoldersOf(data, p.id, []).map((name) =>
                  <div key={name}>
                    {treeRow(name, filesUnder(data.files, p.id, [name]).length,
                      projectId === p.id && pathKey(folder) === name,
                      () => setPath([String(p.id), name]), { indent: 26 })}
                  </div>)}
                {canManage && (newFolderTreeFor === p.id ? (
                  <div style={{ display: 'flex', gap: 5, marginLeft: 26, marginTop: 4 }}>
                    <input
                      autoFocus value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createFolder(p.id, [], newFolderName);
                        if (e.key === 'Escape') { setNewFolderTreeFor(null); setNewFolderName(''); }
                      }}
                      placeholder="Folder name" style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 11.5 }}
                    />
                    <div onClick={() => createFolder(p.id, [], newFolderName)}
                         style={{ padding: '5px 10px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Add</div>
                  </div>
                ) : (
                  <div onClick={() => { setNewFolderTreeFor(p.id); setNewFolderName(''); }}
                       style={{ marginLeft: 26, padding: '5px 9px', fontSize: 11, fontWeight: 600, color: '#7E9B93', cursor: 'pointer' }}>+ New folder</div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---- breadcrumb ---------------------------------------------------------

  const segments = atRoot
    ? [{ label: 'All Files', depth: 0 }]
    : [{ label: 'All Files', depth: -1 }, { label: project?.name ?? `Project ${projectId}`, depth: 0 },
       ...folder.map((f, i) => ({ label: f, depth: i + 1 }))];
  const shown = segments.length > 3 ? [{ label: '···', depth: -2 }, ...segments.slice(-2)] : segments;

  const breadcrumb = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
      {shown.map((s, i) => {
        const last = i === shown.length - 1;
        return (
          <span key={`${s.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: '#C9D4CC', fontSize: 12 }}>›</span>}
            <span
              onClick={() => { if (last || s.depth === -2) return; s.depth === -1 ? setPath(['all']) : jumpTo(s.depth); }}
              style={last
                ? { fontFamily: BG, fontSize: 14, fontWeight: 700, color: '#0B1A12' }
                : { fontSize: 12.5, fontWeight: 600, color: '#7E9B93', cursor: s.depth === -2 ? 'default' : 'pointer' }}
            >{s.label}</span>
          </span>
        );
      })}
    </div>
  );

  // ---- cards / rows -------------------------------------------------------

  const badge = (f: FileRoomFile) => {
    if (!f.groupId) return null;
    const latest = f.isLatest !== false;
    return (
      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: latest ? '#D2EAD3' : '#EFEDE8', color: latest ? '#1C5230' : '#7E9B93' }}>
        {latest ? 'Latest' : 'Older version'}
      </span>
    );
  };

  const gridView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
      {visibleFolders.map((f) => (
        <div key={f.key} onClick={() => (atRoot ? setPath([f.key]) : openFolder(f.name))}
             style={{ ...card, borderRadius: 13, padding: 14, cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#EFEDE8', display: 'grid', placeItems: 'center', marginBottom: 10 }}>
            <FolderIcon size={19} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
          <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 3 }}>{f.count} {f.count === 1 ? 'file' : 'files'}</div>
        </div>
      ))}
      {visibleFiles.map((f) => {
        const st = extStyle(f.ext);
        return (
          <div key={f.id} onClick={() => { setSelectedFileId(f.id); setRenaming(f.name); setNotes(f.notes ?? ''); setShareUrl(''); setEmailOpen(false); }}
               style={{ ...card, borderRadius: 13, padding: 14, cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: st.bg, color: st.c, display: 'grid', placeItems: 'center', marginBottom: 10, fontSize: 9, fontWeight: 800 }}>
              {(f.ext || '?').slice(0, 4)}
            </div>
            <div title={f.name} style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
            <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 3 }}>{prettySize(f.size)} · {shortDate(f.updatedAt)}</div>
            {atRoot && <div style={{ fontSize: 10, color: '#2F6F68', marginTop: 3 }}>{data.projects.find((p) => p.id === Number(f.projectId))?.name}</div>}
            <div style={{ marginTop: 7 }}>{badge(f)}</div>
          </div>
        );
      })}
      {!visibleFolders.length && !visibleFiles.length && (
        <div style={{ gridColumn: '1 / -1', padding: '28px 0', textAlign: 'center', fontSize: 12.5, color: '#9AA39D' }}>
          {search ? 'Nothing matches that search.' : 'This folder is empty.'}
        </div>
      )}
    </div>
  );

  const listView = (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
           style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(20,8,31,0.06)', cursor: 'pointer' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93' }}>Name</span>
        <span style={{ fontSize: 9, color: '#9AA39D' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
      </div>
      {visibleFolders.map((f, i) => (
        <div key={f.key} onClick={() => (atRoot ? setPath([f.key]) : openFolder(f.name))}
             style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid rgba(20,8,31,0.04)' : 'none', cursor: 'pointer' }}>
          <FolderIcon />
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#0B1A12' }}>{f.name}</span>
          <span style={{ fontSize: 11, color: '#7E9B93' }}>{f.count}</span>
        </div>
      ))}
      {visibleFiles.map((f) => {
        const st = extStyle(f.ext);
        return (
          <div key={f.id} onClick={() => { setSelectedFileId(f.id); setRenaming(f.name); setNotes(f.notes ?? ''); setShareUrl(''); setEmailOpen(false); }}
               style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,0.04)', cursor: 'pointer' }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: st.bg, color: st.c, display: 'grid', placeItems: 'center', fontSize: 7.5, fontWeight: 800, flexShrink: 0 }}>{(f.ext || '?').slice(0, 4)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#0B1A12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            {badge(f)}
            {atRoot && <span style={{ fontSize: 10.5, color: '#2F6F68' }}>{data.projects.find((p) => p.id === Number(f.projectId))?.name}</span>}
            <span style={{ width: 64, textAlign: 'right', fontSize: 10.5, color: '#7E9B93' }}>{prettySize(f.size)}</span>
            <span style={{ width: 56, textAlign: 'right', fontSize: 10.5, color: '#7E9B93' }}>{shortDate(f.updatedAt)}</span>
          </div>
        );
      })}
      {!visibleFolders.length && !visibleFiles.length && (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: '#9AA39D' }}>
          {search ? 'Nothing matches that search.' : 'This folder is empty.'}
        </div>
      )}
    </div>
  );

  const pill = (label: string, on: boolean, onClick: () => void) => (
    <div onClick={onClick} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: on ? '#173326' : 'white', color: on ? 'white' : '#43514D', border: '1px solid ' + (on ? '#173326' : 'rgba(20,8,31,0.12)') }}>{label}</div>
  );

  return (
    <div style={{ padding: '4px 4px 40px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0F2417', color: '#D2822E', display: 'grid', placeItems: 'center', fontSize: 14 }}>◈</div>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: '#0B1A12' }}>File Room</div>
          <div style={{ fontSize: 12, color: '#7E9B93' }}>Origami Design + Build</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[['Total Files', String(stats.total), 'across all projects'],
          ['Added This Week', String(stats.recent), 'last 7 days'],
          ['Storage Used', stats.storage, 'in Google Drive']].map(([label, value, sub]) => (
          <div key={label} style={{ ...card, padding: '15px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93' }}>{label}</div>
            <div style={{ fontFamily: BG, fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 7, color: '#0B1A12' }}>{value}</div>
            <div style={{ fontSize: 10.5, color: '#7E9B93', fontWeight: 600, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 12, alignItems: 'flex-start' }}>
        {tree}

        <div style={{ flex: 1, minWidth: 0, width: isNarrow ? '100%' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {breadcrumb}
            <div style={{ flex: 1 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…"
                   style={{ ...inputStyle, background: '#FBF8F2', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, minWidth: 200 }} />
            <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
              {(['grid', 'list'] as const).map((v) => (
                <div key={v} onClick={() => setView(v)}
                     style={{ padding: '5px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', background: view === v ? 'white' : 'transparent', color: view === v ? '#0B1A12' : '#7E9B93', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{v}</div>
              ))}
            </div>
            {pill('Latest files only', latestOnly, () => setLatestOnly((v) => !v))}
            {canManage && !atRoot && pill('+ New Folder', false, () => setNewFolderOpen((v) => !v))}
            {!atRoot && (
              <div onClick={() => projectId && sync(projectId)}
                   title="Pull in anything added to this project's Drive folder"
                   style={{ padding: '7px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: syncing ? 'progress' : 'pointer', background: 'white', color: '#43514D', border: '1px solid rgba(20,8,31,0.12)' }}>
                {syncing ? 'Syncing…' : '⟳ Sync Drive'}
              </div>
            )}
            {canManage && (
              <div onClick={() => setUploadOpen((v) => !v)}
                   style={{ padding: '7px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>+ Upload Files</div>
            )}
          </div>

          {newFolderOpen && !atRoot && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') createFolder(projectId as number, folder, newFolderName);
                       if (e.key === 'Escape') { setNewFolderOpen(false); setNewFolderName(''); }
                     }}
                     placeholder="Folder name" style={{ ...inputStyle, width: 220 }} />
              <div onClick={() => createFolder(projectId as number, folder, newFolderName)}
                   style={{ padding: '7px 14px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Create</div>
            </div>
          )}

          {uploadOpen && (
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); sendFiles(Array.from(e.dataTransfer.files)); }}
              style={{ border: '2px dashed rgba(20,8,31,0.12)', borderRadius: 13, background: 'white', padding: '26px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
            >
              <input ref={fileInput} type="file" multiple style={{ display: 'none' }}
                     onChange={(e) => { sendFiles(Array.from(e.target.files ?? [])); e.currentTarget.value = ''; }} />
              <div style={{ fontSize: 20, marginBottom: 6 }}>⬆</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1A12' }}>
                {uploading.length ? `Uploading ${uploading.length}…` : 'Drop files here or click to attach'}
              </div>
              <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 4 }}>
                {atRoot ? 'Open a project first — files belong to one' : ['All Files', project?.name, ...folder].filter(Boolean).join(' › ')}
              </div>
            </div>
          )}

          {!storageReady && canManage && (
            <div style={{ fontSize: 11.5, color: '#8A6D12', background: '#FBE9AE', borderRadius: 8, padding: '8px 11px', marginBottom: 12 }}>
              No Google account connected — uploads are unavailable until one is linked under Settings → Integrations.
            </div>
          )}

          {view === 'grid' ? gridView : listView}
        </div>
      </div>

      {selected && (
        <div onClick={() => setSelectedFileId(null)}
             style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 140, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: 400, maxWidth: '92vw', height: '100%', background: 'white', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(11,26,18,0.22)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: extStyle(selected.ext).bg, color: extStyle(selected.ext).c, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{(selected.ext || '?').slice(0, 4)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, color: '#0B1A12', wordBreak: 'break-word' }}>{selected.name}</div>
                <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 2 }}>{(selected.folderPath ?? []).join(' › ') || 'Project root'}</div>
                <div style={{ marginTop: 6 }}>{badge(selected)}</div>
              </div>
              <div onClick={() => setSelectedFileId(null)}
                   style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(20,8,31,0.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', flexShrink: 0 }}>×</div>
            </div>

            {isImage(selected) && (
              <div style={{ padding: '16px 22px 0' }}>
                <img src={api.fileRoom.contentUrl(selected.id)} alt={selected.name}
                     style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(20,8,31,0.08)' }} />
              </div>
            )}

            <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {([['Project', data.projects.find((p) => p.id === Number(selected.projectId))?.name ?? '—'],
                 ['Size', prettySize(selected.size)],
                 ['Modified', shortDate(selected.updatedAt)],
                 ['Modified by', selected.uploadedBy || '—'],
                 ['Type', selected.ext || '—'],
                 ['Version', selected.groupId ? `${versions.length} revision${versions.length === 1 ? '' : 's'}` : 'Single']] as [string, string][])
                .map(([k, v]) => (
                  <div key={k} style={{ background: '#FBF8F2', borderRadius: 10, padding: '11px 13px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>{k}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', marginTop: 3, wordBreak: 'break-word' }}>{v}</div>
                  </div>
                ))}
            </div>

            {versions.length > 1 && (
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Version history</div>
                {versions.map((v, i) => (
                  <div key={v.id} onClick={() => { setSelectedFileId(v.id); setRenaming(v.name); setNotes(v.notes ?? ''); setShareUrl(''); setEmailOpen(false); }}
                       style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: v.id === selected.id ? '#EEF3EE' : 'transparent' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: v.isLatest !== false ? '#2F7D4A' : '#C9D4CC', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11.5, color: '#43514D' }}>
                      v{versions.length - i} · {shortDate(v.updatedAt)} · {v.uploadedBy || '—'}
                    </span>
                    {v.isLatest !== false && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#D2EAD3', color: '#1C5230' }}>Current</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '0 22px 16px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 7 }}>Notes</div>
              <textarea
                value={notes}
                disabled={!canManage}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { if (notes !== (selected.notes ?? '')) act(api.fileRoom.setNotes(selected.id, notes), 'Notes saved'); }}
                rows={4}
                placeholder="What this document is, what changed, anything worth knowing…"
                style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.6, background: '#FBF8F2' }}
              />
            </div>

            <div style={{ padding: '0 22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={api.fileRoom.contentUrl(selected.id, { download: true })}
                 style={{ padding: '10px 0', borderRadius: 10, background: '#173326', color: 'white', fontSize: 12.5, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Download</a>

              <div
                onClick={async () => {
                  try {
                    const r = await api.fileRoom.share(selected.id);
                    setShareUrl(r.url);
                    try { await navigator.clipboard.writeText(r.url); toast('Share link copied'); }
                    catch { toast('Share link ready'); }
                  } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not create a link')); }
                }}
                style={{ padding: '9px 0', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', color: '#173326', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}
              >Copy share link</div>

              {shareUrl && (
                <div style={{ background: '#FBF8F2', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#8A6D12', fontWeight: 700, marginBottom: 4 }}>Anyone with this link can view the file</div>
                  <div style={{ fontSize: 10.5, color: '#2F6F68', wordBreak: 'break-all' }}>{shareUrl}</div>
                </div>
              )}

              <div onClick={() => setEmailOpen((v) => !v)}
                   style={{ padding: '9px 0', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', color: '#173326', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>
                {emailOpen ? 'Cancel email' : 'Email this file'}
              </div>

              {emailOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FBF8F2', borderRadius: 10, padding: 10 }}>
                  <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Recipient email" style={inputStyle} />
                  <textarea value={emailNote} onChange={(e) => setEmailNote(e.target.value)} rows={3} placeholder="Add a note (optional)" style={{ ...inputStyle, resize: 'vertical' }} />
                  <div
                    onClick={async () => {
                      if (!emailTo.trim()) { toast('⚠ Add a recipient'); return; }
                      try {
                        const r = await api.fileRoom.email(selected.id, emailTo, emailNote);
                        toast(`Sent to ${r.to}`);
                        setEmailOpen(false); setEmailTo(''); setEmailNote('');
                      } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not send')); }
                    }}
                    style={{ padding: '8px 0', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}
                  >Send</div>
                  <div style={{ fontSize: 10, color: '#7E9B93', lineHeight: 1.5 }}>
                    Sent from the connected Google account as a view link, not an attachment — so size is never a problem.
                  </div>
                </div>
              )}

              {canManage && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={renaming} onChange={(e) => setRenaming(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <div onClick={() => renaming.trim() && renaming !== selected.name && act(api.fileRoom.rename(selected.id, renaming), 'Renamed')}
                       style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', color: '#173326', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Rename</div>
                </div>
              )}

              {canManage && selected.groupId && selected.isLatest === false && (
                <div onClick={() => act(api.fileRoom.markLatest(selected.id), 'Marked as the latest version')}
                     style={{ padding: '9px 0', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', color: '#173326', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>Mark as latest version</div>
              )}

              {canManage && (
                <div onClick={() => {
                       if (!confirm(`Delete ${selected.name}? It moves to the Drive trash.`)) return;
                       setSelectedFileId(null);
                       act(api.fileRoom.remove(selected.id), 'File deleted');
                     }}
                     style={{ padding: '9px 0', borderRadius: 10, border: '1px solid #F2DFD4', color: '#8E2E0A', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>Delete</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
