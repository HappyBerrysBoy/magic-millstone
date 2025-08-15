import { JwtDecodeData } from '@common/jwt/dtos/jwt.dto';
import { JwtService } from '@common/jwt/jwt.service';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AppMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  excludedRoutes = [
    { method: 'GET', url: '/logger' },
    { method: 'POST', url: '/logger' },
  ];

  isExcludedRoute = (req) => {
    for (const route of this.excludedRoutes) {
      if (req.method === route.method && req.originalUrl.startsWith(route.url)) {
        return true;
      }
    }
    return false;
  };

  async use(req: Request, res: Response, next: NextFunction) {
    console.log('new request submitted |', req.method.toUpperCase(), req.originalUrl);
    try {
      if (req.originalUrl.startsWith('/ad') || this.isExcludedRoute(req)) {
        next();
        return;
      }

      const authorization = req.headers.authorization;
      const token = authorization ? authorization.split(' ')[1] : '';
      const decoded: JwtDecodeData = await this.jwtService.decode(token);

      if (!decoded.success) {
        res.json({ success: false, error: 'NOT_VERIFIED' });
        return;
      }

      const { address, chainId } = decoded.data;

      if (!address || !chainId) {
        res.json({ success: false, error: 'INVALID_TOKEN_DATA' });
        return;
      }

      next();
    } catch (error) {
      console.log('$$$$ error', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
}
