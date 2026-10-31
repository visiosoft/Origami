import { describe, expect, it } from 'vitest';
import { asHtml, htmlToText, isHtml, textToHtml } from './templateHtml';
import { KNOWN_TOKENS, TOKEN_GROUPS } from './placeholders';

describe('templates as HTML', () => {
  it('turns plain text into paragraphs, and leaves HTML alone', () => {
    expect(textToHtml('Hi {{clientName}},\n\nThanks <3\nSee you')).toBe('<p>Hi {{clientName}},</p><p>Thanks &lt;3<br/>See you</p>');
    expect(asHtml('<p><strong>Hi</strong></p>')).toBe('<p><strong>Hi</strong></p>');
    expect(isHtml('a < b and c > d')).toBe(false);
  });
  it('reads HTML back as text', () => {
    expect(htmlToText('<h2>Next</h2><ul><li>One</li><li>Two</li></ul><p>A&amp;B</p>')).toBe('Next\n\n• One\n\n• Two\n\nA&B');
  });
  it('offers every merge field in the picker', () => {
    expect(TOKEN_GROUPS.flatMap((g) => g.tokens).sort()).toEqual([...KNOWN_TOKENS].sort());
  });
});
