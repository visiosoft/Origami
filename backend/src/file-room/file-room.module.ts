import { TrackingModule } from '../tracking/tracking.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRoomFileEntity, FileRoomFolderEntity, FileRoomShareEntity, PdfMarkupEntity, ProgressPhotoEntity, ProgressNoteEntity, ProjectEntity } from '../database/entities';
import { MarkupsService } from './markups.service';
import { ProgressPhotosController } from './progress-photos.controller';
import { ProgressPhotosService } from './progress-photos.service';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { FileRoomController } from './file-room.controller';
import { FileRoomService } from './file-room.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileRoomFileEntity, FileRoomFolderEntity, FileRoomShareEntity, PdfMarkupEntity, ProjectEntity, ProgressPhotoEntity, ProgressNoteEntity]),
    GoogleModule,
    AuthModule,
    TrackingModule,
  ],
  controllers: [FileRoomController, ProgressPhotosController],
  providers: [FileRoomService, ProgressPhotosService, MarkupsService],
  exports: [FileRoomService],
})
export class FileRoomModule {}
