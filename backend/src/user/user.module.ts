import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { MillstoneModule } from '@database/millstone/millstone.module';

@Module({
  imports: [MillstoneModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class UserModule {}
