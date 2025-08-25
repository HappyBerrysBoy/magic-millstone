import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmPortfolioAllocationsDto {
  @IsString()
  portfolioId: string;
  @IsString()
  platform: string;
  @IsNumber()
  vaultChainId: number;
  @IsString()
  vaultContractName: string;
  @IsString()
  vaultContractAddress: string;
  @IsString()
  vaultTokenAddress: string;
}
