import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketEntity, FaqEntity } from '../database/entities';
import { TicketsController } from './tickets.controller';
import { FaqsController } from './faqs.controller';
import { TicketsService } from './tickets.service';
import { FaqsService } from './faqs.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity, FaqEntity])],
  controllers: [TicketsController, FaqsController],
  providers: [TicketsService, FaqsService],
})
export class SupportModule {}
