import { Controller, Get, Param, Post } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({ summary: 'Get portfolio vault status' })
  @Get(':id/status')
  async getVaultStatus(@Param('id') id: string) {
    return this.portfolioService.getVaultStatus(id);
  }

  @ApiOperation({ summary: 'Get portfolio stats' })
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.portfolioService.getStats(id);
  }

  @ApiOperation({
    summary: 'Manually trigger Magic Time execution (for testing)',
  })
  @Post('trigger-magic-time')
  async triggerMagicTime() {
    return this.portfolioService.createPortfolioStatusManually();
  }
}
