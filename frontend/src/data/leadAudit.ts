import { api } from '../api';

/**
 * Saves a lead's fields AND records the edit on the deal's audit trail in one
 * call, so a save site can't do one without the other -- which is how most
 * lead-touching saves ended up invisible in the Audit Trail panel before
 * this existed (it only reads deal.timeline/stageNotes, never the leads
 * table directly).
 *
 * `dealId` is optional: omit it for a standalone LD- lead saved from
 * Leads.tsx, which has no corresponding PL- deal/timeline to write to.
 */
export function saveLeadWithAudit(
  leadId: string,
  patch: Record<string, unknown>,
  auditText: string,
  dealId?: string,
): Promise<unknown> {
  const p = api.leads.update(leadId, patch);
  if (dealId) p.then(() => api.pipeline.addEvent(dealId, auditText).catch(() => {}));
  return p;
}
