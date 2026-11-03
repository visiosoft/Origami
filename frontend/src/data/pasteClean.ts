/**
 * Pasting a contract or letter from Word or Google Docs (Oct 30 sync): what
 * comes in leans on the source's own stylesheet (Word's MsoNormal classes,
 * list numbering kept in mso-list styles, Google's span soup), so most of it
 * fell away. This keeps the formatting that carries -- headings, bold /
 * italic / underline, lists, tables, alignment, indents, font sizes, links,
 * images -- as plain HTML with inline styles, and drops the rest.
 */

const KEEP = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'BR', 'A', 'IMG', 'SPAN', 'BLOCKQUOTE', 'HR', 'COL', 'COLGROUP', 'CAPTION']);
const DROP = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'XML', 'HEAD', 'OBJECT', 'IFRAME']);
/** Inline styles worth keeping, per kind of element. */
const BLOCK_STYLES = ['text-align', 'margin-left', 'padding-left', 'text-indent'];
const CELL_STYLES = ['text-align', 'vertical-align', 'width', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'padding', 'background-color', 'background'];
const TEXT_STYLES = ['font-size', 'color', 'background-color'];

function pickStyle(el: HTMLElement, allowed: string[]): string {
  const out: string[] = [];
  for (const prop of allowed) {
    const v = el.style.getPropertyValue(prop).trim();
    if (!v || /mso-|windowtext|auto/i.test(v)) continue;
    // Word's default black text and a white background aren't formatting worth keeping.
    if ((prop === 'color' && /^(black|#000000|rgb\(0, 0, 0\))$/i.test(v)) || (/background/.test(prop) && /^(white|transparent|#ffffff|rgb\(255, 255, 255\))$/i.test(v))) continue;
    out.push(`${prop}:${v}`);
  }
  return out.join(';');
}

/** Word keeps a list item's number or bullet as text (mso-list:Ignore); the list itself is ours to rebuild. */
function wordListInfo(p: HTMLElement): { level: number; ordered: boolean } | null {
  const style = p.getAttribute('style') || '';
  const cls = p.getAttribute('class') || '';
  const m = /mso-list:\s*l\d+\s+level(\d+)/i.exec(style);
  if (!m && !/MsoListParagraph/i.test(cls)) return null;
  const marker = p.querySelector('span[style*="mso-list:Ignore"], span[style*="mso-list: Ignore"]')?.textContent?.trim() || '';
  return { level: m ? Number(m[1]) : 1, ordered: /^[([]?[0-9a-zA-Z]{1,4}[.)\]]/.test(marker) };
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag) || /^O:|^W:|^V:/.test(tag)) return null;
  // Word's list marker: the list rebuilds it.
  if (/mso-list:\s*Ignore/i.test(el.getAttribute('style') || '')) return null;
  const kids = () => { const f = doc.createDocumentFragment(); el.childNodes.forEach((c) => { const k = cleanNode(c, doc); if (k) f.appendChild(k); }); return f; };
  if (!KEEP.has(tag)) {
    // A div (or unknown wrapper) becomes a paragraph when it holds text directly; otherwise just its contents.
    if (tag === 'DIV' && Array.from(el.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim())) {
      const p = doc.createElement('p'); p.appendChild(kids()); return p;
    }
    return kids();
  }
  // Google Docs wraps everything in <b style="font-weight:normal">.
  if ((tag === 'B' || tag === 'STRONG') && /font-weight:\s*(normal|400)/i.test(el.getAttribute('style') || '')) return kids();
  let out: HTMLElement;
  if (tag === 'SPAN') {
    // Bold / italic / underline written as styles (Google Docs, Word) become real tags.
    const fw = el.style.fontWeight, fs = el.style.fontStyle, td = el.style.textDecoration || el.style.getPropertyValue('text-decoration-line');
    let inner: Node = kids();
    if (/underline/.test(td)) { const u = doc.createElement('u'); u.appendChild(inner); inner = u; }
    if (fs === 'italic') { const i = doc.createElement('em'); i.appendChild(inner); inner = i; }
    if (fw === 'bold' || Number(fw) >= 600) { const b = doc.createElement('strong'); b.appendChild(inner); inner = b; }
    const style = pickStyle(el, TEXT_STYLES);
    if (!style) return inner;
    out = doc.createElement('span'); out.setAttribute('style', style); out.appendChild(inner);
    return out;
  }
  out = doc.createElement(tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase());
  const style = pickStyle(el, ['TD', 'TH', 'TABLE'].includes(tag) ? CELL_STYLES : ['P', 'LI', 'BLOCKQUOTE', 'UL', 'OL'].includes(tag) || /^H\d$/.test(tag) ? [...BLOCK_STYLES, ...TEXT_STYLES] : TEXT_STYLES);
  if (style) out.setAttribute('style', style);
  if (tag === 'A') { const href = el.getAttribute('href') || ''; if (/^(https?:|mailto:|tel:)/i.test(href)) out.setAttribute('href', href); }
  if (tag === 'IMG') { const src = el.getAttribute('src') || ''; if (!/^data:image\/|^https:/i.test(src)) return null; out.setAttribute('src', src); out.setAttribute('style', 'max-width:100%;height:auto;'); return out; }
  if (tag === 'TABLE') { out.setAttribute('style', `border-collapse:collapse;width:100%;${style}`); }
  if (tag === 'TD' || tag === 'TH') {
    for (const a of ['colspan', 'rowspan']) { const v = el.getAttribute(a); if (v) out.setAttribute(a, v); }
    if (!/border/.test(style)) out.setAttribute('style', `border:1px solid #d0d0d0;padding:4px 6px;${style}`);
  }
  if (tag === 'OL') { const start = el.getAttribute('start'); const type = el.getAttribute('type'); if (start) out.setAttribute('start', start); if (type) out.setAttribute('type', type); }
  out.appendChild(kids());
  return out;
}

/** Word's list paragraphs (p.MsoListParagraph…) into real nested lists, container by container. */
function rebuildWordLists(root: HTMLElement, doc: Document) {
  for (const box of [root, ...Array.from(root.querySelectorAll('div'))]) {
    let stack: HTMLElement[] = [];
    for (const el of Array.from(box.children) as HTMLElement[]) {
      const info = el.tagName === 'P' ? wordListInfo(el) : null;
      if (!info) { stack = []; continue; }
      const make = () => doc.createElement(info.ordered ? 'ol' : 'ul');
      if (!stack.length) { const list = make(); el.before(list); stack = [list]; }
      while (stack.length < info.level) {
        const top = stack[stack.length - 1];
        const list = make();
        ((top.lastElementChild as HTMLElement | null) || top).appendChild(list);
        stack.push(list);
      }
      while (stack.length > info.level) stack.pop();
      const li = doc.createElement('li');
      while (el.firstChild) li.appendChild(el.firstChild);
      stack[stack.length - 1].appendChild(li);
      el.remove();
    }
  }
}

/** Pasted HTML (from Word, Google Docs or a web page) as clean, lasting HTML. */
export function cleanPastedHtml(html: string): string {
  const src = String(html || '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?o:p>/gi, '');
  const parsed = new DOMParser().parseFromString(src, 'text/html');
  const body = parsed.body;
  rebuildWordLists(body, parsed);
  const out = document.implementation.createHTMLDocument('');
  const holder = out.createElement('div');
  body.childNodes.forEach((n) => { const c = cleanNode(n, out); if (c) holder.appendChild(c); });
  // Drop empty spans and Word's &nbsp;-only paragraphs that only add space.
  holder.querySelectorAll('span:empty').forEach((s) => s.remove());
  return holder.innerHTML.replace(/\u00a0/g, '&nbsp;').trim();
}

/** Plain text as paragraphs (a blank line between them), for a paste with no HTML. */
export function textToParagraphs(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
}
