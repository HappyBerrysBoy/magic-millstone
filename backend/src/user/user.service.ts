import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { mm_users } from '@database/millstone/models/mm_users';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createOrGetUser(address: string): Promise<mm_users> {
    const transaction = await this.userRepository.createTransaction();
    try {
      let user = await this.userRepository.getUserByAddress(address);
      if (!user) {
        user = await this.userRepository.createUser(address, transaction);
      }
      await transaction.commit();
      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
