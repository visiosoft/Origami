/**
 * Notification settings (slide 56): for each event, how someone hears about it --
 * a text or an email as it happens, in a daily or weekly digest, or not at all.
 */
export const CHANNELS = [
  { key: 'text_now', label: 'Text', when: 'as it happens' },
  { key: 'email_now', label: 'Email', when: 'as it happens' },
  { key: 'text_daily', label: 'Text', when: 'daily digest' },
  { key: 'email_daily', label: 'Email', when: 'daily digest' },
  { key: 'text_weekly', label: 'Text', when: 'weekly digest' },
  { key: 'email_weekly', label: 'Email', when: 'weekly digest' },
] as const;
export type ChannelKey = (typeof CHANNELS)[number]['key'];

export interface NotifyEventInfo { key: string; label: string; group: string; hint: string }
export interface NotifyPrefs {
  events: NotifyEventInfo[];
  matrix: Record<string, ChannelKey[]>;
  /** False while they're on the defaults. */
  custom: boolean;
  phone: string;
  /** The number we'd use from their People record when they haven't entered one. */
  phoneFromPeople: string;
  warnings: string[];
}
export interface NotifyFeedItem { id: string; event: string; label: string; title: string; body?: string | null; url?: string | null; at: string }

/** Tick or untick one channel; "None" clears the row. */
export function toggleChannel(row: ChannelKey[], channel: ChannelKey | 'none'): ChannelKey[] {
  if (channel === 'none') return [];
  return row.includes(channel) ? row.filter((c) => c !== channel) : [...row, channel];
}
