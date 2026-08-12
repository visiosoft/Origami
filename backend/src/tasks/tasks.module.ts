import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskEntity } from '../database/entities';
import { DB_ENABLED } from '../database/db.config';

@Module({
  imports: DB_ENABLED ? [TypeOrmModule.forFeature([TaskEntity])] : [],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
