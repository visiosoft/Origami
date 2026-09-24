import { CostCodesSettings } from '../components/CostCodes';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { GoogleSettings } from './GoogleSettings';
import { BrandingSettings } from './BrandingSettings';
import { NotificationSettings } from './NotificationSettings';
import { PipelineSlaSettings } from './PipelineSlaSettings';
import { SmsSettings } from './SmsSettings';
import { SchedulingSettings } from './SchedulingSettings';
import { MyCalendarSettings } from './MyCalendarSettings';
import { SystemNoticeSettings } from './SystemNoticeSettings';
import { mergeTokens } from '../data/clientPersonality';
import { RichTextEditor } from '../components/RichTextEditor';
import type { ScoringCriterion } from '../data/scoring';
import { totalPossible } from '../data/scoring';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';

const BG = "'Bricolage Grotesque', serif";

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

// Settings sections and their sub-links. Extend this as more settings are added.
const SECTIONS: { group: string; items: { key: string; label: string }[] }[] = [
  { group: 'Brand', items: [
    { key: 'branding', label: 'Branding & Letterhead' },
  ] },
  { group: 'Projects', items: [
    { key: 'cost-codes', label: 'Cost Codes (CSI)' },
  ] },
  { group: 'Pipeline', items: [
    { key: 'sla', label: 'CRM Response Times' },
    { key: 'scheduling', label: 'Calendars' },
  ] },
  { group: 'Personal', items: [
    { key: 'notifications', label: 'Notifications' },
    { key: 'my-calendar', label: 'My Calendar' },
  ] },
  { group: 'Workspace', items: [
    { key: 'notice', label: 'System notice' },
  ] },
  { group: 'Integrations', items: [
    { key: 'google', label: 'Google Workspace' },
    { key: 'sms', label: 'SMS' },
  ] },
];

