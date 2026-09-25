import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadEntity, LeadFilesEntity, ProjectEntity } from '../database/entities';
import { TasksModule } from '../tasks/tasks.module';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { LeadFilesService } from './lead-files.service';
import { LeadFilesController } from './lead-files.controller';

@Module({
    imports: [TypeOrmModule.forFeature([LeadEntity, ProjectEntity, LeadFilesEntity]), TasksModule, GoogleModule, AuthModule],
    controllers: [LeadsController, LeadFilesController],
    providers: [LeadsService, LeadFilesService],
    exports: [LeadsService],
})
export class LeadsModule { }
