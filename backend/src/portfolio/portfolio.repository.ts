import {
  millstoneModels,
  mm_apy_hsts,
  mm_exchange_rate_hsts,
  mm_portfolio_allocations,
  mm_portfolios,
  mm_tvl_hsts,
} from '@database/millstone/models/init-models';
import { Inject, Injectable } from '@nestjs/common';
import { Sequelize, Transaction } from 'sequelize';

@Injectable()
export class PortfolioRepository {
  constructor(
    @Inject('DB_MILLSTONE')
    private readonly dbMillstone: {
      sequelize: Sequelize;
      models: millstoneModels;
    },
  ) {}

  async createTransaction(): Promise<Transaction> {
    return await this.dbMillstone.sequelize.transaction();
  }

  async getPortfolioById(
    portfolioId: string,
    transaction?: Transaction,
  ): Promise<mm_portfolios> {
    return await this.dbMillstone.models.mm_portfolios.findOne({
      where: { portfolioId },
      transaction,
    });
  }

  async getPortfolioAllocationsByPortfolioId(
    portfolioId: string,
    transaction?: Transaction,
  ): Promise<mm_portfolio_allocations[]> {
    return await this.dbMillstone.models.mm_portfolio_allocations.findAll({
      where: { portfolioId },
      transaction,
    });
  }

  async getApyHistoryByPortfolioId(
    portfolioId: string,
    transaction?: Transaction,
  ): Promise<mm_apy_hsts[]> {
    return await this.dbMillstone.models.mm_apy_hsts.findAll({
      where: { portfolioId },
      transaction,
    });
  }

  async getExchangeRateHistoryByPortfolioId(
    tokenAddress: string,
    transaction?: Transaction,
  ): Promise<mm_exchange_rate_hsts[]> {
    return await this.dbMillstone.models.mm_exchange_rate_hsts.findAll({
      where: { tokenAddress },
      transaction,
    });
  }

  async getTvlHistoryByPortfolioId(
    portfolioId: string,
    transaction?: Transaction,
  ): Promise<mm_tvl_hsts[]> {
    return await this.dbMillstone.models.mm_tvl_hsts.findAll({
      where: { portfolioId },
      transaction,
    });
  }

  async createExchangeRateHistory(
    tokenAddress: string,
    datetime: Date,
    rate: number,
    transaction: Transaction,
  ): Promise<mm_exchange_rate_hsts> {
    return await this.dbMillstone.models.mm_exchange_rate_hsts.create(
      {
        tokenAddress,
        datetime,
        rate,
      },
      { transaction },
    );
  }

  async createTvlHistory(
    portfolioId: string,
    datetime: Date,
    value: number,
    transaction: Transaction,
  ): Promise<mm_tvl_hsts> {
    return await this.dbMillstone.models.mm_tvl_hsts.create(
      {
        portfolioId,
        datetime,
        value,
      },
      { transaction },
    );
  }

  async createApyHistory(
    portfolioId: string,
    datetime: Date,
    value: number,
    transaction: Transaction,
  ): Promise<mm_apy_hsts> {
    return await this.dbMillstone.models.mm_apy_hsts.create(
      {
        portfolioId,
        datetime,
        value,
      },
      { transaction },
    );
  }

  async updatePortfolioAllocationAmount(
    portfolioId: string,
    platform: string,
    newAmount: number,
    transaction: Transaction,
  ): Promise<void> {
    await this.dbMillstone.models.mm_portfolio_allocations.update(
      { allocationAmount: newAmount },
      {
        where: { portfolioId, platform },
        transaction,
      },
    );
  }
}
