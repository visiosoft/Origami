import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoringCriterionEntity } from '../database/entities';
import { DEFAULT_SCORING, ScoringCriterion } from '../seed-data/scoring';

@Injectable()
export class ScoringService implements OnApplicationBootstrap {
  private readonly log = new Logger('ScoringService');

  constructor(
    @InjectRepository(ScoringCriterionEntity) private readonly repo: Repository<ScoringCriterionEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_SCORING as unknown as ScoringCriterionEntity[]);
        this.log.log(`Seeded ${DEFAULT_SCORING.length} scoring criteria`);
      }
    } catch (err) {
      this.log.error('Scoring seed failed: ' + (err as Error).message);
    }
  }

  async getTemplate(): Promise<ScoringCriterion[]> {
    const rows = await this.repo.find({ order: { order: 'ASC' } });
    return rows as unknown as ScoringCriterion[];
  }

  // Replace the whole template in one shot (the Settings editor saves all at once).
  async saveTemplate(criteria: ScoringCriterion[]): Promise<ScoringCriterion[]> {
    const clean = (criteria || []).map((c, i) => ({
      key: c.key || 'c_' + i,
      order: typeof c.order === 'number' ? c.order : i + 1,
      name: c.name || '',
      subCriteria: c.subCriteria || '',
      maxPoints: Number(c.maxPoints) || 0,
      options: (c.options || []).map((o) => ({ label: o.label || '', points: Number(o.points) || 0 })),
    }));
    await this.repo.clear();
    await this.repo.save(clean as unknown as ScoringCriterionEntity[]);
    return this.getTemplate();
  }
}
