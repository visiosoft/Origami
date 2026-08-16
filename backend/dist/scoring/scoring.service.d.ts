import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ScoringCriterionEntity } from '../database/entities';
import { ScoringCriterion } from '../seed-data/scoring';
export declare class ScoringService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<ScoringCriterionEntity>);
    onApplicationBootstrap(): Promise<void>;
    getTemplate(): Promise<ScoringCriterion[]>;
    saveTemplate(criteria: ScoringCriterion[]): Promise<ScoringCriterion[]>;
}
