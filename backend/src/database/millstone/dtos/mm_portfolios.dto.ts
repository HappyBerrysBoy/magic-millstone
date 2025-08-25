import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmPortfoliosDto {
  @IsString()
  portfolioId: string;
  @IsString()
  name: string;
  @IsNumber()
  chainId: number;
  @IsString()
  tokenAddress: string;
  @IsString()
  tokenSymbol: string;
  @IsString()
  vaultAddress: string;
  @IsNumber()
  targetChainId: number;
}
