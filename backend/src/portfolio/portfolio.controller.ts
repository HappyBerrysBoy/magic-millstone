import { Controller, Get, Param } from '@nestjs/common';
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
}
