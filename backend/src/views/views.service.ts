import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserViewEntity } from '../database/entities';

const PAGE = /^[a-z0-9][a-z0-9._-]{0,60}$/;

/** Saved views: each person's own named filter sets, per list page. */
@Injectable()
export class ViewsService {
  constructor(@InjectRepository(UserViewEntity) private readonly repo: Repository<UserViewEntity>) {}

  async list(userId: string, page: string) {
    if (!PAGE.test(page || '')) throw new BadRequestException('Unknown page.');
    return (await this.repo.find({ where: { userId, page } })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Saving under a name you already used replaces that view. */
  async save(userId: string, dto: { page?: string; name?: string; filters?: unknown }) {
    const page = String(dto.page || '');
    const name = String(dto.name || '').trim();
    if (!PAGE.test(page)) throw new BadRequestException('Unknown page.');
    if (!name) throw new BadRequestException('Name the view.');
    if (name.length > 80) throw new BadRequestException('Keep the name under 80 characters.');
    const filters = dto.filters && typeof dto.filters === 'object' && !Array.isArray(dto.filters) ? dto.filters as Record<string, unknown> : {};
    if (JSON.stringify(filters).length > 8000) throw new BadRequestException('That view is too large to save.');
    const same = (await this.repo.find({ where: { userId, page } })).find((v) => v.name.toLowerCase() === name.toLowerCase());
    const row = same
      ? Object.assign(same, { name, filters })
      : this.repo.create({ id: 'UV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(), userId, page, name, filters, createdAt: new Date().toISOString() });
    return this.repo.save(row);
  }

  async remove(userId: string, id: string) {
    const v = await this.repo.findOneBy({ id });
    if (!v || v.userId !== userId) throw new NotFoundException('View not found.');
    await this.repo.delete({ id });
    return { ok: true };
  }
}
