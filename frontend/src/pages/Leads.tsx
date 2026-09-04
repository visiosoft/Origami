import { useState } from 'react';
import { PROJECT_TYPES, PROJECT_TYPE_GROUPS, projectTypeLabel, projectTypePatch, findProjectType, appendScope, CONTRACT_TYPES, contractTypeLabel, findContractType } from '../data/projectTypes';
import { LEADS, LEAD_DROPDOWN_OPTIONS, type Lead, composeLeadName, optionsWith, isReferralSource, isEventSource, sourceDetailLabel, primaryContactMethod } from '../data/leads';
import { OtherDetail } from '../components/OtherDetail';
import { ContactMethodMatrix } from '../components/ContactMethodMatrix';
import { countyForCity } from '../data/californiaCounties';
import { useApp } from '../AppContext';
import { ContactsDirectory } from '../components/ContactsDirectory';
import { seedContactsFromLead, type LeadContact } from '../data/leadContacts';
import { api } from '../api';
import './Leads.css';

type NewLead = Omit<Lead, 'id' | 'createdAt'>;
const BLANK: NewLead = {
    leadName: '', firstName: '', lastName: '', goByName: '', pronouns: '',
    namePronunciation: '', phone: '', email: '',
    primaryPointOfContact: '', secondPointOfContact: '', nameOfSecondContact: '',
    phoneOfSecondContact: '', emailOfSecondContact: '', relationshipOfSecondContact: '',
    preferredContactMatrix: {},
    preferredContactMethodOfSecondContact: '', pronounsOfSecondContact: '',
    leadSourceReferrerName: '', leadSourceReferrerPhone: '', leadSourceEventDetail: '',
    otherDetails: {},
    decisionMakers: '', preferredContactMethod: '', leadSource: '',
    projectStreetAddress: '', projectStreetName: '', projectCity: '', projectZipCode: '',
    projectAddress2: '', occupancyStatus: '', countyLocation: '', hasHOA: 'No', propertyType: '', potentialProjectType: '', contractType: '', homeworkCompleted: [],
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

const OPT = LEAD_DROPDOWN_OPTIONS;

export function Leads() {
    const { toast } = useApp();
    const [leads, setLeads] = useState<Lead[]>(LEADS);
    // Edited in place; seeded from the intake fields the first time it opens.
    const [contactsByLead, setContactsByLead] = useState<Record<string, LeadContact[]>>({});
    const [showForm, setShowForm] = useState(false);
    const [tab, setTab] = useState(1);
    const [form, setForm] = useState<NewLead>({ ...BLANK });
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const set = <K extends keyof NewLead>(k: K, v: NewLead[K]) => setForm((f) => {
        const next = { ...f, [k]: v } as NewLead;
        // leadName is the display name the rest of the app reads.
        if (k === 'preferredContactMatrix') next.preferredContactMethod = primaryContactMethod(next.preferredContactMatrix);
        // Picking a city settles the county; it stays editable for the edge cases.
        if (k === 'projectCity') { const c = countyForCity(String(v)); if (c) next.countyLocation = c; }
        if (k === 'firstName' || k === 'lastName') {
            next.leadName = composeLeadName(next.firstName, next.lastName, next.leadName);
        }
        if (k === 'potentialProjectType') Object.assign(next, projectTypePatch(String(v), next.projectVision));
        return next;
    });
    const toggleHomework = (v: string) => set('homeworkCompleted', form.homeworkCompleted.includes(v) ? form.homeworkCompleted.filter((x) => x !== v) : [...form.homeworkCompleted, v]);

    const openNew = () => { setForm({ ...BLANK }); setTab(1); setShowForm(true); };
    const close = () => setShowForm(false);

    const submit = () => {
        if (!form.leadName.trim() || !form.phone.trim()) return;
        const lead: Lead = { ...form, id: 'LD-' + String(1000 + leads.length + 1), createdAt: new Date().toISOString().slice(0, 10) };
        setLeads((prev) => [lead, ...prev]);
        setShowForm(false);
        setSelectedId(lead.id);
        toast(`Lead "${lead.leadName}" created`);
        void api.leads.create(form).catch(() => undefined);
    };

    const selected = selectedId ? leads.find((l) => l.id === selectedId) : null;

    return (
        <div className="leads-page">
            <div className="leads-header">
                <div className="leads-title">Leads Intake</div>
                <button className="leads-btn-new" onClick={openNew}><span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New Lead</button>
            </div>

            {/* Lead cards */}
            <div className="leads-list">
                {leads.map((l) => (
                    <div key={l.id} className={`lead-card${selectedId === l.id ? ' active' : ''}`} onClick={() => setSelectedId(l.id)}>
                        <div className="lead-card-top">
                            <div className="lead-card-name">{l.leadName}</div>
                            <div className="lead-card-id">{l.id} · {l.createdAt}</div>
                        </div>
                        <div className="lead-card-meta">
                            <span>{l.phone}</span>
                            <span>{l.email}</span>
                            <span>{l.projectCity || '—'}</span>
                            <span>{l.potentialProjectType || '—'}</span>
                            <span>{l.leadSource || '—'}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail view */}
            {selected && (
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.06)', padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93' }}>{selected.id} · {selected.createdAt}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0B1A12', marginTop: 4 }}>{selected.leadName}</div>
                            {selected.namePronunciation && <div style={{ fontSize: 11, color: '#9AA39D', fontStyle: 'italic' }}>{selected.namePronunciation}</div>}
                        </div>
                        <button onClick={() => setSelectedId(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#7E9B93' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px 24px', fontSize: 12 }}>
                        <Field label="Phone" value={selected.phone} />
                        <Field label="Email" value={selected.email} />
                        <Field label="Go-By Name" value={selected.goByName} />
                        <Field label="Pronouns" value={selected.pronouns} />
                        <Field label="Primary Contact" value={selected.primaryPointOfContact} />
                        <Field label="Lead Source" value={selected.leadSource} />
                        <Field label="Preferred Contact" value={selected.preferredContactMethod} />
                        <Field label="Referred By" value={selected.leadSourceReferrerName} />
                        <Field label="Where It Was" value={selected.leadSourceEventDetail} />
                        <Field label="Decision Makers" value={selected.decisionMakers} />
                        {selected.secondPointOfContact === 'Yes' && <>
                            <Field label="2nd Contact" value={selected.nameOfSecondContact} />
                            <Field label="2nd Phone" value={selected.phoneOfSecondContact} />
                            <Field label="2nd Email" value={selected.emailOfSecondContact} />
                            <Field label="2nd Relationship" value={selected.relationshipOfSecondContact} />
                        </>}
                        <Field label="Address" value={`${selected.projectStreetAddress} ${selected.projectStreetName}`} />
                        <Field label="City" value={selected.projectCity} />
                        <Field label="ZIP" value={selected.projectZipCode} />
                        <Field label="County" value={selected.countyLocation} />
                        <Field label="Property Type" value={selected.propertyType} />
                        <Field label="Project Type" value={selected.potentialProjectType} />
                        <Field label="Homework" value={selected.homeworkCompleted.join(', ') || '—'} />
                        <Field label="Reason" value={selected.reasonForProject} />
                        <Field label="Budget Position" value={selected.budgetPosition} />
                        <Field label="Funding" value={selected.fundingStatus} />
                        <Field label="Desired Start" value={selected.desiredStart} />
                        <Field label="Expected Duration" value={selected.expectedDuration} />
                        <Field label="Ownership Length" value={selected.expectedLengthOfOwnership} />
                        <Field label="Personality" value={selected.clientPersonality} />
                    </div>
                    {selected.projectVision && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', marginBottom: 4 }}>Project Vision</div>
                            <div style={{ fontSize: 12, color: '#0B1A12', lineHeight: 1.5 }}>{selected.projectVision}</div>
                        </div>
                    )}

                    {/* Everyone involved, with their roles. Same directory as the pipeline lead card. */}
                    <div style={{ marginTop: 18, marginLeft: -20, marginRight: -20, borderTop: '1px solid rgba(20,8,31,0.08)' }}>
                        <ContactsDirectory
                            leadId={selected.id}
                            leadName={selected.leadName}
                            phone={selected.phone}
                            contacts={contactsByLead[selected.id]
                                ?? ((selected.contacts as LeadContact[] | undefined)?.length
                                    ? (selected.contacts as LeadContact[])
                                    : seedContactsFromLead(selected as unknown as Record<string, unknown>))}
                            onChange={(next) => setContactsByLead((p) => ({ ...p, [selected.id]: next }))}
                        />
                    </div>
                </div>
            )}

            {/* New Lead Modal */}
            {showForm && (
                <div className="leads-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                    <div className="leads-modal">
                        <div className="leads-modal-header">
                            <div className="leads-modal-title">New Lead Intake</div>
                            <button className="leads-modal-close" onClick={close}>
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
                            </button>
                        </div>

                        <div className="leads-tabs">
                            {TABS.map((t) => (
                                <div key={t.id} className={`leads-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>
                            ))}
                        </div>

                        <div className="leads-form-body">
                            {tab === 1 && <TabContact form={form} set={set} />}
                            {tab === 2 && <TabSecondContact form={form} set={set} />}
                            {tab === 3 && <TabCommunication form={form} set={set} />}
                            {tab === 4 && <TabLocation form={form} set={set} />}
                            {tab === 5 && <TabProjectDetails form={form} set={set} toggleHomework={toggleHomework} />}
                            {tab === 6 && <TabBudgetTimeline form={form} set={set} />}
                            {tab === 7 && <TabClientProfile form={form} set={set} />}
                        </div>

                        <div className="leads-modal-footer">
                            {tab > 1 && <button className="leads-btn-cancel" onClick={() => setTab(tab - 1)}>← Previous</button>}
                            {tab < 7 ? (
                                <button className="leads-btn-submit" onClick={() => setTab(tab + 1)}>Next →</button>
                            ) : (
                                <button className="leads-btn-submit" disabled={!form.leadName.trim() || !form.phone.trim()} onClick={submit}>Create Lead</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
            <div style={{ color: '#0B1A12' }}>{value || '—'}</div>
        </div>
    );
}

/* --- Tab Sections --- */

function TabContact({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">1. Contact Information</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>First Name *</label>
                <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="First name" />
                <span className="hint">Given name of the primary person who contacted us or is leading the project.</span>
            </div>
            <div className="leads-field">
                <label>Last Name *</label>
                <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Last name" />
                <span className="hint">Family name.</span>
            </div>
            <div className="leads-field">
                <label>Go-By Name</label>
                <input value={form.goByName} onChange={(e) => set('goByName', e.target.value)} placeholder="e.g. Kate for Katherine" />
                <span className="hint">What they prefer to be called, if it isn't their first name.</span>
            </div>
            <div className="leads-field full">
                <ContactMethodMatrix value={form.preferredContactMatrix} onChange={(mx) => set('preferredContactMatrix', mx)} />
            </div>
            <div className="leads-field">
                <label>Pronouns</label>
                <select value={form.pronouns} onChange={(e) => set('pronouns', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.pronouns.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.pronouns} field="pronouns" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                <span className="hint">How to refer to them in writing.</span>
            </div>
            <div className="leads-field">
                <label>Name Pronunciation</label>
                <input value={form.namePronunciation} onChange={(e) => set('namePronunciation', e.target.value)} placeholder="Phonetic spelling" />
                <span className="hint">Simple phonetic spelling if the name may be difficult to pronounce.</span>
            </div>
            <div className="leads-field">
                <label>Phone Number *</label>
                <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" />
                <span className="hint">Primary lead's best phone number.</span>
            </div>
            <div className="leads-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" />
                <span className="hint">Primary lead's preferred email address.</span>
            </div>
            <div className="leads-field">
                <label>Primary Point of Contact</label>
                <select value={form.primaryPointOfContact} onChange={(e) => set('primaryPointOfContact', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.primaryPointOfContact.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        </div>
    </>);
}

function TabSecondContact({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">2. Second Point of Contact</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Second Point of Contact?</label>
                <select value={form.secondPointOfContact} onChange={(e) => set('secondPointOfContact', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.secondPointOfContact.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="hint">Indicate whether there is another person to include in communications.</span>
            </div>
            {form.secondPointOfContact === 'Yes' && <>
                <div className="leads-field">
                    <label>Name of Second Contact</label>
                    <input value={form.nameOfSecondContact} onChange={(e) => set('nameOfSecondContact', e.target.value)} placeholder="Full name" />
                </div>
                <div className="leads-field">
                    <label>Phone of Second Contact</label>
                    <input type="tel" value={form.phoneOfSecondContact} onChange={(e) => set('phoneOfSecondContact', e.target.value)} placeholder="(555) 123-4567" />
                    <span className="hint">Include area code.</span>
                </div>
                <div className="leads-field">
                    <label>Email of Second Contact</label>
                    <input type="email" value={form.emailOfSecondContact} onChange={(e) => set('emailOfSecondContact', e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="leads-field">
                    <label>Relationship of Second Contact</label>
                    <select value={form.relationshipOfSecondContact} onChange={(e) => set('relationshipOfSecondContact', e.target.value)}>
                        <option value="">Select...</option>
                        {optionsWith(OPT.relationshipOfSecondContact, form.relationshipOfSecondContact).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                <OtherDetail value={form.relationshipOfSecondContact} field="relationshipOfSecondContact" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                </div>
                <div className="leads-field">
                    <label>Pronouns</label>
                    <select value={form.pronounsOfSecondContact} onChange={(e) => set('pronounsOfSecondContact', e.target.value)}>
                        <option value="">Select...</option>
                        {OPT.pronouns.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                <OtherDetail value={form.pronounsOfSecondContact} field="pronounsOfSecondContact" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                    <span className="hint">How to refer to them in writing.</span>
                </div>
                <div className="leads-field">
                    <label>Preferred Contact Method</label>
                    <select value={form.preferredContactMethodOfSecondContact} onChange={(e) => set('preferredContactMethodOfSecondContact', e.target.value)}>
                        <option value="">Select...</option>
                        {OPT.preferredContactMethod.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <span className="hint">How this person prefers to be reached.</span>
                </div>
            </>}
        </div>
    </>);
}

function TabCommunication({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">3. Source</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Lead Source</label>
                <select value={form.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
                    <option value="">Select...</option>
                    {optionsWith(OPT.leadSource, form.leadSource).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.leadSource} field="leadSource" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                <span className="hint">How the lead first heard about or was referred to us.</span>
            </div>
            {(() => {
                const d = sourceDetailLabel(form.leadSource);
                return (
                    <>
                        <div className="leads-field">
                            <label>{d.label}</label>
                            <input value={form.leadSourceReferrerName} onChange={(e) => set('leadSourceReferrerName', e.target.value)} placeholder={d.ph} />
                            <span className="hint">{d.hint}</span>
                        </div>
                        {isReferralSource(form.leadSource) && (
                            <div className="leads-field">
                                <label>Referrer Phone</label>
                                <input type="tel" value={form.leadSourceReferrerPhone} onChange={(e) => set('leadSourceReferrerPhone', e.target.value)} placeholder="(555) 123-4567" />
                                <span className="hint">How to reach the person who referred them.</span>
                            </div>
                        )}
                    </>
                );
            })()}
            {isEventSource(form.leadSource) && (
                <div className="leads-field">
                    <label>Where It Was</label>
                    <input value={form.leadSourceEventDetail} onChange={(e) => set('leadSourceEventDetail', e.target.value)} placeholder="Event or networking group" />
                    <span className="hint">Which event, or where the networking happened.</span>
                </div>
            )}
        </div>
    </>);
}

function TabLocation({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">4. Project Location</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Project Street Address</label>
                <input value={form.projectStreetAddress} onChange={(e) => set('projectStreetAddress', e.target.value)} placeholder="Street number" />
                <span className="hint">Enter the street number. If no exact address, leave blank.</span>
            </div>
            <div className="leads-field">
                <label>Project Street Name</label>
                <input value={form.projectStreetName} onChange={(e) => set('projectStreetName', e.target.value)} placeholder="Street name" />
            </div>
            <div className="leads-field">
                <label>Address 2</label>
                <input value={form.projectAddress2} onChange={(e) => set('projectAddress2', e.target.value)} placeholder="e.g. Suite 400" />
                <span className="hint">Unit, suite or floor.</span>
            </div>
            <div className="leads-field">
                <label>Project City</label>
                <select value={form.projectCity} onChange={(e) => set('projectCity', e.target.value)}>
                    <option value="">Select city...</option>
                    {OPT.projectCity.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div className="leads-field">
                <label>Project ZIP Code</label>
                <input value={form.projectZipCode} onChange={(e) => set('projectZipCode', e.target.value)} placeholder="5-digit ZIP" maxLength={5} />
            </div>
            <div className="leads-field">
                <label>Property has an HOA</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0B1A12', cursor: 'pointer', padding: '9px 0' }}>
                    <input type="checkbox" checked={form.hasHOA === 'Yes'} onChange={(e) => set('hasHOA', e.target.checked ? 'Yes' : 'No')} />
                    Yes, this property is in an HOA
                </label>
                <span className="hint">Work in an HOA needs association approval.</span>
            </div>
            <div className="leads-field">
                <label>County</label>
                <select value={form.countyLocation} onChange={(e) => set('countyLocation', e.target.value)}>
                    <option value="">Select county...</option>
                    {OPT.countyLocation.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div className="leads-field">
                <label>Owner or Tenant</label>
                <select value={form.occupancyStatus} onChange={(e) => set('occupancyStatus', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.occupancyStatus.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.occupancyStatus} field="occupancyStatus" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                <span className="hint">Who the client is to the property. It decides whose approval the work needs.</span>
            </div>
        </div>
    </>);
}

function TabProjectDetails({ form, set, toggleHomework }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void; toggleHomework: (v: string) => void }) {
    return (<>
        <div className="leads-form-section-title">5. Project Details</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Property Type</label>
                <select value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.propertyType.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.propertyType} field="propertyType" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
            </div>
            <div className="leads-field">
                <label>Potential Project Type</label>
                <select value={form.potentialProjectType} onChange={(e) => set('potentialProjectType', e.target.value)}>
                    <option value="">Select...</option>
                    {PROJECT_TYPE_GROUPS.map((g) => (
                        <optgroup key={g} label={g}>
                            {PROJECT_TYPES.filter((t) => t.group === g).map((t) => (
                                <option key={t.code} value={projectTypeLabel(t)}>{projectTypeLabel(t)}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <OtherDetail value={form.potentialProjectType} field="potentialProjectType" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                <span className="hint">Sets the property type and fills in the standard scope for that code.</span>
            </div>
            <div className="leads-field">
                <label>Contract Type</label>
                <select value={form.contractType} onChange={(e) => set('contractType', e.target.value)}>
                    <option value="">Select...</option>
                    {CONTRACT_TYPES.map((c) => <option key={c.code} value={contractTypeLabel(c)}>{contractTypeLabel(c)}</option>)}
                </select>
                <span className="hint">{findContractType(form.contractType)?.detail || 'How the work is delivered: design only, build only, or design-build.'}</span>
            </div>
            <div className="leads-field full">
                <label>Homework Completed</label>
                <div className="leads-checkbox-group">
                    {OPT.homeworkCompleted.map((o) => (
                        <label key={o} className={`leads-checkbox-item${form.homeworkCompleted.includes(o) ? ' checked' : ''}`}>
                            <input type="checkbox" checked={form.homeworkCompleted.includes(o)} onChange={() => toggleHomework(o)} />
                            {o}
                        </label>
                    ))}
                </div>
                <span className="hint">Select all preliminary work the client has already completed.</span>
            </div>
            <div className="leads-field full">
                <label>
                    Project Vision / Scope
                    {findProjectType(form.potentialProjectType) && (
                        <span
                            onClick={() => set('projectVision', appendScope(form.projectVision, findProjectType(form.potentialProjectType)!.scope))}
                            style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}
                        >
                            + Standard scope for {findProjectType(form.potentialProjectType)!.code}
                        </span>
                    )}
                </label>
                <textarea value={form.projectVision} onChange={(e) => set('projectVision', e.target.value)} placeholder="Describe what the client wants to accomplish..." />
                <span className="hint">The standard scope for the selected project type is filled in automatically. Add the specifics for this client.</span>
            </div>
        </div>
    </>);
}

function TabBudgetTimeline({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">6. Budget & Timeline</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Reason for Project</label>
                <select value={form.reasonForProject} onChange={(e) => set('reasonForProject', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.reasonForProject.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.reasonForProject} field="reasonForProject" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
            </div>
            <div className="leads-field">
                <label>Budget Position</label>
                <select value={form.budgetPosition} onChange={(e) => set('budgetPosition', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.budgetPosition.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="hint">How the client currently thinks about budget.</span>
            </div>
            <div className="leads-field">
                <label>Funding Status</label>
                <select value={form.fundingStatus} onChange={(e) => set('fundingStatus', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.fundingStatus.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="hint">How prepared the client is to fund the project.</span>
            </div>
            <div className="leads-field">
                <label>Desired Start</label>
                <select value={form.desiredStart} onChange={(e) => set('desiredStart', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.desiredStart.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div className="leads-field">
                <label>Expected Duration</label>
                <select value={form.expectedDuration} onChange={(e) => set('expectedDuration', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.expectedDuration.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="hint">Client's expectation, not our estimated schedule.</span>
            </div>
            <div className="leads-field">
                <label>Expected Length of Ownership</label>
                <select value={form.expectedLengthOfOwnership} onChange={(e) => set('expectedLengthOfOwnership', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.expectedLengthOfOwnership.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        </div>
    </>);
}

function TabClientProfile({ form, set }: { form: NewLead; set: <K extends keyof NewLead>(k: K, v: NewLead[K]) => void }) {
    return (<>
        <div className="leads-form-section-title">7. Client Profile</div>
        <div className="leads-form-grid">
            <div className="leads-field">
                <label>Decision Makers</label>
                <select value={form.decisionMakers} onChange={(e) => set('decisionMakers', e.target.value)}>
                    <option value="">Select...</option>
                    {optionsWith(OPT.decisionMakers, form.decisionMakers).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <OtherDetail value={form.decisionMakers} field="decisionMakers" details={form.otherDetails} onChange={(d) => set('otherDetails', d)} />
                <span className="hint">Who makes final decisions about scope, budget, and design.</span>
            </div>
            <div className="leads-field full">
                <label>Client Personality</label>
                <select value={form.clientPersonality} onChange={(e) => set('clientPersonality', e.target.value)}>
                    <option value="">Select...</option>
                    {OPT.clientPersonality.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="hint">Based on the first conversation, select the personality style that most closely reflects how the client communicates and makes decisions.</span>
            </div>
        </div>
    </>);
}
