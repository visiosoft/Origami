import { useState } from 'react';
import {
  ADDRESS_KINDS, GENDERS, IDENTITY_FIELDS, LICENSE_DISCIPLINES, PERSON_CATEGORIES,
  addressNeed, blankLicense, expiryState, missingFields,
  type Address, type License, type PersonProfile,
} from '../data/personProfile';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};
const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#43514D' };

const Req = ({ need }: { need: 'R' | 'O' | '-' }) =>
  need === 'R' ? <span style={{ color: '#8E2E0A' }}> *</span> : null;

/** A section that can be folded away; the count of gaps stays visible. */
function Section({ title, hint, open, onToggle, gaps, children }: {
  title: string; hint?: string; open: boolean; onToggle: () => void; gaps?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, marginBottom: 10, background: 'white', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: open ? '#F7F9F7' : 'white' }}>
        <span style={{ fontSize: 9, color: '#9AA39D', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', flex: 1 }}>{title}</span>
        {!!gaps && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#F7E4DB', color: '#8E2E0A' }}>{gaps} missing</span>
        )}
      </div>
      {open && (
        <div style={{ padding: '4px 12px 14px' }}>
          {hint && <div style={{ fontSize: 10.5, color: '#9AA39D', marginBottom: 9, lineHeight: 1.45 }}>{hint}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address, v: string | boolean) => onChange({ ...value, [k]: v } as Address);
  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#5c5666', cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={value.notApplicable} onChange={(e) => set('notApplicable', e.target.checked)} />
        Not applicable
      </label>
      {!value.notApplicable && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Street</label>
            <input value={value.street} onChange={(e) => set('street', e.target.value)} placeholder="Number and street" style={{ ...input, marginTop: 3 }} />
          </div>
          <div><label style={label}>Unit / Suite</label><input value={value.unit} onChange={(e) => set('unit', e.target.value)} style={{ ...input, marginTop: 3 }} /></div>
          <div><label style={label}>City</label><input value={value.city} onChange={(e) => set('city', e.target.value)} style={{ ...input, marginTop: 3 }} /></div>
          <div><label style={label}>State</label><input value={value.state} onChange={(e) => set('state', e.target.value)} placeholder="CA" style={{ ...input, marginTop: 3 }} /></div>
          <div><label style={label}>ZIP</label><input value={value.zip} onChange={(e) => set('zip', e.target.value)} style={{ ...input, marginTop: 3 }} /></div>
          <div><label style={label}>County</label><input value={value.county} onChange={(e) => set('county', e.target.value)} style={{ ...input, marginTop: 3 }} /></div>
        </div>
      )}
    </>
  );
}

interface Props {
  profile: PersonProfile;
  onChange: (profile: PersonProfile) => void;
}

/**
 * The full person record.
 *
 * Sections fold away, and which of them apply follows the categories chosen at
 * the top — a record is only asked for what its categories actually need.
 */
