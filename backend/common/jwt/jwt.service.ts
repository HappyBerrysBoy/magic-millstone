import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtDecodeData, JwtOutput } from '@common/jwt/dtos/jwt.dto';
import { decode } from 'next-auth/jwt';
import { DEFAULT_CHAIN_ID } from '@common/jwt/jwt.constants';

export interface Payload {
  address: string;
  chainId: number;
}

@Injectable()
export class JwtService {
  async decode(token: string): Promise<JwtDecodeData> {
    try {
      const decoded = await decode({
        token: token,
        secret: process.env.NEXTAUTH_SECRET,
      });

      const data = {
        address: decoded.sub,
        chainId: decoded.chainId || DEFAULT_CHAIN_ID,
      };

      return {
        success: true,
        data,
      };
    } catch (e) {
      console.log('$$$$ Unauthorized(e)', e);
      return {
        success: false,
      };
    }
  }

  // createAccessToken(payload: Payload, expiresIn = '1h'): string {
  //   return this.createToken(payload, expiresIn, process.env.JWT_ACCESS_SECRET);
  // }

  // createRefreshToken(payload: Payload, expiresIn = '1000d'): string {
  //   return this.createToken(payload, expiresIn, process.env.JWT_REFRESH_SECRET);
  // }

  // private createToken(payload: Payload, expiresIn: string, secret: string): string {
  //   try {
  //     const option = { expiresIn };
  //     const token = jwt.sign(payload, secret, option);
  //     return token;
  //   } catch (e) {
  //     throw e;
  //   }
  // }

  // verifyAccessToken(token: string): JwtDecodeData {
  //   return this.verifyToken(token, process.env.JWT_ACCESS_SECRET);
  // }

  // verifyRefreshToken(token: string): JwtDecodeData {
  //   return this.verifyToken(token, process.env.JWT_REFRESH_SECRET);
  // }

  // private verifyToken(token: string, secret: string): JwtDecodeData {
  //   let decoded;
  //   try {
  //     decoded = jwt.verify(token, secret);
  //     console.log(new Date(decoded.iat * 1000), new Date(decoded.exp * 1000));
  //     return { success: true, data: decoded };
  //   } catch (e) {
  //     decoded = jwt.decode(token);
  //     return { success: false, data: decoded, msg: e.message };
  //   }
  // }

  // jwtInit(address: string, chainId: number): JwtOutput {
  //   try {
  //     const PAYLOAD = { address, chainId };
  //     const accessToken = this.createAccessToken(PAYLOAD);
  //     const refreshToken = this.createRefreshToken(PAYLOAD);

  //     console.log('jwtInit', {
  //       accessToken: accessToken,
  //       refreshToken: refreshToken,
  //       address,
  //       chainId,
  //     });

  //     return {
  //       success: true,
  //       data: {
  //         accessToken: accessToken,
  //         refreshToken: refreshToken,
  //         address,
  //         chainId,
  //       },
  //       status: 'CREATE',
  //     };
  //   } catch (e) {
  //     throw e;
  //   }
  // }
}
