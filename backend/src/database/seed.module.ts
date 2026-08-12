import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity,
} from './entities';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity])],
  providers: [SeedService],
})
export class SeedModule {}
