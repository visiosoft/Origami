import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Doc = { numPages: number; getPage: (n: number) => Promise<any> };

/** Thumbnails already drawn, per open document. */
const drawn = new WeakMap<Doc, Map<number, string>>();
const THUMB_W = 168;

/** A small picture of one page, drawn from the open drawing (no download). */
async function thumbOf(doc: Doc, n: number): Promise<string> {
  let m = drawn.get(doc);
  if (!m) { m = new Map(); drawn.set(doc, m); }
  const hit = m.get(n);
  if (hit) return hit;
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: THUMB_W / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const url = canvas.toDataURL('image/jpeg', 0.72);
  m.set(n, url);
  return url;
}

function Thumb({ doc, n }: { doc: Doc; n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(drawn.get(doc)?.get(n) || null);
  useEffect(() => {
    if (url || !ref.current) return;
    let live = true;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      io.disconnect();
      void thumbOf(doc, n).then((u) => { if (live) setUrl(u); }).catch(() => undefined);
    }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => { live = false; io.disconnect(); };
  }, [doc, n, url]);
  return <div ref={ref} className="mk-sp-img">{url ? <img src={url} alt="" /> : <span>{n}</span>}</div>;
}

/**
 * Pick a sheet by its picture (Nov 10 sync: names alone weren't enough to find
 * the right drawing). The button shows the current sheet; the list shows every
 * page as a small picture with its sheet name, drawn as it scrolls into view.
 */
export function SheetPicker({ doc, pages, page, label, onPick }: { doc: Doc; pages: number; page: number; label: (n: number) => string; onPick: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const cur = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) window.setTimeout(() => cur.current?.scrollIntoView({ block: 'center' }), 30); }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [open]);
  const list = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => !q.trim() || label(n).toLowerCase().includes(q.trim().toLowerCase()) || String(n) === q.trim());
  return (
    <>
      <button ref={btn} type="button" className="mk-sheet mk-sp-btn" aria-label="Sheet" aria-haspopup="dialog" onClick={() => setOpen((v) => !v)} title="Choose a sheet">
        <span>{label(page)}</span><span aria-hidden>▾</span>
      </button>
      {open && createPortal(
        <div className="mk-sp-bg" onClick={() => setOpen(false)}>
          <div className="mk-sp" role="dialog" aria-label="Sheets" onClick={(e) => e.stopPropagation()}>
            <div className="mk-sp-head">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a sheet (A-201, floor plan…)" aria-label="Find a sheet" />
              <button type="button" className="mk-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="mk-sp-grid">
              {list.map((n) => (
                <button key={n} ref={n === page ? cur : undefined} type="button" className={'mk-sp-card' + (n === page ? ' is-on' : '')} onClick={() => { onPick(n); setOpen(false); }}>
                  <Thumb doc={doc} n={n} />
                  <span className="mk-sp-name">{label(n)}</span>
                </button>
              ))}
              {!list.length && <div className="mk-muted" style={{ padding: 12 }}>No sheet matches.</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
