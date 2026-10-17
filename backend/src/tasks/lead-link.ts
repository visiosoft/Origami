import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { DealEntity, LeadEntity } from '../database/entities';

/**
 * Tasks can be linked to a lead as well as a project -- work starts before a
 * contract is signed. The link is the lead's id (the deal shares it); its name
 * is copied on so lists read without looking the lead up.
 */
export const leadDisplayName = (l?: Pick<LeadEntity, 'leadName' | 'businessName'> | null) => (l ? (String(l.businessName || '').trim() || l.leadName || '') : '');

export async function resolveLead(leads: Repository<LeadEntity> | undefined, raw: unknown): Promise<{ leadId: string | null; leadName: string | null }> {
  const id = String(raw ?? '').trim();
  if (!id) return { leadId: null, leadName: null };
  if (!leads) return { leadId: id, leadName: null };
  const lead = await leads.findOneBy({ id });
  if (!lead) throw new BadRequestException('That lead no longer exists.');
  return { leadId: id, leadName: leadDisplayName(lead) };
}

/** Is this "project" value actually a lead's id? (The CRM's Tasks panel files lead tasks that way.) */
export async function isLeadId(deals: Repository<DealEntity> | undefined, value: unknown): Promise<boolean> {
  const v = String(value ?? '').trim();
  return !!v && !!deals && !!(await deals.findOneBy({ id: v }));
}
