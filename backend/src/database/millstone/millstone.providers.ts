import { Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { initModels } from '@database/millstone/models/init-models';

export const MillstoneProviders = [
  {
    provide: 'DB_MILLSTONE',
    useFactory: async () => {
      const sequelize = new Sequelize({
        dialect: 'mysql',
        host: process.env.DB_MILLSTONE_HOST,
        port: parseInt(process.env.DB_MILLSTONE_PORT),
        username: process.env.DB_MILLSTONE_USERNAME,
        password: process.env.DB_MILLSTONE_PASSWORD,
        database: process.env.DB_MILLSTONE_NAME,
      });

      const models = initModels(sequelize);
      // await sequelize.sync();
      return { sequelize, models };
    },
  },
];
