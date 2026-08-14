import { ScoringService } from './scoring.service';
import { ScoringCriterion } from '../seed-data/scoring';
export declare class ScoringController {
    private readonly scoringService;
    constructor(scoringService: ScoringService);
    getTemplate(): Promise<ScoringCriterion[]>;
    saveTemplate(criteria: ScoringCriterion[]): Promise<ScoringCriterion[]>;
}
