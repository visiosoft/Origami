import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestAccessEntity, UserEntity, ProjectEntity } from '../database/entities';
import { GuestAccessService } from './guest-access.service';
import { GuestAccessController } from './guest-access.controller';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PeopleModule } from '../people/people.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [TypeOrmModule.forFeature([GuestAccessEntity, UserEntity, ProjectEntity]), AuthModule, SettingsModule, PeopleModule, GoogleModule],
  controllers: [GuestAccessController],
  providers: [GuestAccessService],
  exports: [GuestAccessService],
})
export class GuestAccessModule {}
