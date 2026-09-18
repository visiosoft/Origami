import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultantEntity } from '../database/entities';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConsultantEntity])],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
})
export class ConsultantsModule {}
