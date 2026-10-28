import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { CardScan } from '../data/businessCard';

/** One side of the card: take or pick a photo, with a preview. */
function Side({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!file) { setUrl(''); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <label style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', aspectRatio: '1.75', borderRadius: 10, cursor: 'pointer', overflow: 'hidden', position: 'relative',
      border: '1px dashed rgba(var(--rgb-forest), 0.35)', background: url ? `center / cover no-repeat url("${url}")` : 'var(--surface)' }}>
      {/* capture: on a phone this opens the camera straight away. */}
      <input type="file" accept="image/*" capture="environment" aria-label={`Card ${label.toLowerCase()}`} style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0] || null)} />
      {!url && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', textAlign: 'center', padding: 6 }}>+ {label}<br /><span style={{ fontWeight: 500, color: 'var(--muted)' }}>photo of the card</span></span>}
      {url && <span onClick={(e) => { e.preventDefault(); onFile(null); }} title="Remove" style={{ position: 'absolute', top: 4, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 999, width: 20, height: 20, display: 'grid', placeItems: 'center', fontSize: 13 }}>×</span>}
    </label>
  );
}

/**
 * People -> Add / Edit: photograph a business card (front and back), Origami
 * reads it and fills in the empty fields to review. The photos are kept with
 * the contact when it saves.
 */
export function BusinessCardScan({ onRead, compact }: { onRead: (scan: CardScan) => void; compact?: boolean }) {
  const { toast } = useApp();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const read = async () => {
    if (!front && !back) return;
    setBusy(true);
    try {
      const scan = await api.people.scanCard(front, back);
      setText(scan.text || '');
      onRead(scan);
      if (scan.readError) toast('⚠ The photos are saved, but the card could not be read — fill the details in by hand.');
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not read the card')); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--r-12)', background: 'var(--mist)', border: '1px solid var(--c-b9cdbd)', display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Business card{!compact && <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}> — snap the front (and back) and Origami fills in the details for you to check</span>}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Side label="Front" file={front} onFile={setFront} />
        <Side label="Back" file={back} onFile={setBack} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || (!front && !back)} onClick={read}
          style={{ padding: '8px 16px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: busy || (!front && !back) ? 'default' : 'pointer', background: busy || (!front && !back) ? 'var(--c-9ab0a4)' : 'var(--forest)', color: '#fff' }}>
          {busy ? 'Reading the card…' : 'Read card & fill in'}
        </button>
        {text && <span onClick={() => setShowText((v) => !v)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>{showText ? 'Hide' : 'Show'} what was read</span>}
      </div>
      {showText && text && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11.5, color: 'var(--body)', background: 'var(--surface)', padding: 10, borderRadius: 8, fontFamily: 'inherit' }}>{text}</pre>}
    </div>
  );
}

/** The card photos on a contact: click to see full size, × to remove. */
export function BusinessCardPhotos({ personId, cards, canManage, onChanged }: {
  personId: number; cards?: { front?: unknown; back?: unknown } | null; canManage: boolean; onChanged: (p: any) => void;
}) {
  const { toast } = useApp();
  const sides = (['front', 'back'] as const).filter((s) => cards?.[s]);
  if (!sides.length) return null;
  const remove = async (side: 'front' | 'back') => {
    if (!window.confirm(`Remove the ${side} of the card?`)) return;
    try { onChanged(await api.people.removeCard(personId, side)); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not removed')); }
  };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {sides.map((s) => (
        <div key={s} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <a href={api.people.cardUrl(personId, s)} target="_blank" rel="noreferrer" title={`Card ${s} — open full size`}>
            <img src={api.people.cardUrl(personId, s, true)} alt={`Business card ${s}`} style={{ width: '100%', aspectRatio: '1.75', objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.1)', display: 'block' }} />
          </a>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3, textTransform: 'capitalize' }}>{s}{canManage && <span onClick={() => remove(s)} style={{ marginLeft: 8, color: '#8E2E0A', cursor: 'pointer', fontWeight: 700 }}>Remove</span>}</div>
        </div>
      ))}
    </div>
  );
}
