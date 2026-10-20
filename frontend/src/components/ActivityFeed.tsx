import { useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Avatar } from './Avatar';
import type { ActivityEvent, TaskComment } from '../data/projectTasks';

/** "3 min ago" / "2 days ago" — falls back to the raw string if unparseable. */
export function relativeTime(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value || '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d ago`;
  return new Date(ms).toLocaleDateString();
}

/** One line of prose for a system event. */
function describe(e: ActivityEvent): string {
  switch (e.type) {
    case 'created': return 'created this task';
    case 'attachment': return e.text ?? 'changed the attachments';
    case 'assign': return e.to ? `assigned this to ${e.to}` : 'removed the assignee';
    case 'status': return `moved status from ${e.from || '—'} to ${e.to || '—'}`;
    case 'field': return `changed ${(e.text ?? e.field ?? 'a field').toLowerCase()} from "${e.from || '—'}" to "${e.to || '—'}"`;
    default: return e.text ?? '';
  }
}

/**
 * The task history: comments people wrote and a record of what changed, merged
 * into one timeline, newest first, with the comment box above it.
 */
export function ActivityFeed({
  comments,
  activity,
  canManage,
  onComment,
}: {
  comments: TaskComment[];
  activity: ActivityEvent[];
  canManage: boolean;
  onComment: (text: string) => Promise<void>;
}) {
  const { currentUser, users } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // @mentions: typing "@an" offers matching people; picking one writes "@Andrea Castillo ".
  const box = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const matches = mention ? users.filter((u) => u.status !== 'suspended' && u.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(mention.query.toLowerCase()))).slice(0, 6) : [];
  const track = (value: string, caret: number) => {
    const m = /(^|\s)@([\p{L}'-]{0,20})$/u.exec(value.slice(0, caret));
    setMention(m ? { start: caret - m[2].length - 1, query: m[2] } : null);
  };
  const pickMention = (name: string) => {
    if (!mention) return;
    const end = mention.start + 1 + mention.query.length;
    const next = text.slice(0, mention.start) + '@' + name + ' ' + text.slice(end);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => { const at = mention.start + name.length + 2; box.current?.focus(); box.current?.setSelectionRange(at, at); });
  };

  // Comments already appear as activity entries; render those and fold in any
  // comment that predates the activity log so nothing is lost.
  const entries = useMemo(() => {
    const fromActivity = activity.map((e) => ({ kind: 'event' as const, at: e.at, event: e }));
    const loggedTexts = new Set(activity.filter((e) => e.type === 'comment').map((e) => e.text));
    const orphanComments = comments
      .filter((c) => !loggedTexts.has(c.text))
      .map((c) => ({ kind: 'comment' as const, at: c.date, comment: c }));
    // Newest first; an entry without a readable time sorts as the oldest.
    const t = (at?: string) => { const ms = Date.parse(at || ''); return Number.isNaN(ms) ? 0 : ms; };
    return [...fromActivity, ...orphanComments].map((e, i) => ({ e, i })).sort((a, b) => t(b.e.at) - t(a.e.at) || b.i - a.i).map((x) => x.e);
  }, [comments, activity]);

  const userFor = (name?: string, id?: string) =>
    users.find((u) => (id && u.id === id) || (name && u.name === name));

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onComment(text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: 10 }}>
        Activity
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
          <Avatar user={currentUser} name={currentUser?.name} size={26} />
          <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
          <textarea
            ref={box}
            value={text}
            onChange={(e) => { setText(e.target.value); track(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            onKeyDown={(e) => {
              if (mention && matches.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMention(matches[0].name); return; }
              if (e.key === 'Escape') setMention(null);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Write a comment… type @ to mention someone"
            rows={2}
            style={{
              flex: 1, boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9,
              border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--panel)', fontFamily: 'inherit',
              fontSize: 12.5, color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.5,
            }}
          />
          {mention && matches.length > 0 && (
            <ul role="listbox" aria-label="Mention someone" style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 5, listStyle: 'none', padding: 4, minWidth: 200, background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.12)', borderRadius: 10, boxShadow: '0 10px 28px rgba(var(--rgb-ink), 0.16)' }}>
              {matches.map((u, i) => (
                <li key={u.id} role="option" aria-selected={i === 0} onMouseDown={(e) => { e.preventDefault(); pickMention(u.name); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', background: i === 0 ? 'var(--panel)' : 'transparent' }}>
                  <Avatar user={u} name={u.name} size={20} />{u.name}
                </li>
              ))}
            </ul>
          )}
          </div>
          <div
            onClick={submit}
            style={{
              padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              cursor: busy || !text.trim() ? 'default' : 'pointer',
              background: busy || !text.trim() ? 'var(--c-c9d4cc)' : 'var(--forest)', color: 'white', whiteSpace: 'nowrap',
            }}
          >
            {busy ? '…' : 'Send'}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--c-9aa39d)', marginBottom: 12 }}>Nothing has happened on this task yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map((entry, i) => {
          if (entry.kind === 'comment' || entry.event?.type === 'comment') {
            const author = entry.kind === 'comment' ? entry.comment.author : entry.event.by;
            const authorId = entry.kind === 'comment' ? entry.comment.authorId : entry.event.byId;
            const body = entry.kind === 'comment' ? entry.comment.text : entry.event.text ?? '';
            return (
              <div key={i} style={{ display: 'flex', gap: 9 }}>
                <Avatar user={userFor(author, authorId)} name={author} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{author}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--c-9aa39d)' }}>{relativeTime(entry.at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: 2 }}>{body}</div>
                </div>
              </div>
            );
          }
          const e = entry.event;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--c-c9d4cc)', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--body)', fontWeight: 600 }}>{e.by}</strong> {describe(e)} · {relativeTime(e.at)}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
