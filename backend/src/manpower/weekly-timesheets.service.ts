import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EmployeeEntity, LeaveRequestEntity, PayrollRunEntity, PayslipEntity, ProjectEntity, PublicHolidayEntity,
  TimesheetEntity, TimesheetLineEntity, UserEntity, type TimesheetDay,
} from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { LeaveService } from './leave.service';
import { PayrollSetupService } from './payroll-setup.service';
import { TimesheetsService } from './timesheets.service';
import { addDays, weekday, workingDays } from './calendar.util';
import { LEFT_STATUSES, lifecycleStatus, newId } from './workforce.util';
import { round2 } from './payroll.calc';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const TIMESHEET_KINDS = ['project', 'internal', 'leave'];
export const INTERNAL_CATEGORIES = ['office', 'estimating', 'design', 'meetings', 'travel', 'other'];

/** Monday of the week a date falls in. */
export const mondayOf = (date: string) => addDays(date, -((weekday(date) + 6) % 7));
export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

type SheetRepo = Pick<Repository<TimesheetEntity>, 'find'>;
type LineRepo = Pick<Repository<TimesheetLineEntity>, 'find'>;

/**
 * Hours worked per person per day from approved timesheets (project and internal
 * work -- leave is paid through the leave module). Payroll and overtime use these
 * in place of daily-log hours for the same person and day.
 */
export async function approvedTimesheetHours(sheets: SheetRepo, lines: LineRepo, from: string, to: string, employeeIds?: Set<string>) {
  const out = new Map<string, Map<string, { hours: number; projectIds: Set<number> }>>();
  const approved = (await sheets.find({ where: { status: 'approved' } }))
    .filter((s) => s.weekStart <= to && addDays(s.weekStart, 6) >= from && (!employeeIds || employeeIds.has(s.employeeId)));
  if (!approved.length) return out;
  for (const l of await lines.find({ where: { timesheetId: In(approved.map((s) => s.id)) } })) {
    if (l.kind === 'leave') continue;
    for (const [date, d] of Object.entries(l.days || {})) {
      if (date < from || date > to || !(Number(d?.hours) > 0)) continue;
      const mine = out.get(l.employeeId) || new Map();
      const cur = mine.get(date) || { hours: 0, projectIds: new Set<number>() };
      cur.hours = round2(cur.hours + Number(d.hours));
      if (l.kind === 'project' && l.projectId != null) cur.projectIds.add(l.projectId);
      mine.set(date, cur);
      out.set(l.employeeId, mine);
    }
  }
  return out;
}

interface LineDto {
  id?: string; kind: string; projectId?: number | null; csiCodeId?: string | null; category?: string | null; leaveTypeId?: string | null;
  description?: string | null; days?: Record<string, { hours?: number | string; note?: string }>;
}

@Injectable()
export class WeeklyTimesheetsService {
  constructor(
    @InjectRepository(TimesheetEntity) private readonly sheets: Repository<TimesheetEntity>,
    @InjectRepository(TimesheetLineEntity) private readonly lines: Repository<TimesheetLineEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(LeaveRequestEntity) private readonly leaveRequests: Repository<LeaveRequestEntity>,
    @InjectRepository(PublicHolidayEntity) private readonly holidays: Repository<PublicHolidayEntity>,
    @InjectRepository(PayrollRunEntity) private readonly runs: Repository<PayrollRunEntity>,
    @InjectRepository(PayslipEntity) private readonly payslips: Repository<PayslipEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly leave: LeaveService,
    private readonly logged: TimesheetsService,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
  ) {}

  // ------------------------------------------------------------------ who may do what

  /** The employee record behind a login: linked by user id, or matched once by email and then linked. */
  async me(actor: Actor) {
    if (!actor.id) return null;
    const linked = await this.employees.findOneBy({ userId: actor.id });
    if (linked) return linked;
    const user = await this.users.findOneBy({ id: actor.id });
    const email = user?.email?.trim().toLowerCase();
    if (!email) return null;
    const matches = (await this.employees.find()).filter((e) => !e.userId && (e.email || '').trim().toLowerCase() === email);
    if (matches.length !== 1) return null;
    matches[0].userId = actor.id;
    return this.employees.save(matches[0]);
  }

