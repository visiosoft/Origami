import { useEffect, useRef } from 'react';

/**
 * Sign with a finger or the mouse. Hands back a PNG data URL when a stroke
 * ends, or '' when cleared. A saved signature is shown as an image.
 */
export function SignaturePad({ value, onChange, disabled }: { value: string; onChange: (dataUrl: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drew = useRef(false);

  // Size the canvas for the screen's pixel density, and paint any saved signature.
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * ratio; c.height = h * ratio;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1D1D1B';
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = value; }
    // Only on mount / when a different saved signature arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext('2d'); if (!ctx) return;
    drawing.current = true; drew.current = true;
    const [x, y] = point(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d'); if (!ctx) return;
    const [x, y] = point(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (drew.current && ref.current) onChange(ref.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current; if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    drew.current = false;
    onChange('');
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Signature — draw with your finger or mouse"
        style={{ width: '100%', height: 140, borderRadius: 'var(--r-12)', border: '1.5px dashed rgba(var(--rgb-shade), .25)', background: 'var(--surface)', touchAction: 'none', cursor: disabled ? 'default' : 'crosshair' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
        <span style={{ flex: 1 }}>{disabled ? 'Signed' : value ? 'Signed — clear to sign again' : 'Sign above with your finger or mouse'}</span>
        {!disabled && value && <button type="button" onClick={clear} style={{ border: 0, background: 'none', color: '#8E2E0A', fontWeight: 700, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Clear</button>}
      </div>
    </div>
  );
}
