/**
 * Reading Gmail's API shapes (Nov 13 sync: each person's own mail in the
 * app). Pure, so it can be tested without Google.
 */
export interface GmailHeader { name: string; value: string }
export interface GmailPart { partId?: string; mimeType?: string; filename?: string; headers?: GmailHeader[]; body?: { size?: number; data?: string; attachmentId?: string }; parts?: GmailPart[] }
export interface GmailMessage { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: GmailPart }

export const headerOf = (p: GmailPart | undefined, name: string) => (p?.headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
export const fromB64Url = (s: string) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

/** The message's HTML and plain text, and its attachments. */
export function bodyOf(payload: GmailPart | undefined) {
  let html = ''; let text = '';
  const attachments: { id: string; filename: string; mimeType: string; size: number }[] = [];
  const walk = (p: GmailPart | undefined) => {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) attachments.push({ id: p.body.attachmentId, filename: p.filename, mimeType: p.mimeType || 'application/octet-stream', size: p.body.size || 0 });
    else if (p.mimeType === 'text/html' && p.body?.data && !html) html = fromB64Url(p.body.data);
    else if (p.mimeType === 'text/plain' && p.body?.data && !text) text = fromB64Url(p.body.data);
    for (const c of p.parts || []) walk(c);
  };
  walk(payload);
  if (!text && html) text = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return { html, text, attachments };
}

/** Email addresses in a header ("Ann <a@x.com>, b@y.com" -> ['a@x.com', 'b@y.com']). */
export function addressesIn(header: string): string[] {
  return [...new Set((String(header || '').match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g) || []).map((e) => e.toLowerCase()))];
}

/** A message as the app shows it. */
export function messageView(m: GmailMessage) {
  const b = bodyOf(m.payload);
  return {
    id: m.id, threadId: m.threadId,
    from: headerOf(m.payload, 'From'), to: headerOf(m.payload, 'To'), cc: headerOf(m.payload, 'Cc'),
    subject: headerOf(m.payload, 'Subject'), date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : headerOf(m.payload, 'Date'),
    messageId: headerOf(m.payload, 'Message-ID') || headerOf(m.payload, 'Message-Id'),
    unread: (m.labelIds || []).includes('UNREAD'),
    snippet: m.snippet || '', html: b.html, text: b.text, attachments: b.attachments,
  };
}

/**
 * Tags that tie a message to a record (Edward: "a pound sign in the email"):
 * #P-45 (project 45), #L-<lead id>, and #<task number or id> such as
 * #NARV-T-2026-0001 or #T-2026-0007.
 */
export function tagsIn(text: string): { projects: number[]; leads: string[]; tasks: string[] } {
  const out = { projects: [] as number[], leads: [] as string[], tasks: [] as string[] };
  for (const m of String(text || '').matchAll(/(?:^|[\s(\[])#([A-Za-z][A-Za-z0-9-]{1,48}[A-Za-z0-9])/g)) {
    const t = m[1];
    const p = /^P-?(\d{1,7})$/i.exec(t);
    if (p) { out.projects.push(Number(p[1])); continue; }
    const l = /^L-(.+)$/i.exec(t);
    if (l) { out.leads.push(l[1]); continue; }
    if (/-/.test(t) && /\d/.test(t)) out.tasks.push(t.toUpperCase());
  }
  return { projects: [...new Set(out.projects)], leads: [...new Set(out.leads)], tasks: [...new Set(out.tasks)] };
}
