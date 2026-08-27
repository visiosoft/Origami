import { useState } from 'react';
import { api } from '../api';
import { LEAD_DROPDOWN_OPTIONS as OPT } from '../data/leads';
import {
  CONTACT_ROLES, blankContact, contactName, holdersOf, missingRoles, roleLabel,
  toggleRole, type LeadContact,
} from '../data/leadContacts';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#43514D' };

interface Props {
  leadId: string;
  contacts: LeadContact[];
  onChange: (contacts: LeadContact[]) => void;
  /** Needed because leads are saved through a PUT that revalidates the whole row. */
  leadName: string;
  phone: string;
}

/**
 * Everyone involved in a lead, and what each of them is.
 *
 * Roles are per contact rather than per record because one person routinely
 * holds several — a lead is often both the primary contact and the decision
 * maker.
 */
export function ContactsDirectory({ leadId, contacts, onChange, leadName, phone }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const missing = missingRoles(contacts);

  const update = (id: string, patch: Partial<LeadContact>) => {
    onChange(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSaved(false);
  };

  const add = () => {
    const contact = blankContact();
    onChange([...contacts, contact]);
    setOpenId(contact.id);
    setSaved(false);
  };

  const remove = (id: string) => {
    onChange(contacts.filter((c) => c.id !== id));
    if (openId === id) setOpenId(null);
    setSaved(false);
  };

  const save = () => {
    setSaving(true);
    setError('');
    // leadName and phone are required by the update DTO, so they ride along.
    api.leads.update(leadId, { leadName, phone, contacts } as any)
      .then(() => setSaved(true))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const field = (c: LeadContact, key: keyof LeadContact, text: string, ph = '') => (
    <div>
      <label style={label}>{text}</label>
      <input value={String(c[key] ?? '')} onChange={(e) => update(c.id, { [key]: e.target.value } as Partial<LeadContact>)} placeholder={ph} style={{ ...input, marginTop: 3 }} />
    </div>
  );

  return (
    <div style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#173326', marginBottom: 4 }}>
        Contacts
      </div>
      <div style={{ fontSize: 11.5, color: '#7E9B93', marginBottom: 12, lineHeight: 1.5 }}>
        Everyone involved, and what each of them is. One person can hold several roles — a lead is often both the
        primary contact and the decision maker.
      </div>

      {/* What still has to be filled before the lead is complete. */}
      <div style={{ padding: '10px 12px', borderRadius: 9, marginBottom: 14, background: missing.length ? '#F7E4DB' : '#D2EAD3', border: '1px solid ' + (missing.length ? 'rgba(142,46,10,0.18)' : 'rgba(47,125,74,0.2)') }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: missing.length ? '#8E2E0A' : '#1C5230' }}>
          {missing.length ? `${missing.length} required role${missing.length === 1 ? '' : 's'} unassigned` : 'All required roles assigned'}
        </div>
        {missing.length > 0 && (
          <div style={{ fontSize: 11, color: '#8E2E0A', marginTop: 4, lineHeight: 1.5 }}>
            {missing.map((r) => r.label).join(' · ')}
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 9, background: '#F7E4DB', fontSize: 12, fontWeight: 600, color: '#8E2E0A', marginBottom: 12 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contacts.length === 0 && (
          <div style={{ padding: '18px 14px', textAlign: 'center', fontSize: 12, color: '#9AA39D', background: '#FBF8F2', borderRadius: 9 }}>
            No contacts yet. Add the people involved in this project.
          </div>
        )}

        {contacts.map((c) => {
          const open = openId === c.id;
          return (
            <div key={c.id} style={{ border: '1px solid rgba(20,8,31,0.09)', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
              <div
                onClick={() => setOpenId(open ? null : c.id)}
                style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: open ? '#F4F9F4' : 'white' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1A12' }}>{contactName(c)}</div>
                  <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 2 }}>
                    {[c.title, c.company].filter(Boolean).join(' · ') || 'No title or company'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '46%' }}>
                  {c.roles.map((code) => (
                    <span key={code} title={roleLabel(code)} style={{ padding: '2px 6px', borderRadius: 5, fontSize: 9.5, fontWeight: 700, background: '#DCE7DE', color: '#173326' }}>{code}</span>
                  ))}
                </div>
                <span style={{ fontSize: 9, color: '#9AA39D', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
              </div>

              {open && (
                <div style={{ padding: '12px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                    {field(c, 'firstName', 'First Name', 'First name')}
                    {field(c, 'lastName', 'Last Name', 'Last name')}
                    {field(c, 'goByName', 'Go-By Name', 'Preferred name')}
                    <div>
                      <label style={label}>Pronouns</label>
                      <select value={c.pronouns} onChange={(e) => update(c.id, { pronouns: e.target.value })} style={{ ...input, marginTop: 3 }}>
                        <option value="">Select…</option>
                        {OPT.pronouns.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    {field(c, 'title', 'Title / Relationship', 'e.g. Owner’s Rep')}
                    {field(c, 'company', 'Company', 'Company')}
                    {field(c, 'phone', 'Phone', '(555) 123-4567')}
                    {field(c, 'email', 'Email', 'email@example.com')}
                    <div>
                      <label style={label}>Preferred Contact Method</label>
                      <select value={c.preferredContactMethod} onChange={(e) => update(c.id, { preferredContactMethod: e.target.value })} style={{ ...input, marginTop: 3 }}>
                        <option value="">Select…</option>
                        {OPT.preferredContactMethod.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Client Personality</label>
                      <select value={c.clientPersonality} onChange={(e) => update(c.id, { clientPersonality: e.target.value })} style={{ ...input, marginTop: 3 }}>
                        <option value="">Select…</option>
                        {OPT.clientPersonality.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={label}>Roles</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                      {CONTACT_ROLES.map((role) => {
                        const on = c.roles.includes(role.code);
                        // A single-holder role already sitting with someone else.
                        const heldElsewhere = role.single && !on && holdersOf(contacts, role.code).length > 0;
                        return (
                          <div
                            key={role.code}
                            onClick={() => { onChange(toggleRole(contacts, c.id, role.code)); setSaved(false); }}
                            title={heldElsewhere
                              ? `Currently ${holdersOf(contacts, role.code).map(contactName).join(', ')} — assigning moves it`
                              : role.hint || role.label}
                            style={{
                              padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', userSelect: 'none',
                              border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.1)'),
                              background: on ? '#D2EAD3' : 'white',
                              color: on ? '#173326' : heldElsewhere ? '#9AA39D' : '#0B1A12',
                              fontWeight: on ? 700 : 400,
                            }}
                          >
                            <b style={{ fontWeight: 700 }}>{role.code}</b> {role.label}
                            {role.required && !on && <span style={{ color: '#8E2E0A' }}> *</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: '#9AA39D', marginTop: 5, lineHeight: 1.5 }}>
                      Roles marked <b>*</b> are required somewhere on the lead. Primary Contact, Secondary Contact,
                      Owner’s Rep, both Contract Authorities and the Approver each sit with one person — assigning
                      one moves it off whoever held it.
                    </div>
                  </div>

                  <div>
                    <label style={label}>Notes</label>
                    <textarea value={c.notes} onChange={(e) => update(c.id, { notes: e.target.value })} rows={2} style={{ ...input, marginTop: 3, resize: 'vertical' }} />
                  </div>

                  <div onClick={() => remove(c.id)} style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>
                    Remove contact
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
        <div onClick={add} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326' }}>
          + Add contact
        </div>
        <div onClick={saving ? undefined : save} style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
          {saving ? 'Saving…' : 'Save contacts'}
        </div>
        {saved && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2F7D4A' }}>Saved</span>}
      </div>
    </div>
  );
}
