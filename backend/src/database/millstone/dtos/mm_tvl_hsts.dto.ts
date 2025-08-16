import { IsString, IsOptional,IsNumber,IsDate } from 'class-validator';

export class MmTvlHstsDto {
  @IsString()
  portfolio_name: string;
  @IsString()
  datetime: Date;
}
