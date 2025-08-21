import { IsString, IsOptional, IsNumber, IsDate } from 'class-validator';

export class MmGlobalsDto {
  @IsString()
  name: string;
  @IsString()
  value: object;
}
