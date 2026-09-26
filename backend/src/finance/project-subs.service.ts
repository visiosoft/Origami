import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommitmentEntity, CommitmentLineEntity, ContractorEntity, CostEntryEntity, PersonEntity, SubcontractorTradeEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { sumCents, toCents, fromCents } from './money';

const todayISO = () => new Date().toISOString().slice(0, 10);
/** 'expired' | 'soon' (within 30 days) | 'ok' | '' (no date on file). */
export function expiryState(date?: string | null, today = todayISO()) {
  const d = (date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  if (d < today) return 'expired';
  const soon = new Date(`${today}T12:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 30);
  return d <= soon.toISOString().slice(0, 10) ? 'soon' : 'ok';
}

/**
 * A project's subcontractors, for its Subcontractors tab: every company with
 * a subcontract or PO on the job (contact, trades, licence and insurance,
 * portal access), plus subs linked to the project in People who don't have
 * one yet. Readable by any staff member; the money only for those who may
 * see costs.
 */
@Injectable()
export class ProjectSubsService {
  constructor(
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(CommitmentLineEntity) private readonly lines: Repository<CommitmentLineEntity>,
    @InjectRepository(CostEntryEntity) private readonly entries: Repository<CostEntryEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(SubcontractorTradeEntity) private readonly trades: Repository<SubcontractorTradeEntity>,
    private readonly fin: FinancialsService,
  ) {}

  async list(projectId: number, actor: Actor) {
    const project = await this.fin.project(projectId);
    const rights = await this.fin.rights(actor);
    const money = !!(rights.viewProfitability || rights.manageCosts);
    const [cos, lines, entries, contractors, people, trades] = await Promise.all([
      this.commitments.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.entries.find({ where: { projectId } }),
      this.contractors.find(), this.people.find(), this.trades.find(),
    ]);
    const tradeName = new Map(trades.map((t) => [t.id, `${t.code} ${t.name}`.trim()]));
    const byId = new Map(contractors.map((c) => [c.id, c]));

    type Row = {
      key: string; contractorId?: string; company: string; contactPerson?: string; phone?: string; email?: string; trades: string[];
      licenseNumber?: string; licenseExpiry?: string; licenseState: string; insuranceExpiry?: string; insuranceState: string;
      status?: string; portal: boolean; personId?: number;
      subcontracts: { id: string; number: string; type: string; title: string; status: string; total?: number; billed?: number; remaining?: number }[];
    };
    const rows = new Map<string, Row>();
    for (const c of cos.filter((x) => x.status !== 'void')) {
      const k = c.contractorId || `vendor:${(c.vendorName || '').trim().toLowerCase()}`;
      if (!rows.has(k)) {
        const k2 = c.contractorId ? byId.get(c.contractorId) : undefined;
        rows.set(k, {
          key: k, contractorId: k2?.id, company: k2?.companyName || c.vendorName || 'Unnamed vendor',
          contactPerson: k2?.contactPerson, phone: k2?.phone, email: k2?.email,
          trades: (k2?.tradeIds || []).map((id) => tradeName.get(id) || id),
          licenseNumber: k2?.licenseNumber, licenseExpiry: k2?.licenseExpiry, licenseState: expiryState(k2?.licenseExpiry),
          insuranceExpiry: k2?.insuranceExpiry, insuranceState: expiryState(k2?.insuranceExpiry),
          status: k2?.status, portal: !!k2?.userId, personId: k2?.personId, subcontracts: [],
        });
      }
      const totalC = sumCents(lines.filter((l) => l.commitmentId === c.id).map((l) => toCents(l.amount)));
      const billedC = sumCents(entries.filter((e) => e.commitmentId === c.id && e.status !== 'void').map((e) => toCents(e.amount)));
      rows.get(k)!.subcontracts.push({
        id: c.id, number: c.number, type: c.type, title: c.title, status: c.status,
        ...(money ? { total: fromCents(totalC), billed: fromCents(billedC), remaining: fromCents(c.status === 'approved' ? Math.max(totalC - billedC, 0) : 0) } : {}),
      });
    }
    for (const r of rows.values()) r.subcontracts.sort((a, b) => a.number.localeCompare(b.number));

    // Subs tied to the project in People (by project name) but with no subcontract here yet.
    const onJob = new Set([...rows.values()].map((r) => r.personId).filter(Boolean));
    const contractorByPerson = new Map(contractors.filter((c) => c.personId).map((c) => [Number(c.personId), c]));
    const unlinked = people
      .filter((p) => p.kind === 'Sub' && (p.projects || []).includes(project.name) && !onJob.has(p.id))
      .map((p) => ({ personId: p.id, name: p.name, company: p.company, role: p.role, phone: p.phone, email: p.email, contractorId: contractorByPerson.get(p.id)?.id }));

    return {
      canSeeMoney: money, canManage: !!rights.manageCosts,
      rows: [...rows.values()].sort((a, b) => a.company.localeCompare(b.company)),
      unlinked,
    };
  }
}
