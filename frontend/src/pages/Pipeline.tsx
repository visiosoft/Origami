import { useState, useEffect } from 'react';
import { DEALS, STAGES, STAGE_KEYS, STATUS_STYLES, type Deal } from '../data/pipeline';
import { LEAD_DROPDOWN_OPTIONS } from '../data/leads';
import { useWindowWidth } from '../useWindowWidth';
import { useApp } from '../AppContext';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";
const OPT = LEAD_DROPDOWN_OPTIONS;

type Override = Partial<Pick<Deal, 'stage' | 'stageIdx' | 'daysInStage' | 'status'>>;



interface NewLead {
  leadName: string; namePronunciation: string; phone: string; email: string;
  primaryPointOfContact: string; secondPointOfContact: string; nameOfSecondContact: string;
  phoneOfSecondContact: string; emailOfSecondContact: string; relationshipOfSecondContact: string;
  decisionMakers: string; preferredContactMethod: string; leadSource: string;
  projectStreetAddress: string; projectStreetName: string; projectCity: string; projectZipCode: string;
  countyLocation: string; propertyType: string; potentialProjectType: string; homeworkCompleted: string[];
  projectVision: string; reasonForProject: string; budgetPosition: string; fundingStatus: string;
  desiredStart: string; expectedDuration: string; expectedLengthOfOwnership: string; clientPersonality: string;
}
const BLANK_LEAD: NewLead = {
  leadName: '', namePronunciation: '', phone: '', email: '',
  primaryPointOfContact: '', secondPointOfContact: '', nameOfSecondContact: '',
  phoneOfSecondContact: '', emailOfSecondContact: '', relationshipOfSecondContact: '',
  decisionMakers: '', preferredContactMethod: '', leadSource: '',
  projectStreetAddress: '', projectStreetName: '', projectCity: '', projectZipCode: '',
  countyLocation: '', propertyType: '', potentialProjectType: '', homeworkCompleted: [],
  projectVision: '', reasonForProject: '', budgetPosition: '', fundingStatus: '',
  desiredStart: '', expectedDuration: '', expectedLengthOfOwnership: '', clientPersonality: '',
};

const TABS = [
  { id: 1, label: '1. Contact Info' },
  { id: 2, label: '2. Second Contact' },
  { id: 3, label: '3. Communication' },
  { id: 4, label: '4. Location' },
  { id: 5, label: '5. Project Details' },
  { id: 6, label: '6. Budget & Timeline' },
  { id: 7, label: '7. Client Profile' },
];

