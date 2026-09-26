import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { ContractorEntity, EmployeeEntity, PersonEntity, ProjectEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { PeopleImportController } from './people-import.controller';
import { StaffDirectorySync } from '../manpower/staff-directory.sync';
import { ContractorDirectorySync } from '../manpower/contractor-directory.sync';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity, EmployeeEntity, ContractorEntity, ProjectEntity]), GoogleModule],
  controllers: [PeopleImportController, PeopleController],
  providers: [PeopleService, StaffDirectorySync, ContractorDirectorySync],
  exports: [PeopleService, StaffDirectorySync, ContractorDirectorySync],
})
export class PeopleModule {}
