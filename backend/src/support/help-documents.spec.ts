import { cleanHelpDoc } from './help-documents';

describe('Help -> Policies documents (Nov 17)', () => {
  it('needs a title and an https link', () => {
    expect(() => cleanHelpDoc({ url: 'https://x' })).toThrow(/title/);
    expect(() => cleanHelpDoc({ title: 'SOP', url: 'javascript:alert(1)' })).toThrow(/link/);
    expect(() => cleanHelpDoc({ title: 'SOP', url: 'http://plain' })).toThrow(/link/);
  });
  it('keeps known kinds, others become Other', () => {
    expect(cleanHelpDoc({ title: ' Disaster recovery ', url: 'https://drive.google.com/x', kind: 'disaster' })).toMatchObject({ title: 'Disaster recovery', kind: 'disaster', summary: null });
    expect(cleanHelpDoc({ title: 'X', url: 'https://a.b', kind: 'weird' }).kind).toBe('other');
  });
});
