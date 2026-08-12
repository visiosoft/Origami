import { useState } from 'react';
import { DEALS, STAGES, STAGE_KEYS, STATUS_STYLES, type Deal } from '../data/pipeline';
import { useWindowWidth } from '../useWindowWidth';
import { useApp } from '../AppContext';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";

type Override = Partial<Pick<Deal, 'stage' | 'stageIdx' | 'daysInStage' | 'status'>>;

const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

interface NewLead {
  name: string; client: string; value: string; type: 'Residential' | 'Commercial' | 'Fit-out';
  assignee: string; source: string; phone: string; email: string; notes: string;
}
const BLANK_LEAD: NewLead = { name: '', client: '', value: '', type: 'Residential', assignee: '', source: 'Website', phone: '', email: '', notes: '' };

export function Pipeline() {
  const width = useWindowWidth();
  const isMobile = width <= 640;
  const { toast } = useApp();
  const [roleFilter, setRoleFilter] = useState<'all' | 'pc' | 'pm'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [added, setAdded] = useState<Deal[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nl, setNl] = useState<NewLead>(BLANK_LEAD);

  const data: Deal[] = [...added, ...DEALS].map((d) => (overrides[d.id] ? { ...d, ...overrides[d.id] } : d));

  const createLead = () => {
    if (nl.name.trim().length < 2 || nl.client.trim().length < 1) return;
    const deal: Deal = {
      id: 'PL-' + String(1000 + added.length + 1),
      name: nl.name.trim(),
      client: nl.client.trim(),
      value: nl.value.trim() || '$0',
      stage: 'new_lead',
      stageIdx: 0,
      assignedRole: 'PC',
      assignee: nl.assignee.trim() || 'Unassigned',
      assigneeInit: nl.assignee.trim() ? initials(nl.assignee) : '?',
      daysInStage: 0,
      nextAction: 'Assign & make first contact',
      nextDue: '—',
      source: nl.source,
      status: 'in_progress',
      phone: nl.phone.trim(),
      email: nl.email.trim(),
      timeline: [{ date: 'Today', action: `New ${nl.type} lead created`, role: 'System', type: 'auto' }],
      notes: nl.notes.trim(),
    };
    setAdded((a) => [deal, ...a]);
    setShowNew(false);
    setNl(BLANK_LEAD);
    setSelectedId(deal.id);
    toast(`${deal.name} added to the pipeline`);
    // Best-effort persist to the DB-backed API (no-op if the API/DB isn't up yet)
    void api.pipeline.create(deal).catch(() => undefined);
  };

  const applyOverride = (id: string, o: Override) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...o } }));

  const filtered = roleFilter === 'all' ? data : data.filter((d) => {
    const st = STAGES.find((s) => s.key === d.stage);
    return st && (roleFilter === 'pc' ? st.owner === 'PC' : st.owner === 'PM');
  });

  const selected = selectedId ? data.find((d) => d.id === selectedId) : null;
  const selectedStage = selected ? STAGES.find((st) => st.key === selected.stage) : null;

  const totalValue = data.reduce((s, d) => s + parseFloat(d.value.replace(/[^0-9.]/g, '')) * 1000, 0);
  const overdueCount = data.filter((d) => d.status === 'overdue').length;
  const avgDays = Math.round(data.reduce((s, d) => s + d.daysInStage, 0) / data.length);

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(id);
  };
  const onDrop = (e: React.DragEvent, stageKey: string, stageIdx: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) applyOverride(id, { stage: stageKey, stageIdx, daysInStage: 0, status: 'in_progress' });
    setDragging(null);
    setDragOver(null);
  };

  const stats = [
    { label: 'Active Deals', value: data.length.toString(), color: '#173326' },
    { label: 'Pipeline Value', value: '$' + (totalValue / 1000000).toFixed(1) + 'M', color: '#2F7D4A' },
    { label: 'Overdue', value: overdueCount.toString(), color: overdueCount > 0 ? '#B8410F' : '#9AA39D' },
    { label: 'Avg Days in Stage', value: avgDays.toString(), color: '#D2822E' },
  ];

  const roleTabs: { r: 'all' | 'pc' | 'pm'; label: string }[] = [
    { r: 'all', label: 'All Stages' },
    { r: 'pc', label: 'PC — Client Coordinator' },
    { r: 'pm', label: 'PM — Project Manager' },
  ];

  return (
    <div style={{ display: 'flex', gap: 0, height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 64px - 56px)', margin: isMobile ? '-16px -14px' : '-28px -32px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: isMobile ? 12 : 20, minWidth: 0 }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 10, padding: isMobile ? '0 14px 12px' : '0 20px 12px', flexShrink: 0 }}>
          {stats.map((st) => (
            <div key={st.label} style={{ flex: isMobile ? '1 1 calc(50% - 5px)' : 1, padding: '12px 14px', background: 'white', borderRadius: 10, border: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>{st.label}</div>
              <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: st.color, marginTop: 2 }}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Role filter + legend */}
        <div style={{ display: 'flex', gap: 6, padding: isMobile ? '0 14px 12px' : '0 20px 12px', flexShrink: 0, flexWrap: 'wrap' }}>
          {roleTabs.map(({ r, label }) => {
            const active = roleFilter === r;
            return (
              <div key={r} onClick={() => setRoleFilter(r)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? (r === 'pc' ? '#D2EAD3' : r === 'pm' ? '#DCE7DE' : '#0B1A12') : 'white', color: active ? (r === 'all' ? 'white' : r === 'pc' ? '#2F7D4A' : '#173326') : '#7E9B93', border: '1px solid ' + (active ? 'transparent' : 'rgba(20,8,31,0.08)') }}>{label}</div>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {([['#2F7D4A', 'PC'], ['#173326', 'PM'], ['#D9B94F', 'Auto']] as [string, string][]).map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 10, color: '#7E9B93', fontWeight: 500 }}>{l}</span>
              </div>
            ))}
            <div onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(23,51,38,0.22)' }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New Lead
            </div>
          </div>
        </div>

        {/* Kanban */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: isMobile ? '0 14px 16px' : '0 20px 20px' }}>
          <div style={{ display: 'flex', gap: 10, height: '100%', minWidth: 'max-content' }}>
            {STAGES.filter((st) => roleFilter === 'all' || (roleFilter === 'pc' ? st.owner === 'PC' : st.owner === 'PM')).map((stage) => {
              const cards = filtered.filter((d) => d.stage === stage.key);
              const isDragOver = dragOver === stage.key;
              return (
                <div key={stage.key} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== stage.key) setDragOver(stage.key); }} onDragLeave={() => { if (dragOver === stage.key) setDragOver(null); }} onDrop={(e) => onDrop(e, stage.key, stage.idx)} style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', background: isDragOver ? '#EEF3EE' : '#FBF8F2', borderRadius: 12, border: isDragOver ? '2px dashed #7E9B93' : '1px solid rgba(20,8,31,0.04)', maxHeight: '100%', transition: 'background 0.15s, border 0.15s' }}>
                  <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid rgba(20,8,31,0.06)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: stage.ownerColor }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0B1A12', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', background: 'rgba(20,8,31,0.06)', padding: '1px 6px', borderRadius: 999 }}>{cards.length}</span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: stage.ownerColor, background: stage.ownerBg, padding: '1px 6px', borderRadius: 999 }}>{stage.owner}</span>
                  </div>
                  <div style={{ padding: 6, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {cards.map((d) => {
                      const ss = STATUS_STYLES[d.status];
                      const isSelected = selectedId === d.id;
                      const isDraggingCard = dragging === d.id;
                      return (
                        <div key={d.id} draggable onDragStart={(e) => onDragStart(e, d.id)} onDragEnd={() => { setDragging(null); setDragOver(null); }} onClick={() => setSelectedId(d.id)} style={{ background: isSelected ? '#EEF3EE' : 'white', borderRadius: 8, padding: 10, border: '1px solid ' + (isSelected ? '#7E9B93' : 'rgba(20,8,31,0.05)'), cursor: 'grab', boxShadow: isSelected ? '0 0 0 2px rgba(210,130,46,0.15)' : '0 1px 3px rgba(20,8,31,0.04)', opacity: isDraggingCard ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0B1A12', lineHeight: 1.3, marginBottom: 6 }}>{d.name}</div>
                          <div style={{ fontSize: 10, color: '#7E9B93', marginBottom: 6 }}>{d.client}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: ss.bg, color: ss.color }}>{ss.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#173326' }}>{d.value}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={d.daysInStage > 4 ? '#B8410F' : '#7E9B93'} strokeWidth={2}><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>
                              <span style={{ fontSize: 9, fontWeight: 600, color: d.daysInStage > 4 ? '#B8410F' : '#7E9B93' }}>{d.daysInStage}d</span>
                            </div>
                            <div style={{ width: 18, height: 18, borderRadius: 999, background: d.assigneeInit === '?' ? '#D5D3CC' : '#0F2417', display: 'grid', placeItems: 'center', fontSize: 7, fontWeight: 700, color: 'white' }}>{d.assigneeInit}</div>
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 10, color: '#9AA39D', fontStyle: 'italic' }}>No deals</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && selectedStage && (
        <div style={isMobile
          ? { position: 'fixed', inset: 0, zIndex: 120, background: 'white', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }
          : { width: 380, flexShrink: 0, borderLeft: '1px solid rgba(20,8,31,0.06)', background: 'white', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ padding: 20, borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 4 }}>{selected.id} · {selected.source}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{selected.name}</div>
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#43514D', marginBottom: 8 }}>{selected.client}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_STYLES[selected.status].bg, color: STATUS_STYLES[selected.status].color }}>{STATUS_STYLES[selected.status].label}</span>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: selectedStage.ownerBg, color: selectedStage.ownerColor }}>{selectedStage.owner}: {selectedStage.name}</span>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#EDE3D0', color: '#0B1A12' }}>{selected.value}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#FBF8F2', fontSize: 11 }}>
                <div style={{ fontWeight: 600, color: '#7E9B93', marginBottom: 2 }}>Phone</div>
                <div style={{ fontWeight: 500, color: '#0B1A12' }}>{selected.phone}</div>
              </div>
              <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#FBF8F2', fontSize: 11, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#7E9B93', marginBottom: 2 }}>Email</div>
                <div style={{ fontWeight: 500, color: '#0B1A12', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.email}</div>
              </div>
            </div>
          </div>

          {/* Pipeline progress */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 10 }}>Pipeline Progress</div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {STAGES.map((st, i) => (
                <div key={st.key} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= selected.stageIdx ? (st.owner === 'PC' ? '#2F7D4A' : '#173326') : '#D6E0D7' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7E9B93' }}>
              <span>New Lead</span>
              <span>Stage {selected.stageIdx + 1}/11</span>
              <span>RFP</span>
            </div>
          </div>

          {/* Next action */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: selected.status === 'overdue' ? '#FAF1EC' : '#FEF6DC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={selected.status === 'overdue' ? '#B8410F' : '#D2822E'} strokeWidth={2}><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: selected.status === 'overdue' ? '#8E2E0A' : '#93520F' }}>Next Action</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{selected.nextAction}</div>
            <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>Due: {selected.nextDue} · {selected.daysInStage} days in stage</div>
          </div>

          {/* Notes */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Notes</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: '#43514D' }}>{selected.notes}</div>
          </div>

          {/* Timeline */}
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 12 }}>Activity Timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {selected.timeline.slice().reverse().map((t, i) => {
                const tc: Record<string, string> = { pc: '#2F7D4A', pm: '#173326', auto: '#D9B94F' };
                const tb: Record<string, string> = { pc: '#D2EAD3', pm: '#DCE7DE', auto: '#FBE9AE' };
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: tb[t.type], border: '2px solid ' + tc[t.type], flexShrink: 0 }} />
                      {i < selected.timeline.length - 1 && <div style={{ width: 1, flex: 1, background: '#D6E0D7', marginTop: 3 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93' }}>{t.date}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: tb[t.type], color: tc[t.type] }}>{t.role}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#0B1A12', lineHeight: 1.4 }}>{t.action}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          {selectedStage.isDecision ? (
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(20,8,31,0.06)', position: 'sticky', bottom: 0, background: 'white' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7E9B93', marginBottom: 8 }}>PM Decision — Does this project fit?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div onClick={() => applyOverride(selected.id, { stage: 'site_visit', stageIdx: 5, daysInStage: 0, status: 'in_progress' })} style={{ flex: 1, padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#2F7D4A', color: 'white' }}>✓ Approve — Good Fit</div>
                <div onClick={() => { applyOverride(selected.id, { stage: 'rejected', stageIdx: 11, daysInStage: 0, status: 'overdue' }); setSelectedId(null); }} style={{ flex: 1, padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#F2DFD4', color: '#8E2E0A' }}>✗ Reject — Not a Fit</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'white' }}>
              <div onClick={() => { const idx = selected.stageIdx; if (idx < 10) applyOverride(selected.id, { stage: STAGE_KEYS[idx + 1], stageIdx: idx + 1, daysInStage: 0, status: 'in_progress' }); }} style={{ flex: 1, padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#173326', color: 'white' }}>{selected.stageIdx < 10 ? 'Advance to Stage ' + (selected.stageIdx + 2) : '✓ Complete'}</div>
              <div style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)' }}>Log Activity</div>
              <div onClick={() => applyOverride(selected.id, { stage: 'rejected', stageIdx: 11, daysInStage: 0, status: 'overdue' })} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#8E2E0A' }}>Lost</div>
            </div>
          )}
        </div>
      )}

      {/* New Lead modal */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.6)', zIndex: 200, display: 'grid', placeItems: 'center', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, width: 600, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(20,8,31,0.25)', animation: 'scaleIn 0.2s ease' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>New Lead</div>
                <div style={{ fontSize: 12.5, color: '#7E9B93', marginTop: 3 }}>Enters the board at “New Lead” (stage 1 of 11).</div>
              </div>
              <div onClick={() => setShowNew(false)} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', fontSize: 16 }}>×</div>
            </div>
            <div style={{ padding: '22px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {([
                ['Deal / project name', 'name', 'e.g. Palm Jumeirah Villa Renovation', '1 / -1', true],
                ['Client / company', 'client', 'e.g. Al Futtaim Group', '1 / -1', true],
                ['Contact person', 'assignee', 'e.g. Sara R.', 'auto', false],
                ['Estimated value', 'value', 'e.g. $850K', 'auto', false],
                ['Phone', 'phone', '+971 50 000 0000', 'auto', false],
                ['Email', 'email', 'name@company.com', 'auto', false],
              ] as [string, keyof NewLead, string, string, boolean][]).map(([label, key, ph, span, req]) => (
                <div key={key} style={{ gridColumn: span }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label} {req && <span style={{ color: '#8E2E0A' }}>*</span>}</div>
                  <input value={nl[key] as string} placeholder={ph} onChange={(e) => setNl({ ...nl, [key]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13.5, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Type</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['Residential', 'Commercial', 'Fit-out'] as const).map((t) => {
                    const on = nl.type === t;
                    return <div key={t} onClick={() => setNl({ ...nl, type: t })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? '#173326' : 'white', color: on ? 'white' : '#7E9B93', border: '1px solid ' + (on ? '#173326' : 'rgba(20,8,31,0.12)') }}>{t}</div>;
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Source</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Referral', 'Website', 'Phone', 'In Person'].map((s) => {
                    const on = nl.source === s;
                    return <div key={s} onClick={() => setNl({ ...nl, source: s })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? '#173326' : 'white', color: on ? 'white' : '#7E9B93', border: '1px solid ' + (on ? '#173326' : 'rgba(20,8,31,0.12)') }}>{s}</div>;
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
                <textarea value={nl.notes} placeholder="Any initial context…" onChange={(e) => setNl({ ...nl, notes: e.target.value })} rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13.5, fontFamily: 'inherit', color: '#0B1A12', outline: 'none', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 28px 22px', borderTop: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
              <span style={{ marginRight: 'auto', fontSize: 11, color: '#7E9B93' }}>{nl.name.trim().length >= 2 && nl.client.trim() ? 'Ready to add' : 'Name and client are required'}</span>
              <div onClick={() => setShowNew(false)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
              <div onClick={createLead} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: nl.name.trim().length >= 2 && nl.client.trim() ? 'pointer' : 'not-allowed', background: nl.name.trim().length >= 2 && nl.client.trim() ? '#173326' : '#D6DED8', color: nl.name.trim().length >= 2 && nl.client.trim() ? 'white' : '#9AA39D', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>Create Lead</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
