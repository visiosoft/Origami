/** Texting clients (Oct 27 backlog item 11). */

export interface SmsMessage {
  id: string; at: string; to: string; body: string; provider: string; status: 'sent' | 'failed'; error?: string | null;
  entityType?: string | null; entityId?: string | null; templateKey?: string | null; byName?: string | null;
}

/** Mirrors segmentsFor in backend/src/sms/sms.service.ts. */
export function smsSegments(body: string) {
  // eslint-disable-next-line no-control-regex -- "anything outside ASCII" is the point
  const unicode = /[^\x00-\x7F]/.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const length = body.length;
  if (length === 0) return { length, unicode, segments: 0 };
  return { length, unicode, segments: length <= single ? 1 : Math.ceil(length / multi) };
}

