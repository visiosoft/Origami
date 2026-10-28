import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity, DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, ProjectEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { DailyLogBackupService } from './daily-log-backup.service';
import { mondayOf, weekDates } from './weekly-timesheets.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OPS: Record<string, string> = {
  procurement: 'Procurement / Delivery delay', changeOrder: 'Change order delay', rfi: 'RFI delay',
  scheduling: 'Scheduling / Sequencing delay', safety: 'Safety incident delay', siteCondition: 'Unknown site condition',
};
const REASON: Record<string, string> = { stop: 'Stop order', holiday: 'Holiday', ops: 'Operations delay', force: 'Force majeure' };
const OUTCOME: Record<string, string> = { passed: 'Passed', partial: 'Partial passed', conditional: 'Conditional passed', failed: 'Failed' };
const round = (n: number) => Math.round(n * 100) / 100;
const filled = (r: any) => Object.entries(r || {}).some(([k, v]) => k !== 'id' && v !== '' && v != null);
const dayName = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export interface WeeklyDay { date: string; logId: string | null; status: string; worked: string; reason: string; auto: boolean; crew: number; hours: number; supervisor: string; updates: number }
export interface WeeklyReport {
  projectId: number; weekStart: string; weekEnd: string;
  days: WeeklyDay[];
  totals: { hours: number; workerDays: number; daysWorked: number; daysNoWork: number; daysMissing: number; equipmentHours: number; equipmentIdle: number; deliveries: number };
  byCode: { code: string; label: string; hours: number; workers: number }[];
  byWorker: { name: string; trade: string; hours: number; days: number }[];
  delays: { date: string; label: string; getWell: string; details: string }[];
  inspections: { date: string; authority: string; what: string; outcome: string }[];
  visitors: { date: string; type: string; name: string; details: string }[];
  deliveries: { date: string; supplier: string; poRef: string; items: string; qty: number | ''; receivedBy: string; condition: string; notes: string }[];
  equipment: { name: string; ownership: string; hoursUsed: number; hoursIdle: number; days: number }[];
  notes: { date: string; text: string }[];
}

/**
 * A project's week from its daily reports: the latest version of each day,
 * hours by cost code and by worker, and the week's delays, inspections,
 * visitors, deliveries, equipment and notes. Days with no report are flagged.
 */
