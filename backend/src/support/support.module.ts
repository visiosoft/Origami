import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketEntity, FaqEntity, HelpDocumentEntity } from '../database/entities';
import { HelpDocumentsController } from './help-documents.controller';
import { TicketsController } from './tickets.controller';
import { FaqsController } from './faqs.controller';
import { TicketsService } from './tickets.service';
import { FaqsService } from './faqs.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity, FaqEntity, HelpDocumentEntity])],
  controllers: [TicketsController, FaqsController, HelpDocumentsController],
  providers: [TicketsService, FaqsService],
})
export class SupportModule {}
