import { BadRequestException } from '@nestjs/common';
import { DEFAULT_EMAIL_TEMPLATES } from '../seed-data/email-templates';
import { assertFilled, assertKnownTokens, canonical, findPlaceholders, suggest, unfilled } from './placeholders';

describe('placeholders', () => {
  it('reads every spelling of a field as the same one', () => {
    expect(findPlaceholders('{client_name} {{ clientName }} {{clientName}} {{Client_Name}}').map((p) => p.name)).toEqual(['clientName', 'clientName', 'clientName', 'clientName']);
    expect(canonical('project-title')).toBe('projectTitle');
  });

  it('ignores CSS and plain braces', () => {
    expect(findPlaceholders('<style>p{margin:0} .a { color: red }</style> {} { spaced } {1abc}')).toEqual([]);
  });

  it('lets signing fields through but nothing else unfilled', () => {
    expect(unfilled('Signed {{clientSignature}} on {{signedDate}} {{initials}}')).toEqual([]);
    expect(unfilled('Hi {client_name}', 'About {{projectTitle}} and {client_name}').map((p) => p.raw)).toEqual(['{client_name}', '{{projectTitle}}']);
    expect(() => assertFilled('Hi Jo', '<p style="x">{margin:0}</p>')).not.toThrow();
    expect(() => assertFilled('Hi {client_name}')).toThrow(/Fill in before sending: client name/);
  });

  it('refuses unknown template fields with a suggestion', () => {
    expect(suggest('clientNme')).toBe('clientName');
    expect(suggest('favouriteColour')).toBeNull();
    expect(() => assertKnownTokens('Dear {{client_nme}}')).toThrow(BadRequestException);
    expect(() => assertKnownTokens('Dear {{client_nme}}')).toThrow(/did you mean \{\{clientName\}\}/);
    expect(() => assertKnownTokens('Dear {client_name}, re {{ projectTitle }}')).not.toThrow();
  });

  it('accepts every seeded template', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) expect(() => assertKnownTokens(t.subject, t.body)).not.toThrow();
  });
});
