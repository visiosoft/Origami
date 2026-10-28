import { describe, expect, it } from 'vitest';
import { sanitizeHtml, splitAtInitials, waitingOn } from './contracts';

describe('contracts', () => {
  it('splits at the initials boxes', () => {
    expect(splitAtInitials('<p>A</p>{{initials}}<p>B</p>{{ initials }}')).toEqual(['<p>A</p>', '<p>B</p>', '']);
  });
  it('says who it waits on', () => {
    const parties = [{ key: 'p1', role: 'owner', label: 'Owner', name: 'Kai', email: '' }, { key: 'p2', role: 'origami', label: 'Origami', name: 'E', email: '', internal: true }];
    expect(waitingOn({ status: 'sent', parties })).toBe('Waiting on Kai, Origami');
    expect(waitingOn({ status: 'signed', parties })).toBe('');
  });
  it('strips scripts, handlers and javascript links', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="data:image/png;base64,AA"></p>');
    expect(out).toBe('<p>Hi<a>x</a><img src="data:image/png;base64,AA"></p>');
  });
});
