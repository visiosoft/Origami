// Shared types for the Client Qualification Checklist & Point System.

export interface ScoringOption {
  label: string;
  points: number;
}

export interface ScoringCriterion {
  key: string;
  order: number;
  name: string;
  subCriteria: string;
  maxPoints: number;
  options: ScoringOption[];
}

export const totalPossible = (criteria: ScoringCriterion[]): number =>
  criteria.reduce((sum, c) => sum + (Number(c.maxPoints) || 0), 0);

// Sum of points for the currently selected option per criterion.
export const scoreFor = (
  criteria: ScoringCriterion[],
  selections: Record<string, string>,
): number =>
  criteria.reduce((sum, c) => {
    const label = selections[c.key];
    const opt = c.options.find((o) => o.label === label);
    return sum + (opt ? Number(opt.points) || 0 : 0);
  }, 0);
