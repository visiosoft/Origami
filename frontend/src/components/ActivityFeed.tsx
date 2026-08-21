import { useMemo, useState } from 'react';
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
 * into one timeline. Replaces the placeholder activity box the Request Log used
 * to show.
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

  // Comments already appear as activity entries; render those and fold in any
  // comment that predates the activity log so nothing is lost.
  const entries = useMemo(() => {
    const fromActivity = activity.map((e) => ({ kind: 'event' as const, at: e.at, event: e }));
    const loggedTexts = new Set(activity.filter((e) => e.type === 'comment').map((e) => e.text));
    const orphanComments = comments
      .filter((c) => !loggedTexts.has(c.text))
      .map((c) => ({ kind: 'comment' as const, at: c.date, comment: c }));
    return [...fromActivity, ...orphanComments].sort((a, b) => Date.parse(a.at || '') - Date.parse(b.at || ''));
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
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93', marginBottom: 10 }}>
        Activity
      </div>

      {entries.length === 0 && (
        <div style={{ fontSize: 12, color: '#9AA39D', marginBottom: 12 }}>Nothing has happened on this task yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
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
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12' }}>{author}</span>
                    <span style={{ fontSize: 10.5, color: '#9AA39D' }}>{relativeTime(entry.at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#43514D', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: 2 }}>{body}</div>
                </div>
              </div>
            );
          }
          const e = entry.event;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: '#C9D4CC', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: '#7E9B93', lineHeight: 1.5 }}>
                <strong style={{ color: '#43514D', fontWeight: 600 }}>{e.by}</strong> {describe(e)} · {relativeTime(e.at)}
              </span>
            </div>
          );
        })}
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Avatar user={currentUser} name={currentUser?.name} size={26} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="Write a comment…"
            rows={2}
            style={{
              flex: 1, boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9,
              border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontFamily: 'inherit',
              fontSize: 12.5, color: '#0B1A12', outline: 'none', resize: 'vertical', lineHeight: 1.5,
            }}
          />
          <div
            onClick={submit}
            style={{
              padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              cursor: busy || !text.trim() ? 'default' : 'pointer',
              background: busy || !text.trim() ? '#C9D4CC' : '#173326', color: 'white', whiteSpace: 'nowrap',
            }}
          >
            {busy ? '…' : 'Send'}
          </div>
        </div>
      )}
    </div>
  );
}
