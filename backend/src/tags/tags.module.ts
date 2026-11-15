import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity, ProjectTaskEntity, TagEntity, TaskEntity, UserEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TagEntity, TaskEntity, ProjectTaskEntity, UserEntity, ProjectEntity]), AuthModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
