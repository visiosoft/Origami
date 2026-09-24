import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { ContractorEntity, EmployeeEntity, PersonEntity } from '../database/entities';
import { StaffDirectorySync } from '../manpower/staff-directory.sync';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity, EmployeeEntity, ContractorEntity])],
  controllers: [PeopleController],
  providers: [PeopleService, StaffDirectorySync],
  exports: [PeopleService, StaffDirectorySync],
})
export class PeopleModule {}
