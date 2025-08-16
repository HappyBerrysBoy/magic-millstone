import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmPortfolioAllocationsDto {
  @IsString()
  name: string;
  @IsString()
  platform: string;
  @IsString()
  vaultContractName: string;
  @IsString()
  vaultContractAddress: string;
  @IsString()
  vaultTokenAddress: string;
}
