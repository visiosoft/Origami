import { CONTRACT_TYPES, DEFAULT_TEMPLATES, countInitials, initialsOf, mergeContract, renderSigned, statusFromParties, unfilledFields } from './contract-types';

describe('contracts', () => {
  it('has a default template for each of the six types, each with initials boxes', () => {
    expect(CONTRACT_TYPES.map((t) => t.key)).toEqual(['gc', 'owner', 'sub', 'consultant', 'co_owner', 'co_sub']);
    for (const t of CONTRACT_TYPES) expect(countInitials(DEFAULT_TEMPLATES[t.key].html)).toBeGreaterThan(1);
  });
  it('merges fields, escapes them, keeps unknown ones and initials visible', () => {
    const html = mergeContract('<p>{{project.name}} for {{ contract.amount }} — {{owner.name}} {{initials}} {{bogus}}</p>', { 'project.name': 'Narvaes <Res>', 'contract.amount': '$812,000' });
    expect(html).toBe('<p>Narvaes &lt;Res&gt; for $812,000 — {{owner.name}} {{initials}} {{bogus}}</p>');
    expect(unfilledFields(html)).toEqual(['owner.name', 'bogus']);
  });
  it('status from the parties: out, waiting on Origami, signed', () => {
    const owner = { key: 'p1', role: 'owner', label: 'Owner', name: 'Kai', email: 'k@x' };
    const us = { key: 'p2', role: 'origami', label: 'Origami', name: 'Edward', email: 'e@x', internal: true };
    expect(statusFromParties([owner, us])).toBe('sent');
    expect(statusFromParties([{ ...owner, signedAt: 'x' }, us])).toBe('countersign');
    expect(statusFromParties([{ ...owner, signedAt: 'x' }, { ...us, signedAt: 'y' }])).toBe('signed');
    expect(statusFromParties([{ ...owner, signedAt: 'x' }, { key: 'c', role: 'copy', label: 'Copy', name: 'A', email: 'a@x' }])).toBe('signed');
  });
  it('renders initials in every box and a signature block per signer', () => {
    const out = renderSigned('<p>A {{initials}}</p><p>B {{initials}}</p>', [
      { key: 'p1', role: 'owner', label: 'Owner', name: 'Kai Lono', email: '', signedAt: '2026-10-27T10:00:00Z', initials: 'KL', signatureImage: 'data:image/png;base64,AAA', signedName: 'Kai Lono' },
      { key: 'p2', role: 'origami', label: 'Origami', name: 'Edward', email: '', internal: true },
    ]);
    expect(out.match(/>KL</g)).toHaveLength(2);
    expect(out).toContain('Signature of Kai Lono');
    expect(out).toContain('Date: ____________________');
    expect(initialsOf('kai  lono')).toBe('KL');
  });
});
