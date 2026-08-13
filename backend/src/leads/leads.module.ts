import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadEntity } from '../database/entities';

@Module({
    imports: [TypeOrmModule.forFeature([LeadEntity])],
    controllers: [LeadsController],
    providers: [LeadsService],
    exports: [LeadsService],
})
export class LeadsModule { }
