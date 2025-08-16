import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_usersAttributes {
  address: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_usersPk = "address";
export type mm_usersId = mm_users[mm_usersPk];
export type mm_usersOptionalAttributes = "createdAt" | "updatedAt";
export type mm_usersCreationAttributes = Optional<mm_usersAttributes, mm_usersOptionalAttributes>;

export class mm_users extends Model<mm_usersAttributes, mm_usersCreationAttributes> implements mm_usersAttributes {
  address!: string;
  createdAt?: Date;
  updatedAt?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_users {
    return mm_users.init({
    address: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true,
      comment: "User address"
    }
  }, {
    sequelize,
    tableName: 'mm_users',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "address" },
        ]
      },
    ]
  });
  }
}
