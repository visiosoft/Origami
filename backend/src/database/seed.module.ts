import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity, AppSettingEntity,
} from './entities';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity, AppSettingEntity])],
  providers: [SeedService],
})
export class SeedModule {}