export function PersonProfileEditor({ profile, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ identity: true, categories: true });
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const set = <K extends keyof PersonProfile>(k: K, v: PersonProfile[K]) => onChange({ ...profile, [k]: v });

  const cats = profile.categories;
  const gaps = missingFields(profile);
  const gapsFor = (...needles: string[]) =>
    gaps.filter((g) => needles.some((nd) => g.toLowerCase().includes(nd.toLowerCase()))).length;

  const toggleCategory = (c: string) =>
    set('categories', cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]);

  const setLicense = (id: string, patch: Partial<License>) =>
    set('licenses', profile.licenses.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div>
      {/* What this record is, which decides what the rest of the form asks for. */}
      <Section title="Directories" open={!!open.categories} onToggle={() => toggle('categories')}
        hint="Which directories this person belongs to. Someone on staff who also runs a consultancy is both — tick every one that applies, and the form asks for what those need.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PERSON_CATEGORIES.map((c) => {
            const on = cats.includes(c);
            return (
              <span key={c} onClick={() => toggleCategory(c)} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.12)'),
                background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#5c5666',
              }}>{c}</span>
            );
          })}
        </div>
        {cats.length === 0 && (
          <div style={{ fontSize: 11, color: '#8E2E0A', marginTop: 8 }}>Pick at least one — nothing below applies until you do.</div>
        )}
      </Section>

      <Section title="Identity" open={!!open.identity} onToggle={() => toggle('identity')}
        gaps={gapsFor('name', 'Male / Female')}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {IDENTITY_FIELDS.map((f) => (
            <div key={f.key}>
              <label style={label}>{f.label}<Req need={f.need} /></label>
              <input value={String(profile[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value as never)} placeholder={f.ph} style={{ ...input, marginTop: 3 }} />
            </div>
          ))}
          <div>
            <label style={label}>Male / Female / Unknown<Req need="R" /></label>
            <select value={profile.gender} onChange={(e) => set('gender', e.target.value)} style={{ ...input, marginTop: 3 }}>
              <option value="">Select…</option>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Web & Social" open={!!open.web} onToggle={() => toggle('web')}
        hint="All optional.">
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {([
            ['businessWebsite', 'Business Website'],
            ['personalWebsite', 'Personal Website'],
            ['socialMedia', 'Social Media'],
          ] as const).map(([key, text]) => (
            <div key={key}>
              <label style={label}>{text}</label>
              <input value={profile.contactInfo[key]} onChange={(e) => set('contactInfo', { ...profile.contactInfo, [key]: e.target.value })} placeholder="https://" style={{ ...input, marginTop: 3 }} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Business Contact" open={!!open.contact} onToggle={() => toggle('contact')}
        gaps={gapsFor('Business phone')}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#5c5666', cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={profile.contactInfo.businessNotApplicable}
            onChange={(e) => set('contactInfo', { ...profile.contactInfo, businessNotApplicable: e.target.checked })} />
          Not applicable
        </label>
        {!profile.contactInfo.businessNotApplicable && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div>
              <label style={label}>Business Phone<Req need="R" /></label>
              <input value={profile.contactInfo.businessPhone} onChange={(e) => set('contactInfo', { ...profile.contactInfo, businessPhone: e.target.value })} placeholder="(555) 123-4567" style={{ ...input, marginTop: 3 }} />
            </div>
            <div>
              <label style={label}>Business Email<Req need="R" /></label>
              <input value={profile.contactInfo.businessEmail} onChange={(e) => set('contactInfo', { ...profile.contactInfo, businessEmail: e.target.value })} placeholder="name@company.com" style={{ ...input, marginTop: 3 }} />
            </div>
          </div>
        )}
      </Section>

      {ADDRESS_KINDS.map((a) => {
        const need = addressNeed(a.key, cats.length ? cats : ['Internal']);
        return (
          <Section key={a.key} title={a.label} hint={a.hint} open={!!open[a.key]} onToggle={() => toggle(a.key)}
            gaps={gapsFor(a.label)}>
            <div style={{ fontSize: 10.5, color: need === 'R' ? '#8E2E0A' : '#9AA39D', marginBottom: 8, fontWeight: 600 }}>
              {need === 'R' ? 'Required' : 'Optional'} for the directories selected
            </div>
            <AddressFields value={profile.addresses[a.key]} onChange={(v) => set('addresses', { ...profile.addresses, [a.key]: v })} />
          </Section>
        );
      })}

      <Section title="Licences" open={!!open.licenses} onToggle={() => toggle('licenses')}
        gaps={gapsFor('licence', 'number', 'expiry', 'state')}
        hint="One row per licence. Somebody holding the same licence in three states is three rows.">
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#0B1A12', cursor: 'pointer', marginBottom: 10, fontWeight: 600 }}>
          <input type="checkbox" checked={profile.notLicensedDesigner} onChange={(e) => set('notLicensedDesigner', e.target.checked)} />
          Not Licensed Designer
        </label>
        {profile.notLicensedDesigner && (
          <div style={{ fontSize: 11, color: '#93520F', background: '#FBE9AE', padding: '8px 10px', borderRadius: 8, marginBottom: 10, lineHeight: 1.45 }}>
            May design residential work, but not commercial. No licence is required of this person.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profile.licenses.map((l, i) => {
            const exp = expiryState(l.expiresOn);
            return (
              <div key={l.id} style={{ border: '1px solid rgba(20,8,31,0.09)', borderRadius: 9, padding: 10, background: '#FBFAF8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93' }}>Licence {i + 1}</span>
                  {exp && exp !== 'ok' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: exp === 'expired' ? '#F2DFD4' : '#FBE9AE', color: exp === 'expired' ? '#8E2E0A' : '#93520F' }}>
                      {exp === 'expired' ? 'Expired' : 'Expiring soon'}
                    </span>
                  )}
                  <span onClick={() => set('licenses', profile.licenses.filter((x) => x.id !== l.id))}
                    style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Remove</span>
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  <div>
                    <label style={label}>Discipline<Req need="R" /></label>
                    <select value={l.discipline} onChange={(e) => setLicense(l.id, { discipline: e.target.value })} style={{ ...input, marginTop: 3 }}>
                      {LICENSE_DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div><label style={label}>Number<Req need="R" /></label><input value={l.number} onChange={(e) => setLicense(l.id, { number: e.target.value })} style={{ ...input, marginTop: 3 }} /></div>
                  <div><label style={label}>Type</label><input value={l.licenseType} onChange={(e) => setLicense(l.id, { licenseType: e.target.value })} placeholder="e.g. Class B" style={{ ...input, marginTop: 3 }} /></div>
                  <div><label style={label}>State of Licensure<Req need="R" /></label><input value={l.state} onChange={(e) => setLicense(l.id, { state: e.target.value })} placeholder="CA" style={{ ...input, marginTop: 3 }} /></div>
                  <div><label style={label}>Expires<Req need="R" /></label><input type="date" value={l.expiresOn} onChange={(e) => setLicense(l.id, { expiresOn: e.target.value })} style={{ ...input, marginTop: 3 }} /></div>
                </div>
              </div>
            );
          })}
        </div>

        <div onClick={() => set('licenses', [...profile.licenses, blankLicense()])}
          style={{ marginTop: 10, display: 'inline-block', padding: '7px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326' }}>
          + Add a licence
        </div>
      </Section>

      <Section title="Insurance" open={!!open.insurance} onToggle={() => toggle('insurance')}
        gaps={gapsFor('General Liability', 'Workers Comp')}>
        {([['generalLiability', 'General Liability'], ['workersComp', 'Workers Comp']] as const).map(([key, text]) => {
          const v = profile.insurance[key];
          const exp = expiryState(v.expiresOn);
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1A12' }}>{text}<Req need="R" /></span>
                {exp && exp !== 'ok' && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: exp === 'expired' ? '#F2DFD4' : '#FBE9AE', color: exp === 'expired' ? '#8E2E0A' : '#93520F' }}>
                    {exp === 'expired' ? 'Expired' : 'Expiring soon'}
                  </span>
                )}
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5c5666', cursor: 'pointer' }}>
                  <input type="checkbox" checked={v.notApplicable} onChange={(e) => set('insurance', { ...profile.insurance, [key]: { ...v, notApplicable: e.target.checked } })} />
                  N/A
                </label>
              </div>
              {!v.notApplicable && (
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  <div><label style={label}>Carrier</label><input value={v.carrier} onChange={(e) => set('insurance', { ...profile.insurance, [key]: { ...v, carrier: e.target.value } })} style={{ ...input, marginTop: 3 }} /></div>
                  <div><label style={label}>Policy number</label><input value={v.policy} onChange={(e) => set('insurance', { ...profile.insurance, [key]: { ...v, policy: e.target.value } })} style={{ ...input, marginTop: 3 }} /></div>
                  <div><label style={label}>Expires<Req need="R" /></label><input type="date" value={v.expiresOn} onChange={(e) => set('insurance', { ...profile.insurance, [key]: { ...v, expiresOn: e.target.value } })} style={{ ...input, marginTop: 3 }} /></div>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* What is still outstanding, so a half-filled record says so. */}
      <div style={{ padding: '10px 12px', borderRadius: 9, background: gaps.length ? '#F7E4DB' : '#D2EAD3', border: '1px solid ' + (gaps.length ? 'rgba(142,46,10,0.18)' : 'rgba(47,125,74,0.2)') }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: gaps.length ? '#8E2E0A' : '#1C5230' }}>
          {gaps.length ? `${gaps.length} required field${gaps.length === 1 ? '' : 's'} outstanding` : 'Record complete'}
        </div>
        {gaps.length > 0 && (
          <div style={{ fontSize: 11, color: '#8E2E0A', marginTop: 4, lineHeight: 1.5 }}>{gaps.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}
