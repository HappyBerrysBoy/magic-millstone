import { Inject, Injectable } from '@nestjs/common';
import { Sequelize, Op, Transaction } from 'sequelize';

import { millstoneModels } from '@database/millstone/models/init-models';
@Injectable()
export class AppService {
  constructor(
    @Inject('DB_MILLSTONE')
    private readonly dbMillstone: {
      sequelize: Sequelize;
      models: millstoneModels;
    },
  ) {}
}
