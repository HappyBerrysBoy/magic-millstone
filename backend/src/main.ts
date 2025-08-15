import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from '@utils/swagger';
import expressBasicAuth from 'express-basic-auth';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.SWAGGER_USED && process.env.SWAGGER_USED === 'Y') {
    app.use(
      //이 부분 추가
      ['/ad'], // docs(swagger end point)에 진입시
      expressBasicAuth({
        challenge: true,
        users: {
          [process.env.SWAGGER_USER]: process.env.SWAGGER_PASSWORD, // 지정된 ID/비밀번호
        },
      }),
    );
    setupSwagger(app);
  }

  const corsOptions: CorsOptions = {
    origin: [''],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Refresh-Token'],
    exposedHeaders: ['Authorization', 'Refresh-Token'],
  };
  app.enableCors(corsOptions);

  await app.listen(process.env.PORT);
}
bootstrap();
