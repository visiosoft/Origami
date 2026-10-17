import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserViewEntity } from '../database/entities';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserViewEntity])],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
