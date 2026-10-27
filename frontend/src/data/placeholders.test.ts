import { describe, expect, it } from 'vitest';
import { hasUnfilled, unfilled, unknownTokens } from './placeholders';
import { mergeTokens } from './clientPersonality';

describe('placeholders', () => {
  it('merges every spelling of a field', () => {
    expect(mergeTokens('Hi {client_name}, re {{ projectTitle }} — {{clientName}}', { clientName: 'Jo', projectTitle: 'Narvaes' }))
      .toBe('Hi Jo, re Narvaes — Jo');
  });
  it('leaves a field with no value in place, so the send check catches it', () => {
    const text = mergeTokens('From {{senderName}} on {{date}}', { senderName: '', date: 'Oct 27' });
    expect(text).toBe('From {{senderName}} on Oct 27');
    expect(unfilled(text).map((p) => p.raw)).toEqual(['{{senderName}}']);
    expect(hasUnfilled('<style>p{margin:0}</style> Signed {{clientSignature}}')).toBe(false);
  });
  it('names unknown template fields and suggests the right one', () => {
    expect(unknownTokens('Dear {{client_nme}}', '{client_name}')).toEqual(["{{client_nme}} isn't a merge field — did you mean {{clientName}}?"]);
  });
});
