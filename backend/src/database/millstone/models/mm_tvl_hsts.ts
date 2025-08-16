import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_tvl_hstsAttributes {
  portfolio_name: string;
  datetime: Date;
  value?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_tvl_hstsPk = "portfolio_name" | "datetime";
export type mm_tvl_hstsId = mm_tvl_hsts[mm_tvl_hstsPk];
export type mm_tvl_hstsOptionalAttributes = "value" | "createdAt" | "updatedAt";
export type mm_tvl_hstsCreationAttributes = Optional<mm_tvl_hstsAttributes, mm_tvl_hstsOptionalAttributes>;

export class mm_tvl_hsts extends Model<mm_tvl_hstsAttributes, mm_tvl_hstsCreationAttributes> implements mm_tvl_hstsAttributes {
  portfolio_name!: string;
  datetime!: Date;
  value?: number;
  createdAt?: Date;
  updatedAt?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_tvl_hsts {
    return mm_tvl_hsts.init({
    portfolio_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true
    },
    datetime: {
      type: DataTypes.DATE,
      allowNull: false,
      primaryKey: true
    },
    value: {
      type: DataTypes.DECIMAL(20,3),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'mm_tvl_hsts',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "portfolio_name" },
          { name: "datetime" },
        ]
      },
    ]
  });
  }
}
