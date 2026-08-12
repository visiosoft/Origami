import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectEntity } from '../database/entities';
import { DB_ENABLED } from '../database/db.config';

@Module({
  imports: DB_ENABLED ? [TypeOrmModule.forFeature([ProjectEntity])] : [],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
