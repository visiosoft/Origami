import { Body, Controller, Get, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/guards/public.decorator';
import { MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { ClientWelcomeService } from './client-welcome.service';

/**
 * The client's upload page (no account): opened from the welcome email's
 * private link. Everything is keyed by that link's token.
 */
@Controller('client-upload')
export class ClientUploadController {
  constructor(private readonly welcome: ClientWelcomeService) {}

  @Public()
  @Get()
  view(@Query('token') token: string) {
    return this.welcome.publicView(token);
  }

  @Public()
  @Post('files')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(@Query('token') token: string, @UploadedFiles() files: any[], @Body() body: { item?: string }) {
    return this.welcome.publicUpload(token, files, body?.item);
  }
}
