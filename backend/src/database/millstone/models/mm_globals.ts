import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface mm_globalsAttributes {
  name: string;
  value: object;
}

export type mm_globalsPk = 'name';
export type mm_globalsId = mm_globals[mm_globalsPk];
export type mm_globalsCreationAttributes = mm_globalsAttributes;

export class mm_globals
  extends Model<mm_globalsAttributes, mm_globalsCreationAttributes>
  implements mm_globalsAttributes
{
  name!: string;
  value!: object;

  static initModel(sequelize: Sequelize.Sequelize): typeof mm_globals {
    return mm_globals.init(
      {
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true,
        },
        value: {
          type: DataTypes.JSON,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'mm_globals',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'name' }],
          },
        ],
      },
    );
  }
}
