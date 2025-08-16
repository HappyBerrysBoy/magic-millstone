import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmPortfoliosDto {
  @IsString()
  name: string;
  @IsString()
  tokenAddress: string;
  @IsNumber()
  chainId: number;
}
