import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { STAGES, STAGE_KEYS, STATUS_STYLES, type Deal } from '../data/pipeline';
import { PROJECT_TYPES, PROJECT_TYPE_GROUPS, projectTypeLabel, projectTypePatch, findProjectType, appendScope, CONTRACT_TYPES, contractTypeLabel, findContractType } from '../data/projectTypes';
import { RoleAssignments } from '../components/RoleAssignments';
import { ConvertLeadDialog } from '../components/ConvertLeadDialog';
import { LEAD_DROPDOWN_OPTIONS, composeLeadName, splitLeadName, optionsWith, isReferralSource, isEventSource } from '../data/leads';
import { US_COUNTIES, US_CITIES } from '../data/usGeo';
import { type ScoringCriterion, scoreFor, totalPossible } from '../data/scoring';
import { useWindowWidth } from '../useWindowWidth';
import { useApp } from '../AppContext';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";
const OPT = LEAD_DROPDOWN_OPTIONS;

type Override = Partial<Pick<Deal, 'stage' | 'stageIdx' | 'daysInStage' | 'status'>>;

interface LeadNote { id: string; text: string; stageName: string; date: string }
const DOT = '·';



interface NewLead {
  leadName: string; firstName: string; lastName: string; goByName: string; pronouns: string;
  namePronunciation: string; phone: string; email: string;
  primaryPointOfContact: string; secondPointOfContact: string; nameOfSecondContact: string;
  phoneOfSecondContact: string; emailOfSecondContact: string; relationshipOfSecondContact: string;
  preferredContactMethodOfSecondContact: string; leadSourceReferrerName: string; leadSourceEventDetail: string;
  decisionMakers: string; preferredContactMethod: string; leadSource: string;
  projectStreetAddress: string; projectStreetName: string; projectCity: string; projectZipCode: string;
  countyLocation: string; hasHOA: string; propertyType: string; potentialProjectType: string; contractType: string; homeworkCompleted: string[];
  projectVision: string; reasonForProject: string; budgetPosition: string; fundingStatus: string;
  desiredStart: string; expectedDuration: string; expectedLengthOfOwnership: string; clientPersonality: string;
  zoningImages?: string; // JSON string of [{name,dataUrl}]
  zoningAnalysis?: string; // JSON string of the Zoning Code Analysis field map
}

// Structured Zoning Code Analysis form (rendered on the Zoning Analysis stage).
const GIS_HINT = 'Research in the GIS (Geographic Information Services) for the corresponding County';
const APN_HINT = "Research the Zoning Information in the City's Website using the APN as reference";
const SETBACK_HINT = "Determined by the Zoning District; the city's Zoning Code should define the setbacks";
type ZAField = { key?: string; label: string; hint?: string; heading?: boolean; options?: string[] };
const ZONING_FORM: { title: string; fields: ZAField[] }[] = [
  { title: 'Jurisdiction of Authority', fields: [
    { key: 'county', label: 'County', hint: GIS_HINT, options: US_COUNTIES },
    { key: 'city', label: 'City', hint: GIS_HINT, options: US_CITIES },
    { key: 'hoa', label: 'Homeowners Association', hint: GIS_HINT },
    { key: 'waterDistrict', label: 'Water District', hint: GIS_HINT },
    { key: 'sanitaryDistrict', label: 'Sanitary District', hint: GIS_HINT },
    { key: 'fireDistrict', label: 'Fire District', hint: GIS_HINT },
    { key: 'schoolDistrict', label: 'School District', hint: GIS_HINT },
    { key: 'electricityPurveyor', label: 'Electricity Purveyor', hint: GIS_HINT },
    { key: 'gasPurveyor', label: 'Gas Purveyor', hint: GIS_HINT },
  ] },
  { title: 'Zoning Analysis', fields: [
    { key: 'generalPlan', label: 'General Plan', hint: APN_HINT },
    { key: 'zoningDistrict', label: 'Zoning District', hint: APN_HINT + '. Ex: R-1' },
    { key: 'precisePlan', label: 'Precise Plan' },
    { key: 'historic', label: 'Historic' },
    { key: 'neighborhood', label: 'Neighborhood' },
  ] },
  { title: 'Building Envelope Limitation', fields: [
    { key: 'belLotCoverage', label: 'Lot Coverage Limitation' },
    { key: 'belFloorArea', label: 'Floor Area Limitation' },
    { heading: true, label: 'Setbacks' },
    { key: 'belFront', label: 'Front', hint: SETBACK_HINT },
    { key: 'belRear', label: 'Rear', hint: SETBACK_HINT },
    { key: 'belSide', label: 'Side', hint: SETBACK_HINT },
    { key: 'belStreetSide', label: 'Street Side', hint: SETBACK_HINT },
    { key: 'belHeight', label: 'Height', hint: SETBACK_HINT },
    { key: 'belDaylightPlane', label: 'DayLight Plane', hint: SETBACK_HINT },
    { key: 'belParking', label: 'Parking', hint: SETBACK_HINT },
  ] },
  { title: 'Accessory Dwelling Unit (ADU) Limitation', fields: [
    { key: 'aduFloorArea', label: 'Floor Area Limitation' },
    { heading: true, label: 'Setbacks' },
    { key: 'aduFront', label: 'Front', hint: SETBACK_HINT },
    { key: 'aduRear', label: 'Rear', hint: SETBACK_HINT },
    { key: 'aduSide', label: 'Side', hint: SETBACK_HINT },
    { key: 'aduHeight', label: 'Height', hint: SETBACK_HINT },
  ] },
];
const BLANK_LEAD: NewLead = {
  leadName: '', firstName: '', lastName: '', goByName: '', pronouns: '',
  namePronunciation: '', phone: '', email: '',
  primaryPointOfContact: '', secondPointOfContact: '', nameOfSecondContact: '',
  phoneOfSecondContact: '', emailOfSecondContact: '', relationshipOfSecondContact: '',
  preferredContactMethodOfSecondContact: '', leadSourceReferrerName: '', leadSourceEventDetail: '',
  decisionMakers: '', preferredContactMethod: '', leadSource: '',
  projectStreetAddress: '', projectStreetName: '', projectCity: '', projectZipCode: '',
  countyLocation: '', hasHOA: 'No', propertyType: '', potentialProjectType: '', contractType: '', homeworkCompleted: [],
  projectVision: '', reasonForProject: '', budgetPosition: '', fundingStatus: '',
  desiredStart: '', expectedDuration: '', expectedLengthOfOwnership: '', clientPersonality: '',
};

/** A hold whose follow-up date has arrived — time to touch base. */
const holdDue = (holdUntil?: string) => !!holdUntil && holdUntil <= new Date().toISOString().slice(0, 10);

/** Canonical index for a stage key, so no call site hardcodes a number. */
const stageIndex = (key: string) => STAGES.findIndex((s) => s.key === key);

/** Clamps rather than rolling over: 31 Jan + 1 month is 28 Feb, not 3 Mar. */
function addMonths(from: Date, months: number) {
  const day = from.getDate();
  const out = new Date(from.getTime());
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}

const baseLead = (deal: Deal): NewLead => ({ ...BLANK_LEAD, leadName: deal.name, ...splitLeadName(deal.name), phone: deal.phone, email: deal.email, leadSource: deal.source || '', projectVision: deal.notes || '' });

type FieldKind = 'text' | 'tel' | 'email' | 'select' | 'textarea' | 'pills' | 'checkbox';
interface FieldSpec {
  key: keyof NewLead; label: string; kind: FieldKind;
  optKey?: keyof typeof LEAD_DROPDOWN_OPTIONS; ph?: string;
  /** Shown only when this holds. A hidden field is not required either. */
  when?: (lead: NewLead) => boolean;
}
/**
 * `gate` marks a section that only applies in some cases — it starts collapsed
 * unless the gating field says otherwise, so nobody scrolls past a block of
 * empty inputs for a second contact that doesn't exist.
 */
/** Recorded when a question genuinely doesn't apply to this lead. */
const NOT_APPLICABLE = 'N/A';

/** A question counts as answered once it holds anything, N/A included. */
const isAnswered = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : String(v ?? '').trim().length > 0;