export function Pipeline() {
  const width = useWindowWidth();
  const isMobile = width <= 640;
  const { toast } = useApp();
  const [roleFilter, setRoleFilter] = useState<'all' | 'pc' | 'pm'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [deals, setDeals] = useState<Deal[]>(DEALS);
  const [showNew, setShowNew] = useState(false);
  const [nl, setNl] = useState<NewLead>({ ...BLANK_LEAD });
  const [formTab, setFormTab] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    api.pipeline.list().then((res) => { if (Array.isArray(res) && res.length > 0) setDeals(res as Deal[]); }).catch(() => { });
  }, []);

  const data: Deal[] = deals.map((d) => (overrides[d.id] ? { ...d, ...overrides[d.id] } : d));

  const setField = <K extends keyof NewLead>(k: K, v: NewLead[K]) => setNl((f) => ({ ...f, [k]: v }));
  const toggleHomework = (v: string) => setField('homeworkCompleted', nl.homeworkCompleted.includes(v) ? nl.homeworkCompleted.filter((x) => x !== v) : [...nl.homeworkCompleted, v]);

  const openEdit = (deal: Deal) => {
    setNl({ leadName: deal.name, namePronunciation: '', phone: deal.phone, email: deal.email, primaryPointOfContact: '', secondPointOfContact: '', nameOfSecondContact: '', phoneOfSecondContact: '', emailOfSecondContact: '', relationshipOfSecondContact: '', decisionMakers: '', preferredContactMethod: '', leadSource: deal.source || '', projectStreetAddress: '', projectStreetName: '', projectCity: '', projectZipCode: '', countyLocation: '', propertyType: '', potentialProjectType: '', homeworkCompleted: [], projectVision: deal.notes || '', reasonForProject: '', budgetPosition: '', fundingStatus: '', desiredStart: '', expectedDuration: '', expectedLengthOfOwnership: '', clientPersonality: '' });
    setEditingId(deal.id);
    setFormTab(1);
    setShowNew(true);
  };

  const saveLead = () => {
    if (nl.leadName.trim().length < 2 || !nl.phone.trim()) return;
    if (editingId) {
      api.leads.update(editingId, nl).then(() => toast('Lead updated')).catch(() => toast('⚠ Failed to update'));
      setShowNew(false);
      setEditingId(null);
      setNl({ ...BLANK_LEAD });
      setFormTab(1);
      return;
    }
    createLead();
  };

  const deleteLead = (id: string) => {
    if (!confirm('Delete this lead permanently?')) return;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setSelectedId(null);
    toast('Lead deleted');
    api.leads.delete(id).catch(() => toast('⚠ Failed to delete from database'));
    api.pipeline.list().then((res) => { if (Array.isArray(res)) setDeals(res as Deal[]); }).catch(() => { });
  };

  const createLead = () => {
    if (nl.leadName.trim().length < 2 || !nl.phone.trim()) return;
    const deal: Deal = {
      id: 'PL-' + String(1000 + deals.length + 1),
      name: nl.leadName.trim(),
      client: nl.leadName.trim(),
      value: '$0',
      stage: 'new_lead',
      stageIdx: 0,
      assignedRole: 'PC',
      assignee: 'Unassigned',
      assigneeInit: '?',
      daysInStage: 0,
      nextAction: 'Assign & make first contact',
      nextDue: '—',
      source: nl.leadSource || 'Website',
      status: 'in_progress',
      phone: nl.phone.trim(),
      email: nl.email.trim(),
      timeline: [{ date: 'Today', action: `New lead created — ${nl.potentialProjectType || 'General'}`, role: 'System', type: 'auto' }],
      notes: nl.projectVision.trim(),
    };
    setDeals((prev) => [deal, ...prev]);
    setShowNew(false);
    setNl({ ...BLANK_LEAD });
    setFormTab(1);
    setSelectedId(deal.id);
    toast(`${deal.name} added to the pipeline`);
    api.leads.create(nl).catch((err) => { console.error('leads.create failed:', err); toast('⚠ Failed to save lead to database'); });
    void api.pipeline.create(deal).catch(() => undefined);
  };

  const applyOverride = (id: string, o: Override) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...o } }));

  const filtered = roleFilter === 'all' ? data : data.filter((d) => {
    const st = STAGES.find((s) => s.key === d.stage);
    return st && (roleFilter === 'pc' ? st.owner === 'PC' : st.owner === 'PM');
  });

  const selected = selectedId ? data.find((d) => d.id === selectedId) : null;
  const selectedStage = selected ? STAGES.find((st) => st.key === selected.stage) : null;

  const totalValue = data.reduce((s, d) => s + parseFloat(String(d.value).replace(/[^0-9.]/g, '') || '0') * 1000, 0);
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
            <div onClick={() => { setNl({ ...BLANK_LEAD }); setEditingId(null); setFormTab(1); setShowNew(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(23,51,38,0.22)' }}>
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
                      const ss = STATUS_STYLES[d.status] || { label: d.status || 'Active', bg: '#E8E8E8', color: '#555', dot: '#999' };
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
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 4 }}>{selected.id} Â· {selected.source}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{selected.name}</div>
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#43514D', marginBottom: 8 }}>{selected.client}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: (STATUS_STYLES[selected.status] || { bg: '#E8E8E8', color: '#555' }).bg, color: (STATUS_STYLES[selected.status] || { bg: '#E8E8E8', color: '#555' }).color }}>{(STATUS_STYLES[selected.status] || { label: selected.status || 'Active' }).label}</span>
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
            <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>Due: {selected.nextDue} Â· {selected.daysInStage} days in stage</div>
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
              <div onClick={() => openEdit(selected)} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#2F7D4A' }}>Edit Lead</div>
              <div onClick={() => deleteLead(selected.id)} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#8E2E0A' }}>Delete</div>
              <div onClick={() => applyOverride(selected.id, { stage: 'rejected', stageIdx: 11, daysInStage: 0, status: 'overdue' })} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#8E2E0A' }}>Lost</div>
            </div>
          )}
        </div>
      )}


      {/* Lead Intake drawer */}
      {showNew && (
        <div onClick={() => { setShowNew(false); setEditingId(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 200, animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, background: 'white', width: 720, maxWidth: '96vw', display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 60px rgba(20,8,31,0.2)', animation: 'scaleIn 0.2s ease' }}>
            <div style={{ padding: '20px 28px 14px', borderBottom: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>{editingId ? 'Edit Lead' : 'New Lead Intake'}</div>
                <div style={{ fontSize: 12.5, color: '#7E9B93', marginTop: 3 }}>{editingId ? 'Update lead information.' : 'Complete all sections. Enters board at "New Lead" (stage 1/11).'}</div>
              </div>
              <div onClick={() => { setShowNew(false); setEditingId(null); }} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', fontSize: 18 }}>×</div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left section nav */}
              <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid rgba(20,8,31,0.06)', overflowY: 'auto', padding: '12px 0' }}>
                {TABS.map((t) => (
                  <div key={t.id} onClick={() => setFormTab(t.id)} style={{ padding: '10px 20px', fontSize: 12, fontWeight: formTab === t.id ? 700 : 500, cursor: 'pointer', color: formTab === t.id ? '#173326' : '#7E9B93', background: formTab === t.id ? '#EEF3EE' : 'transparent', borderLeft: formTab === t.id ? '3px solid #2F7D4A' : '3px solid transparent', transition: 'all 0.15s' }}>{t.label}</div>
                ))}
              </div>

              {/* Right form content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {formTab === 1 && (<>
                  <SectionTitle>1. Contact Information</SectionTitle>
                  <FormGrid>
                    <FormField label="Lead Name *" hint="Full name of the primary person who contacted us."><input value={nl.leadName} onChange={(e) => setField('leadName', e.target.value)} placeholder="Full name" style={inputStyle} /></FormField>
                    <FormField label="Name Pronunciation" hint="Phonetic spelling if difficult to pronounce."><input value={nl.namePronunciation} onChange={(e) => setField('namePronunciation', e.target.value)} placeholder="e.g. Mah-REE-ah" style={inputStyle} /></FormField>
                    <FormField label="Phone Number *" hint="Primary lead's best phone number."><input type="tel" value={nl.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="(555) 123-4567" style={inputStyle} /></FormField>
                    <FormField label="Email" hint="Primary lead's preferred email address."><input type="email" value={nl.email} onChange={(e) => setField('email', e.target.value)} placeholder="email@example.com" style={inputStyle} /></FormField>
                    <FormField label="Primary Point of Contact"><select value={nl.primaryPointOfContact} onChange={(e) => setField('primaryPointOfContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.primaryPointOfContact.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                  </FormGrid>
                </>)}
                {formTab === 2 && (<>
                  <SectionTitle>2. Second Point of Contact</SectionTitle>
                  <FormGrid>
                    <FormField label="Second Point of Contact?" hint="Is there another person to include in communications?"><select value={nl.secondPointOfContact} onChange={(e) => setField('secondPointOfContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.secondPointOfContact.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    {nl.secondPointOfContact === 'Yes' && <>
                      <FormField label="Name of Second Contact"><input value={nl.nameOfSecondContact} onChange={(e) => setField('nameOfSecondContact', e.target.value)} placeholder="Full name" style={inputStyle} /></FormField>
                      <FormField label="Phone of Second Contact" hint="Include area code."><input type="tel" value={nl.phoneOfSecondContact} onChange={(e) => setField('phoneOfSecondContact', e.target.value)} placeholder="(555) 123-4567" style={inputStyle} /></FormField>
                      <FormField label="Email of Second Contact"><input type="email" value={nl.emailOfSecondContact} onChange={(e) => setField('emailOfSecondContact', e.target.value)} placeholder="email@example.com" style={inputStyle} /></FormField>
                      <FormField label="Relationship of Second Contact"><select value={nl.relationshipOfSecondContact} onChange={(e) => setField('relationshipOfSecondContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.relationshipOfSecondContact.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    </>}
                  </FormGrid>
                </>)}
                {formTab === 3 && (<>
                  <SectionTitle>3. Communication & Source</SectionTitle>
                  <FormGrid>
                    <FormField label="Decision Makers" hint="Who makes final decisions about scope, budget, and design."><select value={nl.decisionMakers} onChange={(e) => setField('decisionMakers', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.decisionMakers.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Preferred Contact Method"><select value={nl.preferredContactMethod} onChange={(e) => setField('preferredContactMethod', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.preferredContactMethod.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Lead Source" hint="How the lead first heard about or was referred to us."><select value={nl.leadSource} onChange={(e) => setField('leadSource', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.leadSource.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                  </FormGrid>
                </>)}
                {formTab === 4 && (<>
                  <SectionTitle>4. Project Location</SectionTitle>
                  <FormGrid>
                    <FormField label="Project Street Address" hint="Street number. Leave blank if no exact address."><input value={nl.projectStreetAddress} onChange={(e) => setField('projectStreetAddress', e.target.value)} placeholder="Street number" style={inputStyle} /></FormField>
                    <FormField label="Project Street Name"><input value={nl.projectStreetName} onChange={(e) => setField('projectStreetName', e.target.value)} placeholder="Street name" style={inputStyle} /></FormField>
                    <FormField label="Project City"><select value={nl.projectCity} onChange={(e) => setField('projectCity', e.target.value)} style={inputStyle}><option value="">Select city...</option>{OPT.projectCity.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Project ZIP Code"><input value={nl.projectZipCode} onChange={(e) => setField('projectZipCode', e.target.value)} placeholder="5-digit ZIP" maxLength={5} style={inputStyle} /></FormField>
                    <FormField label="County Location"><select value={nl.countyLocation} onChange={(e) => setField('countyLocation', e.target.value)} style={inputStyle}><option value="">Select county...</option>{OPT.countyLocation.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                  </FormGrid>
                </>)}
                {formTab === 5 && (<>
                  <SectionTitle>5. Project Details</SectionTitle>
                  <FormGrid>
                    <FormField label="Property Type"><select value={nl.propertyType} onChange={(e) => setField('propertyType', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.propertyType.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Potential Project Type" hint="Based on what is known during the first conversation."><select value={nl.potentialProjectType} onChange={(e) => setField('potentialProjectType', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.potentialProjectType.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Homework Completed</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {OPT.homeworkCompleted.map((o) => { const on = nl.homeworkCompleted.includes(o); return <div key={o} onClick={() => toggleHomework(o)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.1)'), background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#0B1A12', fontWeight: on ? 600 : 400, userSelect: 'none' }}>{o}</div>; })}
                      </div>
                      <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 6 }}>Select all preliminary work the client has already completed.</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Project Vision / Scope</div>
                      <textarea value={nl.projectVision} onChange={(e) => setField('projectVision', e.target.value)} placeholder="Describe what the client wants to accomplish..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
                      <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 4 }}>Capture major spaces, changes, additions, and goals mentioned during conversation.</div>
                    </div>
                  </FormGrid>
                </>)}
                {formTab === 6 && (<>
                  <SectionTitle>6. Budget & Timeline</SectionTitle>
                  <FormGrid>
                    <FormField label="Reason for Project"><select value={nl.reasonForProject} onChange={(e) => setField('reasonForProject', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.reasonForProject.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Budget Position" hint="How the client currently thinks about budget."><select value={nl.budgetPosition} onChange={(e) => setField('budgetPosition', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.budgetPosition.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Funding Status" hint="How prepared the client is to fund the project."><select value={nl.fundingStatus} onChange={(e) => setField('fundingStatus', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.fundingStatus.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Desired Start"><select value={nl.desiredStart} onChange={(e) => setField('desiredStart', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.desiredStart.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Expected Duration" hint="Client's expectation, not our estimated schedule."><select value={nl.expectedDuration} onChange={(e) => setField('expectedDuration', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.expectedDuration.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Expected Length of Ownership"><select value={nl.expectedLengthOfOwnership} onChange={(e) => setField('expectedLengthOfOwnership', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.expectedLengthOfOwnership.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                  </FormGrid>
                </>)}
                {formTab === 7 && (<>
                  <SectionTitle>7. Client Profile</SectionTitle>
                  <FormGrid>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Client Personality</div>
                      <select value={nl.clientPersonality} onChange={(e) => setField('clientPersonality', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.clientPersonality.map((o) => <option key={o}>{o}</option>)}</select>
                      <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 6 }}>Based on the first conversation, select the personality style that most closely reflects how the client communicates and makes decisions.</div>
                    </div>
                  </FormGrid>
                </>)}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 28px 18px', borderTop: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <span style={{ marginRight: 'auto', fontSize: 11, color: '#7E9B93' }}>{nl.leadName.trim().length < 2 || !nl.phone.trim() ? 'Name & phone required' : 'Ready to save'}</span>
              <div onClick={() => { setShowNew(false); setEditingId(null); }} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
              <div onClick={saveLead} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: nl.leadName.trim().length >= 2 && nl.phone.trim() ? 'pointer' : 'not-allowed', background: nl.leadName.trim().length >= 2 && nl.phone.trim() ? '#173326' : '#D6DED8', color: nl.leadName.trim().length >= 2 && nl.phone.trim() ? 'white' : '#9AA39D', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>{editingId ? 'Save Changes' : 'Create Lead'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };
function SectionTitle({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 13, fontWeight: 700, color: '#173326', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(20,8,31,0.06)' }}>{children}</div>; }
function FormGrid({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>{children}</div>; }
function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return (<div><div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>{children}{hint && <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 4 }}>{hint}</div>}</div>); }
