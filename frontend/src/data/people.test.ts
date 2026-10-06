import { describe, expect, it } from 'vitest';
import { internalLevelOf, levelFromRole } from './people';
import { stageLabel } from './projects';

describe('internal levels', () => {
  it('reads the level from the role title', () => {
    expect(levelFromRole('Lead Architect · Principal')).toBe('Executive');
    expect(levelFromRole('Director of Operations')).toBe('Executive');
    expect(levelFromRole('Site Superintendent')).toBe('Super');
    expect(levelFromRole('Framing Foreman')).toBe('Foreman');
    expect(levelFromRole('General Laborer')).toBe('Labor');
    expect(levelFromRole('Project Coordinator')).toBe('Staff');
    expect(levelFromRole('Supervisor')).toBe('Staff');
    expect(levelFromRole(undefined)).toBe('Staff');
  });
  it('uses the level set on the record, and only for internal people', () => {
    expect(internalLevelOf({ kind: 'Staff', role: 'Estimator', internalLevel: 'Executive' })).toBe('Executive');
    expect(internalLevelOf({ kind: 'Staff', role: 'Site Superintendent', internalLevel: '' })).toBe('Super');
    expect(internalLevelOf({ kind: 'Staff', role: 'Estimator', internalLevel: 'Nonsense' })).toBe('Staff');
    expect(internalLevelOf({ kind: 'Client', role: 'Owner' })).toBeNull();
  });
});

describe('project stage labels', () => {
  it('shows Kickoff as CRM and Closeout as Closed', () => {
    expect(stageLabel('Kickoff')).toBe('CRM');
    expect(stageLabel('Closeout')).toBe('Closed');
    expect(stageLabel('Design')).toBe('Design');
    expect(stageLabel('Something else')).toBe('Something else');
  });
});
