import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Res, UploadedFiles, UseInterceptors, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES } from '../google/attachments.service';

@Tiers('internal')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  findAll(@Query('project') project?: string) {
    return this.peopleService.findAll(project);
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
