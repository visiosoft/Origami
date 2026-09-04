import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { GoogleSettings } from './GoogleSettings';
import { BrandingSettings } from './BrandingSettings';
import { NotificationSettings } from './NotificationSettings';
import { PipelineSlaSettings } from './PipelineSlaSettings';
import { ProgrammeTemplate } from './ProgrammeTemplate';
import { SmsSettings } from './SmsSettings';
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
  { group: 'Templates', items: [
    { key: 'lead-scoring', label: 'Lead Qualification Scoring Template' },
    { key: 'email-templates', label: 'Email & Document Templates' },
  ] },
  { group: 'Brand', items: [
    { key: 'branding', label: 'Branding & Letterhead' },
  ] },
  { group: 'Projects', items: [
    { key: 'programme', label: 'Programme Template' },
  ] },
  { group: 'Pipeline', items: [
    { key: 'sla', label: 'CRM Response Times' },
  ] },
  { group: 'Personal', items: [
    { key: 'notifications', label: 'Notifications' },
  ] },
  { group: 'Integrations', items: [
    { key: 'google', label: 'Google Workspace' },
    { key: 'sms', label: 'SMS' },
  ] },
];

export function Settings() {
  const isMobile = useWindowWidth() < 768;
  const [params] = useSearchParams();
  // The Google OAuth callback lands back here with ?tab=google.
  const [active, setActive] = useState(params.get('tab') === 'google' ? 'google' : 'lead-scoring');

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
          {active === 'lead-scoring' && <ScoringTemplateEditor />}
          {active === 'email-templates' && <EmailTemplatesEditor />}
          {active === 'branding' && <BrandingSettings />}
          {active === 'programme' && <ProgrammeTemplate />}
          {active === 'sla' && <PipelineSlaSettings />}
          {active === 'notifications' && <NotificationSettings />}
          {active === 'sms' && <SmsSettings />}
          {active === 'google' && <GoogleSettings />}
        </div>
      </div>
    </div>
  );
}

function ScoringTemplateEditor() {
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

function EmailTemplatesEditor() {
  const { toast, can } = useApp();
  const canManage = can('settings', 'manage');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);

  const reload = (selectId?: string) => {
    api.emailTemplates.list()
      .then((r: any) => { if (Array.isArray(r)) { setTemplates(r as EmailTemplate[]); if (selectId) { const t = r.find((x: EmailTemplate) => x.id === selectId); if (t) setDraft({ ...t }); } } })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  const openTemplate = (t: EmailTemplate) => { setDraft({ ...t }); setIsNew(false); };
  const openNew = () => { setDraft({ ...BLANK_TEMPLATE }); setIsNew(true); };
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

  const firstLine = (s: string) => (s || '').replace(/\{\{[^}]+\}\}/g, '…').split('\n').find((l) => l.trim()) || '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Email &amp; Document Templates</div>
          <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 620 }}>
            Reusable client emails and documents (e.g. the <strong>Introduction Letter</strong>). Use <code>{'{{clientName}}'}</code>, <code>{'{{clientEmail}}'}</code>, <code>{'{{clientPhone}}'}</code>, <code>{'{{projectTitle}}'}</code>, <code>{'{{projectScope}}'}</code>, <code>{'{{date}}'}</code> — they fill in from the linked lead &amp; project when the template is used.
          </div>
        </div>
        {canManage && <div onClick={openNew} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', whiteSpace: 'nowrap' }}>+ New Template</div>}
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
                {(['email', 'sms', 'document'] as const).map((k) => (
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
              <textarea value={draft.body} disabled={!canManage} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={draft.kind === 'sms' ? 5 : 20} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap' }} />
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
      ) : templates.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9AA39D', fontStyle: 'italic', padding: '20px 0' }}>No templates yet. Click “+ New Template” to create one.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {templates.map((t) => (
            <div key={t.id} onClick={() => openTemplate(t)} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1A12', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#E7F0E8', color: '#2F6F68', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.kind || 'email'}</span>
              </div>
              {t.subject && <div style={{ fontSize: 11.5, color: '#43514D', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>}
              <div style={{ fontSize: 11.5, color: '#7E9B93', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{firstLine(t.body)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