  private async rights(actor: Actor, emp: EmployeeEntity) {
    const hr = await this.access.can(actor, HR_MODULE);
    const self = !!actor.id && emp.userId === actor.id;
    const boss = emp.supervisorId ? await this.employees.findOneBy({ id: emp.supervisorId }) : null;
    const manager = !!actor.id && !!boss?.userId && boss.userId === actor.id;
    return { hr, self, manager, view: hr || self || manager, edit: hr || self, review: (hr || manager) && !self };
  }

  private async employee(id: string) {
    const e = await this.employees.findOneBy({ id });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }

  private async load(id: string) {
    const s = await this.sheets.findOneBy({ id });
    if (!s) throw new NotFoundException('Timesheet not found');
    return s;
  }

  // ------------------------------------------------------------------ reading

  /** A week for one person: their sheet (or nothing yet) plus what the grid needs around it. */
  async week(employeeId: string, weekStart: string, actor: Actor) {
    if (!ISO.test(weekStart || '')) throw new BadRequestException('Which week?');
    const emp = await this.employee(employeeId);
    const r = await this.rights(actor, emp);
    if (!r.view) throw new ForbiddenException("You can only see your own timesheets, or your team's.");
    const start = mondayOf(weekStart);
    const dates = weekDates(start);
    const end = dates[6];
    const sheet = await this.sheets.findOneBy({ employeeId, weekStart: start });
    const lines = sheet ? (await this.lines.find({ where: { timesheetId: sheet.id } })).sort((a, b) => a.order - b.order) : [];
    const own = new Set(lines.flatMap((l) => l.leaveRequestIds || []));
    const [s, holidays, leave, logged] = await Promise.all([
      this.setup.settings(),
      this.holidays.find(),
      this.leave.findRequests({ employeeId, from: start, to: end }),
      this.logged.forEmployee(employeeId, start, end),
    ]);
    return {
      employee: { id: emp.id, name: emp.name, workerId: emp.workerId, payType: emp.payType, designation: emp.designation },
      weekStart: start, dates, sheet, lines,
      holidays: holidays.filter((h) => h.date >= start && h.date <= end),
      // Leave booked through the Leave screen, shown alongside (not part of) the sheet.
      otherLeave: leave.filter((l) => !own.has(l.id) && ['pending', 'approved'].includes(l.status)),
      logged: logged.rows,
      standardDayHours: s.standardDayHours, halfDayHours: s.halfDayHours, weekendDays: s.weekendDays,
      canEdit: r.edit && (!sheet || ['draft', 'rejected'].includes(sheet.status)),
      canReview: r.review && sheet?.status === 'submitted' && sheet.submittedById !== actor.id,
      canReopen: r.hr && !!sheet && ['submitted', 'approved'].includes(sheet.status),
    };
  }

  /** Timesheets in a date range: everyone's for HR, otherwise your own and your direct reports'. */
  async list(opts: { from?: string; to?: string; status?: string; employeeId?: string }, actor: Actor) {
    let rows = await this.sheets.find({ order: { weekStart: 'DESC' } });
    if (opts.from) rows = rows.filter((s) => addDays(s.weekStart, 6) >= opts.from!);
    if (opts.to) rows = rows.filter((s) => s.weekStart <= opts.to!);
    if (opts.status) rows = rows.filter((s) => s.status === opts.status);
    if (opts.employeeId) rows = rows.filter((s) => s.employeeId === opts.employeeId);
    if (!(await this.access.can(actor, HR_MODULE))) {
      const mine = actor.id ? await this.employees.findOneBy({ userId: actor.id }) : null;
      const team = mine ? new Set([mine.id, ...(await this.employees.find()).filter((e) => e.supervisorId === mine.id).map((e) => e.id)]) : new Set<string>();
      rows = rows.filter((s) => team.has(s.employeeId));
    }
    if (!rows.length) return [];
    const lines = await this.lines.find({ where: { timesheetId: In(rows.map((s) => s.id)) } });
    return rows.map((s) => ({ ...s, lines: lines.filter((l) => l.timesheetId === s.id).sort((a, b) => a.order - b.order) }));
  }

