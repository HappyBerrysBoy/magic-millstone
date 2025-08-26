import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Contract, formatUnits, JsonRpcProvider, Wallet } from 'ethers';
import { vaultAbi } from '../abis/vaultAbi';
import { millstoneAIVaultAbi } from 'src/abis/millstoneAIVaultAbi';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private kaiaProvider: JsonRpcProvider;
  private kaiaWallet: Wallet;
  private kaiaVaultContract: Contract;
  private ethProvider: JsonRpcProvider;
  private ethWallet: Wallet;
  private ethVaultContract: Contract;

  constructor() {
    this.initializeContract();
  }

  private initializeContract() {
    try {
      const kaiaRpcUrl =
        process.env.KAIA_RPC_URL || 'https://public-en.node.kaia.io';
      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      const vaultAddress = process.env.VAULT_ADDRESS;

      if (!privateKey) {
        throw new Error('ADMIN_PRIVATE_KEY environment variable is required');
      }
      if (!vaultAddress) {
        throw new Error('VAULT_ADDRESS environment variable is required');
      }

      this.kaiaProvider = new JsonRpcProvider(kaiaRpcUrl);
      this.kaiaWallet = new Wallet(privateKey, this.kaiaProvider);

      this.kaiaVaultContract = new Contract(
        vaultAddress,
        vaultAbi,
        this.kaiaWallet,
      );

      const ethRpcUrl = process.env.ETH_RPC_URL || 'https://eth.drpc.org';
      this.ethProvider = new JsonRpcProvider(ethRpcUrl);
      this.ethWallet = new Wallet(privateKey, this.ethProvider);
      this.ethVaultContract = new Contract(
        process.env.MILLSTONE_AI_VAULT_ADDRESS!,
        millstoneAIVaultAbi,
        this.ethWallet,
      );

      this.logger.log('Scheduler service initialized successfully');
      this.logger.log(`Vault address: ${vaultAddress}`);
      this.logger.log(`Admin address: ${this.kaiaWallet.address}`);
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
      const [
        currentExchangeRate,
        totalSupply,
        totalCurrentValue,
        underlyingDepositedAmount,
        accumulatedFeeAmount,
      ] = await this.ethVaultContract.getStakedTokenInfo(
        process.env.USDT_ADDRESS!,
      );

      await this.kaiaVaultContract.setExchangeRate(currentExchangeRate);

      this.logger.log('🔍 Checking magicTime return values...');
      const staticResult =
        await this.kaiaVaultContract.magicTime.staticCall(bridgeAddress);
      const amountSent = staticResult[0];
      const amountNeeded = staticResult[1];

      this.logger.log(
        `Static call results: amountSent=${formatUnits(amountSent, 6)} USDT, amountNeeded=${formatUnits(amountNeeded, 6)} USDT`,
      );

      // Execute the actual transaction
      this.logger.log('🚀 Executing magicTime transaction...');
      const tx = await this.kaiaVaultContract.magicTime(bridgeAddress);
      this.logger.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      this.logger.log(
        `✅ Transaction confirmed in block: ${receipt.blockNumber}`,
      );

      const bridgeTransferEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.kaiaVaultContract.interface.parseLog(log);
          return parsed && parsed.name === 'BridgeTransfer';
        } catch {
          return false;
        }
      });

      if (bridgeTransferEvents.length > 0) {
        const parsed = this.kaiaVaultContract.interface.parseLog(
          bridgeTransferEvents[0],
        );
        if (parsed) {
          this.logger.log('🎉 Funds transferred successfully:');
          this.logger.log(`  Destination: ${parsed.args.destination}`);
          this.logger.log(
            `  Amount: ${formatUnits(parsed.args.amount, 6)} USDT`,
          );
        }
      } else {
        this.logger.warn(
          '⚠️ No funds transferred - we need to deposit more USDT to vault',
        );
        this.logger.warn(
          `💰 Amount needed: ${formatUnits(amountNeeded, 6)} USDT`,
        );

        await this.ethVaultContract.withdrawForUser(
          process.env.USDT_ADDRESS!,
          amountNeeded,
        );
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
    const result: any = {
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
      const [
        currentExchangeRate,
        totalSupply,
        totalCurrentValue,
        underlyingDepositedAmount,
        accumulatedFeeAmount,
      ] = await this.ethVaultContract.getStakedTokenInfo(
        process.env.USDT_ADDRESS!,
      );

      await this.kaiaVaultContract.setExchangeRate(currentExchangeRate);

      // Get static call results first
      const staticResult =
        await this.kaiaVaultContract.magicTime.staticCall(bridgeAddress);
      const amountSent = staticResult[0];
      const amountNeeded = staticResult[1];

      result.amountSent = formatUnits(amountSent, 6);
      result.amountNeeded = formatUnits(amountNeeded, 6);

      // Execute the transaction
      const tx = await this.kaiaVaultContract.magicTime(bridgeAddress);
      result.transactionHash = tx.hash;

      const receipt = await tx.wait();
      result.blockNumber = receipt.blockNumber;
      result.gasUsed = receipt.gasUsed.toString();
      result.gasPrice = tx.gasPrice ? formatUnits(tx.gasPrice, 'gwei') : null;

      // Check for BridgeTransfer events
      const bridgeTransferEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.kaiaVaultContract.interface.parseLog(log);
          return parsed && parsed.name === 'BridgeTransfer';
        } catch {
          return false;
        }
      });

      if (bridgeTransferEvents.length > 0) {
        const parsed = this.kaiaVaultContract.interface.parseLog(
          bridgeTransferEvents[0],
        );
        if (parsed) {
          result.bridgeTransferEvent = {
            destination: parsed.args.destination,
            amount: formatUnits(parsed.args.amount, 6),
            timestamp: parsed.args.timestamp.toString(),
          };
        }
      } else {
        await this.ethVaultContract.withdrawForUser(
          process.env.USDT_ADDRESS!,
          amountNeeded,
        );
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

  async depositToVault(amount: bigint) {
    this.logger.log('💰 Deposit to vault initiated');
    this.logger.log(`Amount: ${amount.toString()} (raw)`);

    const startTime = Date.now();
    const result: any = {
      success: false,
      amount: amount.toString(),
      executionTime: 0,
      error: null,
      transactionHash: null,
      blockNumber: null,
      gasUsed: null,
      gasPrice: null,
      approvalHash: null,
    };

    try {
      // Get USDT contract
      const usdtAddress = process.env.KAIA_USDT_ADDRESS;
      if (!usdtAddress) {
        throw new Error('USDT_ADDRESS environment variable is required');
      }

      const usdtContract = new Contract(
        usdtAddress,
        [
          'function allowance(address,address) view returns (uint256)',
          'function approve(address,uint256) returns (bool)',
        ],
        this.kaiaWallet,
      );

      // Check current allowance
      const currentAllowance = await usdtContract.allowance(
        this.kaiaWallet.address,
        process.env.VAULT_ADDRESS,
      );

      this.logger.log(
        `Current USDT allowance: ${formatUnits(currentAllowance, 6)} USDT`,
      );
      this.logger.log(`Required amount: ${formatUnits(amount, 6)} USDT`);

      // If allowance is insufficient, approve the vault contract
      if (currentAllowance < amount) {
        this.logger.log('🔐 Approving USDT spend...');
        const approveTx = await usdtContract.approve(
          process.env.VAULT_ADDRESS,
          amount,
        );
        result.approvalHash = approveTx.hash;
        this.logger.log(`Approval transaction sent: ${approveTx.hash}`);

        await approveTx.wait();
        this.logger.log('✅ USDT approval confirmed');
      } else {
        this.logger.log('✅ Sufficient allowance already exists');
      }

      // Now execute the deposit
      const tx = await this.kaiaVaultContract.depositToVault(amount);
      result.transactionHash = tx.hash;

      this.logger.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      result.blockNumber = receipt.blockNumber;
      result.gasUsed = receipt.gasUsed.toString();
      result.gasPrice = tx.gasPrice ? formatUnits(tx.gasPrice, 'gwei') : null;

      this.logger.log(
        `✅ Deposit transaction confirmed in block: ${receipt.blockNumber}`,
      );

      const vaultDepositEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.kaiaVaultContract.interface.parseLog(log);
          return parsed && parsed.name === 'VaultDeposit';
        } catch {
          return false;
        }
      });

      if (vaultDepositEvents.length > 0) {
        const parsed = this.kaiaVaultContract.interface.parseLog(
          vaultDepositEvents[0],
        );
        if (parsed) {
          result.vaultDepositEvent = {
            depositor: parsed.args.depositor,
            amount: formatUnits(parsed.args.amount, 6),
            timestamp: parsed.args.timestamp.toString(),
          };
          this.logger.log('🎉 Vault deposit successful:');
          this.logger.log(`  Depositor: ${parsed.args.depositor}`);
          this.logger.log(
            `  Amount: ${formatUnits(parsed.args.amount, 6)} USDT`,
          );
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

      this.logger.error('❌ Deposit to vault failed:', error);
      return result;
    }
  }

  // Check scheduler status
  getSchedulerStatus() {
    return {
      isInitialized: !!this.kaiaVaultContract,
      kaiaWalletAddress: this.kaiaWallet?.address,
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
