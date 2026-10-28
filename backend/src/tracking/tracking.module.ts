import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedLinkEntity } from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingService } from './tracking.service';
import { TrackedLinkController, TrackingController } from './tracking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TrackedLinkEntity]), NotificationsModule],
  controllers: [TrackedLinkController, TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