  // ------------------------------------------------------------------ entering

  async save(dto: { employeeId: string; weekStart: string; lines: LineDto[]; notes?: string }, actor: Actor) {
    const emp = await this.employee(dto.employeeId);
    const r = await this.rights(actor, emp);
    if (!r.edit) throw new ForbiddenException('You can only fill in your own timesheet.');
    if (emp.contractorId) throw new BadRequestException(`${emp.name} is a contractor's worker -- their time is kept in the daily log.`);
    if (LEFT_STATUSES.includes(lifecycleStatus(emp))) throw new BadRequestException(`${emp.name} no longer works here.`);
    if (!ISO.test(dto.weekStart || '')) throw new BadRequestException('Which week?');
    const start = mondayOf(dto.weekStart);
    const dates = new Set(weekDates(start));
    let sheet = await this.sheets.findOneBy({ employeeId: emp.id, weekStart: start });
    if (sheet && !['draft', 'rejected'].includes(sheet.status)) throw new BadRequestException(`This timesheet is ${sheet.status} -- it can't be changed now.`);
    const old = sheet ? await this.lines.find({ where: { timesheetId: sheet.id } }) : [];

    const projectIds = new Set((await this.projects.find()).map((p) => Number(p.id)));
    const perDay = new Map<string, number>();
    const now = new Date().toISOString();
    sheet = sheet || this.sheets.create({ id: newId('TS'), employeeId: emp.id, weekStart: start, status: 'draft', createdAt: now });
    const rows: TimesheetLineEntity[] = (dto.lines || []).map((l, i) => {
      if (!TIMESHEET_KINDS.includes(l.kind)) throw new BadRequestException('Each row is project work, internal work or leave.');
      if (l.kind === 'project' && !(l.projectId != null && projectIds.has(Number(l.projectId)))) throw new BadRequestException(`Row ${i + 1}: pick the project.`);
      if (l.kind === 'internal' && !INTERNAL_CATEGORIES.includes(l.category || '')) throw new BadRequestException(`Row ${i + 1}: pick what kind of internal work.`);
      if (l.kind === 'leave' && !l.leaveTypeId) throw new BadRequestException(`Row ${i + 1}: pick the type of leave.`);
      const days: Record<string, TimesheetDay> = {};
      for (const [date, d] of Object.entries(l.days || {})) {
        if (!dates.has(date)) throw new BadRequestException(`${date} isn't in this week.`);
        const raw = d?.hours === '' || d?.hours == null ? 0 : Number(d.hours);
        if (!Number.isFinite(raw) || raw < 0 || raw > 24) throw new BadRequestException(`Hours on ${date} must be between 0 and 24.`);
        const hours = Math.round(raw * 4) / 4; // quarter hours
        const note = d?.note?.trim() || undefined;
        if (!hours && !note) continue;
        days[date] = note ? { hours, note } : { hours };
        perDay.set(date, (perDay.get(date) || 0) + hours);
      }
      const prior = l.id ? old.find((o) => o.id === l.id) : undefined;
      return this.lines.create({
        id: prior?.id || newId('TL'), timesheetId: sheet!.id, employeeId: emp.id, kind: l.kind,
        projectId: l.kind === 'project' ? Number(l.projectId) : undefined, csiCodeId: l.kind === 'project' ? l.csiCodeId || undefined : undefined,
        category: l.kind === 'internal' ? l.category! : undefined, leaveTypeId: l.kind === 'leave' ? l.leaveTypeId! : undefined,
        description: l.description?.trim() || undefined, days, leaveRequestIds: prior?.leaveRequestIds || [], order: i,
      });
    });
    const over = Array.from(perDay.entries()).find(([, h]) => h > 24);
    if (over) throw new BadRequestException(`${over[1]} hours on ${over[0]} -- a day has 24.`);

    Object.assign(sheet, {
      status: 'draft', notes: dto.notes?.trim() || undefined, updatedAt: now,
      totalHours: round2(rows.reduce((a, l) => a + Object.values(l.days).reduce((b, d) => b + d.hours, 0), 0)),
    });
    const saved = sheet;
    await this.sheets.manager.transaction(async (m) => {
      await m.getRepository(TimesheetEntity).save(saved);
      const gone = old.filter((o) => !rows.some((n) => n.id === o.id));
      if (gone.length) await m.getRepository(TimesheetLineEntity).remove(gone);
      if (rows.length) await m.getRepository(TimesheetLineEntity).save(rows);
    });
    return this.week(emp.id, start, actor);
  }

