import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  WF_STATUSES, WF_ITEM_STATUSES, WF_STATUS_STYLE, WF_ITEM_STATUS_STYLE,
  type Workflow, type WorkflowItem, type WorkflowStatus, type WorkflowItemStatus,
} from '../data/workflows';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };

function Pill({ label, bg, c }: { label: string; bg: string; c: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bg, color: c }}>{label}</span>;
}

export function Workflows() {
  const { can, toast } = useApp();
  const canManage = can('workflows', 'manage');
  const isMobile = useWindowWidth() <= 720;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [itemDraft, setItemDraft] = useState('');

  const reload = () => { api.workflows.list().then((r) => { if (Array.isArray(r)) setWorkflows(r as Workflow[]); }).catch(() => { }); };
  useEffect(() => { reload(); }, []);

  const selected = workflows.find((w) => w.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    api.workflowItems.list(selectedId).then((r) => { if (Array.isArray(r)) setItems(r as WorkflowItem[]); }).catch(() => { });
  }, [selectedId]);

  // ---- workflow mutations ----
  const patchWf = (id: string, patch: Partial<Workflow>) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    api.workflows.update(id, patch).catch(() => toast('⚠ Failed to save'));
  };
  const newWorkflow = () => {
    api.workflows.create({ name: 'New Workflow', status: 'Draft' }).then((res: any) => {
      if (res) { setWorkflows((prev) => [res as Workflow, ...prev]); setSelectedId(res.id); toast('Workflow created'); }
    }).catch(() => toast('⚠ Failed to create'));
  };
  const deleteWorkflow = (w: Workflow) => {
    if (!confirm(`Delete workflow "${w.name}" and its items?`)) return;
    setWorkflows((prev) => prev.filter((x) => x.id !== w.id));
    setSelectedId(null);
    api.workflows.remove(w.id).catch(() => toast('⚠ Failed to delete'));
    toast(`${w.name} deleted`);
  };

  // ---- item mutations ----
  const addItem = () => {
    if (!selected || !itemDraft.trim()) return;
    api.workflowItems.create({ workflowId: selected.id, title: itemDraft.trim(), status: 'Open', order: items.length })
      .then((res: any) => { if (res) setItems((prev) => [...prev, res as WorkflowItem]); }).catch(() => toast('⚠ Failed'));
    setItemDraft('');
  };
  const patchItem = (id: string, patch: Partial<WorkflowItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    api.workflowItems.update(id, patch).catch(() => toast('⚠ Failed to save'));
  };
  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    api.workflowItems.remove(id).catch(() => toast('⚠ Failed'));
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12' }}>Workflows</div>
          <div style={{ fontSize: 13, color: '#5C6B65' }}>Reusable processes — each workflow has its own items.</div>
        </div>
        {canManage && <div onClick={newWorkflow} style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', boxShadow: '0 4px 14px rgba(23,51,38,0.22)' }}>+ New Workflow</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {workflows.map((w) => {
          const s = WF_STATUS_STYLE[w.status] || WF_STATUS_STYLE.Draft;
          return (
            <div key={w.id} onClick={() => setSelectedId(w.id)} style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{w.name}</div>
                <Pill label={w.status} bg={s.bg} c={s.c} />
              </div>
              {w.description && <div style={{ fontSize: 12, color: '#7E9B93', lineHeight: 1.5, marginBottom: 8 }}>{w.description}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#7E9B93' }}>
                {w.owner && <span>👤 {w.owner}</span>}
                <span style={{ marginLeft: 'auto' }}>Open →</span>
              </div>
            </div>
          );
        })}
        {workflows.length === 0 && <div style={{ fontSize: 13, color: '#9AA39D', fontStyle: 'italic' }}>No workflows yet.</div>}
      </div>

      {/* Right detail panel (leads-style) */}
      {selected && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 120, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: isMobile ? '100%' : 460, maxWidth: '96vw', height: '100%', background: 'white', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(11,26,18,0.22)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={selected.name} disabled={!canManage} onChange={(e) => patchWf(selected.id, { name: e.target.value })} style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: BG, fontSize: 19, fontWeight: 700, color: '#0B1A12', width: '100%' }} />
                <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>{selected.id} · created {selected.createdAt}</div>
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', flexShrink: 0 }}>×</div>
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</div>
                <select disabled={!canManage} value={selected.status} onChange={(e) => patchWf(selected.id, { status: e.target.value as WorkflowStatus })} style={inputStyle}>{WF_STATUSES.map((o) => <option key={o}>{o}</option>)}</select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Owner</div>
                <input disabled={!canManage} value={selected.owner || ''} onChange={(e) => patchWf(selected.id, { owner: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</div>
                <textarea disabled={!canManage} value={selected.description || ''} onChange={(e) => patchWf(selected.id, { description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            {/* Items */}
            <div style={{ padding: '16px 22px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Items ({items.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it) => {
                  const s = WF_ITEM_STATUS_STYLE[it.status] || WF_ITEM_STATUS_STYLE.Open;
                  return (
                    <div key={it.id} style={{ background: '#FBF8F2', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input value={it.title} disabled={!canManage} onChange={(e) => patchItem(it.id, { title: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#0B1A12', outline: 'none' }} />
                        {canManage ? (
                          <select value={it.status} onChange={(e) => patchItem(it.id, { status: e.target.value as WorkflowItemStatus })} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 11 }}>{WF_ITEM_STATUSES.map((o) => <option key={o}>{o}</option>)}</select>
                        ) : <Pill label={it.status} bg={s.bg} c={s.c} />}
                        {canManage && <span onClick={() => deleteItem(it.id)} style={{ fontSize: 13, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
                      </div>
                      <textarea value={it.notes || ''} disabled={!canManage} placeholder="Notes…" onChange={(e) => patchItem(it.id, { notes: e.target.value })} rows={1} style={{ ...inputStyle, background: 'white', resize: 'vertical', fontSize: 12 }} />
                    </div>
                  );
                })}
                {items.length === 0 && <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No items yet.</div>}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <input value={itemDraft} onChange={(e) => setItemDraft(e.target.value)} placeholder="Add an item…" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }} />
                  <div onClick={addItem} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Add</div>
                </div>
              )}
            </div>

            {canManage && (
              <div style={{ padding: '0 22px 24px' }}>
                <div onClick={() => deleteWorkflow(selected)} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete workflow</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
