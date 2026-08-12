import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PersonEntity } from '../database/entities';
import { DB_ENABLED } from '../database/db.config';

@Module({
  imports: DB_ENABLED ? [TypeOrmModule.forFeature([PersonEntity])] : [],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
