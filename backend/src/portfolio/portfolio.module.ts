import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { MillstoneModule } from '@database/millstone/millstone.module';
import { PortfolioRepository } from './portfolio.repository';

@Module({
  imports: [MillstoneModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioRepository],
})
export class PortfolioModule {}
