import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_usersAttributes {
  address: string;
}

export type mm_usersCreationAttributes = mm_usersAttributes;

export class mm_users extends Model<mm_usersAttributes, mm_usersCreationAttributes> implements mm_usersAttributes {
  address!: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_users {
    return mm_users.init({
    address: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "User address"
    }
  }, {
    sequelize,
    tableName: 'mm_users',
    timestamps: false
  });
  }
}
