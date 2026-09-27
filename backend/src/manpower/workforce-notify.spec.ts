import { approverEmails } from './workforce-requests.service';

const roles = [
  { key: 'admin', permissions: {} },
  { key: 'hr_officer', permissions: { manpower_con: { view: true, manage: true } } },
  { key: 'site_super', permissions: { dashboard: { view: true, manage: false } } },
] as any;
const u = (id: string, roleKey: string, extra: any = {}) => ({ id, email: `${id}@x.com`, roleKey, status: 'active', tier: 'internal', ...extra });

describe('approverEmails', () => {
  it('goes to HR, not the superintendent who asked', () => {
    expect(approverEmails([u('super', 'site_super'), u('hr', 'hr_officer'), u('boss', 'admin')], roles, 'super')).toEqual(['hr@x.com']);
  });
  it('falls back to administrators when nobody has HR rights, skipping suspended and outside accounts', () => {
    expect(approverEmails([u('super', 'site_super'), u('boss', 'admin'), u('old', 'admin', { status: 'suspended' }), u('cli', 'admin', { tier: 'client' })], roles, 'super')).toEqual(['boss@x.com']);
  });
  it('never emails the requester, even an HR requester', () => {
    expect(approverEmails([u('hr', 'hr_officer'), u('boss', 'admin')], roles, 'hr')).toEqual(['boss@x.com']);
  });
});
