import { describe, expect, it } from 'vitest';
import { parseVcf } from './vcard';

const VCF = `BEGIN:VCARD
VERSION:3.0
N:Lono;Kai;;;
FN:Kai Lono
ORG:Kestrel Electric;
TITLE:Estimator
TEL;TYPE=WORK:808 555 0100
TEL;TYPE=CELL:(808) 555-0101
EMAIL;TYPE=INTERNET;TYPE=WORK:kai@kestrel.test
item1.ADR;TYPE=WORK:;;12 Oak St;Honolulu;HI;96813;USA
END:VCARD
BEGIN:VCARD
VERSION:2.1
N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ng;Iv=C3=A9;;;
TEL;CELL:555-0111
END:VCARD
BEGIN:VCARD
END:VCARD
`;

describe('vCard import', () => {
  it('reads cards into People import rows', () => {
    const rows = parseVcf(VCF);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Name: 'Kai Lono', 'First name': 'Kai', 'Last name': 'Lono', Company: 'Kestrel Electric', 'Role or trade': 'Estimator', Phone: '(808) 555-0101', Email: 'kai@kestrel.test', Street: '12 Oak St', City: 'Honolulu', State: 'HI', ZIP: '96813' });
    expect(rows[1]).toMatchObject({ Name: 'Ivé Ng', Phone: '555-0111' });
  });
  it('unfolds long lines (Windows line endings too)', () => {
    expect(parseVcf('BEGIN:VCARD\r\nFN:Ana Rui\r\n z\r\nEND:VCARD\r\n')[0].Name).toBe('Ana Ruiz');
  });
});
