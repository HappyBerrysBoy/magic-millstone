import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get scheduler status and configuration' })
  @ApiResponse({ status: 200, description: 'Scheduler status information' })
  getStatus() {
    return this.schedulerService.getSchedulerStatus();
  }

  @Post('trigger-magic-time')
  @ApiOperation({
    summary: 'Manually trigger Magic Time execution (for testing)',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic Time execution result with detailed information',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        bridgeAddress: { type: 'string' },
        executionTime: {
          type: 'number',
          description: 'Execution time in milliseconds',
        },
        transactionHash: { type: 'string', nullable: true },
        blockNumber: { type: 'number', nullable: true },
        amountSent: { type: 'string', description: 'Amount sent in USDT' },
        amountNeeded: { type: 'string', description: 'Amount needed in USDT' },
        gasUsed: { type: 'string', nullable: true },
        gasPrice: {
          type: 'string',
          nullable: true,
          description: 'Gas price in Gwei',
        },
        bridgeTransferEvent: {
          type: 'object',
          nullable: true,
          properties: {
            destination: { type: 'string' },
            amount: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        error: {
          type: 'object',
          nullable: true,
          properties: {
            message: { type: 'string' },
            code: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  })
  async triggerMagicTime() {
    const result = await this.schedulerService.triggerMagicTimeManually();
    return result;
  }

  @Post('deposit-to-vault')
  @ApiOperation({
    summary: 'Manually deposit USDT to vault contract',
    description:
      'Amount should be in raw USDT units (6 decimals). Example: "1000000" = 1 USDT',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'string',
          example: '1000000',
        },
      },
      required: ['amount'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Vault deposit execution result with detailed information',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        amount: {
          type: 'string',
          description: 'Amount deposited in raw units',
        },
        executionTime: {
          type: 'number',
          description: 'Execution time in milliseconds',
        },
        transactionHash: { type: 'string', nullable: true },
        blockNumber: { type: 'number', nullable: true },
        gasUsed: { type: 'string', nullable: true },
        gasPrice: {
          type: 'string',
          nullable: true,
          description: 'Gas price in Gwei',
        },
        vaultDepositEvent: {
          type: 'object',
          nullable: true,
          properties: {
            depositor: { type: 'string' },
            amount: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        error: {
          type: 'object',
          nullable: true,
          properties: {
            message: { type: 'string' },
            code: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  })
  async depositToVault(@Body() body: { amount: string }) {
    const result = await this.schedulerService.depositToVault(
      BigInt(body.amount),
    );
    return result;
  }
}
