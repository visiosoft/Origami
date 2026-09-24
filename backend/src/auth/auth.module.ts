import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity, RoleEntity, GuestAccessEntity, EmployeeEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { GoogleController } from '../google/google.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RoleEntity, GuestAccessEntity, EmployeeEntity]), GoogleModule],
  controllers: [AuthController, GoogleController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
