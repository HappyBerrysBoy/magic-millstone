import { BadRequestException, Injectable } from '@nestjs/common';
import { PortfolioRepository } from './portfolio.repository';

@Injectable()
export class PortfolioService {
  constructor(private readonly portfolioRepository: PortfolioRepository) {}

  async getVaultStatus(portfolioId: string): Promise<any> {
    try {
      const portfolio =
        await this.portfolioRepository.getPortfolioById(portfolioId);
      if (!portfolio) {
        throw new BadRequestException('Portfolio not found');
      }

      const allocations =
        await this.portfolioRepository.getPortfolioAllocationsByPortfolioId(
          portfolioId,
        );

      const tvlHsts =
        await this.portfolioRepository.getTvlHistoryByPortfolioId(portfolioId);
      const tvl =
        tvlHsts.length > 0
          ? tvlHsts.reduce((latest, curr) =>
              curr.dataValues.datetime > latest.dataValues.datetime
                ? curr
                : latest,
            ).dataValues.value
          : null;

      const tvlHistoryChart = tvlHsts.map((tvl) => {
        return {
          datetime: tvl.dataValues.datetime,
          value: tvl.dataValues.value,
        };
      });

      const apyHsts =
        await this.portfolioRepository.getApyHistoryByPortfolioId(portfolioId);
      const apy =
        apyHsts.length > 0
          ? apyHsts.reduce((latest, curr) =>
              curr.dataValues.datetime > latest.dataValues.datetime
                ? curr
                : latest,
            ).dataValues.value
          : null;

      const dailyApyChart = apyHsts.map((apy) => {
        return {
          datetime: apy.dataValues.datetime,
          value: apy.dataValues.value,
        };
      });

      const exchangeRateHsts =
        await this.portfolioRepository.getExchangeRateHistoryByPortfolioId(
          portfolio.dataValues.tokenAddress,
        );
      const pricePerShareChart = exchangeRateHsts.map((exchangeRate) => {
        return {
          datetime: exchangeRate.dataValues.datetime,
          value: exchangeRate.dataValues.rate,
        };
      });

      const composition = allocations.reduce((acc, allocation) => {
        const vaultName = allocation.dataValues.vaultContractName;
        const allocationAmount = allocation.dataValues.allocationAmount;
        acc[vaultName] = (acc[vaultName] || 0) + allocationAmount / tvl;
        return acc;
      }, {});

      return {
        tvl,
        apy,
        dailyApyChart,
        pricePerShareChart,
        tvlHistoryChart,
        composition,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to get vault status',
      );
    }
  }

  async getStats(portfolioId: string): Promise<any> {
    try {
      const portfolio =
        await this.portfolioRepository.getPortfolioById(portfolioId);
      if (!portfolio) {
        throw new BadRequestException('Portfolio not found');
      }

      const tvlHsts =
        await this.portfolioRepository.getTvlHistoryByPortfolioId(portfolioId);
      const tvl =
        tvlHsts.length > 0
          ? tvlHsts.reduce((latest, curr) =>
              curr.dataValues.datetime > latest.dataValues.datetime
                ? curr
                : latest,
            ).dataValues.value
          : null;

      const apyHsts =
        await this.portfolioRepository.getApyHistoryByPortfolioId(portfolioId);
      const apy =
        apyHsts.length > 0
          ? apyHsts.reduce((latest, curr) =>
              curr.dataValues.datetime > latest.dataValues.datetime
                ? curr
                : latest,
            ).dataValues.value
          : null;

      return {
        tvl,
        apy,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to get vault stats',
      );
    }
  }
}
