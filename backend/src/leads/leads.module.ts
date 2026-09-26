import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadEntity, LeadFilesEntity, ProjectEntity, UserEntity } from '../database/entities';
import { ClientWelcomeService } from './client-welcome.service';
import { ClientUploadController } from './client-upload.controller';
import { TasksModule } from '../tasks/tasks.module';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { LeadFilesService } from './lead-files.service';
import { LeadFilesController } from './lead-files.controller';

@Module({
    imports: [TypeOrmModule.forFeature([LeadEntity, ProjectEntity, LeadFilesEntity, UserEntity]), TasksModule, GoogleModule, AuthModule],
    controllers: [LeadsController, LeadFilesController, ClientUploadController],
    providers: [LeadsService, LeadFilesService, ClientWelcomeService],
    exports: [LeadsService],
})
export class LeadsModule { }
