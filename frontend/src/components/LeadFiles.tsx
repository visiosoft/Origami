import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Attachments } from './Attachments';
import type { Attachment } from '../data/projectTasks';

/** A lead's file, tagged with the pipeline stage it was added in. */
export type LeadFile = Attachment & { stage?: string; stageName?: string };

/** A lead's files, loaded once for the panel and shared by the Overview box and the Files tab. */
export function useLeadFiles(leadId: string | null | undefined) {
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    if (!leadId) { setFiles([]); return; }
    api.leadFiles.list(leadId).then((f) => { setFiles(Array.isArray(f) ? f : []); setLoaded(true); }).catch(() => setLoaded(true));
  }, [leadId]);
  useEffect(() => { setLoaded(false); reload(); }, [reload]);
  return { files, setFiles, loaded, reload };
}

function useStorageReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => { api.google.status().then((g: any) => setReady(!!g?.connected)).catch(() => setReady(false)); }, []);
  return ready;
}

/** One stage's files: a drop zone / upload button that tags what it takes with that stage. */
function StageFiles({ leadId, stage, stageName, files, onChange, canManage, storageReady, paste, title }: {
  leadId: string; stage?: string; stageName?: string; files: LeadFile[]; onChange: (all: LeadFile[]) => void;
  canManage: boolean; storageReady: boolean; paste: boolean; title?: string;
}) {
  const { toast } = useApp();
  return (
    <Attachments
      scope="lead-files" taskId={leadId} attachments={files} canManage={canManage} storageReady={storageReady} paste={paste} title={title}
      onUpload={async (fs) => { onChange(await api.leadFiles.upload(leadId, fs, stage, stageName)); toast(fs.length === 1 ? 'File added' : `${fs.length} files added`); }}
      onRemove={async (att) => { try { onChange(await api.leadFiles.remove(leadId, att.id)); } catch (e) { toast('⚠ ' + (e as Error).message); } }}
      onAddLink={async (name, url) => { onChange(await api.leadFiles.link(leadId, name, url, stage, stageName)); }}
    />
  );
}

/**
 * The box at the bottom of a lead's Overview: files for the stage it's on
 * (Site Visit photos, the survey, the client's plans). Drop, paste or pick
 * files; they're tagged with this stage.
 */
export function LeadStageFiles({ leadId, stage, stageName, files, onChange, onShowAll }: {
  leadId: string; stage: string; stageName: string; files: LeadFile[]; onChange: (all: LeadFile[]) => void; onShowAll: () => void;
}) {
  const { can } = useApp();
  const storageReady = useStorageReady();
  const mine = files.filter((f) => f.stage === stage);
  const others = files.length - mine.length;
  return (
    <div style={{ margin: '4px 20px 22px', padding: '14px 16px', background: 'white', border: '1px solid rgba(20,8,31,0.09)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12' }}>Files · {stageName}</span>
        <span style={{ fontSize: 11.5, color: '#7E9B93' }}>Drop, paste or pick — photos, surveys, the client’s plans.</span>
        {others > 0 && <span onClick={onShowAll} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>All files ({files.length}) →</span>}
      </div>
      <StageFiles leadId={leadId} stage={stage} stageName={stageName} files={mine} onChange={onChange} canManage={can('pipeline', 'manage')} storageReady={storageReady} paste title="This stage" />
    </div>
  );
}

/**
 * The Files tab: every file on the lead, grouped by the stage it was added
 * in, in pipeline order. Each group takes new files for its own stage; the
 * current stage's group also takes pasted screenshots.
 */
