import { cleanPhotoMeta, isImage, photoFolder } from './progress-photos';

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
});
