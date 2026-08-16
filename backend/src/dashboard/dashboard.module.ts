import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceEntity, InvoiceEntity, DealEntity, TaskEntity } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceEntity, InvoiceEntity, DealEntity, TaskEntity])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
