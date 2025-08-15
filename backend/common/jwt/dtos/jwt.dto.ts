import { CoreOutput } from '@common/dtos/output.dto';

export type VerifyStatus = 'CREATE' | 'REFRESH' | 'VERIFIED' | 'NOT_VERIFIED';

export class JwtDecodeData {
  success: boolean;
  msg?: string;
  data?: any;
}

export class JwtInfo {
  accessToken: string;
  refreshToken: string;
  address: string;
  chainId: number;
}

export class JwtOutput extends CoreOutput {
  data?: JwtInfo;
  status?: VerifyStatus;
}
