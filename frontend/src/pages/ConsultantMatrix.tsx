import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };

export interface Consultant {
  id: string;
  type: string;
  firm: string;
  address?: string;
  contact?: string;
  phone?: string;
  email?: string;
  rfpSent?: boolean;
  bidInterest?: boolean;
  proposalAmount?: string;
  signedContract?: boolean;
}

const BLANK: Consultant = { id: '', type: '', firm: '', address: '', contact: '', phone: '', email: '', rfpSent: false, bidInterest: false, proposalAmount: '', signedContract: false };

export function ConsultantMatrix() {
  const { can, toast } = useApp();
  const canManage = can('prequal', 'manage');
  const [rows, setRows] = useState<Consultant[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Consultant | null>(null);

  const reload = () => { api.consultants.list().then((r) => { if (Array.isArray(r)) setRows(r as Consultant[]); }).catch(() => { }); };
  useEffect(() => { reload(); }, []);

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = typeFilter ? rows.filter((r) => r.type === typeFilter) : rows;
    filtered = q
      ? filtered.filter((r) => [r.type, r.firm, r.contact, r.phone, r.email, r.address].some((v) => (v || '').toLowerCase().includes(q)))
      : filtered;
    const byType = new Map<string, Consultant[]>();
    for (const r of filtered) {
      if (!byType.has(r.type)) byType.set(r.type, []);
      byType.get(r.type)!.push(r);
    }
    return Array.from(byType.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, query, typeFilter]);

  const addNew = (type?: string) => setEditing({ ...BLANK, id: '', type: type || '' });

  const save = () => {
    if (!editing) return;
    if (!editing.type.trim() || !editing.firm.trim()) { toast('Add a trade/type and a firm name'); return; }
    const op = editing.id ? api.consultants.update(editing.id, editing) : api.consultants.create(editing);
    op.then(() => { toast('Consultant saved'); setEditing(null); reload(); }).catch(() => toast('⚠ Failed to save'));
  };

  const remove = (c: Consultant) => {
    if (!confirm(`Remove ${c.firm} from ${c.type}?`)) return;
    setRows((prev) => prev.filter((x) => x.id !== c.id));
    api.consultants.remove(c.id).catch(() => { });
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12' }}>Consultant & Sub Prequalifying</div>
          <div style={{ fontSize: 13, color: '#5C6B65' }}>The company's directory of prequalified consultants and subs, grouped by trade.</div>
        </div>
        {canManage && (
          <div onClick={() => addNew()} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add consultant</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 18px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by trade, firm, contact, phone or email…"
          style={{ ...inputStyle, maxWidth: 380 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', maxWidth: 240 }}
        >
          <option value="">All trades ({types.length})</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {typeFilter && <span onClick={() => setTypeFilter('')} style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Clear</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {grouped.map(([type, list]) => (
          <div key={type} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F4F6F4', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>{type} <span style={{ color: '#7E9B93', fontWeight: 500 }}>({list.length})</span></div>
              {canManage && <span onClick={() => addNew(type)} style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>+ Add to {type}</span>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {['Firm', 'Contact', 'Phone', 'Email', 'Address', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #EDEFEC', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', fontWeight: 600, color: '#0B1A12', whiteSpace: 'nowrap' }}>{c.firm}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', whiteSpace: 'pre-line' }}>{c.contact || '—'}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', whiteSpace: 'pre-line' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', whiteSpace: 'pre-line' }}>{c.email || '—'}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', whiteSpace: 'pre-line', color: '#5C6B65' }}>{c.address || '—'}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid #EDEFEC', whiteSpace: 'nowrap' }}>
                        {canManage && (
                          <>
                            <span onClick={() => setEditing(c)} style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', marginRight: 10 }}>Edit</span>
                            <span onClick={() => remove(c)} style={{ fontSize: 11.5, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Delete</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {grouped.length === 0 && <div style={{ fontSize: 12.5, color: '#9AA39D', fontStyle: 'italic' }}>No consultants match that search.</div>}
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 140, display: 'grid', placeItems: 'center', animation: 'fadeIn 0.15s ease', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 16, boxShadow: '0 24px 60px rgba(20,8,31,0.24)', padding: 22 }}>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{editing.id ? 'Edit consultant' : 'New consultant'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <L>Trade / type</L>
                <input value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} list="consultant-types" style={inputStyle} />
                <datalist id="consultant-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div><L>Firm</L><input value={editing.firm} onChange={(e) => setEditing({ ...editing, firm: e.target.value })} style={inputStyle} /></div>
              <div><L>Contact</L><input value={editing.contact || ''} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} style={inputStyle} /></div>
              <div><L>Phone</L><input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} style={inputStyle} /></div>
              <div><L>Email</L><input value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} style={inputStyle} /></div>
              <div><L>Proposal amount</L><input value={editing.proposalAmount || ''} onChange={(e) => setEditing({ ...editing, proposalAmount: e.target.value })} style={inputStyle} /></div>
              <div style={{ gridColumn: '1 / -1' }}><L>Address</L><textarea value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
              {([['rfpSent', 'RFP sent'], ['bidInterest', 'Bid interest received'], ['signedContract', 'Signed contract']] as const).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#43514D', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!editing[key]} onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
              <div onClick={save} style={{ padding: '10px 20px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</div>
              <div onClick={() => setEditing(null)} style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#43514D' }}>Cancel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>;
}
