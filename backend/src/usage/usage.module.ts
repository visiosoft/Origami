import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsageEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

/** Global, so anything that calls a paid service (texts, AI) can count it without importing this. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiUsageEntity]), GoogleModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
