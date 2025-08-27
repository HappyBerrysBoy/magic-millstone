import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmApyHstsDto {
  @IsString()
  portfolioId: string;
  @IsString()
  datetime: Date;
  @IsNumber()
  value: number;
}