export function buildWeekly(
  projectId: number, weekStart: string, logs: DailyLogEntity[], entries: LaborLogEntryEntity[],
  employees: Pick<EmployeeEntity, 'id' | 'name' | 'trade'>[], codes: Pick<CsiCodeEntity, 'id' | 'code' | 'division'>[], today: string,
): WeeklyReport {
  const dates = weekDates(weekStart);
  const emp = new Map(employees.map((e) => [e.id, e]));
  const code = new Map(codes.map((c) => [c.id, c]));
  const filed = logs.filter((l) => l.projectId === projectId && dates.includes(l.date) && (l.status === 'submitted' || l.status === 'approved'));
  const latest = new Map<string, DailyLogEntity>();
  for (const l of filed) { const cur = latest.get(l.date); if (!cur || (Number(l.version) || 1) > (Number(cur.version) || 1)) latest.set(l.date, l); }
  const byLog = new Map<string, LaborLogEntryEntity[]>();
  for (const e of entries) (byLog.get(e.dailyLogId) || byLog.set(e.dailyLogId, []).get(e.dailyLogId)!).push(e);

  const out: WeeklyReport = {
    projectId, weekStart, weekEnd: dates[6], days: [],
    totals: { hours: 0, workerDays: 0, daysWorked: 0, daysNoWork: 0, daysMissing: 0, equipmentHours: 0, equipmentIdle: 0, deliveries: 0 },
    byCode: [], byWorker: [], delays: [], inspections: [], visitors: [], deliveries: [], equipment: [], notes: [],
  };
  const codes2 = new Map<string, { code: string; label: string; hours: number; workers: Set<string> }>();
  const workers = new Map<string, { name: string; trade: string; hours: number; days: Set<string> }>();
  const machines = new Map<string, { name: string; ownership: string; hoursUsed: number; hoursIdle: number; days: Set<string> }>();
  const delay = (date: string, label: string, d: any) => out.delays.push({ date, label, getWell: d?.getWell === 'known' ? d.date || '' : d?.getWell === 'unknown' ? 'unknown' : '', details: d?.details || '' });

  for (const date of dates) {
    const l = latest.get(date);
    const versions = filed.filter((x) => x.date === date).length;
    if (!l) {
      // Weekdays up to today with nothing filed.
      const wd = new Date(date + 'T12:00:00Z').getUTCDay();
      if (date <= today && wd !== 0 && wd !== 6) out.totals.daysMissing++;
      out.days.push({ date, logId: null, status: 'missing', worked: '', reason: '', auto: false, crew: 0, hours: 0, supervisor: '', updates: 0 });
      continue;
    }
    const s: any = l.sections || {};
    const a = s.activity || {};
    const rows = byLog.get(l.id) || [];
    const hours = round(rows.reduce((t, e) => t + (Number(e.hours) || 0), 0));
    out.days.push({ date, logId: l.id, status: l.status, worked: a.worked || '', reason: a.worked === 'no' ? REASON[a.reason] || '' : '', auto: !!l.autoReason, crew: rows.length, hours, supervisor: l.supervisorName || '', updates: Math.max(0, versions - 1) });
    if (a.worked === 'no') out.totals.daysNoWork++; else out.totals.daysWorked++;
    out.totals.hours += hours;
    out.totals.workerDays += rows.length;
    for (const e of rows) {
      const c = e.csiCodeId ? code.get(e.csiCodeId) : undefined;
      const k = c?.code || '';
      const cc = codes2.get(k) || codes2.set(k, { code: k, label: c ? `${c.code} ${c.division}` : 'No cost code', hours: 0, workers: new Set() }).get(k)!;
      cc.hours += Number(e.hours) || 0; cc.workers.add(e.employeeId);
      const w = emp.get(e.employeeId);
      const ww = workers.get(e.employeeId) || workers.set(e.employeeId, { name: w?.name || e.employeeId, trade: w?.trade || '', hours: 0, days: new Set() }).get(e.employeeId)!;
      ww.hours += Number(e.hours) || 0; ww.days.add(date);
    }
    if (a.worked === 'no') {
      if (a.reason === 'ops') for (const [k, label] of Object.entries(OPS)) if (a.ops?.[k]?.on || a.ops?.[k]?.details) delay(date, label, a.ops[k]);
      if (a.reason === 'force') delay(date, 'Force majeure', a.force);
    } else if (a.delays === 'yes') {
      for (const [k, label] of Object.entries(OPS)) if (a.dOps?.[k]?.on) delay(date, label, a.dOps[k]);
      if (a.dForce?.on) delay(date, 'Force majeure', a.dForce);
    }
    if (s.inspectors?.present === 'yes') for (const r of s.inspectors.rows || []) if (filled(r)) out.inspections.push({ date, authority: r.authority || '', what: r.what || '', outcome: OUTCOME[r.outcome] || '' });
    if (s.visitors?.present === 'yes') for (const r of s.visitors.rows || []) if (filled(r)) out.visitors.push({ date, type: r.type || '', name: r.name || '', details: r.details || '' });
    if (s.deliveries?.present === 'yes') for (const r of s.deliveries.rows || []) if (filled(r)) out.deliveries.push({ date, supplier: r.supplier || '', poRef: r.poRef || '', items: r.items || '', qty: r.qty ?? '', receivedBy: r.receivedBy || '', condition: r.condition || '', notes: r.notes || '' });
    if (s.equipment?.used === 'yes') for (const r of s.equipment.rows || []) {
      if (!filled(r)) continue;
      const name = String(r.equipment || 'Equipment').trim();
      const m = machines.get(name.toLowerCase()) || machines.set(name.toLowerCase(), { name, ownership: r.ownership || '', hoursUsed: 0, hoursIdle: 0, days: new Set() }).get(name.toLowerCase())!;
      m.hoursUsed += Number(r.hoursUsed) || 0; m.hoursIdle += Number(r.hoursIdle) || 0; m.days.add(date);
    }
    for (const n of s.notes || []) if (String(n?.text || '').trim()) out.notes.push({ date, text: n.text.trim() });
    if (String(l.notes || '').trim()) out.notes.push({ date, text: l.notes.trim() });
  }
  out.totals.hours = round(out.totals.hours);
  out.byCode = [...codes2.values()].map((c) => ({ code: c.code, label: c.label, hours: round(c.hours), workers: c.workers.size })).sort((a, b) => Number(!a.code) - Number(!b.code) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  out.byWorker = [...workers.values()].map((w) => ({ name: w.name, trade: w.trade, hours: round(w.hours), days: w.days.size })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  out.equipment = [...machines.values()].map((m) => ({ name: m.name, ownership: m.ownership, hoursUsed: round(m.hoursUsed), hoursIdle: round(m.hoursIdle), days: m.days.size }));
  out.totals.equipmentHours = round(out.equipment.reduce((t, m) => t + m.hoursUsed, 0));
  out.totals.equipmentIdle = round(out.equipment.reduce((t, m) => t + m.hoursIdle, 0));
  out.totals.deliveries = out.deliveries.length;
  return out;
}

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** The week as a spreadsheet: days, hours by code and worker, then the lists. */
export function weeklyCsv(projectName: string, w: WeeklyReport) {
  const L: unknown[][] = [
    ['Weekly report', projectName], ['Week', `${w.weekStart} to ${w.weekEnd}`], [],
    ['Day', 'Status', 'Worked', 'Reason', 'Crew', 'Hours', 'Superintendent'],
    ...w.days.map((d) => [d.date, d.status, d.worked, d.reason, d.crew, d.hours, d.supervisor]),
    ['Total', '', '', '', w.totals.workerDays, w.totals.hours], [],
    ['Cost code', 'Workers', 'Hours'], ...w.byCode.map((c) => [c.label, c.workers, c.hours]), [],
    ['Worker', 'Trade', 'Days', 'Hours'], ...w.byWorker.map((x) => [x.name, x.trade, x.days, x.hours]),
  ];
  if (w.delays.length) L.push([], ['Delays'], ['Date', 'Delay', 'Get well', 'Details'], ...w.delays.map((d) => [d.date, d.label, d.getWell, d.details]));
  if (w.inspections.length) L.push([], ['Inspections'], ['Date', 'Authority', 'What', 'Outcome'], ...w.inspections.map((i) => [i.date, i.authority, i.what, i.outcome]));
  if (w.visitors.length) L.push([], ['Visitors'], ['Date', 'Type', 'Name', 'Details'], ...w.visitors.map((v) => [v.date, v.type, v.name, v.details]));
  if (w.deliveries.length) L.push([], ['Deliveries'], ['Date', 'Supplier', 'PO / ticket', 'Items', 'Qty', 'Received by', 'Condition', 'Notes'], ...w.deliveries.map((d) => [d.date, d.supplier, d.poRef, d.items, d.qty, d.receivedBy, d.condition, d.notes]));
  if (w.equipment.length) L.push([], ['Equipment'], ['Equipment', 'Owned / rented', 'Days', 'Hours used', 'Hours idle'], ...w.equipment.map((m) => [m.name, m.ownership, m.days, m.hoursUsed, m.hoursIdle]));
  if (w.notes.length) L.push([], ['Notes'], ['Date', 'Note'], ...w.notes.map((n) => [n.date, n.text]));
  return L.map((l) => l.map(csvCell).join(',')).join('\r\n');
}

/** The week as HTML, for the PDF. */
export function weeklyHtml(projectName: string, company: string, w: WeeklyReport) {
  const e = escapeHtml;
  const cell = 'padding:5px 7px;border-bottom:1px solid #E6E9E4;font-size:9.5pt;vertical-align:top;';
  const head = 'padding:5px 7px;border-bottom:2px solid #173326;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em;color:#43514D;text-align:left;';
  const table = (h: string[], rows: unknown[][]) => `<table width="100%" style="border-collapse:collapse;margin:4px 0 12px;"><tr>${h.map((x) => `<th style="${head}">${e(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td style="${cell}">${e(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</table>`;
  const h2 = (t: string) => `<h2 style="font-size:12pt;margin:14px 0 4px;">${e(t)}</h2>`;
  const t = w.totals;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;">
    <div style="font-size:9pt;color:#7E9B93;text-transform:uppercase;letter-spacing:.08em;">${e(company)} · Weekly report</div>
    <h1 style="font-size:18pt;margin:4px 0 2px;">${e(projectName)}</h1>
    <div style="font-size:11pt;color:#43514D;margin-bottom:12px;">Week of ${e(dayName(w.weekStart))} – ${e(dayName(w.weekEnd))} · ${t.daysWorked} day${t.daysWorked === 1 ? '' : 's'} worked · ${t.hours} crew hours${t.daysNoWork ? ` · ${t.daysNoWork} no-work day${t.daysNoWork === 1 ? '' : 's'}` : ''}${t.daysMissing ? ` · <b style="color:#8E2E0A;">${t.daysMissing} weekday${t.daysMissing === 1 ? '' : 's'} with no report</b>` : ''}</div>
    ${table(['Day', 'Status', 'Crew', 'Hours', 'Superintendent'], w.days.map((d) => [dayName(d.date), d.status === 'missing' ? 'No report' : d.worked === 'no' ? `No work — ${d.reason || '—'}${d.auto ? ' (automatic)' : ''}` : d.status, d.crew || '', d.hours || '', d.supervisor]))}
    ${w.byCode.length ? h2('Hours by cost code') + table(['Cost code', 'Workers', 'Hours'], w.byCode.map((c) => [c.label, c.workers, c.hours])) : ''}
    ${w.byWorker.length ? h2('Hours by worker') + table(['Worker', 'Trade', 'Days', 'Hours'], w.byWorker.map((x) => [x.name, x.trade, x.days, x.hours])) : ''}
    ${w.delays.length ? h2('Delays') + table(['Date', 'Delay', 'Get well', 'Details'], w.delays.map((d) => [dayName(d.date), d.label, d.getWell, d.details])) : ''}
    ${w.inspections.length ? h2('Inspections') + table(['Date', 'Authority', 'What', 'Outcome'], w.inspections.map((i) => [dayName(i.date), i.authority, i.what, i.outcome])) : ''}
    ${w.visitors.length ? h2('Site visitors') + table(['Date', 'Visitor', 'Name', 'Details'], w.visitors.map((v) => [dayName(v.date), v.type, v.name, v.details])) : ''}
    ${w.deliveries.length ? h2('Deliveries') + table(['Date', 'Supplier', 'PO / ticket', 'Items', 'Qty', 'Condition'], w.deliveries.map((d) => [dayName(d.date), d.supplier, d.poRef, d.items, d.qty, d.condition])) : ''}
    ${w.equipment.length ? h2('Equipment') + table(['Equipment', 'Owned / rented', 'Days', 'Hours used', 'Hours idle'], [...w.equipment.map((m) => [m.name, m.ownership, m.days, m.hoursUsed, m.hoursIdle]), ['Total', '', '', t.equipmentHours, t.equipmentIdle]]) : ''}
    ${w.notes.length ? h2('Notes') + table(['Date', 'Note'], w.notes.map((n) => [dayName(n.date), n.text])) : ''}
  </body></html>`;
}

@Injectable()
export class WeeklyReportService {
  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(CsiCodeEntity) private readonly codes: Repository<CsiCodeEntity>,
    private readonly backup: DailyLogBackupService,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  async week(projectId: number, anyDay: string) {
    if (!Number.isFinite(projectId) || projectId <= 0) throw new BadRequestException('Pick a project.');
    const weekStart = mondayOf(ISO.test(anyDay || '') ? anyDay : new Date().toISOString().slice(0, 10));
    const dates = weekDates(weekStart);
    const logs = (await this.logs.find({ where: { projectId } })).filter((l) => l.date >= dates[0] && l.date <= dates[6]);
    const ids = logs.map((l) => l.id);
    const [entries, employees, codes] = await Promise.all([
      ids.length ? this.entries.find({ where: ids.map((id) => ({ dailyLogId: id })) }) : Promise.resolve([]),
      this.employees.find(), this.codes.find(),
    ]);
    return buildWeekly(projectId, weekStart, logs, entries, employees, codes, new Date().toISOString().slice(0, 10));
  }

  /** Email the week as PDF + Excel, to the daily-log backup list or to given addresses. */
  async email(projectId: number, anyDay: string, to?: string[]) {
    if (!(await this.google.isConnected())) throw new BadRequestException('Connect a Google account (Settings -> Integrations) to email reports.');
    const project = await this.projects.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');
    const recipients = to?.length ? to : await this.backup.recipients();
    if (!recipients.length) throw new BadRequestException('No one to send it to -- add addresses under Settings -> Daily log backup.');
    const w = await this.week(projectId, anyDay);
    const brand = await loadEmailBrand(this.settings);
    const base = `Weekly report ${w.weekStart} - ${project.name}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120);
    const attachments: { filename: string; mimeType: string; content: Buffer }[] = [];
    try { attachments.push({ filename: `${base}.pdf`, mimeType: 'application/pdf', content: await this.google.htmlToPdf(weeklyHtml(project.name, brand.companyName, w), base, undefined, true) }); } catch { /* the Excel still goes */ }
    const csv = weeklyCsv(project.name, w);
    try { attachments.push({ filename: `${base}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: await this.google.csvToXlsx(csv, base) }); }
    catch { attachments.push({ filename: `${base}.csv`, mimeType: 'text/csv', content: Buffer.from('﻿' + csv, 'utf8') }); }
    const t = w.totals;
    const html = emailShell({
      brand, eyebrow: 'Weekly report', title: `${escapeHtml(project.name)} — week of ${escapeHtml(dayName(w.weekStart))}`,
      body: `<p style="margin:0 0 10px;">${t.daysWorked} day${t.daysWorked === 1 ? '' : 's'} worked, ${t.hours} crew hours${t.daysNoWork ? `, ${t.daysNoWork} no-work day${t.daysNoWork === 1 ? '' : 's'}` : ''}.${t.daysMissing ? ` <b>${t.daysMissing} weekday${t.daysMissing === 1 ? ' has' : 's have'} no report.</b>` : ''}</p>`
        + `<p style="margin:0;color:#43514D;">The week is attached as a PDF to read and a spreadsheet to work with.</p>`,
      footer: 'Sent from Daily Reports → Weekly.',
    });
    await this.google.sendMail({ to: recipients.join(', '), subject: `Weekly report: ${project.name}, week of ${dayName(w.weekStart)}`, html, attachments });
    return { sent: true, to: recipients, attachments: attachments.map((a) => a.filename) };
  }
}
