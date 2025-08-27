import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmExchangeRateHstsDto {
  @IsString()
  tokenAddress: string;
  @IsString()
  datetime: Date;
}
