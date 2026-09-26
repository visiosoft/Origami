import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { FileRoomFileEntity, LeadEntity, LeadFilesEntity, ProjectEntity, ProjectPhaseEntity, ProjectTaskEntity, RfiEntity, TaskEntity, UserEntity } from '../database/entities';
import { AllFilesService } from './all-files.service';
import { ClientWelcomeService } from './client-welcome.service';
import { ClientUploadController } from './client-upload.controller';
import { TasksModule } from '../tasks/tasks.module';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { LeadFilesService } from './lead-files.service';
import { LeadFilesController } from './lead-files.controller';

@Module({
    imports: [TypeOrmModule.forFeature([LeadEntity, ProjectEntity, LeadFilesEntity, UserEntity, TaskEntity, ProjectTaskEntity, ProjectPhaseEntity, RfiEntity, FileRoomFileEntity]), TasksModule, GoogleModule, AuthModule],
    controllers: [LeadsController, LeadFilesController, ClientUploadController],
    providers: [LeadsService, LeadFilesService, ClientWelcomeService, AllFilesService],
    exports: [LeadsService],
})
export class LeadsModule { }
