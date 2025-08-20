import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_tx_hstsAttributes {
  portfolioId: string;
  txId: string;
  address: string;
  type: string;
  amount?: number;
  tokenId?: number;
  datetime: Date;
  blockNumber: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_tx_hstsPk = 'portfolioId' | 'txId';
export type mm_tx_hstsId = mm_tx_hsts[mm_tx_hstsPk];
export type mm_tx_hstsOptionalAttributes =
  | 'amount'
  | 'tokenId'
  | 'createdAt'
  | 'updatedAt';
export type mm_tx_hstsCreationAttributes = Optional<
  mm_tx_hstsAttributes,
  mm_tx_hstsOptionalAttributes
>;

export class mm_tx_hsts
  extends Model<mm_tx_hstsAttributes, mm_tx_hstsCreationAttributes>
  implements mm_tx_hstsAttributes
{
  portfolioId!: string;
  txId!: string;
  address!: string;
  type!: string;
  amount?: number;
  tokenId?: number;
  datetime!: Date;
  blockNumber!: number;
  createdAt?: Date;
  updatedAt?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof mm_tx_hsts {
    return mm_tx_hsts.init(
      {
        portfolioId: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true,
        },
        txId: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true,
        },
        address: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        type: {
          type: DataTypes.STRING(1),
          allowNull: false,
          comment: "'D': Deposit, 'R': Withdraw Request, 'W': Withdraw",
        },
        amount: {
          type: DataTypes.DECIMAL(20, 5),
          allowNull: true,
        },
        tokenId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        datetime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        blockNumber: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'mm_tx_hsts',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'portfolioId' }, { name: 'txId' }],
          },
        ],
      },
    );
  }
}
