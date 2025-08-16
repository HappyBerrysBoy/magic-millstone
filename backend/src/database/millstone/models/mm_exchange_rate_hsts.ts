import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_exchange_rate_hstsAttributes {
  tokenAddress: string;
  datetime: Date;
  rate?: string;
}

export type mm_exchange_rate_hstsPk = "tokenAddress" | "datetime";
export type mm_exchange_rate_hstsId = mm_exchange_rate_hsts[mm_exchange_rate_hstsPk];
export type mm_exchange_rate_hstsOptionalAttributes = "rate";
export type mm_exchange_rate_hstsCreationAttributes = Optional<mm_exchange_rate_hstsAttributes, mm_exchange_rate_hstsOptionalAttributes>;

export class mm_exchange_rate_hsts extends Model<mm_exchange_rate_hstsAttributes, mm_exchange_rate_hstsCreationAttributes> implements mm_exchange_rate_hstsAttributes {
  tokenAddress!: string;
  datetime!: Date;
  rate?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_exchange_rate_hsts {
    return mm_exchange_rate_hsts.init({
    tokenAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true
    },
    datetime: {
      type: DataTypes.DATE,
      allowNull: false,
      primaryKey: true
    },
    rate: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'mm_exchange_rate_hsts',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "tokenAddress" },
          { name: "datetime" },
        ]
      },
    ]
  });
  }
}