const LEAD_SECTIONS: { title: string; fields: FieldSpec[]; gate?: { key: string; value: string; emptyLabel: string } }[] = [
  { title: '1. Contact', fields: [
    { key: 'firstName', label: 'First Name *', kind: 'text', ph: 'First name' },
    { key: 'lastName', label: 'Last Name *', kind: 'text', ph: 'Last name' },
    { key: 'goByName', label: 'Go-By Name', kind: 'text', ph: 'What they prefer to be called' },
    { key: 'pronouns', label: 'Pronouns', kind: 'select', optKey: 'pronouns' },
    { key: 'namePronunciation', label: 'Name Pronunciation', kind: 'text', ph: 'e.g. Mah-REE-ah' },
    { key: 'phone', label: 'Phone *', kind: 'tel', ph: '(555) 123-4567' },
    { key: 'email', label: 'Email', kind: 'email', ph: 'email@example.com' },
    { key: 'primaryPointOfContact', label: 'Primary Point of Contact', kind: 'select', optKey: 'primaryPointOfContact' },
    { key: 'preferredContactMethod', label: 'Preferred Contact Method', kind: 'select', optKey: 'preferredContactMethod' },
  ] },
  { title: '2. Second Contact', gate: { key: 'secondPointOfContact', value: 'Yes', emptyLabel: 'No second contact' }, fields: [
    { key: 'secondPointOfContact', label: 'Second Point of Contact?', kind: 'select', optKey: 'secondPointOfContact' },
    { key: 'nameOfSecondContact', label: 'Name of Second Contact', kind: 'text', ph: 'Full name' },
    { key: 'phoneOfSecondContact', label: 'Phone of Second Contact', kind: 'tel', ph: '(555) 123-4567' },
    { key: 'emailOfSecondContact', label: 'Email of Second Contact', kind: 'email', ph: 'email@example.com' },
    { key: 'relationshipOfSecondContact', label: 'Relationship', kind: 'select', optKey: 'relationshipOfSecondContact' },
    { key: 'preferredContactMethodOfSecondContact', label: 'Preferred Contact Method', kind: 'select', optKey: 'preferredContactMethod' },
  ] },
  { title: '3. Source', fields: [
    { key: 'leadSource', label: 'Lead Source', kind: 'select', optKey: 'leadSource' },
    { key: 'leadSourceReferrerName', label: 'Referred By', kind: 'text', ph: 'Name of the person referring', when: (l) => isReferralSource(l.leadSource) },
    { key: 'leadSourceEventDetail', label: 'Where It Was', kind: 'text', ph: 'Event or networking group', when: (l) => isEventSource(l.leadSource) },
  ] },
  { title: '4. Location', fields: [
    { key: 'projectStreetAddress', label: 'Project Street Address', kind: 'text', ph: 'Street number' },
    { key: 'projectStreetName', label: 'Project Street Name', kind: 'text', ph: 'Street name' },
    { key: 'projectCity', label: 'Project City', kind: 'select', optKey: 'projectCity' },
    { key: 'projectZipCode', label: 'Project ZIP Code', kind: 'text', ph: '5-digit ZIP' },
    { key: 'countyLocation', label: 'County', kind: 'select', optKey: 'countyLocation' },
    { key: 'hasHOA', label: 'Property has an HOA', kind: 'checkbox' },
  ] },
  { title: '5. Project', fields: [
    { key: 'propertyType', label: 'Property Type', kind: 'select', optKey: 'propertyType' },
    { key: 'potentialProjectType', label: 'Potential Project Type', kind: 'select', optKey: 'potentialProjectType' },
    { key: 'contractType', label: 'Contract Type', kind: 'select', optKey: 'contractType' },
    { key: 'homeworkCompleted', label: 'Homework Completed', kind: 'pills', optKey: 'homeworkCompleted' },
    { key: 'projectVision', label: 'Project Vision / Scope', kind: 'textarea', ph: 'Describe what the client wants to accomplish…' },
  ] },
  { title: '6. Budget & Timeline', fields: [
    { key: 'reasonForProject', label: 'Reason for Project', kind: 'select', optKey: 'reasonForProject' },
    { key: 'budgetPosition', label: 'Budget Position', kind: 'select', optKey: 'budgetPosition' },
    { key: 'fundingStatus', label: 'Funding Status', kind: 'select', optKey: 'fundingStatus' },
    { key: 'desiredStart', label: 'Desired Start', kind: 'select', optKey: 'desiredStart' },
    { key: 'expectedDuration', label: 'Expected Duration', kind: 'select', optKey: 'expectedDuration' },
    { key: 'expectedLengthOfOwnership', label: 'Expected Length of Ownership', kind: 'select', optKey: 'expectedLengthOfOwnership' },
  ] },
  { title: '7. Client Profile', fields: [
    { key: 'decisionMakers', label: 'Decision Makers', kind: 'select', optKey: 'decisionMakers' },
    { key: 'clientPersonality', label: 'Client Personality', kind: 'select', optKey: 'clientPersonality' },
  ] },
];

const TABS = [
  { id: 1, label: '1. Contact Info' },
  { id: 2, label: '2. Second Contact' },
  { id: 3, label: '3. Source' },
  { id: 4, label: '4. Location' },
  { id: 5, label: '5. Project Details' },
  { id: 6, label: '6. Budget & Timeline' },
  { id: 7, label: '7. Client Profile' },
];

