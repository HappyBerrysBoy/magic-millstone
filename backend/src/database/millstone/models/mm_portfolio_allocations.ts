import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_portfolio_allocationsAttributes {
  name: string;
  platform: string;
  vaultContractName: string;
  vaultContractAddress: string;
  vaultTokenAddress: string;
  allocationAmount?: number;
  targetRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type mm_portfolio_allocationsPk = "name" | "platform";
export type mm_portfolio_allocationsId = mm_portfolio_allocations[mm_portfolio_allocationsPk];
export type mm_portfolio_allocationsOptionalAttributes = "allocationAmount" | "targetRate" | "createdAt" | "updatedAt";
export type mm_portfolio_allocationsCreationAttributes = Optional<mm_portfolio_allocationsAttributes, mm_portfolio_allocationsOptionalAttributes>;

export class mm_portfolio_allocations extends Model<mm_portfolio_allocationsAttributes, mm_portfolio_allocationsCreationAttributes> implements mm_portfolio_allocationsAttributes {
  name!: string;
  platform!: string;
  vaultContractName!: string;
  vaultContractAddress!: string;
  vaultTokenAddress!: string;
  allocationAmount?: number;
  targetRate?: number;
  createdAt?: Date;
  updatedAt?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof mm_portfolio_allocations {
    return mm_portfolio_allocations.init({
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true
    },
    platform: {
      type: DataTypes.STRING(100),
      allowNull: false,
      primaryKey: true
    },
    vaultContractName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    vaultContractAddress: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    vaultTokenAddress: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    allocationAmount: {
      type: DataTypes.DECIMAL(20,5),
      allowNull: true
    },
    targetRate: {
      type: DataTypes.DECIMAL(5,3),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'mm_portfolio_allocations',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "name" },
          { name: "platform" },
        ]
      },
    ]
  });
  }
}