  async remove(id: string, actor: Actor) {
    const s = await this.load(id);
    const r = await this.rights(actor, await this.employee(s.employeeId));
    if (!r.edit) throw new ForbiddenException('Not your timesheet.');
    if (!['draft', 'rejected'].includes(s.status)) throw new BadRequestException('Only a draft can be deleted.');
    const lines = await this.lines.find({ where: { timesheetId: id } });
    if (lines.some((l) => (l.leaveRequestIds || []).length)) throw new BadRequestException('This sheet has leave booked -- clear the leave rows instead.');
    await this.sheets.manager.transaction(async (m) => {
      if (lines.length) await m.getRepository(TimesheetLineEntity).remove(lines);
      await m.getRepository(TimesheetEntity).remove(s);
    });
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ the review

  /** Leave rows become leave requests (checked against balance and overlaps), then the sheet waits for review. */
  async submit(id: string, actor: Actor) {
    const s = await this.load(id);
    const emp = await this.employee(s.employeeId);
    const r = await this.rights(actor, emp);
    if (!r.edit) throw new ForbiddenException('Not your timesheet.');
    if (s.status !== 'draft') throw new BadRequestException(`This timesheet is already ${s.status}.`);
    const lines = await this.lines.find({ where: { timesheetId: id } });
    if (!(s.totalHours > 0)) throw new BadRequestException('Enter some hours before submitting.');
    const { weekendDays, halfDayHours } = await this.setup.settings();
    const hol = new Set((await this.holidays.find()).map((h) => h.date));

    const created: string[] = [];
    try {
      for (const l of lines.filter((x) => x.kind === 'leave' && !(x.leaveRequestIds || []).length)) {
        const dates = Object.entries(l.days).filter(([, d]) => d.hours > 0).map(([d]) => d).sort();
        // Consecutive working days become one request.
        const blocks: string[][] = [];
        for (const d of dates) {
          const last = blocks[blocks.length - 1];
          if (last && workingDays(addDays(last[last.length - 1], 1), addDays(d, -1), weekendDays, hol).length === 0) last.push(d);
          else blocks.push([d]);
        }
        const ids: string[] = [];
        for (const b of blocks) {
          const half = b.length === 1 && l.days[b[0]].hours <= halfDayHours;
          const req = await this.leave.createRequest({
            employeeId: emp.id, leaveTypeId: l.leaveTypeId, startDate: b[0], endDate: b[b.length - 1], halfDay: half,
            reason: l.description || 'Entered on timesheet',
          }, actor);
          ids.push(req.id);
          created.push(req.id);
        }
        l.leaveRequestIds = ids;
      }
    } catch (err) {
      if (created.length) await this.leaveRequests.delete({ id: In(created) });
      throw err;
    }
    const now = new Date().toISOString();
    Object.assign(s, { status: 'submitted', submittedAt: now, submittedById: actor.id, submittedByName: actor.name, decidedAt: null, decidedById: null, decidedByName: null, updatedAt: now });
    await this.sheets.manager.transaction(async (m) => {
      await m.getRepository(TimesheetLineEntity).save(lines);
      await m.getRepository(TimesheetEntity).save(s);
    });
    return s;
  }

  private async linkedLeave(sheetId: string) {
    const lines = await this.lines.find({ where: { timesheetId: sheetId } });
    const ids = lines.flatMap((l) => l.leaveRequestIds || []);
    return { lines, leave: ids.length ? await this.leaveRequests.find({ where: { id: In(ids) } }) : [] };
  }

  async approve(id: string, note: string | undefined, actor: Actor) {
    const s = await this.load(id);
    const emp = await this.employee(s.employeeId);
    const r = await this.rights(actor, emp);
    if (s.status !== 'submitted') throw new BadRequestException(`This timesheet is ${s.status}.`);
    if (r.self) throw new ForbiddenException("You can't approve your own timesheet.");
    if (!r.review) throw new ForbiddenException('Only HR or their reporting manager can approve this.');
    if (actor.id && actor.id === s.submittedById) throw new ForbiddenException('You submitted this -- someone else has to approve it.');
    const { leave } = await this.linkedLeave(id);
    const pending = leave.filter((l) => l.status === 'pending');
    if (pending.length && !r.hr) throw new ForbiddenException('This timesheet includes leave -- HR has to approve it.');
    for (const l of pending) await this.leave.decide(l.id, 'approved', note || 'Approved with timesheet', actor);
    Object.assign(s, { status: 'approved', decidedAt: new Date().toISOString(), decidedById: actor.id, decidedByName: actor.name, decisionNote: note?.trim() || null, updatedAt: new Date().toISOString() });
    return this.sheets.save(s);
  }

  /** Back to the employee with a reason; leave it raised is withdrawn so it can be re-entered. */
  async reject(id: string, note: string | undefined, actor: Actor) {
    const s = await this.load(id);
    const emp = await this.employee(s.employeeId);
    const r = await this.rights(actor, emp);
    if (s.status !== 'submitted') throw new BadRequestException(`This timesheet is ${s.status}.`);
    if (!r.review) throw new ForbiddenException('Only HR or their reporting manager can send this back.');
    if (!note?.trim()) throw new BadRequestException('Say what needs fixing.');
    await this.withdrawLeave(id, actor, 'Timesheet sent back');
    Object.assign(s, { status: 'rejected', decidedAt: new Date().toISOString(), decidedById: actor.id, decidedByName: actor.name, decisionNote: note.trim(), updatedAt: new Date().toISOString() });
    return this.sheets.save(s);
  }

  /** HR reopens a submitted or approved week for correction -- not once payroll has been finalized over it. */
  async reopen(id: string, reason: string | undefined, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'reopen timesheets');
    const s = await this.load(id);
    if (!['submitted', 'approved'].includes(s.status)) throw new BadRequestException('Only a submitted or approved timesheet can be reopened.');
    if (!reason?.trim()) throw new BadRequestException('Say why it is being reopened.');
    const end = addDays(s.weekStart, 6);
    const locked = (await this.runs.find({ where: { status: 'finalized' } })).filter((run) => run.periodStart <= end && run.periodEnd >= s.weekStart);
    if (locked.length && (await this.payslips.count({ where: { runId: In(locked.map((x) => x.id)), employeeId: s.employeeId } }))) {
      throw new BadRequestException(`These hours were paid in "${locked[0].label}" -- void that run before changing them.`);
    }
    await this.withdrawLeave(id, actor, 'Timesheet reopened');
    Object.assign(s, { status: 'draft', decisionNote: `Reopened by ${actor.name}: ${reason.trim()}`, decidedAt: null, decidedById: null, decidedByName: null, updatedAt: new Date().toISOString() });
    return this.sheets.save(s);
  }

  /** Cancel leave this sheet raised that hasn't been taken yet, and forget it so a resubmit raises it again. */
  private async withdrawLeave(sheetId: string, actor: Actor, why: string) {
    const { lines, leave } = await this.linkedLeave(sheetId);
    const today = new Date().toISOString().slice(0, 10);
    const drop = leave.filter((l) => l.status === 'pending' || (l.status === 'approved' && l.startDate > today));
    if (!drop.length) return;
    const now = new Date().toISOString();
    for (const l of drop) Object.assign(l, { status: 'cancelled', decidedBy: actor.name, decidedById: actor.id, decidedAt: now, note: why });
    const gone = new Set(drop.map((l) => l.id));
    for (const line of lines) line.leaveRequestIds = (line.leaveRequestIds || []).filter((x) => !gone.has(x));
    await this.sheets.manager.transaction(async (m) => {
      await m.getRepository(LeaveRequestEntity).save(drop);
      await m.getRepository(TimesheetLineEntity).save(lines);
    });
  }
}
