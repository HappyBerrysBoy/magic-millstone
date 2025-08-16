import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_portfoliosAttributes {
  name: string;
  tokenAddress: string;
  chainId: number;
}

export type mm_portfoliosPk = "name";
export type mm_portfoliosId = mm_portfolios[mm_portfoliosPk];
export type mm_portfoliosCreationAttributes = mm_portfoliosAttributes;

export class mm_portfolios extends Model<mm_portfoliosAttributes, mm_portfoliosCreationAttributes> implements mm_portfoliosAttributes {
  name!: string;
  tokenAddress!: string;
  chainId!: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_portfolios {
    return mm_portfolios.init({
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true
    },
    tokenAddress: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    chainId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'mm_portfolios',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "name" },
        ]
      },
    ]
  });
  }
}
