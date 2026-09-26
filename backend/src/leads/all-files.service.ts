import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileRoomFileEntity, LeadEntity, LeadFilesEntity, ProjectEntity, ProjectPhaseEntity, ProjectTaskEntity, RfiEntity, TaskEntity,
} from '../database/entities';
import { normalizeAttachments } from '../database/task.types';

/** Where a file came from -- decides its label and how it's opened. */
export type FileSource = 'lead' | 'client' | 'lead-task' | 'project-task' | 'rfi' | 'file-room';

export interface IndexedFile {
  /** Its number on this lead / project: 1 for the first file ever added, and it never changes. */
  n: number;
  id: string; name: string; kind: string; mimeType?: string; size?: number;
  uploadedAt?: string; uploadedBy?: string;
  source: FileSource;
  /** e.g. "Schedule Site Visit", "Task 20260926-01 · Collect the survey", "RFI-003 · Header size". */
  where: string;
  taskNumber?: string;
  /** How the browser opens it: the attachments route (scope + owner id), or the File Room. */
  scope: 'lead-files' | 'tasks' | 'project-tasks' | 'rfis' | 'file-room';
  ownerId: string;
  url?: string;
}

const headline = (s?: string) => String(s || '').split('\n')[0].trim().slice(0, 80);

/**
 * Every file on a lead and on the project it became, in one list (the Files
 * tab on both): the lead's own files by stage, what the client uploaded,
 * files on its Request Log tasks (with the task number), and once it's a
 * project, its board tasks, RFIs and Plan & File Room. Numbered in the order
 * they were added, so a file keeps its number as more arrive.
 */
@Injectable()
export class AllFilesService {
  constructor(
    @InjectRepository(LeadFilesEntity) private readonly leadFiles: Repository<LeadFilesEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly boardTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    @InjectRepository(FileRoomFileEntity) private readonly fileRoom: Repository<FileRoomFileEntity>,
  ) {}

  async forLead(leadId: string) {
    const project = await this.projects.findOneBy({ leadId });
    return this.collect(leadId, project);
  }

  async forProject(projectId: number) {
    const project = await this.projects.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');
    return this.collect(project.leadId || null, project);
  }

  private async collect(leadId: string | null, project: ProjectEntity | null) {
    const out: Omit<IndexedFile, 'n'>[] = [];
    const base = (a: any) => ({ id: a.id, name: a.name, kind: a.kind, mimeType: a.mimeType, size: a.size, uploadedAt: a.uploadedAt, uploadedBy: a.uploadedBy, ...(a.kind === 'link' ? { url: a.url } : {}) });

    if (leadId) {
      const lf = await this.leadFiles.findOneBy({ leadId });
      for (const a of normalizeAttachments(lf?.attachments) as any[]) {
        const client = a.stage === 'client_upload';
        out.push({ ...base(a), source: client ? 'client' : 'lead', where: client ? (a.stageName && a.stageName !== 'Uploaded by the client' ? `From the client · ${String(a.stageName).replace(/^Client: /, '')}` : 'From the client') : a.stageName || 'Lead', scope: 'lead-files', ownerId: leadId });
      }
      // Request Log tasks on the lead (its tasks are filed under the lead id), and under the project's name once converted.
      const tasks = (await this.logTasks.find()).filter((t) => t.project === leadId || (project && (t.project === project.name || t.project === String(project.id))));
      for (const t of tasks) {
        for (const a of normalizeAttachments(t.attachments)) {
          out.push({ ...base(a), source: 'lead-task', where: `Task ${t.id}${headline(t.description) ? ` · ${headline(t.description)}` : ''}`, taskNumber: t.id, scope: 'tasks', ownerId: t.id });
        }
      }
    }

    if (project) {
      const [tasks, phases, rfis, rooms] = await Promise.all([
        this.boardTasks.find({ where: { projectId: project.id } }), this.phases.find({ where: { projectId: project.id } }),
        this.rfis.find({ where: { projectId: project.id } }), this.fileRoom.find({ where: { projectId: project.id } }),
      ]);
      const phaseName = new Map(phases.map((p) => [p.id, p.name]));
      for (const t of tasks) {
        for (const a of normalizeAttachments(t.attachments)) {
          const phase = t.phaseId ? phaseName.get(t.phaseId) : '';
          out.push({ ...base(a), source: 'project-task', where: `${phase ? `${phase} · ` : ''}Task: ${t.title}`, scope: 'project-tasks', ownerId: t.id });
        }
      }
      for (const r of rfis) {
        for (const a of normalizeAttachments(r.attachments)) out.push({ ...base(a), source: 'rfi', where: `${r.number} · ${r.subject}`, scope: 'rfis', ownerId: r.id });
      }
      for (const f of rooms.filter((x) => x.isLatest !== false)) {
        out.push({
          id: f.id, name: f.name, kind: 'drive', mimeType: f.mimeType, size: Number(f.size) || undefined, uploadedAt: f.updatedAt, uploadedBy: f.uploadedBy,
          source: 'file-room', where: `Plan & File Room${(f.folderPath || []).length ? ' › ' + f.folderPath.join(' › ') : ''}`, scope: 'file-room', ownerId: String(project.id),
        });
      }
    }

    // Numbered in the order they were added (oldest = 1); shown newest first.
    const numbered = out
      .map((f, i) => ({ f, i }))
      .sort((a, b) => (a.f.uploadedAt || '').localeCompare(b.f.uploadedAt || '') || a.i - b.i)
      .map(({ f }, i) => ({ ...f, n: i + 1 }));
    const lead = leadId ? await this.leads.findOneBy({ id: leadId }) : null;
    return {
      leadId, projectId: project?.id ?? null, projectName: project?.name || lead?.leadName || '',
      files: numbered.reverse(),
    };
  }
}
