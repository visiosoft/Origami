import { BadRequestException } from '@nestjs/common';

/**
 * Progress Photos: each project's photos sorted by track (construction or
 * design) and category. The files live in the File Room under
 * Photos / Progress / <Track> / <Category>; this adds what they show.
 */
export type PhotoTrack = 'construction' | 'design';
export const TRACK_LABEL: Record<PhotoTrack, string> = { construction: 'Construction', design: 'Design' };

/** In build order. `cover`: work that gets covered up -- photograph it before it is. */
export const CONSTRUCTION_CATEGORIES: { name: string; cover?: boolean }[] = [
  { name: 'Existing Conditions' }, { name: 'Site Prep & Demolition' }, { name: 'Excavation & Foundation' },
  { name: 'Framing', cover: true }, { name: 'Roofing & Exterior Envelope' }, { name: 'Windows & Doors' },
  { name: 'Rough Plumbing', cover: true }, { name: 'Rough Electrical', cover: true }, { name: 'Rough HVAC', cover: true },
  { name: 'Insulation', cover: true }, { name: 'Drywall' }, { name: 'Interior Finishes' }, { name: 'Cabinets & Countertops' },
  { name: 'Flooring' }, { name: 'Fixtures & Trim' }, { name: 'Exterior Finishes & Landscape' },
  { name: 'Inspections' }, { name: 'Deliveries & Materials' }, { name: 'Issues & Damage' }, { name: 'Punch List' }, { name: 'Completion' },
];
export const DESIGN_CATEGORIES: { name: string }[] = [
  { name: 'Existing Conditions & Site Survey' }, { name: 'Inspiration & Mood' }, { name: 'Sketches & Concepts' },
  { name: 'Drawings & Plans' }, { name: '3D Renderings' }, { name: 'Material & Finish Samples' }, { name: 'Selections' },
  { name: 'Design Review Meetings' }, { name: 'Models & Mock-ups' },
];
export const categoriesOf = (track: PhotoTrack) => (track === 'design' ? DESIGN_CATEGORIES : CONSTRUCTION_CATEGORIES).map((c) => c.name);

/** The File Room folder a photo lives in. */
export const photoFolder = (track: PhotoTrack, category: string) => ['Photos', 'Progress', TRACK_LABEL[track], category];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;
export const isImage = (f: { mimeType?: string | null; name?: string | null }) => /^image\//i.test(f.mimeType || '') || IMAGE_EXT.test(f.name || '');

export interface PhotoMeta { track: PhotoTrack; category: string; area: string; takenOn: string; caption: string; tags: string[]; clientVisible: boolean }

/** A photo's details as sent; `partial` for an edit. Categories outside the list are allowed (a team's own), but not blank. */
export function cleanPhotoMeta(dto: any, partial = false): Partial<PhotoMeta> {
  const out: Partial<PhotoMeta> = {};
  const has = (k: string) => dto && dto[k] !== undefined;
  if (has('track') || !partial) {
    const t = String(dto?.track || 'construction');
    if (t !== 'construction' && t !== 'design') throw new BadRequestException('Track is construction or design.');
    out.track = t;
  }
  if (has('category') || !partial) {
    const c = String(dto?.category || '').trim().slice(0, 80);
    if (!c) throw new BadRequestException('Pick a category.');
    if (/[\\/]/.test(c)) throw new BadRequestException('A category name cannot contain / or \\.');
    out.category = c;
  }
  if (has('area')) out.area = String(dto.area || '').trim().slice(0, 120);
  if (has('caption')) out.caption = String(dto.caption || '').trim().slice(0, 1000);
  if (has('takenOn') || !partial) {
    const d = String(dto?.takenOn || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (!ISO.test(d)) throw new BadRequestException('The date taken is not a date.');
    out.takenOn = d;
  }
  if (has('tags')) out.tags = (Array.isArray(dto.tags) ? dto.tags : []).map((x: unknown) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  if (has('clientVisible')) out.clientVisible = !!dto.clientVisible;
  return out;
}
