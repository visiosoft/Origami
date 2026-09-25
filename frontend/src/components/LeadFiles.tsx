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
  const known = new Set(stages.map((s) => s.key));
  const loose = files.filter((f) => !f.stage || !known.has(f.stage));
  return (
    <div style={{ padding: '16px 20px 24px', display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#7E9B93', lineHeight: 1.5 }}>
        {files.length ? `${files.length} file${files.length === 1 ? '' : 's'} on this lead, by the stage they were added in.` : 'No files on this lead yet.'}
        {' '}Files are stored in the connected Google Drive, in a folder for this lead.
      </div>
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
