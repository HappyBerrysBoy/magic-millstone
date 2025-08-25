import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmTvlHstsDto {
  @IsString()
  portfolioId: string;
  @IsString()
  datetime: Date;
}
