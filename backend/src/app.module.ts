import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ControllerExceptionFilter } from 'common/filters/controller-exception.filter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppMiddleware } from './app.middleware';
import { JwtService } from '@common/jwt/jwt.service';
import { MillstoneModule } from '@database/millstone/millstone.module';
import { UserModule } from './user/user.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { SchedulerModule } from './scheduler/scheduler.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV
        ? `.env.${process.env.NODE_ENV}`
        : '.env',
    }),
    ScheduleModule.forRoot(),
    MillstoneModule,
    UserModule,
    PortfolioModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppMiddleware,
    // JwtService,
    {
      provide: APP_FILTER,
      useClass: ControllerExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AppMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
