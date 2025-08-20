import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_apy_hstsAttributes {
  portfolioId: string;
  datetime: Date;
  value: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_apy_hstsPk = 'portfolioId' | 'datetime';
export type mm_apy_hstsId = mm_apy_hsts[mm_apy_hstsPk];
export type mm_apy_hstsOptionalAttributes = 'createdAt' | 'updatedAt';
export type mm_apy_hstsCreationAttributes = Optional<
  mm_apy_hstsAttributes,
  mm_apy_hstsOptionalAttributes
>;

export class mm_apy_hsts
  extends Model<mm_apy_hstsAttributes, mm_apy_hstsCreationAttributes>
  implements mm_apy_hstsAttributes
{
  portfolioId!: string;
  datetime!: Date;
  value!: number;
  createdAt?: Date;
  updatedAt?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof mm_apy_hsts {
    return mm_apy_hsts.init(
      {
        portfolioId: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true,
        },
        datetime: {
          type: DataTypes.DATE,
          allowNull: false,
          primaryKey: true,
        },
        value: {
          type: DataTypes.DECIMAL(20, 6),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'mm_apy_hsts',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'portfolioId' }, { name: 'datetime' }],
          },
        ],
      },
    );
  }
}
