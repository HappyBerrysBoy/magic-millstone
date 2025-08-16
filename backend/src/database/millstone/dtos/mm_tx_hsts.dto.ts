import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmTxHstsDto {
  @IsString()
  txId: string;
  @IsString()
  address: string;
  @IsString()
  type: string;
  @IsString()
  datetime: Date;
  @IsNumber()
  blockNumber: number;
}