export function LeadFilesTab({ leadId, files, onChange, stages, currentStage }: {
  leadId: string; files: LeadFile[]; onChange: (all: LeadFile[]) => void;
  stages: { key: string; name: string }[]; currentStage: string;
}) {
  const { can } = useApp();
  const canManage = can('pipeline', 'manage');
  const storageReady = useStorageReady();
  const groups = stages.filter((s) => s.key === currentStage || files.some((f) => f.stage === s.key));
  const known = new Set([...stages.map((s) => s.key), 'client_upload']);
  const fromClient = files.filter((f) => f.stage === 'client_upload');
  const loose = files.filter((f) => !f.stage || !known.has(f.stage));
  return (
    <div style={{ padding: '16px 20px 24px', display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#7E9B93', lineHeight: 1.5 }}>
        {files.length ? `${files.length} file${files.length === 1 ? '' : 's'} on this lead, by the stage they were added in.` : 'No files on this lead yet.'}
        {' '}Files are stored in the connected Google Drive, in a folder for this lead.
      </div>
      {fromClient.length > 0 && (
        <div style={{ padding: '12px 14px', background: '#F4F8F4', border: '1px solid rgba(47,125,74,0.25)', borderRadius: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', marginBottom: 4 }}>Uploaded by the client</div>
          <div style={{ fontSize: 11.5, color: '#7E9B93', marginBottom: 8 }}>{[...new Set(fromClient.map((f) => (f.stageName || '').replace(/^Client: /, '')).filter((x) => x && x !== 'Uploaded by the client'))].join(' · ') || 'From the upload link in the welcome email'}</div>
          <StageFiles leadId={leadId} stage="client_upload" stageName="Uploaded by the client" files={fromClient} onChange={onChange} canManage={canManage} storageReady={storageReady} paste={false} title="Files" />
        </div>
      )}
      {groups.map((s) => {
        const mine = files.filter((f) => f.stage === s.key);
        const current = s.key === currentStage;
        return (
          <div key={s.key} style={{ padding: '12px 14px', background: current ? 'white' : '#FBF8F2', border: '1px solid ' + (current ? 'rgba(47,125,74,0.35)' : 'rgba(20,8,31,0.06)'), borderRadius: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', marginBottom: 8 }}>
              {s.name}{current && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#2F7D4A', background: '#D2EAD3', padding: '1px 7px', borderRadius: 999 }}>Current stage</span>}
            </div>
            <StageFiles leadId={leadId} stage={s.key} stageName={s.name} files={mine} onChange={onChange} canManage={canManage} storageReady={storageReady} paste={current} title="Files" />
          </div>
        );
      })}
      {loose.length > 0 && (
        <div style={{ padding: '12px 14px', background: '#FBF8F2', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', marginBottom: 8 }}>Other</div>
          <StageFiles leadId={leadId} files={loose} onChange={onChange} canManage={canManage} storageReady={storageReady} paste={false} title="Files" />
        </div>
      )}
    </div>
  );
}

/**
 * The client welcome email (F11): a thank-you, what they told us, the
 * documents we still need, and a private upload link -- their uploads land
 * here under "Uploaded by the client". Shows when it was sent and whether the
 * link is still live; sending again replaces the link.
 */
export function ClientWelcomeCard({ leadId, defaultTo, homework }: { leadId: string; defaultTo?: string; homework: string[] }) {
  const { toast, can } = useApp();
  const [st, setSt] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.leadFiles.welcomeStatus(leadId).then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); setOpen(false); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = () => { setTo(defaultTo && defaultTo !== '—' ? defaultTo : ''); setNote(''); setItems(st?.items?.length ? st.items : homework); setOpen(true); };
  const send = async () => {
    setBusy(true);
    try { setSt(await api.leadFiles.sendWelcome(leadId, { to, note, items })); setOpen(false); toast('Welcome email sent with the upload link'); }
    catch (e) { toast('⚠ ' + (e as Error).message); }
    finally { setBusy(false); }
  };
  const off = async () => { if (!confirm('Turn the upload link off? The client won’t be able to upload with it any more.')) return; setSt(await api.leadFiles.disableWelcome(leadId)); toast('Upload link turned off'); };
  if (!can('pipeline', 'manage')) return null;
  const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  const chip = (on: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.12)'), background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#43514D' });
  const inputS: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13, fontFamily: 'inherit' };
  const pool = [...new Set([...homework, ...items])];
  return (
    <div style={{ padding: '12px 14px', background: 'white', border: '1px solid rgba(20,8,31,0.09)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', flex: 1 }}>Welcome email &amp; upload link</span>
        {st?.sentAt && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st.linkLive ? '#D2EAD3' : '#EFEDE8', color: st.linkLive ? '#1E6B36' : '#5C6B65' }}>{st.linkLive ? `Link live until ${day(st.expiresAt)}` : 'Link off'}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#7E9B93', margin: '4px 0 8px', lineHeight: 1.5 }}>
        {st?.sentAt
          ? <>Sent {day(st.sentAt)} to {st.sentTo}{st.sentBy ? ` by ${st.sentBy}` : ''} · {st.uploads} file{st.uploads === 1 ? '' : 's'} uploaded by the client.</>
          : 'Thank the client, sum up what they told you, list the documents you need, and give them a private link to upload them — no account needed.'}
      </div>
      {!open ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span onClick={start} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>{st?.sentAt ? 'Send again (new link)' : 'Send welcome email'}</span>
          {st?.linkLive && <span onClick={off} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Turn link off</span>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Client email" style={inputS} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="A personal line after the thank-you (optional)" style={{ ...inputS, resize: 'vertical' }} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Documents to ask for</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {pool.map((i) => <span key={i} onClick={() => setItems(items.includes(i) ? items.filter((x) => x !== i) : [...items, i])} style={chip(items.includes(i))}>{i}</span>)}
              {!pool.length && <span style={{ fontSize: 12, color: '#7E9B93' }}>No homework ticked on this lead — the client can still upload anything.</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span onClick={busy ? undefined : send} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', opacity: busy || !to.trim() ? 0.55 : 1 }}>{busy ? 'Sending…' : 'Send'}</span>
            <span onClick={() => setOpen(false)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)' }}>Cancel</span>
          </div>
        </div>
      )}
    </div>
  );
}
