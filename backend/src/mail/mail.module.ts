import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLinkEntity, LeadEntity, MailTemplateEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, TaskEntity, UserEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

/** Each person's own Gmail in the app (Nov 13 sync). */
@Module({
  imports: [TypeOrmModule.forFeature([EmailLinkEntity, LeadEntity, MailTemplateEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, TaskEntity, UserEntity]), GoogleModule],
  controllers: [MailController],
  providers: [MailService],
})
export class MailModule {}
