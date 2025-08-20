import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { vaultABI } from '../abis/vault';
import { millstoneAIVaultAbi } from 'src/abis/millstoneAIVaultAbi';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private vaultContract: ethers.Contract;
  private providers: { [chainId: string]: ethers.JsonRpcProvider } = {};

  constructor() {
    this.initializeContract();
  }

  private initializeContract() {
    try {
      const rpcUrl =
        process.env.KAIA_RPC_URL || 'https://public-en.node.kaia.io';
      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      const vaultAddress = process.env.VAULT_ADDRESS;

      if (!privateKey) {
        throw new Error('ADMIN_PRIVATE_KEY environment variable is required');
      }
      if (!vaultAddress) {
        throw new Error('VAULT_ADDRESS environment variable is required');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      this.vaultContract = new ethers.Contract(
        vaultAddress,
        vaultABI,
        this.wallet,
      );

      const rpcUrls = JSON.parse(process.env.RPC_URLS!);
      Object.entries(rpcUrls).forEach(([chainId, rpcUrl]) => {
        const provider = new ethers.JsonRpcProvider(rpcUrl as string);
        this.providers[chainId] = provider;
      });

      this.logger.log('Scheduler service initialized successfully');
      this.logger.log(`Vault address: ${vaultAddress}`);
      this.logger.log(`Admin address: ${this.wallet.address}`);
    } catch (error) {
      this.logger.error('Failed to initialize scheduler service:', error);
      throw error;
    }
  }

  @Cron('0 0 * * *', {
    name: 'magicTimeMidnightUTC',
    timeZone: 'UTC',
  })
  async handleMagicTimeCron() {
    const bridgeAddress = process.env.BRIDGE_DESTINATION_ADDRESS;
    if (!bridgeAddress) {
      this.logger.error('BRIDGE_DESTINATION_ADDRESS is not set');
      return;
    }

    this.logger.log(
      '🪄 Starting Magic Time scheduled execution at midnight UTC',
    );
    this.logger.log(`Bridge destination: ${bridgeAddress}`);

    try {
      const millstoneAIVaultContract = new ethers.Contract(
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

      await this.vaultContract.setExchangeRate(currentExchangeRate);

      this.logger.log('🔍 Checking magicTime return values...');
      const staticResult =
        await this.vaultContract.magicTime.staticCall(bridgeAddress);
      const amountSent = staticResult[0];
      const amountNeeded = staticResult[1];

      this.logger.log(
        `Static call results: amountSent=${ethers.formatUnits(amountSent, 6)} USDT, amountNeeded=${ethers.formatUnits(amountNeeded, 6)} USDT`,
      );

      // Execute the actual transaction
      this.logger.log('🚀 Executing magicTime transaction...');
      const tx = await this.vaultContract.magicTime(bridgeAddress);
      this.logger.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      this.logger.log(
        `✅ Transaction confirmed in block: ${receipt.blockNumber}`,
      );

      const bridgeTransferEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.vaultContract.interface.parseLog(log);
          return parsed && parsed.name === 'BridgeTransfer';
        } catch {
          return false;
        }
      });

      if (bridgeTransferEvents.length > 0) {
        const parsed = this.vaultContract.interface.parseLog(
          bridgeTransferEvents[0],
        );
        if (parsed) {
          this.logger.log('🎉 Funds transferred successfully:');
          this.logger.log(`  Destination: ${parsed.args.destination}`);
          this.logger.log(
            `  Amount: ${ethers.formatUnits(parsed.args.amount, 6)} USDT`,
          );
        }
      } else {
        this.logger.warn(
          '⚠️ No funds transferred - we need to deposit more USDT to vault',
        );
        this.logger.warn(
          `💰 Amount needed: ${ethers.formatUnits(amountNeeded, 6)} USDT`,
        );

        // TODO: 부족한 만큼 Morpho 혹은 AAVE에 withdrawal 신청
      }
      this.logger.log('🪄 Magic Time execution completed');
    } catch (error) {
      this.logger.error('❌ Failed to execute Magic Time:', error);

      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      if (error.reason) {
        this.logger.error(`Error reason: ${error.reason}`);
      }
      if (error.transaction) {
        this.logger.error(
          `Failed transaction: ${JSON.stringify(error.transaction, null, 2)}`,
        );
      }
    }
  }

  async triggerMagicTimeManually() {
    this.logger.log('🧪 Manual Magic Time trigger initiated');

    const bridgeAddress = process.env.BRIDGE_DESTINATION_ADDRESS;
    if (!bridgeAddress) {
      throw new Error('BRIDGE_DESTINATION_ADDRESS is not set');
    }

    const startTime = Date.now();
    let result: any = {
      success: false,
      bridgeAddress,
      executionTime: 0,
      error: null,
      transactionHash: null,
      blockNumber: null,
      amountSent: '0',
      amountNeeded: '0',
      gasUsed: null,
      gasPrice: null,
    };

    try {
      // Get static call results first
      const staticResult =
        await this.vaultContract.magicTime.staticCall(bridgeAddress);
      const amountSent = staticResult[0];
      const amountNeeded = staticResult[1];

      result.amountSent = ethers.formatUnits(amountSent, 6);
      result.amountNeeded = ethers.formatUnits(amountNeeded, 6);

      // Execute the transaction
      const tx = await this.vaultContract.magicTime(bridgeAddress);
      result.transactionHash = tx.hash;

      const receipt = await tx.wait();
      result.blockNumber = receipt.blockNumber;
      result.gasUsed = receipt.gasUsed.toString();
      result.gasPrice = tx.gasPrice
        ? ethers.formatUnits(tx.gasPrice, 'gwei')
        : null;

      // Check for BridgeTransfer events
      const bridgeTransferEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.vaultContract.interface.parseLog(log);
          return parsed && parsed.name === 'BridgeTransfer';
        } catch {
          return false;
        }
      });

      if (bridgeTransferEvents.length > 0) {
        const parsed = this.vaultContract.interface.parseLog(
          bridgeTransferEvents[0],
        );
        if (parsed) {
          result.bridgeTransferEvent = {
            destination: parsed.args.destination,
            amount: ethers.formatUnits(parsed.args.amount, 6),
            timestamp: parsed.args.timestamp.toString(),
          };
        }
      }

      result.success = true;
      result.executionTime = Date.now() - startTime;

      return result;
    } catch (error) {
      result.error = {
        message: error.message,
        code: error.code,
        reason: error.reason,
      };
      result.executionTime = Date.now() - startTime;

      this.logger.error('❌ Manual Magic Time execution failed:', error);
      return result;
    }
  }

  // Check scheduler status
  getSchedulerStatus() {
    return {
      isInitialized: !!this.vaultContract,
      walletAddress: this.wallet?.address,
      vaultAddress: process.env.VAULT_ADDRESS,
      bridgeAddress: process.env.BRIDGE_DESTINATION_ADDRESS,
      nextMidnightUTC: this.getNextMidnightUTC(),
    };
  }

  private getNextMidnightUTC(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
}
