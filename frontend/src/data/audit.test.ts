import { describe, expect, it } from 'vitest';
import { auditCsvRows, changeText, fieldLabel, headline, typesIn, type AuditRow } from './audit';

const row = (o: Partial<AuditRow>): AuditRow => ({ id: '1', at: '2026-10-27T10:00:00Z', userId: 'U', userName: 'Edward', entityType: 'Project', entityId: '4', label: 'Narvaes', action: 'updated', projectId: 4, projectName: 'Narvaes', changes: [], source: 'app', ...o });

describe('audit log text', () => {
  it('field labels', () => {
    expect(fieldLabel('dueDate')).toBe('Due date');
    expect(fieldLabel('contract_type')).toBe('Contract type');
  });
  it('change text', () => {
    expect(changeText({ field: 'stage', from: 'Design', to: 'Construction' })).toBe('Stage: Design → Construction');
    expect(changeText({ field: 'name', from: null, to: 'A' })).toBe('Name: A');
    expect(changeText({ field: 'notes', from: 'x', to: null })).toBe('Notes: cleared (was x)');
  });
  it('headline and csv', () => {
    expect(headline(row({}))).toBe('Edward updated Project Narvaes');
    expect(headline(row({ action: 'stage', entityType: 'Deal', label: null, entityId: 'D-1' }))).toBe('Edward changed stage on Deal D-1');
    expect(headline(row({ source: 'finance', action: 'sent', entityType: 'Finance · invoice', label: null, entityId: 'INV-1' }))).toBe('Edward sent Finance · invoice INV-1');
    expect(auditCsvRows([row({ changes: [{ field: 'stage', from: 'A', to: 'B' }] })])[0]).toMatchObject({ who: 'Edward', record: 'Narvaes', changes: 'Stage: A → B' });
    expect(typesIn([row({}), row({ entityType: 'Contact' }), row({})])).toEqual(['Contact', 'Project']);
  });
});
