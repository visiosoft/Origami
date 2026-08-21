import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity, RoleEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RoleEntity, ProjectTaskEntity, TaskEntity]), AuthModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService, RolesService],
})
export class UsersModule {}
