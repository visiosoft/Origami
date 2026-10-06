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
  const p = api.leads.update(leadId, patch).then((saved: any) => { noteLeadStamp(leadId, saved?.updatedAt); return saved; });
  if (dealId) p.then(() => api.pipeline.addEvent(dealId, auditText).catch(() => {}));
  return p;
}

/**
 * The newest version stamp (updatedAt) the server has given each lead, from any
 * save on any screen. A save sends it as expectedUpdatedAt; keeping it in one
 * place means a quick save elsewhere (a meeting, a site visit, a fit score,
 * contacts) can't make the next form save look stale and get rejected -- which
 * is how lead edits were being lost.
 */
const stamps = new Map<string, string>();
export function noteLeadStamp(leadId: string, at?: string | null) {
  if (!at) return;
  const cur = stamps.get(leadId);
  if (!cur || at > cur) stamps.set(leadId, at);
}
/** The newest stamp known for a lead: what's been noted, or the one a screen loaded (whichever is later). */
export function leadStamp(leadId: string, loaded?: string | null): string | undefined {
  const cur = stamps.get(leadId);
  if (cur && loaded) return cur > loaded ? cur : loaded;
  return cur || loaded || undefined;
}
