/**
 * Templates are formatted (Oct 31): every kind but SMS is edited with the
 * formatting toolbar and kept as HTML. Older templates were plain text;
 * these turn them into paragraphs when they're opened or used.
 */
export const isHtml = (s: string) => /<\/?(p|br|div|h[1-6]|ul|ol|li|strong|b|em|i|u|a|table|span|img)\b[^>]*>/i.test(s || '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text as HTML: a blank line starts a paragraph, a single line break stays one. */
export function textToHtml(s: string): string {
  return String(s || '').trim().split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
}

/** A template body as HTML, whether it was written formatted or as plain text. */
export const asHtml = (s: string) => (isHtml(s) ? s : textToHtml(s));

/** HTML as plain text (a preview line, an SMS, a mailto: link). */
export function htmlToText(s: string): string {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}