export function Pipeline() {
  const width = useWindowWidth();
  const isMobile = width <= 640;
  const { toast, currentUser, users } = useApp();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<'all' | 'pc' | 'pm'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nl, setNl] = useState<NewLead>({ ...BLANK_LEAD });
  const [formTab, setFormTab] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'roles'>('overview');
  const [showArchived, setShowArchived] = useState(false);
  const [converting, setConverting] = useState<Deal | null>(null);
  const [rolesDraft, setRolesDraft] = useState<Record<string, Record<string, string>>>({});
  const [leadDetails, setLeadDetails] = useState<Record<string, NewLead>>({});
  // Which gated questionnaire sections the user has explicitly toggled open/shut.
  const [leadSectionOpen, setLeadSectionOpen] = useState<Record<string, boolean>>({});
  const [notesByDeal, setNotesByDeal] = useState<Record<string, LeadNote[]>>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [meetByDeal, setMeetByDeal] = useState<Record<string, { when: string }>>({});
  const [meetWhen, setMeetWhen] = useState('');
  const [visitByDeal, setVisitByDeal] = useState<Record<string, { when: string }>>({});
  const [visitWhen, setVisitWhen] = useState('');
  const [scoringTemplate, setScoringTemplate] = useState<ScoringCriterion[]>([]);
  const [fitByDeal, setFitByDeal] = useState<Record<string, Record<string, string>>>({});
  const [panelWidth, setPanelWidth] = useState(420);

  // Drag the panel's left edge to resize its width (persists while the app is open).
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const onMove = (ev: MouseEvent) => {
      const max = Math.min(window.innerWidth - 120, 1100);
      setPanelWidth(Math.min(Math.max(startW + (startX - ev.clientX), 340), max));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Refetched on toggle, because whether archived deals come back is decided
  // by the server rather than filtered here.
  useEffect(() => {
    api.pipeline.list(showArchived).then((res) => { if (Array.isArray(res)) setDeals(res as Deal[]); }).catch(() => { });
  }, [showArchived]);

  useEffect(() => {
    // Rehydrate the rich intake details (Full Details) from the leads table,
    // keyed by id (new leads share their deal's id), so they survive refresh.
    api.leads.list().then((res) => {
      if (!Array.isArray(res)) return;
      const map: Record<string, NewLead> = {};
      const meets: Record<string, { when: string }> = {};
      const visits: Record<string, { when: string }> = {};
      const fits: Record<string, Record<string, string>> = {};
      for (const l of res as Array<Partial<NewLead> & { id: string; virtualMeetingAt?: string; siteVisitAt?: string; fitSelections?: Record<string, string> }>) {
        map[l.id] = { ...BLANK_LEAD, ...l } as NewLead;
        if (l.virtualMeetingAt) meets[l.id] = { when: l.virtualMeetingAt };
        if (l.siteVisitAt) visits[l.id] = { when: l.siteVisitAt };
        if (l.fitSelections) fits[l.id] = l.fitSelections;
      }
      setLeadDetails((prev) => ({ ...map, ...prev }));
      setMeetByDeal((prev) => ({ ...meets, ...prev }));
      setVisitByDeal((prev) => ({ ...visits, ...prev }));
      setFitByDeal((prev) => ({ ...fits, ...prev }));
    }).catch(() => { });
    api.scoring.getTemplate().then((res) => { if (Array.isArray(res)) setScoringTemplate(res as ScoringCriterion[]); }).catch(() => { });
  }, []);

  const data: Deal[] = deals.map((d) => (overrides[d.id] ? { ...d, ...overrides[d.id] } : d));

  const setField = <K extends keyof NewLead>(k: K, v: NewLead[K]) => setNl((f) => {
    const next = { ...f, [k]: v } as NewLead;
    // Everything downstream -- deals, projects, letters -- reads leadName, so it
    // tracks the separated parts instead of being typed on its own.
    if (k === 'firstName' || k === 'lastName') {
      next.leadName = composeLeadName(next.firstName, next.lastName, next.leadName);
    }
    if (k === 'potentialProjectType') Object.assign(next, projectTypePatch(String(v), next.projectVision));
    return next;
  });
  const toggleHomework = (v: string) => setField('homeworkCompleted', nl.homeworkCompleted.includes(v) ? nl.homeworkCompleted.filter((x) => x !== v) : [...nl.homeworkCompleted, v]);

  const openEdit = (deal: Deal) => {
    const existing = leadDetails[deal.id];
    // A lead captured before the name was separated has no parts yet -- derive
    // them so the form is editable rather than blank.
    setNl(existing
      ? { ...existing, ...(existing.firstName || existing.lastName ? {} : splitLeadName(existing.leadName)) }
      : { ...BLANK_LEAD, leadName: deal.name, ...splitLeadName(deal.name), phone: deal.phone, email: deal.email, leadSource: deal.source || '', projectVision: deal.notes || '' });
    setEditingId(deal.id);
    setFormTab(1);
    setShowNew(true);
  };

  const saveLead = () => {
    if (nl.leadName.trim().length < 2 || !nl.phone.trim()) return;
    if (editingId) {
      const id = editingId;
      setLeadDetails((prev) => ({ ...prev, [id]: { ...nl } }));
      setDeals((prev) => prev.map((d) => d.id === id ? { ...d, name: nl.leadName.trim(), client: nl.leadName.trim(), phone: nl.phone.trim(), email: nl.email.trim(), source: nl.leadSource || d.source, notes: nl.projectVision.trim() } : d));
      api.leads.update(id, nl).then(() => toast('Lead updated')).catch(() => toast('⚠ Failed to update'));
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
    // Board items are pipeline deals, so delete against the pipeline store
    // (the leads store is a separate, DB-only collection keyed by LD- ids).
    api.pipeline.remove(id).catch(() => { });
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
    setLeadDetails((prev) => ({ ...prev, [deal.id]: { ...nl } }));
    setShowNew(false);
    setNl({ ...BLANK_LEAD });
    setFormTab(1);
    setSelectedId(deal.id);
    setDetailTab('overview');
    toast(`${deal.name} added to the pipeline`);
    api.leads.create({ ...nl, id: deal.id }).catch((err) => { console.error('leads.create failed:', err); toast('⚠ Failed to save lead to database'); });
    void api.pipeline.create(deal).catch(() => undefined);
  };

  const applyOverride = (id: string, o: Override) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...o } }));
    // Persist stage moves (drag-drop, Advance, Approve/Reject) so the board
    // shows each lead in its correct stage after a refresh, and record the move
    // in the audit trail (the server appends its own copy too).
    if (o.stage) {
      const stageName = STAGES.find((s) => s.key === o.stage)?.name || o.stage;
      const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const who = currentUser?.name || 'Unknown';
      const target = STAGES.find((st) => st.key === o.stage);
      // A hold stage parks the lead until a date, so it can be brought back.
      const holdUntil = target?.isHold && target.holdMonths
        ? addMonths(new Date(), target.holdMonths).toISOString().slice(0, 10)
        : '';
      const action = holdUntil ? `Moved to ${stageName} — follow up ${holdUntil}` : `Moved to ${stageName}`;
      setDeals((prev) => prev.map((d) => d.id === id
        ? { ...d, holdUntil, timeline: [...(d.timeline || []), { date: when, action, role: who, type: 'auto' as const }] }
        : d));
      api.pipeline.updateStage(id, o.stage).catch(() => { });
    }
  };

  /** Take a parked or closed lead off the board without destroying it. */
  const archiveDeal = (deal: Deal, archived: boolean) => {
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, archived } : d)));
    if (archived) setSelectedId(null);
    api.pipeline.setArchived(deal.id, archived)
      .then(() => toast(archived ? `${deal.name} archived` : `${deal.name} restored`))
      .catch((e: Error) => {
        setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, archived: !archived } : d)));
        toast('⚠ ' + e.message);
      });
  };

  const submitNote = (dealId: string, stageName: string) => {
    const text = noteDraft.trim();
    if (!text) return;
    if (editingNoteId) {
      setNotesByDeal((p) => ({ ...p, [dealId]: (p[dealId] || []).map((n) => (n.id === editingNoteId ? { ...n, text } : n)) }));
      setEditingNoteId(null);
      toast('Note updated');
    } else {
      const note: LeadNote = { id: String(Date.now()), text, stageName, date: 'Today' };
      setNotesByDeal((p) => ({ ...p, [dealId]: [...(p[dealId] || []), note] }));
      toast('Note added');
    }
    setNoteDraft('');
  };
  const editNote = (n: LeadNote) => { setEditingNoteId(n.id); setNoteDraft(n.text); };
  const deleteNote = (dealId: string, nid: string) => {
    setNotesByDeal((p) => ({ ...p, [dealId]: (p[dealId] || []).filter((n) => n.id !== nid) }));
    if (editingNoteId === nid) { setEditingNoteId(null); setNoteDraft(''); }
  };

  const scheduleMeet = (deal: Deal, stageName: string) => {
    if (!meetWhen) return;
    const start = new Date(meetWhen);
    const end = new Date(start.getTime() + 30 * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const text = encodeURIComponent(`Virtual F2F Meeting — ${deal.name}`);
    const details = encodeURIComponent('Virtual F2F meeting via Origami CRM. Turn on "Add Google Meet video conferencing" in the event to generate the Meet link.');
    const guests = deal.email ? `&add=${encodeURIComponent(deal.email)}` : '';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}${guests}&details=${details}`;
    window.open(url, '_blank', 'noopener');
    setMeetByDeal((p) => ({ ...p, [deal.id]: { when: meetWhen } }));
    setNotesByDeal((p) => ({ ...p, [deal.id]: [...(p[deal.id] || []), { id: String(Date.now()), text: `Google Meet scheduled for ${start.toLocaleString()}`, stageName, date: 'Today' }] }));
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', virtualMeetingAt: meetWhen }).catch(() => { });
    toast('Google Meet invite opened & saved');
  };

  const scheduleSiteVisit = (deal: Deal, stageName: string) => {
    if (!visitWhen) return;
    const ld = leadDetails[deal.id];
    const addr = [ld?.projectStreetAddress, ld?.projectStreetName, ld?.projectCity, ld?.projectZipCode].filter(Boolean).join(', ');
    const start = new Date(visitWhen);
    const end = new Date(start.getTime() + 60 * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const text = encodeURIComponent(`Site Visit — ${deal.name}`);
    const details = encodeURIComponent('On-site visit scheduled via Origami CRM.');
    const location = addr ? `&location=${encodeURIComponent(addr)}` : '';
    const guests = deal.email ? `&add=${encodeURIComponent(deal.email)}` : '';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}${location}${guests}&details=${details}`;
    window.open(url, '_blank', 'noopener');
    setVisitByDeal((p) => ({ ...p, [deal.id]: { when: visitWhen } }));
    setNotesByDeal((p) => ({ ...p, [deal.id]: [...(p[deal.id] || []), { id: String(Date.now()), text: `Site visit scheduled for ${start.toLocaleString()}${addr ? ` at ${addr}` : ''}`, stageName, date: 'Today' }] }));
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', siteVisitAt: visitWhen }).catch(() => { });
    toast('Site visit invite opened & saved');
  };

  // Persist the chosen time to the DB without opening Google Calendar.
  const saveMeet = (deal: Deal, stageName: string) => {
    if (!meetWhen) return;
    setMeetByDeal((p) => ({ ...p, [deal.id]: { when: meetWhen } }));
    setNotesByDeal((p) => ({ ...p, [deal.id]: [...(p[deal.id] || []), { id: String(Date.now()), text: `Virtual F2F meeting saved for ${new Date(meetWhen).toLocaleString()}`, stageName, date: 'Today' }] }));
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', virtualMeetingAt: meetWhen }).catch(() => { });
    toast('Meeting time saved');
  };
  const saveVisit = (deal: Deal, stageName: string) => {
    if (!visitWhen) return;
    setVisitByDeal((p) => ({ ...p, [deal.id]: { when: visitWhen } }));
    setNotesByDeal((p) => ({ ...p, [deal.id]: [...(p[deal.id] || []), { id: String(Date.now()), text: `Site visit saved for ${new Date(visitWhen).toLocaleString()}`, stageName, date: 'Today' }] }));
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', siteVisitAt: visitWhen }).catch(() => { });
    toast('Site visit time saved');
  };

  // ---- Zoning Analysis image uploads (stored as data URLs on the lead) ----
  const parseImgs = (s?: string): { name: string; dataUrl: string }[] => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
  const saveZoningImages = (deal: Deal, imgs: { name: string; dataUrl: string }[]) => {
    const json = JSON.stringify(imgs);
    setLeadDetails((p) => ({ ...p, [deal.id]: { ...(p[deal.id] || BLANK_LEAD), zoningImages: json } }));
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', zoningImages: json }).catch(() => { });
  };
  const addZoningFiles = (deal: Deal, files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.some((f) => f.size > 2_000_000)) toast('Images over 2MB were skipped');
    const use = list.filter((f) => f.size <= 2_000_000).slice(0, 8);
    if (!use.length) return;
    Promise.all(use.map((f) => new Promise<{ name: string; dataUrl: string }>((res) => { const r = new FileReader(); r.onload = () => res({ name: f.name, dataUrl: String(r.result) }); r.readAsDataURL(f); })))
      .then((imgs) => { saveZoningImages(deal, [...parseImgs(leadDetails[deal.id]?.zoningImages), ...imgs]); toast(`${imgs.length} image(s) added`); });
  };
  const removeZoningImage = (deal: Deal, idx: number) => { saveZoningImages(deal, parseImgs(leadDetails[deal.id]?.zoningImages).filter((_, i) => i !== idx)); };

  // ---- Zoning Code Analysis structured form (stored as a JSON field map on the lead) ----
  const parseZA = (s?: string): Record<string, string> => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };
  const setZAField = (deal: Deal, key: string, val: string) => {
    setLeadDetails((p) => {
      const base = p[deal.id] || baseLead(deal);
      const next = JSON.stringify({ ...parseZA(base.zoningAnalysis), [key]: val });
      return { ...p, [deal.id]: { ...base, zoningAnalysis: next } };
    });
  };
  const saveZoningAnalysis = (deal: Deal) => {
    const json = (leadDetails[deal.id]?.zoningAnalysis) || '{}';
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', zoningAnalysis: json })
      .then(() => toast('Zoning analysis saved'))
      .catch(() => toast('⚠ Failed to save'));
  };

  const setFit = (dealId: string, key: string, label: string) =>
    setFitByDeal((p) => ({ ...p, [dealId]: { ...(p[dealId] || {}), [key]: label } }));
  const saveFit = (deal: Deal) => {
    const selections = fitByDeal[deal.id] || {};
    const score = scoreFor(scoringTemplate, selections);
    api.leads.update(deal.id, { leadName: deal.name, phone: deal.phone || '', fitScore: score, fitSelections: selections }).catch(() => { });
    toast(`Fit score saved: ${score} / ${totalPossible(scoringTemplate)}`);
  };

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
            <div
              onClick={() => setShowArchived((v) => !v)}
              title="Archived leads are hidden by default"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', background: showArchived ? '#EEF3EE' : 'white', color: showArchived ? '#173326' : '#7E9B93' }}
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </div>
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
                        <div key={d.id} draggable onDragStart={(e) => onDragStart(e, d.id)} onDragEnd={() => { setDragging(null); setDragOver(null); }} onClick={() => { setSelectedId(d.id); setDetailTab('overview'); setNoteDraft(''); setEditingNoteId(null); setMeetWhen(meetByDeal[d.id]?.when || ''); setVisitWhen(visitByDeal[d.id]?.when || ''); }} style={{ background: isSelected ? '#EEF3EE' : 'white', borderRadius: 8, padding: 10, border: '1px solid ' + (isSelected ? '#7E9B93' : 'rgba(20,8,31,0.05)'), cursor: 'grab', boxShadow: isSelected ? '0 0 0 2px rgba(210,130,46,0.15)' : '0 1px 3px rgba(20,8,31,0.04)', opacity: isDraggingCard ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0B1A12', lineHeight: 1.3, marginBottom: 6 }}>{d.name}</div>
                          <div style={{ fontSize: 10, color: '#7E9B93', marginBottom: 6 }}>{d.client}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: ss.bg, color: ss.color }}>{ss.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#173326' }}>{d.value}</span>
                            {d.holdUntil && (
                              <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: holdDue(d.holdUntil) ? '#F2DFD4' : '#FBE9AE', color: holdDue(d.holdUntil) ? '#8E2E0A' : '#93520F' }}>
                                {holdDue(d.holdUntil) ? 'Due' : d.holdUntil.slice(5)}
                              </span>
                            )}
                            {d.archived && <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: '#EFEDE8', color: '#7E9B93' }}>Archived</span>}
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
          ? { position: 'fixed', inset: 0, zIndex: 120, background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }
          : { position: 'relative', width: panelWidth, flexShrink: 0, borderLeft: '1px solid rgba(20,8,31,0.06)', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
          {/* Drag handle — resize the panel by dragging its left edge */}
          {!isMobile && (
            <div onMouseDown={startResize} title="Drag to resize" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 3, height: 34, borderRadius: 3, background: '#D6E0D7' }} />
            </div>
          )}
          {/* Scrollable content region */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Top bar */}
          <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93' }}>{selected.id} {DOT} {selected.source}</div>
            <div onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
            </div>
          </div>

          {/* Pipeline progress — above name */}
          <div style={{ padding: '10px 20px 14px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Pipeline Progress</div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {STAGES.map((s, i) => (
                <div key={s.key} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= selected.stageIdx ? (s.owner === 'PC' ? '#2F7D4A' : '#173326') : '#D6E0D7' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7E9B93' }}>
              <span>New Lead</span>
              <span style={{ fontWeight: 700, color: '#173326' }}>{STAGES[selected.stageIdx]?.name || `Stage ${selected.stageIdx + 1}`}</span>
              <span>RFP</span>
            </div>
          </div>

          {/* Name + client + pills */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{selected.name}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#43514D', margin: '4px 0 10px' }}>{selected.client}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: (STATUS_STYLES[selected.status] || { bg: '#E8E8E8', color: '#555' }).bg, color: (STATUS_STYLES[selected.status] || { bg: '#E8E8E8', color: '#555' }).color }}>{(STATUS_STYLES[selected.status] || { label: selected.status || 'Active' }).label}</span>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: selectedStage.ownerBg, color: selectedStage.ownerColor }}>{selectedStage.owner}: {selectedStage.name}</span>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#EDE3D0', color: '#0B1A12' }}>{selected.value}</span>
              {selected.holdUntil && (
                <span title="When to pick this lead back up" style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: holdDue(selected.holdUntil) ? '#F2DFD4' : '#FBE9AE', color: holdDue(selected.holdUntil) ? '#8E2E0A' : '#93520F' }}>
                  {holdDue(selected.holdUntil) ? 'Follow up now' : `Follow up ${selected.holdUntil}`}
                </span>
              )}
              {selected.archived && (
                <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#EFEDE8', color: '#7E9B93' }}>Archived</span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(20,8,31,0.06)', padding: '0 20px' }}>
            {(['overview', 'details'] as const).map((t) => (
              <div key={t} onClick={() => setDetailTab(t)} style={{ padding: '11px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid ' + (detailTab === t ? '#173326' : 'transparent'), color: detailTab === t ? '#0B1A12' : '#7E9B93' }}>{t === 'overview' ? 'Overview' : 'Full Details'}</div>
            ))}
          </div>

          {detailTab === 'roles' ? (
            <RoleAssignments deal={selected} users={users} draft={rolesDraft[selected.id]} onChange={(r) => setRolesDraft((p) => ({ ...p, [selected.id]: r }))} onSaved={(roles) => { setDeals((prev) => prev.map((d) => d.id === selected.id ? { ...d, roles } : d)); toast('Role assignments saved'); }} />
          ) : detailTab === 'overview' ? (
            <>
              {selected.stage === 'initial_questions' ? (
                (() => {
                  const ld = leadDetails[selected.id] || baseLead(selected);
                  const up = (k: keyof NewLead, v: string | string[]) => setLeadDetails((p) => {
                    const next = { ...(p[selected.id] || baseLead(selected)), [k]: v } as NewLead;
                    // leadName is the display name the rest of the app reads, so
                    // it is kept in step with the parts rather than typed.
                    if (k === 'firstName' || k === 'lastName') {
                      next.leadName = composeLeadName(next.firstName, next.lastName, next.leadName);
                    }
                    if (k === 'potentialProjectType') Object.assign(next, projectTypePatch(String(v), next.projectVision));
                    return { ...p, [selected.id]: next };
                  });
                  // Every question must be answered before the stage can be saved.
                  // A section that doesn't apply (no second contact) only requires
                  // the question that gates it.
                  const missing = LEAD_SECTIONS.flatMap((sec) => {
                    const gateMet = !sec.gate || (ld[sec.gate.key as keyof NewLead] as string) === sec.gate.value;
                    return sec.fields
                      .filter((f) => !f.when || f.when(ld))
                      .filter((f) => (sec.gate && !gateMet ? f.key === sec.gate.key : true))
                      .filter((f) => !isAnswered(ld[f.key]))
                      .map((f) => ({ sec, f }));
                  });
                  const requiredCount = LEAD_SECTIONS.reduce((n, sec) => {
                    const gateMet = !sec.gate || (ld[sec.gate.key as keyof NewLead] as string) === sec.gate.value;
                    return n + (sec.gate && !gateMet ? 1 : sec.fields.length);
                  }, 0);
                  return (
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326', marginBottom: 4 }}>Initial Questions — Lead Intake</div>
                      <div style={{ fontSize: 10.5, color: '#7E9B93', marginBottom: 12 }}>Complete these while on the call — saved to the lead record and visible in Full Details.</div>
                      {LEAD_SECTIONS.map((sec) => {
                        const gateMet = !sec.gate || (ld[sec.gate.key as keyof NewLead] as string) === sec.gate.value;
                        // Explicit clicks win; otherwise a gated section follows its answer.
                        const open = leadSectionOpen[sec.title] ?? gateMet;
                        return (
                        <div key={sec.title} style={{ marginBottom: 14 }}>
                          <div
                            onClick={sec.gate ? () => setLeadSectionOpen((p) => ({ ...p, [sec.title]: !open })) : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7E9B93', marginBottom: 8, cursor: sec.gate ? 'pointer' : 'default' }}
                          >
                            {sec.gate && (
                              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', fontSize: 9, color: '#9AA39D' }}>▶</span>
                            )}
                            <span>{sec.title}</span>
                            {sec.gate && !open && (
                              <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#9AA39D' }}>· {sec.gate.emptyLabel}</span>
                            )}
                          </div>
                          <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
                            {sec.fields.filter((f) => !f.when || f.when(ld)).map((f) => {
                              const value = ld[f.key];
                              const answered = isAnswered(value);
                              const na = Array.isArray(value) ? value[0] === NOT_APPLICABLE : value === NOT_APPLICABLE;
                              return (
                              <div key={f.key}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: answered ? '#7E9B93' : '#8E2E0A' }}>
                                    {f.label}{!answered && ' *'}
                                  </span>
                                  <span
                                    onClick={() => up(f.key, na ? (f.kind === 'pills' ? [] : '') : (f.kind === 'pills' ? [NOT_APPLICABLE] : NOT_APPLICABLE))}
                                    title={na ? 'Clear' : "Mark this question as not applicable"}
                                    style={{
                                      marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                                      cursor: 'pointer', border: '1px solid ' + (na ? '#173326' : 'rgba(20,8,31,0.14)'),
                                      background: na ? '#173326' : 'white', color: na ? 'white' : '#7E9B93',
                                    }}
                                  >
                                    N/A
                                  </span>
                                </div>
                                {f.kind === 'select' ? (
                                  <select value={(ld[f.key] as string) || ''} onChange={(e) => up(f.key, e.target.value)} style={inputStyle}><option value="">Select…</option>{optionsWith(LEAD_DROPDOWN_OPTIONS[f.optKey!] || [], ld[f.key] as string).map((o) => <option key={o}>{o}</option>)}</select>
                                ) : f.kind === 'textarea' ? (
                                  <textarea value={(ld[f.key] as string) || ''} onChange={(e) => up(f.key, e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                                ) : f.kind === 'checkbox' ? (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#0B1A12', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={ld[f.key] === 'Yes'} onChange={(e) => up(f.key, e.target.checked ? 'Yes' : 'No')} />
                                    Yes, this property is in an HOA
                                  </label>
                                ) : f.kind === 'pills' ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(LEAD_DROPDOWN_OPTIONS[f.optKey!] || []).map((o) => { const arr = (ld[f.key] as string[]) || []; const on = arr.includes(o); return <div key={o} onClick={() => up(f.key, on ? arr.filter((x) => x !== o) : [...arr, o])} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.1)'), background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#0B1A12', fontWeight: on ? 600 : 400, userSelect: 'none' }}>{o}</div>; })}</div>
                                ) : (
                                  <input type={f.kind} value={(ld[f.key] as string) || ''} onChange={(e) => up(f.key, e.target.value)} placeholder={f.ph} style={inputStyle} />
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                      {missing.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 9, background: '#F7E4DB', marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8E2E0A', lineHeight: 1.5 }}>
                            {requiredCount - missing.length} of {requiredCount} answered — {missing.length} still need an answer or N/A
                          </span>
                        </div>
                      )}
                      <div onClick={() => {
                        if (missing.length) {
                          // Reveal any collapsed section holding an unanswered question.
                          setLeadSectionOpen((prev) => {
                            const next = { ...prev };
                            missing.forEach(({ sec }) => { if (sec.gate) next[sec.title] = true; });
                            return next;
                          });
                          toast(`⚠ ${missing.length} question${missing.length === 1 ? '' : 's'} still unanswered — use N/A if one doesn't apply`);
                          return;
                        }
                        const cur = leadDetails[selected.id] || baseLead(selected);
                        const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const entry = { date: when, action: `${selectedStage.name} completed — lead details saved`, role: 'System', type: 'auto' as const };
                        setDeals((prev) => prev.map((d) => d.id === selected.id ? { ...d, name: cur.leadName || d.name, client: cur.leadName || d.client, phone: cur.phone, email: cur.email, source: cur.leadSource || d.source, notes: cur.projectVision, timeline: [...(d.timeline || []), entry] } : d));
                        api.leads.update(selected.id, cur).catch(() => { });
                        toast('Lead details saved');
                      }} style={{ padding: '10px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer', background: missing.length ? '#9AB0A4' : '#173326', color: 'white' }}>Save Lead Details</div>
                    </div>
                  );
                })()
              ) : selected.stage === 'virtual_ff' ? (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: '#EEF3EE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x={1} y={5} width={15} height={14} rx={2} ry={2} /></svg>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326' }}>Virtual F &amp; F — Schedule Google Meet</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#7E9B93', marginBottom: 10 }}>PC schedules the virtual meeting. Full lead details are in the “Full Details” tab.</div>
                  {meetByDeal[selected.id] && <div style={{ fontSize: 11.5, fontWeight: 600, color: '#173326', marginBottom: 8 }}>Scheduled: {new Date(meetByDeal[selected.id].when).toLocaleString()}</div>}
                  <input type="datetime-local" value={meetWhen} onChange={(e) => setMeetWhen(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div onClick={() => saveMeet(selected, selectedStage.name)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: meetWhen ? 'pointer' : 'not-allowed', background: meetWhen ? '#2F7D4A' : '#D6DED8', color: meetWhen ? 'white' : '#9AA39D' }}>Save schedule</div>
                    <div onClick={() => scheduleMeet(selected, selectedStage.name)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: meetWhen ? 'pointer' : 'not-allowed', background: meetWhen ? '#173326' : '#D6DED8', color: meetWhen ? 'white' : '#9AA39D' }}>Save &amp; create Google Meet</div>
                    <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(20,8,31,0.12)', color: '#173326' }}>Start instant Meet</a>
                  </div>
                  <div style={{ fontSize: 10, color: '#7E9B93', fontStyle: 'italic', marginTop: 6 }}>Opens Google Calendar with the lead invited — enable "Add Google Meet" to attach the video link. Logged to Activity.</div>
                </div>
              ) : selected.stage === 'site_visit' ? (
                (() => {
                  const ld = leadDetails[selected.id];
                  const addr = [ld?.projectStreetAddress, ld?.projectStreetName, ld?.projectCity, ld?.projectZipCode].filter(Boolean).join(', ');
                  return (
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: '#EEF3EE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx={12} cy={10} r={3} /></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326' }}>Site Visit — Schedule On-Site</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#7E9B93', marginBottom: 10 }}>PC schedules the on-site visit. Full lead details are in the “Full Details” tab.</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: addr ? '#173326' : '#9AA39D', marginBottom: 8 }}>{addr ? `Location: ${addr}` : 'No project address on file — add it in Full Details / Edit Lead.'}</div>
                      {visitByDeal[selected.id] && <div style={{ fontSize: 11.5, fontWeight: 600, color: '#173326', marginBottom: 8 }}>Scheduled: {new Date(visitByDeal[selected.id].when).toLocaleString()}</div>}
                      <input type="datetime-local" value={visitWhen} onChange={(e) => setVisitWhen(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div onClick={() => saveVisit(selected, selectedStage.name)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: visitWhen ? 'pointer' : 'not-allowed', background: visitWhen ? '#2F7D4A' : '#D6DED8', color: visitWhen ? 'white' : '#9AA39D' }}>Save schedule</div>
                        <div onClick={() => scheduleSiteVisit(selected, selectedStage.name)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: visitWhen ? 'pointer' : 'not-allowed', background: visitWhen ? '#173326' : '#D6DED8', color: visitWhen ? 'white' : '#9AA39D' }}>Save &amp; create invite</div>
                      </div>
                      <div style={{ fontSize: 10, color: '#7E9B93', fontStyle: 'italic', marginTop: 6 }}>Opens Google Calendar with the lead invited and the project address as the location. Logged to Activity.</div>
                    </div>
                  );
                })()
              ) : selected.stage === 'project_fit' ? (
                (() => {
                  const sel = fitByDeal[selected.id] || {};
                  const score = scoreFor(scoringTemplate, sel);
                  const maxTotal = totalPossible(scoringTemplate);
                  return (
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: '#EEF3EE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326' }}>Project Fit — Qualification Score</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#5C7169', marginBottom: 10 }}>Score the lead against the checklist. Edit the template in Settings.</div>
                      {scoringTemplate.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#8E2E0A', fontStyle: 'italic' }}>No scoring template found. Configure it in Settings → Lead Scoring Template.</div>
                      ) : (
                        <>
                          {scoringTemplate.map((c) => (
                            <div key={c.key} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#173326', marginBottom: 4 }}>{c.order}. {c.name} <span style={{ color: '#7E9B93', fontWeight: 500 }}>· {c.subCriteria} · max {c.maxPoints}</span></div>
                              <select value={sel[c.key] || ''} onChange={(e) => setFit(selected.id, c.key, e.target.value)} style={inputStyle}>
                                <option value="">Select…</option>
                                {c.options.map((o) => <option key={o.label} value={o.label}>{o.label} ({o.points >= 0 ? '+' : ''}{o.points})</option>)}
                              </select>
                            </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '10px 14px', background: 'white', borderRadius: 10, border: '1px solid rgba(20,8,31,0.08)' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7E9B93' }}>Total Score</span>
                            <span style={{ fontFamily: BG, fontWeight: 800, fontSize: 22, color: '#173326' }}>{score} <span style={{ fontSize: 13, color: '#7E9B93', fontWeight: 600 }}>/ {maxTotal}</span></span>
                          </div>
                          <div onClick={() => saveFit(selected)} style={{ marginTop: 10, padding: '10px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer', background: '#173326', color: 'white' }}>Save Fit Score</div>
                        </>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Client</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(() => {
                      const ld = leadDetails[selected.id];
                      const vv = (x?: string) => (x && x.trim() ? x : '—');
                      const fields: [string, string][] = [
                        ['Phone', vv(selected.phone)], ['Email', vv(selected.email)],
                        ['Lead Source', vv(ld?.leadSource || selected.source)], ['Preferred Contact', vv(ld?.preferredContactMethod)],
                        ['Primary Contact', vv(ld?.primaryPointOfContact)], ['Decision Makers', vv(ld?.decisionMakers)],
                        ['Budget Position', vv(ld?.budgetPosition)], ['Funding Status', vv(ld?.fundingStatus)],
                        ['Desired Start', vv(ld?.desiredStart)], ['Property Type', vv(ld?.propertyType)],
                      ];
                      return fields.map(([label, value]) => (
                        <div key={label} style={{ padding: '8px 10px', borderRadius: 8, background: '#FBF8F2', minWidth: 0 }}>
                          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#7E9B93', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: '#0B1A12', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Zoning Analysis — image uploads */}
              {selected.stage === 'zoning' && (() => {
                const imgs = parseImgs(leadDetails[selected.id]?.zoningImages);
                return (
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: '#EEF3EE' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326', marginBottom: 8 }}>Zoning Images ({imgs.length})</div>
                    <label style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>
                      + Upload images
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addZoningFiles(selected, e.target.files); e.currentTarget.value = ''; }} />
                    </label>
                    <span style={{ fontSize: 10, color: '#7E9B93', marginLeft: 10 }}>Up to 2MB each · saved to the lead.</span>
                    {imgs.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginTop: 10 }}>
                        {imgs.map((im, i) => (
                          <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(20,8,31,0.08)' }}>
                            <a href={im.dataUrl} target="_blank" rel="noopener noreferrer"><img src={im.dataUrl} alt={im.name} style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} /></a>
                            <div onClick={() => removeZoningImage(selected, i)} title="Remove" style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, cursor: 'pointer' }}>×</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Zoning Code Analysis — structured research form */}
              {selected.stage === 'zoning' && (() => {
                const za = parseZA(leadDetails[selected.id]?.zoningAnalysis);
                return (
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326' }}>Zoning Code Analysis</div>
                      <div onClick={() => saveZoningAnalysis(selected)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Save Analysis</div>
                    </div>
                    {ZONING_FORM.map((cat) => (
                      <div key={cat.title} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0B1A12', padding: '6px 10px', background: '#EEF3EE', borderRadius: 8, marginBottom: 8 }}>{cat.title}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingLeft: 2 }}>
                          {cat.fields.map((f) => f.heading ? (
                            <div key={f.label} style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{f.label}</div>
                          ) : (
                            <div key={f.key} style={{ paddingLeft: 4 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#43514D', marginBottom: 3 }}>{f.label}</div>
                              {f.options ? (
                                <>
                                  <input list={`za-${f.key}`} value={za[f.key!] || ''} onChange={(e) => setZAField(selected, f.key!, e.target.value)} placeholder="Type or select…" autoComplete="off" style={inputStyle} />
                                  <datalist id={`za-${f.key}`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>
                                </>
                              ) : (
                                <input value={za[f.key!] || ''} onChange={(e) => setZAField(selected, f.key!, e.target.value)} placeholder="—" style={inputStyle} />
                              )}
                              {f.hint && <div style={{ fontSize: 9.5, color: '#9AA39D', marginTop: 3, lineHeight: 1.35 }}>{f.hint}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div onClick={() => saveZoningAnalysis(selected)} style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Save Analysis</div>
                  </div>
                );
              })()}

              {/* Notes — add / edit / delete */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Notes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(notesByDeal[selected.id] || []).length === 0 && <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No notes yet.</div>}
                  {(notesByDeal[selected.id] || []).map((n) => (
                    <div key={n.id} style={{ background: '#FBF8F2', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#2F7D4A', background: '#D2EAD3', padding: '1px 6px', borderRadius: 999 }}>{n.stageName}</span>
                        <span style={{ fontSize: 10, color: '#7E9B93' }}>{n.date}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                          <span onClick={() => editNote(n)} style={{ fontSize: 11, color: '#173326', cursor: 'pointer', fontWeight: 600 }}>Edit</span>
                          <span onClick={() => deleteNote(selected.id, n.id)} style={{ fontSize: 11, color: '#8E2E0A', cursor: 'pointer', fontWeight: 600 }}>Delete</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#43514D', lineHeight: 1.5 }}>{n.text}</div>
                    </div>
                  ))}
                </div>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={editingNoteId ? 'Edit note…' : 'Add a note for this stage…'} rows={2} style={{ ...inputStyle, marginTop: 10, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <div onClick={() => submitNote(selected.id, selectedStage.name)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: noteDraft.trim() ? 'pointer' : 'not-allowed', background: noteDraft.trim() ? '#173326' : '#D6DED8', color: noteDraft.trim() ? 'white' : '#9AA39D' }}>{editingNoteId ? 'Save Note' : 'Add Note'}</div>
                  {editingNoteId && <div onClick={() => { setEditingNoteId(null); setNoteDraft(''); }} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)' }}>Cancel</div>}
                </div>
              </div>

              {/* Audit trail (stage moves, archives, role changes, notes) */}
              <div style={{ padding: '14px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 4 }}>Audit Trail</div>
                <div style={{ fontSize: 10.5, color: '#9AA39D', marginBottom: 12, lineHeight: 1.5 }}>Who did what, and when. Entries marked <b style={{ color: '#7E9B93' }}>System</b> were recorded before sign-in was required, or by an automated step.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(() => {
                    const noteList = notesByDeal[selected.id] || [];
                    const combined = [...selected.timeline, ...noteList.map((n) => ({ date: n.date, action: `Note (${n.stageName}): ${n.text}`, role: 'Note', type: 'pc' as const }))];
                    const tc: Record<string, string> = { pc: '#2F7D4A', pm: '#173326', auto: '#D9B94F' };
                    const tb: Record<string, string> = { pc: '#D2EAD3', pm: '#DCE7DE', auto: '#FBE9AE' };
                    return combined.slice().reverse().map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 999, background: tb[t.type] || '#EEE', border: '2px solid ' + (tc[t.type] || '#7E9B93'), flexShrink: 0 }} />
                          {i < combined.length - 1 && <div style={{ width: 1, flex: 1, background: '#D6E0D7', marginTop: 3 }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93' }}>{t.date}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: tb[t.type] || '#EEE', color: tc[t.type] || '#7E9B93' }}>{t.role}</span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#0B1A12', lineHeight: 1.4 }}>{t.action}</div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '14px 20px' }}>
              {(() => {
                const ld = leadDetails[selected.id];
                const sections: { title: string; rows: [string, string][] }[] = [
                  { title: '1. Contact', rows: [['Lead Name', selected.name], ['First Name', ld?.firstName || ''], ['Last Name', ld?.lastName || ''], ['Go-By Name', ld?.goByName || ''], ['Pronouns', ld?.pronouns || ''], ['Pronunciation', ld?.namePronunciation || ''], ['Phone', selected.phone], ['Email', selected.email], ['Primary Point of Contact', ld?.primaryPointOfContact || ''], ['Preferred Contact Method', ld?.preferredContactMethod || '']] },
                  { title: '2. Second Contact', rows: [['Has second contact', ld?.secondPointOfContact || ''], ['Name', ld?.nameOfSecondContact || ''], ['Phone', ld?.phoneOfSecondContact || ''], ['Email', ld?.emailOfSecondContact || ''], ['Relationship', ld?.relationshipOfSecondContact || ''], ['Preferred Contact Method', ld?.preferredContactMethodOfSecondContact || '']] },
                  { title: '3. Source', rows: [['Lead Source', ld?.leadSource || selected.source || ''], ['Referred By', ld?.leadSourceReferrerName || ''], ['Where It Was', ld?.leadSourceEventDetail || '']] },
                  { title: '4. Location', rows: [['Street Address', ld?.projectStreetAddress || ''], ['Street Name', ld?.projectStreetName || ''], ['City', ld?.projectCity || ''], ['ZIP', ld?.projectZipCode || ''], ['County', ld?.countyLocation || ''], ['HOA', ld?.hasHOA || '']] },
                  { title: '5. Project', rows: [['Property Type', ld?.propertyType || ''], ['Potential Project Type', ld?.potentialProjectType || ''], ['Contract Type', ld?.contractType || ''], ['Homework Completed', (ld?.homeworkCompleted || []).join(', ')], ['Vision / Scope', ld?.projectVision || selected.notes || '']] },
                  { title: '6. Budget & Timeline', rows: [['Reason for Project', ld?.reasonForProject || ''], ['Budget Position', ld?.budgetPosition || ''], ['Funding Status', ld?.fundingStatus || ''], ['Desired Start', ld?.desiredStart || ''], ['Expected Duration', ld?.expectedDuration || ''], ['Length of Ownership', ld?.expectedLengthOfOwnership || '']] },
                  { title: '7. Client Profile', rows: [['Decision Makers', ld?.decisionMakers || ''], ['Client Personality', ld?.clientPersonality || '']] },
                ].map((s) => ({ title: s.title, rows: s.rows.filter(([, val]) => val && String(val).trim()) as [string, string][] })).filter((s) => s.rows.length > 0);
                if (sections.length === 0) return <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No additional details captured yet. Use "Edit Lead" to complete the intake form.</div>;
                return sections.map((s) => (
                  <div key={s.title} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#173326', marginBottom: 8 }}>{s.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {s.rows.map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: '#FBF8F2', borderRadius: 8 }}>
                          <span style={{ fontSize: 11, color: '#7E9B93', fontWeight: 600, flex: '0 0 44%' }}>{label}</span>
                          <span style={{ fontSize: 12, color: '#0B1A12', flex: 1, wordBreak: 'break-word' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          </div>
          {/* End scrollable content region */}

          {/* Actions */}
          {selectedStage.isDecision ? (
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(20,8,31,0.06)', flexShrink: 0, background: 'white' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7E9B93', marginBottom: 8 }}>PM Decision — Does this project fit?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div onClick={() => applyOverride(selected.id, { stage: 'site_visit', stageIdx: stageIndex('site_visit'), daysInStage: 0, status: 'in_progress' })} style={{ flex: 1, padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#2F7D4A', color: 'white' }}>✓ Approve — Good Fit</div>
                <div onClick={() => { applyOverride(selected.id, { stage: 'rejected', stageIdx: stageIndex('rejected'), daysInStage: 0, status: 'overdue' }); setSelectedId(null); }} style={{ flex: 1, padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#F2DFD4', color: '#8E2E0A' }}>✗ Reject — Not a Fit</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0, background: 'white' }}>
              <div onClick={() => { const idx = selected.stageIdx; if (idx < STAGE_KEYS.length - 1) applyOverride(selected.id, { stage: STAGE_KEYS[idx + 1], stageIdx: idx + 1, daysInStage: 0, status: 'in_progress' }); }} style={{ flex: '1 1 100%', padding: 9, borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: '#173326', color: 'white' }}>{selected.stageIdx < STAGE_KEYS.length - 1 ? 'Move to ' + (STAGES[selected.stageIdx + 1]?.name || 'next stage') : '✓ Complete'}</div>
              {selected.stageIdx >= stageIndex('client_approval') && !selectedStage.isHold && !selectedStage.isClosed && !selected.convertedProjectId && (
                <div onClick={() => setConverting(selected)} style={{ flex: '1 1 100%', textAlign: 'center', padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#2F7D4A', color: 'white' }}>
                  → Convert to Project
                </div>
              )}
              {selected.convertedProjectId && (
                <div onClick={() => navigate('/projects')} style={{ flex: '1 1 100%', textAlign: 'center', padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#2F7D4A' }}>
                  Converted — open project #{selected.convertedProjectId}
                </div>
              )}
              <div onClick={() => openEdit(selected)} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#2F7D4A' }}>Edit Lead</div>
              <div onClick={() => deleteLead(selected.id)} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#8E2E0A' }}>Delete</div>
              {(selectedStage.isHold || selectedStage.isClosed) && (
                <div onClick={() => archiveDeal(selected, !selected.archived)} style={{ flex: '1 1 100%', textAlign: 'center', padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#2F6F68', background: '#F4F8F7' }}>
                  {selected.archived ? 'Restore from archive' : 'Archive'}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {converting && (
        <ConvertLeadDialog
          deal={converting}
          onCancel={() => setConverting(null)}
          onConverted={(project) => {
            // The card is archived server-side, so drop it from the board here.
            setDeals((prev) => prev.filter((d) => d.id !== converting.id));
            setConverting(null);
            setSelectedId(null);
            toast(`${project.name} created in ${project.stage}`);
          }}
        />
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
                    <FormField label="First Name *" hint="Given name of the primary person who contacted us."><input value={nl.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="First name" style={inputStyle} /></FormField>
                    <FormField label="Last Name *" hint="Family name."><input value={nl.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Last name" style={inputStyle} /></FormField>
                    <FormField label="Go-By Name" hint="What they prefer to be called, if it isn't their first name."><input value={nl.goByName} onChange={(e) => setField('goByName', e.target.value)} placeholder="e.g. Kate for Katherine" style={inputStyle} /></FormField>
                    <FormField label="Pronouns" hint="How to refer to them in writing."><select value={nl.pronouns} onChange={(e) => setField('pronouns', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.pronouns.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Name Pronunciation" hint="Phonetic spelling if difficult to pronounce."><input value={nl.namePronunciation} onChange={(e) => setField('namePronunciation', e.target.value)} placeholder="e.g. Mah-REE-ah" style={inputStyle} /></FormField>
                    <FormField label="Phone Number *" hint="Primary lead's best phone number."><input type="tel" value={nl.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="(555) 123-4567" style={inputStyle} /></FormField>
                    <FormField label="Email" hint="Primary lead's preferred email address."><input type="email" value={nl.email} onChange={(e) => setField('email', e.target.value)} placeholder="email@example.com" style={inputStyle} /></FormField>
                    <FormField label="Primary Point of Contact"><select value={nl.primaryPointOfContact} onChange={(e) => setField('primaryPointOfContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.primaryPointOfContact.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Preferred Contact Method" hint="How this person prefers to be reached."><select value={nl.preferredContactMethod} onChange={(e) => setField('preferredContactMethod', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.preferredContactMethod.map((o) => <option key={o}>{o}</option>)}</select></FormField>
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
                      <FormField label="Relationship of Second Contact"><select value={nl.relationshipOfSecondContact} onChange={(e) => setField('relationshipOfSecondContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{optionsWith(OPT.relationshipOfSecondContact, nl.relationshipOfSecondContact).map((o) => <option key={o}>{o}</option>)}</select></FormField>
                      <FormField label="Preferred Contact Method" hint="How this person prefers to be reached."><select value={nl.preferredContactMethodOfSecondContact} onChange={(e) => setField('preferredContactMethodOfSecondContact', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.preferredContactMethod.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    </>}
                  </FormGrid>
                </>)}
                {formTab === 3 && (<>
                  <SectionTitle>3. Source</SectionTitle>
                  <FormGrid>
                    <FormField label="Lead Source" hint="How the lead first heard about or was referred to us."><select value={nl.leadSource} onChange={(e) => setField('leadSource', e.target.value)} style={inputStyle}><option value="">Select...</option>{optionsWith(OPT.leadSource, nl.leadSource).map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    {isReferralSource(nl.leadSource) && (
                      <FormField label="Referred By" hint="Who made the referral."><input value={nl.leadSourceReferrerName} onChange={(e) => setField('leadSourceReferrerName', e.target.value)} placeholder="Name of the person referring" style={inputStyle} /></FormField>
                    )}
                    {isEventSource(nl.leadSource) && (
                      <FormField label="Where It Was" hint="Which event, or where the networking happened."><input value={nl.leadSourceEventDetail} onChange={(e) => setField('leadSourceEventDetail', e.target.value)} placeholder="Event or networking group" style={inputStyle} /></FormField>
                    )}
                  </FormGrid>
                </>)}
                {formTab === 4 && (<>
                  <SectionTitle>4. Project Location</SectionTitle>
                  <FormGrid>
                    <FormField label="Project Street Address" hint="Street number. Leave blank if no exact address."><input value={nl.projectStreetAddress} onChange={(e) => setField('projectStreetAddress', e.target.value)} placeholder="Street number" style={inputStyle} /></FormField>
                    <FormField label="Project Street Name"><input value={nl.projectStreetName} onChange={(e) => setField('projectStreetName', e.target.value)} placeholder="Street name" style={inputStyle} /></FormField>
                    <FormField label="Project City"><select value={nl.projectCity} onChange={(e) => setField('projectCity', e.target.value)} style={inputStyle}><option value="">Select city...</option>{OPT.projectCity.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Project ZIP Code"><input value={nl.projectZipCode} onChange={(e) => setField('projectZipCode', e.target.value)} placeholder="5-digit ZIP" maxLength={5} style={inputStyle} /></FormField>
                    <FormField label="Property has an HOA" hint="Work in an HOA needs association approval."><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0B1A12', cursor: 'pointer', padding: '9px 0' }}><input type="checkbox" checked={nl.hasHOA === 'Yes'} onChange={(e) => setField('hasHOA', e.target.checked ? 'Yes' : 'No')} />Yes, this property is in an HOA</label></FormField>
                    <FormField label="County"><select value={nl.countyLocation} onChange={(e) => setField('countyLocation', e.target.value)} style={inputStyle}><option value="">Select county...</option>{OPT.countyLocation.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                  </FormGrid>
                </>)}
                {formTab === 5 && (<>
                  <SectionTitle>5. Project Details</SectionTitle>
                  <FormGrid>
                    <FormField label="Property Type"><select value={nl.propertyType} onChange={(e) => setField('propertyType', e.target.value)} style={inputStyle}><option value="">Select...</option>{OPT.propertyType.map((o) => <option key={o}>{o}</option>)}</select></FormField>
                    <FormField label="Potential Project Type" hint="Sets the property type and fills in the standard scope for that code."><select value={nl.potentialProjectType} onChange={(e) => setField('potentialProjectType', e.target.value)} style={inputStyle}><option value="">Select...</option>{PROJECT_TYPE_GROUPS.map((g) => (<optgroup key={g} label={g}>{PROJECT_TYPES.filter((t) => t.group === g).map((t) => <option key={t.code} value={projectTypeLabel(t)}>{projectTypeLabel(t)}</option>)}</optgroup>))}</select></FormField>
                    <FormField label="Contract Type" hint={findContractType(nl.contractType)?.detail || 'How the work is delivered: design only, build only, or design-build.'}><select value={nl.contractType} onChange={(e) => setField('contractType', e.target.value)} style={inputStyle}><option value="">Select...</option>{CONTRACT_TYPES.map((c) => <option key={c.code} value={contractTypeLabel(c)}>{contractTypeLabel(c)}</option>)}</select></FormField>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Homework Completed</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {OPT.homeworkCompleted.map((o) => { const on = nl.homeworkCompleted.includes(o); return <div key={o} onClick={() => toggleHomework(o)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.1)'), background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#0B1A12', fontWeight: on ? 600 : 400, userSelect: 'none' }}>{o}</div>; })}
                      </div>
                      <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 6 }}>Select all preliminary work the client has already completed.</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project Vision / Scope</div>
                        {findProjectType(nl.potentialProjectType) && (
                          // Appends rather than replaces, so nothing already written is lost.
                          <span
                            onClick={() => setField('projectVision', appendScope(nl.projectVision, findProjectType(nl.potentialProjectType)!.scope))}
                            style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}
                          >
                            + Standard scope for {findProjectType(nl.potentialProjectType)!.code}
                          </span>
                        )}
                      </div>
                      <textarea value={nl.projectVision} onChange={(e) => setField('projectVision', e.target.value)} placeholder="Describe what the client wants to accomplish..." rows={5} style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }} />
                      <div style={{ fontSize: 10, color: '#9AA39D', fontStyle: 'italic', marginTop: 4 }}>The standard scope for the selected project type is filled in automatically. Add the specifics for this client.</div>
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
                    <FormField label="Decision Makers" hint="Who makes final decisions about scope, budget, and design."><select value={nl.decisionMakers} onChange={(e) => setField('decisionMakers', e.target.value)} style={inputStyle}><option value="">Select...</option>{optionsWith(OPT.decisionMakers, nl.decisionMakers).map((o) => <option key={o}>{o}</option>)}</select></FormField>
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
              <span style={{ marginRight: 'auto', fontSize: 11, color: '#7E9B93' }}>{nl.leadName.trim().length < 2 || !nl.phone.trim() ? 'First name, last name & phone required' : 'Ready to save'}</span>
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
