import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity, FinanceActivityEntity, ProjectEntity } from '../database/entities';
import { AuditController } from './audit.controller';
import { ProjectAuditController } from './project-audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity, FinanceActivityEntity, ProjectEntity])],
  controllers: [AuditController, ProjectAuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
