import { cleanNote, cleanPhotoMeta, isImage, photoFolder, progressSummary } from './progress-photos';

describe('progress photos', () => {
  it('checks the details', () => {
    expect(cleanPhotoMeta({ category: 'Framing', takenOn: '2026-10-12', area: ' Kitchen ', clientVisible: 1 })).toMatchObject({ track: 'construction', category: 'Framing', takenOn: '2026-10-12', area: 'Kitchen', clientVisible: true });
    expect(() => cleanPhotoMeta({ category: '' })).toThrow(/category/);
    expect(() => cleanPhotoMeta({ category: 'a/b' })).toThrow(/cannot contain/);
    expect(() => cleanPhotoMeta({ category: 'X', track: 'other' })).toThrow(/Track/);
    expect(cleanPhotoMeta({ caption: 'Hi' }, true)).toEqual({ caption: 'Hi' });
  });
  it('knows a photo and where it goes', () => {
    expect(isImage({ mimeType: 'image/jpeg' })).toBe(true);
    expect(isImage({ name: 'IMG_1.HEIC' })).toBe(true);
    expect(isImage({ name: 'plan.pdf', mimeType: 'application/pdf' })).toBe(false);
    expect(photoFolder('design', '3D Renderings')).toEqual(['Photos', 'Progress', 'Design', '3D Renderings']);
  });

  it('checks a progress update and sums up the latest per category', () => {
    expect(cleanNote({ category: 'Framing', percent: 100, date: '2026-10-10' })).toMatchObject({ status: 'complete', percent: 100 });
    expect(cleanNote({ category: 'Framing', percent: 40, date: '2026-10-10' }).status).toBe('in_progress');
    expect(() => cleanNote({ category: 'Framing', percent: 140 })).toThrow(/0 to 100/);
    const s = progressSummary([
      { track: 'construction', category: 'Framing', percent: 40, date: '2026-10-01', createdAt: 'a' },
      { track: 'construction', category: 'Framing', percent: 80, date: '2026-10-10', createdAt: 'b' },
      { track: 'construction', category: 'Drywall', percent: 0, date: '2026-10-10', createdAt: 'c' },
      { track: 'design', category: 'Selections', percent: 100, date: '2026-09-01', createdAt: 'd' },
    ]);
    expect(s).toMatchObject({ construction: 40, design: 100, overall: 60 });
    expect(s.latest.find((x) => x.category === 'Framing')?.percent).toBe(80);
  });
});
