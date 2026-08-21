import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

const card: React.CSSProperties = {
  background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 18, marginBottom: 16,
};

/** Every branding value, all stored as plain settings. */
type Brand = Record<
  | 'brand.companyName' | 'brand.tagline' | 'brand.logoDataUrl' | 'brand.accentColor'
  | 'brand.address' | 'brand.phone' | 'brand.email' | 'brand.website' | 'brand.footerNote'
  | 'brand.signatureName' | 'brand.signatureTitle' | 'brand.signatureDataUrl',
  string
>;

const EMPTY: Brand = {
  'brand.companyName': '', 'brand.tagline': '', 'brand.logoDataUrl': '', 'brand.accentColor': '#173326',
  'brand.address': '', 'brand.phone': '', 'brand.email': '', 'brand.website': '', 'brand.footerNote': '',
  'brand.signatureName': '', 'brand.signatureTitle': '', 'brand.signatureDataUrl': '',
};

/** Images are held inline so a generated document needs nothing external. */
const MAX_IMAGE_BYTES = 400 * 1024;

/**
 * Settings → Branding. The letterhead, footer and signature block applied to
 * documents the platform generates, such as the Introduction Letter PDF.
 */
export function BrandingSettings() {
  const { toast } = useApp();
  const [form, setForm] = useState<Brand>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings.get()
      .then((s) => setForm({ ...EMPTY, ...(s as Partial<Brand>) }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Brand, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const readImage = (file: File | undefined, key: keyof Brand) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('That needs to be an image file.'); return; }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`${file.name} is larger than ${MAX_IMAGE_BYTES / 1024} KB — use a smaller image so documents stay light.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { set(key, String(reader.result || '')); setError(''); };
    reader.readAsDataURL(file);
  };

  const save = () => {
    setSaving(true);
    setError('');
    api.settings.save(form)
      .then((s) => { setForm({ ...EMPTY, ...(s as Partial<Brand>) }); toast('Branding saved'); })
      .catch((e: Error) => { setError(e.message); toast('⚠ Failed to save branding'); })
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const accent = form['brand.accentColor'] || '#173326';

  const imageField = (label: string, key: keyof Brand, hint: string, height: number) => (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <div style={{ width: 130, height, borderRadius: 8, border: '1px dashed rgba(20,8,31,0.14)', background: '#FBF8F2', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {form[key]
            ? <img src={form[key]} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 10, color: '#9AA39D' }}>None</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#EEF3EE', color: '#173326', display: 'inline-block' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }}
                   onChange={(e) => { readImage(e.target.files?.[0], key); e.currentTarget.value = ''; }} />
            {form[key] ? 'Replace' : 'Upload'}
          </label>
          {form[key] && (
            <div onClick={() => set(key, '')} style={{ fontSize: 11.5, fontWeight: 600, color: '#8E2E0A', cursor: 'pointer', textAlign: 'center' }}>Remove</div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 6, lineHeight: 1.45 }}>{hint}</div>
    </div>
  );

  const field = (label: string, key: keyof Brand, placeholder = '', hint = '') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>{label}</label>
      <input style={inputStyle} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
      {hint && <span style={{ fontSize: 11, color: '#7E9B93' }}>{hint}</span>}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Branding</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          The letterhead, footer and signature applied to documents the platform generates — starting with the
          Introduction Letter PDF. Images are stored inline so a document never depends on an external file.
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', lineHeight: 1.55 }}>{error}</span>
        </div>
      )}

      <div style={card}>
        <SectionTitle>Letterhead</SectionTitle>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 14 }}>
          {field('Company name', 'brand.companyName', 'Origami Design + Build')}
          {field('Tagline', 'brand.tagline', 'Design + Build', 'Sits under the company name')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>Accent colour</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={accent} onChange={(e) => set('brand.accentColor', e.target.value)}
                     style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white' }} />
              <input style={inputStyle} value={accent} onChange={(e) => set('brand.accentColor', e.target.value)} />
            </div>
          </div>
        </div>
        {imageField('Logo', 'brand.logoDataUrl', 'Shown top-left on generated documents. PNG with a transparent background works best. Max 400 KB.', 62)}
      </div>

      <div style={card}>
        <SectionTitle>Footer</SectionTitle>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {field('Address', 'brand.address', '1390 California St, San Francisco, CA')}
          {field('Phone', 'brand.phone', '(415) 555 0100')}
          {field('Email', 'brand.email', 'hello@origamidb.com')}
          {field('Website', 'brand.website', 'origamidb.com')}
          {field('Footer note', 'brand.footerNote', 'Licence #123456', 'A last line — licence number, registration, anything standing')}
        </div>
      </div>

      <div style={card}>
        <SectionTitle>Signature</SectionTitle>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 14 }}>
          {field('Name', 'brand.signatureName', 'Edward M.')}
          {field('Title', 'brand.signatureTitle', 'Principal')}
        </div>
        {imageField('Signature image', 'brand.signatureDataUrl', 'A scanned or drawn signature, placed above the name. Max 400 KB.', 54)}
      </div>

      {/* What the letterhead will look like on a document. */}
      <div style={card}>
        <SectionTitle>Preview</SectionTitle>
        <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
          <div style={{ padding: '18px 22px', borderBottom: `3px solid ${accent}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            {form['brand.logoDataUrl'] && <img src={form['brand.logoDataUrl']} alt="" style={{ maxHeight: 42, maxWidth: 150, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, color: '#0B1A12' }}>{form['brand.companyName'] || 'Company name'}</div>
              {form['brand.tagline'] && <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 2 }}>{form['brand.tagline']}</div>}
            </div>
          </div>
          <div style={{ padding: '20px 22px', fontSize: 12.5, color: '#43514D', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>The body of the letter appears here.</p>
            <div style={{ marginTop: 22 }}>
              {form['brand.signatureDataUrl'] && <img src={form['brand.signatureDataUrl']} alt="" style={{ maxHeight: 42, marginBottom: 4, display: 'block' }} />}
              <div style={{ fontWeight: 700, color: '#0B1A12' }}>{form['brand.signatureName'] || 'Signature name'}</div>
              <div style={{ fontSize: 11.5, color: '#7E9B93' }}>{form['brand.signatureTitle'] || 'Title'}</div>
            </div>
          </div>
          <div style={{ padding: '11px 22px', borderTop: '1px solid rgba(20,8,31,0.08)', background: '#FBF8F2', fontSize: 10.5, color: '#7E9B93', lineHeight: 1.6 }}>
            {[form['brand.address'], form['brand.phone'], form['brand.email'], form['brand.website']].filter(Boolean).join('  ·  ') || 'Address · Phone · Email · Website'}
            {form['brand.footerNote'] && <div>{form['brand.footerNote']}</div>}
          </div>
        </div>
      </div>

      <div onClick={saving ? undefined : save}
           style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
        {saving ? 'Saving…' : 'Save branding'}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', marginBottom: 14 }}>{children}</div>;
}
