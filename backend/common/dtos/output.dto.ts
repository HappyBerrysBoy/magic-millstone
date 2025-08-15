import { IsString, IsBoolean } from 'class-validator';

export class CoreOutput {
  error?: any;

  @IsString()
  msg?: string;

  @IsBoolean()
  success: boolean;
}

export class DataOutput<T> extends CoreOutput {
  data?: T;
  offset?: number;
  limit?: number;
  total?: number;
}
