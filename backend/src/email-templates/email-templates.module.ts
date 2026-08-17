import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplateEntity } from '../database/entities';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplateEntity])],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