export function Settings() {
  const { can } = useApp();
  const isMobile = useWindowWidth() < 768;
  const [params] = useSearchParams();
  // OAuth callbacks (Google Workspace, My Calendar) land back here with ?tab=<key>.
  const tabParam = params.get('tab');
  const [active, setActive] = useState(
    tabParam === 'google' || tabParam === 'my-calendar' || tabParam === 'cost-codes' ? tabParam : 'lead-scoring',
  );

  const nav = (
    <div style={{ flexShrink: 0, width: isMobile ? '100%' : 240 }}>
      {SECTIONS.map((sec) => (
        <div key={sec.group} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', padding: '0 12px 8px' }}>{sec.group}</div>
          {sec.items.map((it) => {
            const on = active === it.key;
            return (
              <div key={it.key} onClick={() => setActive(it.key)} style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', color: on ? '#0B1A12' : '#43514D', background: on ? '#E7F0E8' : 'transparent', borderLeft: '3px solid ' + (on ? '#2F7D4A' : 'transparent'), marginBottom: 2, lineHeight: 1.3 }}>{it.label}</div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '4px 4px 40px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>Settings</div>
      <div style={{ fontSize: 13, color: '#5C6B65', marginBottom: 20 }}>Manage templates and configuration for the workspace.</div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 28, alignItems: 'flex-start' }}>
        {nav}
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
          {active === 'branding' && <BrandingSettings />}
          {active === 'sla' && <PipelineSlaSettings />}
          {active === 'scheduling' && <SchedulingSettings />}
          {active === 'notifications' && <NotificationSettings />}
          {active === 'my-calendar' && <MyCalendarSettings />}
          {active === 'sms' && <SmsSettings />}
          {active === 'google' && <GoogleSettings />}
          {active === 'notice' && <SystemNoticeSettings />}
          {active === 'cost-codes' && <CostCodesSettings canManage={can('settings', 'manage') || can('manpower_con', 'manage')} />}
        </div>
      </div>
    </div>
  );
}

export function ScoringTemplateEditor() {
  const { toast } = useApp();
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.scoring.getTemplate()
      .then((res) => { if (Array.isArray(res)) setCriteria(res as ScoringCriterion[]); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const updateCrit = (i: number, patch: Partial<ScoringCriterion>) =>
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const updateOption = (ci: number, oi: number, patch: Partial<{ label: string; points: number }>) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci
      ? { ...c, options: c.options.map((o, oidx) => (oidx === oi ? { ...o, ...patch } : o)) }
      : c));

  const addOption = (ci: number) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci ? { ...c, options: [...c.options, { label: '', points: 0 }] } : c));

  const deleteOption = (ci: number, oi: number) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci ? { ...c, options: c.options.filter((_, oidx) => oidx !== oi) } : c));

  const addCriterion = () =>
    setCriteria((prev) => [...prev, { key: 'c_' + Date.now(), order: prev.length + 1, name: 'New Criterion', subCriteria: '', maxPoints: 0, options: [] }]);

  const deleteCriterion = (ci: number) =>
    setCriteria((prev) => prev.filter((_, idx) => idx !== ci).map((c, idx) => ({ ...c, order: idx + 1 })));

  const save = () => {
    setSaving(true);
    api.scoring.saveTemplate(criteria)
      .then((res) => { if (Array.isArray(res)) setCriteria(res as ScoringCriterion[]); toast('Scoring template saved'); })
      .catch(() => toast('⚠ Failed to save template'))
      .finally(() => setSaving(false));
  };

  const total = totalPossible(criteria);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Lead Qualification Scoring Template</div>
          <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 620 }}>
            Client Qualification Checklist &amp; Point System. Used on the <strong>Project Fit Review</strong> stage to score each lead. Edit criteria, options and points below.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Total Possible</div>
            <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 24, color: '#173326', lineHeight: 1 }}>{total}</div>
          </div>
          <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white', whiteSpace: 'nowrap' }}>{saving ? 'Saving…' : 'Save Template'}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading template…</div>
      ) : (
        <>
          {criteria.map((c, ci) => (
            <div key={c.key} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#173326', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{ci + 1}</div>
                <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Qualifying Criteria</div>
                  <input value={c.name} onChange={(e) => updateCrit(ci, { name: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Sub Criteria</div>
                  <input value={c.subCriteria} onChange={(e) => updateCrit(ci, { subCriteria: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Max Points</div>
                  <input type="number" value={c.maxPoints} onChange={(e) => updateCrit(ci, { maxPoints: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div onClick={() => deleteCriterion(ci)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#8E2E0A', border: '1px solid rgba(142,46,10,0.25)' }}>Delete</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {c.options.map((o, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={o.label} onChange={(e) => updateOption(ci, oi, { label: e.target.value })} placeholder="Option label" style={{ ...inputStyle, flex: 1 }} />
                    <input type="number" value={o.points} onChange={(e) => updateOption(ci, oi, { points: Number(e.target.value) })} style={{ ...inputStyle, width: 90, flexShrink: 0 }} />
                    <div onClick={() => deleteOption(ci, oi)} title="Remove option" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#8E2E0A', border: '1px solid rgba(20,8,31,0.1)' }}>✕</div>
                  </div>
                ))}
              </div>
              <div onClick={() => addOption(ci)} style={{ marginTop: 10, display: 'inline-block', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#173326', border: '1px solid rgba(20,8,31,0.14)' }}>+ Add option</div>
            </div>
          ))}

          <div onClick={addCriterion} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#D2EAD3', color: '#173326' }}>+ Add criterion</div>
        </>
      )}
    </div>
  );
}

/** Mirrors segmentsFor in backend/src/sms/sms.service.ts. */
function smsSegments(body: string) {
  const unicode = /[^\x00-\x7F]/.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const length = body.length;
  if (length === 0) return { length, unicode, segments: 0 };
  return { length, unicode, segments: length <= single ? 1 : Math.ceil(length / multi) };
}

interface EmailTemplate { id: string; key?: string; name: string; subject?: string; body: string; kind?: string; category?: string; updatedAt?: string; }
const BLANK_TEMPLATE: EmailTemplate = { id: '', name: 'New Template', subject: '', body: '', kind: 'email', category: '' };
/** Kinds edited with the full rich text editor (tables, images, headings) rather than a plain textarea. */
const isRichKind = (kind?: string) => kind === 'agreement' || kind === 'introduction';

export function EmailTemplatesEditor({ filterKind, sendable }: { filterKind?: string; sendable?: boolean } = {}) {
  const { toast, can } = useApp();
  const canManage = can('settings', 'manage');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<EmailTemplate | null>(null);

  const reload = (selectId?: string) => {
    api.emailTemplates.list()
      .then((r: any) => { if (Array.isArray(r)) { setTemplates(r as EmailTemplate[]); if (selectId) { const t = r.find((x: EmailTemplate) => x.id === selectId); if (t) setDraft({ ...t }); } } })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  const visible = filterKind ? templates.filter((t) => (t.kind || 'email') === filterKind) : templates;

  const openTemplate = (t: EmailTemplate) => { setDraft({ ...t }); setIsNew(false); };
  const openNew = () => { setDraft({ ...BLANK_TEMPLATE, kind: filterKind || 'email' }); setIsNew(true); };
  const closeEditor = () => { setDraft(null); setIsNew(false); };

  const save = () => {
    if (!draft || !draft.name.trim() || !draft.body.trim()) { toast('Name and body are required'); return; }
    setSaving(true);
    const req = isNew
      ? api.emailTemplates.create({ name: draft.name, subject: draft.subject, body: draft.body, kind: draft.kind || 'email', category: draft.category })
      : api.emailTemplates.update(draft.id, { name: draft.name, subject: draft.subject, body: draft.body, kind: draft.kind, category: draft.category });
    req.then((res: any) => { toast('Template saved'); setIsNew(false); reload(res?.id || draft.id); })
      .catch(() => toast('⚠ Failed to save template'))
      .finally(() => setSaving(false));
  };

  const del = () => {
    if (!draft || isNew) { closeEditor(); return; }
    if (!confirm(`Delete template "${draft.name}"?`)) return;
    api.emailTemplates.delete(draft.id).then(() => { toast('Template deleted'); closeEditor(); reload(); }).catch(() => toast('⚠ Failed to delete'));
  };

  const firstLine = (s: string, isRich?: boolean) => {
    const plain = isRich ? (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : (s || '');
    return plain.replace(/\{\{[^}]+\}\}/g, '…').split('\n').find((l) => l.trim()) || '';
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>{filterKind === 'agreement' ? 'Agreement Templates' : filterKind === 'introduction' ? 'Introduction Letter' : 'Email & Document Templates'}</div>
          <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 620 }}>
            {filterKind === 'agreement'
              ? <>Reusable agreements between us and a client -- draft one here, then use <strong>Send to client</strong> on any card to fill it in and email it. Use <code>{'{{clientName}}'}</code>, <code>{'{{clientEmail}}'}</code>, <code>{'{{date}}'}</code> — they fill in when you send.</>
              : filterKind === 'introduction'
              ? <>The one letter every new project starts with — built once here, then reused for each project with only the client's details swapped in. Use <code>{'{{clientName}}'}</code>, <code>{'{{clientEmail}}'}</code>, <code>{'{{clientPhone}}'}</code>, <code>{'{{projectTitle}}'}</code>, <code>{'{{projectScope}}'}</code>, <code>{'{{date}}'}</code> — they fill in from the linked lead when it's sent. Your branding's header, footer, cover page and About Us page are added automatically.</>
              : <>Reusable client emails and documents (e.g. the <strong>Introduction Letter</strong>). Use <code>{'{{clientName}}'}</code>, <code>{'{{clientEmail}}'}</code>, <code>{'{{clientPhone}}'}</code>, <code>{'{{projectTitle}}'}</code>, <code>{'{{projectScope}}'}</code>, <code>{'{{date}}'}</code> — they fill in from the linked lead &amp; project when the template is used.</>}
          </div>
        </div>
        {canManage && !(filterKind === 'introduction' && visible.length > 0) && (
          <div onClick={openNew} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', whiteSpace: 'nowrap' }}>+ New Template</div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading templates…</div>
      ) : draft ? (
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: '#0B1A12' }}>{isNew ? 'New template' : 'Edit template'}</div>
            <div onClick={closeEditor} style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#7E9B93' }}>← Back to list</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Template name</div>
              <input value={draft.name} disabled={!canManage} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Kind</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['email', 'sms', 'document', 'proposal', 'agreement', 'introduction'] as const).map((k) => (
                  <span key={k} onClick={() => canManage && setDraft({ ...draft, kind: k })} style={{
                    padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: canManage ? 'pointer' : 'default',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: (draft.kind || 'email') === k ? '#173326' : 'white',
                    color: (draft.kind || 'email') === k ? 'white' : '#7E9B93',
                    border: '1px solid ' + ((draft.kind || 'email') === k ? '#173326' : 'rgba(20,8,31,0.12)'),
                  }}>{k}</span>
                ))}
              </div>
            </div>
            {draft.kind !== 'sms' && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Subject</div>
                <input value={draft.subject || ''} disabled={!canManage} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Body</div>
                {draft.kind === 'sms' && (() => {
                  const m = smsSegments(draft.body || '');
                  return (
                    <span title="Merge fields expand when sent, so a real message may run longer than this."
                      style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: m.segments > 1 ? '#93520F' : '#7E9B93' }}>
                      {m.length} chars · {m.segments} segment{m.segments === 1 ? '' : 's'}{m.unicode ? ' · unicode' : ''}
                    </span>
                  );
                })()}
              </div>
              {isRichKind(draft.kind) ? (
                <RichTextEditor value={draft.body} onChange={(html) => setDraft({ ...draft, body: html })} minHeight={360} />
              ) : (
                <textarea value={draft.body} disabled={!canManage} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={draft.kind === 'sms' ? 5 : 20} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap' }} />
              )}
              {draft.kind === 'sms' && (
                <div style={{ fontSize: 10.5, color: '#9AA39D', marginTop: 4, lineHeight: 1.45 }}>
                  One segment is 160 characters, or 70 if any character is outside the GSM set. Longer messages are sent as several segments and billed as several.
                </div>
              )}
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
              <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>{saving ? 'Saving…' : (isNew ? 'Create template' : 'Save changes')}</div>
              {!isNew && <div onClick={del} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete</div>}
            </div>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9AA39D', fontStyle: 'italic', padding: '20px 0' }}>No templates yet. Click “+ New Template” to create one.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {visible.map((t) => (
            <div key={t.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 16 }}>
              <div onClick={() => openTemplate(t)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1A12', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  {!filterKind && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#E7F0E8', color: '#2F6F68', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.kind || 'email'}</span>}
                </div>
                {t.subject && <div style={{ fontSize: 11.5, color: '#43514D', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>}
                <div style={{ fontSize: 11.5, color: '#7E9B93', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{firstLine(t.body, isRichKind(t.kind))}</div>
              </div>
              {sendable && (
                <div onClick={() => setSendingTemplate(t)} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(20,8,31,0.06)', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>
                  ✉ Send to client
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {sendingTemplate && <SendTemplateModal template={sendingTemplate} onClose={() => setSendingTemplate(null)} />}
    </div>
  );
}

/** Fills in a template's merge fields and emails it on the letterhead, as a one-off PDF -- no lead/project link required. */
function SendTemplateModal({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const { toast } = useApp();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [clientName, setClientName] = useState('');
  const [subject, setSubject] = useState(template.subject || template.name);
  const [body, setBody] = useState(template.body);
  const [sending, setSending] = useState(false);

  const fill = () => {
    const tokens = { clientName: clientName || 'there', clientEmail: to, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) };
    setSubject(mergeTokens(template.subject || template.name, tokens));
    setBody(mergeTokens(template.body, tokens));
  };
  useEffect(fill, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRich = isRichKind(template.kind);

  const send = () => {
    if (!to.trim()) { toast('Who should it go to?'); return; }
    setSending(true);
    api.google.sendLetter({
      to: to.trim(), cc: cc.trim() || undefined, subject: subject.trim() || template.name,
      // A rich (agreement) body is already real HTML; a plain one is still
      // just text with blank-line paragraph breaks, same as before.
      html: isRich ? body : body.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join(''),
      recipient: clientName.trim() || undefined,
      filename: template.name,
    })
      .then(() => { toast(`Sent to ${to.trim()}`); onClose(); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSending(false));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 22, width: isRich ? 640 : 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(20,8,31,0.25)' }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 17, color: '#0B1A12', marginBottom: 2 }}>Send "{template.name}"</div>
        <div style={{ fontSize: 12, color: '#7E9B93', marginBottom: 16 }}>Emailed as a letterhead PDF from the connected Google Workspace account.</div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>To</div>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Client name</div>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} onBlur={fill} placeholder="Fills {{clientName}}" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>CC</div>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Subject</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Body</div>
            {isRich ? (
              <RichTextEditor value={body} onChange={setBody} minHeight={320} />
            ) : (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <div onClick={onClose} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
          <div onClick={sending ? undefined : send} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: sending ? 'default' : 'pointer', background: sending ? '#9AB0A4' : '#173326', color: 'white' }}>
            {sending ? 'Sending…' : 'Send'}
          </div>
        </div>
      </div>
    </div>
  );
}
