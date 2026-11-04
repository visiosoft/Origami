import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Res, UploadedFiles, UseInterceptors, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { PeopleService } from './people.service';
import { ContactActivityService } from './contact-activity.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { CreatePersonDto } from './dto/create-person.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES } from '../google/attachments.service';
import { Perm, ManageWrites } from '../auth/guards/perm.guard';
import { ProjectAccessService } from '../auth/project-access.service';

const INTERNAL_KINDS = /^(staff|executive|super|foreman|labou?r|internal)$/i;

@Tiers('internal')
@Perm('people')
@ManageWrites('people')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
    private readonly activity: ContactActivityService,
    private readonly access: ProjectAccessService,
  ) {}

  // The list also feeds a project's People tab and pickers: project staff get the people on their projects (the service narrows it).
  @Perm('people', 'projects', 'tasks')
  @Get()
  async findAll(@Query('project') project?: string, @Claims() claims?: SessionClaims | null) {
    const all = await this.peopleService.findAll(project);
    // The whole directory for People; otherwise (and on "Assigned projects") the people on the caller's projects, and themselves.
    const names = await this.access.allowedNames(claims ?? null);
    const wholeDirectory = names === 'all' && (await this.access.canView(claims ?? null, 'people'));
    if (wholeDirectory) return all;
    // Our own team stays visible to staff; outside contacts (clients, subs, consultants, authorities, vendors)
    // only when they're on one of the caller's projects (Nov 3 sync: George saw the whole address book).
    const onMine = (p: any) => (p.projects || []).some((n: string) => names !== 'all' && names.has(n));
    const staffView = this.access.isStaff(claims ?? null);
    return all.filter((p: any) => p.userId === claims?.sub || onMine(p) || (staffView && INTERNAL_KINDS.test(String(p.kind || ''))));
  }

  /**
   * Scan a business card: the photos (front, and back if there is one) are
   * kept in Drive, their text read, and the fields filled in for review. The
   * returned `cardToken` puts the photos on the contact when it is saved.
   */
  @Post('business-card/scan')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }], { limits: { fileSize: MAX_FILE_BYTES } }))
  async scanCard(@UploadedFiles() files: { front?: any[]; back?: any[] }, @Headers('authorization') auth?: string) {
    const front = files?.front?.[0];
    const back = files?.back?.[0];
    if (!front && !back) throw new BadRequestException('Add a photo of the card.');
    for (const f of [front, back]) if (f && !/^image\//.test(f.mimetype || '')) throw new BadRequestException('The card must be a photo (JPG, PNG or HEIC).');
    return this.peopleService.scanCard({ front, back }, await this.auth.requireActor(auth));
  }

  /** Add or replace the card photos on a saved contact (no reading). */
  @Post(':id/business-card')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }], { limits: { fileSize: MAX_FILE_BYTES } }))
  async addCard(@Param('id') id: string, @UploadedFiles() files: { front?: any[]; back?: any[] }, @Headers('authorization') auth?: string) {
    return this.peopleService.addCardPhotos(id, { front: files?.front?.[0], back: files?.back?.[0] }, await this.auth.requireActor(auth));
  }

  @Delete(':id/business-card/:side')
  removeCard(@Param('id') id: string, @Param('side') side: string) {
    if (side !== 'front' && side !== 'back') throw new NotFoundException();
    return this.peopleService.removeCardPhoto(id, side);
  }

  @Get(':id/business-card/:side/content')
  async cardContent(@Param('id') id: string, @Param('side') side: string, @Query('thumb') thumb: string, @Res() res: Response) {
    if (side !== 'front' && side !== 'back') throw new NotFoundException();
    const att = await this.peopleService.cardPhoto(id, side);
    const file = await this.attachments.download(att, thumb === '1');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }

  /** Possible duplicates of a contact being added: ?name / firstName / lastName / email / phone, and exclude=<id>. */
  @Get('duplicates')
  duplicates(@Query() q: Record<string, string>) {
    return this.peopleService.duplicates(q);
  }

  /** Activity: logged interactions, RFPs and estimates, the company's point of contact, and alerts. */
  @Get(':id/activity')
  activityOf(@Param('id') id: string) {
    return this.activity.activity(id);
  }

  @Post(':id/interactions')
  logInteraction(@Param('id') id: string, @Body() body: { kind?: string; at?: string; note?: string }, @Claims() claims: SessionClaims | null) {
    return this.activity.log(id, body, claims ? { id: claims.sub, name: claims.name } : null);
  }

  @Delete(':id/interactions/:interactionId')
  removeInteraction(@Param('id') id: string, @Param('interactionId') interactionId: string) {
    return this.activity.removeInteraction(id, interactionId);
  }

  /** Which phases they work on for one project: { project, phases: ['design', 'construction'] }. */
  @Put(':id/project-phases')
  projectPhases(@Param('id') id: string, @Body() body: { project?: string; phases?: string[] }) {
    return this.peopleService.setProjectPhases(id, String(body?.project || ''), body?.phases);
  }

  /** Point of contact for their company (one per company). */
  @Put(':id/point-of-contact')
  pointOfContact(@Param('id') id: string, @Body() body: { on?: boolean }) {
    return this.activity.setPointOfContact(id, body?.on !== false);
  }

  /** "Same person": link two records (both ways), or unlink them. */
  @Post(':id/same-as/:otherId')
  link(@Param('id') id: string, @Param('otherId') otherId: string) {
    return this.peopleService.link(id, otherId);
  }

  @Delete(':id/same-as/:otherId')
  unlink(@Param('id') id: string, @Param('otherId') otherId: string) {
    return this.peopleService.unlink(id, otherId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.peopleService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.peopleService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePersonDto>) {
    return this.peopleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.peopleService.remove(id);
  }
}
