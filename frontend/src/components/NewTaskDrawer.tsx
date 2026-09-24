import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { TaskTab } from '../data/tasks';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

interface NewTask {
  tab: TaskTab; meetingType: string; meetingDate: string; assignedTo: string; originator: string;
  topicType: string; status: string; dueDate: string; dueTime: string; project: string; description: string;
  linkedFile: string; labels: string[];
}
const blank = (project: string, labels: string[], dueDate = '', dueTime = '', assignedTo = ''): NewTask => ({
  tab: 'internal', meetingType: 'Internal', meetingDate: '', assignedTo, originator: '',
  topicType: 'Task', status: 'Open', dueDate, dueTime, project, description: '', linkedFile: '', labels,
});

/**
 * The one "New Task" drawer, used everywhere a task gets created or
 * assigned -- the CRM lead's Tasks tab, the Tasks page, and anywhere else --
 * so adding a task looks and works the same regardless of where it started.
 */
export function NewTaskDrawer({
  onClose, onCreated, fixedProject, sections, defaultSection, defaultAssignedTo, defaultDueDate, defaultDueTime, defaultDescription,
}: {
  onClose: () => void;
  /** `task` is the saved task, so the host can open it for files, labels and a checklist. */
  onCreated: (created?: { dueDate: string; dueTime: string; description: string; task?: any }) => void;
  /** Opened from a specific lead/project: the Project field is fixed and hidden. */
  fixedProject?: { id: string; name: string };
  /** Opened from a lead: shows a Section field tagging which pipeline stage this task belongs to. */
  sections?: string[];
  defaultSection?: string;
  defaultAssignedTo?: string;
  defaultDescription?: string;
  /** Opened from a My Calendar time-slot click -- pre-fills and locks in the slot's date/time. */
  defaultDueDate?: string;
  defaultDueTime?: string;
}) {
  const { toast, users } = useApp();
  const [nt, setNt] = useState<NewTask>(() => ({ ...blank(
    fixedProject?.id || '',
    defaultSection ? [`section:${defaultSection}`] : [],
    defaultDueDate || '',
    defaultDueTime || '',
    defaultAssignedTo || '',
  ), description: defaultDescription || '' }));
  const [section, setSection] = useState(defaultSection || sections?.[0] || '');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!fixedProject) {
      api.projects.list()
        .then((r: any) => { if (Array.isArray(r)) setProjects(r.filter((p: any) => p.stage !== 'Kickoff').map((p: any) => ({ id: p.id, name: p.name }))); })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () => {
    if (nt.description.trim().length < 3) { toast('Add a task description'); return; }
    setCreating(true);
    const payload = {
      ...nt,
      project: fixedProject ? fixedProject.id : nt.project,
      labels: sections ? [`section:${section}`] : nt.labels,
    };
    api.tasks.create(payload)
      .then((task: any) => { toast('Task created'); onCreated({ dueDate: nt.dueDate, dueTime: nt.dueTime, description: nt.description, task }); onClose(); })
      .catch((err: any) => toast(`⚠ ${err?.message || 'Failed to create task'}`))
      .finally(() => setCreating(false));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: 460, maxWidth: '96vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.18)', animation: 'scaleIn 0.2s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>New Task</div>
            {fixedProject && <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 2 }}>on {fixedProject.name}</div>}
          </div>
          <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
          <Fld label="Assigned To"><select value={nt.assignedTo} onChange={(e) => setNt({ ...nt, assignedTo: e.target.value })} style={inputStyle}><option value="">Select person…</option>{users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
          <Fld label="Due Date"><input type="date" value={nt.dueDate} onChange={(e) => setNt({ ...nt, dueDate: e.target.value })} style={inputStyle} /></Fld>
          <Fld label="Due Time"><input type="time" value={nt.dueTime} onChange={(e) => setNt({ ...nt, dueTime: e.target.value })} style={inputStyle} /></Fld>
          {sections ? (
            <Fld label="Section"><select value={section} onChange={(e) => setSection(e.target.value)} style={inputStyle}>{sections.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
          ) : (
            <Fld label="Project"><select value={nt.project} onChange={(e) => setNt({ ...nt, project: e.target.value })} style={inputStyle}><option value="">General task — no project</option>{projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></Fld>
          )}
          <Fld label="Topic Type"><select value={nt.topicType} onChange={(e) => setNt({ ...nt, topicType: e.target.value })} style={inputStyle}>{['Task', 'FYI', 'RFI'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
          <Fld label="Status"><select value={nt.status} onChange={(e) => setNt({ ...nt, status: e.target.value })} style={inputStyle}>{['Open', 'In Progress', 'Closed'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
          {!fixedProject && (
            <Fld label="Meeting Type"><select value={nt.meetingType} onChange={(e) => setNt({ ...nt, meetingType: e.target.value })} style={inputStyle}>{['Internal', 'Owner', 'Subcontractor'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
          )}
          <Fld label="Description *" span><textarea value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} rows={4} placeholder="Describe the task…" style={{ ...inputStyle, resize: 'vertical' }} /></Fld>
          <Fld label="Link to File" span><input value={nt.linkedFile} onChange={(e) => setNt({ ...nt, linkedFile: e.target.value })} placeholder="Attach or paste link" style={inputStyle} /></Fld>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(20,8,31,0.08)', display: 'flex', gap: 12, justifyContent: 'flex-end', flexShrink: 0 }}>
          <div onClick={onClose} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
          <div onClick={creating ? undefined : create} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: creating ? 'default' : 'pointer', background: creating ? '#9AB0A4' : '#173326', color: 'white', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>
            {creating ? 'Creating…' : 'Create Task'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
