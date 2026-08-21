import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRoomFileEntity, FileRoomFolderEntity, ProjectEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { FileRoomController } from './file-room.controller';
import { FileRoomService } from './file-room.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileRoomFileEntity, FileRoomFolderEntity, ProjectEntity]),
    GoogleModule,
    AuthModule,
  ],
  controllers: [FileRoomController],
  providers: [FileRoomService],
})
export class FileRoomModule {}
