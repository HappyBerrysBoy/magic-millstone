import { IsString, IsOptional, IsNumber, IsDate } from 'class-validator';

export class MmUsersDto {
  @IsString()
  address: string;
}
