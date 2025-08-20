import { BadRequestException, Injectable } from '@nestjs/common';
import { PortfolioRepository } from './portfolio.repository';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Contract, JsonRpcProvider } from 'ethers';
import { millstoneAIVaultAbi } from 'src/abis/millstoneAIVaultAbi';

@Injectable()
export class PortfolioService {
  private providers: { [chainId: string]: JsonRpcProvider } = {};

  constructor(private readonly portfolioRepository: PortfolioRepository) {
    const rpcUrls = JSON.parse(process.env.RPC_URLS!);

    Object.entries(rpcUrls).forEach(([chainId, rpcUrl]) => {
      const provider = new JsonRpcProvider(rpcUrl as string);
      this.providers[chainId] = provider;
    });
  }

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

  @Cron(CronExpression.EVERY_HOUR)
  async createPortfolioStatus() {
    const transaction = await this.portfolioRepository.createTransaction();
    try {
      const portfolioId = 'magic-millstone-usdt';
      const portfolio =
        await this.portfolioRepository.getPortfolioById(portfolioId);
      if (!portfolio) {
        throw new BadRequestException('Portfolio not found');
      }

      const datetime = new Date();
      const millstoneAIVaultContract = new Contract(
        process.env.MILLSTONE_AI_VAULT_ADDRESS!,
        millstoneAIVaultAbi,
        this.providers['1'],
      );

      const [
        currentExchangeRate,
        totalSupply,
        totalCurrentValue,
        underlyingDepositedAmount,
        accumulatedFeeAmount,
      ] = await millstoneAIVaultContract.getStakedTokenInfo(
        process.env.USDT_ADDRESS!,
      );

      const exchangeRateHsts =
        await this.portfolioRepository.getExchangeRateHistoryByPortfolioId(
          portfolio.dataValues.tokenAddress,
        );
      const exchangeRate =
        exchangeRateHsts.length > 0
          ? exchangeRateHsts.reduce((latest, curr) =>
              curr.dataValues.datetime > latest.dataValues.datetime
                ? curr
                : latest,
            )
          : null;

      const timeDiffMs =
        datetime.getTime() - exchangeRate.dataValues.datetime.getTime();
      const timeDiffYears = timeDiffMs / (1000 * 60 * 60 * 24 * 365.25);
      const apy =
        timeDiffYears > 0
          ? (currentExchangeRate - exchangeRate.dataValues.rate) /
            exchangeRate.dataValues.rate /
            timeDiffYears
          : 0;

      await this.portfolioRepository.createApyHistory(
        portfolioId,
        datetime,
        apy,
        transaction,
      );

      await this.portfolioRepository.createExchangeRateHistory(
        portfolio.dataValues.tokenAddress,
        datetime,
        currentExchangeRate,
        transaction,
      );

      await this.portfolioRepository.createTvlHistory(
        portfolioId,
        datetime,
        totalCurrentValue - accumulatedFeeAmount,
        transaction,
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new BadRequestException(
        error.message || 'Failed to set portfolio status',
      );
    }
  }
}
