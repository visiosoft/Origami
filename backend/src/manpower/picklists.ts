import { Body, Controller, Get, Headers, Injectable, Put } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { SettingsService } from '../settings/settings.service';
import { HR_MODULE, ManpowerAccess } from './manpower-access.service';

export const PICKLISTS_KEY = 'manpower.picklists';

export interface Picklists { departments: string[]; designations: string[]; skills: string[] }

/**
 * Starting lists for a US design-build contractor. Editable under Manpower ->
 * Setup -> Picklists (the designation list is still to be agreed by the team).
 */
export const DEFAULT_PICKLISTS: Picklists = {
  departments: ['Administration', 'Accounting', 'Design', 'Estimating', 'Project Management', 'Construction / Field', 'Safety', 'Warehouse & Logistics'],
  designations: [
    'Principal', 'Project Manager', 'Assistant Project Manager', 'Project Coordinator', 'Site Superintendent', 'Foreman', 'Lead Carpenter',
    'Carpenter', 'Carpenter Apprentice', 'Electrician', 'Plumber', 'HVAC Technician', 'Laborer', 'Equipment Operator', 'Estimator',
    'Designer', 'Drafter', 'Office Manager', 'Bookkeeper',
  ],
  skills: [
    'Framing', 'Finish carpentry', 'Cabinet installation', 'Concrete forming', 'Concrete finishing', 'Rebar', 'Masonry', 'Drywall hanging',
    'Drywall taping', 'Painting', 'Tile setting', 'Flooring', 'Roofing', 'Siding', 'Stucco', 'Insulation', 'Waterproofing', 'Windows & doors',
    'Glazing', 'Electrical rough-in', 'Electrical finish', 'Low voltage', 'Solar', 'Plumbing rough-in', 'Plumbing finish', 'HVAC install',
    'Fire sprinklers', 'Welding (MIG/TIG/ARC)', 'Demolition', 'Excavation', 'Grading', 'Landscaping', 'Fencing', 'Scaffolding',
    'Equipment operation', 'Forklift', 'Fall protection', 'First aid / CPR', 'OSHA 10', 'OSHA 30',
  ],
};

const cleanList = (v: unknown, max = 200) => {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : [])
    .map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 60))
    .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .slice(0, max);
};

/** The saved lists, cleaned; a list never saved (or emptied by mistake) falls back to its defaults. */
export function parsePicklists(raw: unknown): Picklists {
  let v: any = raw;
  if (typeof raw === 'string') { try { v = raw.trim() ? JSON.parse(raw) : null; } catch { v = null; } }
  const pick = (k: keyof Picklists) => { const l = cleanList(v?.[k]); return l.length ? l : DEFAULT_PICKLISTS[k]; };
  return { departments: pick('departments'), designations: pick('designations'), skills: pick('skills') };
}

@Injectable()
export class PicklistsService {
  constructor(private readonly settings: SettingsService, private readonly access: ManpowerAccess) {}

  async get(): Promise<Picklists> {
    return parsePicklists(await this.settings.get(PICKLISTS_KEY).catch(() => null));
  }

  async save(body: unknown, bearer?: string): Promise<Picklists> {
    await this.access.require(await this.access.actor(bearer), HR_MODULE, 'change the Manpower picklists');
    const clean = parsePicklists(body);
    await this.settings.set(PICKLISTS_KEY, JSON.stringify(clean));
    return clean;
  }
}

@Tiers('internal')
@Controller('manpower/picklists')
export class PicklistsController {
  constructor(private readonly picklists: PicklistsService) {}

  /** Departments, designations and skills for the employee form. */
  @Get() get() { return this.picklists.get(); }

  /** Manpower -> Setup -> Picklists. */
  @Put() save(@Body() body: Picklists, @Headers('authorization') a?: string) { return this.picklists.save(body, a); }
}
