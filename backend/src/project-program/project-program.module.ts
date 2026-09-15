import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity, ProjectProgramVersionEntity } from '../database/entities';
import { ProjectProgramService } from './project-program.service';
import { ProjectProgramController } from './project-program.controller';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { PeopleModule } from '../people/people.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity, ProjectProgramVersionEntity]), GoogleModule, SettingsModule, PeopleModule],
  controllers: [ProjectProgramController],
  providers: [ProjectProgramService],
  exports: [ProjectProgramService],
})
export class ProjectProgramModule {}
