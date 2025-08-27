import {
  millstoneModels,
  mm_users,
} from '@database/millstone/models/init-models';
import { Inject, Injectable } from '@nestjs/common';
import { Sequelize, Transaction } from 'sequelize';

@Injectable()
export class UserRepository {
  constructor(
    @Inject('DB_MILLSTONE')
    private readonly dbMillstone: {
      sequelize: Sequelize;
      models: millstoneModels;
    },
  ) {}

  async createTransaction(): Promise<Transaction> {
    return await this.dbMillstone.sequelize.transaction();
  }

  async getUserByAddress(
    address: string,
    transaction?: Transaction,
  ): Promise<mm_users | null> {
    return await this.dbMillstone.models.mm_users.findOne({
      where: { address },
      transaction,
    });
  }

  async createUser(
    address: string,
    transaction: Transaction,
  ): Promise<mm_users> {
    return await this.dbMillstone.models.mm_users.create(
      { address },
      { transaction },
    );
  }
}
