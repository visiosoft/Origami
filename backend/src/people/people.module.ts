import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { ContractorEntity, EmployeeEntity, FileRoomShareEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import { ContactStatusService } from './contact-status.service';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PeopleImportController } from './people-import.controller';
import { StaffDirectorySync } from '../manpower/staff-directory.sync';
import { ContractorDirectorySync } from '../manpower/contractor-directory.sync';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity, EmployeeEntity, ContractorEntity, ProjectEntity, TaskEntity, ProjectTaskEntity, FileRoomShareEntity]), GoogleModule, AuthModule, SettingsModule],
  controllers: [PeopleImportController, PeopleController],
  providers: [PeopleService, StaffDirectorySync, ContractorDirectorySync, ContactStatusService],
  exports: [PeopleService, StaffDirectorySync, ContractorDirectorySync],
})
export class PeopleModule {}
