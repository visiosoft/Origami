import { useEffect, useRef } from 'react';

/** Keeps a document's HTML size sane -- large embedded images slow every save and PDF render. */
const MAX_IMAGE_BYTES = 500 * 1024;

const BTN: React.CSSProperties = {
  width: 28, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center',
  cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#43514D', flexShrink: 0,
};

/**
 * A small dependency-free rich text editor -- contentEditable plus a toolbar
 * over document.execCommand. Not a full word processor, but enough for a
 * formatted agreement or letter: headings, bold/italic/underline, lists, a
 * link, an inserted image or table, and clearing formatting back to plain
 * text.
 *
 * Controlled by `value`/`onChange` (an HTML string), the same shape a plain
 * textarea's body already was, so it drops into the same field.
 */
export function RichTextEditor({ value, onChange, minHeight = 260 }: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Only push `value` into the DOM when it changes from *outside* (e.g.
  // switching templates or applying merge tokens) -- never while the user is
  // actively typing, or the cursor jumps to the start on every keystroke.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML || '';
    lastEmitted.current = html;
    onChange(html);
  };

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const link = () => {
    const url = prompt('Link URL:');
    if (url) run('createLink', url);
  };

  const insertImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('That needs to be an image file.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { alert(`${file.name} is larger than ${MAX_IMAGE_BYTES / 1024} KB -- use a smaller image.`); return; }
    const reader = new FileReader();
    reader.onload = () => run('insertHTML', `<img src="${String(reader.result || '')}" style="max-width:100%;height:auto;display:block;margin:8px 0;" />`);
    reader.readAsDataURL(file);
  };

  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, Number(prompt('Rows:', '3')) || 3));
    const cols = Math.max(1, Math.min(10, Number(prompt('Columns:', '3')) || 3));
    const cell = '<td style="border:1px solid rgba(20,8,31,0.18);padding:6px 8px;min-width:60px;">&nbsp;</td>';
    const row = `<tr>${cell.repeat(cols)}</tr>`;
    run('insertHTML', `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${row.repeat(rows)}</table>`);
  };

  const btn = (label: string, onClick: () => void, title: string) => (
    <span onClick={onClick} title={title} style={BTN} onMouseDown={(e) => e.preventDefault()}>{label}</span>
  );

  return (
    <div style={{ border: '1px solid rgba(20,8,31,0.14)', borderRadius: 9, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 6px', borderBottom: '1px solid rgba(20,8,31,0.08)', background: '#FBF8F2', flexWrap: 'wrap' }}>
        {btn('B', () => run('bold'), 'Bold')}
        <span style={{ fontStyle: 'italic' }}>{btn('I', () => run('italic'), 'Italic')}</span>
        <span style={{ textDecoration: 'underline' }}>{btn('U', () => run('underline'), 'Underline')}</span>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(20,8,31,0.1)', margin: '0 3px' }} />
        {btn('H1', () => run('formatBlock', '<h1>'), 'Heading 1')}
        {btn('H2', () => run('formatBlock', '<h2>'), 'Heading 2')}
        {btn('H3', () => run('formatBlock', '<h3>'), 'Heading 3')}
        {btn('¶', () => run('formatBlock', '<p>'), 'Paragraph')}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(20,8,31,0.1)', margin: '0 3px' }} />
        {btn('•', () => run('insertUnorderedList'), 'Bullet list')}
        {btn('1.', () => run('insertOrderedList'), 'Numbered list')}
        {btn('🔗', link, 'Insert link')}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(20,8,31,0.1)', margin: '0 3px' }} />
        {btn('🖼', () => fileRef.current?.click(), 'Insert image')}
        {btn('⊞', insertTable, 'Insert table')}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { insertImage(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(20,8,31,0.1)', margin: '0 3px' }} />
        {btn('✕', () => run('removeFormat'), 'Clear formatting')}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        style={{
          padding: '12px 14px', minHeight, maxHeight: 520, overflowY: 'auto',
          fontSize: 13, lineHeight: 1.6, color: '#0B1A12', outline: 'none',
        }}
        className="rich-text-editor-surface"
      />
      <style>{`
        .rich-text-editor-surface h1 { font-size: 20px; font-weight: 700; margin: 14px 0 8px; }
        .rich-text-editor-surface h2 { font-size: 16px; font-weight: 700; margin: 12px 0 6px; }
        .rich-text-editor-surface h3 { font-size: 13.5px; font-weight: 700; margin: 10px 0 5px; text-transform: uppercase; letter-spacing: 0.04em; color: #173326; }
        .rich-text-editor-surface p { margin: 0 0 8px; }
        .rich-text-editor-surface ul, .rich-text-editor-surface ol { margin: 0 0 8px; padding-left: 22px; }
        .rich-text-editor-surface a { color: #173326; }
      `}</style>
    </div>
  );
}
