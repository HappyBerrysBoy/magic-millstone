import type { Sequelize } from "sequelize";
import { mm_exchange_rate_hsts as _mm_exchange_rate_hsts } from "./mm_exchange_rate_hsts";
import type { mm_exchange_rate_hstsAttributes, mm_exchange_rate_hstsCreationAttributes } from "./mm_exchange_rate_hsts";
import { mm_globals as _mm_globals } from "./mm_globals";
import type { mm_globalsAttributes, mm_globalsCreationAttributes } from "./mm_globals";
import { mm_portfolio_allocations as _mm_portfolio_allocations } from "./mm_portfolio_allocations";
import type { mm_portfolio_allocationsAttributes, mm_portfolio_allocationsCreationAttributes } from "./mm_portfolio_allocations";
import { mm_portfolios as _mm_portfolios } from "./mm_portfolios";
import type { mm_portfoliosAttributes, mm_portfoliosCreationAttributes } from "./mm_portfolios";
import { mm_tvl_hsts as _mm_tvl_hsts } from "./mm_tvl_hsts";
import type { mm_tvl_hstsAttributes, mm_tvl_hstsCreationAttributes } from "./mm_tvl_hsts";
import { mm_tx_hsts as _mm_tx_hsts } from "./mm_tx_hsts";
import type { mm_tx_hstsAttributes, mm_tx_hstsCreationAttributes } from "./mm_tx_hsts";
import { mm_users as _mm_users } from "./mm_users";
import type { mm_usersAttributes, mm_usersCreationAttributes } from "./mm_users";

export {
  _mm_exchange_rate_hsts as mm_exchange_rate_hsts,
  _mm_globals as mm_globals,
  _mm_portfolio_allocations as mm_portfolio_allocations,
  _mm_portfolios as mm_portfolios,
  _mm_tvl_hsts as mm_tvl_hsts,
  _mm_tx_hsts as mm_tx_hsts,
  _mm_users as mm_users,
};

export type {
  mm_exchange_rate_hstsAttributes,
  mm_exchange_rate_hstsCreationAttributes,
  mm_globalsAttributes,
  mm_globalsCreationAttributes,
  mm_portfolio_allocationsAttributes,
  mm_portfolio_allocationsCreationAttributes,
  mm_portfoliosAttributes,
  mm_portfoliosCreationAttributes,
  mm_tvl_hstsAttributes,
  mm_tvl_hstsCreationAttributes,
  mm_tx_hstsAttributes,
  mm_tx_hstsCreationAttributes,
  mm_usersAttributes,
  mm_usersCreationAttributes,
};

export function initModels(sequelize: Sequelize) {
  const mm_exchange_rate_hsts = _mm_exchange_rate_hsts.initModel(sequelize);
  const mm_globals = _mm_globals.initModel(sequelize);
  const mm_portfolio_allocations = _mm_portfolio_allocations.initModel(sequelize);
  const mm_portfolios = _mm_portfolios.initModel(sequelize);
  const mm_tvl_hsts = _mm_tvl_hsts.initModel(sequelize);
  const mm_tx_hsts = _mm_tx_hsts.initModel(sequelize);
  const mm_users = _mm_users.initModel(sequelize);


  return {
    mm_exchange_rate_hsts: mm_exchange_rate_hsts,
    mm_globals: mm_globals,
    mm_portfolio_allocations: mm_portfolio_allocations,
    mm_portfolios: mm_portfolios,
    mm_tvl_hsts: mm_tvl_hsts,
    mm_tx_hsts: mm_tx_hsts,
    mm_users: mm_users,
  };
}

export interface millstoneModels {
  
    mm_exchange_rate_hsts: typeof _mm_exchange_rate_hsts,
    mm_globals: typeof _mm_globals,
    mm_portfolio_allocations: typeof _mm_portfolio_allocations,
    mm_portfolios: typeof _mm_portfolios,
    mm_tvl_hsts: typeof _mm_tvl_hsts,
    mm_tx_hsts: typeof _mm_tx_hsts,
    mm_users: typeof _mm_users,
  
}
    