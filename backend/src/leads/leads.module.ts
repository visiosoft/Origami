import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadEntity } from '../database/entities';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TypeOrmModule.forFeature([LeadEntity]), TasksModule],
    controllers: [LeadsController],
    providers: [LeadsService],
    exports: [LeadsService],
})
export class LeadsModule { }
