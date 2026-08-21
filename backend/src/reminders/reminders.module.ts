import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity]),
    GoogleModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
