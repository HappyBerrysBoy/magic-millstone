import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_portfoliosAttributes {
  portfolioId: string;
  name: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  vaultAddress: string;
  targetChainId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_portfoliosPk = 'portfolioId';
export type mm_portfoliosId = mm_portfolios[mm_portfoliosPk];
export type mm_portfoliosOptionalAttributes = 'createdAt' | 'updatedAt';
export type mm_portfoliosCreationAttributes = Optional<
  mm_portfoliosAttributes,
  mm_portfoliosOptionalAttributes
>;

export class mm_portfolios
  extends Model<mm_portfoliosAttributes, mm_portfoliosCreationAttributes>
  implements mm_portfoliosAttributes
{
  portfolioId!: string;
  name!: string;
  chainId!: number;
  tokenAddress!: string;
  tokenSymbol!: string;
  vaultAddress!: string;
  targetChainId!: number;
  createdAt?: Date;
  updatedAt?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof mm_portfolios {
    return mm_portfolios.init(
      {
        portfolioId: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        chainId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        tokenAddress: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        tokenSymbol: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        vaultAddress: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        targetChainId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'mm_portfolios',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'portfolioId' }],
          },
        ],
      },
    );
  }
}
