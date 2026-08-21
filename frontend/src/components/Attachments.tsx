import { useEffect, useState } from 'react';
import { attachmentUrl } from '../api';
import type { Attachment } from '../data/projectTasks';

/** Block javascript:/data: URLs on hand-typed links. */
const safeHref = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

const isImage = (a: Attachment) => !!a.mimeType?.startsWith('image/');

const prettySize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Timestamped name for an image pasted from the clipboard. */
function screenshotName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`;
}

export interface AttachmentsProps {
  scope: 'tasks' | 'project-tasks';
  taskId: string;
  attachments: Attachment[];
  canManage: boolean;
  /** False when no Google account is connected — uploads are unavailable. */
  storageReady: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (att: Attachment) => Promise<void>;
  onAddLink: (name: string, url: string) => Promise<void>;
}

/**
 * The attachments block, shared by the Request Log and the project board.
 *
 * Files are uploaded to the connected Google Drive account and streamed back
 * through the API, so thumbnails render for any signed-in Origami user without
 * needing a Google session of their own.
 */
export function Attachments(props: AttachmentsProps) {
  const { scope, taskId, attachments, canManage, storageReady } = props;
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [preview, setPreview] = useState<Attachment | null>(null);

  const send = async (files: File[]) => {
    if (!files.length || !canManage) return;
    if (!storageReady) {
      setError('Connect a Google account under Settings → Integrations to upload files. You can still attach a link.');
      return;
    }
    setError('');
    setPending(files.map((f) => f.name));
    try {
      await props.onUpload(files);
    } catch (e) {
      setError((e as Error).message || 'Upload failed.');
    } finally {
      setPending([]);
    }
  };

  // Paste a screenshot straight onto the task — the fastest path there is.
  useEffect(() => {
    if (!canManage) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      send(files.map((f) => (f.name && f.name !== 'image.png' ? f : new File([f], screenshotName(), { type: f.type }))));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, storageReady, taskId]);

  const images = attachments.filter(isImage);

  return (
    <div
      onDragOver={(e) => {
        if (!canManage || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();   // don't let a card drag see this
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canManage || !e.dataTransfer.files?.length) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        send(Array.from(e.dataTransfer.files));
      }}
      style={{
        borderRadius: 10,
        border: dragging ? '2px dashed #2F7D4A' : '2px dashed transparent',
        background: dragging ? '#EEF3EE' : 'transparent',
        padding: dragging ? 8 : 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93' }}>
          Attachments {attachments.length > 0 && <span style={{ color: '#7E9B93' }}>{attachments.length}</span>}
        </span>
      </div>

      {/* Thumbnails + file chips */}
      {attachments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 10 }}>
          {attachments.map((att) => {
            const href = att.kind === 'link' ? safeHref(att.url) : undefined;
            const thumb = att.kind === 'drive' ? attachmentUrl(scope, taskId, att.id, true) : undefined;
            return (
              <div key={att.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => {
                    if (isImage(att)) setPreview(att);
                    else if (att.kind === 'drive') window.open(attachmentUrl(scope, taskId, att.id), '_blank');
                    else if (href) window.open(href, '_blank');
                  }}
                  title={`${att.name}${att.size ? ` · ${prettySize(att.size)}` : ''}`}
                  style={{
                    height: 76, borderRadius: 9, overflow: 'hidden', cursor: 'pointer',
                    border: '1px solid rgba(20,8,31,0.1)', background: '#FBF8F2',
                    display: 'grid', placeItems: 'center', padding: isImage(att) ? 0 : 6,
                  }}
                >
                  {isImage(att) && thumb ? (
                    <img
                      src={thumb}
                      alt={att.name}
                      // Drive generates thumbnails a few seconds after upload —
                      // fall back to the full file until it catches up.
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = attachmentUrl(scope, taskId, att.id); }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                      <div style={{ fontSize: 18 }}>{att.kind === 'link' ? '🔗' : '📄'}</div>
                      <div style={{ fontSize: 9.5, color: '#5C6B65', wordBreak: 'break-word', maxHeight: 26, overflow: 'hidden' }}>{att.name}</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#7E9B93', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </div>
                {canManage && (
                  <div
                    onClick={() => props.onRemove(att)}
                    title="Remove"
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999,
                      background: '#8E2E0A', color: 'white', fontSize: 11, fontWeight: 700,
                      display: 'grid', placeItems: 'center', cursor: 'pointer', border: '2px solid white',
                    }}
                  >
                    ×
                  </div>
                )}
              </div>
            );
          })}
          {pending.map((name) => (
            <div key={name} style={{ height: 76, borderRadius: 9, border: '1px dashed rgba(20,8,31,0.18)', background: '#FBF8F2', display: 'grid', placeItems: 'center' }}>
              <div style={{ fontSize: 10, color: '#7E9B93', textAlign: 'center', padding: 4 }}>Uploading…</div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label
            style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: '#EEF3EE', color: '#173326', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { send(Array.from(e.target.files ?? [])); e.currentTarget.value = ''; }}
            />
            + Add file
          </label>
          <div
            onClick={() => setLinkOpen((v) => !v)}
            style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#43514D' }}
          >
            {linkOpen ? 'Cancel' : 'Add link'}
          </div>
          <span style={{ fontSize: 11, color: '#9AA39D' }}>or paste a screenshot / drop files here</span>
        </div>
      )}

      {linkOpen && canManage && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Label"
            style={{ flex: '0 0 130px', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            style={{ flex: 1, minWidth: 160, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <div
            onClick={async () => {
              if (!safeHref(linkUrl)) { setError('Links must start with http:// or https://'); return; }
              await props.onAddLink(linkName || linkUrl, linkUrl);
              setLinkName(''); setLinkUrl(''); setLinkOpen(false); setError('');
            }}
            style={{ padding: '7px 14px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Add
          </div>
        </div>
      )}

      {!storageReady && canManage && (
        <div style={{ fontSize: 11, color: '#8A6D12', background: '#FBE9AE', borderRadius: 8, padding: '7px 10px', marginTop: 8, lineHeight: 1.5 }}>
          File uploads need a connected Google account — Settings → Integrations → Google Workspace. Links work either way.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11.5, color: '#8E2E0A', background: '#F7E4DB', borderRadius: 8, padding: '7px 10px', marginTop: 8, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {preview && (
        <Lightbox
          items={images}
          current={preview}
          scope={scope}
          taskId={taskId}
          onClose={() => setPreview(null)}
          onNavigate={setPreview}
        />
      )}
    </div>
  );
}

function Lightbox({ items, current, scope, taskId, onClose, onNavigate }: {
  items: Attachment[];
  current: Attachment;
  scope: 'tasks' | 'project-tasks';
  taskId: string;
  onClose: () => void;
  onNavigate: (a: Attachment) => void;
}) {
  const index = items.findIndex((a) => a.id === current.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onNavigate(items[index + 1]);
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(items[index - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items, onClose, onNavigate]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(11,26,18,0.86)', display: 'grid', placeItems: 'center', padding: 32, animation: 'fadeIn 0.15s ease' }}
    >
      <img
        src={attachmentUrl(scope, taskId, current.id)}
        alt={current.name}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '86vh', borderRadius: 10, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
      />
      <div style={{ position: 'fixed', bottom: 24, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 600 }}>
        {current.name}{items.length > 1 ? ` · ${index + 1} of ${items.length}` : ''}
      </div>
      <div onClick={onClose} style={{ position: 'fixed', top: 20, right: 24, color: 'white', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</div>
    </div>
  );
}
