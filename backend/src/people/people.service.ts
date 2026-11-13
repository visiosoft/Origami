import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { cleanFormer, formerFromExpired } from './connections';
import { findDuplicates, withLink, withoutLink, type DupRow } from './contact-duplicates';
import { StaffDirectorySync } from '../manpower/staff-directory.sync';
import { ContractorDirectorySync, isSubCompany } from '../manpower/contractor-directory.sync';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity, ProjectEntity } from '../database/entities';
import { normName, personOnProject, personProjectIds, projectIdPlan, projectsToStore, type ProjectRef } from './person-projects';
import { CONTACT_STATUSES } from './contact-status';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { signState, readState } from '../auth/crypto.util';
import type { TaskAttachment } from '../database/task.types';
import { parseBusinessCard } from './business-card';

/** The phases a person can be on for a project (Oct 26 review notes). */
export const PROJECT_PHASES = ['crm', 'design', 'precon', 'construction'];

type CardFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type Side = 'front' | 'back';
const CARD_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(PersonEntity) private readonly repo: Repository<PersonEntity>,
    private readonly staff?: StaffDirectorySync,
    private readonly subs?: ContractorDirectorySync,
    @Optional() private readonly attachments?: AttachmentsService,
    @Optional() private readonly google?: GoogleService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() @InjectRepository(ProjectEntity) private readonly projectRepo?: Repository<ProjectEntity>,
  ) {}

  private async projectRefs(): Promise<ProjectRef[]> {
    return this.projectRepo ? (await this.projectRepo.find({ select: { id: true, name: true } })).map((p) => ({ id: p.id, name: p.name })) : [];
  }

  /**
   * The move to project ids (Nov 13): who has project names, what ids they
   * become, and names that match no project (to fix by hand). Read-only.
   */
  async projectIdPlan() {
    return projectIdPlan(await this.repo.find(), await this.projectRefs());
  }

  async applyProjectIds(confirm: boolean) {
    const plan = await this.projectIdPlan();
    if (!confirm) return { applied: false, plan };
    const refs = await this.projectRefs();
    for (const p of plan) {
      const keep = projectsToStore({ projectIds: p.projects.map((x) => x.id) }, refs);
      // Names matching no project stay listed so they can be fixed; they carry no access.
      await this.repo.update({ id: p.id } as any, { projectIds: keep.projectIds, projects: [...keep.projects, ...p.unmatched] } as any);
    }
    return { applied: true, changed: plan.length };
  }

  /** Everyone, or the people on one project (`project` is its id, or -- older callers -- its name). */
  async findAll(project?: string, projects: ProjectRef[] = []) {
    const all = await this.repo.find({ order: { id: 'ASC' } });
    if (!project) return all;
    const ref = projects.find((p) => String(p.id) === String(project)) || projects.find((p) => normName(p.name) === normName(project));
    if (!ref) return all.filter((p) => (p.projects ?? []).some((n) => normName(n) === normName(project)));
    return all.filter((p) => personProjectIds(p, projects).includes(ref.id));
  }

  async findOne(id: string) {
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  /**
   * Whether the given email is on record as a client on this named project.
   *
   * The People directory is the only place a client login is tied to
   * specific work -- their own account carries no project list of its own.
   */
  async isClientOnProject(email: string, project: ProjectRef): Promise<boolean> {
    if (!email || !project) return false;
    const person = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', { email: email.trim().toLowerCase() })
      .andWhere('p.tier = :tier', { tier: 'Client' })
      .getOne();
    return !!person && personOnProject(person, project, await this.projectRefs());
  }

  /**
   * Tie an email to a project as a client or consultant, creating the
   * directory entry if none exists yet.
   *
   * Used when granting guest access: a guest's session works purely because
   * the rest of the app (dashboards, the Project Program's client check)
   * already scopes by this directory rather than by anything on the login
   * itself, so linking here is what actually grants the access.
   */
  async linkToProject(email: string, name: string, tier: 'Client' | 'Consultant', project: ProjectRef) {
    const projectName = project.name;
    const clean = (email || '').trim().toLowerCase();
    const existing = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', { email: clean })
      .getOne();
    if (existing) {
      const refs = await this.projectRefs();
      const ids = personProjectIds(existing, refs);
      if (!ids.includes(project.id)) {
        Object.assign(existing, projectsToStore({ projectIds: [...ids, project.id] }, refs.some((r) => r.id === project.id) ? refs : [...refs, project]));
        await this.repo.save(existing);
      }
      return existing;
    }
    const id = await this.nextId();
    const person = this.repo.create({
      id, name: name || clean, email: clean, tier, kind: tier, company: '', phone: '',
      projects: [projectName], projectIds: [project.id], openTasks: 0, since: new Date().toISOString().slice(0, 10), comply: null, last: 'Guest invited',
    } as Partial<PersonEntity>);
    return this.repo.save(person);
  }

  private async nextId(): Promise<number> {
    const rows = await this.repo.find();
    return rows.reduce((m: number, p: any) => Math.max(m, Number(p.id) || 0), 0) + 1;
  }

  // ------------------------------------------------------------ business cards

  /**
   * A new card: the photos go to Drive, Google reads their text, and the text
   * is sorted into fields for the person to review. The token puts the photos
   * on the contact when it's saved (create or update).
   */
  async scanCard(files: { front?: CardFile; back?: CardFile }, actor: UploadActor) {
    if (!this.attachments || !this.google || !this.settings) throw new BadRequestException('Card scanning needs Google connected (Settings → Integrations).');
    const sides = (['front', 'back'] as Side[]).filter((s) => files[s]);
    const uploaded = await this.attachments.upload(sides.map((s) => files[s]!), 'Business cards', actor);
    const cards: Partial<Record<Side, TaskAttachment>> = {};
    sides.forEach((s, i) => { cards[s] = uploaded[i]; });
    const texts: string[] = [];
    let readError = '';
    for (const s of sides) {
      try { texts.push(await this.google.imageToText(files[s]!.buffer, files[s]!.mimetype, `card-${s}`)); }
      catch (e) { readError = (e as Error).message || 'Could not read the card'; }
    }
    const text = texts.join('\n').trim();
    const cardToken = signState({ mode: 'business-card', cards }, await this.settings.jwtSecret());
    return { cardToken, front: cards.front || null, back: cards.back || null, text, fields: parseBusinessCard(text), readError: text ? '' : readError };
  }

  /** The card photos a scan token carries, if it's genuine and recent. */
  private async cardsFromToken(token: unknown): Promise<Partial<Record<Side, TaskAttachment>> | null> {
    if (!token || !this.settings) return null;
    const st = readState(String(token), await this.settings.jwtSecret(), CARD_TOKEN_MAX_AGE_MS);
    return st?.mode === 'business-card' && st.cards && typeof st.cards === 'object' ? st.cards : null;
  }

  /** Card photos are only ever set from a scan or an upload here, never from a client-sent record. */
  private async applyCardToken(dto: Record<string, any>, current?: PersonEntity | null) {
    const cards = await this.cardsFromToken(dto.businessCardToken);
    delete dto.businessCardToken;
    delete dto.businessCards;
    if (cards) dto.businessCards = { ...(current?.businessCards || {}), ...cards };
  }

  async addCardPhotos(id: string, files: { front?: CardFile; back?: CardFile }, actor: UploadActor) {
    if (!this.attachments) throw new BadRequestException('Uploads need Google connected (Settings → Integrations).');
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    const sides = (['front', 'back'] as Side[]).filter((s) => files[s]);
    if (!sides.length) throw new BadRequestException('Add a photo of the card.');
    const uploaded = await this.attachments.upload(sides.map((s) => files[s]!), 'Business cards', actor);
    const cards = { ...(person.businessCards || {}) };
    for (const [i, s] of sides.entries()) { await this.attachments.discard(cards[s] || undefined); cards[s] = uploaded[i]; }
    await this.repo.update({ id: person.id }, { businessCards: cards } as any);
    return { ...person, businessCards: cards };
  }

  async removeCardPhoto(id: string, side: Side) {
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    const cards = { ...(person.businessCards || {}) };
    await this.attachments?.discard(cards[side] || undefined);
    cards[side] = null;
    await this.repo.update({ id: person.id }, { businessCards: cards } as any);
    return { ...person, businessCards: cards };
  }

  async cardPhoto(id: string, side: Side): Promise<TaskAttachment> {
    const person = await this.repo.findOneBy({ id: Number(id) });
    const att = person?.businessCards?.[side];
    if (!att) throw new NotFoundException('No card photo.');
    return att;
  }

  async create(dto: any) {
    dto = { ...dto };
    const sameAsId = Number(dto.sameAsId) || null;
    delete dto.sameAsId;
    if (dto.formerCompanies) dto.formerCompanies = cleanFormer(dto.formerCompanies);
    await this.applyCardToken(dto);
    if ('projectIds' in dto || 'projects' in dto) Object.assign(dto, projectsToStore(dto, await this.projectRefs()));
    const id = Number(dto.id) || (await this.nextId());
    const now = new Date().toISOString();
    const person = { projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added', ...dto, id, contactStatus: 'active', contactStatusAt: now, lastActivityAt: now };
    const saved = await this.repo.save(this.repo.create(person as Partial<PersonEntity>));
    // Staff are employees too -- one record in both People and Manpower.
    if (saved.kind === 'Staff' && !saved.employeeId && this.staff) await this.staff.employeeForPerson(saved);
    // A sub company is a contractor too -- one record in People and Manpower -> Contractors.
    if (isSubCompany(saved) && this.subs) await this.subs.contractorForPerson(saved);
    if (sameAsId) return (await this.link(String(saved.id), String(sameAsId))).person;
    return saved;
  }

  /** People who may be the same as the one being added (same name, email or phone). */
  /**
   * Consultants saved the old way (Nov 10): the firm as the name and the person
   * as the "primary contact". Each becomes the person, with the firm as their
   * company. Only records with a contact person; read-only unless confirmed.
   */
  async consultantFixPlan() {
    const rows = await this.repo.find({ where: { kind: 'Consultant' } as any });
    return rows
      .filter((p) => String(p.contact || '').trim() && String(p.contact).trim().toLowerCase() !== String(p.name || '').trim().toLowerCase())
      .map((p) => ({ id: p.id, nameNow: p.name, nameAfter: String(p.contact).trim(), company: String(p.company || '').trim() || p.name }));
  }

  async applyConsultantFix(confirm: boolean) {
    const plan = await this.consultantFixPlan();
    if (!confirm) return { applied: false, plan };
    for (const p of plan) {
      const [firstName, ...rest] = p.nameAfter.split(/\s+/);
      await this.repo.update({ id: p.id } as any, { name: p.nameAfter, company: p.company, contact: null, firstName, lastName: rest.join(' ') || null } as any);
    }
    return { applied: true, changed: plan.length };
  }

  async duplicates(q: { name?: string; firstName?: string; lastName?: string; email?: string; phone?: string; exclude?: string }) {
    const rows = await this.repo.find({ select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, company: true, kind: true, contactStatus: true, contactStatusReason: true, lastActivityAt: true } });
    return findDuplicates(q, rows as DupRow[], q.exclude ? Number(q.exclude) : null).slice(0, 10);
  }

  /** Mark two records as the same person (both ways). Each keeps its own details. */
  async link(id: string, otherId: string) {
    const [a, b] = await Promise.all([this.repo.findOneBy({ id: Number(id) }), this.repo.findOneBy({ id: Number(otherId) })]);
    if (!a || !b) throw new NotFoundException('Contact not found.');
    if (a.id === b.id) throw new BadRequestException('A contact can\'t be linked to itself.');
    a.sameAsIds = withLink(a.sameAsIds, b.id, a.id);
    b.sameAsIds = withLink(b.sameAsIds, a.id, b.id);
    // Someone now at a new company: the old (expired) record's company joins their history.
    a.formerCompanies = formerFromExpired(a, b);
    b.formerCompanies = formerFromExpired(b, a);
    await this.repo.save([a, b]);
    return { person: a, other: b };
  }

  async unlink(id: string, otherId: string) {
    const [a, b] = await Promise.all([this.repo.findOneBy({ id: Number(id) }), this.repo.findOneBy({ id: Number(otherId) })]);
    if (!a) throw new NotFoundException('Contact not found.');
    a.sameAsIds = withoutLink(a.sameAsIds, Number(otherId));
    if (b) b.sameAsIds = withoutLink(b.sameAsIds, a.id);
    await this.repo.save(b ? [a, b] : [a]);
    return a;
  }

  /** The phases someone works on for one project: crm, design, precon, construction (none = unset). */
  async setProjectPhases(id: string, project: string, phases: unknown) {
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    const name = String(project || '').trim();
    if (!name) throw new BadRequestException('Which project?');
    const list = (Array.isArray(phases) ? phases : []).map(String);
    const bad = list.find((p) => !PROJECT_PHASES.includes(p));
    if (bad) throw new BadRequestException(`Unknown phase "${bad}".`);
    const next = { ...(person.projectPhases || {}) };
    if (list.length) next[name] = PROJECT_PHASES.filter((p) => list.includes(p)); else delete next[name];
    person.projectPhases = Object.keys(next).length ? next : null;
    return this.repo.save(person);
  }

  async update(id: string, dto: any) {
    const numId = Number(id);
    const person = await this.repo.findOneBy({ id: numId });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    const now = new Date().toISOString();
    const patch: Record<string, any> = { ...dto };
    delete patch.lastActivityAt;
    if ('formerCompanies' in patch) patch.formerCompanies = cleanFormer(patch.formerCompanies);
    // Projects by id (Nov 13): ids are the record, names follow.
    if ('projectIds' in patch || 'projects' in patch) Object.assign(patch, projectsToStore(patch, await this.projectRefs()));
    await this.applyCardToken(patch, person);
    // Status changes are recorded with when and why; any other edit, or setting it Active, counts as activity.
    if ('contactStatus' in patch) {
      const next = String(patch.contactStatus || 'active').toLowerCase();
      if (!(CONTACT_STATUSES as readonly string[]).includes(next)) throw new BadRequestException('Status is Active, Review or Expired.');
      // Expired needs a reason (Oct 27 backlog): why this contact is no longer current.
      if (next === 'expired' && next !== person.contactStatus && !String(patch.contactStatusReason || '').trim()) throw new BadRequestException('Say why this contact is expired.');
      if (next !== (person.contactStatus || 'active')) Object.assign(patch, { contactStatus: next, contactStatusAt: now, contactStatusReason: String(patch.contactStatusReason || '').trim().slice(0, 300) || null });
      else delete patch.contactStatusReason;
      if (next === 'active') patch.lastActivityAt = now;
    }
    if (Object.keys(dto).some((k) => !k.startsWith('contactStatus'))) patch.lastActivityAt = now;
    Object.assign(person, patch, { id: numId });
    const saved = await this.repo.save(person);
    await this.staff?.personChanged(saved, dto);
    await this.subs?.personChanged(saved, dto);
    return saved;
  }

  async remove(id: string) {
    const numId = Number(id);
    const person = await this.repo.findOneBy({ id: numId });
    if (person?.employeeId) {
      throw new BadRequestException(`${person.name} is also an employee -- end or remove them in Manpower -> Employees and this entry follows.`);
    }
    if (person?.contractorId) await this.subs?.removeForPerson(person);
    if (person) await this.repo.remove(person);
    return { id: numId, deleted: true };
  }
}
