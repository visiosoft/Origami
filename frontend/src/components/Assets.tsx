import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import { ACCENT, BG, DANGER, INK, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, money, todayISO } from './manpowerUi';

interface AssetIssue {
  id: string; assetId: string; employeeId: string; issuedAt: string; expectedReturn?: string; status: 'open' | 'returned' | 'lost';
  returnedAt?: string; returnCondition?: string; chargeAmount?: number; notes?: string; issuedByName?: string; closedByName?: string;
}
interface Asset {
  id: string; assetTag: string; name: string; category: string; serialNumber?: string; status: string; condition?: string;
  purchaseDate?: string; cost?: number; notes?: string; currentIssue?: AssetIssue | null;
}

export const ASSET_CATEGORIES: [string, string][] = [
  ['laptop', 'Laptop'], ['mobile', 'Mobile phone'], ['sim', 'SIM card'], ['tools', 'Tools'], ['uniform', 'Uniform / PPE kit'],
  ['vehicle', 'Vehicle'], ['access_card', 'Access card'], ['tablet', 'Tablet'], ['other', 'Other'],
];
const CONDITIONS: [string, string][] = [['new', 'New'], ['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor'], ['damaged', 'Damaged']];
const STATUS: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'grey' }> = {
  available: { label: 'In stock', tone: 'green' }, issued: { label: 'Issued', tone: 'blue' }, in_repair: { label: 'In repair', tone: 'amber' },
  lost: { label: 'Lost', tone: 'red' }, retired: { label: 'Retired', tone: 'grey' },
};
const catLabel = (c: string) => ASSET_CATEGORIES.find(([k]) => k === c)?.[1] || c;
const condLabel = (c?: string) => CONDITIONS.find(([k]) => k === c)?.[1] || c || '—';
const overdue = (i?: AssetIssue | null) => !!i && i.status === 'open' && !!i.expectedReturn && i.expectedReturn < todayISO();
const activeStaff = (employees: Employee[]) => employees.filter((e) => !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active') && e.status !== 'inactive');

// ------------------------------------------------------------------ register

export function AssetRegister({ employees, canManage, currency, onOpenEmployee }: { employees: Employee[]; canManage: boolean; currency: string; onOpenEmployee: (id: string) => void }) {
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => api.assets.list().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const q = query.trim().toLowerCase();
  const all = rows || [];
  const shown = all.filter((a) => (!status || a.status === status || (status === 'overdue' && overdue(a.currentIssue))) && (!category || a.category === category)
    && (!q || [a.assetTag, a.name, a.serialNumber, a.currentIssue ? empName(a.currentIssue.employeeId) : ''].some((x) => (x || '').toLowerCase().includes(q))));
  const stat = (k: string) => all.filter((a) => a.status === k).length;
  const tiles: [string, string, number][] = [
    ['', 'All assets', all.length], ['available', 'In stock', stat('available')], ['issued', 'Issued', stat('issued')],
    ['overdue', 'Overdue return', all.filter((a) => overdue(a.currentIssue)).length], ['in_repair', 'In repair', stat('in_repair')], ['lost', 'Lost', stat('lost')],
  ];
  const cols = '100px minmax(170px,1.4fr) 130px minmax(150px,1.1fr) 110px 110px';
  const opened = all.find((a) => a.id === openId);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        {tiles.map(([k, l, n]) => (
          <div key={l} onClick={() => setStatus(k)} style={{ ...card, padding: '10px 14px', cursor: 'pointer', borderColor: status === k ? ACCENT : undefined }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: k === 'overdue' && n ? DANGER : INK }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All categories</option>
          {ASSET_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tag, name, serial or holder…" style={{ ...input, width: 240 }} />
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setAdding(true)} style={btn(true)}>+ Register asset</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 780 }}>
            <div style={headRow(cols)}><span>Tag</span><span>Asset</span><span>Category</span><span>With</span><span>Condition</span><span>Status</span></div>
            {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((a) => {
              const s = STATUS[a.status] || STATUS.available;
              return (
                <div key={a.id} onClick={() => setOpenId(a.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{a.assetTag}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{a.name}</div>
                    {a.serialNumber && <div style={{ fontSize: 11, color: MUTED }}>S/N {a.serialNumber}</div>}
                  </span>
                  <span style={{ fontSize: 12.5 }}>{catLabel(a.category)}</span>
                  <span style={{ fontSize: 12.5 }}>
                    {a.currentIssue ? <>
                      <span onClick={(e) => { e.stopPropagation(); onOpenEmployee(a.currentIssue!.employeeId); }} style={{ fontWeight: 600, color: INK, textDecoration: 'underline', textDecorationColor: '#ccc' }}>{empName(a.currentIssue.employeeId)}</span>
                      <div style={{ fontSize: 11, color: overdue(a.currentIssue) ? DANGER : MUTED }}>since {fmtDate(a.currentIssue.issuedAt)}{a.currentIssue.expectedReturn ? ` · due ${fmtDate(a.currentIssue.expectedReturn)}` : ''}</div>
                    </> : <span style={{ color: MUTED }}>—</span>}
                  </span>
                  <span style={{ fontSize: 12.5 }}>{condLabel(a.condition)}</span>
                  <span><Badge tone={overdue(a.currentIssue) ? 'red' : s.tone}>{overdue(a.currentIssue) ? 'Overdue' : s.label}</Badge></span>
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{all.length ? 'Nothing matches.' : 'No assets registered yet — laptops, phones, SIMs, tools, uniforms, vehicles and access cards all go here.'}</div>}
          </div>
        </div>
      </div>
      {adding && <AssetFormDrawer onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
      {opened && <AssetDrawer asset={opened} employees={employees} canManage={canManage} currency={currency} onOpenEmployee={onOpenEmployee} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function AssetFormDrawer({ asset, onClose, onSaved }: { asset?: Asset; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    name: asset?.name || '', category: asset?.category || 'laptop', serialNumber: asset?.serialNumber || '', assetTag: asset?.assetTag || '',
    condition: asset?.condition || 'new', purchaseDate: asset?.purchaseDate || '', cost: asset?.cost != null ? String(asset.cost) : '', notes: asset?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setSaving(true);
    const body = { ...f, cost: f.cost === '' ? undefined : Number(f.cost), purchaseDate: f.purchaseDate || undefined, assetTag: f.assetTag || undefined, serialNumber: f.serialNumber || undefined };
    try { asset ? await api.assets.update(asset.id, body) : await api.assets.create(body); toast(asset ? 'Saved' : 'Asset registered'); onSaved(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };
  return (
    <Drawer title={asset ? `Edit ${asset.assetTag}` : 'Register asset'} width={520} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Saving…' : 'Save'}</div></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Name / model *" /><input value={f.name} onChange={set('name')} placeholder="e.g. Dell Latitude 5440" style={input} /></div>
        <div><Label text="Category" /><select value={f.category} onChange={set('category')} style={input}>{ASSET_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><Label text="Condition" /><select value={f.condition} onChange={set('condition')} style={input}>{CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><Label text="Serial / IMEI / plate" /><input value={f.serialNumber} onChange={set('serialNumber')} style={input} /></div>
        <div><Label text="Asset tag" /><input value={f.assetTag} onChange={set('assetTag')} placeholder="Automatic if blank" style={input} /></div>
        <div><Label text="Purchase date" /><input type="date" value={f.purchaseDate} onChange={set('purchaseDate')} style={input} /></div>
        <div><Label text="Cost" /><input type="number" min={0} value={f.cost} onChange={set('cost')} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><textarea value={f.notes} onChange={set('notes')} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
    </Drawer>
  );
}

function AssetDrawer({ asset, employees, canManage, currency, onOpenEmployee, onClose, onChanged }: {
  asset: Asset; employees: Employee[]; canManage: boolean; currency: string; onOpenEmployee: (id: string) => void; onClose: () => void; onChanged: () => Promise<unknown>;
}) {
  const { toast } = useApp();
  const [history, setHistory] = useState<AssetIssue[]>([]);
  const [mode, setMode] = useState<'' | 'issue' | 'return' | 'lost' | 'edit'>('');
  const loadHistory = () => api.assets.history(asset.id).then((r: any) => setHistory(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { loadHistory(); setMode(''); }, [asset.id]);
  const s = STATUS[asset.status] || STATUS.available;
  const empName = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const done = async (msg: string) => { toast(msg); setMode(''); await onChanged(); loadHistory(); };
  const setStatus = async (st: string, msg: string) => {
    try { await api.assets.setStatus(asset.id, st); await done(msg); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not update')); }
  };

  if (mode === 'edit') return <AssetFormDrawer asset={asset} onClose={() => setMode('')} onSaved={() => done('Saved')} />;

  return (
    <Drawer title={`${asset.assetTag} · ${asset.name}`} subtitle={[catLabel(asset.category), asset.serialNumber && `S/N ${asset.serialNumber}`].filter(Boolean).join(' · ')} width={540} onClose={onClose}
      footer={canManage && !mode ? <>
        <div onClick={() => setMode('edit')} style={btn()}>Edit details</div>
        {asset.status === 'available' && <div onClick={() => setStatus('in_repair', 'Sent for repair')} style={btn()}>Send to repair</div>}
        {asset.status === 'available' && <div onClick={() => { if (confirm('Retire this asset? It leaves active stock.')) setStatus('retired', 'Retired'); }} style={btn()}>Retire</div>}
        {(asset.status === 'in_repair' || asset.status === 'retired') && <div onClick={() => setStatus('available', 'Back in stock')} style={btn()}>Back in stock</div>}
        {asset.status === 'issued' && <div onClick={() => setMode('lost')} style={{ ...btn(), color: DANGER }}>Report lost</div>}
        {asset.status === 'issued' && <div onClick={() => setMode('return')} style={btn(true)}>Record return</div>}
        {asset.status === 'available' && <div onClick={() => setMode('issue')} style={btn(true)}>Issue to employee</div>}
      </> : undefined}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <Badge tone={s.tone}>{s.label}</Badge>
        {overdue(asset.currentIssue) && <Badge tone="red">Return overdue</Badge>}
        <span style={{ fontSize: 12, color: MUTED }}>Condition: {condLabel(asset.condition)}</span>
      </div>
      <div style={{ ...card, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.8, marginBottom: 14 }}>
        {asset.currentIssue && <div>With <span onClick={() => onOpenEmployee(asset.currentIssue!.employeeId)} style={{ fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>{empName(asset.currentIssue.employeeId)}</span> since {fmtDate(asset.currentIssue.issuedAt)}{asset.currentIssue.expectedReturn ? `, due back ${fmtDate(asset.currentIssue.expectedReturn)}` : ''}</div>}
        {asset.purchaseDate && <div>Bought {fmtDate(asset.purchaseDate)}{asset.cost != null ? ` for ${money(asset.cost, currency)}` : ''}</div>}
        {asset.notes && <div style={{ whiteSpace: 'pre-wrap' }}>{asset.notes}</div>}
        {!asset.currentIssue && !asset.purchaseDate && !asset.notes && <div style={{ color: MUTED }}>No further details.</div>}
      </div>

      {mode === 'issue' && <IssueForm asset={asset} employees={employees} onCancel={() => setMode('')} onDone={() => done('Issued')} />}
      {(mode === 'return' || mode === 'lost') && asset.currentIssue && <CloseForm lost={mode === 'lost'} issue={asset.currentIssue} asset={asset} currency={currency} onCancel={() => setMode('')} onDone={() => done(mode === 'lost' ? 'Recorded as lost' : 'Return recorded')} />}

      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, margin: '6px 0 8px' }}>Custody history</div>
      {history.map((i) => (
        <div key={i.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(20,8,31,.06)', fontSize: 12.5, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <b style={{ color: INK }}>{empName(i.employeeId)}</b>
            <Badge tone={i.status === 'open' ? 'blue' : i.status === 'lost' ? 'red' : 'grey'}>{i.status === 'open' ? 'Holding' : i.status === 'lost' ? 'Lost' : 'Returned'}</Badge>
          </div>
          <div style={{ color: MUTED }}>
            {fmtDate(i.issuedAt)} – {i.returnedAt ? fmtDate(i.returnedAt) : 'now'} · issued by {i.issuedByName || '—'}
            {i.returnCondition ? ` · returned ${condLabel(i.returnCondition).toLowerCase()}` : ''}{i.chargeAmount ? ` · charge ${money(i.chargeAmount, currency)}` : ''}
          </div>
          {i.notes && <div style={{ color: INK, whiteSpace: 'pre-wrap' }}>{i.notes}</div>}
        </div>
      ))}
      {!history.length && <div style={{ fontSize: 12.5, color: MUTED }}>Never issued.</div>}
    </Drawer>
  );
}

function IssueForm({ asset, employees, fixedEmployeeId, onCancel, onDone }: { asset?: Asset; employees: Employee[]; fixedEmployeeId?: string; onCancel: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [stock, setStock] = useState<Asset[]>([]);
  const [f, setF] = useState({ assetId: asset?.id || '', employeeId: fixedEmployeeId || '', date: todayISO(), expectedReturn: '', notes: '' });
  useEffect(() => { if (!asset) api.assets.list().then((r: any) => setStock((Array.isArray(r) ? r : []).filter((a: Asset) => a.status === 'available'))).catch(() => {}); }, [asset]);
  const submit = async () => {
    try { await api.assets.issue(f.assetId, { employeeId: f.employeeId, date: f.date, expectedReturn: f.expectedReturn || undefined, notes: f.notes || undefined }); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not issue')); }
  };
  return (
    <div style={{ ...card, padding: '14px 16px', borderColor: ACCENT, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>Issue {asset ? asset.name : 'an asset'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {!asset && (
          <div style={{ gridColumn: '1 / -1' }}><Label text="Asset (in stock)" />
            <select value={f.assetId} onChange={(e) => setF({ ...f, assetId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {stock.map((a) => <option key={a.id} value={a.id}>{a.assetTag} · {a.name} ({catLabel(a.category)})</option>)}
            </select>
            {!stock.length && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>Nothing in stock — register assets under Employee services › Assets.</div>}
          </div>
        )}
        {!fixedEmployeeId && (
          <div style={{ gridColumn: '1 / -1' }}><Label text="Employee" />
            <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {activeStaff(employees).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
            </select>
          </div>
        )}
        <div><Label text="Issued on" /><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={input} /></div>
        <div><Label text="Expected back (optional)" /><input type="date" value={f.expectedReturn} onChange={(e) => setF({ ...f, expectedReturn: e.target.value })} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. with charger and bag" style={input} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <div onClick={onCancel} style={btn()}>Cancel</div>
        <div onClick={f.assetId && f.employeeId ? submit : undefined} style={btn(true, !f.assetId || !f.employeeId)}>Issue</div>
      </div>
    </div>
  );
}

function CloseForm({ lost, issue, asset, currency, onCancel, onDone }: { lost: boolean; issue: AssetIssue; asset?: Asset; currency: string; onCancel: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ date: todayISO(), condition: 'good', toRepair: false, charge: lost && asset?.cost ? String(asset.cost) : '', notes: '' });
  const submit = async () => {
    const body = { date: f.date, chargeAmount: f.charge === '' ? undefined : Number(f.charge), notes: f.notes || undefined };
    try {
      if (lost) await api.assets.reportLost(issue.id, body);
      else await api.assets.returnIssue(issue.id, { ...body, condition: f.condition, toRepair: f.toRepair });
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };
  return (
    <div style={{ ...card, padding: '14px 16px', borderColor: lost ? DANGER : ACCENT, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>{lost ? `Report ${asset?.name || 'item'} lost` : `Return ${asset?.name || 'item'}`}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><Label text={lost ? 'Lost on' : 'Returned on'} /><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={input} /></div>
        {!lost && <div><Label text="Condition" /><select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value, toRepair: e.target.value === 'damaged' || f.toRepair })} style={input}>{CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
        <div><Label text={`${lost ? 'Charge to employee' : 'Damage charge'} (${currency}, optional)`} /><input type="number" min={0} value={f.charge} onChange={(e) => setF({ ...f, charge: e.target.value })} style={input} /></div>
        {!lost && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: INK, alignSelf: 'end', paddingBottom: 8 }}><input type="checkbox" checked={f.toRepair} onChange={(e) => setF({ ...f, toRepair: e.target.checked })} />Send to repair</label>}
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={input} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Charges are recorded against the employee for their final settlement.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <div onClick={onCancel} style={btn()}>Cancel</div>
        <div onClick={submit} style={btn(true)}>{lost ? 'Report lost' : 'Record return'}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ profile

export function EmployeeAssetsPanel({ employee, employees, canManage, currency }: { employee: Employee; employees: Employee[]; canManage: boolean; currency: string }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<(AssetIssue & { asset?: Asset })[] | null>(null);
  const [mode, setMode] = useState<{ kind: 'issue' } | { kind: 'return' | 'lost'; issue: AssetIssue & { asset?: Asset } } | null>(null);
  const load = () => api.assets.forEmployee(employee.id).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); setMode(null); }, [employee.id]);
  const holding = (rows || []).filter((i) => i.status === 'open');
  const past = (rows || []).filter((i) => i.status !== 'open');
  const charges = (rows || []).reduce((s, i) => s + (i.chargeAmount || 0), 0);
  const done = (msg: string) => { toast(msg); setMode(null); load(); };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Holding now ({holding.length})</div>
        {charges > 0 && <Badge tone="red">Charges {money(charges, currency)}</Badge>}
        {canManage && !mode && <div onClick={() => setMode({ kind: 'issue' })} style={btn(true)}>+ Issue asset</div>}
      </div>
      {mode?.kind === 'issue' && <IssueForm employees={employees} fixedEmployeeId={employee.id} onCancel={() => setMode(null)} onDone={() => done('Issued')} />}
      {mode && mode.kind !== 'issue' && <CloseForm lost={mode.kind === 'lost'} issue={mode.issue} asset={mode.issue.asset} currency={currency} onCancel={() => setMode(null)} onDone={() => done(mode.kind === 'lost' ? 'Recorded as lost' : 'Return recorded')} />}
      <div style={{ ...card, overflow: 'hidden' }}>
        {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
        {holding.map((i) => (
          <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, width: 80 }}>{i.asset?.assetTag}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{i.asset?.name} <span style={{ fontWeight: 400, color: MUTED, fontSize: 12 }}>· {catLabel(i.asset?.category || '')}</span></div>
              <div style={{ fontSize: 11.5, color: overdue(i) ? DANGER : MUTED }}>Since {fmtDate(i.issuedAt)}{i.expectedReturn ? ` · due back ${fmtDate(i.expectedReturn)}` : ''}{overdue(i) ? ' · overdue' : ''}</div>
            </span>
            {canManage && !mode && <>
              <span onClick={() => setMode({ kind: 'lost', issue: i })} style={{ fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Lost</span>
              <span onClick={() => setMode({ kind: 'return', issue: i })} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Return</span>
            </>}
          </div>
        ))}
        {rows && !holding.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>No company assets with {employee.name}.</div>}
      </div>
      {past.length > 0 && (
        <div>
          <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 8 }}>Previously held</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {past.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 12, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                <span style={{ width: 80, color: MUTED }}>{i.asset?.assetTag}</span>
                <span style={{ flex: 1 }}>{i.asset?.name} · {fmtDate(i.issuedAt)} – {fmtDate(i.returnedAt)}{i.returnCondition ? ` · ${condLabel(i.returnCondition).toLowerCase()}` : ''}</span>
                {i.status === 'lost' && <Badge tone="red">Lost</Badge>}
                {i.chargeAmount ? <span style={{ color: DANGER, fontWeight: 600 }}>{money(i.chargeAmount, currency)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
