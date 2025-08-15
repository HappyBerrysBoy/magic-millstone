import { DynamicModule, Global, Module } from '@nestjs/common';
import { CONFIG_OPTIONS } from './jwt.constants';
import { JwtModuleOptions } from './jwt.interfaces';
import { JwtService } from './jwt.service';

@Module({})
// Global() 어노테이션은 다른 모듈에서 땡겨 쓸 때 import[] 배열에 포함되지 않아도 바로 사용 할 수 있음
@Global()
export class JwtModule {
  static forRoot(options: JwtModuleOptions): DynamicModule {
    return {
      module: JwtModule,
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: options,
        },
        JwtService,
      ],
      // 아래의 Providers에 JwtService만 쓰면 그 아래와 같이 정의한 것과 동일하게 취급
      // providers: [JwtService],
      // providers: [{provide:JwtService, useClass:JwtService}],
      exports: [JwtService],
    };
  }
}
